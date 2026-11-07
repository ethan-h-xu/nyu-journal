import { useCallback, useState } from "react";
import type { Journal, JournalEntry } from "./types";

/** The journal and its edits. In memory only until there's a backend. */
export function useJournal() {
  const [journal, setJournal] = useState<Journal>(new Map());

  /** Adds the entry, or replaces the building's entry with the same id. */
  const saveEntry = useCallback((buildingId: string, entry: JournalEntry) => {
    setJournal((current) => {
      const entries = current.get(buildingId) ?? [];
      const exists = entries.some((e) => e.id === entry.id);
      const next = exists
        ? entries.map((e) => (e.id === entry.id ? entry : e))
        : [...entries, entry];
      return new Map(current).set(buildingId, next);
    });
  }, []);

  const deleteEntry = useCallback((buildingId: string, entryId: string) => {
    setJournal((current) => {
      const remaining = (current.get(buildingId) ?? []).filter((e) => e.id !== entryId);
      const next = new Map(current);
      if (remaining.length > 0) next.set(buildingId, remaining);
      else next.delete(buildingId);
      return next;
    });
  }, []);

  return { journal, saveEntry, deleteEntry };
}
