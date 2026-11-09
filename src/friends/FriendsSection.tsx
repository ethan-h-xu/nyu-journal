import { useId, useState } from "react";
import { normalizeUsername } from "../profile/types";
import type { Friends } from "./useFriends";
import { SEARCH_MIN_LENGTH, useUserSearch } from "./useUserSearch";
import { UserList } from "./UserList";

interface FriendsSectionProps {
  selfId: string;
  friends: Friends;
  onOpenProfile: (userId: string) => void;
}

const RELATION_NOTES = {
  friend: "Friend",
  outgoing: "Request sent",
  incoming: "Wants to be friends",
} as const;

/** On your own profile: find people, answer requests, and see your friends. */
export function FriendsSection({ selfId, friends, onOpenProfile }: FriendsSectionProps) {
  const [query, setQuery] = useState("");
  const search = useUserSearch(normalizeUsername(query), selfId);
  const searchId = useId();
  const { incoming, outgoing } = friends;

  return (
    <>
      <section className="profile-section" aria-labelledby={`${searchId}-label`}>
        <div className="field">
          <label id={`${searchId}-label`} htmlFor={`${searchId}-input`}>
            Find friends
          </label>
          <input
            id={`${searchId}-input`}
            type="search"
            className="search-input"
            placeholder="Search by username"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {search.status === "idle" && query.trim() !== "" && (
          <p className="section-note">Type at least {SEARCH_MIN_LENGTH} characters.</p>
        )}
        {search.status === "searching" && <p className="section-note">Searching…</p>}
        {search.status === "error" && <p className="section-note">Couldn't search right now.</p>}
        {search.status === "done" &&
          (search.results.length === 0 ? (
            <p className="section-note">No one by that username.</p>
          ) : (
            <UserList
              users={search.results}
              onOpenProfile={onOpenProfile}
              note={(user) => {
                const kind = friends.relations.get(user.id)?.kind;
                return kind && <small className="user-row-note">{RELATION_NOTES[kind]}</small>;
              }}
            />
          ))}
      </section>

      {incoming.length > 0 && (
        <section className="profile-section">
          <h3>Friend requests</h3>
          <UserList
            users={incoming.map((r) => r.profile)}
            onOpenProfile={onOpenProfile}
            actions={(user) => (
              <>
                <button
                  type="button"
                  className="button-primary button-small"
                  onClick={() => void friends.respond(user, true)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => void friends.respond(user, false)}
                >
                  Decline
                </button>
              </>
            )}
          />
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="profile-section">
          <h3>Sent requests</h3>
          <UserList
            users={outgoing.map((r) => r.profile)}
            onOpenProfile={onOpenProfile}
            actions={(user) => (
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => void friends.remove(user)}
              >
                Cancel
              </button>
            )}
          />
        </section>
      )}

      <section className="profile-section">
        <h3>
          Friends{friends.friends.length > 0 && <span className="section-count"> {friends.friends.length}</span>}
        </h3>
        {friends.status === "loading" ? (
          <p className="section-note">Loading…</p>
        ) : friends.status === "error" ? (
          <p className="section-note">
            Couldn't load your friends.{" "}
            <button type="button" className="text-button" onClick={friends.refresh}>
              Try again
            </button>
          </p>
        ) : friends.friends.length === 0 ? (
          <p className="section-note">No friends yet. Search for someone's username above.</p>
        ) : (
          <UserList users={friends.friends.map((r) => r.profile)} onOpenProfile={onOpenProfile} />
        )}
      </section>
    </>
  );
}
