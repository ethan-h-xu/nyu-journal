import { useEffect, useMemo, useState } from "react";
import type { Building } from "../data/types";
import { FriendButton } from "../friends/FriendButton";
import { FriendEntryPanel } from "../friends/FriendEntryPanel";
import { FriendsSection } from "../friends/FriendsSection";
import type { Friends } from "../friends/useFriends";
import { compareNewestFirst, daysAgo } from "../journal/format";
import type { Journal } from "../journal/types";
import { useLikesContext } from "../likes/useLikes";
import { SidePanel } from "../ui/SidePanel";
import { EditProfileForm } from "./EditProfileForm";
import { ProfileActivity, buildingName } from "./ProfileActivity";
import type { Profile } from "./types";
import { RECENT_DAYS, RECENT_PAGE_SIZE, useUserActivity } from "./useUserActivity";
import type { ProfileEntry } from "./useUserActivity";
import { useUserProfile } from "./useUserProfile";

interface ProfilePanelProps {
  /** Whose profile to show. */
  userId: string;
  /** The signed-in user's own profile. */
  ownProfile: Profile;
  friends: Friends;
  /** The signed-in user's own entries, for their own profile. */
  journal: Journal;
  buildingsById: ReadonlyMap<string, Building>;
  /** Opens a building's panel (yours) and shows it on the map, from your own entries. */
  onOpenBuilding: (buildingId: string) => void;
  /** Only flies the map to a building, e.g. for a friend's entry. */
  onFocusBuilding: (buildingId: string) => void;
  onSaveOwn: (fields: { username: string; bio: string }) => Promise<string | null>;
  onOpenProfile: (userId: string) => void;
  /** Returns to the panel opened before this one, if any. */
  onBack?: () => void;
  onClose: () => void;
}

/**
 * A user's profile. Your own adds editing and the Friends section. Anyone
 * else's has a friend button, and once you're friends, their counts, recent
 * entries and friends.
 */
export function ProfilePanel(props: ProfilePanelProps) {
  return props.userId === props.ownProfile.id ? (
    <OwnProfile {...props} />
  ) : (
    <OtherProfile {...props} />
  );
}

function Bio({ bio }: { bio: string }) {
  return bio ? (
    <p className="profile-bio">{bio}</p>
  ) : (
    <p className="profile-bio profile-bio-empty">No bio yet.</p>
  );
}

function OwnProfile({
  ownProfile,
  friends,
  journal,
  buildingsById,
  onOpenBuilding,
  onSaveOwn,
  onOpenProfile,
  onBack,
  onClose,
}: ProfilePanelProps) {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(RECENT_PAGE_SIZE);
  const { refresh } = friends;

  // Your own entries are already loaded (and kept current) for the diary.
  const items = useMemo(
    () =>
      [...journal]
        .flatMap(([buildingId, entries]) => entries.map((entry) => ({ buildingId, entry })))
        .sort((a, b) => compareNewestFirst(a.entry, b.entry)),
    [journal],
  );
  const since = daysAgo(RECENT_DAYS);
  const recent = items.filter(({ entry }) => entry.date > since).length;

  // Pick up requests sent since the page loaded.
  useEffect(() => refresh(), [refresh]);

  return (
    <SidePanel
      title={`@${ownProfile.username}`}
      subtitle={editing ? "Edit profile" : undefined}
      onBack={onBack}
      onClose={onClose}
    >
      {editing ? (
        <EditProfileForm profile={ownProfile} onSave={onSaveOwn} onDone={() => setEditing(false)} />
      ) : (
        <div className="side-panel-body">
          <Bio bio={ownProfile.bio} />
          <div>
            <button type="button" className="button-secondary" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          </div>
          <ProfileActivity
            counts={{ status: "ready", value: { lifetime: items.length, recent } }}
            entries={{
              status: "ready",
              items: items.slice(0, shown),
              hasMore: items.length > shown,
              loadingMore: false,
            }}
            onLoadMore={() => setShown((n) => n + RECENT_PAGE_SIZE)}
            buildingsById={buildingsById}
            onOpenEntry={({ buildingId }) => onOpenBuilding(buildingId)}
            onOpenProfile={onOpenProfile}
          />
          <FriendsSection selfId={ownProfile.id} friends={friends} onOpenProfile={onOpenProfile} />
        </div>
      )}
    </SidePanel>
  );
}

function OtherProfile({
  userId,
  friends,
  buildingsById,
  onFocusBuilding,
  onOpenProfile,
  onBack,
  onClose,
}: ProfilePanelProps) {
  const { state, retry } = useUserProfile(userId);
  // One of their entries, opened from the list; back returns to the list.
  const [openEntry, setOpenEntry] = useState<ProfileEntry | null>(null);
  // Only friends can see entries and friend lists, so only load them for friends.
  const isFriend = friends.relations.get(userId)?.kind === "friend";
  const activity = useUserActivity(isFriend ? userId : null);
  // Fresh like counts for their entries whenever a page loads.
  const loadLikes = useLikesContext()?.load;
  const activityItems = activity.pages.items;
  useEffect(() => {
    if (loadLikes)
      void loadLikes(
        activityItems.map((item) => item.entry.id),
        true,
      );
  }, [activityItems, loadLikes]);

  if (state.status !== "ready") {
    return (
      <SidePanel title="Profile" onBack={onBack} onClose={onClose}>
        <div className="side-panel-body panel-message">
          {state.status === "loading" ? (
            <p>Loading…</p>
          ) : state.status === "notFound" ? (
            <p>This user doesn't exist anymore.</p>
          ) : (
            <>
              <p>This profile couldn't be loaded.</p>
              <button type="button" className="button-secondary" onClick={retry}>
                Try again
              </button>
            </>
          )}
        </div>
      </SidePanel>
    );
  }

  const { profile } = state;

  if (openEntry && isFriend) {
    return (
      <FriendEntryPanel
        buildingName={buildingName(buildingsById, openEntry.buildingId)}
        username={profile.username}
        entry={openEntry.entry}
        onBack={() => setOpenEntry(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <SidePanel title={`@${profile.username}`} onBack={onBack} onClose={onClose}>
      <div className="side-panel-body">
        <Bio bio={profile.bio} />
        <FriendButton profile={profile} friends={friends} />
        {isFriend && (
          <ProfileActivity
            counts={activity.counts}
            entries={activity.pages}
            onLoadMore={activity.loadMore}
            friendList={activity.friendList}
            buildingsById={buildingsById}
            onOpenEntry={(item) => {
              setOpenEntry(item);
              onFocusBuilding(item.buildingId);
            }}
            onOpenProfile={onOpenProfile}
            onRetry={activity.retry}
          />
        )}
      </div>
    </SidePanel>
  );
}
