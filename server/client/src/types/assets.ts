/**
 * Asset Types
 * 
 * Comprehensive type definitions for 3D assets
 */

import type { MeshyAsset } from '../types/curriculum';

/**
 * Asset status types
 */
export type AssetStatus = 
  | 'pending'
  | 'approved'
  | 'generating'
  | 'uploaded'
  | 'ready'
  | 'complete'
  | 'failed';

/**
 * Asset source types
 */
export type AssetSource = 
  | 'text_to_3d'
  | 'avatar_to_3d'
  | 'manual_upload'
  | 'meshy_generated';

/**
 * Asset tier types
 */
export type AssetTier = 'core' | 'optional' | 'custom';

/**
 * Base asset interface
 */
export interface BaseAsset {
  id: string;
  chapter_id: string;
  topic_id: string;
  name: string;
  status: AssetStatus;
  source?: AssetSource;
  isCore?: boolean;
  assetTier?: AssetTier;
  created_at?: string | Date;
  updated_at?: string | Date;
  created_by?: string;
  userId?: string;
}

/**
 * Meshy asset (extends MeshyAsset from curriculum types)
 */
export interface MeshyAssetExtended extends MeshyAsset, BaseAsset {
  glb_url: string;
  fbx_url?: string;
  usdz_url?: string;
  thumbnail_url?: string;
  meshy_id?: string;
  storagePath?: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
  originalFileName?: string;
}

/**
 * Text-to-3D asset
 */
export interface TextTo3dAsset extends BaseAsset {
  prompt: string;
  approval_status?: boolean;
  approved_at?: string | Date;
  approved_by?: string;
  generation_progress?: number;
  generation_message?: string;
  generation_error?: string;
  meshy_asset_id?: string;
  art_style?: 'realistic' | 'sculpture';
  ai_model?: 'meshy-4' | 'meshy-5';
}

/**
 * Avatar-to-3D asset
 */
export interface AvatarTo3dAsset extends BaseAsset {
  prompt: string;
  source_script?: string;
  source_script_type?: 'explanation' | 'intro' | 'outro';
  approval_status?: boolean;
  approved_at?: string | Date;
  approved_by?: string;
  generation_progress?: number;
  generation_message?: string;
  generation_error?: string;
  meshy_asset_id?: string;
  confidence?: number;
  detected_at?: string | Date;
}

/**
 * Asset upload options
 */
export interface AssetUploadOptions {
  file: File;
  name?: string;
  chapterId: string;
  topicId: string;
  language?: string;
  userId: string;
  onProgress?: (progress: number) => void;
}

/**
 * Asset upload result
 */
export interface AssetUploadResult {
  success: boolean;
  assetId?: string;
  asset?: MeshyAssetExtended;
  error?: string;
}

/**
 * Asset delete options
 */
export interface AssetDeleteOptions {
  assetId: string;
  chapterId: string;
  topicId: string;
  userId: string;
}

/**
 * Asset delete result
 */
export interface AssetDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Asset query options
 */
export interface AssetQueryOptions {
  chapterId: string;
  topicId: string;
  language?: string;
  includeInvalid?: boolean;
}

/**
 * Asset query result
 */
export interface AssetQueryResult {
  assets: MeshyAssetExtended[];
  total: number;
  valid: number;
  invalid: number;
}

/**
 * Asset operation progress
 */
export interface AssetOperationProgress {
  stage: string;
  progress: number;
  message: string;
  error?: string;
}
