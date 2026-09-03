// Bumped whenever render-asset-sw.js changes; the query string is what forces an
// update, since the worker is registered with updateViaCache: 'none'.
const RENDER_ASSET_SW_VERSION = '20260903-cache-1';
const RENDER_ASSET_BRIDGE_PREFIX = '/__learnxr_render_asset__';

let serviceWorkerReadyPromise: Promise<boolean> | null = null;

function canUseServiceWorker(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function waitForController(timeoutMs = 10000): Promise<boolean> {
  if (navigator.serviceWorker.controller) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.clearTimeout(timer);
      resolve(value);
    };
    const onControllerChange = () => finish(Boolean(navigator.serviceWorker.controller));
    const timer = window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  });
}

export async function ensureRenderAssetBridgeReady(): Promise<boolean> {
  if (!canUseServiceWorker()) return false;
  if (!serviceWorkerReadyPromise) {
    serviceWorkerReadyPromise = (async () => {
      try {
        const registration = await navigator.serviceWorker.register(`/render-asset-sw.js?v=${RENDER_ASSET_SW_VERSION}`, {
          scope: '/',
          updateViaCache: 'none',
        });
        await registration.update().catch(() => undefined);
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        await navigator.serviceWorker.ready;
        const ready = await waitForController();
        console.log('[renderAssetBridge] Service worker ready:', ready);
        return ready;
      } catch (error) {
        console.warn('[renderAssetBridge] Service worker registration failed:', error);
        return false;
      }
    })();
  }

  return serviceWorkerReadyPromise;
}

/**
 * Wrap a render-asset URL in the same-origin bridge path the service worker intercepts.
 *
 * The whole absolute URL is encoded into one path segment, rather than being split
 * into {assetId}/{token} for the worker to reassemble. Reassembly required the worker
 * to know the API base, and a service worker has no access to the Vite env — it was
 * guessing from the hostname, which is wrong on any Firebase site whose config lacks
 * the /api rewrite (firebase.lexrn1.json has only the SPA catch-all, so /api would
 * have resolved to index.html and served HTML as a GLB). The URL stored in Firestore
 * is already correct for its environment, so carrying it verbatim removes the guess.
 *
 * The trailing `/model.glb` is literal and must stay: krpano's utils.spliturl() reads
 * the extension off the end of the path to decide the loader.
 */
export function toRenderAssetBridgeUrl(renderUrl: string): string {
  return `${RENDER_ASSET_BRIDGE_PREFIX}/${encodeURIComponent(renderUrl)}/model.glb`;
}
