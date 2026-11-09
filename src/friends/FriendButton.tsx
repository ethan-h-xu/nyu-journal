import type { Profile } from "../profile/types";
import type { Friends } from "./useFriends";

interface FriendButtonProps {
  profile: Profile;
  friends: Friends;
}

/** On someone else's profile: add, cancel, accept/decline, or unfriend. */
export function FriendButton({ profile, friends }: FriendButtonProps) {
  const relation = friends.relations.get(profile.id);

  switch (relation?.kind) {
    case "friend":
      return (
        <div className="friend-actions">
          <span className="friend-state">✓ Friends</span>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              if (window.confirm(`Unfriend @${profile.username}?`)) void friends.remove(profile);
            }}
          >
            Unfriend
          </button>
        </div>
      );
    case "outgoing":
      return (
        <div className="friend-actions">
          <span className="friend-state">Request sent</span>
          <button type="button" className="button-secondary" onClick={() => void friends.remove(profile)}>
            Cancel request
          </button>
        </div>
      );
    case "incoming":
      return (
        <div className="friend-actions">
          <span className="friend-state">Wants to be friends</span>
          <button
            type="button"
            className="button-primary"
            onClick={() => void friends.respond(profile, true)}
          >
            Accept
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void friends.respond(profile, false)}
          >
            Decline
          </button>
        </div>
      );
    default:
      return (
        <div className="friend-actions">
          <button
            type="button"
            className="button-primary"
            // Wait for the friend list, so we don't send a request to someone who already sent us one.
            disabled={friends.status !== "ready"}
            onClick={() => void friends.sendRequest(profile)}
          >
            Add friend
          </button>
        </div>
      );
  }
}
