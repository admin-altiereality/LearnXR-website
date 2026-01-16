/**
 * API Key Types - Client Side
 */

export enum ApiKeyScope {
  READ = 'read',
  FULL = 'full'
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
