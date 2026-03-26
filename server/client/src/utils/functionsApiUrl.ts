/**
 * Firebase Web SDK project (Auth / Firestore) from Vite env.
 */
export function getFirebaseProjectIdForApi(): string {
  return import.meta.env.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
}

/**
 * GCP project id where the `api` HTTPS function is deployed.
 * Override when Hosting is on one Firebase project (e.g. lexrn1) but Functions run on another (e.g. learnxr-evoneuralai).
 */
export function getCloudFunctionsApiProjectId(): string {
  return (
    import.meta.env.VITE_CLOUD_FUNCTIONS_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    'learnxr-evoneuralai'
  );
}

/**
 * Functions emulator URL (path includes project id).
 */
export function getFunctionsEmulatorApiUrl(region = 'us-central1'): string {
  const projectId = getCloudFunctionsApiProjectId();
  return `http://localhost:5001/${projectId}/${region}/api`;
}

/**
 * Production / preview: HTTPS Cloud Functions (2nd gen) base URL for the Express `api` function.
 */
export function getCloudFunctionsApiUrl(region = 'us-central1'): string {
  const projectId = getCloudFunctionsApiProjectId();
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
}

/**
 * Same-origin `/api` via Firebase Hosting rewrites. Opt-in only: altiereality can be hosted on lexrn1
 * while `api` runs on learnxr-evoneuralai — default is off so the client calls the Functions URL for the right project.
 * Set `VITE_USE_HOSTING_API_REWRITE=true` when Hosting rewrites `/api` to the `api` function in the **same** project you want.
 */
export function getFirebaseHostingApiBaseUrl(): string {
  if (import.meta.env.VITE_USE_HOSTING_API_REWRITE !== 'true') {
    return '';
  }
  if (typeof window === 'undefined') return '';
  const h = window.location.hostname;
  if (h.endsWith('.web.app') || h.endsWith('.firebaseapp.com')) {
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }
  return '';
}
