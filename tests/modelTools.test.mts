/**
 * Regression tests for the lesson player's explode / isolate / section tools.
 *
 * What these pin down is why the controls appeared to do nothing:
 *
 *   - Explode measured the model in WORLD space and then added that distance to
 *     mesh positions expressed in the model's AUTHORED units. For a model
 *     authored at metre scale the two happen to agree; for the same model
 *     exported in centimetres the parts moved a hundredth as far, which reads
 *     as a dead control.
 *   - The section plane was likewise built from world coordinates captured
 *     during loading — before the layout system scaled the model and moved it
 *     onto the dock — so it described a model that no longer existed and cut
 *     empty space beside the real one.
 *   - Parts were addressed by mesh name. Names are routinely blank or repeated
 *     across assets, so isolating one part dimmed or revealed the wrong pieces.
 *
 * Run: npx tsx --test tests/modelTools.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../server/client/node_modules/three/build/three.module.js';

import { createModelTools } from '../server/client/src/lib/three/modelTools.ts';

/**
 * A two-part model authored at `unit` scale, then scaled to a fixed rendered
 * size and placed in the room — exactly what the player does to every asset.
 *
 * `unit` is the authoring unit: 1 for a glTF exported in metres, 100 for the
 * same model exported in centimetres. The rendered result is identical in both
 * cases, which is the point — nothing downstream should be able to tell them
 * apart.
 */
function makeTwoPartModel(unit: number, at = new THREE.Vector3(0, 0.9, -1)) {
  const inner = new THREE.Group();
  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 * unit, 0.4 * unit, 0.4 * unit),
      new THREE.MeshBasicMaterial()
    );
    mesh.name = side < 0 ? 'left' : 'right';
    mesh.position.x = side * 0.5 * unit;
    inner.add(mesh);
  }
  // Normalise to a 1-unit model, as the loader does.
  inner.scale.setScalar(1 / unit);

  const root = new THREE.Group();
  root.name = `assetGroup_${unit}`;
  root.add(inner);
  root.position.copy(at);
  root.scale.setScalar(0.25); // the dock's fit-to-size scale
  return root;
}

/** World-space distance between the two parts of a model built above. */
function partSeparation(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const left = root.getObjectByName('left');
  const right = root.getObjectByName('right');
  assert.ok(left && right, 'both parts should exist');
  return left!
    .getWorldPosition(new THREE.Vector3())
    .distanceTo(right!.getWorldPosition(new THREE.Vector3()));
}

function sceneWith(...roots: THREE.Object3D[]) {
  const scene = new THREE.Scene();
  roots.forEach((root) => scene.add(root));
  scene.updateMatrixWorld(true);
  return scene;
}

test('explode separates the parts of a placed, scaled model', () => {
  const root = makeTwoPartModel(1);
  sceneWith(root);
  const before = partSeparation(root);

  const tools = createModelTools();
  tools.collect([root]);
  tools.explode(1);

  const after = partSeparation(root);
  assert.ok(after > before * 1.5, `parts should move apart: ${before} -> ${after}`);
});

test('explode moves parts the same distance whatever the authored units', () => {
  const metres = makeTwoPartModel(1);
  const centimetres = makeTwoPartModel(100);
  sceneWith(metres, centimetres);

  // Same rendered size to begin with — the authoring unit is already gone.
  assert.ok(
    Math.abs(partSeparation(metres) - partSeparation(centimetres)) < 1e-9,
    'the two models should render identically before any explode'
  );

  const tools = createModelTools();
  tools.collect([metres, centimetres]);
  tools.select(null); // act on everything
  tools.explode(1);

  const a = partSeparation(metres);
  const b = partSeparation(centimetres);
  // Before the fix the centimetre model moved a hundredth as far as the metre one.
  assert.ok(Math.abs(a - b) < 1e-6, `explode should be unit-agnostic: ${a} vs ${b}`);
});

test('explode returns exactly home, with no drift across repeated calls', () => {
  const root = makeTwoPartModel(1);
  sceneWith(root);
  const home = partSeparation(root);

  const tools = createModelTools();
  tools.collect([root]);
  for (let i = 0; i < 20; i += 1) {
    tools.explode(Math.random());
  }
  tools.explode(0);

  assert.ok(
    Math.abs(partSeparation(root) - home) < 1e-9,
    'repeated explodes must not accumulate drift'
  );
});

test('explode acts only on the selected asset', () => {
  const a = makeTwoPartModel(1, new THREE.Vector3(-0.5, 0.9, -1));
  const b = makeTwoPartModel(1, new THREE.Vector3(0.5, 0.9, -1));
  sceneWith(a, b);
  const untouched = partSeparation(b);

  const tools = createModelTools();
  tools.collect([a, b]);
  tools.select(a.name);
  tools.explode(1);

  assert.ok(partSeparation(a) > untouched * 1.5, 'the selected asset should come apart');
  assert.ok(
    Math.abs(partSeparation(b) - untouched) < 1e-9,
    'the other asset should be left alone'
  );
});

test('the part count follows the selection, not the whole scene', () => {
  const a = makeTwoPartModel(1);
  const b = makeTwoPartModel(1, new THREE.Vector3(0.5, 0.9, -1));
  const tools = createModelTools();
  tools.collect([sceneWith(a, b) && a, b]);

  tools.select(null);
  assert.equal(tools.partCount(), 4, 'with nothing selected, every part counts');
  tools.select(a.name);
  assert.equal(tools.partCount(), 2, 'with one asset selected, only its parts count');
});

test('a part is addressed by id, so repeated mesh names cannot cross assets', () => {
  const a = makeTwoPartModel(1);
  const b = makeTwoPartModel(1, new THREE.Vector3(0.5, 0.9, -1));
  sceneWith(a, b);

  const tools = createModelTools();
  tools.collect([a, b]);
  const ids = tools.list();
  assert.equal(ids.length, 2, 'both assets should be listed');
  // These two roots deliberately carry the SAME name. Keys address a model in
  // published state, so they still have to come out distinct.
  assert.notEqual(ids[0].key, ids[1].key, 'colliding names must still yield distinct keys');

  // Both models also contain a mesh called "left"; isolating one must not light
  // up the other, which is exactly what addressing by name did.
  const target = `${ids[0].key}#0`;
  tools.isolate(target, true);

  const isolated = a.getObjectByName('left') as THREE.Mesh;
  const namesake = b.getObjectByName('left') as THREE.Mesh;
  assert.equal(
    (isolated.material as THREE.Material).opacity,
    1,
    'the isolated part stays at full strength'
  );
  assert.ok(
    (namesake.material as THREE.Material).opacity < 0.5,
    'the same-named part of the other asset is dimmed'
  );

  tools.isolate(null, false);
  assert.equal(
    (namesake.material as THREE.Material).opacity,
    1,
    'clearing the isolation restores every part'
  );
});

test('the section plane cuts through the model where it actually stands', () => {
  const at = new THREE.Vector3(1.2, 0.9, -2);
  const root = makeTwoPartModel(1, at);
  sceneWith(root);

  const tools = createModelTools();
  tools.collect([root]);
  tools.clip('y', 0, null);

  const mesh = root.getObjectByName('left') as THREE.Mesh;
  const planes = (mesh.material as THREE.Material).clippingPlanes;
  assert.ok(planes && planes.length === 1, 'a clipping plane should be applied');

  // Offset 0 means "through the centre", and the centre is where the model is
  // NOW — not where it was before the layout system moved it onto the dock.
  const worldCentre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  assert.ok(
    Math.abs(planes![0].distanceToPoint(worldCentre)) < 1e-6,
    `the cut should pass through the model's own centre, ${planes![0].distanceToPoint(worldCentre)} away`
  );
});

test('a moved model keeps its cut', () => {
  const root = makeTwoPartModel(1);
  sceneWith(root);

  const tools = createModelTools();
  tools.collect([root]);
  tools.clip('y', 0, null);

  // As if a student picked the model up and carried it.
  root.position.add(new THREE.Vector3(0.7, 0.3, 0.4));
  root.updateMatrixWorld(true);
  tools.update();

  const mesh = root.getObjectByName('left') as THREE.Mesh;
  const planes = (mesh.material as THREE.Material).clippingPlanes;
  const worldCentre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  assert.ok(
    Math.abs(planes![0].distanceToPoint(worldCentre)) < 1e-6,
    'the cut should travel with the model'
  );
});

test('a single-piece model is left alone', () => {
  const root = new THREE.Group();
  root.name = 'assetGroup_solo';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = 'whole';
  root.add(mesh);
  sceneWith(root);
  const home = mesh.position.clone();

  const tools = createModelTools();
  tools.collect([root]);
  tools.explode(1);

  assert.ok(
    mesh.position.distanceTo(home) < 1e-9,
    'moving the only mesh would just relocate the model'
  );
  assert.equal(tools.partCount(), 1, 'one part means nothing to take apart');
});
