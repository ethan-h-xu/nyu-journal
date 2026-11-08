import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Copy .env.example to .env.local and fill them in (see docs/supabase-setup.md).",
  );
}

/**
 * The one Supabase client. The publishable key is safe to ship: row-level
 * security is what keeps each diary private.
 */
export const supabase = createClient<Database>(url, key, {
  auth: { flowType: "pkce" },
});
