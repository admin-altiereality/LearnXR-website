/**
 * Bind Storage object paths to the authenticated user so Admin SDK downloads
 * cannot be used for cross-tenant reads.
 */

const DEFAULT_OWNED_PREFIXES = ['uploads', 'question_papers', 'n8n-builder'] as const;

export type OwnedStoragePrefix = (typeof DEFAULT_OWNED_PREFIXES)[number] | string;

function normalizeStoragePath(raw: string): string {
  return raw.replace(/^\/+/, '').replace(/\\/g, '/');
}

export function isUserOwnedStoragePath(
  uid: string,
  storagePath: string,
  allowedPrefixes: readonly OwnedStoragePrefix[] = DEFAULT_OWNED_PREFIXES,
): boolean {
  if (!uid || typeof storagePath !== 'string' || !storagePath.trim()) return false;

  const path = normalizeStoragePath(storagePath.trim());
  if (!path || path.includes('..') || path.includes('\0')) return false;

  return allowedPrefixes.some((prefix) => path.startsWith(`${prefix}/${uid}/`));
}

export function assertUserOwnedStoragePath(
  uid: string,
  storagePath: string,
  allowedPrefixes: readonly OwnedStoragePrefix[] = DEFAULT_OWNED_PREFIXES,
): string {
  const path = normalizeStoragePath(String(storagePath ?? '').trim());
  if (!isUserOwnedStoragePath(uid, path, allowedPrefixes)) {
    throw new Error('Storage path is not owned by the authenticated user.');
  }
  return path;
}
