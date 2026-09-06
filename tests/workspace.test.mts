/**
 * Regression tests for the lesson workspace geometry.
 *
 * The bug these guard against: the dock, the model slots and the lesson panel
 * were each placed by a different system, and each took its bearing from
 * wherever the camera happened to point at the moment it ran. A head turn
 * between any two of them left them facing different directions, so the room
 * never looked arranged — because it wasn't. There were three answers to one
 * question.
 *
 * Everything below is pure geometry: one captured anchor in, every position out.
 *
 * Run: npx tsx --test tests/workspace.test.mts
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../server/client/node_modules/three/build/three.module.js';

import {
  DESK_REACH,
  MAX_MODEL_SPREAD_DEG,
  PANEL_ANGULAR_WIDTH_DEG,
  PANEL_BEARING_DEG,
  PANEL_DISTANCE,
  captureAnchor,
  workspaceFrame,
} from '../server/client/src/lib/three/workspace.ts';
import { DESK_DROP } from '../server/client/src/lib/three/ergonomics.ts';

/** A viewer at a given eye height, facing a given compass bearing. */
function makeCamera(eyeHeight: number, yawDegrees = 0) {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.position.set(0, eyeHeight, 0);
  camera.rotation.set(0, THREE.MathUtils.degToRad(yawDegrees), 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/** Compass bearing of `point` as seen from the anchor, in degrees. */
function bearingOf(anchor: THREE.Vector3, point: THREE.Vector3, forward: THREE.Vector3) {
  const to = point.clone().sub(anchor).setY(0).normalize();
  const flat = forward.clone().setY(0).normalize();
  const cross = new THREE.Vector3().crossVectors(flat, to).y;
  const angle = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(flat.dot(to), -1, 1)));
  return cross > 0 ? -angle : angle;
}

test('the dock sits at desk height, ahead of the viewer', () => {
  const anchor = captureAnchor(makeCamera(1.2)); // seated
  const frame = workspaceFrame(anchor, 3);

  assert.ok(
    Math.abs(frame.deskY - (1.2 - DESK_DROP)) < 1e-9,
    'the desk is a fixed drop below the eye, seated or standing'
  );
  assert.ok(
    Math.abs(frame.dock.center.distanceTo(anchor.position.clone().setY(frame.deskY)) - DESK_REACH) <
      1e-9,
    'and at arm-s length'
  );
});

test('the panel keeps its bearing from the same anchor as the dock', () => {
  const anchor = captureAnchor(makeCamera(1.6));
  const frame = workspaceFrame(anchor, 2);

  const dockBearing = bearingOf(anchor.position, frame.dock.center, anchor.forward);
  const panelBearing = bearingOf(anchor.position, frame.panel.position, anchor.forward);

  assert.ok(Math.abs(dockBearing) < 1e-6, 'the dock is straight ahead');
  assert.ok(
    Math.abs(panelBearing - PANEL_BEARING_DEG) < 1e-6,
    `the panel is exactly ${PANEL_BEARING_DEG}deg from it, by construction`
  );
});

test('the workspace does not follow the head once captured', () => {
  // The whole point of an anchor. Placement used to be recomputed from the live
  // camera, so where a thing ended up depended on which way you were looking
  // when its system happened to run.
  const camera = makeCamera(1.6);
  const anchor = captureAnchor(camera);
  const before = workspaceFrame(anchor, 3);

  camera.rotation.y = THREE.MathUtils.degToRad(90);
  camera.updateMatrixWorld(true);
  const after = workspaceFrame(anchor, 3);

  assert.ok(
    before.dock.center.distanceTo(after.dock.center) < 1e-9,
    'the dock stays where it was put'
  );
  assert.ok(
    before.panel.position.distanceTo(after.panel.position) < 1e-9,
    'and so does the panel'
  );
});

test('recapturing moves the whole workspace together, keeping its shape', () => {
  const first = workspaceFrame(captureAnchor(makeCamera(1.6, 0)), 4);
  const second = workspaceFrame(captureAnchor(makeCamera(1.6, 90)), 4);

  // Same shape, different orientation: the relationship between dock and panel
  // must be identical, which is what "moves as one piece" means.
  const gap = (f: typeof first) =>
    bearingOf(f.anchor.position, f.panel.position, f.anchor.forward) -
    bearingOf(f.anchor.position, f.dock.center, f.anchor.forward);

  assert.ok(Math.abs(gap(first) - gap(second)) < 1e-6, 'the arrangement is preserved');
  assert.ok(
    Math.abs(
      first.dock.center.distanceTo(first.anchor.position) -
        second.dock.center.distanceTo(second.anchor.position)
    ) < 1e-9,
    'and so are the distances'
  );
});

test('every model sits on the desk, the same distance away', () => {
  for (const count of [1, 2, 3, 5, 8]) {
    const anchor = captureAnchor(makeCamera(1.35));
    const frame = workspaceFrame(anchor, count);

    assert.equal(frame.slots.length, count, `${count} models need ${count} slots`);
    for (const slot of frame.slots) {
      assert.ok(Math.abs(slot.position.y - frame.deskY) < 1e-9, 'on the desk surface');
      const flat = slot.position.clone().setY(anchor.position.y).distanceTo(anchor.position);
      assert.ok(
        Math.abs(flat - DESK_REACH) < 1e-9,
        'on the arc, so no model is further away than another'
      );
    }
  }
});

test('a single model is placed straight ahead, not off to one side', () => {
  const anchor = captureAnchor(makeCamera(1.6));
  const frame = workspaceFrame(anchor, 1);
  assert.ok(
    Math.abs(bearingOf(anchor.position, frame.slots[0].position, anchor.forward)) < 1e-6,
    'nothing to spread means nothing to offset'
  );
});

test('models never spread beyond a comfortable turn of the head', () => {
  const anchor = captureAnchor(makeCamera(1.6));
  // Far more assets than a lesson should carry, to prove the cap holds.
  for (const count of [2, 4, 8, 16, 40]) {
    const frame = workspaceFrame(anchor, count);
    const bearings = frame.slots.map((s) => bearingOf(anchor.position, s.position, anchor.forward));
    const spread = Math.max(...bearings) - Math.min(...bearings);
    assert.ok(
      spread <= MAX_MODEL_SPREAD_DEG + 1e-6,
      `${count} models spread ${spread.toFixed(1)}deg, over the ${MAX_MODEL_SPREAD_DEG}deg limit`
    );
  }
});

test('the dock is wide enough for the models standing on it', () => {
  const anchor = captureAnchor(makeCamera(1.6));
  for (const count of [1, 3, 6, 10]) {
    const frame = workspaceFrame(anchor, count);
    for (const slot of frame.slots) {
      const acrossDock = slot.position.distanceTo(frame.dock.center);
      assert.ok(
        acrossDock <= frame.dock.width / 2 + 1e-6,
        `a model ${acrossDock.toFixed(2)}m out is off a dock ${frame.dock.width.toFixed(2)}m wide`
      );
    }
  }
});

test('the panel is sized by the angle it subtends, not by a fixed width', () => {
  const anchor = captureAnchor(makeCamera(1.6));
  const frame = workspaceFrame(anchor, 2);

  const subtended =
    2 * THREE.MathUtils.radToDeg(Math.atan(frame.panel.width / 2 / PANEL_DISTANCE));
  assert.ok(
    Math.abs(subtended - PANEL_ANGULAR_WIDTH_DEG) < 1e-6,
    `panel spans ${subtended.toFixed(1)}deg; the old fixed 2.4m panel spanned 62deg at this distance`
  );
  assert.ok(
    Math.abs(frame.panel.height / frame.panel.width - 1280 / 2048) < 1e-9,
    'and keeps the canvas aspect, so nothing is stretched'
  );
});

test('the layout fits a seated child and a standing adult alike', () => {
  for (const eye of [1.05, 1.2, 1.45, 1.6, 1.85]) {
    const frame = workspaceFrame(captureAnchor(makeCamera(eye)), 3);
    assert.ok(frame.deskY > 0, `desk above the floor at eye height ${eye}`);
    assert.ok(frame.deskY < eye, 'and below the eye — you look down at a desk');
    assert.ok(
      frame.panel.position.y < eye && frame.panel.position.y > eye - 0.3,
      'the panel sits just below the eye line, never above it'
    );
  }
});

test('a viewer looking at the ceiling still gets a usable room', () => {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.position.set(0, 1.6, 0);
  camera.rotation.set(-Math.PI / 2, 0, 0); // straight up: nothing to flatten
  camera.updateMatrixWorld(true);

  const frame = workspaceFrame(captureAnchor(camera), 2);
  assert.ok(Number.isFinite(frame.dock.center.x), 'no NaN from normalising a zero vector');
  assert.ok(Number.isFinite(frame.panel.position.z));
});
