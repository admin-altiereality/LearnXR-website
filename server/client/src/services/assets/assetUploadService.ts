/**
 * Asset Upload Service
 * 
 * Service for uploading assets with validation, progress tracking, and error handling
 */

import { ref, uploadBytes } from 'firebase/storage';
import { storage, db } from '../../config/firebase';
import { collection, doc } from 'firebase/firestore';
import { validateFile } from './validators';
import { retryOperation } from '../../hooks/useRetry';
import { classifyError, logError } from '../../utils/errorHandler';
import { meshyApiService } from '../meshyApiService';
import type { AssetUploadOptions, AssetUploadResult, MeshyAssetExtended } from './types';

// File type for upload service
type File = globalThis.File;

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
      if (!file.name.toLowerCase().endsWith('.glb')) {
        return {
          success: false,
          error: 'Please upload a GLB file for VR lesson rendering.',
        };
      }

      // Prepare asset name
      const assetName = name || file.name.replace(/\.[^/.]+$/, '');
      const timestamp = Date.now();
      const fileName = `${assetName.replace(/\s+/g, '_')}_${timestamp}.glb`;
      const assetDocRef = doc(collection(db, 'meshy_assets'));
      const assetId = assetDocRef.id;
      const storagePath = `meshy_assets/${chapterId}/${topicId}/${assetId}/model.glb`;
      const storageRef = ref(storage, storagePath);

      // Update progress
      onProgress?.(10);

      // Upload file with retry
      await retryOperation(
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

      const persistedAsset = await meshyApiService.registerUploadedAsset({
        assetKind: 'uploaded',
        assetId,
        storagePath,
        chapterId,
        topicId,
        userId,
        name: assetName,
        fileName,
        originalFileName: file.name,
        fileSize: file.size,
        contentType: this.getContentType(file.name),
      });

      onProgress?.(85);

      onProgress?.(100);

      const asset: MeshyAssetExtended = {
        id: assetId,
        ...(persistedAsset as Partial<MeshyAssetExtended>),
        asset_id: assetId,
        chapter_id: chapterId,
        topic_id: topicId,
        name: assetName,
        glb_url: String(persistedAsset.glb_url || persistedAsset.render_url || ''),
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
