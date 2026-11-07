import { useState } from "react";
import type { Building } from "../data/types";
import { SidePanel } from "../ui/SidePanel";
import { EntryCard } from "./EntryCard";
import { EntryForm } from "./EntryForm";
import { compareNewestFirst } from "./format";
import type { JournalEntry } from "./types";

/** Which entry the form is open for; null shows the log instead. */
type Editing = "new" | { id: string } | null;

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
  const [title, ...otherNames] = building.names;

  // With nothing logged yet there's no log to show, so go straight to the form.
  const current: Editing = editing ?? (entries.length === 0 ? "new" : null);
  const editedEntry =
    current && current !== "new" ? entries.find((e) => e.id === current.id) : undefined;

  const subtitle =
    current === "new"
      ? "New entry"
      : current
        ? "Edit entry"
        : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  return (
    <SidePanel
      title={title}
      aside={otherNames.length > 0 ? `Also: ${otherNames.join(", ")}` : undefined}
      subtitle={subtitle}
      onClose={onClose}
    >
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
        <div className="side-panel-body">
          <button
            type="button"
            className="button-primary entry-new"
            onClick={() => setEditing("new")}
          >
            + New entry
          </button>
          <ol className="entry-list">
            {[...entries].sort(compareNewestFirst).map((entry) => (
              <li key={entry.id}>
                <EntryCard
                  entry={entry}
                  actions={
                    <>
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
                    </>
                  }
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </SidePanel>
  );
}
