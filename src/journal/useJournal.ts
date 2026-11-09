import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import type { Journal, JournalEntry } from "./types";

type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

export type JournalStatus = "signedOut" | "loading" | "ready" | "error";

export function fromRow(row: EntryRow): { buildingId: string; entry: JournalEntry } {
  return {
    buildingId: row.building_id,
    entry: {
      id: row.id,
      createdAt: Date.parse(row.created_at),
      date: row.visited_on,
      floor: row.floor,
      rating: Number(row.rating),
      notes: row.notes,
    },
  };
}

function groupByBuilding(rows: EntryRow[]): Journal {
  const journal = new Map<string, JournalEntry[]>();
  for (const row of rows) {
    const { buildingId, entry } = fromRow(row);
    const entries = journal.get(buildingId);
    if (entries) entries.push(entry);
    else journal.set(buildingId, [entry]);
  }
  return journal;
}

function withEntry(journal: Journal, buildingId: string, entry: JournalEntry): Journal {
  const entries = journal.get(buildingId) ?? [];
  const exists = entries.some((e) => e.id === entry.id);
  const next = exists ? entries.map((e) => (e.id === entry.id ? entry : e)) : [...entries, entry];
  return new Map(journal).set(buildingId, next);
}

function withoutEntry(journal: Journal, buildingId: string, entryId: string): Journal {
  const remaining = (journal.get(buildingId) ?? []).filter((e) => e.id !== entryId);
  const next = new Map(journal);
  if (remaining.length > 0) next.set(buildingId, remaining);
  else next.delete(buildingId);
  return next;
}

const EMPTY: Journal = new Map();

/**
 * The signed-in user's journal, stored in Supabase. Edits show up immediately
 * and are rolled back, with `onError` called, if the server rejects them.
 */
export function useJournal(userId: string | null, onError: (message: string) => void) {
  const [journal, setJournal] = useState<Journal>(EMPTY);
  const [status, setStatus] = useState<JournalStatus>("signedOut");
  // Lets a rollback restore an entry without clobbering later edits.
  const journalRef = useRef(journal);
  journalRef.current = journal;

  const load = useCallback(
    async (uid: string, isCurrent: () => boolean) => {
      setStatus("loading");
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        // Load-bearing: RLS also returns friends' entries, and the journal (the
        // map, Diary and building panels) must only ever hold the user's own.
        .eq("user_id", uid)
        .order("visited_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (!isCurrent()) return;
      if (error) {
        setStatus("error");
        onError(`Couldn't load your diary: ${error.message}`);
        return;
      }
      setJournal(groupByBuilding(data));
      setStatus("ready");
    },
    [onError],
  );

  useEffect(() => {
    // Clear the previous user's entries right away, so nothing leaks across accounts.
    setJournal(EMPTY);
    if (!userId) {
      setStatus("signedOut");
      return;
    }
    let current = true;
    void load(userId, () => current);
    return () => {
      current = false;
    };
  }, [userId, load]);

  const retry = useCallback(() => {
    if (userId) void load(userId, () => true);
  }, [userId, load]);

  /** Adds the entry, or replaces the building's entry with the same id. */
  const saveEntry = useCallback(
    async (buildingId: string, entry: JournalEntry) => {
      const previous = journalRef.current.get(buildingId)?.find((e) => e.id === entry.id);
      setJournal((j) => withEntry(j, buildingId, entry));

      const fields = {
        building_id: buildingId,
        visited_on: entry.date,
        floor: entry.floor,
        rating: entry.rating,
        notes: entry.notes,
      };
      const { data, error } = previous
        ? await supabase.from("entries").update(fields).eq("id", entry.id).select().single()
        : await supabase
            .from("entries")
            .insert({ ...fields, id: entry.id })
            .select()
            .single();

      if (error) {
        setJournal((j) =>
          previous ? withEntry(j, buildingId, previous) : withoutEntry(j, buildingId, entry.id),
        );
        onError(`Couldn't save that entry: ${error.message}`);
        return;
      }
      // Take the server's copy, e.g. its created_at.
      setJournal((j) => withEntry(j, buildingId, fromRow(data).entry));
    },
    [onError],
  );

  const deleteEntry = useCallback(
    async (buildingId: string, entryId: string) => {
      const previous = journalRef.current.get(buildingId)?.find((e) => e.id === entryId);
      setJournal((j) => withoutEntry(j, buildingId, entryId));
      const { error } = await supabase.from("entries").delete().eq("id", entryId);
      if (error) {
        if (previous) setJournal((j) => withEntry(j, buildingId, previous));
        onError(`Couldn't delete that entry: ${error.message}`);
      }
    },
    [onError],
  );

  return { journal, status, retry, saveEntry, deleteEntry };
}
