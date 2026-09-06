/**
 * gestures.js — WebXR hand-gesture detection.
 *
 * Deliberately dependency-free and framework-free: it takes a three.js XRHand
 * and returns numbers. That is what lets the same file be lifted straight into
 * XRLessonPlayerV3 later without dragging a demo scene along with it.
 *
 * Two ideas do most of the work here:
 *
 *   1. Every gesture reports a CONTINUOUS strength (0..1), not just a boolean.
 *      A bare distance threshold is what makes hand interaction feel unreliable:
 *      the hand sits near the boundary, the boolean flickers, and an object is
 *      grabbed and dropped several times a second. Strength lets the caller
 *      drive visuals (a highlight that grows as you close your fingers) and
 *      lets the boolean be derived with hysteresis on top.
 *
 *   2. Hysteresis on every boolean. A gesture ENGAGES at a high strength and
 *      only RELEASES at a lower one, so the noisy middle cannot toggle it. The
 *      per-hand state that needs is held in a GestureTracker rather than in the
 *      caller.
 *
 * Joint names follow the WebXR Hand Input spec; three.js exposes them on
 * `hand.joints`, each an Object3D positioned by the runtime each frame.
 */

// --- Tuning ----------------------------------------------------------------
// Distances in metres, measured on a Quest 3. Fingertip joints have a radius of
// roughly 8mm each, so "touching" bottoms out near 0.015 rather than 0.

/** Thumb-to-index distance at which a pinch counts as fully closed. */
const PINCH_CLOSED_M = 0.02;
/** Distance at which a pinch counts as fully open. */
const PINCH_OPEN_M = 0.05;

/** Fingertip-to-wrist distance for a fully closed fist. */
const GRAB_CLOSED_M = 0.07;
/** Fingertip-to-wrist distance for a flat, open hand. */
const GRAB_OPEN_M = 0.14;

/** Strength at which a gesture engages, and the lower one at which it lets go. */
const ENGAGE_AT = 0.7;
const RELEASE_AT = 0.45;

const FINGER_TIPS = [
  'index-finger-tip',
  'middle-finger-tip',
  'ring-finger-tip',
  'pinky-finger-tip',
];

// --- Small helpers ---------------------------------------------------------

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Map a distance onto 0..1, where `closed` reads 1 and `open` reads 0.
 * Inverted deliberately: the gestures here all mean "how closed is the hand".
 */
function strengthFromDistance(distance, closed, open) {
  return clamp01((open - distance) / (open - closed));
}

/**
 * A joint, or null when the runtime has not reported it.
 *
 * Hands stream in progressively and joints can drop out when occluded, so every
 * read has to tolerate absence. Returning null rather than throwing keeps the
 * animation loop running through a bad frame.
 */
function joint(hand, name) {
  const j = hand?.joints?.[name];
  // A joint that exists but has never been positioned sits at the origin with a
  // zero radius; treating that as real produces wild distances on the first frame.
  return j && j.jointRadius !== undefined ? j : null;
}

function distanceBetween(a, b) {
  if (!a || !b) return null;
  return a.position.distanceTo(b.position);
}

// --- Gesture readings ------------------------------------------------------

/**
 * Pinch: thumb tip to index tip.
 *
 * Returns `{ strength, distance, midpoint }`, or null when the joints are not
 * available. `midpoint` is where the pinch happens in world space, which is the
 * point a grab should measure from — not the wrist, and not the hand origin.
 */
export function readPinch(hand) {
  const thumb = joint(hand, 'thumb-tip');
  const index = joint(hand, 'index-finger-tip');
  const distance = distanceBetween(thumb, index);
  if (distance === null) return null;

  const midpoint = thumb.position.clone().lerp(index.position, 0.5);
  return {
    distance,
    midpoint,
    strength: strengthFromDistance(distance, PINCH_CLOSED_M, PINCH_OPEN_M),
  };
}

/**
 * Whole-hand grab: how closed the four fingers are, measured to the wrist.
 *
 * Distinct from a pinch because it suits different objects — you pinch a small
 * shape between two fingers, you wrap a hand around a large one. Averaging all
 * four tips makes it tolerant of one finger being mis-tracked.
 */
export function readGrab(hand) {
  const wrist = joint(hand, 'wrist');
  if (!wrist) return null;

  let total = 0;
  let counted = 0;
  for (const name of FINGER_TIPS) {
    const distance = distanceBetween(joint(hand, name), wrist);
    if (distance !== null) {
      total += distance;
      counted += 1;
    }
  }
  if (counted === 0) return null;

  const average = total / counted;
  return {
    distance: average,
    strength: strengthFromDistance(average, GRAB_CLOSED_M, GRAB_OPEN_M),
  };
}

/**
 * Pointing ray: origin at the index tip, direction along the finger.
 *
 * Taken from the proximal phalanx to the tip rather than from the wrist, so it
 * follows where the finger is actually aimed rather than where the arm is.
 */
export function readPoint(hand, THREE) {
  const base = joint(hand, 'index-finger-phalanx-proximal');
  const tip = joint(hand, 'index-finger-tip');
  if (!base || !tip) return null;

  const direction = new THREE.Vector3().subVectors(tip.position, base.position).normalize();
  // A curled finger is not a point. Comparing the straight-line base-to-tip
  // distance against a typical extended length tells us how extended it is.
  const extension = clamp01(base.position.distanceTo(tip.position) / 0.07);
  return { origin: tip.position.clone(), direction, extension };
}

// --- Stateful tracking -----------------------------------------------------

/**
 * Per-hand gesture state with hysteresis.
 *
 * One tracker per hand, ticked once per frame. It turns the continuous readings
 * above into stable booleans and, importantly, into EDGES — `justPinched` and
 * `justReleased` — because grab and drop are things that happen at a moment,
 * and polling a boolean every frame makes that awkward to express.
 */
export function createGestureTracker() {
  let pinching = false;
  let grabbing = false;

  return {
    /** Read the hand for this frame. Call exactly once per hand per frame. */
    update(hand, THREE) {
      const pinch = readPinch(hand);
      const grab = readGrab(hand);
      const point = readPoint(hand, THREE);

      const wasPinching = pinching;
      const wasGrabbing = grabbing;

      // Engage high, release low: the band between the two is where a steady
      // hand would otherwise chatter.
      if (pinch) {
        pinching = pinching ? pinch.strength > RELEASE_AT : pinch.strength > ENGAGE_AT;
      } else {
        // Lost tracking. Release rather than leaving an object stuck to a hand
        // that is no longer visible.
        pinching = false;
      }

      if (grab) {
        grabbing = grabbing ? grab.strength > RELEASE_AT : grab.strength > ENGAGE_AT;
      } else {
        grabbing = false;
      }

      return {
        tracked: Boolean(pinch),
        pinchStrength: pinch ? pinch.strength : 0,
        pinchPoint: pinch ? pinch.midpoint : null,
        pinching,
        justPinched: pinching && !wasPinching,
        justReleased: !pinching && wasPinching,
        grabStrength: grab ? grab.strength : 0,
        grabbing,
        justGrabbed: grabbing && !wasGrabbing,
        justLetGo: !grabbing && wasGrabbing,
        point,
      };
    },

    /** Drop all state — call when a hand disconnects. */
    reset() {
      pinching = false;
      grabbing = false;
    },
  };
}
