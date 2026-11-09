import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AccountMenu } from "./auth/AccountMenu";
import { SignInPrompt } from "./auth/SignInPrompt";
import { useAuth } from "./auth/useAuth";
import { buildingsById } from "./data/buildings";
import { DiaryPanel } from "./diary/DiaryPanel";
import { FeedPanel } from "./feed/FeedPanel";
import { useFeed } from "./feed/useFeed";
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
  /**
   * `history`: profiles visited before this one, for the back button.
   * `fromFeed`: opened from the feed, so backing out of the last profile returns there.
   */
  | { kind: "profile"; userId: string; history: readonly string[]; fromFeed?: boolean }
  | { kind: NavView }
  | null;

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

  const [panel, setPanel] = useState<Panel>(null);
  const mapRef = useRef<CampusMapHandle>(null);

  // A different account (or none) shouldn't see the last one's open panel.
  useEffect(() => setPanel(null), [userId]);

  const closePanel = useCallback(() => setPanel(null), []);
  const openBuilding = useCallback(
    (buildingId: string | null) =>
      setPanel(buildingId ? { kind: "building", buildingId } : null),
    [],
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
  const activeView =
    panel && panel.kind !== "building" && panel.kind !== "profile" ? panel.kind : null;

  return (
    <div className="app">
      <NavBar
        active={activeView}
        onToggle={(view) => {
          const opening = panel?.kind !== view;
          setPanel(opening ? { kind: view } : null);
          // Opening the feed from the nav shows the latest; coming back from a profile doesn't.
          if (opening && view === "feed") reloadFeed();
        }}
        account={
          <AccountMenu
            auth={auth}
            username={profile?.username ?? null}
            requestCount={friends.incoming.length}
            onOpenProfile={() => userId && setPanel({ kind: "profile", userId, history: [] })}
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
            <SidePanel title={selectedBuilding.names[0]} onClose={closePanel}>
              {gate}
            </SidePanel>
          ) : (
            <BuildingPanel
              key={selectedBuilding.id}
              building={selectedBuilding}
              entries={journal.get(selectedBuilding.id) ?? NO_ENTRIES}
              onSave={(entry) => void saveEntry(selectedBuilding.id, entry)}
              onDelete={(entryId) => void deleteEntry(selectedBuilding.id, entryId)}
              onClose={closePanel}
            />
          ))}
        {panel?.kind === "diary" &&
          (gate ? (
            <SidePanel title="Diary" onClose={closePanel}>
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
              onClose={closePanel}
            />
          ))}
        {panel?.kind === "profile" &&
          (profile ? (
            <ProfilePanel
              key={panel.userId}
              userId={panel.userId}
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
              onOpenProfile={(id) =>
                setPanel({ ...panel, userId: id, history: [...panel.history, panel.userId] })
              }
              onBack={
                panel.history.length > 0
                  ? () =>
                      setPanel({
                        ...panel,
                        userId: panel.history[panel.history.length - 1],
                        history: panel.history.slice(0, -1),
                      })
                  : panel.fromFeed
                    ? () => setPanel({ kind: "feed" })
                    : undefined
              }
              onClose={closePanel}
            />
          ) : (
            <SidePanel title="Profile" onClose={closePanel}>
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
            <SidePanel title="Feed" onClose={closePanel}>
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
              onOpenProfile={(id) =>
                setPanel({ kind: "profile", userId: id, history: [], fromFeed: true })
              }
              onClose={closePanel}
            />
          ) : (
            <SidePanel title="Feed" onClose={closePanel}>
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
  );
}
