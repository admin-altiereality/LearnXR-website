/**
 * SSRF guards for server-side fetches of user-supplied URLs (e.g. PDFs).
 */

import { isUserOwnedStoragePath, type OwnedStoragePrefix } from './storagePathOwnership';

const ALLOWED_HOST_PATTERNS = [
  /^storage\.googleapis\.com$/i,
  /^firebasestorage\.googleapis\.com$/i,
  /^[a-z0-9-]+\.firebasestorage\.app$/i,
];

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^\[::1\]$/,
  /^0:0:0:0:0:0:0:1$/,
  /^metadata\.google\.internal$/i,
];

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export const MAX_SAFE_FETCH_BYTES = 25 * 1024 * 1024;
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function isHostnameAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) return false;
  if (IPV4_RE.test(host)) return false;
  return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

/**
 * Extract object path from Firebase / GCS download URLs when present.
 */
export function extractObjectPathFromStorageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'firebasestorage.googleapis.com' || host.endsWith('.firebasestorage.app')) {
      const match = parsed.pathname.match(/\/o\/([^?]+)/);
      if (!match?.[1]) return null;
      return decodeURIComponent(match[1]);
    }

    if (host === 'storage.googleapis.com') {
      const parts = parsed.pathname.replace(/^\/+/, '').split('/');
      if (parts.length < 2) return null;
      return decodeURIComponent(parts.slice(1).join('/'));
    }

    return null;
  } catch {
    return null;
  }
}

export function assertSafeUserPdfUrl(
  url: string,
  uid: string,
  allowedPrefixes?: readonly OwnedStoragePrefix[],
): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid PDF URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('PDF URL must use HTTPS.');
  }

  if (!isHostnameAllowed(parsed.hostname)) {
    throw new Error('PDF URL host is not allowed.');
  }

  const objectPath = extractObjectPathFromStorageUrl(parsed.toString());
  if (!objectPath || !isUserOwnedStoragePath(uid, objectPath, allowedPrefixes)) {
    throw new Error('PDF URL does not point to a user-owned storage object.');
  }

  return parsed;
}

export async function fetchUrlWithLimits(
  url: string,
  options?: { maxBytes?: number; timeoutMs?: number },
): Promise<Buffer> {
  const maxBytes = options?.maxBytes ?? MAX_SAFE_FETCH_BYTES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`PDF URL fetch failed: ${res.status}`);
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error('PDF exceeds maximum allowed size.');
    }

    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new Error('PDF exceeds maximum allowed size.');
    }

    return Buffer.from(ab);
  } finally {
    clearTimeout(timer);
  }
}
