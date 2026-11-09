import { useCallback, useState } from "react";
import { LikersPopover } from "./LikersPopover";
import { useLikesContext } from "./useLikes";

/**
 * A heart and the entry's like count. On your own entries the count is a
 * button that shows who liked it. Renders nothing without a LikesContext.
 */
export function LikeButton({ entryId }: { entryId: string }) {
  const likes = useLikesContext();
  const [showLikers, setShowLikers] = useState(false);
  const closeLikers = useCallback(() => setShowLikers(false), []);
  if (!likes) return null;

  const info = likes.likes.get(entryId);
  const count = info?.count ?? 0;
  const liked = info?.likedByMe ?? false;
  const canSeeLikers = likes.ownEntryIds.has(entryId) && count > 0;
  const countLabel = `${count} ${count === 1 ? "like" : "likes"}`;

  return (
    <span className="like">
      <button
        type="button"
        className="like-button"
        aria-pressed={liked}
        aria-label={`${liked ? "Unlike" : "Like"}${info && !canSeeLikers ? `, ${countLabel}` : ""}`}
        // Until the count has loaded there's nothing to toggle from.
        disabled={!info}
        onClick={() => void likes.toggle(entryId)}
      >
        <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
        {count > 0 && !canSeeLikers && <span className="like-count">{count}</span>}
      </button>
      {canSeeLikers && (
        <button
          type="button"
          className="like-count like-count-button"
          aria-expanded={showLikers}
          aria-label={`${countLabel}, see who liked this`}
          onClick={() => setShowLikers((shown) => !shown)}
        >
          {count}
        </button>
      )}
      {showLikers && canSeeLikers && (
        <LikersPopover
          // Refetch when the count changes while it's open.
          key={count}
          entryId={entryId}
          onOpenProfile={likes.onOpenProfile}
          onClose={closeLikers}
        />
      )}
    </span>
  );
}
