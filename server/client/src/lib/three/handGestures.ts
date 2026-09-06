/**
 * handGestures – WebXR hand-gesture detection for the lesson player.
 *
 * The TypeScript port of the sandbox module validated on a Quest
 * (`public/hand-tracking/gestures.js`). Same maths, same thresholds; typed, and
 * using the bundled three rather than a CDN copy — two Three.js instances in
 * one page do not recognise each other's objects.
 *
 * Two ideas carry the whole thing:
 *
 *   1. Every gesture reports a CONTINUOUS strength (0..1), not just a boolean.
 *      A bare distance threshold is what makes hand tracking feel unreliable:
 *      a hand resting near the boundary flickers, and an object is grabbed and
 *      dropped several times a second.
 *
 *   2. Hysteresis on every boolean. A gesture engages at a high strength and
 *      releases at a lower one, so the noisy middle cannot toggle it.
 *
 * Joint names are from the WebXR Hand Input spec; three exposes them on
 * `hand.joints`, repositioned by the runtime each frame.
 */

import * as THREE from 'three';

/** Thumb-to-index distance, in metres, at which a pinch is fully closed / open. */
const PINCH_CLOSED_M = 0.02;
const PINCH_OPEN_M = 0.05;

/** Mean fingertip-to-wrist distance for a closed fist / flat hand. */
const GRAB_CLOSED_M = 0.07;
const GRAB_OPEN_M = 0.14;

/** Engage high, release low. The band between is where a steady hand would chatter. */
const ENGAGE_AT = 0.7;
const RELEASE_AT = 0.45;

/** Below this the index finger is curled, not pointing. */
const POINT_EXTENSION_MIN = 0.6;

const FINGER_TIPS = [
  'index-finger-tip',
  'middle-finger-tip',
  'ring-finger-tip',
  'pinky-finger-tip',
] as const;

/** three's XRHand exposes joints as Object3Ds keyed by spec name. */
type XRHandLike = THREE.Group & {
  joints?: Record<string, THREE.Object3D & { jointRadius?: number }>;
};

/**
 * Hand orientation as a quaternion, built from a three-joint basis.
 *
 * The wrist joint carries its own rotation, but reading it directly makes a held
 * object jitter — a single joint is the noisiest thing the runtime reports.
 * Spanning wrist, index knuckle and pinky knuckle averages that out and gives a
 * frame that means something physically: forward along the hand, right across
 * the knuckles, up out of the back of the hand.
 *
 * This is what gives a grabbed object true yaw, pitch and roll. Without it the
 * layout system's updateGrab reads an identity rotation and objects translate
 * without ever turning.
 */
export function readOrientation(hand: XRHandLike): THREE.Quaternion | null {
  const wrist = joint(hand, 'wrist');
  const indexKnuckle = joint(hand, 'index-finger-metacarpal');
  const pinkyKnuckle = joint(hand, 'pinky-finger-metacarpal');
  if (!wrist || !indexKnuckle || !pinkyKnuckle) return null;

  const forward = new THREE.Vector3().subVectors(indexKnuckle.position, wrist.position);
  const across = new THREE.Vector3().subVectors(indexKnuckle.position, pinkyKnuckle.position);
  // Degenerate when joints briefly coincide during tracking loss; a zero-length
  // basis produces NaNs that propagate into the grabbed object's transform.
  if (forward.lengthSq() < 1e-8 || across.lengthSq() < 1e-8) return null;

  forward.normalize();
  const up = new THREE.Vector3().crossVectors(across, forward).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();

  // Columns are the basis vectors; -forward because three's convention faces -Z.
  const basis = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

export interface HandGestureState {
  /** False when the runtime is not reporting this hand at all. */
  tracked: boolean;
  pinchStrength: number;
  /** Where the pinch happens in world space — what a grab should measure from. */
  pinchPoint: THREE.Vector3 | null;
  pinching: boolean;
  justPinched: boolean;
  justReleased: boolean;
  grabStrength: number;
  grabbing: boolean;
  justGrabbed: boolean;
  justLetGo: boolean;
  /** Index-finger ray, for pointing at the lesson panel from a distance. */
  point: { origin: THREE.Vector3; direction: THREE.Vector3; extension: number } | null;
  /** True when the finger is extended enough for the ray to be meant. */
  pointing: boolean;
  /** Hand orientation, for rotating a held object with the wrist. */
  orientation: THREE.Quaternion | null;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Distance mapped onto 0..1, where `closed` reads 1 — these gestures all mean "how closed". */
function strengthFromDistance(distance: number, closed: number, open: number): number {
  return clamp01((open - distance) / (open - closed));
}

/**
 * A joint, or null when the runtime has not reported it.
 *
 * Hands stream in progressively and joints drop out when occluded, so every read
 * tolerates absence. A joint that exists but was never positioned sits at the
 * origin with no radius, which would produce wild distances on the first frame.
 */
function joint(hand: XRHandLike | null | undefined, name: string) {
  const j = hand?.joints?.[name];
  return j && j.jointRadius !== undefined ? j : null;
}

/** Pinch reading: thumb tip to index tip, with the midpoint between them. */
export function readPinch(hand: XRHandLike) {
  const thumb = joint(hand, 'thumb-tip');
  const index = joint(hand, 'index-finger-tip');
  if (!thumb || !index) return null;

  const distance = thumb.position.distanceTo(index.position);
  return {
    distance,
    midpoint: thumb.position.clone().lerp(index.position, 0.5),
    strength: strengthFromDistance(distance, PINCH_CLOSED_M, PINCH_OPEN_M),
  };
}

/**
 * Whole-hand grab: how closed the four fingers are, measured to the wrist.
 * Averaged across fingers so one mis-tracked tip does not decide it.
 */
export function readGrab(hand: XRHandLike) {
  const wrist = joint(hand, 'wrist');
  if (!wrist) return null;

  let total = 0;
  let counted = 0;
  for (const name of FINGER_TIPS) {
    const tip = joint(hand, name);
    if (tip) {
      total += tip.position.distanceTo(wrist.position);
      counted += 1;
    }
  }
  if (counted === 0) return null;

  const average = total / counted;
  return { distance: average, strength: strengthFromDistance(average, GRAB_CLOSED_M, GRAB_OPEN_M) };
}

/**
 * Pointing ray: origin at the index tip, direction along the finger.
 *
 * Measured proximal-to-tip rather than from the wrist, so it follows where the
 * finger is aimed rather than where the arm is. This is what lets a student
 * sitting at the back reach the quiz panel without walking to it.
 */
export function readPoint(hand: XRHandLike) {
  const base = joint(hand, 'index-finger-phalanx-proximal');
  const tip = joint(hand, 'index-finger-tip');
  if (!base || !tip) return null;

  return {
    origin: tip.position.clone(),
    direction: new THREE.Vector3().subVectors(tip.position, base.position).normalize(),
    // A curled finger is not a point: compare base-to-tip against an extended length.
    extension: clamp01(base.position.distanceTo(tip.position) / 0.07),
  };
}

export interface HandGestureTracker {
  update(hand: XRHandLike): HandGestureState;
  reset(): void;
}

/**
 * Per-hand state with hysteresis.
 *
 * Returns EDGES as well as levels — `justPinched` / `justReleased` — because
 * grabbing and dropping happen at a moment, and polling a boolean every frame
 * makes that awkward to express.
 */
export function createHandGestureTracker(): HandGestureTracker {
  let pinching = false;
  let grabbing = false;

  return {
    update(hand) {
      const pinch = readPinch(hand);
      const grab = readGrab(hand);
      const point = readPoint(hand);
      const orientation = readOrientation(hand);

      const wasPinching = pinching;
      const wasGrabbing = grabbing;

      // Losing tracking releases, rather than leaving an object stuck to a hand
      // that is no longer visible.
      pinching = pinch
        ? pinching
          ? pinch.strength > RELEASE_AT
          : pinch.strength > ENGAGE_AT
        : false;

      grabbing = grab
        ? grabbing
          ? grab.strength > RELEASE_AT
          : grab.strength > ENGAGE_AT
        : false;

      return {
        tracked: Boolean(pinch),
        pinchStrength: pinch?.strength ?? 0,
        pinchPoint: pinch?.midpoint ?? null,
        pinching,
        justPinched: pinching && !wasPinching,
        justReleased: !pinching && wasPinching,
        grabStrength: grab?.strength ?? 0,
        grabbing,
        justGrabbed: grabbing && !wasGrabbing,
        justLetGo: !grabbing && wasGrabbing,
        point,
        pointing: Boolean(point && point.extension > POINT_EXTENSION_MIN),
        orientation,
      };
    },

    reset() {
      pinching = false;
      grabbing = false;
    },
  };
}
