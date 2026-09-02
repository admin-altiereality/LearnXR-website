import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Target size (krpano world units, roughly cm) for the longest bounding-box
 * dimension of an auto-scaled 3D asset hotspot. krpano's threejs plugin has no
 * built-in normalization — unlike the React fallback renderers (AssetModel,
 * AssetModelInScene), which fit every model to a fixed box via `2 / maxDim`.
 * Meshy's `auto_size` only normalizes a model to ITS OWN convention, which has
 * no guaranteed relationship to krpano's world scale (a ~500-unit sphere,
 * hotspots placed ~180 units out) — so without this, a model can render as an
 * invisible speck or an oversized blob depending on its native export scale.
 *
 * This value is a starting estimate for "reads as a normal-sized prop at
 * ~180 units viewing distance" — tune it visually if assets look too
 * small/large across a range of lessons.
 */
const KRPANO_ASSET_TARGET_SIZE = 40;

/**
 * Guard against degenerate bounding boxes (zero-size, huge outliers) producing
 * NaN/Infinity or absurd scale.
 *
 * MIN_SCALE is deliberately tiny. It used to be 0.01, which was not a guard but a
 * silent override: a real Meshy asset measured 23380 units across, needing
 * 40/23380 = 0.0017, and got clamped UP to 0.01 — rendering ~5.8x larger than the
 * target. Meshy exports in no fixed unit convention, so the clamp has to sit far
 * enough out to only ever catch genuinely degenerate values.
 */
const MIN_SCALE = 1e-5;
const MAX_SCALE = 50;

const CACHE_PREFIX = 'krpano_asset_scale:';

/**
 * How much of the GLB to read when measuring via the header. The glTF JSON chunk
 * sits at the very front of the file and is small even for large assets (the 110MB
 * asset that motivated this path has a 1,896-byte JSON chunk). 256KB is generous
 * headroom for models with many nodes/materials while still being a rounding error
 * next to downloading the whole file.
 */
const MAX_HEADER_BYTES = 262144;

function readCache(cacheKey: string): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, scale: number): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + cacheKey, String(scale));
  } catch {
    // sessionStorage unavailable (private mode, quota) — non-fatal, just re-measures next time
  }
}

/**
 * Synchronous cache-only lookup (no network). Use this to apply an already-known
 * scale immediately at embed time — never block the initial krpano embed on a
 * fresh measurement; see getKrpanoAssetScale's caller for the live-patch pattern
 * that applies a fresh measurement once it resolves, however long that takes.
 */
export function getCachedKrpanoAssetScale(cacheKey: string): number | null {
  return readCache(cacheKey);
}

let sharedLoader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader();
  return sharedLoader;
}

/**
 * Streams only the leading bytes of a GLB and returns its parsed glTF JSON chunk.
 *
 * Deliberately does NOT send a Range header: `Range` is not CORS-safelisted, so it
 * would trigger a preflight that the asset bucket's CORS policy doesn't allow. Instead
 * we issue a plain GET and cancel the body stream as soon as we have the JSON chunk,
 * which stops the transfer without any preflight.
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
      if (view.getUint32(0, true) !== 0x46546c67) return null; // 'glTF' little-endian
      const jsonLength = view.getUint32(12, true);
      const chunkType = view.getUint32(16, true);
      if (chunkType !== 0x4e4f534a) return null; // 'JSON'
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
 * Every POSITION accessor is required by the glTF spec to carry `min`/`max`, so the
 * per-primitive local AABB is already in the JSON — no vertex data, and no texture
 * decoding, needed. Node transforms still have to be composed down the hierarchy,
 * since a model can be authored large and scaled down by its parent node (or the
 * reverse), and only the composed result reflects what actually gets rendered.
 *
 * Returns null when the data needed isn't present, so the caller can fall back.
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

function scaleFromMaxDim(maxDim: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, KRPANO_ASSET_TARGET_SIZE / maxDim));
}

/**
 * Returns the scale factor that fits a model's longest dimension to
 * KRPANO_ASSET_TARGET_SIZE, caching per `cacheKey` (the asset's stable interaction ID)
 * so repeat views in the same session don't re-measure.
 *
 * Measures from the GLB's header where possible. The previous implementation ran a full
 * `GLTFLoader.load()`, which downloaded the entire model a SECOND time (krpano has already
 * fetched it for rendering) and decoded every texture — ~110MB of transfer and ~160MB of
 * RGBA decode for a value derived from six numbers in the header. Falls back to the full
 * load only when the header can't supply the answer. Never throws.
 */
export async function getKrpanoAssetScale(url: string, cacheKey: string): Promise<number> {
  const cached = readCache(cacheKey);
  if (cached !== null) return cached;

  try {
    const json = await readGlbJsonChunk(url);
    const maxDim = json ? measureBboxFromGltfJson(json) : null;
    if (maxDim !== null) {
      const scale = scaleFromMaxDim(maxDim);
      writeCache(cacheKey, scale);
      return scale;
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

    if (!Number.isFinite(maxDim) || maxDim <= 0) {
      writeCache(cacheKey, 1);
      return 1;
    }

    const scale = scaleFromMaxDim(maxDim);
    writeCache(cacheKey, scale);
    return scale;
  } catch (error) {
    console.warn('[measureGlbScale] Failed to measure asset for auto-scale, using default:', cacheKey, error);
    return 1;
  }
}
