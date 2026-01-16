/**
 * API Key Service - Client Side
 * Handles API key management requests
 */

import api from '../config/axios';
import { ApiKeyScope, ApiKeyListItem } from '../types/apiKey';

// Re-export types for convenience
export type { ApiKeyListItem };

export interface CreateApiKeyResponse {
  success: boolean;
  apiKey: {
    id: string;
    label: string;
    keyPrefix: string;
    scope: ApiKeyScope;
    createdAt: string;
    rawKey: string;
  };
  warning: string;
}

/**
 * Fetch all API keys for the current user
 */
export async function fetchApiKeys(): Promise<ApiKeyListItem[]> {
  const response = await api.get('/dev/api-keys');
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch API keys');
  }
  
  return response.data.apiKeys;
}

/**
 * Create a new API key
 */
export async function createApiKey(
  label: string,
  scope: ApiKeyScope
): Promise<CreateApiKeyResponse> {
  const response = await api.post('/dev/api-keys', { label, scope });
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to create API key');
  }
  
  return response.data;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  const response = await api.post(`/dev/api-keys/${keyId}/revoke`);
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to revoke API key');
  }
}

/**
 * Regenerate an API key
 */
export async function regenerateApiKey(keyId: string): Promise<CreateApiKeyResponse> {
  const response = await api.post(`/dev/api-keys/${keyId}/regenerate`);
  
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to regenerate API key');
  }
  
  return response.data;
}
