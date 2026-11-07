import { useMemo } from "react";
import type { Building } from "../data/types";
import { EntryCard } from "../journal/EntryCard";
import { compareNewestFirst } from "../journal/format";
import type { Journal } from "../journal/types";
import { SidePanel } from "../ui/SidePanel";

interface DiaryPanelProps {
  journal: Journal;
  buildingsById: ReadonlyMap<string, Building>;
  /** Called when an entry is picked, to show its building on the map. */
  onOpenBuilding: (buildingId: string) => void;
  onClose: () => void;
}

/** Every journal entry across all buildings, newest first. */
export function DiaryPanel({ journal, buildingsById, onOpenBuilding, onClose }: DiaryPanelProps) {
  const items = useMemo(
    () =>
      [...journal]
        .flatMap(([buildingId, entries]) => entries.map((entry) => ({ buildingId, entry })))
        .sort((a, b) => compareNewestFirst(a.entry, b.entry)),
    [journal],
  );
  const buildingCount = journal.size;

  return (
    <SidePanel
      title="Diary"
      subtitle={
        items.length > 0
          ? `${items.length} ${items.length === 1 ? "entry" : "entries"} · ${buildingCount} ${
              buildingCount === 1 ? "building" : "buildings"
            }`
          : undefined
      }
      onClose={onClose}
    >
      <div className="side-panel-body">
        {items.length === 0 ? (
          <p className="empty-state">
            No entries yet. Click a building on the map to write your first one.
          </p>
        ) : (
          <ol className="entry-list">
            {items.map(({ buildingId, entry }) => (
              <li key={entry.id}>
                <EntryCard
                  entry={entry}
                  heading={
                    // Its hit area stretches over the whole card (see .entry-link).
                    <button
                      type="button"
                      className="entry-link"
                      onClick={() => onOpenBuilding(buildingId)}
                    >
                      {buildingsById.get(buildingId)?.names[0]}
                    </button>
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </SidePanel>
  );
}
