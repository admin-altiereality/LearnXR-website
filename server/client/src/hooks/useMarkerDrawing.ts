/**
 * useMarkerDrawing
 * ----------------
 * Pointer handling for the teacher marker.
 *
 * While marker mode is active krpano's drag-to-pan is suspended (it would
 * otherwise swallow every draw gesture) and a transparent capture layer takes
 * pointer events. Each sample is converted from screen pixels to panorama sphere
 * coordinates so the stroke stays anchored to the object.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationPoint, AnnotationStroke } from '../types/lms';
import { capPoints, clampAtv, normalizeAth, simplifyStroke } from '../lib/annotations/sphereGeometry';
import { releaseUserControl, suspendUserControl } from '../lib/krpano/userControl';

interface KrpanoLike {
  call?: (action: string) => void;
  get?: (name: string) => unknown;
  screentosphere?: (x: number, y: number) => { x: number; y: number } | null;
}

export interface ModelPick {
  asset_id: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Ask krpano whether this screen point lands on a 3D model, and where in that model's
 * local space. Returns null for a miss, in which case the stroke goes on the panorama.
 */
export function pickModelAt(viewer: KrpanoLike | null, x: number, y: number): ModelPick | null {
  if (!viewer?.call) return null;
  try {
    (window as unknown as Record<string, unknown>).__krpanoModelPick = null;
    viewer.call(`annotation_pick_model(${Math.round(x)}, ${Math.round(y)});`);
    const pick = (window as unknown as { __krpanoModelPick?: ModelPick | null }).__krpanoModelPick;
    return pick && pick.asset_id ? pick : null;
  } catch {
    return null;
  }
}

export type MarkerMode = 'laser' | 'ink';

/** Every stroke is temporary; kept as a named constant so the krpano layer can match. */
export const LASER_TTL_MS = 6500;

interface UseMarkerDrawingArgs {
  viewer: KrpanoLike | null;
  active: boolean;
  mode: MarkerMode;
  color: string;
  width: number;
  /** Called once, on pointer-up, with the finished stroke. */
  onStrokeComplete: (stroke: AnnotationStroke) => void;
  /** Called when the gesture started on a 3D model — a pin, not a stroke. */
  onModelMark?: (pick: ModelPick) => void;
}

/**
 * Convert screen pixels to (ath, atv).
 *
 * Prefers krpano's own `screentosphere`. Nothing in this app used it before, so
 * if the build does not expose it on the JS interface we fall back to inverting
 * the rectilinear projection ourselves from hlookat/vlookat/fov and the stage
 * size — the same quantities the immersive UI already reads successfully.
 */
export function screenToSphere(
  viewer: KrpanoLike | null,
  x: number,
  y: number
): AnnotationPoint | null {
  if (!viewer) return null;

  if (typeof viewer.screentosphere === 'function') {
    const p = viewer.screentosphere(x, y);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      return { a: normalizeAth(p.x), v: clampAtv(p.y) };
    }
  }

  const num = (name: string, fallback: number) => {
    const v = Number(viewer.get?.(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const sw = num('stagewidth', 0);
  const sh = num('stageheight', 0);
  if (sw <= 0 || sh <= 0) return null;

  const h = num('view.hlookat', 0);
  const v = num('view.vlookat', 0);
  const fov = num('view.fov', 90);

  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  // Focal length in pixels from the vertical field of view.
  const f = sh / 2 / Math.tan((fov * toRad) / 2);
  const dx = x - sw / 2;
  const dy = y - sh / 2;

  // Camera-space ray, then rotate by pitch and yaw.
  let rx = dx;
  let ry = dy;
  const rz = f;

  const pitch = v * toRad;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const ry2 = ry * cosP - rz * sinP;
  const rz2 = ry * sinP + rz * cosP;
  ry = ry2;

  const len = Math.hypot(rx, ry, rz2) || 1;
  rx /= len;
  ry /= len;
  const nz = rz2 / len;

  const atv = clampAtv(Math.asin(Math.max(-1, Math.min(1, ry))) * toDeg);
  const ath = normalizeAth(h + Math.atan2(rx, nz) * toDeg);
  return { a: ath, v: atv };
}

export function useMarkerDrawing({
  viewer,
  active,
  mode,
  color,
  width,
  onStrokeComplete,
  onModelMark,
}: UseMarkerDrawingArgs) {
  const [liveStroke, setLiveStroke] = useState<AnnotationStroke | null>(null);
  const pointsRef = useRef<AnnotationPoint[]>([]);
  const drawingRef = useRef(false);

  // Hold the viewer in a ref: it used to be read during render, so when the snapshot
  // was null the effect early-returned WITHOUT registering cleanup, and krpano could be
  // left permanently on `usercontrol: off` — panning dead with no UI explaining it.
  const viewerRef = useRef<KrpanoLike | null>(null);
  viewerRef.current = viewer ?? null;

  // Suspend / restore krpano panning alongside marker mode, through the shared
  // refcount so this cannot fight applyTeacherView's Direct lock.
  useEffect(() => {
    if (!active) {
      releaseUserControl(viewerRef.current, 'marker');
      return;
    }
    suspendUserControl(viewerRef.current, 'marker');
    return () => {
      releaseUserControl(viewerRef.current, 'marker');
    };
  }, [active]);

  const finish = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const raw = pointsRef.current;
    pointsRef.current = [];
    setLiveStroke(null);
    if (raw.length < 2) return;

    const simplified = capPoints(simplifyStroke(raw, 0.25));
    const stroke: AnnotationStroke = {
      id: `s_${Date.now()}_${Math.round(performance.now() % 1000)}`,
      mode,
      color,
      width,
      points: simplified,
      created_ms: Date.now(),
      ttl_ms: LASER_TTL_MS,
    };
    onStrokeComplete(stroke);
  }, [mode, color, width, onStrokeComplete]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!active) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      // A tap that lands on a 3D model becomes a pin stuck to that model, rather than
      // a stroke painted on the panorama behind it.
      const pick = pickModelAt(viewerRef.current, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (pick && onModelMark) {
        onModelMark(pick);
        return;
      }
      drawingRef.current = true;
      pointsRef.current = [];
      const p = screenToSphere(viewer, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (p) pointsRef.current.push(p);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!active || !drawingRef.current) return;
      const p = screenToSphere(viewer, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (!p) return;
      pointsRef.current.push(p);
      // Local preview only — nothing is written until pointer-up.
      setLiveStroke({
        id: 'live',
        mode,
        color,
        width,
        points: [...pointsRef.current],
        created_ms: Date.now(),
      });
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onPointerLeave: () => {
      if (drawingRef.current) finish();
    },
  };

  return { handlers, liveStroke };
}
