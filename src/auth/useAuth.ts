import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AuthState =
  /** Still checking for a saved session, so don't show signed-out UI yet. */
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: User };

/** The signed-in Google account, kept in sync with Supabase Auth. */
export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // Also fires once at startup with the saved session, if any (INITIAL_SESSION).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? { status: "signedIn", user: session.user } : { status: "signedOut" });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Back to this page; Supabase only allows URLs on its redirect list.
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  /** Deletes the account and every entry in it, then signs out. */
  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw error;
    // The account is gone, so only clear the local session.
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  return { auth, signIn, signOut, deleteAccount };
}

/** A display name and avatar from the Google profile Supabase stores. */
export function profileOf(user: User): { name: string; email: string; avatarUrl: string | null } {
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  const email = user.email ?? "";
  return {
    name: meta.full_name ?? meta.name ?? email,
    email,
    avatarUrl: meta.avatar_url ?? null,
  };
}
