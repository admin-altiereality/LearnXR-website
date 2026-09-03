/**
 * Asset service worker.
 *
 * Two jobs:
 *
 * 1. Bridge krpano's GLB loads through a same-origin URL. krpano's threejs plugin
 *    strips query strings, and /render-asset 302s to a signed Cloud Storage URL, so
 *    the model has to be fetched here and handed back.
 *
 * 2. Cache the bytes. This used to be a pure pass-through that set `no-store` on both
 *    the upstream fetch and its own response, so a 60-110MB model was re-downloaded
 *    in full on every mount, for every student, forever - which also re-invoked the
 *    Cloud Function (a Firestore read plus a signed-URL mint) each time. The
 *    /render-asset path is a stable key: the token is a path segment and changes when
 *    the asset is replaced, so a cached entry can never go stale for a regenerated
 *    model, and superseded entries simply age out of the LRU.
 */

const CACHE_NAME = 'learnxr-assets-v1';
const RENDER_ASSET_BRIDGE_PREFIX = '/__learnxr_render_asset__/';
const RENDER_ASSET_MODEL_SUFFIX = '/model.glb';
/**
 * Base used only for the legacy {assetId}/{token} bridge form, which a client bundle
 * cached from before this worker shipped may still emit.
 *
 * It is deliberately the absolute function URL and nothing cleverer. A service worker
 * cannot read the Vite env, so any attempt to derive this from the hostname is a
 * guess — and it is wrong on every Firebase site whose config lacks the /api rewrite.
 * firebase.lexrn1.json has only the SPA catch-all, so there /api returns index.html
 * with a 200, which would be handed back as a GLB and then cached.
 *
 * Current clients encode the whole absolute URL into the bridge path instead
 * (see toRenderAssetBridgeUrl), so this constant is a compatibility shim.
 */
const LEGACY_API_BASE = 'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api';

/** Total bytes the asset cache may hold before least-recently-used entries are evicted. */
const CACHE_BUDGET_BYTES = 1.5 * 1024 * 1024 * 1024;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('learnxr-assets-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// LRU bookkeeping. The Cache API carries no size or recency metadata of its own,
// so usage is tracked alongside it in IndexedDB.
// ---------------------------------------------------------------------------

const META_DB = 'learnxr-asset-cache-meta';
const META_STORE = 'entries';

function openMetaDb() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(META_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'url' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch (error) {
      resolve(null);
    }
  });
}

function metaRequest(mode, work) {
  return openMetaDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(META_STORE, mode);
          const request = work(tx.objectStore(META_STORE));
          request.onsuccess = () => resolve(request.result === undefined ? null : request.result);
          request.onerror = () => resolve(null);
        } catch (error) {
          resolve(null);
        }
      })
  );
}

function recordUsage(url, size) {
  return metaRequest('readwrite', (store) => store.put({ url, size, lastUsed: Date.now() }));
}

function forgetUsage(url) {
  return metaRequest('readwrite', (store) => store.delete(url));
}

function readAllUsage() {
  return metaRequest('readonly', (store) => store.getAll());
}

/** Evict least-recently-used entries until the cache fits within the budget. */
async function enforceBudget(headroomBytes) {
  const headroom = headroomBytes || 0;
  const entries = (await readAllUsage()) || [];
  let total = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  if (total + headroom <= CACHE_BUDGET_BYTES) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  const oldestFirst = entries.slice().sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));

  for (const entry of oldestFirst) {
    if (total + headroom <= CACHE_BUDGET_BYTES) {
      break;
    }
    await cache.delete(entry.url);
    await forgetUsage(entry.url);
    total -= entry.size || 0;
    console.log('[render-asset-sw] Evicted', entry.url);
  }
}

// ---------------------------------------------------------------------------
// Request classification
// ---------------------------------------------------------------------------

function getSourceUrlFromBridgeRequest(requestUrl) {
  const url = new URL(requestUrl);
  const pathname = url.pathname;
  if (!pathname.startsWith(RENDER_ASSET_BRIDGE_PREFIX)) {
    return null;
  }

  const bridgePath = pathname.slice(RENDER_ASSET_BRIDGE_PREFIX.length);
  const pathParts = bridgePath.split('/').filter(Boolean);

  // Legacy form, emitted by client bundles predating the encoded-URL bridge.
  if (pathParts.length === 3 && /^(model|animated_model)\.glb$/i.test(pathParts[2])) {
    const assetId = encodeURIComponent(decodeURIComponent(pathParts[0]));
    const token = encodeURIComponent(decodeURIComponent(pathParts[1]));
    return LEGACY_API_BASE + '/render-asset/' + assetId + '/' + token + '/' + pathParts[2];
  }

  if (!pathname.endsWith(RENDER_ASSET_MODEL_SUFFIX)) {
    return null;
  }

  const encodedSourceUrl = bridgePath.slice(0, bridgePath.length - RENDER_ASSET_MODEL_SUFFIX.length);

  try {
    const sourceUrl = decodeURIComponent(encodedSourceUrl);
    const parsed = new URL(sourceUrl);
    if (
      !parsed.href.includes('/render-asset/') ||
      !/\/(model|animated_model)\.glb\/?$/i.test(parsed.pathname)
    ) {
      return null;
    }
    return parsed.href;
  } catch (error) {
    return null;
  }
}

/**
 * Immutable lesson media worth caching on its way past: skybox panoramas, chapter
 * images and pre-generated narration audio in our own Storage bucket.
 *
 * Each is uploaded under a timestamped path and never rewritten, so the URL is a safe
 * key. Video is deliberately excluded: the player range-requests those, and a partial
 * response must never be stored.
 */
function isCacheableStorageMedia(url) {
  const host = url.hostname.toLowerCase();
  const isStorageHost =
    host === 'firebasestorage.googleapis.com' || host.endsWith('.firebasestorage.app');
  if (!isStorageHost) {
    return false;
  }

  let path = url.pathname;
  try {
    path = decodeURIComponent(url.pathname);
  } catch (error) {
    /* keep the raw pathname */
  }

  if (/video_vr_tour|\.mp4|\.webm|\.mov/i.test(path)) {
    return false;
  }
  return /skyboxes|chapter_images|audio|tts/i.test(path);
}

// ---------------------------------------------------------------------------
// Fetch handling
// ---------------------------------------------------------------------------

/**
 * Store a response, but only when it is provably whole.
 *
 * `cache.put` consumes the body stream and rejects without committing if that stream
 * errors, which is the guarantee that matters here: glTF lays a GLB out with geometry
 * first and image data last, so a truncated model parses to the right shape and then
 * renders pure white. A partial body must never reach the cache, or that failure
 * becomes permanent for that device.
 */
async function cacheResponse(key, response) {
  if (response.status !== 200) {
    return;
  }
  if (response.type !== 'basic' && response.type !== 'cors') {
    return;
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (!declaredLength) {
    return;
  }

  // Never store an HTML body. A misconfigured host can answer an asset URL with the
  // SPA shell at status 200 — a hosting config whose only rewrite is the catch-all
  // does exactly that — and caching that would turn a transient misroute into a
  // permanently broken model on the device.
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    console.warn('[render-asset-sw] Refusing to cache an HTML response for', key);
    return;
  }

  try {
    await enforceBudget(declaredLength);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, response);
    await recordUsage(key, declaredLength);
  } catch (error) {
    if (error && error.name === 'QuotaExceededError') {
      console.warn('[render-asset-sw] Quota exceeded; evicting and skipping this entry.');
      await enforceBudget(CACHE_BUDGET_BYTES / 4);
      return;
    }
    console.warn('[render-asset-sw] Failed to cache', key, error);
  }
}

async function createRenderAssetResponse(sourceUrl, request, event) {
  const rangeHeader = request.headers.get('range');

  // A whole-file cache entry can only answer a whole-file request.
  if (!rangeHeader && request.method === 'GET') {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(sourceUrl);
    if (hit) {
      console.log('[render-asset-sw] Cache hit', sourceUrl);
      recordUsage(sourceUrl, Number(hit.headers.get('content-length') || 0));
      return hit;
    }
  }

  const upstream = await fetch(sourceUrl, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    mode: 'cors',
    redirect: 'follow',
    headers: rangeHeader ? { Range: rangeHeader } : undefined,
  });

  if (!(upstream.ok || upstream.status === 206)) {
    throw new Error('Render asset fetch failed with ' + upstream.status);
  }

  if (request.method === 'HEAD') {
    return new Response(null, { status: upstream.status, headers: upstream.headers });
  }

  // Cache a clone only for whole-file 200s. `waitUntil` keeps the worker alive until
  // the copy is committed, which for a large model outlives the page's own read.
  if (!rangeHeader && upstream.status === 200) {
    event.waitUntil(cacheResponse(sourceUrl, upstream.clone()));
  }

  return upstream;
}

/** Pass-through with a whole-file cache, for immutable media in our own bucket. */
async function createStorageMediaResponse(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const key = request.url;

  const hit = await cache.match(key);
  if (hit) {
    recordUsage(key, Number(hit.headers.get('content-length') || 0));
    return hit;
  }

  const upstream = await fetch(request);
  if (upstream.status === 200) {
    event.waitUntil(cacheResponse(key, upstream.clone()));
  }
  return upstream;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return;
  }

  const sourceUrl = getSourceUrlFromBridgeRequest(request.url);
  if (sourceUrl) {
    event.respondWith(
      createRenderAssetResponse(sourceUrl, request, event).catch((error) => {
        console.error('[render-asset-sw] Failed to bridge render asset:', error);
        return new Response('Failed to load render asset', {
          status: 502,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      })
    );
    return;
  }

  // Range requests are answered by the origin; a partial body is never cached.
  if (request.method === 'GET' && !request.headers.get('range')) {
    let url;
    try {
      url = new URL(request.url);
    } catch (error) {
      return;
    }
    if (isCacheableStorageMedia(url)) {
      event.respondWith(createStorageMediaResponse(request, event).catch(() => fetch(request)));
    }
  }
});
