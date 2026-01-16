/**
 * API Key Types for LearnXR In3D Developer Portal
 */

export enum ApiKeyScope {
  READ = 'read',
  FULL = 'full'
}

export interface ApiKey {
  id: string;
  userId: string;
  label: string;
  keyHash: string;        // Argon2 hash - NEVER the raw key
  keySalt: string;        // Salt for additional security
  keyPrefix: string;      // First 4 + last 4 chars for identification
  scope: ApiKeyScope;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  revokedAt?: string;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    requestCount?: number;
  };
}

export interface CreateApiKeyRequest {
  label: string;
  scope: ApiKeyScope;
}

export interface CreateApiKeyResponse {
  success: boolean;
  apiKey: {
    id: string;
    label: string;
    keyPrefix: string;
    scope: ApiKeyScope;
    createdAt: string;
    rawKey: string;       // Shown ONCE, never stored
  };
  warning: string;
}

export interface ApiKeyListItem {
  id: string;
  label: string;
  keyPrefix: string;
  scope: ApiKeyScope;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface ValidatedApiKeyUser {
  userId: string;
  subscriptionTier: string;
  creditsRemaining: number;
  scope: ApiKeyScope;
}
