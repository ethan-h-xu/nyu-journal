import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export interface LikeInfo {
  count: number;
  likedByMe: boolean;
}

/** Like counts by entry id. Entries not fetched yet are absent. */
type LikeMap = ReadonlyMap<string, LikeInfo>;

const EMPTY: LikeMap = new Map();

/**
 * Like counts for every entry on screen (your diary, the feed, profiles), in
 * one place so they agree everywhere. Pass null for `userId` until the user
 * has a profile. Toggling shows at once and is rolled back, with `onError`
 * called, if the server rejects it.
 */
export function useLikes(userId: string | null, onError: (message: string) => void) {
  const [likes, setLikes] = useState<LikeMap>(EMPTY);
  const likesRef = useRef(likes);
  likesRef.current = likes;
  // Entries fetched or being fetched, so `load` doesn't ask twice.
  const requestedRef = useRef(new Set<string>());
  // Entries with a toggle in flight; a load mustn't overwrite them.
  const busyRef = useRef(new Set<string>());
  // Bumped on account change, so the previous account's responses are ignored.
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current++;
    requestedRef.current = new Set();
    busyRef.current = new Set();
    setLikes(EMPTY);
  }, [userId]);

  /**
   * Fetches counts for `entryIds`. Skips ones already fetched unless `force`,
   * e.g. when a list is reloaded to show the latest.
   */
  const load = useCallback(
    async (entryIds: readonly string[], force = false) => {
      if (!userId) return;
      const ids = force ? [...entryIds] : entryIds.filter((id) => !requestedRef.current.has(id));
      if (ids.length === 0) return;
      for (const id of ids) requestedRef.current.add(id);
      const generation = generationRef.current;

      const { data, error } = await supabase.rpc("entry_like_summaries", { entry_ids: ids });
      if (generation !== generationRef.current) return;
      if (error) {
        // Let a later load try again. Buttons stay disabled for these meanwhile.
        for (const id of ids) requestedRef.current.delete(id);
        onError(`Couldn't load likes: ${error.message}`);
        return;
      }
      const found = new Map(data.map((row) => [row.entry_id, row]));
      setLikes((current) => {
        const next = new Map(current);
        for (const id of ids) {
          if (busyRef.current.has(id)) continue;
          const row = found.get(id);
          next.set(
            id,
            row
              ? { count: row.like_count, likedByMe: row.liked_by_me }
              : { count: 0, likedByMe: false },
          );
        }
        return next;
      });
    },
    [userId, onError],
  );

  const toggle = useCallback(
    async (entryId: string) => {
      const previous = likesRef.current.get(entryId);
      if (!userId || !previous || busyRef.current.has(entryId)) return;
      busyRef.current.add(entryId);
      const generation = generationRef.current;
      const liking = !previous.likedByMe;
      const set = (info: LikeInfo) => setLikes((current) => new Map(current).set(entryId, info));
      set({ count: Math.max(0, previous.count + (liking ? 1 : -1)), likedByMe: liking });

      const { error } = liking
        ? await supabase.from("entry_likes").insert({ entry_id: entryId })
        : await supabase.from("entry_likes").delete().eq("entry_id", entryId).eq("user_id", userId);
      if (generation !== generationRef.current) return;
      busyRef.current.delete(entryId);
      // Already liked (e.g. in another tab) counts as success for a like.
      if (error && !(liking && error.code === "23505")) {
        set(previous);
        onError(`Couldn't ${liking ? "like" : "unlike"} that entry: ${error.message}`);
      }
    },
    [userId, onError],
  );

  return { likes, load, toggle };
}

export type Likes = ReturnType<typeof useLikes>;

export interface LikesContextValue extends Likes {
  /** Opens a user's profile, from the list of who liked an entry. */
  onOpenProfile: (userId: string) => void;
}

/** Provided by App once the user has a profile; null hides like buttons. */
export const LikesContext = createContext<LikesContextValue | null>(null);

export const useLikesContext = () => useContext(LikesContext);
