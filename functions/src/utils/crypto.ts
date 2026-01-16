/**
 * Cryptographic utilities for API Key Management
 * Uses Argon2 for secure password/key hashing
 */

import * as argon2 from 'argon2';
import * as crypto from 'crypto';

// API Key format: in3d_live_${32 random chars}
const KEY_PREFIX = 'in3d_live_';
const KEY_LENGTH = 32;

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate a new API key in the format: in3d_live_${32 chars}
 */
export function generateApiKey(): string {
  const randomPart = generateRandomString(KEY_LENGTH);
  return `${KEY_PREFIX}${randomPart}`;
}

/**
 * Extract the visible prefix from an API key (first 4 + last 4 chars of random part)
 * Example: in3d_live_ab34…92ff
 */
export function extractKeyPrefix(rawKey: string): string {
  const randomPart = rawKey.replace(KEY_PREFIX, '');
  if (randomPart.length < 8) {
    return randomPart;
  }
  return `${KEY_PREFIX}${randomPart.slice(0, 4)}…${randomPart.slice(-4)}`;
}

/**
 * Hash an API key using Argon2id
 * Returns: { hash, salt }
 */
export async function hashApiKey(rawKey: string): Promise<{ hash: string; salt: string }> {
  // Generate a unique salt for this key
  const salt = crypto.randomBytes(16);
  
  // Hash using Argon2id (recommended for password/key hashing)
  const hash = await argon2.hash(rawKey, {
    type: argon2.argon2id,
    salt: salt,
    memoryCost: 65536,    // 64 MB
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 parallel threads
    hashLength: 64        // 64 byte hash
  });
  
  return {
    hash,
    salt: salt.toString('hex')
  };
}

/**
 * Verify an API key against a stored hash
 */
export async function verifyApiKey(rawKey: string, storedHash: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, rawKey);
  } catch (error) {
    console.error('API key verification error:', error);
    return false;
  }
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with prefix and have correct length
  const expectedLength = KEY_PREFIX.length + KEY_LENGTH;
  return (
    key.startsWith(KEY_PREFIX) &&
    key.length === expectedLength &&
    /^[a-f0-9]+$/.test(key.replace(KEY_PREFIX, ''))
  );
}
