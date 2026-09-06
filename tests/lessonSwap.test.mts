/**
 * Regression tests for releasing a topic's content between lessons.
 *
 * A class works through a chapter without leaving immersive mode, so the scene
 * is emptied and refilled in place rather than rebuilt. That makes disposal
 * load-bearing in a way it never was before: three.js frees nothing on its own,
 * so a GLB whose reference is simply dropped keeps its buffers and textures
 * resident on the GPU. Six topics of that is a headset running out of memory
 * partway through a lesson, far from the mistake that caused it.
 *
 * These tests exist because that failure is invisible until it is severe.
 *
 * Run: npx tsx --test tests/lessonSwap.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../server/client/node_modules/three/build/three.module.js';

import {
  disposeLessonContent,
  disposeObject3D,
} from '../server/client/src/lib/lesson/lessonSwap.ts';

/** Counts the dispose() calls three.js would otherwise make silently. */
function trackDisposals() {
  const disposed = { geometries: 0, materials: 0, textures: 0 };

  const makeTexture = () => {
    const texture = new THREE.Texture();
    const original = texture.dispose.bind(texture);
    texture.dispose = () => {
      disposed.textures += 1;
      original();
    };
    return texture;
  };

  const makeMesh = (name: string) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const originalGeo = geometry.dispose.bind(geometry);
    geometry.dispose = () => {
      disposed.geometries += 1;
      originalGeo();
    };

    const material = new THREE.MeshStandardMaterial();
    material.map = makeTexture();
    material.normalMap = makeTexture();
    const originalMat = material.dispose.bind(material);
    material.dispose = () => {
      disposed.materials += 1;
      originalMat();
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    return mesh;
  };

  return { disposed, makeMesh };
}

/** A scene laid out the way the player builds it. */
function makePlayerScene(assetCount: number) {
  const { disposed, makeMesh } = trackDisposals();
  const scene = new THREE.Scene();

  // Part of the room, not the lesson — these must survive a swap.
  const dock = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshBasicMaterial());
  dock.name = 'assetDock';
  scene.add(dock);
  scene.add(new THREE.DirectionalLight());

  const assetsGroup = new THREE.Group();
  assetsGroup.name = 'assetsGroup';
  scene.add(assetsGroup);

  const assetRefs = new Map<string, THREE.Object3D>();
  const mixers: THREE.AnimationMixer[] = [];

  for (let i = 0; i < assetCount; i += 1) {
    const group = new THREE.Group();
    group.name = `assetGroup_asset${i}`;
    group.add(makeMesh(`part_a_${i}`));
    group.add(makeMesh(`part_b_${i}`));
    assetsGroup.add(group);
    assetRefs.set(`asset${i}`, group);
    mixers.push(new THREE.AnimationMixer(group));
  }

  return { scene, assetsGroup, assetRefs, mixers, disposed, dock };
}

/** Stand-ins for the collaborators the swap has to notify. */
function makeCollaborators() {
  const calls = { toolsDisposed: 0, narrationStopped: 0, annotations: 0, markTargets: 0 };
  return {
    calls,
    modelTools: {
      dispose() {
        calls.toolsDisposed += 1;
      },
    },
    narration: {
      stop() {
        calls.narrationStopped += 1;
      },
    },
    inkLayer: {
      setAnnotations() {
        calls.annotations += 1;
      },
      setMarkTargets() {
        calls.markTargets += 1;
      },
    },
  };
}

test('every asset group is released, with its geometry and textures', () => {
  const { scene, assetsGroup, assetRefs, mixers, disposed } = makePlayerScene(3);
  const co = makeCollaborators();

  const released = disposeLessonContent({
    scene,
    assetsGroup,
    assetRefs,
    mixers,
    modelTools: co.modelTools,
    inkLayer: co.inkLayer,
    narration: co.narration,
  });

  assert.equal(released, 3, 'all three asset groups should be reported released');
  assert.equal(assetsGroup.children.length, 0, 'the group should be emptied');
  assert.equal(disposed.geometries, 6, 'two meshes per asset');
  assert.equal(disposed.materials, 6);
  assert.equal(disposed.textures, 12, 'a map and a normal map on each mesh');
});

test('iterating does not skip half the children', () => {
  // Removing from an array while iterating it is the classic way to release
  // every other object and leak the rest.
  const { scene, assetsGroup, assetRefs, mixers, disposed } = makePlayerScene(8);
  const co = makeCollaborators();

  disposeLessonContent({
    scene,
    assetsGroup,
    assetRefs,
    mixers,
    modelTools: co.modelTools,
    inkLayer: co.inkLayer,
    narration: co.narration,
  });

  assert.equal(assetsGroup.children.length, 0, 'nothing may be left behind');
  assert.equal(disposed.geometries, 16, 'every mesh of every asset');
});

test('the room survives the lesson', () => {
  const { scene, assetsGroup, assetRefs, mixers, dock } = makePlayerScene(2);
  const co = makeCollaborators();

  disposeLessonContent({
    scene,
    assetsGroup,
    assetRefs,
    mixers,
    modelTools: co.modelTools,
    inkLayer: co.inkLayer,
    narration: co.narration,
  });

  assert.ok(scene.getObjectByName('assetDock'), 'the dock belongs to the room, not the topic');
  assert.ok(scene.getObjectByName('assetsGroup'), 'the container is reused, not rebuilt');
  assert.equal(dock.parent, scene, 'the dock stays attached');
});

test('nothing is left holding a reference to freed geometry', () => {
  const { scene, assetsGroup, assetRefs, mixers } = makePlayerScene(2);
  const co = makeCollaborators();

  disposeLessonContent({
    scene,
    assetsGroup,
    assetRefs,
    mixers,
    modelTools: co.modelTools,
    inkLayer: co.inkLayer,
    narration: co.narration,
  });

  assert.equal(assetRefs.size, 0, 'the id map is cleared');
  assert.equal(mixers.length, 0, 'mixers hold clip bindings on the models');
  assert.equal(co.calls.toolsDisposed, 1, 'the model tools cache root objects');
  assert.equal(co.calls.markTargets, 1, 'marks are parented to the models');
});

test('narration stops, so one topic does not talk over the next', () => {
  const { scene, assetsGroup, assetRefs, mixers } = makePlayerScene(1);
  const co = makeCollaborators();

  disposeLessonContent({
    scene,
    assetsGroup,
    assetRefs,
    mixers,
    modelTools: co.modelTools,
    inkLayer: co.inkLayer,
    narration: co.narration,
  });

  assert.equal(co.calls.narrationStopped, 1);
  assert.equal(co.calls.annotations, 1, 'the previous teacher marks are cleared');
});

test('a second swap over an already-emptied scene is harmless', () => {
  const { scene, assetsGroup, assetRefs, mixers } = makePlayerScene(2);
  const co = makeCollaborators();
  const refs = {
    scene,
    assetsGroup,
    assetRefs,
    mixers,
    modelTools: co.modelTools,
    inkLayer: co.inkLayer,
    narration: co.narration,
  };

  disposeLessonContent(refs);
  assert.equal(disposeLessonContent(refs), 0, 'nothing left to release, and no throw');
});

test('missing collaborators are tolerated', () => {
  // The swap can fire before the tools or the ink layer have been created.
  const { scene, assetsGroup, assetRefs, mixers } = makePlayerScene(1);

  assert.equal(
    disposeLessonContent({
      scene,
      assetsGroup,
      assetRefs,
      mixers,
      modelTools: null,
      inkLayer: null,
      narration: null,
    }),
    1
  );
});

test('disposeObject3D detaches as well as frees', () => {
  const { makeMesh } = trackDisposals();
  const parent = new THREE.Group();
  const child = makeMesh('lonely');
  parent.add(child);

  disposeObject3D(child);
  assert.equal(parent.children.length, 0, 'a freed object must not stay in the graph');
  // A stale entry in the scene graph still renders, and renders from freed
  // buffers — worse than the leak it came from.
});
