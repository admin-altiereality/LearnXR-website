/**
 * renderBudget – what the renderer is allowed to spend, by context.
 *
 * The flat view runs on a desktop GPU drawing one image. An immersive session
 * runs on a mobile-class GPU drawing two, at high resolution, with no headroom.
 * The player was configured once for the former and used unchanged for the
 * latter, which is why lessons with several 3D assets fell apart on a Quest:
 *
 *   - a 2048x2048 soft shadow map, re-rendered every frame;
 *   - every asset mesh casting and receiving, so the shadow pass cost scales
 *     with asset count — exactly the reported symptom;
 *   - foveation never set, leaving the standard headset lever unused.
 *
 * Assets keep casting shadows here. The saving comes from resolution, filter
 * cost and not redrawing a static shadow map every frame — not from removing
 * the ground-contact cue that makes an object look like it is in the room.
 *
 * This module touches the RENDERER only. Asset loading, scale and placement are
 * deliberately out of its reach.
 */

import * as THREE from 'three';

export interface RenderBudget {
  shadowMapSize: number;
  shadowType: THREE.ShadowMapType;
  /** Re-render the shadow map every frame, or only when asked. */
  shadowAutoUpdate: boolean;
  /** 0 = no foveation, 1 = maximum. Ignored outside an XR session. */
  foveation: number;
}

export const FLAT_BUDGET: RenderBudget = {
  shadowMapSize: 2048,
  shadowType: THREE.PCFSoftShadowMap,
  shadowAutoUpdate: true,
  foveation: 0,
};

export const IMMERSIVE_BUDGET: RenderBudget = {
  shadowMapSize: 1024,
  // PCF rather than PCFSoft: the soft variant takes many more taps per pixel,
  // and at 1024 across two eyes the extra softness is not perceptible anyway.
  shadowType: THREE.PCFShadowMap,
  shadowAutoUpdate: false,
  // Mid foveation: peripheral pixels render at lower resolution, which the eye
  // does not resolve there. The single largest saving available on a Quest.
  foveation: 0.5,
};

/**
 * Apply a budget to the renderer and its shadow-casting lights.
 *
 * `shadowMap.type` is baked into compiled material programs, so changing it
 * forces a recompile. That is acceptable on a session transition — a one-off
 * hitch as the headset enters or leaves — and is why this is called there
 * rather than per frame.
 */
export function applyRenderBudget(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  budget: RenderBudget
): void {
  const shadows = renderer.shadowMap;
  const typeChanged = shadows.type !== budget.shadowType;

  shadows.type = budget.shadowType;
  shadows.autoUpdate = budget.shadowAutoUpdate;
  // Whatever the mode, draw once now so the scene is never left with a stale or
  // empty shadow map after a transition.
  shadows.needsUpdate = true;

  scene.traverse((object) => {
    const light = object as THREE.Light & { shadow?: THREE.LightShadow };
    if (!light.isLight || !light.shadow || !light.castShadow) return;
    const map = light.shadow.mapSize;
    if (map.width === budget.shadowMapSize && map.height === budget.shadowMapSize) return;
    map.setScalar(budget.shadowMapSize);
    // The allocated depth texture is sized on creation; drop it so three.js
    // rebuilds at the new resolution instead of silently keeping the old one.
    light.shadow.map?.dispose();
    light.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  });

  try {
    renderer.xr.setFoveation?.(budget.foveation);
  } catch {
    // Not every runtime exposes foveation; it is an optimisation, not a feature.
  }

  if (typeChanged) {
    // Materials compiled against the previous shadow filter must be rebuilt.
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (!material) return;
      if (Array.isArray(material)) material.forEach((m) => (m.needsUpdate = true));
      else material.needsUpdate = true;
    });
  }
}

/**
 * Ask for one shadow refresh. Call after assets move or the layout changes,
 * since the immersive budget stops updating the map automatically.
 */
export function requestShadowRefresh(renderer: THREE.WebGLRenderer | null): void {
  if (renderer) renderer.shadowMap.needsUpdate = true;
}
