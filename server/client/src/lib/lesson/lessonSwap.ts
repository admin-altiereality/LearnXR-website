/**
 * lessonSwap – releasing one topic's content so the next can take its place,
 * without touching the renderer or the XR session.
 *
 * A chapter is several topics, and a class used to leave the headset between
 * every one of them: launching a topic navigates, navigation remounts the
 * player, and the remount disposes the renderer and ends the session. Six topics
 * meant six re-entries into VR, each one a dialog, a re-grant and a lost sense
 * of place.
 *
 * Keeping the session means the scene has to be emptied and refilled in place,
 * which puts the burden on this module: everything a topic added has to be
 * given back. Three.js frees nothing on its own — dropping a reference to a
 * loaded GLB leaves its buffers and textures resident on the GPU, so a chapter
 * played end to end without disposal is a Quest running out of memory partway
 * through, long after the mistake was made and nowhere near it.
 *
 * What is deliberately NOT released here: the renderer, the canvas, the XR
 * session and its reference space, the camera rig, the hands and controllers,
 * the lights, the ground and the dock. Those belong to the room, not to the
 * lesson, and their survival is the entire point.
 */

import * as THREE from 'three';

/** Frees a material and the textures it holds. */
function disposeMaterial(material: THREE.Material | null | undefined): void {
  if (!material) return;
  // Every texture-bearing slot a glTF material can populate. Missed slots are
  // invisible until a long session runs out of memory, so this errs on the side
  // of naming too many.
  const slots = [
    'map',
    'lightMap',
    'aoMap',
    'emissiveMap',
    'bumpMap',
    'normalMap',
    'displacementMap',
    'roughnessMap',
    'metalnessMap',
    'alphaMap',
    'envMap',
    'specularMap',
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
    'sheenColorMap',
    'sheenRoughnessMap',
    'transmissionMap',
    'thicknessMap',
    'iridescenceMap',
  ];
  for (const slot of slots) {
    const texture = (material as any)[slot];
    if (texture && typeof texture.dispose === 'function') texture.dispose();
  }
  material.dispose();
}

/**
 * Free an object and everything under it, and detach it from its parent.
 *
 * Safe to call on an object already removed, and on one whose meshes share
 * materials — `dispose` is idempotent in three.js.
 */
export function disposeObject3D(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) disposeMaterial(material);
  });
  root.parent?.remove(root);
}

export interface LessonContentRefs {
  scene: THREE.Scene | null;
  /** The group every loaded asset is parented to. Emptied, not removed. */
  assetsGroup: THREE.Object3D | null;
  /** id -> asset group. Cleared. */
  assetRefs: Map<string, THREE.Object3D>;
  /** Animation mixers driving the outgoing models. */
  mixers: THREE.AnimationMixer[];
  /** Cleared so the tools do not hold references to freed geometry. */
  modelTools: { dispose(): void } | null;
  /**
   * Teacher marks, which belong to the topic they were drawn on. Cleared through
   * the layer's own API rather than torn down: the ink sphere itself is part of
   * the room and survives the swap, only what is drawn on it does not.
   */
  inkLayer: {
    setAnnotations(annotations: null): void;
    setMarkTargets(targets: Map<string, THREE.Object3D>): void;
  } | null;
  /** Narration for the outgoing topic. */
  narration: { stop(): void } | null;
}

/**
 * Release everything belonging to the current topic.
 *
 * Order matters: the tools and the ink layer are dropped BEFORE the geometry
 * they point at, so nothing is left holding a reference to a freed buffer.
 * Returns the number of asset groups released, which is worth logging — a count
 * that does not match what was loaded is the first sign of a leak.
 */
export function disposeLessonContent(refs: LessonContentRefs): number {
  // Silence first: audio outlives the scene otherwise, and a student would hear
  // the previous topic narrating over the new one.
  refs.narration?.stop();

  // Drop the referrers before the referents.
  refs.modelTools?.dispose();
  refs.inkLayer?.setAnnotations(null);
  // Marks are parented to the models they were placed on, so the targets have to
  // go with them or the layer keeps the freed geometry alive.
  refs.inkLayer?.setMarkTargets(new Map());

  for (const mixer of refs.mixers) {
    mixer.stopAllAction();
    // uncacheRoot releases the clip bindings the mixer holds on the model.
    const root = mixer.getRoot() as THREE.Object3D;
    if (root) mixer.uncacheRoot(root as any);
  }
  refs.mixers.length = 0;

  let released = 0;
  const group = refs.assetsGroup;
  if (group) {
    // Copy first: disposeObject3D detaches from the parent, and mutating the
    // array being iterated skips every other child.
    for (const child of [...group.children]) {
      disposeObject3D(child);
      released += 1;
    }
  }
  refs.assetRefs.clear();

  return released;
}
