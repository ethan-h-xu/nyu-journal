import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import type { Building } from "../data/types";
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

function emptyEntry(): JournalEntry {
  return { date: today(), floor: "", rating: 0, notes: "" };
}

interface Errors {
  date?: string;
  floor?: string;
  notes?: string;
}

/** The inputs' own limits stop most of these; this catches the rest. */
function validate(entry: JournalEntry): Errors {
  const errors: Errors = {};
  if (!entry.date) errors.date = "Pick a date.";
  else if (entry.date > today()) errors.date = "That date hasn't happened yet.";
  if (charCount(entry.floor) > FLOOR_MAX_LENGTH)
    errors.floor = `Use ${FLOOR_MAX_LENGTH} characters or fewer.`;
  if (charCount(entry.notes) > NOTES_MAX_LENGTH)
    errors.notes = `Notes can be at most ${NOTES_MAX_LENGTH} characters.`;
  return errors;
}

interface BuildingPanelProps {
  building: Building;
  entry: JournalEntry | undefined;
  onSave: (entry: JournalEntry) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * The journal entry for one building. Remount it (with `key`) when the building
 * changes, so the draft starts over.
 */
export function BuildingPanel({ building, entry, onSave, onRemove, onClose }: BuildingPanelProps) {
  const [draft, setDraft] = useState<JournalEntry>(() => entry ?? emptyEntry());
  const id = useId();
  const [title, ...otherNames] = building.names;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
    <aside className="building-panel" aria-labelledby={`${id}-title`}>
      <header className="building-panel-header">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {otherNames.length > 0 && (
            <p className="building-panel-aka">Also: {otherNames.join(", ")}</p>
          )}
        </div>
        <button type="button" className="building-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <form className="building-panel-form" onSubmit={submit} noValidate>
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              required
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
              placeholder="e.g. 3, B1"
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
          {entry && (
            <button type="button" className="button-secondary" onClick={onRemove}>
              Remove
            </button>
          )}
          <button type="submit" className="button-primary" disabled={hasErrors}>
            {entry ? "Update entry" : "Add to journal"}
          </button>
        </div>
      </form>
    </aside>
  );
}
