/**
 * Centralized API configuration utility
 * Provides consistent API base URL across the application
 */

/**
 * When opened from the app with ?apiBase=..., we set this so all API calls use the same backend.
 */
declare global {
  interface Window {
    __LEARNXR_API_BASE_URL?: string;
  }
}

/**
 * Get the API base URL from environment variables or fallback to defaults
 * @returns The API base URL string
 */
let _cachedApiBaseUrl: string | null = null;

/**
 * Production API base: same-origin when explicitly opted in, the direct function URL
 * otherwise.
 *
 * Routing through the site's own origin is worth having — responses pass through the
 * Hosting CDN so a cacheable GET can be answered at an edge instead of re-invoking the
 * function, there is no cross-origin preflight, and the request stops round-tripping
 * to us-central1 just to be routed.
 *
 * But it is only correct where that hosting config actually rewrites `/api` to the
 * function. Only firebase.json does; firebase.lexrn1.json and
 * firebase.preview.testing.json have just the SPA catch-all, so on those sites `/api`
 * resolves to index.html and every API call would receive HTML with a 200 status.
 *
 * Inferring this from the hostname is therefore unsafe — `.web.app` covers both the
 * site that has the rewrite and the ones that do not. It has to be a deliberate,
 * per-build choice, so it is an opt-in env flag that defaults off.
 *
 * Absolute (`{origin}/api`) rather than a bare `/api` because consumers such as the
 * krpano XML builder resolve URLs against their own document base, not the page.
 */
const sameOriginApiEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const flag = window.VITE_ENV?.VITE_API_SAME_ORIGIN;
  return flag === 'true' || flag === true;
};

export const resolveProductionApiBase = (projectId: string): string => {
  if (sameOriginApiEnabled()) {
    return `${window.location.origin}/api`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/api`;
};

export const getApiBaseUrl = (): string => {
  if (_cachedApiBaseUrl) return _cachedApiBaseUrl;

  if (typeof window !== 'undefined' && window.__LEARNXR_API_BASE_URL) {
    _cachedApiBaseUrl = window.__LEARNXR_API_BASE_URL;
    return _cachedApiBaseUrl;
  }
  // Check if we're actually running on localhost in the browser
  // This is more reliable than (window.VITE_ENV?.DEV) which can be true in preview builds
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname === '');
  
  // Check for explicit API base URL from environment (but validate it's not localhost for non-localhost environments)
  if (window.VITE_ENV.VITE_API_BASE_URL) {
    const explicitUrl = window.VITE_ENV.VITE_API_BASE_URL;
    // If we're not on localhost but the URL is localhost, use production instead
    if (!isLocalhost && explicitUrl.includes('localhost')) {
      console.warn('⚠️ VITE_API_BASE_URL is set to localhost but app is not running on localhost. Using production URL instead.');
      const projectId = window.VITE_ENV.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
      const productionUrl = resolveProductionApiBase(projectId);
      _cachedApiBaseUrl = productionUrl;
      return productionUrl;
    }
    console.log('🌐 Using explicit API base URL from VITE_API_BASE_URL:', explicitUrl);
    _cachedApiBaseUrl = explicitUrl;
    return explicitUrl;
  }
  
  // Local dev: prefer Express server (5002) so /assistant/tts/regenerate-topic etc. work; fallback to Firebase emulator (5001)
  if (isLocalhost && (window.VITE_ENV?.DEV)) {
    const expressUrl = 'http://localhost:5002/api';
    console.log('🌐 Using local API (Express):', expressUrl);
    _cachedApiBaseUrl = expressUrl;
    return expressUrl;
  }
  
  // Production/preview: same-origin through the Hosting CDN where the rewrite exists,
  // otherwise straight to the function (see resolveProductionApiBase).
  const projectId = window.VITE_ENV.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
  const productionUrl = resolveProductionApiBase(projectId);
  console.log('🌐 Using production API base:', productionUrl);
  _cachedApiBaseUrl = productionUrl;
  return productionUrl;
};

/**
 * Build proxy-asset URL for a given target URL. Decodes the target once before encoding
 * to avoid double-encoding (e.g. signed URLs with & as %26).
 * @param targetUrl - The URL to proxy (may be already percent-encoded)
 * @returns Full proxy URL: {apiBase}/proxy-asset?url={encoded target}
 */
export const getProxyAssetUrl = (targetUrl: string): string => {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/assets/')) return targetUrl;
  if (targetUrl.startsWith('blob:')) return targetUrl;

  // We DO proxy Firebase Storage URLs for 3D assets because Krpano ThreeJS plugin strips
  // query parameters (like ?alt=media&token=...) which causes 403 Forbidden errors if fetched natively.
  const shouldPreserveFirebaseStorageEncoding =
    targetUrl.includes('firebasestorage.googleapis.com') || targetUrl.includes('firebasestorage.app') || targetUrl.includes('appspot.com');

  if (!shouldPreserveFirebaseStorageEncoding) {
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch {
      //
    }
  }

  return `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(targetUrl)}`;
};

/**
 * Build proxy-asset URL for krpano Three.js hotspots. The URL must end in .glb so
 * krpano.utils.spliturl() returns ext="glb" and the plugin accepts it. Target URL
 * is encoded in the path (path-safe base64url) since the loader does not send query.
 * @param targetUrl - The real asset URL (e.g. Meshy CDN); may be percent-encoded
 * @returns Full proxy URL: {apiBase}/proxy-asset/{base64url}/model.glb
 */
export const getProxyAssetUrlForThreejs = (targetUrl: string): string => {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/assets/')) return targetUrl;
  if (targetUrl.startsWith('blob:')) return targetUrl;

  // Our own render-asset URLs already have no query string (token is a path segment) and
  // already redirect to a CORS-enabled signed Storage URL. Wrapping them through
  // /proxy-asset again would pipe the (potentially 100MB+) file through a second Cloud
  // Function, hitting the same 32MB response cap the redirect was added to avoid.
  if (targetUrl.includes('/render-asset/')) return targetUrl;

  const shouldPreserveFirebaseStorageEncoding =
    targetUrl.includes('firebasestorage.googleapis.com') || targetUrl.includes('firebasestorage.app') || targetUrl.includes('appspot.com');

  if (!shouldPreserveFirebaseStorageEncoding) {
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch {
      // leave as-is if decoding fails
    }
  }
  const base64 = btoa(encodeURIComponent(targetUrl));
  const pathSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${getApiBaseUrl()}/proxy-asset/${pathSafe}/model.glb`;
};

/**
 * Get Firebase project configuration
 */
export const getFirebaseProjectConfig = () => {
  const region = 'us-central1';
  const projectId = window.VITE_ENV.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
  return {
    region,
    projectId,
    functionsUrl: `https://${region}-${projectId}.cloudfunctions.net`
  };
};
