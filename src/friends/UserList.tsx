import type { ReactNode } from "react";
import type { Profile } from "../profile/types";

interface UserListProps {
  users: readonly Profile[];
  onOpenProfile: (userId: string) => void;
  /** Buttons at the end of a row, e.g. Accept and Decline. */
  actions?: (user: Profile) => ReactNode;
  /** Small text under a username, e.g. "Friend". */
  note?: (user: Profile) => ReactNode;
}

/** A list of users; each username opens their profile. */
export function UserList({ users, onOpenProfile, actions, note }: UserListProps) {
  return (
    <ul className="user-list">
      {users.map((user) => (
        <li key={user.id} className="user-row">
          <span className="user-avatar" aria-hidden="true">
            {user.username.charAt(0).toUpperCase()}
          </span>
          <span className="user-row-name">
            <button type="button" className="user-link" onClick={() => onOpenProfile(user.id)}>
              @{user.username}
            </button>
            {note?.(user)}
          </span>
          {actions && <span className="user-row-actions">{actions(user)}</span>}
        </li>
      ))}
    </ul>
  );
}
