const RENDER_ASSET_SW_VERSION = '20260706-bridge-4';
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

export function toRenderAssetBridgeUrl(renderUrl: string): string {
  const match = renderUrl.match(/\/render-asset\/([^/]+)\/([^/]+)\/(model|animated_model)\.glb\/?$/i);
  if (match) {
    return `${RENDER_ASSET_BRIDGE_PREFIX}/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}/${match[3]}.glb`;
  }

  return `${RENDER_ASSET_BRIDGE_PREFIX}/${encodeURIComponent(renderUrl)}/model.glb`;
}
