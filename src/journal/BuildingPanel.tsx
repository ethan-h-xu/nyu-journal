import { useEffect, useId, useState } from "react";
import type { Building } from "../data/types";
import { EntryForm } from "./EntryForm";
import { PoopScore } from "./PoopRating";
import type { JournalEntry } from "./types";

/** Which entry the form is open for; null shows the log instead. */
type Editing = "new" | { id: string } | null;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Formats a YYYY-MM-DD date in the local time zone, so it doesn't shift a day. */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

/** Newest visit first; same-day entries keep the order they were added, newest first. */
function sortNewestFirst(entries: readonly JournalEntry[]): JournalEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
}

interface BuildingPanelProps {
  building: Building;
  entries: readonly JournalEntry[];
  /** Adds the entry, or replaces the one with the same id. */
  onSave: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onClose: () => void;
}

/**
 * A building's journal: its log of past entries, or the form for a new one when
 * it has none yet. Remount it (with `key`) when the building changes.
 */
export function BuildingPanel({ building, entries, onSave, onDelete, onClose }: BuildingPanelProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const id = useId();
  const [title, ...otherNames] = building.names;

  // With nothing logged yet there's no log to show, so go straight to the form.
  const current: Editing = editing ?? (entries.length === 0 ? "new" : null);
  const editedEntry =
    current && current !== "new" ? entries.find((e) => e.id === current.id) : undefined;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const subtitle =
    current === "new"
      ? "New entry"
      : current
        ? "Edit entry"
        : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  return (
    <aside className="building-panel" aria-labelledby={`${id}-title`}>
      <header className="building-panel-header">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {otherNames.length > 0 && (
            <p className="building-panel-aka">Also: {otherNames.join(", ")}</p>
          )}
          <p className="building-panel-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="building-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      {current ? (
        <EntryForm
          key={current === "new" ? "new" : current.id}
          entry={editedEntry}
          onSave={(entry) => {
            onSave(entry);
            // A new entry closes the panel; an edit returns to the log.
            if (current === "new") onClose();
            else setEditing(null);
          }}
          onCancel={() => (entries.length > 0 ? setEditing(null) : onClose())}
        />
      ) : (
        <div className="building-panel-body">
          <button
            type="button"
            className="button-primary entry-new"
            onClick={() => setEditing("new")}
          >
            + New entry
          </button>
          <ol className="entry-log">
            {sortNewestFirst(entries).map((entry) => (
              <li key={entry.id} className="entry">
                <div className="entry-meta">
                  <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                  {entry.floor && <span className="entry-floor">Floor {entry.floor}</span>}
                </div>
                <PoopScore value={entry.rating} />
                {entry.notes && <p className="entry-notes">{entry.notes}</p>}
                <div className="entry-actions">
                  <button type="button" onClick={() => setEditing({ id: entry.id })}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this entry?")) onDelete(entry.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
