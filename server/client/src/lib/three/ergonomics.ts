/**
 * ergonomics – where the desk and the panels belong for the person actually wearing
 * the headset.
 *
 * The player used to place everything from standing-adult constants: a dock at
 * 0.9m and a panel at 1.6m above the floor. Students take these lessons sitting
 * at classroom desks, where the eye line is around 1.2m rather than 1.6m — so
 * the model sat at chest height and the lesson panel floated above the top of
 * the field of view, which is both uncomfortable and, over a lesson, a neck
 * strain.
 *
 * Rather than a seated mode and a standing mode to keep in sync, everything is
 * derived from the viewer's own eye height. WebXR's default `local-floor`
 * reference space puts Y=0 on the physical floor, so the headset's Y IS the
 * user's real eye height, measured rather than assumed — a seated student, a
 * standing teacher and a short child each get a layout that fits them, with no
 * mode to select and nothing to configure.
 *
 * The two drops below are the whole model. They hold across seated and standing
 * because human proportions do: a seated adult's eye sits ~1.20m up and their
 * desk at ~0.73m; standing, ~1.60m and a worktop at ~1.10m. Both are close
 * enough to a 0.47m drop that one constant serves.
 */

import * as THREE from 'three';

/**
 * Eye to work surface. A desk you look down at comfortably sits a little under
 * half a metre below the eye, seated or standing.
 */
export const DESK_DROP = 0.47;

/**
 * Eye to the centre of a reading panel. Slightly below the horizontal: the neck
 * rests in a fractionally downward gaze, and never in an upward one.
 */
export const PANEL_DROP = 0.12;

/** Anything outside this is a tracking glitch, not a person. */
const MIN_EYE_HEIGHT = 0.9;
const MAX_EYE_HEIGHT = 2.1;

/** Used before a headset reports anything: a standing adult at a desktop. */
export const DEFAULT_EYE_HEIGHT = 1.6;

export interface ViewerLayout {
  eyeHeight: number;
  /** Y of the dock surface — where a model's feet go. */
  dockHeight: number;
  /** Y of the centre of the lesson panel. */
  panelHeight: number;
}

/**
 * The viewer's eye height above the floor.
 *
 * Returns the default rather than a bad number when the camera has not been
 * positioned yet, or reports something no human could be: a headset that has
 * lost tracking briefly reads Y=0, and laying the room out on the floor because
 * of one bad frame is far worse than being 20cm off for a moment.
 */
export function measureEyeHeight(camera: THREE.Camera | null, groundY = 0): number {
  if (!camera) return DEFAULT_EYE_HEIGHT;
  const world = camera.getWorldPosition(new THREE.Vector3());
  const height = world.y - groundY;
  if (!Number.isFinite(height) || height < MIN_EYE_HEIGHT || height > MAX_EYE_HEIGHT) {
    return DEFAULT_EYE_HEIGHT;
  }
  return height;
}

/** Dock and panel heights for a viewer whose eyes are at `eyeHeight`. */
export function layoutForEyeHeight(eyeHeight: number, groundY = 0): ViewerLayout {
  const eye = Number.isFinite(eyeHeight) ? eyeHeight : DEFAULT_EYE_HEIGHT;
  return {
    eyeHeight: eye,
    // Never below the floor: a very short viewer still needs a surface to put
    // the model on, even if it ends up closer to their chin than a desk would.
    dockHeight: Math.max(groundY + 0.3, groundY + eye - DESK_DROP),
    panelHeight: groundY + eye - PANEL_DROP,
  };
}

/** Convenience: measure the camera and derive the layout in one step. */
export function layoutForViewer(camera: THREE.Camera | null, groundY = 0): ViewerLayout {
  return layoutForEyeHeight(measureEyeHeight(camera, groundY), groundY);
}
