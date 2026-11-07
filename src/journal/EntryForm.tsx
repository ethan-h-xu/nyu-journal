import { useId, useState } from "react";
import type { FormEvent } from "react";
import { PoopRating } from "./PoopRating";
import { FLOOR_MAX_LENGTH, NOTES_MAX_LENGTH } from "./types";
import type { JournalEntry } from "./types";

/** Turn the notes counter red once this close to the limit. */
const NOTES_WARNING_LEFT = 20;

/**
 * Cuts text to `max` characters. `maxLength` alone misses some input, like
 * text committed from an IME, and counts an emoji as two characters.
 */
function limit(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join("") : text;
}

const charCount = (text: string) => Array.from(text).length;

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function newEntry(): JournalEntry {
  return { id: crypto.randomUUID(), date: today(), floor: "", rating: 0, notes: "" };
}

interface Errors {
  date?: string;
  floor?: string;
  notes?: string;
}

/** The inputs' own limits stop most of these; this catches the rest. */
function validate(entry: JournalEntry): Errors {
  const errors: Errors = {};
  if (!entry.date) errors.date = "A date is required.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) errors.date = "Enter a valid date.";
  else if (entry.date > today()) errors.date = "That date hasn't happened yet.";
  if (charCount(entry.floor) > FLOOR_MAX_LENGTH)
    errors.floor = `Use ${FLOOR_MAX_LENGTH} characters or fewer.`;
  if (charCount(entry.notes) > NOTES_MAX_LENGTH)
    errors.notes = `Notes can be at most ${NOTES_MAX_LENGTH} characters.`;
  return errors;
}

interface EntryFormProps {
  /** The entry to edit, or undefined to write a new one. */
  entry: JournalEntry | undefined;
  onSave: (entry: JournalEntry) => void;
  onCancel: () => void;
}

/** Remount it (with `key`) to start a different entry, so the draft starts over. */
export function EntryForm({ entry, onSave, onCancel }: EntryFormProps) {
  const [draft, setDraft] = useState<JournalEntry>(() => entry ?? newEntry());
  const id = useId();

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const notesLength = charCount(draft.notes);
  const floorLength = charCount(draft.floor);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (hasErrors) return;
    onSave({ ...draft, floor: draft.floor.trim(), notes: draft.notes.trim() });
  };

  return (
    <form className="building-panel-body" onSubmit={submit} noValidate>
      <div className="field-row">
        <label className="field">
          <span>
            Date <abbr className="field-required" title="required">*</abbr>
          </span>
          <input
            type="date"
            required
            aria-required="true"
            max={today()}
            value={draft.date}
            aria-invalid={!!errors.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          />
          {errors.date && <small className="field-error">{errors.date}</small>}
        </label>

        <label className="field field-floor">
          <span>Floor</span>
          <input
            type="text"
            value={draft.floor}
            aria-invalid={!!errors.floor}
            onChange={(e) =>
              setDraft((d) => ({ ...d, floor: limit(e.target.value, FLOOR_MAX_LENGTH) }))
            }
          />
          {errors.floor ? (
            <small className="field-error">{errors.floor}</small>
          ) : (
            <small className="field-hint">
              {floorLength}/{FLOOR_MAX_LENGTH}
            </small>
          )}
        </label>
      </div>

      <div className="field">
        <span id={`${id}-rating`}>Rating</span>
        <PoopRating
          labelId={`${id}-rating`}
          value={draft.rating}
          onChange={(rating) => setDraft((d) => ({ ...d, rating }))}
        />
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={6}
          value={draft.notes}
          aria-invalid={!!errors.notes}
          onChange={(e) =>
            setDraft((d) => ({ ...d, notes: limit(e.target.value, NOTES_MAX_LENGTH) }))
          }
        />
        {errors.notes ? (
          <small className="field-error">{errors.notes}</small>
        ) : (
          <small
            className={
              NOTES_MAX_LENGTH - notesLength <= NOTES_WARNING_LEFT
                ? "field-hint field-hint-limit"
                : "field-hint"
            }
          >
            {notesLength.toLocaleString()} / {NOTES_MAX_LENGTH.toLocaleString()}
          </small>
        )}
      </label>

      <div className="building-panel-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={hasErrors}>
          {entry ? "Save changes" : "Add to journal"}
        </button>
      </div>
    </form>
  );
}
