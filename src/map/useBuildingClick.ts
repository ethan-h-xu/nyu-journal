import { useRef } from "react";
import type { PointerEvent } from "react";
import { buildingIdAt } from "./buildingAt";

/** How far a pointer can move between press and release and still count as a click. */
const CLICK_SLOP_PX = 6;

interface Press {
  pointerId: number;
  x: number;
  y: number;
}

/**
 * Calls `onClick` with the building under a press-and-release that didn't drag,
 * or with null when that lands on empty map. The stage captures the pointer for
 * panning, so native click events never reach the building paths themselves.
 * Multi-touch gestures never count.
 */
export function useBuildingClick(onClick: (buildingId: string | null) => void) {
  const press = useRef<Press | null>(null);
  const activePointers = useRef(new Set<number>());

  return {
    // Capture phase, so these sit alongside the pan and zoom handlers.
    onPointerDownCapture: (event: PointerEvent) => {
      activePointers.current.add(event.pointerId);
      const isPrimary = event.pointerType !== "mouse" || event.button === 0;
      press.current =
        isPrimary && activePointers.current.size === 1
          ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
    },
    onPointerUpCapture: (event: PointerEvent) => {
      activePointers.current.delete(event.pointerId);
      const start = press.current;
      if (!start || start.pointerId !== event.pointerId) return;
      press.current = null;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved <= CLICK_SLOP_PX) onClick(buildingIdAt(event.clientX, event.clientY));
    },
    onPointerCancelCapture: (event: PointerEvent) => {
      activePointers.current.delete(event.pointerId);
      press.current = null;
    },
  };
}
