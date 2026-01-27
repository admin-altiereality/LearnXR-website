/**
 * Asset Manager
 * 
 * Main service orchestrating all asset operations
 */

import { AssetQueryService } from './assetQueryService';
import { AssetUploadService } from './assetUploadService';
import { AssetDeleteService } from './assetDeleteService';
import type {
  AssetUploadOptions,
  AssetUploadResult,
  AssetDeleteOptions,
  AssetDeleteResult,
  AssetQueryOptions,
  AssetQueryResult,
  MeshyAssetExtended,
} from './types';
import type { UserProfile } from '../../utils/rbac';

/**
 * Asset Manager Class
 * 
 * Orchestrates all asset operations with proper error handling and retry logic
 */
export class AssetManager {
  /**
   * Upload asset
   */
  static async uploadAsset(
    options: AssetUploadOptions
  ): Promise<AssetUploadResult> {
    return AssetUploadService.uploadAsset(options);
  }

  /**
   * Delete asset
   */
  static async deleteAsset(
    options: AssetDeleteOptions,
    profile: UserProfile | null,
    assetData?: { isCore?: boolean; assetTier?: string; glb_url?: string }
  ): Promise<AssetDeleteResult> {
    return AssetDeleteService.deleteAsset(options, profile, assetData);
  }

  /**
   * Query assets
   */
  static async queryAssets(
    options: AssetQueryOptions
  ): Promise<AssetQueryResult> {
    return AssetQueryService.queryAssets(options);
  }

  /**
   * Get single asset
   */
  static async getAsset(
    assetId: string,
    chapterId: string,
    topicId: string
  ): Promise<MeshyAssetExtended | null> {
    return AssetQueryService.getAsset(assetId, chapterId, topicId);
  }

  /**
   * Refresh assets (re-query)
   */
  static async refreshAssets(
    options: AssetQueryOptions
  ): Promise<AssetQueryResult> {
    return AssetQueryService.queryAssets(options);
  }
}
