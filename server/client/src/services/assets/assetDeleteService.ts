/**
 * Asset Delete Service
 * 
 * Service for deleting assets with permission checks and cleanup
 */

import { deleteObject, ref } from 'firebase/storage';
import { storage, db } from '../../config/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { unlinkMeshyAssetFromTopic } from '../../lib/firestore/updateHelpers';
import { retryOperation } from '../../hooks/useRetry';
import { classifyError, logError } from '../../utils/errorHandler';
import { PermissionService } from '../permissionService';
import { checkPermission } from '../../utils/permissionHelpers';
import type { AssetDeleteOptions, AssetDeleteResult } from './types';
import type { PermissionContext } from '../../types/permissions';
import type { UserProfile } from '../../utils/rbac';

/**
 * Asset Delete Service Class
 */
export class AssetDeleteService {
  /**
   * Delete an asset
   */
  static async deleteAsset(
    options: AssetDeleteOptions,
    profile: UserProfile | null,
    assetData?: { isCore?: boolean; assetTier?: string; glb_url?: string }
  ): Promise<AssetDeleteResult> {
    const { assetId, chapterId, topicId, userId } = options;

    try {
      // Check permissions
      const permissionContext: PermissionContext = {
        resource: 'meshy_assets',
        operation: 'delete',
        assetId,
        assetData,
      };

      const permissionCheck = checkPermission(profile, permissionContext);
      if (!permissionCheck.allowed) {
        return {
          success: false,
          error: permissionCheck.reason || 'Permission denied',
        };
      }

      // Delete from Firestore with retry
      await retryOperation(
        async () => {
          await deleteDoc(doc(db, 'meshy_assets', assetId));
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      // Try to delete from storage if it's a Firebase URL
      if (assetData?.glb_url?.includes('firebase')) {
        try {
          const storageRef = ref(storage, assetData.glb_url);
          await deleteObject(storageRef);
        } catch (storageError) {
          console.warn('Could not delete from storage:', storageError);
          // Don't fail if storage deletion fails
        }
      }

      // Unlink asset from topic
      try {
        await unlinkMeshyAssetFromTopic({
          chapterId,
          topicId,
          assetId,
          userId,
        });
      } catch (unlinkError) {
        console.warn('Error unlinking asset from topic:', unlinkError);
        // Don't fail the delete if unlinking fails
      }

      return {
        success: true,
      };
    } catch (error: any) {
      logError(error, 'AssetDeleteService.deleteAsset');
      const classification = classifyError(error);

      return {
        success: false,
        error: classification.userMessage,
      };
    }
  }
}
