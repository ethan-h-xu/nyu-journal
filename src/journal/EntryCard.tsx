import type { ReactNode } from "react";
import { LikeButton } from "../likes/LikeButton";
import { formatDate } from "./format";
import { PoopScore } from "./PoopRating";
import type { JournalEntry } from "./types";

interface EntryCardProps {
  entry: JournalEntry;
  /** Shown above the date, e.g. the building's name in the diary. */
  heading?: ReactNode;
  /** Buttons along the bottom, e.g. Edit and Delete. */
  actions?: ReactNode;
}

/**
 * One journal entry, as shown in a building's log, the diary, the feed and
 * profiles. Has a like button wherever likes are available (see LikesContext).
 */
export function EntryCard({ entry, heading, actions }: EntryCardProps) {
  return (
    <article className="entry">
      {heading && <h3 className="entry-heading">{heading}</h3>}
      <div className="entry-meta">
        <time dateTime={entry.date}>{formatDate(entry.date)}</time>
        {entry.floor && <span className="entry-floor">Floor {entry.floor}</span>}
      </div>
      <div className="entry-score-row">
        <PoopScore value={entry.rating} />
        <LikeButton entryId={entry.id} />
      </div>
      {entry.notes && <p className="entry-notes">{entry.notes}</p>}
      {actions && <div className="entry-actions">{actions}</div>}
    </article>
  );
}
