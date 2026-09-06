/**
 * workspace – one anchor, and every position in the room derived from it.
 *
 * Placement used to be decided by three systems that each took their own
 * bearing from wherever the camera happened to point at the moment they ran:
 * SceneLayoutSystem for the dock and the models, LayoutEngine for the lesson
 * panel, ProfessionalLayoutSystem for a notional asset zone two to four metres
 * out. A head turn between any two of them left the dock and the panel facing
 * different directions, which is why the room never looked arranged — it wasn't.
 * Nothing was wrong with any one of the three; there were simply three answers
 * to one question.
 *
 * Here there is one answer. An anchor is captured once — a position, a bearing
 * flattened to the horizon, and the viewer's real eye height — and the desk, the
 * model slots and the panel are all derived from it. Recentring recaptures the
 * anchor, and the whole workspace moves as one piece, keeping its shape.
 *
 * The numbers below are ergonomic rather than arbitrary:
 *
 *   - Models sit at arm's length on a surface a little under half a metre below
 *     the eye, which is where a desk is whether you are seated or standing.
 *   - They spread across an arc rather than a line, so every model is the same
 *     distance away and the spread stays inside a comfortable turn of the head
 *     however many there are.
 *   - The panel is sized from the angle it subtends, not from a fixed width. A
 *     2.4m panel two metres away spans 62 degrees — wider than can be read
 *     without scanning across it. Sizing by angle keeps it readable at any
 *     distance.
 *
 * Nothing here loads, scales or normalises an asset. This decides only where the
 * slots are.
 */

import * as THREE from 'three';

import { DESK_DROP, PANEL_DROP, measureEyeHeight } from './ergonomics';

/** Distance from the viewer to the models. Comfortable reach, seated. */
export const DESK_REACH = 0.7;

/**
 * Widest the models may spread, in degrees. Beyond about this the outermost
 * model leaves comfortable view and the class starts turning to find it.
 */
export const MAX_MODEL_SPREAD_DEG = 70;

/** Smallest gap between adjacent model centres, so a full dock is still legible. */
export const MIN_MODEL_SPACING_DEG = 12;

/** Bearing of the lesson panel: to the left, out of the way of the models. */
export const PANEL_BEARING_DEG = -20;

/** How far away the panel sits. Beyond reach, inside comfortable reading range. */
export const PANEL_DISTANCE = 2.0;

/** Angle the panel subtends horizontally. Readable without scanning. */
export const PANEL_ANGULAR_WIDTH_DEG = 45;

/** The panel canvas is 2048x1280, and stretching it would be visible. */
export const PANEL_ASPECT = 1280 / 2048;

export interface WorkspaceAnchor {
  /** Where the viewer was standing or sitting when this was captured. */
  position: THREE.Vector3;
  /** Where they were facing, flattened to the horizon. */
  forward: THREE.Vector3;
  /** Their measured eye height above the floor. */
  eyeHeight: number;
  /** Floor level, so everything can be expressed against one datum. */
  groundY: number;
}

export interface ModelSlot {
  position: THREE.Vector3;
  /** Facing the viewer. */
  yaw: number;
}

export interface WorkspaceFrame {
  anchor: WorkspaceAnchor;
  /** Height of the desk surface — where a model's feet go. */
  deskY: number;
  dock: {
    center: THREE.Vector3;
    width: number;
    depth: number;
    yaw: number;
  };
  slots: ModelSlot[];
  panel: {
    position: THREE.Vector3;
    width: number;
    height: number;
    yaw: number;
  };
}

/** A horizon-flattened forward vector, guaranteed non-degenerate. */
function flattenForward(camera: THREE.Camera): THREE.Vector3 {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;
  // Looking straight up or down leaves nothing to flatten. Fall back to -Z
  // rather than normalising a zero vector into NaN and losing the whole room.
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  return forward.normalize();
}

/**
 * Capture where the workspace should be built.
 *
 * Called once when the lesson is ready, again when a headset session starts (the
 * first moment the viewer's real eye height is known), and on an explicit
 * recentre. Deliberately NOT called per frame: a workspace that follows the head
 * is a workspace you can never look away from.
 */
export function captureAnchor(camera: THREE.Camera | null, groundY = 0): WorkspaceAnchor {
  if (!camera) {
    return {
      position: new THREE.Vector3(0, groundY, 0),
      forward: new THREE.Vector3(0, 0, -1),
      eyeHeight: measureEyeHeight(null, groundY),
      groundY,
    };
  }
  const position = camera.getWorldPosition(new THREE.Vector3());
  return {
    position,
    forward: flattenForward(camera),
    eyeHeight: measureEyeHeight(camera, groundY),
    groundY,
  };
}

/**
 * A bearing relative to the anchor's forward, in degrees, negative to the LEFT.
 *
 * Left-negative because that is how the bearings read in the room: the panel is
 * at -20, which says "twenty degrees to your left" without anyone having to
 * remember which way three.js rotates about +Y. It rotates the opposite way,
 * hence the negation here rather than at every call site.
 */
function bearing(forward: THREE.Vector3, degrees: number): THREE.Vector3 {
  return forward
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-degrees))
    .normalize();
}

/** Yaw that turns an object at `from` to face `to`. */
function yawTowards(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/**
 * Every position in the room, for `assetCount` models.
 *
 * The models are laid on an arc centred on the anchor, so each is the same
 * distance from the viewer and the spread grows only until it reaches the
 * comfortable limit — after that they close up rather than marching off to the
 * sides. One model sits straight ahead.
 */
export function workspaceFrame(anchor: WorkspaceAnchor, assetCount: number): WorkspaceFrame {
  const deskY = Math.max(anchor.groundY + 0.3, anchor.groundY + anchor.eyeHeight - DESK_DROP);
  const count = Math.max(0, Math.floor(assetCount));

  // Spread: enough to separate the models, never more than comfortable.
  const spread =
    count > 1
      ? Math.min(MAX_MODEL_SPREAD_DEG, MIN_MODEL_SPACING_DEG * (count - 1))
      : 0;

  const slots: ModelSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    // -spread/2 .. +spread/2, and exactly 0 for a single model.
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    const direction = bearing(anchor.forward, t * spread);
    const position = anchor.position.clone().addScaledVector(direction, DESK_REACH);
    position.y = deskY;
    slots.push({ position, yaw: yawTowards(position, anchor.position) });
  }

  // The dock is the surface those slots stand on: wide enough to hold the arc
  // with a margin, never narrower than a single model needs.
  const halfChord = DESK_REACH * Math.sin(THREE.MathUtils.degToRad(spread / 2));
  const dockCenter = anchor.position.clone().addScaledVector(anchor.forward, DESK_REACH);
  dockCenter.y = deskY;
  const dock = {
    center: dockCenter,
    width: Math.max(0.6, halfChord * 2 + 0.4),
    depth: 0.5,
    yaw: yawTowards(dockCenter, anchor.position),
  };

  // The panel: same anchor, deliberate offset, sized by the angle it subtends.
  const panelDirection = bearing(anchor.forward, PANEL_BEARING_DEG);
  const panelPosition = anchor.position.clone().addScaledVector(panelDirection, PANEL_DISTANCE);
  panelPosition.y = anchor.groundY + anchor.eyeHeight - PANEL_DROP;
  const panelWidth =
    2 * PANEL_DISTANCE * Math.tan(THREE.MathUtils.degToRad(PANEL_ANGULAR_WIDTH_DEG / 2));

  return {
    anchor,
    deskY,
    dock,
    slots,
    panel: {
      position: panelPosition,
      width: panelWidth,
      height: panelWidth * PANEL_ASPECT,
      yaw: yawTowards(panelPosition, anchor.position),
    },
  };
}
