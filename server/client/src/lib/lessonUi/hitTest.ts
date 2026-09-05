/**
 * Hit-testing for the shared lesson panel.
 *
 * Both players raycast at the panel and get back a UV; the regions returned by
 * `drawLessonPanel` are in canvas pixels. This is the one place that conversion
 * lives, so the two players cannot disagree about where a button is.
 */

import type { ButtonRegion } from './types';
import { PANEL_H, PANEL_W } from './types';

/**
 * Region under a point in canvas coordinates.
 *
 * Searched back to front: regions drawn later sit on top, and the stepper pills
 * are appended last precisely so they win over anything beneath them.
 */
export function regionAtCanvas(
  regions: readonly ButtonRegion[],
  x: number,
  y: number
): ButtonRegion | null {
  for (let i = regions.length - 1; i >= 0; i -= 1) {
    const r = regions[i];
    if (!r) continue;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

/**
 * Region under a raycast UV.
 *
 * `v` is flipped: three.js UVs run bottom-up while canvas y runs top-down, and
 * getting this backwards silently mirrors every button to the wrong row.
 */
export function regionAtUv(
  regions: readonly ButtonRegion[],
  u: number,
  v: number
): ButtonRegion | null {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  return regionAtCanvas(regions, u * PANEL_W, (1 - v) * PANEL_H);
}

/** Convenience: the action string under a UV, or null. */
export function actionAtUv(
  regions: readonly ButtonRegion[],
  u: number,
  v: number
): string | null {
  return regionAtUv(regions, u, v)?.action ?? null;
}
