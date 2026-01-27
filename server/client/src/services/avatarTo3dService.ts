/**
 * Avatar-to-3D Service
 * 
 * Analyzes avatar explanation scripts to detect 3D objects
 * and creates avatar_to_3d_assets for approval and generation
 */

import api from '../config/axios';
import { db } from '../config/firebase';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { aiDetectionService } from './aiDetectionService';
import type { AIDetectionResult } from './aiDetectionService';

export interface AvatarTo3dAsset {
  id: string;
  chapter_id: string;
  topic_id: string;
  language: string;
  prompt: string; // The detected 3D object prompt
  source_script: string; // The original avatar explanation script
  source_script_type: 'explanation' | 'intro' | 'outro';
  approval_status?: boolean;
  status?: 'pending' | 'approved' | 'generating' | 'ready' | 'failed';
  generation_progress?: number;
  generation_message?: string;
  generation_error?: string;
  meshy_asset_id?: string;
  model_urls?: {
    glb?: string;
    fbx?: string;
    usdz?: string;
  };
  glb_url?: string;
  fbx_url?: string;
  usdz_url?: string;
  thumbnail_url?: string;
  created_at?: any;
  updated_at?: any;
  created_by?: string;
  detected_at?: any;
  confidence?: number; // AI detection confidence
}

export interface DetectionResult {
  success: boolean;
  assets: AvatarTo3dAsset[];
  error?: string;
}

export class AvatarTo3dService {
  /**
   * Analyze avatar explanation script and detect 3D objects
   */
  async detect3DObjects(
    chapterId: string,
    topicId: string,
    language: string,
    explanationScript: string
  ): Promise<DetectionResult> {
    if (!explanationScript || !explanationScript.trim()) {
      return {
        success: false,
        assets: [],
        error: 'Explanation script is empty'
      };
    }

    try {
      console.log('🔍 Analyzing avatar explanation script for 3D objects...');
      console.log('Script preview:', explanationScript.substring(0, 100) + '...');

      // Use extract-assets endpoint directly (more reliable)
      try {
        const extractResponse = await api.post<{ assets: string[]; success: boolean; error?: string }>('/ai-detection/extract-assets', {
          prompt: explanationScript.trim()
        });

        console.log('📦 Extract-assets response:', extractResponse.data);

        if (!extractResponse.data.success) {
          return {
            success: false,
            assets: [],
            error: extractResponse.data.error || 'Failed to extract 3D objects'
          };
        }

        const extractedAssets = extractResponse.data.assets || [];

        if (extractedAssets.length === 0) {
          console.log('ℹ️ No 3D objects detected in avatar script');
          return {
            success: true,
            assets: []
          };
        }

        console.log(`✅ Detected ${extractedAssets.length} 3D object(s):`, extractedAssets);

        // Create avatar_to_3d_assets
        const assets: AvatarTo3dAsset[] = extractedAssets.map((prompt) => ({
          id: '', // Will be set when saved
          chapter_id: chapterId,
          topic_id: topicId,
          language,
          prompt: prompt.trim(),
          source_script: explanationScript,
          source_script_type: 'explanation',
          approval_status: false,
          status: 'pending',
          confidence: 0.8, // Default confidence
        }));

        return {
          success: true,
          assets
        };
      } catch (extractError: any) {
        console.error('❌ Extract-assets endpoint failed:', extractError);
        
        // Fallback: Try detectPromptType
        console.log('🔄 Trying fallback detection method...');
        const detectionResult = await aiDetectionService.detectPromptType(explanationScript);

        if (detectionResult.success && detectionResult.data) {
          const aiData = detectionResult.data;
          const meshAssets = aiData.meshAssets || [];

          if (meshAssets.length > 0) {
            console.log(`✅ Fallback detected ${meshAssets.length} 3D object(s):`, meshAssets);
            
            const assets: AvatarTo3dAsset[] = meshAssets.map((prompt) => ({
              id: '',
              chapter_id: chapterId,
              topic_id: topicId,
              language,
              prompt: prompt.trim(),
              source_script: explanationScript,
              source_script_type: 'explanation',
              approval_status: false,
              status: 'pending',
              confidence: aiData.confidence || 0.7,
            }));

            return {
              success: true,
              assets
            };
          }
        }

        return {
          success: false,
          assets: [],
          error: extractError.response?.data?.error || 
                 extractError.message || 
                 detectionResult.error || 
                 'Failed to detect 3D objects'
        };
      }
    } catch (error) {
      console.error('❌ Error detecting 3D objects from avatar script:', error);
      return {
        success: false,
        assets: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save detected assets to Firestore
   */
  async saveDetectedAssets(assets: Omit<AvatarTo3dAsset, 'id'>[]): Promise<string[]> {
    const assetIds: string[] = [];

    for (const asset of assets) {
      try {
        // Check if asset already exists (same prompt, chapter, topic, language)
        const existingQuery = query(
          collection(db, 'avatar_to_3d_assets'),
          where('chapter_id', '==', asset.chapter_id),
          where('topic_id', '==', asset.topic_id),
          where('language', '==', asset.language),
          where('prompt', '==', asset.prompt)
        );

        const existingDocs = await getDocs(existingQuery);
        
        if (!existingDocs.empty) {
          console.log(`ℹ️ Asset already exists: ${asset.prompt.substring(0, 50)}...`);
          assetIds.push(existingDocs.docs[0].id);
          continue;
        }

        // Create new asset
        const docRef = await addDoc(collection(db, 'avatar_to_3d_assets'), {
          ...asset,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          detected_at: serverTimestamp(),
        });

        assetIds.push(docRef.id);
        console.log(`✅ Saved detected asset: ${docRef.id} - ${asset.prompt.substring(0, 50)}...`);
      } catch (error) {
        console.error('❌ Error saving detected asset:', error);
      }
    }

    return assetIds;
  }

  /**
   * Get all avatar_to_3d_assets for a topic
   */
  async getAssetsForTopic(
    chapterId: string,
    topicId: string,
    language?: string
  ): Promise<AvatarTo3dAsset[]> {
    const assetsRef = collection(db, 'avatar_to_3d_assets');
    const constraints: any[] = [
      where('chapter_id', '==', chapterId),
      where('topic_id', '==', topicId)
    ];

    if (language) {
      constraints.push(where('language', '==', language));
    }

    const q = query(assetsRef, ...constraints);
    const snapshot = await getDocs(q);

    const assets: AvatarTo3dAsset[] = [];
    snapshot.forEach((docSnap) => {
      assets.push({
        id: docSnap.id,
        ...docSnap.data()
      } as AvatarTo3dAsset);
    });

    return assets;
  }

  /**
   * Update asset approval status
   */
  async updateApprovalStatus(
    assetId: string,
    approved: boolean,
    userId: string
  ): Promise<void> {
    const assetRef = doc(db, 'avatar_to_3d_assets', assetId);
    await updateDoc(assetRef, {
      approval_status: approved,
      approved_at: approved ? serverTimestamp() : null,
      approved_by: approved ? userId : null,
      updated_at: serverTimestamp(),
      ...(approved && !(await getDoc(assetRef)).data()?.meshy_asset_id ? { status: 'generating' } : {}),
    });
  }

  /**
   * Manually create a 3D asset entry
   */
  async createManualAsset(
    chapterId: string,
    topicId: string,
    language: string,
    prompt: string,
    sourceScript?: string,
    userId?: string
  ): Promise<string> {
    // Check if asset already exists
    const existingQuery = query(
      collection(db, 'avatar_to_3d_assets'),
      where('chapter_id', '==', chapterId),
      where('topic_id', '==', topicId),
      where('language', '==', language),
      where('prompt', '==', prompt.trim())
    );

    const existingDocs = await getDocs(existingQuery);
    
    if (!existingDocs.empty) {
      console.log(`ℹ️ Asset already exists: ${prompt.substring(0, 50)}...`);
      return existingDocs.docs[0].id;
    }

    // Create new asset with auto-approval for manual entries
    const docRef = await addDoc(collection(db, 'avatar_to_3d_assets'), {
      chapter_id: chapterId,
      topic_id: topicId,
      language,
      prompt: prompt.trim(),
      source_script: sourceScript || '',
      source_script_type: 'explanation',
      approval_status: true, // Auto-approve manual entries
      status: 'generating', // Start generating immediately
      confidence: 1.0, // Manual entry has full confidence
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      detected_at: serverTimestamp(),
      approved_at: serverTimestamp(),
      approved_by: userId || null,
      created_by: userId || null,
    });

    console.log(`✅ Created manual asset (auto-approved): ${docRef.id} - ${prompt.substring(0, 50)}...`);
    return docRef.id;
  }

  /**
   * Delete an avatar_to_3d_asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    const assetRef = doc(db, 'avatar_to_3d_assets', assetId);
    await deleteDoc(assetRef);
    console.log(`✅ Deleted avatar_to_3d_asset: ${assetId}`);
  }
}

export const avatarTo3dService = new AvatarTo3dService();
