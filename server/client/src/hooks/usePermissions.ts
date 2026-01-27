/**
 * usePermissions Hook
 * 
 * Custom hook for permission checking with caching and error handling
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { checkPermission } from '../utils/permissionHelpers';
import type { PermissionContext, PermissionResource, PermissionOperation } from '../types/permissions';
import { canEditLesson, canDeleteAsset } from '../utils/rbac';

/**
 * Permission flags for a resource
 */
export interface PermissionFlags {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: (assetData?: { isCore?: boolean; assetTier?: string }) => boolean;
  isLoading: boolean;
}

/**
 * Hook to get permissions for a resource
 */
export function usePermissions(resource: PermissionResource): PermissionFlags {
  const { profile, profileLoading } = useAuth();

  return useMemo(() => {
    // Read is always allowed for authenticated users
    const canRead = !!profile;

    // Write operations require admin/superadmin
    const canEdit = canEditLesson(profile);
    const canCreate = canEdit;
    const canUpdate = canEdit;

    // Delete requires additional checks for core assets
    const canDelete = (assetData?: { isCore?: boolean; assetTier?: string }) => {
      if (!canEdit) return false;
      if (!assetData) return true;
      return canDeleteAsset(profile, assetData);
    };

    return {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      isLoading: profileLoading,
    };
  }, [profile, profileLoading]);
}

/**
 * Hook to check specific permission
 */
export function usePermissionCheck(
  resource: PermissionResource,
  operation: PermissionOperation,
  assetData?: { isCore?: boolean; assetTier?: string; userId?: string }
) {
  const { profile, profileLoading } = useAuth();

  return useMemo(() => {
    if (profileLoading) {
      return { allowed: false, isLoading: true };
    }

    const context: PermissionContext = {
      resource,
      operation,
      assetData,
    };

    const result = checkPermission(profile, context);

    return {
      ...result,
      isLoading: false,
    };
  }, [profile, profileLoading, resource, operation, assetData]);
}
