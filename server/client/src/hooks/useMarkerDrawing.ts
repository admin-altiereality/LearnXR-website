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
  /** krpano's Three.js plugin surface, present once the threejs block is included. */
  threejs?: {
    THREE?: any;
    camera?: any;
  };
  /** krpano's hotspot array. Indexed access only — see the warning in pickModelAt. */
  hotspot?: { getItem?: (index: number) => any };
}

export interface ModelPick {
  asset_id: string;
  x: number;
  y: number;
  z: number;
  /** Node name of the exact sub-mesh hit, when the GLB names its parts. */
  part_name?: string | null;
}

/**
 * Does this screen point land on a 3D model, and where in that model's local space?
 * Returns null for a miss, in which case the stroke goes on the panorama instead.
 *
 * The raycast runs HERE rather than through `krpano.call('annotation_pick_model(...)')`.
 * That older route wrote its result to a global and read it back on the very next
 * statement, which silently assumed krpano executes a type="js" action synchronously and
 * inline. krpano makes no such guarantee — and when it does not hold, the read always
 * returns the stale value, every pick misses, and no pin is ever placed with nothing
 * logged anywhere. Doing the maths directly removes the assumption entirely.
 *
 * The krpano action is kept as a fallback for the case where the Three.js surface is not
 * exposed on the JS interface.
 */
export function pickModelAt(viewer: KrpanoLike | null, x: number, y: number): ModelPick | null {
  if (!viewer) return null;

  const THREE = viewer.threejs?.THREE;
  const camera = viewer.threejs?.camera;
  const getItem = viewer.hotspot?.getItem;

  if (THREE && camera && typeof getItem === 'function' && viewer.get) {
    try {
      const stageW = Number(viewer.get('stagewidth'));
      const stageH = Number(viewer.get('stageheight'));
      if (!Number.isFinite(stageW) || !Number.isFinite(stageH) || stageW <= 0 || stageH <= 0) {
        return null;
      }

      const ndc = new THREE.Vector2((x / stageW) * 2 - 1, -(y / stageH) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);

      // Walk the hotspot array BY INDEX. Addressing hotspot[asset_N] by name makes krpano
      // CREATE that element — the phantom-hotspot bug that once killed panorama dragging.
      const count = Number(viewer.get('hotspot.count')) || 0;
      let best: { distance: number; point: any; root: any; name: string; part: string | null } | null = null;

      for (let i = 0; i < count; i += 1) {
        let hs: any = null;
        try { hs = getItem.call(viewer.hotspot, i); } catch { hs = null; }
        if (!hs?.name || !String(hs.name).startsWith('asset_') || !hs.threejsobject) continue;
        // Recursive: a GLB loads as a group, not a single mesh.
        const hits = raycaster.intersectObject(hs.threejsobject, true);
        if (hits.length > 0 && (!best || hits[0].distance < best.distance)) {
          best = {
            distance: hits[0].distance,
            point: hits[0].point,
            root: hs.threejsobject,
            name: String(hs.name),
            // The sub-mesh actually under the pointer. This was discarded before, so
            // `selected_part_id` only ever carried a whole-asset id and nothing could act
            // on an individual part.
            part: hits[0].object?.name ? String(hits[0].object.name) : null,
          };
        }
      }
      if (!best) return null;

      const local = best.root.worldToLocal(best.point.clone());
      return { asset_id: best.name, x: local.x, y: local.y, z: local.z, part_name: best.part };
    } catch {
      /* fall through to the krpano action */
    }
  }

  if (!viewer.call) return null;
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

/**
 * Pan the panorama by a screen-pixel delta, in the same direction a normal krpano drag
 * moves it (content follows the finger).
 *
 * Written straight to `view.*` rather than handed to krpano's own drag. While the marker is
 * armed the capture layer sits over the whole stage with `pointer-events: auto`, so krpano
 * receives no pointer at all and its drag can never run. Programmatic view writes are
 * unaffected by `control.usercontrol` — that flag gates USER input — which is why the
 * 'marker' suspend holder can stay in place throughout and the 2s watchdog has nothing to
 * fight. This is the same reason applyTeacherView's `lookto` works while suspended.
 */
export function panViewByPixels(viewer: KrpanoLike | null, dx: number, dy: number): void {
  if (!viewer?.call || !viewer.get) return;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
  try {
    const num = (name: string, fallback: number) => {
      const v = Number(viewer.get?.(name));
      return Number.isFinite(v) ? v : fallback;
    };
    const stageH = num('stageheight', 0);
    if (stageH <= 0) return;
    // Degrees per pixel from the vertical FOV — the same relationship krpano's own drag uses.
    const degPerPx = num('view.fov', 90) / stageH;
    const h = normalizeAth(num('view.hlookat', 0) - dx * degPerPx);
    const v = clampAtv(num('view.vlookat', 0) - dy * degPerPx);
    viewer.call(`set(view.hlookat,${h.toFixed(3)});set(view.vlookat,${v.toFixed(3)});`);
  } catch {
    /* viewer not ready */
  }
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

  /**
   * Every pointer currently down on the capture layer, by pointerId.
   *
   * There was no multi-touch state at all before: `drawingRef` is a single boolean, so a
   * second finger re-entered the down path, reset `pointsRef` and corrupted the stroke in
   * progress. Two fingers now mean "pan", which is the gesture every map and photo viewer
   * uses, and which the teacher previously had to leave marker mode to perform.
   */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  /** Centroid of the active touch pointers on the previous move, for the pan delta. */
  const panAnchorRef = useRef<{ x: number; y: number } | null>(null);
  /** True while Space is held — the desktop equivalent of a two-finger drag. */
  const spaceHeldRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

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

  /**
   * Abandon the stroke in progress WITHOUT publishing it.
   *
   * Distinct from `finish`, which publishes anything with two or more points. When a second
   * finger lands mid-stroke the partial stroke is not something the teacher meant to draw,
   * so publishing it would litter the class's view with a stray flick on every pan.
   */
  const cancel = useCallback(() => {
    drawingRef.current = false;
    pointsRef.current = [];
    setLiveStroke(null);
  }, []);

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

  /** Centroid of every touch pointer currently down. */
  const touchCentroid = useCallback((): { x: number; y: number } | null => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return null;
    const sum = pts.reduce((acc, q) => ({ x: acc.x + q.x, y: acc.y + q.y }), { x: 0, y: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length };
  }, []);

  /**
   * Space held = pan, on desktop. Space is the canvas-tool convention (Figma, Photoshop) and
   * costs the marker nothing, since a marker never needs the space bar. Reset on blur too:
   * a keyup swallowed by a focus change would otherwise leave pan mode stuck on with no way
   * back except another Space press.
   */
  useEffect(() => {
    if (!active) return;
    const isSpace = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ';
    const down = (e: KeyboardEvent) => {
      if (!isSpace(e) || e.repeat) return;
      // Stop the page scrolling under the lesson while panning.
      e.preventDefault();
      if (spaceHeldRef.current) return;
      spaceHeldRef.current = true;
      setSpaceHeld(true);
      // A stroke already underway is abandoned rather than published — same reason as a
      // second finger landing mid-stroke.
      if (drawingRef.current) cancel();
    };
    const up = (e: KeyboardEvent) => {
      if (!isSpace(e)) return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      panAnchorRef.current = null;
    };
    const blur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      panAnchorRef.current = null;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      blur();
    };
  }, [active, cancel]);

  /**
   * Trackpad two-finger drag.
   *
   * A two-finger drag on a laptop trackpad does NOT produce two pointers — it produces
   * `wheel` events, so the pointer path above never sees it. Registered natively with
   * `{ passive: false }` because React's onWheel is passive and cannot preventDefault, and
   * without preventDefault the browser scrolls the page behind the lesson instead.
   *
   * ctrlKey means the trackpad reported a pinch; that is ignored deliberately — zoom was
   * not asked for, and a pinch that silently changed the field of view mid-lesson would be
   * a surprise. Left here as the obvious place to add it later.
   */
  const captureRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = captureRef.current;
    if (!active || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      // deltaMode 1 is lines, not pixels; scale it to something comparable.
      const k = e.deltaMode === 1 ? 16 : 1;
      panViewByPixels(viewerRef.current, -e.deltaX * k, -e.deltaY * k);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [active]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!active) return;
      // currentTarget, not target: capture must be taken on the stable capture div. Taking
      // it on `target` bound it to whatever element the event happened to resolve to.
      const surface = e.currentTarget as Element;
      surface.setPointerCapture?.(e.pointerId);

      if (e.pointerType === 'touch') {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size >= 2) {
          // Second finger: this gesture is a pan, not a stroke.
          cancel();
          panAnchorRef.current = touchCentroid();
          return;
        }
      }

      // Space held: this drag pans instead of drawing.
      if (spaceHeldRef.current) {
        panAnchorRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // A tap that lands on a 3D model becomes a pin stuck to that model, rather than
      // a stroke painted on the panorama behind it.
      const pick = pickModelAt(viewerRef.current, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (pick && onModelMark) {
        onModelMark(pick);
        try { surface.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
        return;
      }
      drawingRef.current = true;
      pointsRef.current = [];
      const p = screenToSphere(viewer, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (p) pointsRef.current.push(p);
    },

    onPointerMove: (e: React.PointerEvent) => {
      if (!active) return;

      if (e.pointerType === 'touch' && pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Two-finger pan.
      if (pointersRef.current.size >= 2) {
        const centre = touchCentroid();
        const prev = panAnchorRef.current;
        if (centre && prev) panViewByPixels(viewerRef.current, centre.x - prev.x, centre.y - prev.y);
        panAnchorRef.current = centre;
        return;
      }

      // Space+drag pan.
      if (spaceHeldRef.current && panAnchorRef.current) {
        panViewByPixels(viewerRef.current, e.clientX - panAnchorRef.current.x, e.clientY - panAnchorRef.current.y);
        panAnchorRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!drawingRef.current) return;
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

    onPointerUp: (e: React.PointerEvent) => {
      const wasPanning = pointersRef.current.size >= 2 || spaceHeldRef.current;
      pointersRef.current.delete(e.pointerId);
      try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
      // Re-seat the anchor so lifting one of three fingers does not jump the view.
      panAnchorRef.current = pointersRef.current.size >= 2 ? touchCentroid() : null;
      if (wasPanning) { cancel(); return; }
      finish();
    },

    onPointerCancel: (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      panAnchorRef.current = pointersRef.current.size >= 2 ? touchCentroid() : null;
      cancel();
    },

    onPointerLeave: () => {
      if (pointersRef.current.size >= 2 || spaceHeldRef.current) return;
      if (drawingRef.current) finish();
    },
  };

  return { handlers, liveStroke, spaceHeld, captureRef };
}
