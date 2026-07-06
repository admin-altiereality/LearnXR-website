const RENDER_ASSET_BRIDGE_PREFIX = '/__learnxr_render_asset__/';
const RENDER_ASSET_MODEL_SUFFIX = '/model.glb';
const RENDER_ASSET_CHUNK_BYTES = 4 * 1024 * 1024;
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

async function fetchSourceSize(sourceUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(sourceUrl, {
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.ok) {
      const size = Number(response.headers.get('content-length') || 0);
      if (Number.isFinite(size) && size > 0) {
        return size;
      }
    }
  } catch (error) {
    console.warn('[render-asset-sw] Render asset HEAD failed; falling back to range size probe:', error);
  } finally {
    clearTimeout(timer);
  }

  return fetchSourceSizeFromRange(sourceUrl);
}

async function fetchSourceSizeFromRange(sourceUrl) {
  const response = await fetch(sourceUrl, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      Range: 'bytes=0-0',
    },
  });

  if (!(response.ok || response.status === 206)) {
    throw new Error(`Render asset range size probe failed with ${response.status}`);
  }

  response.body?.cancel();
  const contentRange = response.headers.get('content-range') || '';
  const rangeMatch = /\/(\d+)$/.exec(contentRange);
  const size = rangeMatch
    ? Number(rangeMatch[1])
    : Number(response.headers.get('content-length') || 0);

  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Render asset size is unavailable');
  }

  return size;
}

async function pipeRangeToController(sourceUrl, start, end, controller) {
  const response = await fetch(sourceUrl, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      Range: `bytes=${start}-${end}`,
    },
  });

  if (!(response.ok || response.status === 206)) {
    throw new Error(`Render asset range ${start}-${end} failed with ${response.status}`);
  }

  if (!response.body) {
    controller.enqueue(new Uint8Array(await response.arrayBuffer()));
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) controller.enqueue(value);
  }
}

function createHeaders(size, extra = {}) {
  return {
    'Content-Type': 'model/gltf-binary',
    'Content-Length': String(size),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function parseRangeHeader(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (match[1] === '' && match[2] !== '') {
    const suffixLength = Number(match[2]);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end || start >= size) return null;
  return { start, end };
}

async function createRangeResponse(sourceUrl, size, start, end) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await pipeRangeToController(sourceUrl, start, end, controller);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 206,
    headers: createHeaders(end - start + 1, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
    }),
  });
}

async function createRenderAssetResponse(sourceUrl, request) {
  const size = await fetchSourceSize(sourceUrl);

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: createHeaders(size),
    });
  }

  const range = parseRangeHeader(request.headers.get('range'), size);
  if (range) {
    return createRangeResponse(sourceUrl, size, range.start, range.end);
  }

  let offset = 0;

  const stream = new ReadableStream({
    async pull(controller) {
      if (offset >= size) {
        controller.close();
        return;
      }

      const start = offset;
      const end = Math.min(start + RENDER_ASSET_CHUNK_BYTES - 1, size - 1);
      offset = end + 1;
      try {
        await pipeRangeToController(sourceUrl, start, end, controller);
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: createHeaders(size),
  });
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
