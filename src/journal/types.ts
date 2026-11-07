/** Longest floor label, e.g. "12", "B2", "PH". */
export const FLOOR_MAX_LENGTH = 3;
export const NOTES_MAX_LENGTH = 200;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;

/** One visit to a building. Mock data for now: kept in memory only. */
export interface JournalEntry {
  id: string;
  /** ISO date, YYYY-MM-DD. Required. */
  date: string;
  /** Free text, at most FLOOR_MAX_LENGTH characters. */
  floor: string;
  /** 0.5–5 in steps of 0.5, or 0 for unrated. */
  rating: number;
  /** At most NOTES_MAX_LENGTH characters. */
  notes: string;
}

/** Every building's entries, by building id. Buildings with none are absent. */
export type Journal = ReadonlyMap<string, readonly JournalEntry[]>;
