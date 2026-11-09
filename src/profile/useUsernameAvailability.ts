import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { usernameError } from "./types";

export type Availability = "idle" | "checking" | "available" | "taken" | "error";

const DEBOUNCE_MS = 350;

/**
 * Whether a (normalized) username is free, checked after typing pauses.
 * Only a hint: the unique constraint on insert/update is the real check.
 * `ownUsername` counts as available, so the edit form doesn't flag your own name.
 */
export function useUsernameAvailability(username: string, ownUsername?: string): Availability {
  const [availability, setAvailability] = useState<Availability>("idle");

  useEffect(() => {
    if (usernameError(username) || username === ownUsername) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let current = true;
    const timer = setTimeout(async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("username", username);
      if (!current) return;
      setAvailability(error ? "error" : count ? "taken" : "available");
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [username, ownUsername]);

  return availability;
}
