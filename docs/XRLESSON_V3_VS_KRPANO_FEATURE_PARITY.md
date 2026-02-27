# XRLessonPlayerV3 vs VRLessonPlayerKrpano – Feature Parity

This document maps features from the WebXR/Three.js **XRLessonPlayerV3** to the krpano-based **VRLessonPlayerKrpano** and notes how they are implemented so behaviour stays consistent and nothing is broken.

## Directional TTS (implemented)

| Aspect | XRLessonPlayerV3 | VRLessonPlayerKrpano |
|--------|-------------------|------------------------|
| TTS playback | HTML `<Audio>` (non-directional) | **Directional 3D audio** via krpano soundinterface |
| With avatar | N/A (no 3D avatar in V3) | `playsound_at_hotspot('tts', url, 'teacher_avatar', ...)` – sound from avatar position |
| Without avatar / fallback | N/A | `playsound_at_hv('tts', url, 0, 0, 500, false, 1.0, oncomplete)` – sound from front-center (h=0°, v=0°, depth=500) |
| Cleanup | Dispose `Audio` | `destroysound('tts')` when pausing/stopping or unmounting |

- **buildKrpanoXml** is called with `enableTTS: true` so the soundinterface plugin is always included when the lesson has TTS (with or without avatar).
- If `playsound_at_hotspot` fails (e.g. avatar not loaded), the player falls back to `playsound_at_hv` so TTS stays directional.

## Avatar script (intro / explanation / outro)

| Aspect | XRLessonPlayerV3 | VRLessonPlayerKrpano |
|--------|-------------------|------------------------|
| Data | `topic.avatar_intro`, `avatar_explanation`, `avatar_outro` (text) | Same fields from `extraLessonData.topic` |
| Display | Script panel (canvas billboard) with phase badge + text | Immersive HUD: `ui_narr_script`, `ui_narr_phase` (krpano text hotspots) |
| Phase names | `intro`, `content`, `outro` | `intro`, `explanation`, `outro` (content ↔ explanation aligned in logic) |

Both players drive phases from the same lesson data; script text is shown in the active phase panel.

## Lesson phase flow

| Phase | XRLessonPlayerV3 | VRLessonPlayerKrpano |
|-------|-------------------|------------------------|
| Waiting | `waiting` | Welcome screen → user clicks Start |
| Intro | `intro` | `intro` |
| Content | `content` | `explanation` |
| Outro | `outro` | `outro` |
| Quiz | `mcq` | `quiz` |
| Done | `complete` | `completed` |

Phase transitions (e.g. TTS end → next phase, or skip) are aligned; class session reporting uses the same phase mapping where applicable.

## UI and placement

| Aspect | XRLessonPlayerV3 | VRLessonPlayerKrpano |
|--------|-------------------|------------------------|
| Start screen | Canvas texture on 3D plane; layout engine / intro dock | Krpano HUD: `ui_welcome_*` hotspots (ath/atv fixed) |
| Script / narration | Script panel (billboard), layout engine position | `ui_narr_*` (phase, script, progress, play/pause, skip, continue) |
| MCQ | MCQ panel (canvas), button bounds + raycast | `ui_quiz_*` (question, options 0–3, submit, next) |
| Completion | In-scene or overlay | `ui_done_*` |
| Placement | Dynamic (Three.js layout engine, camera-relative) | Fixed spherical (ath/atv) in krpano; HUD follows view in VR |

Krpano uses a fixed HUD layout; no layout “strategy” like V3’s curved-arc/carousel/grid. 3D assets in krpano are laid out in a row (tx/tz) in front of the viewer.

## 3D asset interaction

| Aspect | XRLessonPlayerV3 | VRLessonPlayerKrpano |
|--------|-------------------|------------------------|
| Model source | GLB/GLTF via GLTFLoader, Meshy assets | Same URLs via krpano Three.js plugin (`type="threejs"` hotspots) |
| Interaction | Raycast + grab/release, haptics, StableLayoutSystem | `drag3d()` on mouse/touch and VR controller (ray hit when depthbuffer enabled) |
| UI vs assets | UI panels and assets on separate raycast layers | HUD hotspots for UI; threejs hotspots with `ondown="drag3d();"` for 3D objects |

So: in V3 the user grabs objects with controllers; in krpano the user drags 3D objects. Both support VR; krpano does not replicate the full “grab with physics” behaviour, only drag.

## UI behaviour (controls)

| Action | XRLessonPlayerV3 | VRLessonPlayerKrpano |
|--------|-------------------|------------------------|
| Start lesson | START button on start panel | `__krpanoOnUiAction('start_lesson')` → `handleStartLesson` |
| Play / Pause TTS | Buttons on script panel (canvas bounds) | `play_pause` → `playTTS` / `pauseTTS` / `resumeTTS` |
| Replay / Stop | Script panel buttons | `replay`, `stop_lesson` |
| Skip to quiz | Script panel | `skip_to_quiz` |
| Continue | After TTS or phase | `continue` → `handleContinue` |
| MCQ select / submit / next | MCQ panel buttons | `mcq_select` (payload 0–3), `mcq_submit`, `mcq_next` |
| Exit / More lessons | In-scene or overlay | `exit_lesson`, `more_lessons`; `exit_vr` for WebVR exit |

All of these are wired through `__krpanoOnUiAction` in the krpano player so behaviour matches the intended flow without breaking existing behaviour.

## Summary

- **Directional TTS** is implemented in the krpano player: from avatar when available (`playsound_at_hotspot`), from front-center when not (`playsound_at_hv`), with `enableTTS: true` and cleanup via `destroysound('tts')`.
- **Avatar script (intro/outro/explanation)**, **phase flow**, **UI structure**, and **UI actions** are replicated in krpano via the same lesson data and the immersive HUD; differences are in layout (fixed ath/atv vs dynamic 3D layout) and interaction model (drag3d vs grab/release).
- Existing behaviour is preserved: avatar path is unchanged when the avatar is present; new path only adds directional TTS when the avatar is absent or hotspot playback fails.
