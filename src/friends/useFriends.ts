import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "../profile/types";

/** How another user relates to the signed-in user. Absent means no relation. */
export type RelationKind = "friend" | "incoming" | "outgoing";

export interface Relation {
  kind: RelationKind;
  /** The other user. */
  profile: Profile;
}

/** Every relation the signed-in user has, by the other user's id. */
type Relations = ReadonlyMap<string, Relation>;

export type FriendsStatus = "idle" | "loading" | "ready" | "error";

const EMPTY: Relations = new Map();

const byUsername = (a: Relation, b: Relation) =>
  a.profile.username.localeCompare(b.profile.username);

function withRelation(relations: Relations, relation: Relation): Relations {
  return new Map(relations).set(relation.profile.id, relation);
}

function withoutRelation(relations: Relations, otherId: string): Relations {
  const next = new Map(relations);
  next.delete(otherId);
  return next;
}

/** Puts back what an optimistic change replaced (or removes what it added). */
function restored(
  relations: Relations,
  otherId: string,
  previous: Relation | undefined,
): Relations {
  return previous ? withRelation(relations, previous) : withoutRelation(relations, otherId);
}

const errorText = (error: { message: string }) => error.message;

/**
 * The signed-in user's friends and friend requests. Pass null for `userId`
 * until they have a profile. Changes show up immediately and are rolled back,
 * with `onError` called, if the server rejects them.
 */
export function useFriends(userId: string | null, onError: (message: string) => void) {
  const [relations, setRelations] = useState<Relations>(EMPTY);
  const [status, setStatus] = useState<FriendsStatus>("idle");
  const relationsRef = useRef(relations);
  relationsRef.current = relations;
  // Users with a change in flight; a second click on them is ignored.
  const busyRef = useRef(new Set<string>());

  /** Runs `change` for one user at a time, so double clicks don't race. */
  const exclusive = useCallback(async (otherId: string, change: () => Promise<void>) => {
    if (busyRef.current.has(otherId)) return;
    busyRef.current.add(otherId);
    try {
      await change();
    } finally {
      busyRef.current.delete(otherId);
    }
  }, []);

  const load = useCallback(
    async (uid: string, isCurrent: () => boolean) => {
      setStatus((s) => (s === "ready" ? s : "loading"));
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, username, bio), addressee:profiles!friendships_addressee_id_fkey(id, username, bio)",
        )
        // RLS also returns friends' friendships (for their profiles); only ours here.
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
      if (!isCurrent()) return;
      if (error) {
        setStatus("error");
        onError(`Couldn't load your friends: ${errorText(error)}`);
        return;
      }
      const next = new Map<string, Relation>();
      for (const row of data) {
        const sentByMe = row.requester_id === uid;
        const profile = sentByMe ? row.addressee : row.requester;
        const kind: RelationKind =
          row.status === "accepted" ? "friend" : sentByMe ? "outgoing" : "incoming";
        next.set(profile.id, { kind, profile });
      }
      setRelations(next);
      setStatus("ready");
    },
    [onError],
  );

  useEffect(() => {
    // Never show the previous account's friends.
    setRelations(EMPTY);
    setStatus("idle");
    if (!userId) return;
    let current = true;
    void load(userId, () => current);
    return () => {
      current = false;
    };
  }, [userId, load]);

  /** Fetches the latest, e.g. to pick up requests sent since the page loaded. */
  const refresh = useCallback(() => {
    if (userId) void load(userId, () => true);
  }, [userId, load]);

  /** Sends a request, or accepts theirs if they already sent one. */
  const sendRequest = useCallback(
    (profile: Profile) =>
      exclusive(profile.id, async () => {
        const previous = relationsRef.current.get(profile.id);
        // Becoming friends waits for the server (see `respond`); a new request can show at once.
        if (previous?.kind !== "incoming")
          setRelations((r) => withRelation(r, { kind: "outgoing", profile }));
        const { data, error } = await supabase.rpc("send_friend_request", { target: profile.id });
        if (error) {
          setRelations((r) => restored(r, profile.id, previous));
          onError(`Couldn't send that friend request: ${errorText(error)}`);
          return;
        }
        // The server knows best, e.g. if they sent us a request in the meantime.
        const kind: RelationKind = data === "accepted" ? "friend" : "outgoing";
        setRelations((r) => withRelation(r, { kind, profile }));
      }),
    [exclusive, onError],
  );

  /** Accepts or declines a request the other user sent. */
  const respond = useCallback(
    (profile: Profile, accept: boolean) =>
      exclusive(profile.id, async () => {
        const previous = relationsRef.current.get(profile.id);
        // Declining is shown at once. Accepting waits for the server: being a
        // friend lets their profile load entries, which fails until it's saved.
        if (!accept) setRelations((r) => withoutRelation(r, profile.id));
        const { error } = await supabase.rpc("respond_to_friend_request", {
          requester: profile.id,
          accept,
        });
        if (error) {
          setRelations((r) => restored(r, profile.id, previous));
          onError(`Couldn't ${accept ? "accept" : "decline"} that request: ${errorText(error)}`);
          return;
        }
        if (accept) setRelations((r) => withRelation(r, { kind: "friend", profile }));
      }),
    [exclusive, onError],
  );

  /** Cancels a sent request, declines a received one, or unfriends. */
  const remove = useCallback(
    (profile: Profile) =>
      exclusive(profile.id, async () => {
        const previous = relationsRef.current.get(profile.id);
        setRelations((r) => withoutRelation(r, profile.id));
        const { error } = await supabase.rpc("remove_friend", { other: profile.id });
        if (error) {
          setRelations((r) => restored(r, profile.id, previous));
          onError(`Couldn't update that friendship: ${errorText(error)}`);
        }
      }),
    [exclusive, onError],
  );

  const lists = useMemo(() => {
    const all = [...relations.values()].sort(byUsername);
    return {
      friends: all.filter((r) => r.kind === "friend"),
      incoming: all.filter((r) => r.kind === "incoming"),
      outgoing: all.filter((r) => r.kind === "outgoing"),
    };
  }, [relations]);

  return { relations, status, ...lists, refresh, sendRequest, respond, remove };
}

export type Friends = ReturnType<typeof useFriends>;
