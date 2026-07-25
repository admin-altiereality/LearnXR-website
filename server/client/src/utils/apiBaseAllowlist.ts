const DEFAULT_ALLOWED_API_BASES = [
  '/api',
  'http://localhost:5002/api',
  'http://localhost:5001/api',
  'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api',
  'https://us-central1-altiereality.cloudfunctions.net/api',
];

export function resolveAllowedApiBase(candidate: string | null | undefined): string {
  const fallback = '/api';
  if (!candidate?.trim()) return fallback;

  const normalized = candidate.trim().replace(/\/$/, '');
  const projectId =
    (typeof window !== 'undefined' && window.VITE_ENV?.VITE_FIREBASE_PROJECT_ID) ||
    'learnxr-evoneuralai';

  const allowed = new Set(DEFAULT_ALLOWED_API_BASES);

  try {
    const parsed = new URL(normalized, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const isSameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;
    const isProjectHosting =
      host.endsWith('.web.app') ||
      host.endsWith('.firebaseapp.com') ||
      host === `${projectId}.web.app`;
    const isProjectFunctions = host === `us-central1-${projectId}.cloudfunctions.net`;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';

    if (isSameOrigin || isProjectHosting || isProjectFunctions || isLocalhost) {
      if (allowed.has(normalized)) return normalized;
      if (normalized === '/api' || normalized.endsWith('/api')) return normalized;
    }
  } catch {
    return fallback;
  }

  console.warn('[apiBase] Rejected untrusted apiBase:', normalized);
  return fallback;
}
