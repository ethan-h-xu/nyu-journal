/**
 * Marks each building's path with its id. An attribute rather than the DOM id,
 * so a building slug can never collide with another element's id. Keep in sync
 * with the `data-building-id` prop in CampusMap.
 */
export const BUILDING_ID_ATTR = "data-building-id";

/** The id of the building at a screen point, if any. */
export function buildingIdAt(x: number, y: number): string | null {
  return (
    document.elementFromPoint(x, y)?.closest(`[${BUILDING_ID_ATTR}]`)?.getAttribute(BUILDING_ID_ATTR) ??
    null
  );
}
