/**
 * Text-to-3D Generation Service
 * 
 * Handles the workflow from approval to 3D asset generation:
 * 1. Generate 3D model using Meshy API
 * 2. Download generated files (GLB, FBX, USDZ, textures)
 * 3. Upload to Firebase Storage
 * 4. Create meshy_asset document in Firestore
 * 5. Link asset to topic
 */

import { MeshyApiService } from './meshyApiService';
import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { linkMeshyAssetsToTopic } from '../lib/firestore/updateHelpers';
import { v4 as uuidv4 } from 'uuid';
import type { MeshyAsset } from '../types/curriculum';

export interface TextTo3dGenerationOptions {
  textTo3dAssetId: string;
  prompt: string;
  chapterId: string;
  topicId: string;
  userId: string;
  artStyle?: 'realistic' | 'sculpture';
  aiModel?: 'meshy-4' | 'meshy-5';
}

export interface GenerationProgress {
  stage: 'generating' | 'downloading' | 'uploading' | 'linking' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export class TextTo3dGenerationService {
  private meshyApiService: MeshyApiService;

  constructor() {
    this.meshyApiService = new MeshyApiService();
  }

  /**
   * Generate 3D asset from approved text-to-3D asset
   */
  async generateFromApprovedAsset(
    options: TextTo3dGenerationOptions,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<{ success: boolean; meshyAssetId?: string; error?: string }> {
    const { textTo3dAssetId, prompt, chapterId, topicId, userId, artStyle = 'realistic', aiModel = 'meshy-4' } = options;

    try {
      // Step 1: Generate 3D model using Meshy
      onProgress?.({
        stage: 'generating',
        progress: 0,
        message: 'Initiating 3D model generation...'
      });

      const generationRequest = {
        prompt: prompt.trim(),
        art_style: artStyle,
        ai_model: aiModel,
        topology: 'triangle' as const,
        target_polycount: aiModel === 'meshy-5' ? 50000 : 30000,
        should_remesh: true,
        symmetry_mode: 'auto' as const,
        moderation: false
      };

      console.log('🚀 Starting Meshy generation for text-to-3D asset:', {
        textTo3dAssetId,
        prompt: prompt.substring(0, 50) + '...',
        artStyle,
        aiModel
      });

      const generationResponse = await this.meshyApiService.generateAsset(generationRequest);
      const taskId = generationResponse.result;

      if (!taskId) {
        throw new Error('Failed to start generation: No task ID received');
      }

      onProgress?.({
        stage: 'generating',
        progress: 10,
        message: 'Generation started, waiting for completion...'
      });

      // Step 2: Poll for completion
      const meshyAsset = await this.meshyApiService.pollForCompletion(
        taskId,
        120, // max attempts
        3000, // base interval
      );

      if (meshyAsset.status !== 'completed') {
        throw new Error(`Generation failed: ${meshyAsset.error?.message || 'Unknown error'}`);
      }

      onProgress?.({
        stage: 'downloading',
        progress: 50,
        message: 'Downloading generated files...'
      });

      // Step 3: Download and upload files
      const uploadedUrls = await this.downloadAndUploadFiles(
        meshyAsset,
        textTo3dAssetId,
        onProgress
      );

      onProgress?.({
        stage: 'uploading',
        progress: 80,
        message: 'Creating asset record...'
      });

      // Step 4: Create meshy_asset document
      const meshyAssetId = uuidv4();
      const assetData = {
        asset_id: meshyAssetId,
        chapter_id: chapterId,
        topic_id: topicId,
        name: prompt.substring(0, 100) || 'Generated 3D Asset',
        prompt: prompt,
        glb_url: uploadedUrls.glb || meshyAsset.metadata?.model_urls?.glb || '',
        fbx_url: uploadedUrls.fbx || meshyAsset.metadata?.model_urls?.fbx || '',
        usdz_url: uploadedUrls.usdz || meshyAsset.metadata?.model_urls?.usdz || '',
        thumbnail_url: uploadedUrls.thumbnail || meshyAsset.thumbnailUrl || '',
        meshy_id: taskId,
        status: 'complete' as const,
        isCore: false,
        assetTier: 'optional' as const,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        metadata: {
          source: 'text_to_3d_asset',
          text_to_3d_asset_id: textTo3dAssetId,
          art_style: artStyle,
          ai_model: aiModel,
          ...meshyAsset.metadata
        }
      };

      const assetDocRef = doc(collection(db, 'meshy_assets'), meshyAssetId);
      await setDoc(assetDocRef, assetData);

      console.log('✅ Created meshy_asset document:', meshyAssetId);

      onProgress?.({
        stage: 'linking',
        progress: 90,
        message: 'Linking asset to topic...'
      });

      // Step 5: Link asset to topic
      const linkResult = await linkMeshyAssetsToTopic({
        chapterId,
        topicId,
        assetIds: [meshyAssetId],
        userId
      });

      if (!linkResult.success) {
        console.warn('⚠️ Failed to link asset to topic:', linkResult.error);
        // Don't throw - asset is created, just not linked
      }

      // Step 6: Update the text_to_3d_assets document with generated URLs
      try {
        const textTo3dAssetRef = doc(db, 'text_to_3d_assets', textTo3dAssetId);
        await updateDoc(textTo3dAssetRef, {
          meshy_asset_id: meshyAssetId,
          glb_url: uploadedUrls.glb || meshyAsset.metadata?.model_urls?.glb || '',
          fbx_url: uploadedUrls.fbx || meshyAsset.metadata?.model_urls?.fbx || '',
          usdz_url: uploadedUrls.usdz || meshyAsset.metadata?.model_urls?.usdz || '',
          thumbnail_url: uploadedUrls.thumbnail || meshyAsset.thumbnailUrl || '',
          model_urls: {
            glb: uploadedUrls.glb || meshyAsset.metadata?.model_urls?.glb || '',
            fbx: uploadedUrls.fbx || meshyAsset.metadata?.model_urls?.fbx || '',
            usdz: uploadedUrls.usdz || meshyAsset.metadata?.model_urls?.usdz || '',
          },
          updated_at: serverTimestamp(),
        });
        console.log('✅ Updated text_to_3d_assets document with generated URLs');
      } catch (error) {
        console.warn('⚠️ Failed to update text_to_3d_assets document:', error);
        // Don't throw - asset is created, just URLs not updated in text_to_3d_assets
      }

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Asset generated and ready!'
      });

      return {
        success: true,
        meshyAssetId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error generating 3D asset from text-to-3D:', error);

      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: 'Generation failed',
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Download files from Meshy URLs and upload to Firebase Storage
   */
  private async downloadAndUploadFiles(
    meshyAsset: MeshyAsset,
    textTo3dAssetId: string,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<{
    glb?: string;
    fbx?: string;
    usdz?: string;
    thumbnail?: string;
  }> {
    const uploadedUrls: {
      glb?: string;
      fbx?: string;
      usdz?: string;
      thumbnail?: string;
    } = {};

    const modelUrls = meshyAsset.metadata?.model_urls || {};
    const filesToDownload: Array<{ url: string; key: 'glb' | 'fbx' | 'usdz' | 'thumbnail'; filename: string }> = [];

    // Collect all files to download
    if (modelUrls.glb) {
      filesToDownload.push({ url: modelUrls.glb, key: 'glb', filename: 'model.glb' });
    }
    if (modelUrls.fbx) {
      filesToDownload.push({ url: modelUrls.fbx, key: 'fbx', filename: 'model.fbx' });
    }
    if (modelUrls.usdz) {
      filesToDownload.push({ url: modelUrls.usdz, key: 'usdz', filename: 'model.usdz' });
    }
    if (meshyAsset.thumbnailUrl) {
      filesToDownload.push({ url: meshyAsset.thumbnailUrl, key: 'thumbnail', filename: 'thumbnail.jpg' });
    }

    // Download and upload each file
    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      const progress = 50 + (i / filesToDownload.length) * 30; // 50-80%

      onProgress?.({
        stage: 'downloading',
        progress: Math.round(progress),
        message: `Downloading ${file.filename}...`
      });

      try {
        // Download file
        const response = await fetch(file.url);
        if (!response.ok) {
          console.warn(`⚠️ Failed to download ${file.filename}: ${response.statusText}`);
          continue;
        }

        const blob = await response.blob();

        // Upload to Firebase Storage
        const storagePath = `text_to_3d_assets/${textTo3dAssetId}/${file.filename}`;
        const storageRef = ref(storage, storagePath);

        onProgress?.({
          stage: 'uploading',
          progress: Math.round(progress + 5),
          message: `Uploading ${file.filename}...`
        });

        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);

        uploadedUrls[file.key] = downloadUrl;
        console.log(`✅ Uploaded ${file.filename}: ${downloadUrl.substring(0, 100)}...`);
      } catch (error) {
        console.error(`❌ Error downloading/uploading ${file.filename}:`, error);
        // Continue with other files
      }
    }

    return uploadedUrls;
  }
}

export const textTo3dGenerationService = new TextTo3dGenerationService();
