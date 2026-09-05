/**
 * inkLayer – the teacher's marker, drawn as real geometry inside the skybox.
 *
 * The krpano player renders ink as an SVG layer over the panorama (see
 * `Components/player/AnnotationOverlay`), which works on a screen but is
 * invisible in a headset — a DOM overlay has nowhere to live in an immersive
 * session. XRLessonPlayerV3 draws the same strokes as tube geometry on a sphere
 * just inside the skybox, so a student sees the teacher's marker whether they
 * are on a laptop or wearing a Quest.
 *
 * The stroke format is unchanged: points are sphere coordinates (`a` = ath,
 * `v` = atv) exactly as `lib/annotations/sphereGeometry` and the Firestore
 * documents already define them, so the teacher can draw in either player and
 * both render it.
 */

import * as THREE from 'three';
import type { AnnotationStroke, TeacherAnnotations } from '../../types/lms';
import { annotationNow, isStrokeExpired, laserOpacity, splitAtSeam } from './sphereGeometry';

/** Just inside the 500-unit skybox, so ink never z-fights the sky. */
const INK_RADIUS = 480;
/** Stroke width is authored against a 90 degree fov; scale from there. */
const REFERENCE_FOV = 90;
const WIDTH_SCALE = 0.9;

export interface InkLayer {
  /** Replace what is drawn. Cheap to call on every annotation snapshot. */
  setAnnotations(annotations: TeacherAnnotations | null | undefined): void;
  /** The teacher's own in-progress stroke, drawn before it is published. */
  setLocalStroke(stroke: AnnotationStroke | null): void;
  /** Re-evaluate laser fade. Call once per frame; cheap when nothing is fading. */
  update(): void;
  /** Screen point (NDC) -> sphere coordinates, for drawing with a mouse. */
  pointerToSphere(ndcX: number, ndcY: number, camera: THREE.Camera): { a: number; v: number } | null;
  /** Controller ray -> sphere coordinates, for drawing in a headset. */
  rayToSphere(origin: THREE.Vector3, direction: THREE.Vector3): { a: number; v: number } | null;
  dispose(): void;
}

/** Sphere coordinates (degrees) to a point on the ink sphere. */
export function sphereToVector(a: number, v: number, radius = INK_RADIUS): THREE.Vector3 {
  const ath = (a * Math.PI) / 180;
  const atv = (v * Math.PI) / 180;
  // Matches lib/classroom/viewSync: ath 0 looks down -Z, atv positive is down.
  const cosV = Math.cos(atv);
  return new THREE.Vector3(
    -radius * cosV * Math.sin(ath),
    -radius * Math.sin(atv),
    -radius * cosV * Math.cos(ath)
  );
}

/** The inverse: a direction to sphere coordinates in degrees. */
export function vectorToSphere(direction: THREE.Vector3): { a: number; v: number } {
  const d = direction.clone().normalize();
  return {
    a: (Math.atan2(-d.x, -d.z) * 180) / Math.PI,
    v: (-Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI,
  };
}

export function createInkLayer(options: {
  scene: THREE.Scene;
  /** Read to scale stroke width with zoom, so ink stays visually consistent. */
  getFov?: () => number;
}): InkLayer {
  const { scene, getFov } = options;
  const group = new THREE.Group();
  group.name = 'teacherInk';
  // Ink sits on top of the sky and any asset behind it, but must not block the
  // raycasts that drive the lesson panel and the 3D assets.
  group.renderOrder = 10;
  scene.add(group);

  const raycaster = new THREE.Raycaster();
  let annotations: TeacherAnnotations | null = null;
  let localStroke: AnnotationStroke | null = null;
  let disposed = false;
  /** Meshes for laser strokes, kept so `update` can fade them without a rebuild. */
  const fading: Array<{ mesh: THREE.Mesh; stroke: AnnotationStroke }> = [];

  const clearGroup = () => {
    fading.length = 0;
    for (let i = group.children.length - 1; i >= 0; i -= 1) {
      const child = group.children[i] as THREE.Mesh;
      group.remove(child);
      child.geometry?.dispose();
      const material = child.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    }
  };

  const buildStroke = (stroke: AnnotationStroke): void => {
    // Split where the stroke crosses the +/-180 seam, or the tube smears all the
    // way round the sphere between the two points either side of it.
    const segments = splitAtSeam(stroke.points);
    const fov = getFov?.() ?? REFERENCE_FOV;
    const radius = (stroke.width * WIDTH_SCALE * (REFERENCE_FOV / Math.max(1, fov)) * INK_RADIUS) / 1000;

    segments.forEach((points) => {
      if (points.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(points.map((p) => sphereToVector(p.a, p.v)));
      const geometry = new THREE.TubeGeometry(
        curve,
        Math.min(128, Math.max(8, points.length * 3)),
        radius,
        6,
        false
      );
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(stroke.color),
        transparent: true,
        opacity: stroke.mode === 'laser' ? laserOpacity(stroke) : 1,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 11;
      // Ink is decoration, never a hit target: leaving it raycastable would let a
      // stroke swallow clicks meant for the lesson panel behind it.
      mesh.raycast = () => {};
      group.add(mesh);
      if (stroke.mode === 'laser') fading.push({ mesh, stroke });
    });
  };

  const rebuild = () => {
    if (disposed) return;
    clearGroup();
    const now = annotationNow();
    annotations?.strokes?.forEach((stroke) => {
      if (stroke?.points?.length) buildStroke(stroke);
    });
    const laser = annotations?.laser;
    if (laser?.points?.length && !isStrokeExpired(laser, now)) buildStroke(laser);
    if (localStroke?.points?.length) buildStroke(localStroke);
  };

  return {
    setAnnotations(next) {
      annotations = next ?? null;
      rebuild();
    },

    setLocalStroke(stroke) {
      localStroke = stroke;
      rebuild();
    },

    update() {
      if (disposed || fading.length === 0) return;
      const now = annotationNow();
      let expired = false;
      fading.forEach(({ mesh, stroke }) => {
        const opacity = laserOpacity(stroke, now);
        (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        if (opacity <= 0.01) expired = true;
      });
      // Drop fully faded strokes rather than paying for them every frame.
      if (expired) rebuild();
    },

    pointerToSphere(ndcX, ndcY, camera) {
      if (disposed) return null;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      return vectorToSphere(raycaster.ray.direction);
    },

    rayToSphere(_origin, direction) {
      if (disposed) return null;
      return vectorToSphere(direction);
    },

    dispose() {
      clearGroup();
      scene.remove(group);
      disposed = true;
    },
  };
}
