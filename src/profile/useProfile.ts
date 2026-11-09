import { useCallback, useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "./types";

export type ProfileStatus =
  | "signedOut"
  | "loading"
  /** Signed in but no username yet: show the setup screen. */
  | "missing"
  | "ready"
  | "error";

/** A friendly message for a failed profile write. */
function saveErrorMessage(error: PostgrestError): string {
  // unique_violation: someone else has the username (maybe since we checked).
  if (error.code === "23505") return "That username is taken.";
  // check_violation: a rule the client should have caught, e.g. a reserved name.
  if (error.code === "23514") return "That username or bio isn't allowed.";
  return error.message;
}

/** The signed-in user's own profile, or "missing" if they haven't picked a username. */
export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>("signedOut");

  const load = useCallback(async (uid: string, isCurrent: () => boolean) => {
    setStatus("loading");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, bio")
      .eq("id", uid)
      .maybeSingle();
    if (!isCurrent()) return;
    if (error) {
      setStatus("error");
      return;
    }
    setProfile(data);
    setStatus(data ? "ready" : "missing");
  }, []);

  useEffect(() => {
    // Never show the previous account's profile.
    setProfile(null);
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

  /** Creates the profile. Resolves to an error message, or null on success. */
  const createProfile = useCallback(async (username: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ username })
      .select("id, username, bio")
      .single();
    if (error) return saveErrorMessage(error);
    setProfile(data);
    setStatus("ready");
    return null;
  }, []);

  /** Saves username and bio. Resolves to an error message, or null on success. */
  const updateProfile = useCallback(
    async (fields: { username: string; bio: string }): Promise<string | null> => {
      if (!userId) return "You're signed out.";
      const { data, error } = await supabase
        .from("profiles")
        .update(fields)
        .eq("id", userId)
        .select("id, username, bio")
        .single();
      if (error) return saveErrorMessage(error);
      setProfile(data);
      return null;
    },
    [userId],
  );

  return { profile, status, retry, createProfile, updateProfile };
}
