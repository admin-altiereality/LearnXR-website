/**
 * xrReorient – turn a student who is wearing a headset.
 *
 * "Direct class to my view" works by pointing everyone's camera at the
 * teacher's heading. On a flat screen that is a rotation of the camera. In an
 * immersive session it is not: the headset owns the camera pose, three.js
 * overwrites `camera.rotation` from the device on every frame, and any value
 * written there is discarded. That is why Direct was silently doing nothing for
 * students in VR while working perfectly for everyone on a laptop.
 *
 * WebXR's own answer is to move the reference space rather than the camera: the
 * pose stays exactly as the device reports it, and the space that pose is
 * expressed in is rotated underneath. That is what `getOffsetReferenceSpace`
 * is for, and it means this file touches no scene-graph object at all — no
 * camera reparenting, no rig — so 3D asset placement cannot be affected by it.
 *
 * Offsets are composed from a remembered BASE space rather than from whatever
 * the current space happens to be. Chaining offsets works, but the small errors
 * accumulate, and a class that has been Directed a dozen times would drift away
 * from the teacher's heading.
 */

import * as THREE from 'three';

interface XrLikeRenderer {
  xr: {
    isPresenting?: boolean;
    getReferenceSpace?: () => XRReferenceSpace | null;
    setReferenceSpace?: (space: XRReferenceSpace) => void;
  };
}

/** The unrotated space for the current session, captured on first use. */
let baseSpace: XRReferenceSpace | null = null;
/** Total yaw currently applied to the base, in degrees. */
let appliedYawDeg = 0;

/**
 * Forget the remembered base space.
 *
 * Must be called on `sessionend`: reference spaces do not survive a session, and
 * holding a stale one into the next session would either throw or silently
 * re-apply the previous class's rotation.
 */
export function resetXrReorientation(): void {
  baseSpace = null;
  appliedYawDeg = 0;
}

/**
 * Rotate the viewer's world by `yawDeg` about the vertical axis.
 *
 * Absolute, not relative: the offset is always computed from the base space, so
 * calling this repeatedly with the same value is a no-op rather than a spin.
 * Returns false when there is nothing to rotate — not presenting, or a runtime
 * without offset spaces.
 */
export function setXrYawOffset(renderer: XrLikeRenderer, yawDeg: number): boolean {
  const xr = renderer?.xr;
  if (!xr?.isPresenting || typeof xr.getReferenceSpace !== 'function') return false;
  if (typeof xr.setReferenceSpace !== 'function') return false;

  if (!baseSpace) {
    const current = xr.getReferenceSpace();
    if (!current) return false;
    baseSpace = current;
  }

  const offsetFn = (baseSpace as XRReferenceSpace).getOffsetReferenceSpace;
  if (typeof offsetFn !== 'function' || typeof XRRigidTransform === 'undefined') return false;

  try {
    // Negated: rotating the world one way turns the viewer the other.
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (-yawDeg * Math.PI) / 180
    );
    const offset = offsetFn.call(
      baseSpace,
      new XRRigidTransform(
        { x: 0, y: 0, z: 0, w: 1 },
        { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
      )
    );
    xr.setReferenceSpace(offset);
    appliedYawDeg = yawDeg;
    return true;
  } catch (err) {
    console.warn('[xrReorient] Could not offset the reference space:', err);
    return false;
  }
}

/**
 * Point the viewer at `targetYawDeg`, given where they are currently facing.
 *
 * The device pose is read from the live camera, so this accounts for the
 * student having turned their head since the last Direct.
 */
export function faceXrViewerTowards(
  renderer: XrLikeRenderer,
  currentHeadingDeg: number,
  targetYawDeg: number
): boolean {
  const delta = shortestAngleDelta(currentHeadingDeg, targetYawDeg);
  return setXrYawOffset(renderer, appliedYawDeg + delta);
}

/** Take the short way round so a Direct never spins the student the long way. */
function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}
