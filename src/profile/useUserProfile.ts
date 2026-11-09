import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile } from "./types";

export type UserProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  /** No such user, e.g. they deleted their account. */
  | { status: "notFound" }
  | { status: "error" };

/** Someone else's public profile. Pass null to skip loading. */
export function useUserProfile(userId: string | null) {
  const [state, setState] = useState<UserProfileState>({ status: "loading" });

  const load = useCallback(async (uid: string, isCurrent: () => boolean) => {
    setState({ status: "loading" });
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, bio")
      .eq("id", uid)
      .maybeSingle();
    if (!isCurrent()) return;
    setState(error ? { status: "error" } : data ? { status: "ready", profile: data } : { status: "notFound" });
  }, []);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void load(userId, () => current);
    return () => {
      current = false;
    };
  }, [userId, load]);

  const retry = useCallback(() => {
    if (userId) void load(userId, () => true);
  }, [userId, load]);

  return { state, retry };
}
