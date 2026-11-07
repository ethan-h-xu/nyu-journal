import { useLayoutEffect, useState } from "react";
import type { PointerEvent } from "react";
import type { View } from "./view";

export interface HoverPoint {
  x: number;
  y: number;
}

/**
 * Tracks which building the mouse is over. It looks the building up again when
 * the view changes, because zooming moves buildings under a still cursor. Nothing
 * counts as hovered during a drag.
 */
export function useBuildingHover(view: View | null) {
  const [point, setPoint] = useState<HoverPoint | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = point && document.elementFromPoint(point.x, point.y);
    setBuildingId(element?.closest(".buildings path")?.id ?? null);
  }, [point, view]);

  return {
    hover: point && buildingId ? { buildingId, point } : null,
    hoverHandlers: {
      // Capture phase, so these sit alongside the pan and zoom handlers.
      onPointerMoveCapture: (event: PointerEvent) => {
        const isHovering = event.pointerType === "mouse" && event.buttons === 0;
        setPoint(isHovering ? { x: event.clientX, y: event.clientY } : null);
      },
      onPointerDownCapture: () => setPoint(null),
      onPointerLeave: () => setPoint(null),
    },
  };
}
