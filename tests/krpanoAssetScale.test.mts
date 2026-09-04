/**
 * Regression tests for krpano 3D asset sizing.
 *
 * The bug these pin down: hotspot positions are centimetres but a model's geometry is in
 * three.js world units, which are metres (hotspotworldscale = 100). The old code divided a
 * centimetre target by a metre dimension and shipped that as `hotspot.scale`, so every
 * auto-scaled asset rendered exactly 100x too large — and an unmeasured one fell back to
 * scale=1, i.e. raw glTF units.
 *
 * Run: npx tsx --test tests/krpanoAssetScale.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../server/client/node_modules/three/build/three.module.js';

import {
  ASSET_ANGULAR_SIZE_DEG,
  ASSET_DISTANCE_CM,
  KRPANO_CM_PER_WORLD_UNIT,
  linearSizeForAngularSize,
  scaleForAsset,
  targetSizeInWorldUnits,
} from '../server/client/src/lib/krpano/assetLayout.ts';
import { buildKrpanoXml } from '../server/client/src/lib/krpano/buildKrpanoXml.ts';
import { normalizeAssetHotspot } from '../server/client/src/lib/krpano/normalizeAssetHotspot.ts';

const GLB = 'https://example.com/a/model.glb';

/** A hotspot whose three.js object is a box of a known native size. */
function makeFakeViewer(opts: {
  nativeSize: number;
  depth?: number;
  tx?: number;
  ty?: number;
  tz?: number;
  scale?: number;
  worldScale?: number;
}) {
  const root = new THREE.Object3D();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(opts.nativeSize, opts.nativeSize / 2, opts.nativeSize / 4)
  );
  // Origin deliberately away from the geometry, to exercise recentring.
  mesh.position.set(opts.nativeSize, 0, 0);
  root.add(mesh);
  root.scale.setScalar(opts.scale ?? 1);
  root.updateWorldMatrix(true, true);

  const hotspot: Record<string, unknown> = {
    name: 'asset_0',
    threejsobject: root,
    scale: opts.scale ?? 1,
    depth: opts.depth ?? 0,
    tx: opts.tx ?? 0,
    ty: opts.ty ?? 0,
    tz: opts.tz ?? ASSET_DISTANCE_CM,
  };

  const calls: string[] = [];
  const viewer = {
    threejs: { THREE },
    get: (path: string) => {
      if (path === 'display.hotspotworldscale') return opts.worldScale ?? KRPANO_CM_PER_WORLD_UNIT;
      if (path === 'hotspot[asset_0]') return hotspot;
      if (path === 'hotspot.count') return 1;
      return undefined;
    },
    call: (script: string) => {
      calls.push(script);
      const m = script.match(/set\(hotspot\[asset_0\]\.scale,\s*([0-9.eE+-]+)\);/);
      if (m) {
        // krpano propagates a scale set on the hotspot to the three.js object it manages.
        // Modelling that is what makes the idempotence test meaningful rather than a fiction.
        hotspot.scale = Number(m[1]);
        root.scale.setScalar(Number(m[1]));
        root.updateWorldMatrix(true, true);
      }
    },
  };

  return { viewer, hotspot, root, calls };
}

test('the target crosses from centimetres into three.js world units', () => {
  const cm = linearSizeForAngularSize(ASSET_DISTANCE_CM, ASSET_ANGULAR_SIZE_DEG);
  const world = targetSizeInWorldUnits(ASSET_DISTANCE_CM, ASSET_ANGULAR_SIZE_DEG);

  assert.ok(Math.abs(cm - 119.03) < 0.1, `expected ~119.03 cm, got ${cm}`);
  // The whole bug in one assertion: the world-unit target must be the centimetre target
  // divided by hotspotworldscale, not equal to it.
  assert.ok(Math.abs(world - cm / 100) < 1e-9);
  assert.ok(Math.abs(world - 1.1903) < 0.001, `expected ~1.19 m, got ${world}`);
});

test('scaleForAsset no longer returns a 100x oversized multiplier', () => {
  // A real lesson asset cited in assetLayout.ts.
  const scale = scaleForAsset(23380, ASSET_DISTANCE_CM, ASSET_ANGULAR_SIZE_DEG);
  const renderedMetres = 23380 * scale;

  assert.ok(Math.abs(renderedMetres - 1.1903) < 0.001, `renders ${renderedMetres} m`);
  // Previously 0.00509, which rendered 119 m.
  assert.ok(scale < 1e-4, `scale ${scale} looks like the old centimetre value`);
});

test('wildly different source scales converge on the same rendered size', () => {
  for (const nativeMaxDim of [0.06, 1, 23380]) {
    const rendered = nativeMaxDim * scaleForAsset(nativeMaxDim);
    assert.ok(
      Math.abs(rendered - 1.1903) < 0.001,
      `maxDim ${nativeMaxDim} rendered ${rendered} m`
    );
  }
});

test('normalizeAssetHotspot fits the model measured from its own geometry', () => {
  const { viewer, calls } = makeFakeViewer({ nativeSize: 23380 });
  const result = normalizeAssetHotspot(viewer as never, 'asset_0', ASSET_ANGULAR_SIZE_DEG);

  assert.ok(result, 'expected a normalisation result');
  assert.ok(Math.abs(result!.nativeMaxDim - 23380) < 1e-6);
  assert.ok(
    Math.abs(result!.nativeMaxDim * result!.scale - 1.1903) < 0.001,
    `rendered ${result!.nativeMaxDim * result!.scale} m`
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^set\(hotspot\[asset_0\]\.scale,/);
});

test('normalising is idempotent — a second pass does not shrink it again', () => {
  const { viewer } = makeFakeViewer({ nativeSize: 500 });
  const first = normalizeAssetHotspot(viewer as never, 'asset_0', ASSET_ANGULAR_SIZE_DEG);
  const second = normalizeAssetHotspot(viewer as never, 'asset_0', ASSET_ANGULAR_SIZE_DEG);

  assert.ok(first && second);
  assert.ok(
    Math.abs(first!.scale - second!.scale) / first!.scale < 1e-6,
    `scale drifted: ${first!.scale} then ${second!.scale}`
  );
});

test('an off-centre origin is recentred on the hotspot point', () => {
  const { viewer, root } = makeFakeViewer({ nativeSize: 10 });
  const before = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  assert.ok(before.length() > 0, 'fixture should start off-centre');

  const result = normalizeAssetHotspot(viewer as never, 'asset_0', ASSET_ANGULAR_SIZE_DEG);
  assert.ok(result?.recentred);

  root.updateWorldMatrix(true, true);
  const after = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  assert.ok(after.length() < 1e-6, `expected centred on origin, got ${after.toArray()}`);
});

test('distance is read from the hotspot, not assumed', () => {
  // An author-placed asset at depth 500 must be sized for 500, not the 280 default. The old
  // code defaulted to 280 while the XML emitted depth ?? 500.
  const near = makeFakeViewer({ nativeSize: 4, depth: 280 });
  const far = makeFakeViewer({ nativeSize: 4, depth: 500 });

  const a = normalizeAssetHotspot(near.viewer as never, 'asset_0', ASSET_ANGULAR_SIZE_DEG)!;
  const b = normalizeAssetHotspot(far.viewer as never, 'asset_0', ASSET_ANGULAR_SIZE_DEG)!;

  assert.equal(a.distanceCm, 280);
  assert.equal(b.distanceCm, 500);
  // Same angular size at a greater distance means a physically larger object.
  assert.ok(b.scale > a.scale, `expected ${b.scale} > ${a.scale}`);
  assert.ok(Math.abs(b.scale / a.scale - 500 / 280) < 1e-6);
});

test('unmeasured assets are emitted hidden; author-scaled ones are not', () => {
  const hidden = buildKrpanoXml({
    sphereUrl: 'https://example.com/pano.jpg',
    threeJsAssetUrls: [GLB],
    assetInteractionIds: ['a1'],
  });
  assert.match(hidden, /name="asset_0"[^>]*visible="false"/);

  const authored = buildKrpanoXml({
    sphereUrl: 'https://example.com/pano.jpg',
    threeJsAssetUrls: [GLB],
    assetInteractionIds: ['a1'],
    assetPlacements: [{ scale: 0.5 }],
  });
  assert.doesNotMatch(authored, /name="asset_0"[^>]*visible="false"/);
  assert.match(authored, /name="asset_0"[^>]*scale="0.5"/);
});

test('the arc is laid out for the assets actually on it', () => {
  // One author-placed (ath/atv) and one arc asset. The arc holds a single asset, so it must
  // land dead centre — previously the arc was spaced for both and pushed it off to one side.
  const xml = buildKrpanoXml({
    sphereUrl: 'https://example.com/pano.jpg',
    threeJsAssetUrls: [GLB, GLB.replace('a/', 'b/')],
    assetInteractionIds: ['a1', 'a2'],
    assetPlacements: [{ ath: 30, atv: 0, depth: 500 }, undefined],
  });

  assert.match(xml, /name="asset_0"[^>]*ath="30"[^>]*depth="500"/);
  const arc = xml.match(/name="asset_1"[^>]*tx="(-?[0-9.]+)"/);
  assert.ok(arc, 'expected asset_1 to be arc-placed with a tx');
  assert.ok(Math.abs(Number(arc![1])) < 1e-6, `lone arc asset should be centred, tx=${arc![1]}`);
});
