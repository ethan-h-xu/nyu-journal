import { useEffect, useState } from "react";
import { FriendButton } from "../friends/FriendButton";
import { FriendsSection } from "../friends/FriendsSection";
import type { Friends } from "../friends/useFriends";
import { SidePanel } from "../ui/SidePanel";
import { EditProfileForm } from "./EditProfileForm";
import type { Profile } from "./types";
import { useUserProfile } from "./useUserProfile";

interface ProfilePanelProps {
  /** Whose profile to show. */
  userId: string;
  /** The signed-in user's own profile. */
  ownProfile: Profile;
  friends: Friends;
  onSaveOwn: (fields: { username: string; bio: string }) => Promise<string | null>;
  onOpenProfile: (userId: string) => void;
  /** Back to the previous profile; absent when there isn't one. */
  onBack?: () => void;
  onClose: () => void;
}

/**
 * A user's profile. Your own adds editing and the Friends section; anyone
 * else's has a friend button. Later phases add counts and recent entries.
 */
export function ProfilePanel(props: ProfilePanelProps) {
  return props.userId === props.ownProfile.id ? <OwnProfile {...props} /> : <OtherProfile {...props} />;
}

function Bio({ bio }: { bio: string }) {
  return bio ? (
    <p className="profile-bio">{bio}</p>
  ) : (
    <p className="profile-bio profile-bio-empty">No bio yet.</p>
  );
}

function OwnProfile({ ownProfile, friends, onSaveOwn, onOpenProfile, onBack, onClose }: ProfilePanelProps) {
  const [editing, setEditing] = useState(false);
  const { refresh } = friends;

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
          <FriendsSection selfId={ownProfile.id} friends={friends} onOpenProfile={onOpenProfile} />
        </div>
      )}
    </SidePanel>
  );
}

function OtherProfile({ userId, friends, onBack, onClose }: ProfilePanelProps) {
  const { state, retry } = useUserProfile(userId);

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
  return (
    <SidePanel title={`@${profile.username}`} onBack={onBack} onClose={onClose}>
      <div className="side-panel-body">
        <Bio bio={profile.bio} />
        <FriendButton profile={profile} friends={friends} />
      </div>
    </SidePanel>
  );
}
