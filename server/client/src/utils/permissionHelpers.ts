/**
 * Permission Helpers
 * 
 * Utility functions for permission checking and error handling
 */

import type { UserProfile, UserRole } from '../utils/rbac';
import type { PermissionResult, PermissionContext, PermissionError } from '../types/permissions';
import { canEditLesson, canDeleteAsset, isSuperadmin } from '../utils/rbac';

/**
 * Check if user has permission for an operation
 */
export function checkPermission(
  profile: UserProfile | null,
  context: PermissionContext
): PermissionResult {
  // Not authenticated
  if (!profile) {
    return {
      allowed: false,
      reason: 'User not authenticated',
      errorCode: 'unauthenticated',
      canRetry: false,
    };
  }

  const { resource, operation, assetData } = context;

  // Read operations - all authenticated users can read
  if (operation === 'read') {
    return { allowed: true };
  }

  // Write operations require admin, superadmin, or associate
  const canEdit = canEditLesson(profile);
  if (!canEdit) {
    return {
      allowed: false,
      reason: 'Admin, superadmin, or associate role required',
      errorCode: 'permission-denied',
      canRetry: false,
    };
  }

  // Delete operations have additional checks for core assets
  if (operation === 'delete' && assetData) {
    const canDelete = canDeleteAsset(profile, assetData);
    if (!canDelete) {
      const isCore = assetData.isCore === true || assetData.assetTier === 'core';
      return {
        allowed: false,
        reason: isCore 
          ? 'Core assets can only be deleted by superadmin'
          : 'Insufficient permissions to delete this asset',
        errorCode: 'permission-denied',
        canRetry: false,
      };
    }
  }

  return { allowed: true };
}

/**
 * Handle permission errors from Firestore
 */
export function handlePermissionError(
  error: any,
  context: PermissionContext
): PermissionError {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  const isPermissionDenied = errorCode === 'permission-denied' || errorCode === 7;

  if (isPermissionDenied) {
    const { operation, resource } = context;
    
    let userMessage = 'Permission denied. ';
    let requiresRole: UserRole[] = ['admin', 'superadmin', 'associate'];
    let action = 'Contact your administrator to request access.';

    if (operation === 'delete' && context.assetData) {
      const isCore = context.assetData.isCore === true || context.assetData.assetTier === 'core';
      if (isCore) {
        userMessage += 'Core assets can only be deleted by superadmin.';
        requiresRole = ['superadmin'];
        action = 'Only superadmin can delete core assets.';
      } else {
        userMessage += 'You need admin or superadmin role to delete assets. (Associate cannot delete.)';
        requiresRole = ['admin', 'superadmin'];
      }
    } else if (operation === 'create' || operation === 'update') {
      userMessage += 'You need admin, superadmin, or associate role to modify assets.';
    } else {
      userMessage += 'You need admin, superadmin, or associate role to perform this action.';
    }

    return {
      code: errorCode,
      message: error?.message || 'Permission denied',
      userMessage,
      canRetry: false,
      requiresRole,
      action,
    };
  }

  // Network errors
  if (errorCode === 'unavailable' || errorCode === 'deadline-exceeded') {
    return {
      code: errorCode,
      message: error?.message || 'Network error',
      userMessage: 'Connection failed. Please check your internet connection and try again.',
      canRetry: true,
    };
  }

  // Generic error
  return {
    code: errorCode,
    message: error?.message || 'Unknown error',
    userMessage: 'An error occurred. Please try again.',
    canRetry: true,
  };
}

/**
 * Get user-friendly permission message
 */
export function getPermissionMessage(
  error: PermissionError,
  operation: string,
  resource: string
): string {
  if (error.userMessage) {
    return error.userMessage;
  }

  if (error.requiresRole && error.requiresRole.length > 0) {
    const roles = error.requiresRole.join(' or ');
    return `This action requires ${roles} role. ${error.action || ''}`;
  }

  return `You don't have permission to ${operation} ${resource}.`;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  
  // Retryable errors
  const retryableCodes = [
    'unavailable',
    'deadline-exceeded',
    'internal',
    'aborted',
    'resource-exhausted',
  ];

  return retryableCodes.includes(errorCode);
}

/**
 * Check if error is permission-related
 */
export function isPermissionError(error: any): boolean {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  return errorCode === 'permission-denied' || errorCode === 7;
}

/**
 * Get required role for an operation
 */
export function getRequiredRole(
  operation: string,
  assetData?: { isCore?: boolean; assetTier?: string }
): UserRole[] {
  if (operation === 'delete' && assetData) {
    const isCore = assetData.isCore === true || assetData.assetTier === 'core';
    if (isCore) {
      return ['superadmin'];
    }
  }
  if (operation === 'delete') {
    return ['admin', 'superadmin'];
  }
  return ['admin', 'superadmin', 'associate'];
}
