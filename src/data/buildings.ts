import { campusMap } from "./campusMap";

export const buildingsById = new Map(campusMap.buildings.map((b) => [b.id, b]));

// Ids are what journal entries are stored against, so a duplicate would mix
// two buildings' entries together. Fail loudly instead.
if (buildingsById.size !== campusMap.buildings.length) {
  const seen = new Set<string>();
  const duplicates = campusMap.buildings.map((b) => b.id).filter((id) => seen.has(id) || !seen.add(id));
  throw new Error(`Duplicate building ids in campusMap.ts: ${duplicates.join(", ")}`);
}
