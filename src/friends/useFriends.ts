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

const byUsername = (a: Relation, b: Relation) => a.profile.username.localeCompare(b.profile.username);

function withRelation(relations: Relations, relation: Relation): Relations {
  return new Map(relations).set(relation.profile.id, relation);
}

function withoutRelation(relations: Relations, otherId: string): Relations {
  const next = new Map(relations);
  next.delete(otherId);
  return next;
}

/** Puts back what an optimistic change replaced (or removes what it added). */
function restored(relations: Relations, otherId: string, previous: Relation | undefined): Relations {
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

  const load = useCallback(
    async (uid: string, isCurrent: () => boolean) => {
      setStatus((s) => (s === "ready" ? s : "loading"));
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(id, username, bio), addressee:profiles!friendships_addressee_id_fkey(id, username, bio)",
        );
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
    async (profile: Profile) => {
      const previous = relationsRef.current.get(profile.id);
      const optimistic: RelationKind = previous?.kind === "incoming" ? "friend" : "outgoing";
      setRelations((r) => withRelation(r, { kind: optimistic, profile }));
      const { data, error } = await supabase.rpc("send_friend_request", { target: profile.id });
      if (error) {
        setRelations((r) => restored(r, profile.id, previous));
        onError(`Couldn't send that friend request: ${errorText(error)}`);
        return;
      }
      // The server knows best, e.g. if they sent us a request in the meantime.
      const kind: RelationKind = data === "accepted" ? "friend" : "outgoing";
      setRelations((r) => withRelation(r, { kind, profile }));
    },
    [onError],
  );

  /** Accepts or declines a request the other user sent. */
  const respond = useCallback(
    async (profile: Profile, accept: boolean) => {
      const previous = relationsRef.current.get(profile.id);
      setRelations((r) =>
        accept ? withRelation(r, { kind: "friend", profile }) : withoutRelation(r, profile.id),
      );
      const { error } = await supabase.rpc("respond_to_friend_request", {
        requester: profile.id,
        accept,
      });
      if (error) {
        setRelations((r) => restored(r, profile.id, previous));
        onError(`Couldn't ${accept ? "accept" : "decline"} that request: ${errorText(error)}`);
      }
    },
    [onError],
  );

  /** Cancels a sent request, declines a received one, or unfriends. */
  const remove = useCallback(
    async (profile: Profile) => {
      const previous = relationsRef.current.get(profile.id);
      setRelations((r) => withoutRelation(r, profile.id));
      const { error } = await supabase.rpc("remove_friend", { other: profile.id });
      if (error) {
        setRelations((r) => restored(r, profile.id, previous));
        onError(`Couldn't update that friendship: ${errorText(error)}`);
      }
    },
    [onError],
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
