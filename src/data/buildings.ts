import { campusMap } from "./campusMap";

export const buildingsById = new Map(campusMap.buildings.map((b) => [b.id, b]));
