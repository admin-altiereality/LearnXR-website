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
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
      const productionUrl = `https://${region}-${projectId}.cloudfunctions.net/api`;
      console.log('🌐 Using production Firebase Functions:', productionUrl);
      return productionUrl;
    }
    console.log('🌐 Using explicit API base URL from VITE_API_BASE_URL:', explicitUrl);
    return explicitUrl;
  }
  
  // Only use local emulator if we're actually on localhost AND in dev mode
  if (isLocalhost && import.meta.env.DEV) {
    const localUrl = 'http://localhost:5001/in3devoneuralai/us-central1/api';
    console.log('🌐 Using local Firebase emulator:', localUrl);
    return localUrl;
  }
  
  // Use Firebase Functions in production/preview (default)
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
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
 * Get Firebase project configuration
 */
export const getFirebaseProjectConfig = () => {
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
  return {
    region,
    projectId,
    functionsUrl: `https://${region}-${projectId}.cloudfunctions.net`
  };
};

