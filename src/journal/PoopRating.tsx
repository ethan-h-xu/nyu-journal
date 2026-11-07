import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { RATING_MAX, RATING_STEP } from "./types";

const SLOTS = Array.from({ length: RATING_MAX }, (_, i) => i + 1);

const clamp = (n: number) => Math.min(RATING_MAX, Math.max(0, n));

interface PoopRatingProps {
  value: number;
  onChange: (value: number) => void;
  labelId: string;
}

/**
 * A 0–5 rating in half steps, drawn as poop emoji. Click the left half of one
 * for a half, the right half for a whole; click the current value to clear it.
 * Arrow keys step by halves.
 */
export function PoopRating({ value, onChange, labelId }: PoopRatingProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;

  const valueAt = (event: MouseEvent<HTMLSpanElement>, slot: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - bounds.left < bounds.width / 2;
    return isLeftHalf ? slot - RATING_STEP : slot;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: value + RATING_STEP,
      ArrowUp: value + RATING_STEP,
      ArrowLeft: value - RATING_STEP,
      ArrowDown: value - RATING_STEP,
      Home: 0,
      End: RATING_MAX,
    };
    const next = steps[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(clamp(next));
  };

  return (
    <div className="poop-rating-row">
      <div
        className="poop-rating"
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={RATING_MAX}
        aria-valuenow={value}
        aria-valuetext={value === 0 ? "Unrated" : `${value} out of ${RATING_MAX}`}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setPreview(null)}
      >
        {SLOTS.map((slot) => {
          const fill = clamp(shown - (slot - 1));
          return (
            <span
              key={slot}
              className="poop-slot"
              onPointerMove={(e) => setPreview(valueAt(e, slot))}
              onClick={(e) => {
                const next = valueAt(e, slot);
                onChange(next === value ? 0 : next);
              }}
            >
              <span className="poop-empty" aria-hidden="true">
                💩
              </span>
              <span
                className="poop-fill"
                aria-hidden="true"
                // Crops only from the right: the glyph spills past its line box,
                // so the vertical insets are negative to keep it whole.
                style={{ clipPath: `inset(-50% ${(1 - Math.min(1, fill)) * 100}% -50% 0)` }}
              >
                💩
              </span>
            </span>
          );
        })}
      </div>
      <span className="poop-rating-value">
        {shown === 0 ? "Unrated" : `${shown.toFixed(1)} / ${RATING_MAX}`}
      </span>
    </div>
  );
}
