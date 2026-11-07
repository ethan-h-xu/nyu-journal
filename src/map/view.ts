import type { Rect } from "../data/types";

export interface Size {
  width: number;
  height: number;
}

/** Maps map coordinates to screen pixels: screen = map * k + (x, y). */
export interface View {
  x: number;
  y: number;
  k: number;
}

export const MAX_ZOOM = 8;

/** The smallest zoom at which the map still covers the whole viewport. */
export function minZoom(map: Size, viewport: Size): number {
  return Math.max(viewport.width / map.width, viewport.height / map.height);
}

/** Keeps zoom within limits, and the viewport entirely inside the map. */
export function clampView(view: View, map: Size, viewport: Size): View {
  const min = minZoom(map, viewport);
  const k = Math.min(Math.max(view.k, min), Math.max(MAX_ZOOM, min));
  const clampAxis = (offset: number, mapSize: number, viewportSize: number) =>
    Math.min(0, Math.max(viewportSize - mapSize * k, offset));
  return {
    k,
    x: clampAxis(view.x, map.width, viewport.width),
    y: clampAxis(view.y, map.height, viewport.height),
  };
}

/** Centers `bounds` in the viewport at the largest zoom that shows all of it. */
export function fitBounds(bounds: Rect, map: Size, viewport: Size): View {
  const k = Math.min(viewport.width / bounds.width, viewport.height / bounds.height);
  return clampView(
    {
      k,
      x: viewport.width / 2 - (bounds.x + bounds.width / 2) * k,
      y: viewport.height / 2 - (bounds.y + bounds.height / 2) * k,
    },
    map,
    viewport,
  );
}

/** Scales by `factor` while keeping the screen point (px, py) fixed. */
export function zoomAt(
  view: View,
  factor: number,
  px: number,
  py: number,
  map: Size,
  viewport: Size,
): View {
  const k = clampView({ ...view, k: view.k * factor }, map, viewport).k;
  const ratio = k / view.k;
  return clampView(
    { k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio },
    map,
    viewport,
  );
}

/** Interpolates between views: zoom changes evenly and the center moves straight. */
export function interpolateView(from: View, to: View, viewport: Size, t: number): View {
  const k = from.k * Math.pow(to.k / from.k, t);
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const fromX = (cx - from.x) / from.k;
  const fromY = (cy - from.y) / from.k;
  const toX = (cx - to.x) / to.k;
  const toY = (cy - to.y) / to.k;
  return {
    k,
    x: cx - (fromX + (toX - fromX) * t) * k,
    y: cy - (fromY + (toY - fromY) * t) * k,
  };
}
