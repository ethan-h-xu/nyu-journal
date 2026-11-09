import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../profile/types";

export const SEARCH_MIN_LENGTH = 3;
const SEARCH_LIMIT = 10;
const DEBOUNCE_MS = 250;

export type SearchState =
  /** Fewer than SEARCH_MIN_LENGTH characters typed. */
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; results: Profile[] }
  | { status: "error" };

/**
 * Users whose username starts with `query` (normalized), excluding `selfId`.
 * Capped at SEARCH_LIMIT, alphabetical.
 */
export function useUserSearch(query: string, selfId: string): SearchState {
  const [state, setState] = useState<SearchState>({ status: "idle" });

  useEffect(() => {
    if (query.length < SEARCH_MIN_LENGTH) {
      setState({ status: "idle" });
      return;
    }
    // Nothing else can be in a username, so nothing else can match.
    if (!/^[a-z0-9_]+$/.test(query)) {
      setState({ status: "done", results: [] });
      return;
    }
    setState({ status: "searching" });
    let current = true;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, bio")
        // "_" is a LIKE wildcard; match it literally.
        .like("username", `${query.replaceAll("_", "\\_")}%`)
        .neq("id", selfId)
        .order("username")
        .limit(SEARCH_LIMIT);
      if (!current) return;
      setState(error ? { status: "error" } : { status: "done", results: data });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, selfId]);

  return state;
}
