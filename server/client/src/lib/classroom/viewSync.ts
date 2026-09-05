/**
 * viewSync – shared view-synchronisation maths and policy for live classes.
 *
 * The host broadcasts where they are looking as `{hlookat, vlookat, fov}` and
 * students follow. Both players do this, but they had their own copies of the
 * throttle, the dead-band and the four follow rules — which is exactly the kind
 * of thing that drifts. The policy lives here; the players only supply the I/O.
 *
 * Angle convention (krpano's, which the stored `teacher_view` already uses):
 *   - `h` / hlookat: yaw in degrees. 0 looks down -Z; +90 looks down -X.
 *   - `v` / vlookat: pitch in degrees, **positive is downward**.
 */

import * as THREE from 'three';

export interface HV {
  hlookat: number;
  vlookat: number;
  fov?: number;
}

/** Host writes at most one view update per this many ms. */
export const VIEW_SEND_THROTTLE_MS = 200;
/** Movement smaller than this is not worth a write fanned out to the whole class. */
export const VIEW_MIN_DELTA_DEG = 0.5;
/**
 * After a student's own pointer input they keep their view for this long. The host
 * writes every ~200ms and each update tweens, so without this a student who drags
 * is yanked back mid-gesture and panning feels dead.
 */
export const STUDENT_DRAG_GRACE_MS = 1500;

// ---------------------------------------------------------------------------
// Orbit camera (camera circles the origin and looks inward) — the R3F lesson
// scene in the krpano player. Lifted from VRLessonPlayerKrpano.
// ---------------------------------------------------------------------------

/** Convert an orbiting camera's position to hlookat/vlookat degrees. */
export function cameraToHlookatVlookat(position: THREE.Vector3): { h: number; v: number } {
  const { x, y, z } = position;
  const theta = Math.atan2(x, z) * (180 / Math.PI);
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  const phi = Math.asin(Math.max(-1, Math.min(1, y / r))) * (180 / Math.PI);
  return { h: theta, v: phi };
}

/** Place an orbiting camera at the given look-at, keeping its current radius. */
export function applyTeacherViewToCamera(
  camera: THREE.PerspectiveCamera,
  h: number,
  v: number,
  radius: number
): void {
  const theta = (h * Math.PI) / 180;
  const phi = (v * Math.PI) / 180;
  camera.position.set(
    radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.cos(theta)
  );
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

// ---------------------------------------------------------------------------
// Origin-anchored camera (camera sits at the centre and rotates) — the WebXR
// scene in XRLessonPlayerV3. NOT interchangeable with the orbit helpers above:
// there the angles describe where the camera *is*, here where it *looks*.
// ---------------------------------------------------------------------------

/** Read yaw/pitch from a camera that rotates in place. */
export function cameraRotationToHV(camera: THREE.Camera): { h: number; v: number } {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const h = Math.atan2(-dir.x, -dir.z) * (180 / Math.PI);
  const v = -Math.asin(Math.max(-1, Math.min(1, dir.y))) * (180 / Math.PI);
  return { h, v };
}

/**
 * Point a camera that rotates in place at the given yaw/pitch.
 * Forces `YXZ` order so yaw and pitch stay independent and no roll creeps in.
 */
export function applyHVToCameraRotation(camera: THREE.Camera, h: number, v: number): void {
  camera.rotation.order = 'YXZ';
  camera.rotation.set((-v * Math.PI) / 180, (h * Math.PI) / 180, 0);
  camera.updateMatrixWorld();
}

// ---------------------------------------------------------------------------
// Host send policy
// ---------------------------------------------------------------------------

export interface HostViewSender {
  /** Feed the host's current view; writes only when throttle and dead-band allow. */
  send(h: number, v: number, fov: number): void;
  /** Forget the last-sent view so the next `send` always writes. */
  reset(): void;
}

/**
 * Throttle + dead-band in front of `updateTeacherView`.
 *
 * Every write here is read by every student in the class, so the cost is the
 * cadence times the roster size. 200ms is indistinguishable from 100ms once the
 * student side tweens each update, and halves that fan-out.
 */
export function createHostViewSender(options: {
  onSend: (h: number, v: number, fov: number) => void;
  /** Gate consulted on every send — continuous follow only applies under lockstep. */
  isEnabled?: () => boolean;
  throttleMs?: number;
  minDeltaDeg?: number;
}): HostViewSender {
  const throttleMs = options.throttleMs ?? VIEW_SEND_THROTTLE_MS;
  const minDeltaDeg = options.minDeltaDeg ?? VIEW_MIN_DELTA_DEG;
  let lastSent = 0;
  let lastView: { h: number; v: number; fov: number } | null = null;

  return {
    send(h, v, fov) {
      if (options.isEnabled && !options.isEnabled()) return;
      const now = Date.now();
      if (now - lastSent < throttleMs) return;
      if (
        lastView &&
        Math.abs(lastView.h - h) < minDeltaDeg &&
        Math.abs(lastView.v - v) < minDeltaDeg &&
        Math.abs(lastView.fov - fov) < minDeltaDeg
      ) {
        return;
      }
      lastSent = now;
      lastView = { h, v, fov };
      options.onSend(h, v, fov);
    },
    reset() {
      lastSent = 0;
      lastView = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Student follow policy
// ---------------------------------------------------------------------------

export interface AppliedView {
  h: number;
  v: number;
  fov: number;
  syncId: number | null;
}

export interface FollowDecision {
  apply: boolean;
  /** True for an explicit "Direct class to my view" — always wins, snaps rather than tweens. */
  isDirect: boolean;
  next: AppliedView | null;
}

/**
 * Decide whether a student should adopt the teacher's view.
 *
 * The four rules, all load-bearing:
 *  1. Continuous follow applies ONLY under lockstep. Outside it students explore
 *     freely, and every host write is read and discarded.
 *  2. An explicit Direct (a new `sync_id`) always wins, in every mode.
 *  3. In immersive VR / on Quest, apply Directs only — continuous follow would
 *     fight the user's physical head movement.
 *  4. Do not fight a student who is actively looking around (drag grace window).
 */
export function shouldApplyTeacherView(input: {
  teacherView:
    | {
        hlookat?: number | string;
        vlookat?: number | string;
        fov?: number | string;
        sync_id?: number;
      }
    | null
    | undefined;
  previous: AppliedView | null;
  controlEnabled: boolean;
  inImmersive: boolean;
  /** Timestamp (ms) until which the student's own input holds the camera. */
  studentDragUntil?: number;
  defaultFov?: number;
}): FollowDecision {
  const none: FollowDecision = { apply: false, isDirect: false, next: null };
  const tv = input.teacherView;
  if (!tv) return none;

  const h = Number(tv.hlookat);
  const v = Number(tv.vlookat);
  const fov = Number(tv.fov) || input.defaultFov || 90;
  if (!Number.isFinite(h) || !Number.isFinite(v)) return none;

  const syncId =
    typeof tv.sync_id === 'number' && Number.isFinite(tv.sync_id) ? tv.sync_id : null;
  const prev = input.previous;
  const isDirect = syncId != null && syncId !== prev?.syncId;
  const next: AppliedView = { h, v, fov, syncId };

  // Rule 3 — head tracking owns the camera unless this is a deliberate Direct.
  if (input.inImmersive && !isDirect) return none;
  // Nothing changed and this is not a re-issued Direct.
  if (prev && prev.h === h && prev.v === v && prev.fov === fov && !isDirect) return none;
  // Rule 1 — continuous follow is a lockstep-only behaviour.
  if (!isDirect && !input.controlEnabled) return none;
  // Rule 4 — respect an in-progress look-around. Rule 2 means a Direct skips this.
  if (!isDirect && Date.now() < (input.studentDragUntil ?? 0)) return none;

  return { apply: true, isDirect, next };
}
