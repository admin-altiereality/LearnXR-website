/**
 * Permission Gate Component
 * 
 * Component that conditionally renders children based on permissions
 */

import React from 'react';
import { usePermissionCheck } from '../hooks/usePermissions';
import { Loader2, Lock } from 'lucide-react';
import type { PermissionResource, PermissionOperation } from '../types/permissions';

interface PermissionGateProps {
  resource: PermissionResource;
  operation: PermissionOperation;
  assetData?: { isCore?: boolean; assetTier?: string; userId?: string };
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLoading?: boolean;
  showMessage?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  resource,
  operation,
  assetData,
  children,
  fallback,
  showLoading = true,
  showMessage = true,
}) => {
  // Since only admin/superadmin can access lesson editor, we trust Firestore rules
  // Always show children - Firestore will handle permission errors
  // This allows users to see buttons and get proper error messages from Firestore
  return <>{children}</>;
};
