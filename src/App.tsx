import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AccountMenu } from "./auth/AccountMenu";
import { SignInPrompt } from "./auth/SignInPrompt";
import { useAuth } from "./auth/useAuth";
import { buildingsById } from "./data/buildings";
import { DiaryPanel } from "./diary/DiaryPanel";
import { FeedPanel } from "./feed/FeedPanel";
import { useFeed } from "./feed/useFeed";
import { LikesContext, useLikes } from "./likes/useLikes";
import { useFriends } from "./friends/useFriends";
import { BuildingPanel } from "./journal/BuildingPanel";
import type { JournalEntry } from "./journal/types";
import { useJournal } from "./journal/useJournal";
import { CampusMap } from "./map/CampusMap";
import type { CampusMapHandle } from "./map/CampusMap";
import { NavBar } from "./nav/NavBar";
import { ProfilePanel } from "./profile/ProfilePanel";
import { UsernameSetup } from "./profile/UsernameSetup";
import { useProfile } from "./profile/useProfile";
import type { NavView } from "./nav/NavBar";
import { SidePanel } from "./ui/SidePanel";
import { Toast } from "./ui/Toast";

/** What the side panel over the map shows: a building's journal, a profile, or a nav view. */
type Panel =
  | { kind: "building"; buildingId: string }
  /** `userId` is null only when the nav's Profile button is pressed while signed out. */
  | { kind: "profile"; userId: string | null }
  | { kind: Exclude<NavView, "profile"> };

/** The open panel, and the panels opened before it (oldest first) for the back button. */
interface PanelState {
  current: Panel | null;
  back: readonly Panel[];
}

const CLOSED: PanelState = { current: null, back: [] };
/** Enough to retrace any realistic session without growing forever. */
const MAX_BACK = 50;

const samePanel = (a: Panel, b: Panel) =>
  a.kind === b.kind &&
  (a.kind === "building"
    ? a.buildingId === (b as typeof a).buildingId
    : a.kind === "profile"
      ? a.userId === (b as typeof a).userId
      : true);

const NO_ENTRIES: readonly JournalEntry[] = [];

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function App() {
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const { auth, signIn, signOut, deleteAccount } = useAuth();
  const userId = auth.status === "signedIn" ? auth.user.id : null;
  const { journal, status, retry, saveEntry, deleteEntry } = useJournal(userId, setToast);
  const {
    profile,
    status: profileStatus,
    retry: retryProfile,
    createProfile,
    updateProfile,
  } = useProfile(userId);

  useEffect(() => {
    if (profileStatus === "error") setToast("Couldn't load your profile.");
  }, [profileStatus]);
  // Friendships need a profile on both ends, so wait for ours.
  const friends = useFriends(profileStatus === "ready" ? userId : null, setToast);
  const friendProfiles = useMemo(
    () => new Map(friends.friends.map(({ profile }) => [profile.id, profile])),
    [friends.friends],
  );
  const feed = useFeed(profileStatus === "ready" ? userId : null, friendProfiles);
  const { reload: reloadFeed } = feed;

  const [panels, setPanels] = useState<PanelState>(CLOSED);
  const panel = panels.current;
  /** Opens a panel, remembering the one it replaces so back returns to it. */
  const navigate = useCallback(
    (next: Panel) =>
      setPanels(({ current, back }) =>
        current && samePanel(current, next)
          ? { current, back }
          : { current: next, back: current ? [...back, current].slice(-MAX_BACK) : [] },
      ),
    [],
  );
  const goBack = useCallback(
    () =>
      setPanels(({ back }) =>
        back.length > 0 ? { current: back[back.length - 1], back: back.slice(0, -1) } : CLOSED,
      ),
    [],
  );
  const onBack = panels.back.length > 0 ? goBack : undefined;

  // Like counts for every entry on screen, shared so they agree everywhere.
  const likes = useLikes(profileStatus === "ready" ? userId : null, setToast);
  const { load: loadLikes } = likes;
  const journalEntryIds = useMemo(
    () => [...journal.values()].flatMap((entries) => entries.map((entry) => entry.id)),
    [journal],
  );
  const likesContext = useMemo(
    () =>
      profileStatus === "ready"
        ? {
            ...likes,
            // From a "Liked by" list: back returns to the panel the list was in.
            onOpenProfile: (id: string) => navigate({ kind: "profile", userId: id }),
          }
        : null,
    [profileStatus, likes, navigate],
  );
  // Your own entries: once each (new entries as they're written).
  useEffect(() => void loadLikes(journalEntryIds), [journalEntryIds, loadLikes]);
  // The feed: fresh counts whenever it (re)loads a page.
  useEffect(
    () =>
      void loadLikes(
        feed.state.items.map((item) => item.entry.id),
        true,
      ),
    [feed.state.items, loadLikes],
  );

  const mapRef = useRef<CampusMapHandle>(null);

  // A different account (or none) shouldn't see the last one's panels.
  useEffect(() => setPanels(CLOSED), [userId]);

  const closePanel = useCallback(() => setPanels(CLOSED), []);
  const openBuilding = useCallback(
    (buildingId: string | null) =>
      buildingId ? navigate({ kind: "building", buildingId }) : closePanel(),
    [navigate, closePanel],
  );

  const focusBuilding = useCallback(
    (buildingId: string) => mapRef.current?.focusBuilding(buildingId),
    [],
  );

  const handleSignIn = () =>
    signIn().catch((error) => setToast(`Couldn't sign in: ${errorMessage(error)}`));
  const handleSignOut = () =>
    signOut().catch((error) => setToast(`Couldn't sign out: ${errorMessage(error)}`));
  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "Delete your account and every diary entry in it? This can't be undone.",
    );
    if (!confirmed) return;
    deleteAccount().catch((error) =>
      setToast(`Couldn't delete your account: ${errorMessage(error)}`),
    );
  };

  /**
   * What a journal panel shows instead of its contents while signed out,
   * loading, or failed to load; null once the journal is ready.
   */
  const gate: ReactNode =
    auth.status === "signedOut" ? (
      <SignInPrompt onSignIn={handleSignIn} />
    ) : auth.status === "loading" || status === "loading" || status === "signedOut" ? (
      <div className="side-panel-body panel-message">
        <p>Loading your diary…</p>
      </div>
    ) : status === "error" ? (
      <div className="side-panel-body panel-message">
        <p>Your diary couldn't be loaded.</p>
        <button type="button" className="button-secondary" onClick={retry}>
          Try again
        </button>
      </div>
    ) : null;

  const selectedId = panel?.kind === "building" ? panel.buildingId : null;
  const selectedBuilding = selectedId ? buildingsById.get(selectedId) : undefined;
  const activeView: NavView | null =
    panel?.kind === "profile"
      ? panel.userId === userId
        ? "profile"
        : null
      : panel && panel.kind !== "building"
        ? panel.kind
        : null;

  return (
    <LikesContext value={likesContext}>
      <div className="app">
        <NavBar
          active={activeView}
          alerts={
            friends.incoming.length > 0
              ? {
                  profile: `${friends.incoming.length} friend ${
                    friends.incoming.length === 1 ? "request" : "requests"
                  }`,
                }
              : undefined
          }
          onToggle={(view) => {
            // Its own button again closes it, like �.
            if (activeView === view) return closePanel();
            navigate(view === "profile" ? { kind: "profile", userId } : { kind: view });
            // Opening the feed from the nav shows the latest; coming back from a profile doesn't.
            if (view === "feed") reloadFeed();
            // Opening the diary picks up likes friends have left since.
            if (view === "diary") void loadLikes(journalEntryIds, true);
          }}
          account={
            <AccountMenu
              auth={auth}
              username={profile?.username ?? null}
              requestCount={friends.incoming.length}
              onOpenProfile={() => userId && navigate({ kind: "profile", userId })}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              onDeleteAccount={handleDeleteAccount}
            />
          }
        />
        <div className="app-body">
          <CampusMap
            ref={mapRef}
            journal={journal}
            selectedId={selectedId}
            onBuildingClick={openBuilding}
          />
          {selectedBuilding &&
            (gate ? (
              <SidePanel title={selectedBuilding.names[0]} onBack={onBack} onClose={closePanel}>
                {gate}
              </SidePanel>
            ) : (
              <BuildingPanel
                key={selectedBuilding.id}
                building={selectedBuilding}
                entries={journal.get(selectedBuilding.id) ?? NO_ENTRIES}
                onSave={(entry) => void saveEntry(selectedBuilding.id, entry)}
                onDelete={(entryId) => void deleteEntry(selectedBuilding.id, entryId)}
                onBack={onBack}
                onClose={closePanel}
              />
            ))}
          {panel?.kind === "diary" &&
            (gate ? (
              <SidePanel title="Diary" onBack={onBack} onClose={closePanel}>
                {gate}
              </SidePanel>
            ) : (
              <DiaryPanel
                journal={journal}
                buildingsById={buildingsById}
                onOpenBuilding={(buildingId) => {
                  openBuilding(buildingId);
                  mapRef.current?.focusBuilding(buildingId);
                }}
                onBack={onBack}
                onClose={closePanel}
              />
            ))}
          {panel?.kind === "profile" &&
            (auth.status === "signedOut" ? (
              <SidePanel title="Profile" onBack={onBack} onClose={closePanel}>
                <SignInPrompt onSignIn={handleSignIn} />
              </SidePanel>
            ) : profile ? (
              <ProfilePanel
                key={panel.userId ?? profile.id}
                userId={panel.userId ?? profile.id}
                ownProfile={profile}
                friends={friends}
                journal={journal}
                buildingsById={buildingsById}
                onOpenBuilding={(buildingId) => {
                  openBuilding(buildingId);
                  mapRef.current?.focusBuilding(buildingId);
                }}
                onFocusBuilding={focusBuilding}
                onSaveOwn={updateProfile}
                onOpenProfile={(id) => navigate({ kind: "profile", userId: id })}
                onBack={onBack}
                onClose={closePanel}
              />
            ) : (
              <SidePanel title="Profile" onBack={onBack} onClose={closePanel}>
                <div className="side-panel-body panel-message">
                  {profileStatus === "error" ? (
                    <>
                      <p>Your profile couldn't be loaded.</p>
                      <button type="button" className="button-secondary" onClick={retryProfile}>
                        Try again
                      </button>
                    </>
                  ) : (
                    <p>Loading your profile…</p>
                  )}
                </div>
              </SidePanel>
            ))}
          {panel?.kind === "feed" &&
            (auth.status === "signedOut" ? (
              <SidePanel title="Feed" onBack={onBack} onClose={closePanel}>
                <SignInPrompt onSignIn={handleSignIn} />
              </SidePanel>
            ) : profile ? (
              <FeedPanel
                feed={feed.state}
                onLoadMore={feed.loadMore}
                onReload={reloadFeed}
                friends={friends}
                buildingsById={buildingsById}
                onFocusBuilding={focusBuilding}
                onOpenProfile={(id) => navigate({ kind: "profile", userId: id })}
                onBack={onBack}
                onClose={closePanel}
              />
            ) : (
              <SidePanel title="Feed" onBack={onBack} onClose={closePanel}>
                <div className="side-panel-body panel-message">
                  <p>Loading…</p>
                </div>
              </SidePanel>
            ))}
          {toast && <Toast message={toast} onDismiss={dismissToast} />}
        </div>
        {profileStatus === "missing" && (
          <UsernameSetup onCreate={createProfile} onSignOut={handleSignOut} />
        )}
      </div>
    </LikesContext>
  );
}
