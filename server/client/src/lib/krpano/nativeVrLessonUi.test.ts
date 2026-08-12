import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildKrpanoXml } from './buildKrpanoXml';
import { applyTeacherViewToImmersiveKrpano } from './applyTeacherView';

const nativeUiSource = readFileSync(
  new URL('../../../public/krpano/plugins/native_vr_lesson_ui.xml', import.meta.url),
  'utf8',
);
const immersiveUiSource = readFileSync(
  new URL('../../../public/krpano/plugins/immersive_ui.xml', import.meta.url),
  'utf8',
);
const xrInputSource = readFileSync(
  new URL('../../../public/krpano/plugins/xr_input.xml', import.meta.url),
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
  assert.match(xml, /xr_input\.xml\?v=/);
  assert.ok(
    xml.indexOf('webvr.xml?v=') < xml.indexOf('native_vr_lesson_ui.xml?v='),
    'webvr.xml must load before the native lesson UI',
  );
  assert.ok(
    xml.indexOf('immersive_ui.xml?v=') < xml.indexOf('xr_input.xml?v='),
    'the lesson panel must load before its XR input adapter',
  );
});

test('non-VR lesson XML does not load immersive lesson controls', () => {
  const xml = buildKrpanoXml({
    sphereUrl: 'https://example.com/lesson.jpg',
    webvr: false,
  });

  assert.doesNotMatch(xml, /native_vr_lesson_ui\.xml/);
  assert.doesNotMatch(xml, /xr_input\.xml/);
});

test('lesson hotspot data cannot escape into executable KRPano actions', () => {
  const xml = buildKrpanoXml({
    sphereUrl: 'https://example.com/lesson.jpg',
    hotspots: [{
      name: `');window.__hotspotXss=true;//`,
      label: 'Unsafe-looking label',
      ath: Number.NaN,
      atv: 0,
    }],
  });

  assert.match(xml, /name="lesson_hotspot_0"/);
  assert.match(xml, /datahotspotid="&apos;\);window\.__hotspotXss=true;\/\/"/);
  assert.match(xml, /ath="0"/);
  assert.match(xml, /onclick="jscall\('window\.__krpanoOnHotspotClick\(caller\.datahotspotid\)'\);"/);
  assert.doesNotMatch(xml, /onclick="[^"]*__hotspotXss/);
});

test('canvas controls use non-overlapping centimeter-based KRPano hit proxies', () => {
  const configuredScale = Number(immersiveUiSource.match(/iu_scale="([^"]+)"/)?.[1]);
  assert.equal(configuredScale, 0.1);
  assert.equal(120 * configuredScale, 12);
  assert.equal(75 * configuredScale, 7.5);
  assert.match(immersiveUiSource, /iu_scale="0\.1"/);
  assert.match(immersiveUiSource, /PANEL_WIDTH_CM\s*=\s*120 \* UI_SCALE/);
  assert.match(immersiveUiSource, /PANEL_HEIGHT_CM\s*=\s*75 \* UI_SCALE/);
  assert.match(immersiveUiSource, /HIT_PADDING_CM\s*=\s*3 \* UI_SCALE/);
  assert.match(immersiveUiSource, /Math\.max\(8 \* UI_SCALE/);
  assert.match(immersiveUiSource, /Math\.max\(5 \* UI_SCALE/);
  assert.match(immersiveUiSource, /renderer",\s*"webgl"/);
  assert.match(immersiveUiSource, /distorted",\s*true/);
  assert.match(immersiveUiSource, /bgcapture",\s*true/);
  assert.match(immersiveUiSource, /hittest",\s*true/);
  assert.match(immersiveUiSource, /PANEL_WIDTH_CM\s*\/\s*ws/);
  assert.match(immersiveUiSource, /var dy\s*=\s*\(\(cy \/ CH\) - 0\.5\) \* PANEL_HEIGHT_CM/);
  assert.doesNotMatch(immersiveUiSource, /var panelW\s*=\s*4\.8/);
});

test('KRPano JavaScript action bodies are syntactically valid', () => {
  for (const [name, source] of [
    ['immersive UI', immersiveUiSource],
    ['XR input', xrInputSource],
    ['native fallback', nativeUiSource],
  ] as const) {
    const actions = source.matchAll(/<action\b[^>]*type="js"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/action>/g);
    for (const match of actions) {
      assert.doesNotThrow(
        () => new Function('krpano', 'caller', match[1]),
        `${name} contains an invalid JavaScript action`,
      );
    }
  }
});

test('the actual canvas panel is primary and the native hotspot UI is fallback-only', () => {
  assert.match(nativeUiSource, /typeof window\.__krpanoImmersiveUiClick==="function"/);
  assert.match(nativeUiSource, /typeof window\.__krpanoUIAction==="function"/);
  assert.match(nativeUiSource, /typeof window\.__krpanoUIUpdate==="function"/);
  assert.match(nativeUiSource, /window\.__krpanoUIState\.initialized===true/);
  assert.match(nativeUiSource, /return inVr&&!canvasReady/);
  assert.match(immersiveUiSource, /mesh\.visible\s*=\s*!!\(showFlag\s*&&\s*enabled\)/);
});

test('controller and hand paths share a duplicate-safe immersive action dispatcher', () => {
  assert.match(immersiveUiSource, /lastDispatchAction/);
  assert.match(immersiveUiSource, /now\s*-\s*Number\(refs\.lastDispatchAt/);
  assert.match(immersiveUiSource, /targetName\.indexOf\("iu_gaze_btn_"\)\s*===\s*0/);
  assert.match(xrInputSource, /addEventListener\("select"/);
  assert.match(xrInputSource, /source\.hand/);
  assert.match(xrInputSource, /source\.targetRaySpace/);
  assert.match(xrInputSource, /frame\.getPose\(source\.targetRaySpace, referenceSpace\)/);
  assert.match(xrInputSource, /new THREE\.Raycaster/);
  assert.match(xrInputSource, /hand-pinch-ray/);
  assert.match(xrInputSource, /__krpanoImmersiveUiDispatch\(action\)/);
  assert.match(immersiveUiSource, /__krpanoImmersiveUiClick\(caller\.name\)/);
  assert.match(immersiveUiSource, /__krpanoImmersiveControllerButton\(caller\.name,caller\.vrbuttonindex,caller\.vrbuttonstate\)/);
  assert.match(immersiveUiSource, /krpano_to_threejs_position/);
  assert.match(xrInputSource, /sessionOwner/);
  assert.match(xrInputSource, /state\.referenceSpace/);
  assert.match(xrInputSource, /requestedSession\.requestReferenceSpace\("local"\)/);
  assert.match(xrInputSource, /session\.requestReferenceSpace\("local-floor"\)/);
  assert.match(xrInputSource, /if \(state\.session === requestedSession\)/);
  assert.match(xrInputSource, /if \(binding\.referenceSpace\) state\.referenceSpace = binding\.referenceSpace/);
  assert.match(xrInputSource, /if \(hand === "left" \|\| hand === "right"\) return ""/);
  assert.doesNotMatch(immersiveUiSource, /js\([^)]*&&/);
  assert.doesNotMatch(immersiveUiSource, /immersive_ui_gaze_click/);
  assert.doesNotMatch(immersiveUiSource, /immersive_ui_dispatch_action/);
});

test('every lesson and quiz command is represented by an immersive hit asset and React route', () => {
  for (const action of [
    'continue',
    'replay',
    'skipToQuiz',
    'ttsPlay',
    'mcqSelect:',
    'mcqSubmit',
    'mcqNext',
    'phaseGo:',
    'layoutToggle:',
    'directClassView',
  ]) {
    assert.ok(immersiveUiSource.includes(action), `missing immersive hit action ${action}`);
  }

  for (const routedAction of [
    "action === 'continue'",
    "action === 'replay'",
    "action === 'skipToQuiz'",
    "action === 'ttsPlay'",
    "action === 'mcqSubmit'",
    "action === 'mcqNext'",
    "action.startsWith('mcqSelect:')",
    "action.startsWith('phaseGo:')",
    "action === 'directClassView'",
  ]) {
    assert.ok(playerSource.includes(routedAction), `missing React route ${routedAction}`);
  }
});

test('Direct class view uses the documented KRPano WebVR orientation action', () => {
  const calls: string[] = [];
  const viewer = {
    call(action: string) {
      calls.push(action);
    },
  };

  assert.equal(
    applyTeacherViewToImmersiveKrpano(viewer, { hlookat: 42, vlookat: -8, fov: 85 }),
    true,
  );
  assert.deepEqual(calls, [
    'stopmovements();',
    'webvr.lookat(42);',
  ]);
  assert.doesNotMatch(playerSource, /webvr\.hlookat\(/);
  assert.doesNotMatch(playerSource, /webvr\.recenter\(/);
  assert.doesNotMatch(playerSource, /webvr\.vlookatoffset/);
});

test('native lesson controls are real KRPano WebGL hotspots', () => {
  assert.match(nativeUiSource, /scale: 0\.12 \* UI_SCALE/);
  assert.match(nativeUiSource, /xOff\(l,w\)\*P\.layoutScale/);
  assert.match(nativeUiSource, /yOff\(t,h\)\*P\.layoutScale/);
  assert.match(nativeUiSource, /function yOff\(t,h\)\{return -P\.h\/2\+t\+h\/2;\}/);
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
  assert.doesNotMatch(nativeUiSource, /js\([^)]*&&/);
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
  assert.match(playerSource, /correctAnswer:\s*showMcqResult\s*\?/);
  assert.match(playerSource, /explanation:\s*showMcqResult\s*\?/);
  assert.match(playerSource, /const classControl = classControlRef\.current/);
  assert.doesNotMatch(playerSource, /__krpanoIsClassHost/);
  assert.doesNotMatch(playerSource, /__krpanoControlEnabled/);
  assert.doesNotMatch(playerSource, /__krpanoBroadcastPhase/);
  assert.match(playerSource, /immersiveUiActionRef\.current\(action\)/);
  assert.match(playerSource, /immersiveUiActionRef\.current\s*=\s*\(action/);
  assert.ok(
    playerSource.indexOf('__krpanoUIAction = immersiveUiBridge') < playerSource.indexOf('embedKrpano({'),
    'the action bridge must exist before KRPano starts loading',
  );
  assert.ok(
    playerSource.indexOf('__krpanoUIUpdate = immersiveUiUpdateBridge') < playerSource.indexOf('embedKrpano({'),
    'the state bridge must exist before KRPano starts loading',
  );
  assert.match(playerSource, /initialized:\s*true/);
  assert.match(playerSource, /immersiveUiUpdateBridge\(immersiveUiStateRef\.current\)/);
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
  assert.match(xrInputSource, /removeEventListener\("select"/);
  assert.match(xrInputSource, /name="xr_input_cleanup"/);
  assert.match(playerSource, /viewer\?\.call\('xr_input_cleanup\(\)'\)/);
  assert.match(immersiveUiSource, /name="immersive_ui_cleanup"/);
  assert.match(immersiveUiSource, /clearInterval\(refs\.controllerHookTimer\)/);
  assert.match(immersiveUiSource, /clearInterval\(refs\.visibilityTimer\)/);
  assert.match(playerSource, /viewer\?\.call\('immersive_ui_cleanup\(\)'\)/);
  assert.match(playerSource, /document\.getElementById\('krpanoLessonViewer'\)/);
});
