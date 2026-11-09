import { useState } from "react";
import { SidePanel } from "../ui/SidePanel";
import { EditProfileForm } from "./EditProfileForm";
import type { Profile } from "./types";

interface ProfilePanelProps {
  profile: Profile;
  onSave: (fields: { username: string; bio: string }) => Promise<string | null>;
  onClose: () => void;
}

/**
 * The signed-in user's own profile. Later phases add counts, recent entries,
 * friends, and viewing other users' profiles.
 */
export function ProfilePanel({ profile, onSave, onClose }: ProfilePanelProps) {
  const [editing, setEditing] = useState(false);

  return (
    <SidePanel title={`@${profile.username}`} subtitle={editing ? "Edit profile" : undefined} onClose={onClose}>
      {editing ? (
        <EditProfileForm profile={profile} onSave={onSave} onDone={() => setEditing(false)} />
      ) : (
        <div className="side-panel-body">
          {profile.bio ? (
            <p className="profile-bio">{profile.bio}</p>
          ) : (
            <p className="profile-bio profile-bio-empty">No bio yet.</p>
          )}
          <div>
            <button type="button" className="button-secondary" onClick={() => setEditing(true)}>
              Edit profile
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
