/**
 * Permission Service
 * 
 * Centralized service for permission checking with error handling
 */

import { useAuth } from '../contexts/AuthContext';
import { checkPermission, handlePermissionError } from '../utils/permissionHelpers';
import type { PermissionContext, PermissionResult, PermissionError } from '../types/permissions';

/**
 * Permission Service Class
 */
export class PermissionService {
  /**
   * Check permission with automatic profile refresh on errors
   */
  static async checkPermissionWithRefresh(
    profile: any,
    context: PermissionContext,
    refreshProfile?: () => Promise<void>
  ): Promise<PermissionResult> {
    // Initial check
    let result = checkPermission(profile, context);

    // If permission denied and we can refresh profile, try once
    if (!result.allowed && result.errorCode === 'permission-denied' && refreshProfile) {
      try {
        await refreshProfile();
        // Re-check after refresh (would need to get updated profile)
        // For now, return the original result
      } catch (refreshError) {
        console.warn('Failed to refresh profile:', refreshError);
      }
    }

    return result;
  }

  /**
   * Handle Firestore error and convert to PermissionError
   */
  static handleFirestoreError(
    error: any,
    context: PermissionContext
  ): PermissionError {
    return handlePermissionError(error, context);
  }

  /**
   * Check if operation is allowed before executing
   */
  static async validateBeforeOperation(
    profile: any,
    context: PermissionContext,
    operation: () => Promise<any>
  ): Promise<any> {
    const permissionCheck = checkPermission(profile, context);

    if (!permissionCheck.allowed) {
      const error = {
        code: permissionCheck.errorCode || 'permission-denied',
        message: permissionCheck.reason || 'Permission denied',
      };
      throw error;
    }

    try {
      return await operation();
    } catch (error: any) {
      // Handle Firestore permission errors
      if (isPermissionError(error)) {
        const permissionError = handlePermissionError(error, context);
        throw permissionError;
      }
      throw error;
    }
  }
}

/**
 * Helper to check if error is permission error
 */
function isPermissionError(error: any): boolean {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  return errorCode === 'permission-denied' || errorCode === 7;
}
