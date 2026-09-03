import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ASSET_ANGULAR_SIZE_DEG, ASSET_DISTANCE_CM, scaleForAsset } from './assetLayout';

/**
 * Measures how large a GLB actually is, so the layout can scale it to a target angular size.
 *
 * This module deliberately reports a MEASUREMENT (the longest bounding-box dimension) rather
 * than a conclusion (a scale factor). Scale depends on where the asset ends up — see
 * assetLayout.scaleForAsset — whereas maxDim is an intrinsic property of the file that never
 * changes. Caching the measurement instead of the conclusion means retuning the layout
 * constants can never leave stale, wrongly-scaled assets behind, which is exactly what
 * happened when this cache held derived scales computed under an older clamp.
 *
 * krpano's threejs plugin has no built-in normalization, unlike the React fallback renderers
 * which fit every model via `2 / maxDim`. Meshy's own `auto_size` normalizes to its own
 * convention with no fixed relationship to krpano's centimetre world — two real lesson assets
 * measured 0.06 and 23,380 units across.
 */

/** Bumped when the measurement itself changes meaning; unrelated to layout tuning. */
const CACHE_PREFIX = 'krpano_asset_bbox:v1:';

/**
 * How much of the GLB to read when measuring from the header. The glTF JSON chunk sits at the
 * very front and is small even for large assets (a 110MB asset that motivated this path has a
 * 1,896-byte JSON chunk). 256KB is generous headroom while still being a rounding error next
 * to downloading the whole file.
 */
const MAX_HEADER_BYTES = 262144;

/**
 * localStorage, not sessionStorage: the measurement is a property of the GLB itself
 * and never changes for a given cache key, so scoping it to one tab meant every
 * reload paid to re-read the model header (or, on the fallback path below, to
 * download the whole model a second time). Reading it back is also what lets the
 * embed apply a known scale without blocking.
 */
function readCache(cacheKey: string): number | null {
  try {
    const raw =
      localStorage.getItem(CACHE_PREFIX + cacheKey) ??
      // Fall back to any value written by the previous sessionStorage-based build.
      sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, maxDim: number): void {
  try {
    localStorage.setItem(CACHE_PREFIX + cacheKey, String(maxDim));
  } catch {
    // Storage unavailable (private mode, quota) — non-fatal, just re-measures next time
  }
}

/** Synchronous cache-only lookup of the raw measurement (no network). */
export function getCachedAssetMaxDim(cacheKey: string): number | null {
  return readCache(cacheKey);
}

/**
 * Cache-only scale, for applying an already-known size at embed time without blocking.
 * Returns null when the asset has not been measured yet.
 */
export function getCachedKrpanoAssetScale(
  cacheKey: string,
  distance = ASSET_DISTANCE_CM,
  angularSizeDeg = ASSET_ANGULAR_SIZE_DEG
): number | null {
  const maxDim = readCache(cacheKey);
  return maxDim === null ? null : scaleForAsset(maxDim, distance, angularSizeDeg);
}

let sharedLoader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader();
  return sharedLoader;
}

/**
 * Streams only the leading bytes of a GLB and returns its parsed glTF JSON chunk.
 *
 * Deliberately does NOT send a Range header: Range is not CORS-safelisted, so it would
 * trigger a preflight. Instead we issue a plain GET and cancel the body stream as soon as we
 * have the JSON chunk, which stops the transfer without any preflight.
 */
async function readGlbJsonChunk(url: string): Promise<any | null> {
  const response = await fetch(url);
  if (!response.ok || !response.body) return null;

  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;

  try {
    while (received < MAX_HEADER_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      parts.push(value);
      received += value.length;

      // Need at least the 12-byte GLB header + 8-byte chunk header to know how far to read.
      if (received < 20) continue;

      const buf = concat(parts, received);
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (view.getUint32(0, true) !== 0x46546c67) return null; // glTF magic, little-endian
      const jsonLength = view.getUint32(12, true);
      const chunkType = view.getUint32(16, true);
      if (chunkType !== 0x4e4f534a) return null; // JSON chunk type
      if (20 + jsonLength > MAX_HEADER_BYTES) return null; // unexpectedly huge; use full loader
      if (received < 20 + jsonLength) continue;

      const text = new TextDecoder().decode(buf.subarray(20, 20 + jsonLength));
      return JSON.parse(text);
    }
  } finally {
    // Aborts the rest of the transfer — this is what keeps us from pulling the whole file.
    void reader.cancel().catch(() => {});
  }

  return null;
}

function concat(parts: Uint8Array[], total: number): Uint8Array {
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Computes the world-space bounding box of a glTF scene using only its JSON chunk.
 *
 * Every POSITION accessor is required by the glTF spec to carry min/max, so the per-primitive
 * local AABB is already in the JSON — no vertex data, and no texture decoding, needed. Node
 * transforms still have to be composed down the hierarchy, since a model can be authored
 * large and scaled down by its parent node (or the reverse), and only the composed result
 * reflects what actually gets rendered.
 *
 * Returns null when the data needed is absent, so the caller can fall back.
 */
function measureBboxFromGltfJson(json: any): number | null {
  const nodes = json?.nodes;
  const meshes = json?.meshes;
  const accessors = json?.accessors;
  if (!Array.isArray(nodes) || !Array.isArray(meshes) || !Array.isArray(accessors)) return null;

  const sceneIndex = typeof json.scene === 'number' ? json.scene : 0;
  const roots = json?.scenes?.[sceneIndex]?.nodes;
  if (!Array.isArray(roots)) return null;

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  let sawAny = false;

  const visit = (nodeIndex: number, parentMatrix: THREE.Matrix4, depth: number): void => {
    // Cheap runaway guard — glTF hierarchies are trees, but the file is untrusted input.
    if (depth > 64) return;
    const node = nodes[nodeIndex];
    if (!node) return;

    const local = new THREE.Matrix4();
    if (Array.isArray(node.matrix) && node.matrix.length === 16) {
      // glTF stores column-major, which is exactly what Matrix4.fromArray expects.
      local.fromArray(node.matrix);
    } else {
      const t = Array.isArray(node.translation) ? node.translation : [0, 0, 0];
      const r = Array.isArray(node.rotation) ? node.rotation : [0, 0, 0, 1];
      const s = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
      local.compose(
        new THREE.Vector3(t[0], t[1], t[2]),
        new THREE.Quaternion(r[0], r[1], r[2], r[3]),
        new THREE.Vector3(s[0], s[1], s[2])
      );
    }

    const world = new THREE.Matrix4().multiplyMatrices(parentMatrix, local);

    if (typeof node.mesh === 'number') {
      const primitives = meshes[node.mesh]?.primitives;
      if (Array.isArray(primitives)) {
        for (const prim of primitives) {
          const posIndex = prim?.attributes?.POSITION;
          if (typeof posIndex !== 'number') continue;
          const accessor = accessors[posIndex];
          const min = accessor?.min;
          const max = accessor?.max;
          if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) continue;

          // Transform all 8 corners: under rotation the axis-aligned box of the
          // transformed corners is correct, whereas transforming only min/max is not.
          for (let i = 0; i < 8; i++) {
            corner.set(
              i & 1 ? max[0] : min[0],
              i & 2 ? max[1] : min[1],
              i & 4 ? max[2] : min[2]
            ).applyMatrix4(world);
            box.expandByPoint(corner);
            sawAny = true;
          }
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child, world, depth + 1);
    }
  };

  const identity = new THREE.Matrix4();
  for (const root of roots) visit(root, identity, 0);
  if (!sawAny || box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  return Number.isFinite(maxDim) && maxDim > 0 ? maxDim : null;
}

/**
 * Returns a model's longest bounding-box dimension, cached per cacheKey (the asset's stable
 * interaction ID) so repeat views in the same session do not re-measure.
 *
 * Measures from the GLB header where possible. An earlier implementation ran a full
 * GLTFLoader.load(), which downloaded the entire model a SECOND time (krpano has already
 * fetched it for rendering) and decoded every texture — ~110MB of transfer and ~160MB of RGBA
 * decode for a value derived from six numbers in the header. Falls back to the full load only
 * when the header cannot supply the answer. Never throws; returns null if it cannot measure.
 */
export async function getAssetMaxDim(url: string, cacheKey: string): Promise<number | null> {
  const cached = readCache(cacheKey);
  if (cached !== null) return cached;

  try {
    const json = await readGlbJsonChunk(url);
    const maxDim = json ? measureBboxFromGltfJson(json) : null;
    if (maxDim !== null) {
      writeCache(cacheKey, maxDim);
      return maxDim;
    }
  } catch (error) {
    console.warn('[measureGlbScale] Header measurement failed, falling back to full load:', cacheKey, error);
  }

  try {
    const gltf = await new Promise<any>((resolve, reject) => {
      getLoader().load(url, resolve, undefined, reject);
    });

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) return null;

    writeCache(cacheKey, maxDim);
    return maxDim;
  } catch (error) {
    console.warn('[measureGlbScale] Failed to measure asset, leaving it unscaled:', cacheKey, error);
    return null;
  }
}

/**
 * Convenience wrapper: measure the asset and convert to a scale factor for the distance it is
 * actually being placed at. Falls back to 1 (unscaled) if the asset cannot be measured.
 */
export async function getKrpanoAssetScale(
  url: string,
  cacheKey: string,
  distance = ASSET_DISTANCE_CM,
  angularSizeDeg = ASSET_ANGULAR_SIZE_DEG
): Promise<number> {
  const maxDim = await getAssetMaxDim(url, cacheKey);
  return maxDim === null ? 1 : scaleForAsset(maxDim, distance, angularSizeDeg);
}
