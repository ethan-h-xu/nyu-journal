import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { daysAgo } from "../journal/format";
import type { JournalEntry } from "../journal/types";
import { fromRow } from "../journal/useJournal";
import type { Profile } from "./types";

type EntryRow = Database["public"]["Tables"]["entries"]["Row"];

export const RECENT_PAGE_SIZE = 5;
/** "Last 30 days" counts visits dated within this many days, including today. */
export const RECENT_DAYS = 30;

export interface ProfileEntry {
  buildingId: string;
  entry: JournalEntry;
}

export interface Counts {
  lifetime: number;
  recent: number;
}

export type Loadable<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error" };

export interface EntryPages {
  status: "loading" | "ready" | "error";
  items: ProfileEntry[];
  hasMore: boolean;
  /** Fetching the next page. */
  loadingMore: boolean;
}

const INITIAL_PAGES: EntryPages = { status: "loading", items: [], hasMore: false, loadingMore: false };

/** Newest first, the same order as the diary. */
function entriesQuery(userId: string) {
  return supabase
    .from("entries")
    .select("*")
    .eq("user_id", userId)
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
}

/**
 * A friend's counts, recent entries (a page at a time) and friend list.
 * Row-level security only returns these for friends, so only call this with
 * `userId` set when they are one; pass null otherwise.
 */
export function useUserActivity(userId: string | null) {
  const [counts, setCounts] = useState<Loadable<Counts>>({ status: "loading" });
  const [pages, setPages] = useState<EntryPages>(INITIAL_PAGES);
  const [friendList, setFriendList] = useState<Loadable<Profile[]>>({ status: "loading" });
  // Where the next page starts: the last row loaded.
  const cursorRef = useRef<EntryRow | null>(null);
  // Bumped on each reload, so stale responses are ignored.
  const generationRef = useRef(0);

  const loadCounts = useCallback(async (uid: string, isCurrent: () => boolean) => {
    const [all, recent] = await Promise.all([
      supabase.from("entries").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .gt("visited_on", daysAgo(RECENT_DAYS)),
    ]);
    if (!isCurrent()) return;
    setCounts(
      all.error || recent.error
        ? { status: "error" }
        : { status: "ready", value: { lifetime: all.count ?? 0, recent: recent.count ?? 0 } },
    );
  }, []);

  const loadPage = useCallback(async (uid: string, isCurrent: () => boolean) => {
    const cursor = cursorRef.current;
    let query = entriesQuery(uid);
    if (cursor) {
      // Strictly after the cursor in (visited_on desc, created_at desc) order.
      query = query.or(
        `visited_on.lt.${cursor.visited_on},and(visited_on.eq.${cursor.visited_on},created_at.lt."${cursor.created_at}")`,
      );
    }
    // One extra row tells us whether there's another page.
    const { data, error } = await query.limit(RECENT_PAGE_SIZE + 1);
    if (!isCurrent()) return;
    if (error) {
      setPages((p) =>
        // A failed first page shows an error; a failed "Load more" keeps what's there.
        p.items.length === 0 ? { ...INITIAL_PAGES, status: "error" } : { ...p, loadingMore: false },
      );
      return;
    }
    const page = data.slice(0, RECENT_PAGE_SIZE);
    if (page.length > 0) cursorRef.current = page[page.length - 1];
    setPages((p) => {
      const seen = new Set(p.items.map((item) => item.entry.id));
      return {
        status: "ready",
        items: [...p.items, ...page.map(fromRow).filter((item) => !seen.has(item.entry.id))],
        hasMore: data.length > RECENT_PAGE_SIZE,
        loadingMore: false,
      };
    });
  }, []);

  const loadFriendList = useCallback(async (uid: string, isCurrent: () => boolean) => {
    const { data, error } = await supabase
      .from("friendships")
      .select(
        "requester_id, requester:profiles!friendships_requester_id_fkey(id, username, bio), addressee:profiles!friendships_addressee_id_fkey(id, username, bio)",
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
    if (!isCurrent()) return;
    if (error) {
      setFriendList({ status: "error" });
      return;
    }
    const profiles = data
      .map((row) => (row.requester_id === uid ? row.addressee : row.requester))
      .sort((a, b) => a.username.localeCompare(b.username));
    setFriendList({ status: "ready", value: profiles });
  }, []);

  const reload = useCallback(
    (uid: string) => {
      const generation = ++generationRef.current;
      const isCurrent = () => generationRef.current === generation;
      cursorRef.current = null;
      setCounts({ status: "loading" });
      setPages(INITIAL_PAGES);
      setFriendList({ status: "loading" });
      void loadCounts(uid, isCurrent);
      void loadPage(uid, isCurrent);
      void loadFriendList(uid, isCurrent);
    },
    [loadCounts, loadPage, loadFriendList],
  );

  useEffect(() => {
    if (!userId) return;
    reload(userId);
    return () => {
      generationRef.current++;
    };
  }, [userId, reload]);

  const loadMore = useCallback(() => {
    if (!userId || pages.loadingMore || !pages.hasMore) return;
    const generation = generationRef.current;
    setPages((p) => ({ ...p, loadingMore: true }));
    void loadPage(userId, () => generationRef.current === generation);
  }, [userId, pages.loadingMore, pages.hasMore, loadPage]);

  const retry = useCallback(() => {
    if (userId) reload(userId);
  }, [userId, reload]);

  return { counts, pages, friendList, loadMore, retry };
}
