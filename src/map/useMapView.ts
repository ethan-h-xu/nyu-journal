import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { Rect } from "../data/types";
import {
  MAX_ZOOM,
  clampView,
  fitBounds,
  interpolateView,
  minZoom,
  zoomAt,
} from "./view";
import type { Size, View } from "./view";

const ANIMATION_MS = 220;
const BUTTON_ZOOM = 1.6;
const KEY_PAN_PX = 80;

interface Point {
  x: number;
  y: number;
}

/**
 * Pan and zoom state for an element showing a map of size `map`. Starts at
 * `getHome(viewport)`, and keeps refitting to it on resize until the user moves
 * the map. `getHome` must be stable between renders.
 */
export function useMapView(map: Size, getHome: (viewport: Size) => Rect) {
  const [viewport, setViewport] = useState<Size | null>(null);
  const [view, setViewState] = useState<View | null>(null);

  const elementRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<View | null>(null);
  const viewportRef = useRef<Size | null>(null);
  const hasMoved = useRef(false);
  const animationFrame = useRef<number | null>(null);
  const pointers = useRef(new Map<number, Point>());

  const setView = useCallback((next: View) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  /** Applies a user-driven change immediately. */
  const update = useCallback(
    (change: (view: View, viewport: Size) => View) => {
      if (!viewRef.current || !viewportRef.current) return;
      cancelAnimation();
      hasMoved.current = true;
      setView(change(viewRef.current, viewportRef.current));
    },
    [cancelAnimation, setView],
  );

  const animateTo = useCallback(
    (getTarget: (view: View, viewport: Size) => View) => {
      const from = viewRef.current;
      const size = viewportRef.current;
      if (!from || !size) return;
      cancelAnimation();
      const target = getTarget(from, size);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setView(target);
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ANIMATION_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setView(t === 1 ? target : interpolateView(from, target, size, eased));
        animationFrame.current = t === 1 ? null : requestAnimationFrame(step);
      };
      animationFrame.current = requestAnimationFrame(step);
    },
    [cancelAnimation, setView],
  );

  const zoomFromCenter = useCallback(
    (factor: number) => {
      hasMoved.current = true;
      animateTo((current, size) =>
        zoomAt(current, factor, size.width / 2, size.height / 2, map, size),
      );
    },
    [animateTo, map],
  );

  const zoomIn = useCallback(() => zoomFromCenter(BUTTON_ZOOM), [zoomFromCenter]);
  const zoomOut = useCallback(() => zoomFromCenter(1 / BUTTON_ZOOM), [zoomFromCenter]);

  /** Animates to fit `bounds`, given in map coordinates. */
  const focus = useCallback(
    (bounds: Rect) => {
      hasMoved.current = true;
      animateTo((_, size) => fitBounds(bounds, map, size));
    },
    [animateTo, map],
  );

  const reset = useCallback(() => {
    hasMoved.current = false;
    animateTo((_, size) => fitBounds(getHome(size), map, size));
  }, [animateTo, getHome, map]);

  // Track the element's size. The map only renders once this first fires, so it
  // never flashes at the wrong position.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      if (next.width === 0 || next.height === 0) return;
      const previous = viewportRef.current;
      const current = viewRef.current;
      viewportRef.current = next;
      setViewport(next);
      cancelAnimation();
      if (!previous || !current || !hasMoved.current) {
        setView(fitBounds(getHome(next), map, next));
        return;
      }
      // Keep the same spot centered as the viewport changes.
      setView(
        clampView(
          {
            k: current.k,
            x: current.x + (next.width - previous.width) / 2,
            y: current.y + (next.height - previous.height) / 2,
          },
          map,
          next,
        ),
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimation();
    };
  }, [cancelAnimation, getHome, map, setView]);

  // Registered directly because stopping page scroll needs a non-passive
  // listener, which React's onWheel prop doesn't provide.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      // Trackpad pinches report as ctrl+wheel with much smaller deltas.
      const speed = event.ctrlKey ? 0.01 : 0.0015;
      const factor = Math.exp(-event.deltaY * lines * speed);
      update((current, size) =>
        zoomAt(
          current,
          factor,
          event.clientX - bounds.left,
          event.clientY - bounds.top,
          map,
          size,
        ),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [map, update]);

  const toLocal = (event: { clientX: number; clientY: number }): Point => {
    const bounds = elementRef.current!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, toLocal(event));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = toLocal(event);
    const others = [...pointers.current].filter(([id]) => id !== event.pointerId);
    pointers.current.set(event.pointerId, point);

    if (others.length === 0) {
      update((current, size) =>
        clampView(
          {
            ...current,
            x: current.x + point.x - previous.x,
            y: current.y + point.y - previous.y,
          },
          map,
          size,
        ),
      );
    } else if (others.length === 1) {
      // Pinch: zoom by the change in finger spread, and pan with their midpoint.
      const other = others[0][1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(point.x - other.x, point.y - other.y);
      if (before === 0) return;
      const panX = (point.x - previous.x) / 2;
      const panY = (point.y - previous.y) / 2;
      update((current, size) =>
        zoomAt(
          { ...current, x: current.x + panX, y: current.y + panY },
          after / before,
          (point.x + other.x) / 2,
          (point.y + other.y) / 2,
          map,
          size,
        ),
      );
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    const point = toLocal(event);
    hasMoved.current = true;
    animateTo((current, size) =>
      zoomAt(current, BUTTON_ZOOM, point.x, point.y, map, size),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const pan = (dx: number, dy: number) =>
      update((current, size) =>
        clampView({ ...current, x: current.x + dx, y: current.y + dy }, map, size),
      );
    switch (event.key) {
      case "ArrowLeft":
        pan(KEY_PAN_PX, 0);
        break;
      case "ArrowRight":
        pan(-KEY_PAN_PX, 0);
        break;
      case "ArrowUp":
        pan(0, KEY_PAN_PX);
        break;
      case "ArrowDown":
        pan(0, -KEY_PAN_PX);
        break;
      case "+":
      case "=":
        zoomIn();
        break;
      case "-":
        zoomOut();
        break;
      case "0":
        reset();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const min = viewport ? minZoom(map, viewport) : 0;

  return {
    view,
    elementRef,
    zoomIn,
    zoomOut,
    reset,
    focus,
    canZoomIn: !!view && view.k < MAX_ZOOM - 1e-6,
    canZoomOut: !!view && view.k > min + 1e-6,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onDoubleClick,
      onKeyDown,
    },
  };
}
