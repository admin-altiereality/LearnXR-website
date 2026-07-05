/**
 * Text-to-3D Generation Service
 *
 * Handles the workflow from approval to 3D asset generation:
 * 1. Generate a preview model through Meshy
 * 2. Refine it into the final textured model
 * 3. Ask Firebase Functions to store Meshy files in Firebase Storage
 * 4. Register tokenized render URLs in Firestore and link the asset to the topic
 */

import { MeshyApiService } from './meshyApiService';

export interface TextTo3dGenerationOptions {
  textTo3dAssetId: string;
  prompt: string;
  chapterId: string;
  topicId: string;
  userId: string;
  artStyle?: 'realistic' | 'sculpture';
  aiModel?: 'meshy-4' | 'meshy-5';
  collectionName?: 'text_to_3d_assets' | 'avatar_to_3d_assets';
}

export interface GenerationProgress {
  stage: 'generating' | 'downloading' | 'uploading' | 'linking' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

type MeshyTextureSet = {
  base_color?: string;
  metallic?: string;
  normal?: string;
  roughness?: string;
};

export class TextTo3dGenerationService {
  private meshyApiService: MeshyApiService;

  constructor() {
    this.meshyApiService = new MeshyApiService();
  }

  async generateFromApprovedAsset(
    options: TextTo3dGenerationOptions,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<{ success: boolean; meshyAssetId?: string; error?: string }> {
    const {
      textTo3dAssetId,
      prompt,
      chapterId,
      topicId,
      userId,
      artStyle = 'realistic',
      aiModel = 'meshy-4',
      collectionName = 'text_to_3d_assets',
    } = options;

    try {
      onProgress?.({
        stage: 'generating',
        progress: 0,
        message: 'Initiating 3D model generation...',
      });

      const modelToUse = aiModel === 'meshy-4' ? 'meshy-5' : (aiModel || 'latest');
      const generationRequest = {
        prompt: prompt.trim(),
        art_style: artStyle,
        ai_model: modelToUse as 'meshy-5' | 'meshy-6' | 'latest',
        topology: 'triangle' as const,
        target_polycount: modelToUse === 'meshy-5' ? 50000 : 30000,
        should_remesh: modelToUse === 'meshy-6' || modelToUse === 'latest' ? false : true,
        symmetry_mode: 'auto' as const,
        moderation: false,
      };

      console.log('Starting Meshy preview generation for text-to-3D asset:', {
        textTo3dAssetId,
        prompt: `${prompt.substring(0, 50)}...`,
        artStyle,
        aiModel: modelToUse,
      });

      onProgress?.({
        stage: 'generating',
        progress: 5,
        message: 'Creating preview (mesh generation)...',
      });

      const previewResponse = await this.meshyApiService.generateAsset(generationRequest);
      const previewTaskId = previewResponse.result;

      if (!previewTaskId) {
        throw new Error('Failed to start preview generation: No task ID received');
      }

      onProgress?.({
        stage: 'generating',
        progress: 10,
        message: 'Generating mesh (preview stage)...',
      });

      const previewAsset = await this.meshyApiService.pollForCompletion(previewTaskId, 120, 3000);
      if (previewAsset.status !== 'completed') {
        throw new Error(`Preview generation failed: ${previewAsset.error?.message || 'Unknown error'}`);
      }

      console.log('Preview stage completed, starting refine stage.');

      onProgress?.({
        stage: 'generating',
        progress: 50,
        message: 'Adding textures (refine stage)...',
      });

      const refineResponse = await this.meshyApiService.createRefineTask({
        preview_task_id: previewTaskId,
        enable_pbr: true,
        ai_model: modelToUse === 'meshy-4' ? 'meshy-5' : 'latest',
        moderation: false,
      });

      const refineTaskId = refineResponse.result;
      if (!refineTaskId) {
        throw new Error('Failed to start refine generation: No task ID received');
      }

      onProgress?.({
        stage: 'generating',
        progress: 60,
        message: 'Applying textures (refine stage)...',
      });

      const meshyAsset = await this.meshyApiService.pollForCompletion(refineTaskId, 120, 3000);
      if (meshyAsset.status !== 'completed') {
        throw new Error(`Refine generation failed: ${meshyAsset.error?.message || 'Unknown error'}`);
      }

      onProgress?.({
        stage: 'uploading',
        progress: 80,
        message: 'Saving generated model to Firebase Storage...',
      });

      const persistedAsset = await this.meshyApiService.finalizeGeneratedAsset({
        sourceAssetId: textTo3dAssetId,
        sourceCollection: collectionName,
        chapterId,
        topicId,
        userId,
        prompt,
        name: prompt.substring(0, 100) || 'Generated 3D Asset',
        artStyle,
        aiModel,
        meshyId: refineTaskId,
        meshyPreviewId: previewTaskId,
        modelUrls: meshyAsset.metadata?.model_urls || {},
        thumbnailUrl: meshyAsset.thumbnailUrl,
        textureUrls: meshyAsset.metadata?.texture_urls as MeshyTextureSet[] | undefined,
        metadata: meshyAsset.metadata as Record<string, unknown> | undefined,
      });

      const meshyAssetId = String(persistedAsset.id || persistedAsset.asset_id || '');
      if (!meshyAssetId) {
        throw new Error('Generated asset was stored but no asset ID was returned');
      }

      console.log('Stored generated 3D asset with render URL:', {
        meshyAssetId,
        renderUrl: persistedAsset.render_url,
      });

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Asset generated and ready!',
      });

      return {
        success: true,
        meshyAssetId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error generating 3D asset from text-to-3D:', error);

      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: 'Generation failed',
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const textTo3dGenerationService = new TextTo3dGenerationService();
