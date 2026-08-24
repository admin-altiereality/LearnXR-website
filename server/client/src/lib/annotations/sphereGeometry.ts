/**
 * Sphere-coordinate helpers for teacher marker strokes.
 *
 * Strokes are stored as (ath, atv) degrees so they stay pinned to the panorama.
 * These helpers are shared by the 2D SVG overlay and the in-VR canvas layer, so
 * both surfaces render from exactly the same data.
 */

import type { AnnotationPoint, AnnotationStroke } from '../../types/lms';

/** Wrap an ath value into -180..180. */
export function normalizeAth(a: number): number {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (Object.is(x, -180)) x = 180;
  return x;
}

/** Clamp an atv value into -90..90. */
export function clampAtv(v: number): number {
  return Math.max(-90, Math.min(90, v));
}

/** Shortest signed angular delta from a to b, in degrees (-180..180). */
export function deltaAth(a: number, b: number): number {
  return normalizeAth(b - a);
}

/**
 * Great-circle angular distance between two sphere points, in degrees.
 * Used to cull stroke points that sit behind the viewer — without this, points
 * behind the camera project to bogus screen coords and smear across the view.
 */
export function angularDistance(p: AnnotationPoint, q: AnnotationPoint): number {
  const toRad = Math.PI / 180;
  const p1 = p.v * toRad;
  const p2 = q.v * toRad;
  const dl = deltaAth(p.a, q.a) * toRad;
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return Math.acos(Math.max(-1, Math.min(1, c))) / toRad;
}

/**
 * Ramer–Douglas–Peucker in angular space. Keeps stroke documents small enough
 * that a whole lesson's ink stays well inside Firestore's 1MB per-document cap.
 */
export function simplifyStroke(points: AnnotationPoint[], epsilonDeg = 0.25): AnnotationPoint[] {
  if (points.length <= 2) return points.slice();

  const first = 0;
  const last = points.length - 1;
  let maxDist = -1;
  let index = -1;

  for (let i = first + 1; i < last; i += 1) {
    const d = perpendicularDistance(points[i], points[first], points[last]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilonDeg && index > 0) {
    const left = simplifyStroke(points.slice(first, index + 1), epsilonDeg);
    const right = simplifyStroke(points.slice(index, last + 1), epsilonDeg);
    return left.slice(0, -1).concat(right);
  }
  return [points[first], points[last]];
}

/** Approximate point-to-segment distance in degrees (small-angle planar approx). */
function perpendicularDistance(p: AnnotationPoint, a: AnnotationPoint, b: AnnotationPoint): number {
  // Scale longitude by cos(latitude) so degrees are comparable near the poles.
  const scale = Math.cos((p.v * Math.PI) / 180) || 1e-6;
  const px = deltaAth(a.a, p.a) * scale;
  const py = p.v - a.v;
  const bx = deltaAth(a.a, b.a) * scale;
  const by = b.v - a.v;

  const lenSq = bx * bx + by * by;
  if (lenSq === 0) return Math.hypot(px, py);
  let t = (px * bx + py * by) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - bx * t, py - by * t);
}

/**
 * Split a stroke wherever consecutive points jump the ±180° seam, so a line
 * drawn across the back of the panorama does not draw all the way round the
 * front. Returns one or more contiguous runs.
 */
export function splitAtSeam(points: AnnotationPoint[]): AnnotationPoint[][] {
  if (points.length < 2) return points.length ? [points.slice()] : [];
  const runs: AnnotationPoint[][] = [];
  let current: AnnotationPoint[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    // A raw longitude jump > 180 means the shortest path crosses the seam.
    if (Math.abs(cur.a - prev.a) > 180) {
      runs.push(current);
      current = [cur];
    } else {
      current.push(cur);
    }
  }
  runs.push(current);
  return runs.filter((r) => r.length > 0);
}

/** Caps that keep the session document small. */
export const MAX_INK_STROKES = 40;
export const MAX_POINTS_PER_STROKE = 120;

/** Enforce the per-stroke point cap by uniform decimation (keeps both ends). */
export function capPoints(points: AnnotationPoint[], max = MAX_POINTS_PER_STROKE): AnnotationPoint[] {
  if (points.length <= max) return points;
  const out: AnnotationPoint[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}

/** Default lifetime for a marker stroke. Every stroke is temporary. */
export const STROKE_TTL_MS = 6500;

/**
 * Teacher-vs-viewer clock offset, in ms.
 *
 * `created_ms` is stamped from the TEACHER's `Date.now()`, but expiry was compared against
 * the VIEWER's `Date.now()`. Nothing reconciled the two, so a student whose clock ran ~4s
 * fast saw every stroke arrive already fading, and ~6.5s fast filtered every stroke out
 * before it was ever projected — ink that silently never appeared, permanently.
 *
 * No server timestamp is needed to fix it. `sync_id` is the teacher's own `Date.now()` at
 * the moment of the write, so on receipt `sync_id - Date.now()` is the teacher-vs-viewer
 * offset directly (network latency biases it very slightly negative, which only makes
 * strokes live marginally longer — harmless). On the teacher's own client it resolves to
 * ~0, so the same code path is correct for host and student alike.
 */
let clockOffsetMs = 0;

/** Ignore anything beyond this; a wilder value means a bad clock, not a real offset. */
const MAX_CLOCK_OFFSET_MS = 60_000;

/** Feed the offset from an incoming annotation payload's `sync_id`. */
export function setAnnotationClockOffset(syncId: number | null | undefined): void {
  if (typeof syncId !== 'number' || !Number.isFinite(syncId)) return;
  const offset = syncId - Date.now();
  if (Math.abs(offset) > MAX_CLOCK_OFFSET_MS) return;
  clockOffsetMs = offset;
}

/** "Now", expressed on the teacher's clock — the one `created_ms` was stamped with. */
export function annotationNow(): number {
  return Date.now() + clockOffsetMs;
}

/** Current offset, for diagnostics. */
export function getAnnotationClockOffset(): number {
  return clockOffsetMs;
}

/** True once a stroke has outlived its ttl. Applies to every stroke, not just laser. */
export function isStrokeExpired(stroke: AnnotationStroke, now = annotationNow()): boolean {
  const ttl = stroke.ttl_ms ?? STROKE_TTL_MS;
  if (!ttl) return false;
  return now - stroke.created_ms > ttl;
}

/** 0..1 opacity for a stroke as it fades out over the last 40% of its life. */
export function laserOpacity(stroke: AnnotationStroke, now = annotationNow()): number {
  const ttl = stroke.ttl_ms ?? STROKE_TTL_MS;
  if (!ttl) return 1;
  const age = now - stroke.created_ms;
  const fadeStart = ttl * 0.6;
  if (age <= fadeStart) return 1;
  if (age >= ttl) return 0;
  return 1 - (age - fadeStart) / (ttl - fadeStart);
}

/** Centre of a stroke in sphere coords — where to point the class. */
export function strokeCentroid(points: AnnotationPoint[]): AnnotationPoint | null {
  if (!points.length) return null;
  // Average longitude on the unit circle so a stroke across the seam doesn't average
  // to the opposite side of the panorama.
  let x = 0, y = 0, v = 0;
  const toRad = Math.PI / 180;
  points.forEach((p) => {
    x += Math.cos(p.a * toRad);
    y += Math.sin(p.a * toRad);
    v += p.v;
  });
  return {
    a: normalizeAth((Math.atan2(y / points.length, x / points.length) * 180) / Math.PI),
    v: clampAtv(v / points.length),
  };
}
