import { memo, useImperativeHandle } from "react";
import type { Ref } from "react";
import { buildingsById } from "../data/buildings";
import { campusMap } from "../data/campusMap";
import type { Building, Rect } from "../data/types";
import type { Journal } from "../journal/types";
import { useBuildingClick } from "./useBuildingClick";
import { useBuildingHover } from "./useBuildingHover";
import type { HoverPoint } from "./useBuildingHover";
import { useMapView } from "./useMapView";
import type { Size } from "./view";

const CLIP_ID = "campus-map-clip";

/** The opening view on landscape screens: Washington Square and its surroundings. */
const HOME_LANDSCAPE: Rect = { x: 293.4, y: 952.8, width: 1429, height: 752 };

/** Space around the park on portrait screens, which fit far less of that width. */
const PORTRAIT_PADDING = 140;
const park = campusMap.washingtonSquarePark;
const HOME_PORTRAIT: Rect = {
  x: park.x - PORTRAIT_PADDING,
  y: park.y - PORTRAIT_PADDING,
  width: park.width + PORTRAIT_PADDING * 2,
  height: park.height + PORTRAIT_PADDING * 2,
};

function getHome(viewport: Size): Rect {
  return viewport.width >= viewport.height ? HOME_LANDSCAPE : HOME_PORTRAIT;
}

const TOOLTIP_OFFSET = 14;
/** How close to the window's edges the tooltip gets before flipping sides. */
const TOOLTIP_FLIP_X = 300;
const TOOLTIP_FLIP_Y = 200;

/** The smallest area, in map units, that focusing on a building zooms to. */
const FOCUS_MIN_SIZE = 320;

/** The map area to show when focusing on a building: its bounds, padded out to a minimum. */
function focusBounds(buildingId: string): Rect | null {
  const path = document.getElementById(buildingId);
  if (!(path instanceof SVGGraphicsElement)) return null;
  const box = path.getBBox();
  const width = Math.max(box.width, FOCUS_MIN_SIZE);
  const height = Math.max(box.height, FOCUS_MIN_SIZE);
  return {
    x: box.x + box.width / 2 - width / 2,
    y: box.y + box.height / 2 - height / 2,
    width,
    height,
  };
}

export interface CampusMapHandle {
  /** Pans and zooms to center a building. */
  focusBuilding: (buildingId: string) => void;
}

interface CampusMapProps {
  journal: Journal;
  selectedId: string | null;
  /** Called with the clicked building, or null for a click on empty map. */
  onBuildingClick: (buildingId: string | null) => void;
  ref?: Ref<CampusMapHandle>;
}

interface MapShapesProps {
  selectedId: string | null;
  journal: Journal;
}

function buildingClass(id: string, { selectedId, journal }: MapShapesProps): string | undefined {
  const classes = [journal.has(id) && "logged", id === selectedId && "selected"].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
}

// The paths never change, so panning and zooming only update the parent <g>.
// This only re-renders when the selection or journal changes.
const MapShapes = memo(function MapShapes(props: MapShapesProps) {
  return (
    <g clipPath={`url(#${CLIP_ID})`}>
      <g className="blocks">
        {campusMap.blocks.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="parks">
        {campusMap.parks.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="buildings">
        {campusMap.buildings.map((building) => (
          <path
            key={building.id}
            id={building.id}
            d={building.d}
            className={buildingClass(building.id, props)}
          />
        ))}
      </g>
      <g className="roads">
        {campusMap.roads.map((road, i) => (
          <path
            key={i}
            d={road.d}
            className={road.strokeWidth === undefined ? "road-fill" : "road-line"}
            strokeWidth={road.strokeWidth}
          />
        ))}
      </g>
    </g>
  );
});

function BuildingTooltip({ building, point }: { building: Building; point: HoverPoint }) {
  const flipX = point.x > window.innerWidth - TOOLTIP_FLIP_X;
  const flipY = point.y > window.innerHeight - TOOLTIP_FLIP_Y;
  return (
    <ul
      className="map-tooltip"
      role="tooltip"
      style={{
        left: point.x + (flipX ? -TOOLTIP_OFFSET : TOOLTIP_OFFSET),
        top: point.y + (flipY ? -TOOLTIP_OFFSET : TOOLTIP_OFFSET),
        transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
      }}
    >
      {building.names.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

/** The map itself. Panels and journal state live in the app around it. */
export function CampusMap({ journal, selectedId, onBuildingClick, ref }: CampusMapProps) {
  const { view, elementRef, handlers, zoomIn, zoomOut, reset, focus, canZoomIn, canZoomOut } =
    useMapView(campusMap, getHome);
  const { hover, hoverHandlers } = useBuildingHover(view);
  const hoveredBuilding = hover && buildingsById.get(hover.buildingId);

  const clickHandlers = useBuildingClick(onBuildingClick);

  useImperativeHandle(
    ref,
    () => ({
      focusBuilding: (buildingId) => {
        const bounds = focusBounds(buildingId);
        if (bounds) focus(bounds);
      },
    }),
    [focus],
  );

  return (
    <main className="map-page">
      <div
        ref={elementRef}
        className="map-stage"
        role="application"
        aria-label="NYU campus map. Drag or use arrow keys to pan; scroll or use plus and minus to zoom."
        tabIndex={0}
        {...handlers}
        {...hoverHandlers}
        {...clickHandlers}
        onPointerDownCapture={(event) => {
          hoverHandlers.onPointerDownCapture();
          clickHandlers.onPointerDownCapture(event);
        }}
      >
        {view && (
          <svg width="100%" height="100%" aria-hidden="true">
            <defs>
              <clipPath id={CLIP_ID}>
                <rect width={campusMap.width} height={campusMap.height} />
              </clipPath>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              <MapShapes selectedId={selectedId} journal={journal} />
            </g>
          </svg>
        )}
      </div>
      {hover && hoveredBuilding && (
        <BuildingTooltip building={hoveredBuilding} point={hover.point} />
      )}
      <div className="map-controls">
        <button type="button" onClick={zoomIn} disabled={!canZoomIn} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={zoomOut} disabled={!canZoomOut} aria-label="Zoom out">
          −
        </button>
        <button
          type="button"
          className="map-reset"
          onClick={reset}
          aria-label="Reset to the opening view"
          title="Reset to the opening view"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M6 3v3H3M10 3v3h3M6 13v-3H3M10 13v-3h3" />
          </svg>
        </button>
      </div>
    </main>
  );
}
