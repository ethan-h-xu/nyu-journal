import { useId } from "react";
import type { Availability } from "./useUsernameAvailability";
import { USERNAME_MAX_LENGTH, normalizeUsername, usernameError } from "./types";

interface UsernameFieldProps {
  /** Normalized (lowercase) username. */
  value: string;
  onChange: (username: string) => void;
  availability: Availability;
  /** An error from the last save, e.g. "That username is taken." */
  saveError?: string | null;
  autoFocus?: boolean;
}

/** The username input with its live rule and availability messages. */
export function UsernameField({ value, onChange, availability, saveError, autoFocus }: UsernameFieldProps) {
  const id = useId();
  // Don't nag about length before anything's typed.
  const ruleError = value ? usernameError(value) : null;
  const error =
    ruleError ?? (availability === "taken" ? "That username is taken." : null) ?? saveError ?? null;
  const hint =
    availability === "checking"
      ? "Checking…"
      : availability === "available"
        ? "Available"
        : availability === "error"
          ? "Couldn't check availability."
          : "3–20 letters, numbers, or underscores.";

  return (
    <div className="field">
      <label htmlFor={`${id}-input`}>Username</label>
      <div className="username-input">
        <span aria-hidden="true">@</span>
        <input
          id={`${id}-input`}
          type="text"
          value={value}
          onChange={(event) => onChange(normalizeUsername(event.target.value))}
          maxLength={USERNAME_MAX_LENGTH}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-message`}
        />
      </div>
      <small
        id={`${id}-message`}
        className={error ? "field-error" : availability === "available" ? "field-ok" : "field-note"}
        aria-live="polite"
      >
        {error ?? hint}
      </small>
    </div>
  );
}
