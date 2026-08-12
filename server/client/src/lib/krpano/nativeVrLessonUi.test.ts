import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildKrpanoXml } from './buildKrpanoXml';

const nativeUiSource = readFileSync(
  new URL('../../../public/krpano/plugins/native_vr_lesson_ui.xml', import.meta.url),
  'utf8',
);
const playerSource = readFileSync(
  new URL('../../screens/VRLessonPlayerKrpano.tsx', import.meta.url),
  'utf8',
);
const embedSource = readFileSync(new URL('./embedKrpano.ts', import.meta.url), 'utf8');

test('WebVR lesson XML includes the native interactive lesson UI', () => {
  const xml = buildKrpanoXml({
    sphereUrl: 'https://example.com/lesson.jpg',
    origin: 'https://learnxr.example',
    webvr: true,
  });

  assert.match(xml, /native_vr_lesson_ui\.xml\?v=/);
  assert.ok(
    xml.indexOf('webvr.xml?v=') < xml.indexOf('native_vr_lesson_ui.xml?v='),
    'webvr.xml must load before the native lesson UI',
  );
});

test('non-VR lesson XML does not load immersive lesson controls', () => {
  const xml = buildKrpanoXml({
    sphereUrl: 'https://example.com/lesson.jpg',
    webvr: false,
  });

  assert.doesNotMatch(xml, /native_vr_lesson_ui\.xml/);
});

test('native lesson controls are real KRPano WebGL hotspots', () => {
  for (const requiredSetting of [
    's("type","text")',
    's("distorted",true)',
    's("torigin","world")',
    's("renderer","webgl")',
    's("capture",true)',
    's("bgcapture",true)',
    's("hittest",true)',
    's("onclick"',
  ]) {
    assert.ok(nativeUiSource.includes(requiredSetting), `missing ${requiredSetting}`);
  }
});

test('native UI uses KRPano controller clicks without a duplicate button dispatcher', () => {
  assert.match(nativeUiSource, /vr_controller_clickbuttons="0,1"/);
  assert.match(nativeUiSource, /vr_controller_activationbuttons="0,1"/);
  assert.match(nativeUiSource, /s\("onclick"/);
  assert.doesNotMatch(nativeUiSource, /__krpanoNativeVrUiControllerButton/);
  assert.doesNotMatch(nativeUiSource, /addevent\("onvrcontrollerbutton"/);
});

test('hand-select fallback resolves only an unambiguous native hotspot target', () => {
  assert.match(nativeUiSource, /source\.hand/);
  assert.match(nativeUiSource, /controllerTargetName\(source\.handedness\)/);
  assert.match(nativeUiSource, /if\(left===right\)return left/);
  assert.match(nativeUiSource, /return left&&!right\?left:\(!left&&right\?right:""\)/);
});

test('React state updates redraw both immersive fallbacks', () => {
  assert.match(playerSource, /viewer\.call\('immersive_ui_update\(\)'\)/);
  assert.match(playerSource, /viewer\.call\('native_vr_lesson_ui_update\(\)'\)/);
});

test('KRPano embedding explicitly prefers WebXR for Quest hand-select input', () => {
  assert.match(embedSource, /webxr:\s*'prefer'/);
});

test('native XR listeners and timers are disposed before viewer teardown', () => {
  assert.match(nativeUiSource, /removeEventListener\("select"/);
  assert.match(nativeUiSource, /clearInterval\(krpano\.native_vr_lesson_ui_timer\)/);
  assert.match(nativeUiSource, /krpano\.native_vr_lesson_ui_update=null/);
  assert.match(nativeUiSource, /krpano\.native_vr_lesson_ui_cleanup=null/);
  assert.match(nativeUiSource, /name="native_vr_lesson_ui_cleanup"/);
  assert.match(playerSource, /viewer\?\.call\('native_vr_lesson_ui_cleanup\(\)'\)/);
});
