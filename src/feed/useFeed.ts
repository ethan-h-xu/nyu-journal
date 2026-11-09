import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { fromRow } from "../journal/useJournal";
import type { JournalEntry } from "../journal/types";
import type { Profile } from "../profile/types";

type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

export const FEED_PAGE_SIZE = 20;

export interface FeedItem {
  author: Profile;
  buildingId: string;
  entry: JournalEntry;
}

export interface FeedState {
  status: "loading" | "ready" | "error";
  items: FeedItem[];
  hasMore: boolean;
  loadingMore: boolean;
}

const INITIAL: FeedState = { status: "loading", items: [], hasMore: false, loadingMore: false };

/**
 * Friends' entries, most recently written first, a page at a time. Held by
 * the app rather than the feed panel, so the list survives a detour to a
 * profile; call `reload` to fetch the latest. `knownProfiles` (your friends)
 * names the authors; anyone missing, e.g. a friend added since, is fetched.
 * Pass null for `selfId` while signed out or without a profile.
 */
export function useFeed(selfId: string | null, knownProfiles: ReadonlyMap<string, Profile>) {
  const [state, setState] = useState<FeedState>(INITIAL);
  // Where the next page starts: the last row loaded.
  const cursorRef = useRef<EntryRow | null>(null);
  // Bumped on each reload, so stale responses are ignored.
  const generationRef = useRef(0);
  const knownRef = useRef(knownProfiles);
  knownRef.current = knownProfiles;

  const loadPage = useCallback(
    async (isCurrent: () => boolean) => {
      if (!selfId) return;
      const cursor = cursorRef.current;
      let query = supabase
        .from("entries")
        .select("*")
        // Row-level security limits this to friends' entries.
        .neq("user_id", selfId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (cursor) {
        // Strictly after the cursor in (created_at desc, id desc) order.
        query = query.or(
          `created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",id.lt.${cursor.id})`,
        );
      }
      // One extra row tells us whether there's another page.
      const { data, error } = await query.limit(FEED_PAGE_SIZE + 1);
      if (!isCurrent()) return;
      if (error) {
        setState((s) =>
          s.items.length === 0 ? { ...INITIAL, status: "error" } : { ...s, loadingMore: false },
        );
        return;
      }
      const page = data.slice(0, FEED_PAGE_SIZE);

      const authors = new Map(knownRef.current);
      const missing = [...new Set(page.map((row) => row.user_id))].filter((id) => !authors.has(id));
      if (missing.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, bio")
          .in("id", missing);
        if (!isCurrent()) return;
        if (profileError) {
          setState((s) =>
            s.items.length === 0 ? { ...INITIAL, status: "error" } : { ...s, loadingMore: false },
          );
          return;
        }
        for (const profile of profiles) authors.set(profile.id, profile);
      }

      if (page.length > 0) cursorRef.current = page[page.length - 1];
      setState((s) => {
        const seen = new Set(s.items.map((item) => item.entry.id));
        const items = page.flatMap((row) => {
          const author = authors.get(row.user_id);
          // No profile means the account is gone; skip it.
          if (!author || seen.has(row.id)) return [];
          return [{ author, ...fromRow(row) }];
        });
        return {
          status: "ready",
          items: [...s.items, ...items],
          hasMore: data.length > FEED_PAGE_SIZE,
          loadingMore: false,
        };
      });
    },
    [selfId],
  );

  // A reload asked for before there was a selfId to load with.
  const pendingRef = useRef(false);

  const reload = useCallback(() => {
    const generation = ++generationRef.current;
    cursorRef.current = null;
    setState(INITIAL);
    pendingRef.current = !selfId;
    void loadPage(() => generationRef.current === generation);
  }, [selfId, loadPage]);

  // Never show the previous account's feed. Load now if a reload was waiting
  // on the profile; otherwise the next `reload` fills it in.
  useEffect(() => {
    generationRef.current++;
    cursorRef.current = null;
    setState(INITIAL);
    if (selfId && pendingRef.current) reload();
    // Only on account change: `reload` changes with selfId too, but must not run on its own.
  }, [selfId]);

  const loadMore = useCallback(() => {
    if (state.loadingMore || !state.hasMore) return;
    const generation = generationRef.current;
    setState((s) => ({ ...s, loadingMore: true }));
    void loadPage(() => generationRef.current === generation);
  }, [state.loadingMore, state.hasMore, loadPage]);

  return { state, loadMore, reload };
}
