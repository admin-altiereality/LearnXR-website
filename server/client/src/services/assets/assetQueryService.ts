/**
 * Asset Query Service
 * 
 * Service for querying assets with caching and error handling
 */

import { getMeshyAssets } from '../../lib/firestore/queries';
import { retryOperation } from '../../hooks/useRetry';
import { classifyError, logError } from '../../utils/errorHandler';
import type { AssetQueryOptions, AssetQueryResult, MeshyAssetExtended } from './types';
import type { MeshyAsset } from '../../types/curriculum';

/**
 * Asset Query Service Class
 */
export class AssetQueryService {
  /**
   * Query assets for a topic
   */
  static async queryAssets(
    options: AssetQueryOptions
  ): Promise<AssetQueryResult> {
    const { chapterId, topicId, includeInvalid = false } = options;

    try {
      // Use retry mechanism for network resilience
      const assets = await retryOperation(
        async () => {
          const meshyAssets = await getMeshyAssets(chapterId, topicId);
          return meshyAssets as MeshyAsset[];
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (attempt, error) => {
            console.log(`Retrying asset query (attempt ${attempt})...`, error);
          },
        }
      );

      // Filter and validate assets
      const validAssets: MeshyAssetExtended[] = [];
      const invalidAssets: MeshyAssetExtended[] = [];

      assets.forEach((asset) => {
        const extendedAsset = asset as MeshyAssetExtended;
        
        // Check if asset has valid GLB URL
        if (!extendedAsset.glb_url || extendedAsset.glb_url.trim() === '') {
          if (includeInvalid) {
            invalidAssets.push(extendedAsset);
          }
          return;
        }

        // Check if URL looks valid
        if (!extendedAsset.glb_url.startsWith('http')) {
          if (includeInvalid) {
            invalidAssets.push(extendedAsset);
          }
          return;
        }

        validAssets.push(extendedAsset);
      });

      return {
        assets: includeInvalid ? [...validAssets, ...invalidAssets] : validAssets,
        total: assets.length,
        valid: validAssets.length,
        invalid: invalidAssets.length,
      };
    } catch (error: any) {
      logError(error, 'AssetQueryService.queryAssets');
      const classification = classifyError(error);

      // If it's a permission error, provide helpful message
      if (classification.type === 'permission') {
        throw new Error(classification.userMessage);
      }

      // Re-throw with user-friendly message
      throw new Error(classification.userMessage || 'Failed to load assets');
    }
  }

  /**
   * Get single asset by ID
   */
  static async getAsset(
    assetId: string,
    chapterId: string,
    topicId: string
  ): Promise<MeshyAssetExtended | null> {
    try {
      const result = await this.queryAssets({ chapterId, topicId });
      return result.assets.find(a => a.id === assetId) || null;
    } catch (error: any) {
      logError(error, 'AssetQueryService.getAsset');
      throw error;
    }
  }
}
