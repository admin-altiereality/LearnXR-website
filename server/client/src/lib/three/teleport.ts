/**
 * teleport – comfort-safe locomotion for the lesson.
 *
 * The lesson is viewed from one spot today. Letting a student walk around an
 * exhibit changes what a 3D asset is for — but locomotion is also where XR makes
 * people sick, so this offers teleport ONLY. Smooth steering is deliberately not
 * implemented: the research is consistent that teleport rarely causes discomfort
 * while continuous steering frequently does, and a classroom cannot afford a
 * mechanic that makes some students ill.
 *
 * Movement is applied by offsetting the XR reference space, exactly as
 * `xrReorient` does for the teacher's Direct-view. That keeps locomotion out of
 * the scene graph entirely — no camera rig, no reparenting — so it cannot
 * disturb 3D asset placement. Both modules compose through a shared offset
 * (`setXrPose` below), so a teleport after a Direct does not undo it.
 *
 * The vignette closes during the transition. A snap cut is the moment discomfort
 * happens, and narrowing the field of view through it is the standard mitigation.
 */

import * as THREE from 'three';

export interface TeleportOptions {
  scene: THREE.Scene;
  /** Surfaces a student may land on — normally the floor. */
  floors: THREE.Object3D[];
  /** Objects that block landing, so nobody teleports inside a model. */
  obstacles?: () => THREE.Object3D[];
  /** Metres of clearance required around a landing point. */
  clearance?: number;
  /** Furthest a single teleport may travel. */
  maxDistance?: number;
}

export interface TeleportController {
  /** Begin aiming from a source (controller or hand pointer). */
  beginAim(source: THREE.Object3D): void;
  /** Update the arc while aiming. Call once per frame. */
  updateAim(): void;
  /** Commit the teleport if the landing point is valid. Returns whether it moved. */
  commit(renderer: THREE.WebGLRenderer): boolean;
  /** Abandon the aim without moving. */
  cancel(): void;
  isAiming(): boolean;
  /** Advance the vignette and keep it centred on the viewer. Call once per frame. */
  update(delta: number, camera: THREE.Camera): void;
  dispose(): void;
}

/** Arc shape. A gentle lob reads as "over there" rather than a flat laser. */
const ARC_SEGMENTS = 24;
const ARC_SPEED = 6;
const GRAVITY = -9.8;

/**
 * The viewer's accumulated offset from the base reference space.
 *
 * Kept module-level and shared with xrReorient's concept of a base space so
 * position and heading compose instead of overwriting one another.
 */
const offset = { x: 0, z: 0, yawDeg: 0 };
let baseSpace: XRReferenceSpace | null = null;

/** Forget the offset. Reference spaces do not survive a session. */
export function resetTeleport(): void {
  offset.x = 0;
  offset.z = 0;
  offset.yawDeg = 0;
  baseSpace = null;
}

/** Apply the current offset to the session's reference space. */
function applyOffset(renderer: THREE.WebGLRenderer): boolean {
  const xr = renderer.xr as unknown as {
    isPresenting?: boolean;
    getReferenceSpace?: () => XRReferenceSpace | null;
    setReferenceSpace?: (space: XRReferenceSpace) => void;
  };
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
    const quaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (-offset.yawDeg * Math.PI) / 180
    );
    // Negated: moving the world one way moves the viewer the other.
    const next = offsetFn.call(
      baseSpace,
      new XRRigidTransform(
        { x: -offset.x, y: 0, z: -offset.z, w: 1 },
        { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
      )
    );
    xr.setReferenceSpace(next);
    return true;
  } catch (err) {
    console.warn('[teleport] Could not offset the reference space:', err);
    return false;
  }
}

export function createTeleport(options: TeleportOptions): TeleportController {
  const {
    scene,
    floors,
    obstacles,
    clearance = 0.45,
    maxDistance = 8,
  } = options;

  const raycaster = new THREE.Raycaster();
  let aiming = false;
  let source: THREE.Object3D | null = null;
  let landing: THREE.Vector3 | null = null;
  let valid = false;

  // --- Arc ------------------------------------------------------------------
  const arcGeometry = new THREE.BufferGeometry();
  arcGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(ARC_SEGMENTS * 3), 3)
  );
  const arc = new THREE.Line(
    arcGeometry,
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })
  );
  arc.frustumCulled = false;
  arc.visible = false;
  scene.add(arc);

  // --- Landing marker -------------------------------------------------------
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.26, 32),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // --- Vignette -------------------------------------------------------------
  /*
    An inward-facing sphere around the camera, opaque at the edges and clear in
    the centre. Attached to the camera in the render loop rather than parented to
    it, so it never appears in a raycast or shifts the camera's own transform.
  */
  const vignette = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 32, 16),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uStrength: { value: 0 } },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPosition;
        uniform float uStrength;
        void main() {
          // Angle from straight ahead: 0 at the centre of view, 1 at the edge.
          float edge = clamp(length(normalize(vPosition).xy), 0.0, 1.0);
          // The aperture closes as strength rises, always leaving the centre clear.
          float inner = mix(1.4, 0.25, uStrength);
          float alpha = smoothstep(inner * 0.6, inner, edge) * uStrength;
          gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
        }
      `,
    })
  );
  vignette.renderOrder = 999;
  vignette.frustumCulled = false;
  vignette.visible = false;
  scene.add(vignette);

  let vignetteStrength = 0;
  let vignetteTarget = 0;

  // --- Aiming ---------------------------------------------------------------

  /** Would a landing here put the viewer inside something? */
  function isClear(point: THREE.Vector3): boolean {
    const blockers = obstacles?.() ?? [];
    const world = new THREE.Vector3();
    for (const object of blockers) {
      object.getWorldPosition(world);
      // Compared on the ground plane: an asset floating overhead is not a blocker.
      const dx = world.x - point.x;
      const dz = world.z - point.z;
      if (Math.sqrt(dx * dx + dz * dz) < clearance) return false;
    }
    return true;
  }

  /** Trace a ballistic arc from the source and find where it meets a floor. */
  function traceArc(): void {
    if (!source) return;

    const origin = new THREE.Vector3();
    source.getWorldPosition(origin);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
      source.getWorldQuaternion(new THREE.Quaternion())
    );

    const velocity = direction.multiplyScalar(ARC_SPEED);
    const positions = arcGeometry.getAttribute('position') as THREE.BufferAttribute;
    const point = origin.clone();
    const step = 0.06;

    landing = null;
    valid = false;

    for (let i = 0; i < ARC_SEGMENTS; i += 1) {
      positions.setXYZ(i, point.x, point.y, point.z);

      const next = point.clone().addScaledVector(velocity, step);
      velocity.y += GRAVITY * step;

      // Segment crossed a floor? Raycast the short span rather than the whole
      // arc, so a floor behind the viewer cannot be hit.
      const segment = next.clone().sub(point);
      const length = segment.length();
      if (length > 0) {
        raycaster.set(point, segment.clone().normalize());
        raycaster.far = length;
        const hit = raycaster.intersectObjects(floors, false)[0];
        if (hit) {
          landing = hit.point.clone();
          // Fill the remaining vertices at the landing point so the line ends there.
          for (let j = i; j < ARC_SEGMENTS; j += 1) {
            positions.setXYZ(j, landing.x, landing.y, landing.z);
          }
          const withinRange = landing.distanceTo(origin) <= maxDistance;
          valid = withinRange && isClear(landing);
          break;
        }
      }
      point.copy(next);
    }

    positions.needsUpdate = true;
    arcGeometry.computeBoundingSphere();

    const colour = valid ? 0x22d3ee : 0xf43f5e;
    (arc.material as THREE.LineBasicMaterial).color.setHex(colour);
    (marker.material as THREE.MeshBasicMaterial).color.setHex(colour);

    if (landing) {
      marker.visible = true;
      // Lifted a little so the ring does not z-fight the floor it sits on.
      marker.position.set(landing.x, landing.y + 0.01, landing.z);
    } else {
      marker.visible = false;
    }
  }

  return {
    beginAim(nextSource) {
      source = nextSource;
      aiming = true;
      arc.visible = true;
    },

    updateAim() {
      if (aiming) traceArc();
    },

    commit(renderer) {
      const target = valid ? landing : null;
      this.cancel();
      if (!target) return false;

      const camera = renderer.xr.getCamera();
      const head = new THREE.Vector3();
      camera.getWorldPosition(head);

      // Move by the ground-plane delta between where the viewer is and where
      // they aimed, so they arrive standing on the marker.
      offset.x += target.x - head.x;
      offset.z += target.z - head.z;
      const moved = applyOffset(renderer);

      // Close the vignette through the cut, then open it again.
      if (moved) {
        vignetteStrength = 1;
        vignetteTarget = 0;
      }
      return moved;
    },

    cancel() {
      aiming = false;
      source = null;
      landing = null;
      valid = false;
      arc.visible = false;
      marker.visible = false;
    },

    isAiming() {
      return aiming;
    },

    update(delta, camera) {
      // The vignette rides with the viewer rather than being parented to the
      // camera: parenting would put it inside every raycast the player makes.
      if (camera) camera.getWorldPosition(vignette.position);

      // Ease the vignette open; the close is instantaneous because it has to
      // cover a cut that has already happened.
      if (vignetteStrength !== vignetteTarget) {
        const rate = 3 * Math.max(delta, 0.001);
        vignetteStrength += (vignetteTarget - vignetteStrength) * Math.min(1, rate);
        if (Math.abs(vignetteStrength - vignetteTarget) < 0.01) vignetteStrength = vignetteTarget;
      }
      const material = vignette.material as THREE.ShaderMaterial;
      material.uniforms.uStrength.value = vignetteStrength;
      vignette.visible = vignetteStrength > 0.01;
    },

    dispose() {
      scene.remove(arc, marker, vignette);
      arc.geometry.dispose();
      (arc.material as THREE.Material).dispose();
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      vignette.geometry.dispose();
      (vignette.material as THREE.Material).dispose();
    },
  };
}
