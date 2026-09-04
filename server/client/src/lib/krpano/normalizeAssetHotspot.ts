/**
 * Size and centre a loaded krpano 3D asset from the geometry it actually loaded.
 *
 * ## Why this exists
 *
 * The previous approach predicted a scale *before* the model existed: parse the GLB header
 * for a bounding box, convert units by hand, and emit the result as a `scale` attribute. That
 * had two failure modes that no amount of tuning fixed.
 *
 * The prediction was in the wrong units. Hotspot coordinates are centimetres; a model's
 * geometry is metres. `scaleForAsset` divided a centimetre target by a metre dimension, so
 * every asset rendered 100x too large — uniformly, whatever its source scale, which is why
 * the normalisation looked like it was working while every model engulfed the camera.
 *
 * And the prediction was frequently unavailable. A cache miss emitted `scale="1"` — raw glTF
 * units — and a real lesson asset measuring 23,380 units then rendered as a ~23 km object
 * until an async correction landed.
 *
 * ## What this does instead
 *
 * The same thing every other renderer in this codebase does — measure the loaded object and
 * fit it — only against krpano's live scene rather than a local `<Canvas>`:
 *
 *   XRLessonPlayerV3.tsx:2551  scale = NORMALIZED_SIZE / maxDim
 *   AssetViewerWithSkybox.tsx:911-918  scale = 2 / maxDim, then position.sub(center * scale)
 *
 * Measuring and setting in the same space means there is no unit conversion left to get
 * wrong. `model_control.xml:30-63` establishes that `hotspot.threejsobject` is reachable and
 * its graph mutable, which is what makes this possible at all.
 */

import * as AppTHREE from 'three';
import {
  ASSET_ANGULAR_SIZE_DEG,
  ASSET_DISTANCE_CM,
  KRPANO_CM_PER_WORLD_UNIT,
  targetSizeInWorldUnits,
} from './assetLayout';

/** The slice of the krpano viewer this needs. */
export interface KrpanoViewerLike {
  get?: (path: string) => unknown;
  call?: (script: string) => void;
  [key: string]: unknown;
}

export interface NormalizeResult {
  /** Multiplier written to the hotspot. */
  scale: number;
  /** Longest bounding-box dimension of the unscaled model, in world units. */
  nativeMaxDim: number;
  /** Distance the asset was sized against, in centimetres. */
  distanceCm: number;
  /** Whether the geometry was recentred on the hotspot point. */
  recentred: boolean;
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * krpano bundles its own three.js. Prefer it so any `instanceof` inside the plugin still
 * holds, but the app's copy works too — Box3 traversal is duck-typed on `isMesh`/`geometry`.
 */
function resolveThree(viewer: KrpanoViewerLike): typeof AppTHREE {
  const bundled = (viewer as { threejs?: { THREE?: typeof AppTHREE } }).threejs?.THREE;
  return bundled ?? AppTHREE;
}

function readHotspot(viewer: KrpanoViewerLike, name: string): Record<string, unknown> | null {
  try {
    const direct = viewer.get?.(`hotspot[${name}]`) as Record<string, unknown> | undefined;
    if (direct && typeof direct === 'object') return direct;
  } catch {
    /* fall through to the iterating form */
  }

  // model_control.xml walks the collection this way; it works when the indexed getter does not.
  try {
    const collection = (viewer as { hotspot?: { getItem?: (i: number) => Record<string, unknown> } }).hotspot;
    const count = toFiniteNumber(viewer.get?.('hotspot.count')) ?? 0;
    for (let i = 0; i < count; i += 1) {
      const item = collection?.getItem?.(i);
      if (item && String((item as { name?: unknown }).name ?? '') === name) return item;
    }
  } catch {
    /* give up below */
  }
  return null;
}

/**
 * How far from the eye the hotspot actually sits, read from the hotspot rather than assumed.
 *
 * Reading it is what removes a real inconsistency: the player's `assetDistanceFor` defaulted
 * to 280 while the XML emitted `depth ?? 500`, so an author-placed asset with no explicit
 * depth was sized for 2.8 m and then placed at 5 m.
 */
function readDistanceCm(hotspot: Record<string, unknown>): number {
  const depth = toFiniteNumber(hotspot.depth);
  if (depth !== null && depth > 0) return depth;

  const tx = toFiniteNumber(hotspot.tx) ?? 0;
  const ty = toFiniteNumber(hotspot.ty) ?? 0;
  const tz = toFiniteNumber(hotspot.tz) ?? 0;
  const radius = Math.sqrt(tx * tx + ty * ty + tz * tz);
  return radius > 0 ? radius : ASSET_DISTANCE_CM;
}

function readWorldScaleCm(viewer: KrpanoViewerLike): number {
  const fromViewer = toFiniteNumber(viewer.get?.('display.hotspotworldscale'));
  return fromViewer && fromViewer > 0 ? fromViewer : KRPANO_CM_PER_WORLD_UNIT;
}

/**
 * Fit a loaded asset hotspot to `angularSizeDeg` and centre its geometry on the hotspot point.
 *
 * Returns null when the hotspot or its three.js object is not available yet — the caller is
 * expected to be polling and can simply try again.
 */
export function normalizeAssetHotspot(
  viewer: KrpanoViewerLike,
  name: string,
  angularSizeDeg: number = ASSET_ANGULAR_SIZE_DEG
): NormalizeResult | null {
  const hotspot = readHotspot(viewer, name);
  const root = hotspot?.threejsobject as AppTHREE.Object3D | undefined;
  if (!hotspot || !root) return null;

  const THREE = resolveThree(viewer);

  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return null;

  // The box is in world space, so it already includes whatever scale is applied to the object
  // and its ancestors. Divide that back out to recover the model's own dimensions.
  //
  // Taken from the object rather than from `hotspot.scale`: those are only equal once krpano
  // has propagated a scale it was told to set, and reading the attribute instead made a second
  // normalisation pass divide a native-sized box by an already-applied scale — which shrank the
  // model by that factor again. Measuring what is actually in the scene is idempotent by
  // construction.
  const worldScaleVec = root.getWorldScale(new THREE.Vector3());
  const observedScale = Math.max(
    Math.abs(worldScaleVec.x),
    Math.abs(worldScaleVec.y),
    Math.abs(worldScaleVec.z)
  );
  const appliedScale = Number.isFinite(observedScale) && observedScale > 0 ? observedScale : 1;

  const size = box.getSize(new THREE.Vector3());
  const nativeMaxDim = Math.max(size.x, size.y, size.z) / appliedScale;
  if (!Number.isFinite(nativeMaxDim) || nativeMaxDim <= 0) return null;

  const distanceCm = readDistanceCm(hotspot);
  const target = targetSizeInWorldUnits(distanceCm, angularSizeDeg, readWorldScaleCm(viewer));
  const scale = target / nativeMaxDim;
  if (!Number.isFinite(scale) || scale <= 0) return null;

  // Recentre on the bounding box so a model whose origin sits away from its geometry is not
  // pushed off the placement point — the same correction AssetViewerWithSkybox.tsx:917 and
  // sceneLayoutSystem.ts:744-750 apply. Best-effort: a wrong size is the bug being fixed, and
  // failing to recentre must not cost us the resize.
  let recentred = false;
  try {
    const worldCenter = box.getCenter(new THREE.Vector3());
    const rootWorld = root.getWorldPosition(new THREE.Vector3());
    const localCenter = worldCenter.sub(rootWorld).divideScalar(appliedScale);
    if (localCenter.lengthSq() > 0) {
      root.children.forEach((child) => child.position.sub(localCenter));
      root.updateWorldMatrix(true, true);
      recentred = true;
    }
  } catch (error) {
    console.warn('[normalizeAssetHotspot] Could not recentre', name, error);
  }

  viewer.call?.(`set(hotspot[${name}].scale, ${scale});`);
  return { scale, nativeMaxDim, distanceCm, recentred };
}

/** Reveal a hotspot that was emitted hidden so an unnormalised model is never visible. */
export function revealAssetHotspot(viewer: KrpanoViewerLike, name: string): void {
  viewer.call?.(`set(hotspot[${name}].visible, true);`);
}
