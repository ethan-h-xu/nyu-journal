import { useState } from "react";
import type { FormEvent } from "react";
import { UsernameField } from "./UsernameField";
import { BIO_MAX_LENGTH, usernameError } from "./types";
import type { Profile } from "./types";
import { useUsernameAvailability } from "./useUsernameAvailability";

/** Turn the bio counter red once this close to the limit. */
const BIO_WARNING_LEFT = 20;

const charCount = (text: string) => Array.from(text).length;

/** Cuts text to `max` characters, counting an emoji as one (see EntryForm). */
function limit(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join("") : text;
}

interface EditProfileFormProps {
  profile: Profile;
  /** Resolves to an error message, or null once saved. */
  onSave: (fields: { username: string; bio: string }) => Promise<string | null>;
  onDone: () => void;
}

export function EditProfileForm({ profile, onSave, onDone }: EditProfileFormProps) {
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const availability = useUsernameAvailability(username, profile.username);

  const bioLength = charCount(bio);
  const canSubmit = !saving && !usernameError(username) && availability !== "taken";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setSaveError(null);
    const error = await onSave({ username, bio: bio.trim() });
    setSaving(false);
    if (error) setSaveError(error);
    else onDone();
  };

  return (
    <form className="side-panel-body" onSubmit={submit} noValidate>
      <UsernameField
        value={username}
        onChange={(next) => {
          setUsername(next);
          setSaveError(null);
        }}
        availability={availability}
        saveError={saveError}
      />
      <label className="field">
        <span>Bio</span>
        <textarea
          rows={3}
          value={bio}
          onChange={(event) => setBio(limit(event.target.value, BIO_MAX_LENGTH))}
          placeholder="Optional"
        />
        <small
          className={
            BIO_MAX_LENGTH - bioLength <= BIO_WARNING_LEFT ? "field-hint field-hint-limit" : "field-hint"
          }
        >
          {bioLength}/{BIO_MAX_LENGTH}
        </small>
      </label>
      <div className="side-panel-actions">
        <button type="button" className="button-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={!canSubmit}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
