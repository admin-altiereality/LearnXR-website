/**
 * Centralized API configuration utility
 * Provides consistent API base URL across the application
 */

/**
 * Get the API base URL from environment variables or fallback to defaults
 * @returns The API base URL string
 */
export const getApiBaseUrl = (): string => {
  // Check if we're actually running on localhost in the browser
  // This is more reliable than import.meta.env.DEV which can be true in preview builds
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname === '');
  
  // Check for explicit API base URL from environment (but validate it's not localhost for non-localhost environments)
  if (import.meta.env.VITE_API_BASE_URL) {
    const explicitUrl = import.meta.env.VITE_API_BASE_URL;
    // If we're not on localhost but the URL is localhost, use production instead
    if (!isLocalhost && explicitUrl.includes('localhost')) {
      console.warn('⚠️ VITE_API_BASE_URL is set to localhost but app is not running on localhost. Using production URL instead.');
      const region = 'us-central1';
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
      const productionUrl = `https://${region}-${projectId}.cloudfunctions.net/api`;
      console.log('🌐 Using production Firebase Functions:', productionUrl);
      return productionUrl;
    }
    console.log('🌐 Using explicit API base URL from VITE_API_BASE_URL:', explicitUrl);
    return explicitUrl;
  }
  
  // Local dev: prefer Express server (5002) so /assistant/tts/regenerate-topic etc. work; fallback to Firebase emulator (5001)
  if (isLocalhost && import.meta.env.DEV) {
    const expressUrl = 'http://localhost:5002/api';
    console.log('🌐 Using local API (Express):', expressUrl);
    return expressUrl;
  }
  
  // Use Firebase Functions in production/preview (default)
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
  const productionUrl = `https://${region}-${projectId}.cloudfunctions.net/api`;
  console.log('🌐 Using production Firebase Functions:', productionUrl, {
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
    isLocalhost,
    isDev: import.meta.env.DEV,
    mode: import.meta.env.MODE
  });
  return productionUrl;
};

/**
 * Build proxy-asset URL for a given target URL. Decodes the target once before encoding
 * to avoid double-encoding (e.g. signed URLs with & as %26).
 * @param targetUrl - The URL to proxy (may be already percent-encoded)
 * @returns Full proxy URL: {apiBase}/proxy-asset?url={encoded target}
 */
export const getProxyAssetUrl = (targetUrl: string): string => {
  try {
    targetUrl = decodeURIComponent(targetUrl);
  } catch {
    // leave as-is if decoding fails
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
  try {
    targetUrl = decodeURIComponent(targetUrl);
  } catch {
    // leave as-is if decoding fails
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
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
  return {
    region,
    projectId,
    functionsUrl: `https://${region}-${projectId}.cloudfunctions.net`
  };
};

