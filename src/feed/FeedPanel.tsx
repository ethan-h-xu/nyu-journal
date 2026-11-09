import { useState } from "react";
import type { Building } from "../data/types";
import { FriendEntryPanel } from "../friends/FriendEntryPanel";
import type { Friends } from "../friends/useFriends";
import { EntryCard } from "../journal/EntryCard";
import { buildingName } from "../profile/ProfileActivity";
import { SidePanel } from "../ui/SidePanel";
import type { FeedItem, FeedState } from "./useFeed";

interface FeedPanelProps {
  feed: FeedState;
  onLoadMore: () => void;
  onReload: () => void;
  friends: Friends;
  buildingsById: ReadonlyMap<string, Building>;
  /** Only flies the map to a building; the map stays yours. */
  onFocusBuilding: (buildingId: string) => void;
  onOpenProfile: (userId: string) => void;
  /** Returns to the panel opened before this one, if any. */
  onBack?: () => void;
  onClose: () => void;
}

/** Friends' entries, most recently written first. */
export function FeedPanel({
  feed: state,
  onLoadMore: loadMore,
  onReload: reload,
  friends,
  buildingsById,
  onFocusBuilding,
  onOpenProfile,
  onBack,
  onClose,
}: FeedPanelProps) {
  // An entry opened from the list; back returns to the list as it was.
  const [openItem, setOpenItem] = useState<FeedItem | null>(null);

  if (openItem) {
    return (
      <FriendEntryPanel
        buildingName={buildingName(buildingsById, openItem.buildingId)}
        username={openItem.author.username}
        entry={openItem.entry}
        onBack={() => setOpenItem(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <SidePanel title="Feed" subtitle="Your friends' latest entries"
      onBack={onBack}
      onClose={onClose}
    >
      <div className="side-panel-body">
        {state.status === "loading" ? (
          <p className="empty-state">Loading…</p>
        ) : state.status === "error" ? (
          <div className="panel-message">
            <p>The feed couldn't be loaded.</p>
            <button type="button" className="button-secondary" onClick={reload}>
              Try again
            </button>
          </div>
        ) : state.items.length === 0 ? (
          <p className="empty-state">
            {friends.friends.length === 0
              ? "Add friends from My profile to see their entries here."
              : "Your friends haven't written any entries yet."}
          </p>
        ) : (
          <>
            <ol className="entry-list">
              {state.items.map((item) => (
                <li key={item.entry.id}>
                  <EntryCard
                    entry={item.entry}
                    heading={
                      <>
                        {/* Sits above the card-wide link below, so it stays clickable. */}
                        <button
                          type="button"
                          className="feed-author"
                          onClick={() => onOpenProfile(item.author.id)}
                        >
                          @{item.author.username}
                        </button>
                        {/* Its hit area stretches over the whole card (see .entry-link). */}
                        <button
                          type="button"
                          className="entry-link"
                          onClick={() => {
                            setOpenItem(item);
                            onFocusBuilding(item.buildingId);
                          }}
                        >
                          {buildingName(buildingsById, item.buildingId)}
                        </button>
                      </>
                    }
                  />
                </li>
              ))}
            </ol>
            {state.hasMore && (
              <button
                type="button"
                className="button-secondary"
                onClick={loadMore}
                disabled={state.loadingMore}
              >
                {state.loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
