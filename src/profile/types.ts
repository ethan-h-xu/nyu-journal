// Mirrors the checks on public.profiles (supabase/migrations/*_profiles.sql).

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BIO_MAX_LENGTH = 160;

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "support", "help", "moderator", "mod",
  "staff", "system", "official", "nyu", "shtboxd", "sh_tboxd", "null",
  "undefined", "anonymous", "deleted", "me", "you", "everyone",
]);

/** A user's public profile. Nothing in it comes from their Google account. */
export interface Profile {
  id: string;
  username: string;
  bio: string;
}

/** What the user typed, as it would be stored: trimmed and lowercased. */
export const normalizeUsername = (input: string) => input.trim().toLowerCase();

/** Why a (normalized) username can't be used, or null if it's fine. */
export function usernameError(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH)
    return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  if (username.length > USERNAME_MAX_LENGTH)
    return `Use ${USERNAME_MAX_LENGTH} characters or fewer.`;
  if (!USERNAME_PATTERN.test(username))
    return "Use only letters, numbers, and underscores.";
  if (RESERVED_USERNAMES.has(username)) return "That username isn't available.";
  return null;
}
