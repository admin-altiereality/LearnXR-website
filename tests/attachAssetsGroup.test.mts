/**
 * Regression tests for the scene holding exactly one set of lesson models.
 *
 * The bug: the player's asset loader is asynchronous and its effect re-ran when
 * a WebXR session started. The loaded group was added to the scene only at the
 * very end of the load, so a run that had already been superseded still added
 * ITS group when it finally finished, alongside the one that replaced it. Two
 * groups, each with a full set of models, and the same asset visibly in the room
 * twice.
 *
 * It hid from every cleanup because those used
 * `scene.getObjectByName('assetsGroup')`, which returns the first match and
 * cannot see a second. And only one of the two ended up in the id -> group map,
 * which is why exactly one copy answered Explode, Isolate and Section while its
 * twin ignored everything.
 *
 * Run: npx tsx --test tests/attachAssetsGroup.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../server/client/node_modules/three/build/three.module.js';

import {
  ASSETS_GROUP_NAME,
  attachAssetsGroup,
  discardAssetsGroup,
} from '../server/client/src/lib/three/attachAssetsGroup.ts';

/** A group of models with disposal counted, as a real load would produce. */
function makeLoadedGroup(label: string) {
  const disposed = { geometries: 0, textures: 0 };
  const group = new THREE.Group();
  group.name = ASSETS_GROUP_NAME;

  for (let i = 0; i < 2; i += 1) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const originalGeo = geometry.dispose.bind(geometry);
    geometry.dispose = () => {
      disposed.geometries += 1;
      originalGeo();
    };

    const texture = new THREE.Texture();
    const originalTex = texture.dispose.bind(texture);
    texture.dispose = () => {
      disposed.textures += 1;
      originalTex();
    };

    const material = new THREE.MeshStandardMaterial();
    material.map = texture;

    const model = new THREE.Group();
    model.name = `assetGroup_${label}_${i}`;
    model.add(new THREE.Mesh(geometry, material));
    group.add(model);
  }

  return { group, disposed };
}

/** A scene with the fixtures that belong to the room rather than the lesson. */
function makeScene() {
  const scene = new THREE.Scene();
  const dock = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshBasicMaterial());
  dock.name = 'assetDock';
  scene.add(dock);
  scene.add(new THREE.DirectionalLight());
  const ground = new THREE.Group();
  ground.name = 'groundPlane';
  scene.add(ground);
  return { scene, dock, ground };
}

const assetGroupsIn = (scene: THREE.Scene) =>
  scene.children.filter((child) => child.name === ASSETS_GROUP_NAME);

test('two loads reaching the scene leave one set of models, not two', () => {
  const { scene } = makeScene();
  const first = makeLoadedGroup('first');
  const second = makeLoadedGroup('second');

  attachAssetsGroup(scene, first.group);
  const displaced = attachAssetsGroup(scene, second.group);

  assert.equal(displaced, 1, 'the earlier group should be reported displaced');
  assert.equal(assetGroupsIn(scene).length, 1, 'exactly one assets group in the scene');
  assert.equal(assetGroupsIn(scene)[0], second.group, 'the newer load wins');
});

test('the displaced group is freed, not merely detached', () => {
  const { scene } = makeScene();
  const first = makeLoadedGroup('first');
  const second = makeLoadedGroup('second');

  attachAssetsGroup(scene, first.group);
  attachAssetsGroup(scene, second.group);

  assert.equal(first.disposed.geometries, 2, 'both models of the old load are freed');
  assert.equal(first.disposed.textures, 2);
  assert.equal(second.disposed.geometries, 0, 'the surviving load is untouched');
});

test('even three racing loads collapse to one', () => {
  // getObjectByName finds only the first match, which is how a second group went
  // unnoticed for so long. Filtering has to catch every one of them.
  const { scene } = makeScene();
  const groups = ['a', 'b', 'c'].map(makeLoadedGroup);

  // Two arrive without going through attach, as the old code did.
  scene.add(groups[0].group);
  scene.add(groups[1].group);
  assert.equal(assetGroupsIn(scene).length, 2, 'the situation being repaired');

  const displaced = attachAssetsGroup(scene, groups[2].group);
  assert.equal(displaced, 2, 'both stale groups displaced');
  assert.equal(assetGroupsIn(scene).length, 1);
});

test('the room is left alone', () => {
  const { scene, dock, ground } = makeScene();
  attachAssetsGroup(scene, makeLoadedGroup('first').group);
  attachAssetsGroup(scene, makeLoadedGroup('second').group);

  assert.equal(dock.parent, scene, 'the dock is not a lesson asset');
  assert.equal(ground.parent, scene, 'nor is the ground');
  assert.ok(
    scene.children.some((c) => (c as THREE.Light).isLight),
    'nor the lighting'
  );
});

test('re-attaching the same group is a no-op, not self-destruction', () => {
  const { scene } = makeScene();
  const only = makeLoadedGroup('only');

  attachAssetsGroup(scene, only.group);
  const displaced = attachAssetsGroup(scene, only.group);

  assert.equal(displaced, 0, 'a group must not displace itself');
  assert.equal(assetGroupsIn(scene).length, 1);
  assert.equal(only.disposed.geometries, 0, 'and must not free its own models');
});

test('a superseded load is discarded without ever touching the scene', () => {
  // The exact sequence that caused the duplicate: run 1 finishes last, after
  // run 2 has already attached. Run 1 discards instead of adding.
  const { scene } = makeScene();
  const stale = makeLoadedGroup('stale');
  const current = makeLoadedGroup('current');

  attachAssetsGroup(scene, current.group);
  discardAssetsGroup(stale.group);

  assert.equal(assetGroupsIn(scene).length, 1, 'the stale load never arrives');
  assert.equal(assetGroupsIn(scene)[0], current.group);
  assert.equal(stale.disposed.geometries, 2, 'and its models are freed');
  assert.equal(stale.disposed.textures, 2);
});

test('nulls are tolerated', () => {
  const { scene } = makeScene();
  assert.equal(attachAssetsGroup(null, makeLoadedGroup('x').group), 0);
  assert.equal(attachAssetsGroup(scene, null), 0);
  discardAssetsGroup(null);
});
