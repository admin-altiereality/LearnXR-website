/**
 * URL validation for proxy-asset to prevent SSRF.
 * Only allows fetching from trusted CDN domains.
 */

const ALLOWED_HOST_PATTERNS = [
  /^assets\.meshy\.ai$/i,
  /^[a-z0-9-]+\.meshy\.ai$/i,
  /^cdn\.meshy\.ai$/i,
  /^storage\.googleapis\.com$/i,
  /^firebasestorage\.googleapis\.com$/i,
  /^[a-z0-9-]+\.firebasestorage\.app$/i,
];

const BLOCKED_PATTERNS = [
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
];

/**
 * Validates that a URL is safe to proxy (prevents SSRF).
 * Returns true if the URL is allowed, false otherwise.
 */
export function isProxyAssetUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      return false;
    }

    for (const pattern of ALLOWED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
