/**
 * attachAssetsGroup – put the lesson's models in the scene, and make sure there
 * is only ever one set of them.
 *
 * The player's asset loader is asynchronous and its effect can re-run before a
 * load finishes — entering VR was enough to trigger it. The group was added to
 * the scene only at the very end of the load, so a superseded run still added
 * ITS group when it eventually completed, alongside the one that replaced it.
 * Two groups, each holding a full set of models, and the same asset visibly in
 * the room twice.
 *
 * It survived every attempt to clean up because the cleanup used
 * `scene.getObjectByName('assetsGroup')`, which returns the FIRST match and has
 * no idea a second one exists. And only one of the two was ever recorded in the
 * id -> group map, which is why exactly one copy answered Explode, Isolate and
 * Section while its twin sat there ignoring everything.
 *
 * Attaching through this function makes the invariant structural rather than a
 * thing every call site has to remember: whatever was there is removed and
 * freed first, however many of them there were.
 */

import * as THREE from 'three';

import { disposeObject3D } from '../lesson/lessonSwap';

export const ASSETS_GROUP_NAME = 'assetsGroup';

/**
 * Attach `group` as the scene's one and only assets group.
 *
 * Returns how many previous groups were displaced. Anything above zero on a
 * first load means a load raced with another one, which is worth logging: it is
 * invisible in the scene once this function has done its job, and that is
 * exactly what made it hard to find.
 */
export function attachAssetsGroup(
  scene: THREE.Scene | null,
  group: THREE.Object3D | null
): number {
  if (!scene || !group) return 0;

  // Every one of them, not the first. Collected before removing, since removal
  // mutates the array being searched.
  const existing = scene.children.filter(
    (child) => child !== group && child.name === ASSETS_GROUP_NAME
  );

  for (const stale of existing) {
    // Freed, not just detached. These hold GLB buffers and textures that no
    // longer have any way of being reached.
    disposeObject3D(stale);
  }

  group.name = ASSETS_GROUP_NAME;
  if (group.parent !== scene) scene.add(group);

  return existing.length;
}

/**
 * Free a group that was loaded but is no longer wanted.
 *
 * For a load that finished after being superseded: its models were built and
 * must be released, but they were never attached to anything, so nothing else
 * will ever come looking for them.
 */
export function discardAssetsGroup(group: THREE.Object3D | null): void {
  if (!group) return;
  for (const child of [...group.children]) disposeObject3D(child);
  disposeObject3D(group);
}
