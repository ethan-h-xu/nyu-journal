import { useCallback, useRef, useState } from "react";
import { buildingsById } from "./data/buildings";
import { DiaryPanel } from "./diary/DiaryPanel";
import { BuildingPanel } from "./journal/BuildingPanel";
import type { JournalEntry } from "./journal/types";
import { useJournal } from "./journal/useJournal";
import { CampusMap } from "./map/CampusMap";
import type { CampusMapHandle } from "./map/CampusMap";
import { NavBar } from "./nav/NavBar";
import type { NavView } from "./nav/NavBar";

/** What the side panel over the map shows: one building's journal, or a nav view. */
type Panel = { kind: "building"; buildingId: string } | { kind: NavView } | null;

const NO_ENTRIES: readonly JournalEntry[] = [];

export function App() {
  const { journal, saveEntry, deleteEntry } = useJournal();
  const [panel, setPanel] = useState<Panel>(null);
  const mapRef = useRef<CampusMapHandle>(null);

  const closePanel = useCallback(() => setPanel(null), []);
  const openBuilding = useCallback(
    (buildingId: string | null) =>
      setPanel(buildingId ? { kind: "building", buildingId } : null),
    [],
  );

  const selectedId = panel?.kind === "building" ? panel.buildingId : null;
  const selectedBuilding = selectedId ? buildingsById.get(selectedId) : undefined;
  const activeView = panel && panel.kind !== "building" ? panel.kind : null;

  return (
    <div className="app">
      <NavBar
        active={activeView}
        onToggle={(view) => setPanel((current) => (current?.kind === view ? null : { kind: view }))}
      />
      <div className="app-body">
        <CampusMap
          ref={mapRef}
          journal={journal}
          selectedId={selectedId}
          onBuildingClick={openBuilding}
        />
        {selectedBuilding && (
          <BuildingPanel
            key={selectedBuilding.id}
            building={selectedBuilding}
            entries={journal.get(selectedBuilding.id) ?? NO_ENTRIES}
            onSave={(entry) => saveEntry(selectedBuilding.id, entry)}
            onDelete={(entryId) => deleteEntry(selectedBuilding.id, entryId)}
            onClose={closePanel}
          />
        )}
        {panel?.kind === "diary" && (
          <DiaryPanel
            journal={journal}
            buildingsById={buildingsById}
            onOpenBuilding={(buildingId) => {
              openBuilding(buildingId);
              mapRef.current?.focusBuilding(buildingId);
            }}
            onClose={closePanel}
          />
        )}
      </div>
    </div>
  );
}
