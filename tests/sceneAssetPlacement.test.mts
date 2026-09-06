/**
 * Regression tests for where a 3D asset lands in the three.js lesson player.
 *
 * Two bugs these pin down, both of which left a model floating above the dock
 * instead of resting on it:
 *
 * 1. The player's recentring offset was not multiplied by the normalising
 *    scale. A node's matrix is T * R * S, so the scale applies to the geometry
 *    and the translation is then added in the PARENT's space — an unscaled
 *    offset moves a model by its authored size rather than its rendered size.
 *    The error is exactly zero when scale is 1, which is why assets authored
 *    near 1 unit always looked right, and is metres wide for a model authored
 *    in centimetres.
 *
 * 2. placeAssetOnDock positioned by `dockSurfaceY + height / 2`, which assumes
 *    the group's origin sits at the centre of the geometry. True only for a
 *    model authored centred on its own origin; anything else was placed by its
 *    origin while the geometry hung somewhere else entirely.
 *
 * Run: npx tsx --test tests/sceneAssetPlacement.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../server/client/node_modules/three/build/three.module.js';

import { groundedOffset } from '../server/client/src/lib/three/groundedOffset.ts';
import { SceneLayoutSystem } from '../server/client/src/utils/webxr/sceneLayoutSystem.ts';

/** The player's own constants, so the test breaks if they drift apart. */
const NORMALIZED_SIZE = 1.0;
const GROUND_LEVEL = 0;

/** The dock configuration XRLessonPlayerV3 constructs. */
function makeLayout(): SceneLayoutSystem {
  return new SceneLayoutSystem(
    {
      assetDock: { distance: 0.7, height: 0.9, width: 1.8, depth: 0.8, maxAssetSize: 0.25 },
      introDock: { distance: 2.5, height: 1.2, width: 2.0, height_panel: 1.4, spacing: 1.5 },
      ground: { size: 20, gridDivisions: 20, fadeAngle: 30 },
    },
    'curved-arc'
  );
}

/**
 * Build an asset group the way the player does.
 *
 * `authoredSize` is the model's size in its own authored units — 1 for a glTF
 * exported in metres, 170 for the same model exported in centimetres. `originY`
 * is where the geometry sits relative to its own origin: -authoredSize/2 for a
 * centre-origin model, 0 for a bottom-origin one.
 */
function makeAssetGroup(authoredSize: number, originY: number): THREE.Group {
  const inner = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(authoredSize * 0.4, authoredSize, authoredSize * 0.4)
  );
  // Box geometry is centred on its own origin; shift it so the group's bottom
  // lands at originY, which is what varies between authoring tools.
  mesh.position.y = originY + authoredSize / 2;
  inner.add(mesh);

  // --- the player's normalisation, reproduced exactly ---
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? NORMALIZED_SIZE / maxDim : 1;
  inner.position.copy(groundedOffset(box, scale));
  inner.scale.setScalar(scale);

  const group = new THREE.Group();
  group.name = 'assetGroup_test';
  group.add(inner);
  group.position.set(0, 0, 0);
  return group;
}

/** Place one asset and report where its geometry actually ended up. */
function placeOne(group: THREE.Group) {
  const scene = new THREE.Scene();
  const assetsGroup = new THREE.Group();
  assetsGroup.name = 'assetsGroup';
  assetsGroup.add(group);
  scene.add(assetsGroup);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.position.set(0, 1.6, 0); // default: looking down -Z

  const layout = makeLayout();
  layout.createAssetDock(scene, camera, GROUND_LEVEL);
  const placements = layout.calculatePlacements(1, camera, GROUND_LEVEL);
  layout.placeAssetOnDock(group, placements[0], camera, GROUND_LEVEL, 1);

  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  return {
    box,
    center: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3()),
    placement: placements[0],
  };
}

test('a model authored in metres rests on the dock', () => {
  const { box, placement } = placeOne(makeAssetGroup(1, -0.5));
  assert.ok(
    Math.abs(box.min.y - placement.dockSurfaceY) < 1e-6,
    `bottom ${box.min.y} should sit on the dock surface ${placement.dockSurfaceY}`
  );
});

test('a model authored in centimetres lands in the same place, not metres above', () => {
  const metres = placeOne(makeAssetGroup(1, -0.5));
  const centimetres = placeOne(makeAssetGroup(170, -85));

  // The authoring unit must not survive normalisation at all: same size, same
  // spot. Before the fix this model sat ~85m up.
  assert.ok(
    Math.abs(centimetres.box.min.y - centimetres.placement.dockSurfaceY) < 1e-6,
    `bottom ${centimetres.box.min.y} should sit on the dock surface`
  );
  assert.ok(
    Math.abs(centimetres.size.y - metres.size.y) < 1e-6,
    `rendered height ${centimetres.size.y} should match ${metres.size.y}`
  );
  assert.ok(
    centimetres.center.distanceTo(metres.center) < 1e-6,
    'both should occupy the same slot'
  );
});

test('geometry far from its own origin still lands on the slot', () => {
  // A model whose geometry sits well above its origin — an export quirk the old
  // "origin is the centre" assumption could not survive.
  const { box, center, placement } = placeOne(makeAssetGroup(2, 40));

  assert.ok(
    Math.abs(box.min.y - placement.dockSurfaceY) < 1e-6,
    `bottom ${box.min.y} should sit on the dock surface ${placement.dockSurfaceY}`
  );
  assert.ok(
    Math.abs(center.x - placement.position.x) < 1e-6 &&
      Math.abs(center.z - placement.position.z) < 1e-6,
    'the geometry, not the origin, should be centred on the slot'
  );
});

test('every asset is scaled to the dock, whatever its authored units', () => {
  for (const [authored, originY] of [
    [1, -0.5],
    [170, -85],
    [0.01, 0],
  ] as const) {
    const { size } = placeOne(makeAssetGroup(authored, originY));
    const maxDim = Math.max(size.x, size.y, size.z);
    assert.ok(
      maxDim <= 0.25 + 1e-6,
      `authored at ${authored} units, rendered ${maxDim}m — must fit the 25cm dock allowance`
    );
  }
});

test('the recentring offset is scaled, so the geometry lands on the origin', () => {
  // A model authored in centimetres, centred on its own origin: 170 units tall
  // spanning y = -85..85, normalised down to 1 unit.
  const box = new THREE.Box3(
    new THREE.Vector3(-34, -85, -34),
    new THREE.Vector3(34, 85, 34)
  );
  const scale = 1 / 170;
  const offset = groundedOffset(box, scale);

  // Where the bottom of the geometry actually ends up: scaled, then translated.
  const bottomAfter = box.min.y * scale + offset.y;
  assert.ok(
    Math.abs(bottomAfter) < 1e-9,
    `bottom landed at ${bottomAfter}, should be 0`
  );

  // The unscaled offset the player used to apply, kept here as the thing this
  // guards against: it left the model 84.5 units up.
  const bottomBefore = box.min.y * scale + -box.min.y;
  assert.ok(bottomBefore > 84, `the old formula floated the model to ${bottomBefore}`);
});
