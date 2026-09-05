/**
 * lookControls – drag-to-look for a camera that sits at the origin.
 *
 * XRLessonPlayerV3 previously had no camera control at all outside a headset:
 * the camera was fixed and only WebXR head tracking moved it, so on a laptop or
 * a phone the lesson could only ever be seen from one angle. This adds pointer
 * drag for yaw/pitch and wheel for field of view.
 *
 * Deliberately not OrbitControls: that orbits a camera *around* a target, and
 * this camera stays at the centre of the skybox and rotates in place. It also
 * has to yield completely while a WebXR session is presenting — the headset
 * owns the pose then, and fighting it is instant motion sickness.
 *
 * Angles use the same convention as `lib/classroom/viewSync` so the values can
 * go straight onto `teacher_view`.
 */

import * as THREE from 'three';
import { applyHVToCameraRotation, cameraRotationToHV } from '../classroom/viewSync';

export interface LookControlsOptions {
  camera: THREE.PerspectiveCamera;
  /** Element that receives pointer events — normally the renderer canvas. */
  domElement: HTMLElement;
  /** True while a WebXR session is presenting; controls stand down. */
  isPresenting?: () => boolean;
  /** Fired after the view actually changes (throttling is the caller's business). */
  onChange?: (h: number, v: number, fov: number) => void;
  /** Degrees of rotation per pixel dragged. */
  rotateSpeed?: number;
  /** Pitch clamp, degrees from the horizon. Stops the view flipping over the pole. */
  maxPitchDeg?: number;
  minFov?: number;
  maxFov?: number;
  /** 0 = no smoothing, approaching 1 = very slow. */
  damping?: number;
  /** Pixels of movement before a gesture counts as a drag rather than a tap. */
  dragThresholdPx?: number;
}

export interface LookControls {
  /** Advance damping and commit the camera. Call once per frame. */
  update(): void;
  /** Current view, or null once disposed. */
  read(): { h: number; v: number; fov: number } | null;
  /** Point the camera. `immediate` skips damping (used for a teacher Direct). */
  apply(h: number, v: number, fov?: number, immediate?: boolean): void;
  /** True while the user is mid-drag — useful for suppressing follow. */
  isDragging(): boolean;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createLookControls(options: LookControlsOptions): LookControls {
  const {
    camera,
    domElement,
    isPresenting,
    onChange,
    rotateSpeed = 0.13,
    maxPitchDeg = 85,
    minFov = 30,
    maxFov = 100,
    damping = 0.18,
    dragThresholdPx = 3,
  } = options;

  const start = cameraRotationToHV(camera);
  let targetH = start.h;
  let targetV = start.v;
  let currentH = start.h;
  let currentV = start.v;
  let targetFov = camera.fov;

  let enabled = true;
  let disposed = false;
  let dragging = false;
  let moved = false;
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const active = () => enabled && !disposed && !(isPresenting?.() ?? false);

  const onPointerDown = (event: PointerEvent) => {
    if (!active() || event.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || pointerId !== event.pointerId || !active()) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (!moved && Math.hypot(dx, dy) < dragThresholdPx) return;
    // Only capture once the gesture is a real drag, so a tap still reaches the
    // raycast handler that drives the in-scene UI buttons.
    if (!moved) {
      moved = true;
      try {
        domElement.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
    }
    lastX = event.clientX;
    lastY = event.clientY;
    // Dragging right should swing the view left, as in every panorama viewer.
    targetH -= dx * rotateSpeed;
    targetV = clamp(targetV - dy * rotateSpeed, -maxPitchDeg, maxPitchDeg);
  };

  const endDrag = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (moved) {
      try {
        domElement.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragging = false;
    moved = false;
    pointerId = null;
  };

  const onWheel = (event: WheelEvent) => {
    if (!active()) return;
    event.preventDefault();
    targetFov = clamp(targetFov + Math.sign(event.deltaY) * 3, minFov, maxFov);
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', endDrag);
  domElement.addEventListener('pointercancel', endDrag);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  let lastEmitted: { h: number; v: number; fov: number } | null = null;

  return {
    update() {
      if (disposed) return;
      // In a headset the XR camera pose is authoritative; touching rotation or
      // fov here would fight head tracking and re-project the whole scene.
      if (isPresenting?.()) return;

      const t = damping <= 0 ? 1 : Math.min(1, damping);
      currentH += shortestAngleDelta(currentH, targetH) * t;
      currentV += (targetV - currentV) * t;
      applyHVToCameraRotation(camera, currentH, currentV);

      if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov += (targetFov - camera.fov) * t;
        camera.updateProjectionMatrix();
      }

      if (!onChange) return;
      const next = { h: currentH, v: currentV, fov: camera.fov };
      if (
        lastEmitted &&
        Math.abs(lastEmitted.h - next.h) < 0.01 &&
        Math.abs(lastEmitted.v - next.v) < 0.01 &&
        Math.abs(lastEmitted.fov - next.fov) < 0.01
      ) {
        return;
      }
      lastEmitted = next;
      onChange(next.h, next.v, next.fov);
    },

    read() {
      if (disposed) return null;
      return { h: currentH, v: currentV, fov: camera.fov };
    },

    apply(h, v, fov, immediate = false) {
      if (disposed) return;
      targetH = h;
      targetV = clamp(v, -maxPitchDeg, maxPitchDeg);
      if (typeof fov === 'number' && Number.isFinite(fov)) {
        targetFov = clamp(fov, minFov, maxFov);
      }
      if (immediate) {
        currentH = targetH;
        currentV = targetV;
        // Never move the camera in a headset, even for a Direct — the pose comes
        // from the device. The caller realigns by other means there.
        if (!isPresenting?.()) {
          applyHVToCameraRotation(camera, currentH, currentV);
          camera.fov = targetFov;
          camera.updateProjectionMatrix();
        }
      }
    },

    isDragging() {
      return dragging && moved;
    },

    setEnabled(next) {
      enabled = next;
      if (!next) {
        dragging = false;
        moved = false;
        pointerId = null;
      }
    },

    dispose() {
      disposed = true;
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', endDrag);
      domElement.removeEventListener('pointercancel', endDrag);
      domElement.removeEventListener('wheel', onWheel);
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Take the short way round so crossing +/-180 does not spin the view. */
function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}
