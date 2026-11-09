import { useId, useState } from "react";
import type { FormEvent } from "react";
import { UsernameField } from "./UsernameField";
import { usernameError } from "./types";
import { useUsernameAvailability } from "./useUsernameAvailability";

interface UsernameSetupProps {
  /** Resolves to an error message, or null once the profile exists. */
  onCreate: (username: string) => Promise<string | null>;
  onSignOut: () => void;
}

/**
 * Shown over the whole app to any signed-in user without a username: new
 * sign-ins, and accounts made before usernames existed.
 */
export function UsernameSetup({ onCreate, onSignOut }: UsernameSetupProps) {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const availability = useUsernameAvailability(username);
  const titleId = useId();

  const canSubmit = !saving && !usernameError(username) && availability !== "taken";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setSaveError(null);
    const error = await onCreate(username);
    // On success this screen unmounts, so only reset on failure.
    if (error) {
      setSaveError(error);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
      >
        <h2 id={titleId}>Pick a username</h2>
        <p>Friends find you by your username. You can change it later.</p>
        <UsernameField
          value={username}
          onChange={(next) => {
            setUsername(next);
            setSaveError(null);
          }}
          availability={availability}
          saveError={saveError}
          autoFocus
        />
        <p className="modal-fine">
          Your username and bio are visible to anyone signed in. Friends you accept can see your
          diary entries. <a href="/privacy.html">Privacy policy</a>
        </p>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onSignOut}>
            Sign out
          </button>
          <button type="submit" className="button-primary" disabled={!canSubmit}>
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
