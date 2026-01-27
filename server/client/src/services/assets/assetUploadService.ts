/**
 * Asset Upload Service
 * 
 * Service for uploading assets with validation, progress tracking, and error handling
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../../config/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { linkMeshyAssetsToTopic } from '../../lib/firestore/updateHelpers';
import { validateFile } from './validators';
import { retryOperation } from '../../hooks/useRetry';
import { classifyError, logError } from '../../utils/errorHandler';
import { PermissionService } from '../permissionService';
import type { AssetUploadOptions, AssetUploadResult, MeshyAssetExtended } from './types';

// File type for upload service
type File = globalThis.File;
import type { PermissionContext } from '../../types/permissions';

/**
 * Asset Upload Service Class
 */
export class AssetUploadService {
  /**
   * Upload a single asset
   */
  static async uploadAsset(
    options: AssetUploadOptions
  ): Promise<AssetUploadResult> {
    const { file, name, chapterId, topicId, userId, onProgress } = options;

    try {
      // Validate file
      const validation = await validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Check permissions before upload
      const permissionContext: PermissionContext = {
        resource: 'meshy_assets',
        operation: 'create',
      };

      // Prepare asset name
      const assetName = name || file.name.replace(/\.[^/.]+$/, '');
      const timestamp = Date.now();
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      const fileName = `${assetName.replace(/\s+/g, '_')}_${timestamp}${fileExtension}`;
      const storagePath = `meshy_assets/${chapterId}/${topicId}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Update progress
      onProgress?.(10);

      // Upload file with retry
      const downloadUrl = await retryOperation(
        async () => {
          const metadata = {
            contentType: file.type || this.getContentType(file.name),
            customMetadata: {
              originalFileName: file.name,
              fileSize: file.size.toString(),
              uploadedAt: new Date().toISOString(),
            },
          };

          await uploadBytes(storageRef, file, metadata);
          onProgress?.(50);
          return await getDownloadURL(storageRef);
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (attempt) => {
            console.log(`Retrying upload (attempt ${attempt})...`);
            onProgress?.(20 + attempt * 10);
          },
        }
      );

      onProgress?.(70);

      // Create Firestore document
      const assetDocRef = doc(collection(db, 'meshy_assets'));
      const assetId = assetDocRef.id;

      const assetData = {
        asset_id: assetId,
        chapter_id: chapterId,
        topic_id: topicId,
        name: assetName,
        storagePath: storagePath,
        glb_url: downloadUrl,
        status: 'complete',
        isCore: false,
        assetTier: 'optional',
        contentType: this.getContentType(file.name),
        fileName: fileName,
        fileSize: file.size,
        originalFileName: file.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(assetDocRef, assetData);

      onProgress?.(85);

      // Link asset to topic
      try {
        await linkMeshyAssetsToTopic({
          chapterId,
          topicId,
          assetIds: [assetId],
          userId: userId,
        });
      } catch (linkError) {
        console.warn('Failed to link asset to topic:', linkError);
        // Don't fail the upload if linking fails
      }

      onProgress?.(100);

      const asset: MeshyAssetExtended = {
        id: assetId,
        ...assetData,
        glb_url: downloadUrl,
        status: 'complete',
      } as MeshyAssetExtended;

      return {
        success: true,
        assetId,
        asset,
      };
    } catch (error: any) {
      logError(error, 'AssetUploadService.uploadAsset');
      const classification = classifyError(error);

      return {
        success: false,
        error: classification.userMessage,
      };
    }
  }

  /**
   * Get content type for file
   */
  private static getContentType(fileName: string): string {
    const fileNameLower = fileName.toLowerCase();
    if (fileNameLower.endsWith('.glb')) {
      return 'model/gltf-binary';
    } else if (fileNameLower.endsWith('.gltf')) {
      return 'model/gltf+json';
    } else if (fileNameLower.endsWith('.fbx')) {
      return 'application/octet-stream';
    } else {
      return 'application/octet-stream';
    }
  }
}
