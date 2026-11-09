import type { Building } from "../data/types";
import { UserList } from "../friends/UserList";
import { EntryCard } from "../journal/EntryCard";
import type { Profile } from "./types";
import type { Counts, EntryPages, Loadable, ProfileEntry } from "./useUserActivity";
import { RECENT_DAYS } from "./useUserActivity";

interface ProfileActivityProps {
  counts: Loadable<Counts>;
  entries: EntryPages;
  onLoadMore: () => void;
  /** Omit to leave the friend list out, e.g. on your own profile, which has its own. */
  friendList?: Loadable<Profile[]>;
  buildingsById: ReadonlyMap<string, Building>;
  /** Called when an entry is picked. */
  onOpenEntry: (item: ProfileEntry) => void;
  onOpenProfile: (userId: string) => void;
  onRetry?: () => void;
}

export const buildingName = (buildingsById: ReadonlyMap<string, Building>, buildingId: string) =>
  buildingsById.get(buildingId)?.names[0] ?? buildingId;

/** A profile's entry counts, recent entries and friends. */
export function ProfileActivity({
  counts,
  entries,
  onLoadMore,
  friendList,
  buildingsById,
  onOpenEntry,
  onOpenProfile,
  onRetry,
}: ProfileActivityProps) {
  const failed =
    counts.status === "error" || entries.status === "error" || friendList?.status === "error";

  return (
    <>
      {failed && (
        <p className="section-note">
          Some of this profile couldn't be loaded.{" "}
          {onRetry && (
            <button type="button" className="text-button" onClick={onRetry}>
              Try again
            </button>
          )}
        </p>
      )}

      <dl className="profile-stats">
        <div>
          <dt>Entries</dt>
          <dd>{counts.status === "ready" ? counts.value.lifetime : "–"}</dd>
        </div>
        <div>
          <dt>Last {RECENT_DAYS} days</dt>
          <dd>{counts.status === "ready" ? counts.value.recent : "–"}</dd>
        </div>
        {friendList && (
          <div>
            <dt>Friends</dt>
            <dd>{friendList.status === "ready" ? friendList.value.length : "–"}</dd>
          </div>
        )}
      </dl>

      <section className="profile-section">
        <h3>Recent entries</h3>
        {entries.status === "loading" ? (
          <p className="section-note">Loading…</p>
        ) : entries.items.length === 0 ? (
          entries.status === "ready" && <p className="section-note">No entries yet.</p>
        ) : (
          <>
            <ol className="entry-list">
              {entries.items.map((item) => (
                <li key={item.entry.id}>
                  <EntryCard
                    entry={item.entry}
                    heading={
                      // Its hit area stretches over the whole card (see .entry-link).
                      <button
                        type="button"
                        className="entry-link"
                        onClick={() => onOpenEntry(item)}
                      >
                        {buildingName(buildingsById, item.buildingId)}
                      </button>
                    }
                  />
                </li>
              ))}
            </ol>
            {entries.hasMore && (
              <button
                type="button"
                className="button-secondary"
                onClick={onLoadMore}
                disabled={entries.loadingMore}
              >
                {entries.loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </section>

      {friendList && (
        <section className="profile-section">
          <h3>Friends</h3>
          {friendList.status === "loading" ? (
            <p className="section-note">Loading…</p>
          ) : (
            friendList.status === "ready" &&
            (friendList.value.length === 0 ? (
              <p className="section-note">No friends yet.</p>
            ) : (
              <UserList users={friendList.value} onOpenProfile={onOpenProfile} />
            ))
          )}
        </section>
      )}
    </>
  );
}
