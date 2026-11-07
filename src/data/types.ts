export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Building {
  id: string;
  /** The building's number on the PDF map. */
  number: number;
  /** Every name the PDF's index lists for this number; empty if it lists none. */
  names: string[];
  d: string;
}

/** A street: a white stroke when `strokeWidth` is set, otherwise a white fill. */
export interface Road {
  d: string;
  strokeWidth?: number;
}

export interface CampusMapData {
  width: number;
  height: number;
  washingtonSquarePark: Rect;
  blocks: string[];
  parks: string[];
  buildings: Building[];
  roads: Road[];
}
