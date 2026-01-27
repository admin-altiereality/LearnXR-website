/**
 * Permission Types
 * 
 * Defines types for the unified permission system
 */

import type { UserProfile, UserRole } from '../utils/rbac';

/**
 * Permission operation types
 */
export type PermissionOperation = 'read' | 'create' | 'update' | 'delete';

/**
 * Permission resource types
 */
export type PermissionResource = 
  | 'meshy_assets'
  | 'text_to_3d_assets'
  | 'avatar_to_3d_assets'
  | 'chapter_images'
  | 'pdfs'
  | 'chapter_mcqs'
  | 'chapter_tts'
  | 'chapter_avatar_scripts'
  | 'curriculum_chapters';

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
  canRetry?: boolean;
}

/**
 * Permission context
 */
export interface PermissionContext {
  resource: PermissionResource;
  operation: PermissionOperation;
  assetId?: string;
  assetData?: {
    isCore?: boolean;
    assetTier?: string;
    userId?: string;
  };
}

/**
 * Permission check options
 */
export interface PermissionCheckOptions {
  profile: UserProfile | null;
  context: PermissionContext;
  refreshProfile?: () => Promise<void>;
}

/**
 * Permission error details
 */
export interface PermissionError {
  code: string;
  message: string;
  userMessage: string;
  canRetry: boolean;
  requiresRole?: UserRole[];
  action?: string;
}
