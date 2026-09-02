const RENDER_ASSET_BRIDGE_PREFIX = '/__learnxr_render_asset__/';
const RENDER_ASSET_MODEL_SUFFIX = '/model.glb';
const RENDER_ASSET_API_BASE = 'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function getSourceUrlFromBridgeRequest(requestUrl) {
  const url = new URL(requestUrl);
  const pathname = url.pathname;
  if (!pathname.startsWith(RENDER_ASSET_BRIDGE_PREFIX)) {
    return null;
  }

  const bridgePath = pathname.slice(RENDER_ASSET_BRIDGE_PREFIX.length);
  const pathParts = bridgePath.split('/').filter(Boolean);

  if (pathParts.length === 3 && /^(model|animated_model)\.glb$/i.test(pathParts[2])) {
    const assetId = decodeURIComponent(pathParts[0]);
    const token = decodeURIComponent(pathParts[1]);
    return `${RENDER_ASSET_API_BASE}/render-asset/${encodeURIComponent(assetId)}/${encodeURIComponent(token)}/${pathParts[2]}`;
  }

  if (!pathname.endsWith(RENDER_ASSET_MODEL_SUFFIX)) {
    return null;
  }

  const encodedSourceUrl = bridgePath.slice(0, bridgePath.length - RENDER_ASSET_MODEL_SUFFIX.length);

  try {
    const sourceUrl = decodeURIComponent(encodedSourceUrl);
    const parsed = new URL(sourceUrl);
    if (!parsed.href.includes('/render-asset/') || !/\/model\.glb\/?$/i.test(parsed.pathname)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Streams the asset straight through from the render-asset endpoint.
 *
 * This used to size the file with a HEAD probe and then re-fetch it as a sequence of 4MB
 * `Range` requests, stitching the pieces into one stream. That existed solely to stay under
 * the 32MB response cap on 2nd-gen Cloud Functions — a constraint that no longer applies now
 * that /render-asset 302-redirects to a signed GCS URL, which streams the whole object.
 *
 * The chunking was actively harmful once it became unnecessary. A 110MB model meant ~27
 * sequential round trips, each re-invoking the function and minting a fresh signed URL, and
 * every one of them was a chance to fail: a single non-206 chunk called controller.error()
 * and truncated the stream. Because glTF lays a GLB out with geometry first and image data
 * last, a failure late in that sequence produced a file whose mesh parsed cleanly while its
 * textures did not — the "correct shape but pure white, THREE.GLTFLoader: Couldn't load
 * texture blob:" symptom. One request has no seam to fail at, and is dramatically faster.
 *
 * A Range header is forwarded only when the consumer actually sent one, so range requests
 * still work for anything that seeks (and are answered by GCS directly).
 */
async function createRenderAssetResponse(sourceUrl, request) {
  const rangeHeader = request.headers.get('range');
  const headers = rangeHeader ? { Range: rangeHeader } : undefined;

  const upstream = await fetch(sourceUrl, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    mode: 'cors',
    cache: 'no-store',
    redirect: 'follow',
    headers,
  });

  if (!(upstream.ok || upstream.status === 206)) {
    throw new Error(`Render asset fetch failed with ${upstream.status}`);
  }

  // Mirror the upstream framing rather than asserting our own Content-Length: declaring a
  // length that disagrees with the bytes actually delivered is what silently truncates a body.
  const responseHeaders = new Headers({
    'Content-Type': 'model/gltf-binary',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  });

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  if (request.method === 'HEAD') {
    return new Response(null, { status: upstream.status, headers: responseHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

self.addEventListener('fetch', (event) => {
  const sourceUrl = getSourceUrlFromBridgeRequest(event.request.url);
  if (!sourceUrl) return;

  event.respondWith(
    createRenderAssetResponse(sourceUrl, event.request).catch((error) => {
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
});
