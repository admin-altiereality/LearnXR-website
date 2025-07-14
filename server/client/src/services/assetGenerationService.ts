// Integrated 3D Asset Generation Service
// This service orchestrates the complete pipeline: keyword extraction → Meshy.ai generation → Storage

import { keywordExtractionService, type ExtractedObject } from './keywordExtractionService';
import { meshyApiService, type MeshyGenerationRequest, type MeshyAsset } from './meshyApiService';
import { assetStorageService, type StoredAsset } from './assetStorageService';
import { alternativeStorageService, type StorageResult } from './alternativeStorageService';

export interface AssetGenerationRequest {
  originalPrompt: string;
  userId: string;
  skyboxId?: string;
  quality?: 'low' | 'medium' | 'high';
  style?: string;
  outputFormat?: 'glb' | 'usdz';
  maxAssets?: number;
}

export interface AssetGenerationResult {
  success: boolean;
  assets: StoredAsset[];
  extractedObjects: ExtractedObject[];
  totalCost: number;
  totalTime: number;
  errors: string[];
  error?: string;
  alternativeStorageUsed?: boolean;
}

export interface AssetGenerationProgress {
  stage: 'extracting' | 'generating' | 'storing' | 'completed' | 'failed';
  progress: number;
  currentAsset?: string;
  totalAssets: number;
  completedAssets: number;
  message: string;
}

export type ProgressCallback = (progress: AssetGenerationProgress) => void;

class AssetGenerationService {

  /**
   * Generate 3D assets from a skybox prompt
   */
  async generateAssetsFromPrompt(
    request: AssetGenerationRequest,
    onProgress?: ProgressCallback
  ): Promise<AssetGenerationResult> {
    const startTime = Date.now();
    const result: AssetGenerationResult = {
      success: false,
      assets: [],
      extractedObjects: [],
      totalCost: 0,
      totalTime: 0,
      errors: []
    };

    try {
      // Check if any storage is available
      const firebaseStorageAvailable = await assetStorageService.isStorageAvailable();
      const alternativeStorageAvailable = alternativeStorageService.isStorageAvailable();
      
      if (!firebaseStorageAvailable && !alternativeStorageAvailable) {
        return {
          success: false,
          error: 'No storage service is available. Please check your configuration.',
          assets: []
        };
      }

      // Stage 1: Extract keywords from prompt
      onProgress?.({
        stage: 'extracting',
        progress: 0,
        totalAssets: 0,
        completedAssets: 0,
        message: 'Analyzing prompt for 3D objects...'
      });

      // Bypass extraction for Meshy-only generation (maxAssets === 1)
      if (request.maxAssets === 1) {
        // Directly generate a single asset with the original prompt
        const meshyRequest: MeshyGenerationRequest = {
          prompt: request.originalPrompt,
          style: request.style || 'realistic',
          quality: request.quality || 'medium',
          output_format: request.outputFormat || 'glb'
        };
        // Validate request
        const validation = meshyApiService.validateRequest(meshyRequest);
        if (!validation.valid) {
          result.errors.push(`Invalid request: ${validation.errors.join(', ')}`);
          onProgress?.({
            stage: 'failed',
            progress: 100,
            totalAssets: 0,
            completedAssets: 0,
            message: 'Invalid prompt or parameters.'
          });
          return result;
        }
        // Generate asset
        onProgress?.({
          stage: 'generating',
          progress: 0,
          totalAssets: 1,
          completedAssets: 0,
          message: 'Generating 3D asset...'
        });
        try {
          const generation = await meshyApiService.generateAsset(meshyRequest);
          // Store asset
          let storedAsset: StoredAsset | null = null;
          let alternativeStorageUsed = false;
          if (firebaseStorageAvailable) {
            try {
              const assetId = await assetStorageService.storeAssetMetadata(
                {
                  id: generation.id,
                  prompt: generation.prompt,
                  status: generation.status,
                  format: request.outputFormat || 'glb',
                  createdAt: generation.created_at,
                  updatedAt: generation.updated_at
                },
                { keyword: request.originalPrompt, category: 'custom', confidence: 1, suggestedPrompt: request.originalPrompt },
                request.userId,
                request.skyboxId,
                request.originalPrompt
              );
              const completedAsset = await meshyApiService.pollForCompletion(generation.id);
              const generationTime = Date.now() - startTime;
              const cost = meshyApiService.getCostEstimate(request.quality || 'medium');
              await assetStorageService.updateAssetCompletion(assetId, completedAsset, generationTime, cost);
              storedAsset = await assetStorageService.getAsset(assetId);
            } catch (firebaseError) {
              console.warn('⚠️ Firebase Storage failed, trying alternative storage:', firebaseError);
              alternativeStorageUsed = true;
            }
          }
          if (!storedAsset && alternativeStorageAvailable) {
            try {
              const completedAsset = await meshyApiService.pollForCompletion(generation.id);
              const storageResult = await alternativeStorageService.storeMeshyAssetUrl(
                completedAsset.downloadUrl || completedAsset.previewUrl || '',
                `${request.originalPrompt}.${request.outputFormat || 'glb'}`,
                request.userId,
                {
                  meshyId: generation.id,
                  originalPrompt: request.originalPrompt,
                  skyboxId: request.skyboxId,
                  quality: request.quality || 'medium',
                  style: request.style || 'realistic'
                }
              );
              if (storageResult.success) {
                storedAsset = {
                  id: storageResult.identifier!,
                  userId: request.userId,
                  skyboxId: request.skyboxId,
                  prompt: request.originalPrompt,
                  originalPrompt: request.originalPrompt,
                  category: 'custom',
                  confidence: 1,
                  status: 'completed',
                  downloadUrl: storageResult.url!,
                  previewUrl: storageResult.url!,
                  format: request.outputFormat || 'glb',
                  size: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  metadata: {
                    meshyId: generation.id,
                    generationTime: Date.now() - startTime,
                    cost: meshyApiService.getCostEstimate(request.quality || 'medium'),
                    quality: request.quality || 'medium',
                    style: request.style || 'realistic',
                    tags: ['custom', request.originalPrompt],
                    storageProvider: storageResult.provider
                  }
                };
                alternativeStorageUsed = true;
              }
            } catch (alternativeError) {
              console.error('❌ Alternative storage also failed:', alternativeError);
              throw alternativeError;
            }
          }
          if (storedAsset) {
            result.assets.push(storedAsset);
            result.totalCost += meshyApiService.getCostEstimate(request.quality || 'medium');
            if (alternativeStorageUsed) {
              result.alternativeStorageUsed = true;
            }
          }
          onProgress?.({
            stage: 'completed',
            progress: 100,
            totalAssets: 1,
            completedAssets: 1,
            message: 'Asset generated successfully.'
          });
          result.success = result.assets.length > 0;
          result.totalTime = Date.now() - startTime;
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(errorMessage);
          onProgress?.({
            stage: 'failed',
            progress: 100,
            totalAssets: 1,
            completedAssets: 0,
            message: errorMessage
          });
          return result;
        }
      }

      // Default: multi-object/skybox flow (keep extraction)
      const extractedObjects = keywordExtractionService.extractObjects(request.originalPrompt);
      
      if (extractedObjects.length === 0) {
        result.errors.push('No 3D objects detected in the prompt');
        onProgress?.({
          stage: 'failed',
          progress: 100,
          totalAssets: 0,
          completedAssets: 0,
          message: 'No 3D objects found in prompt'
        });
        return result;
      }

      // Limit the number of assets to generate
      const maxAssets = request.maxAssets || 3;
      const objectsToGenerate = extractedObjects.slice(0, maxAssets);

      onProgress?.({
        stage: 'extracting',
        progress: 50,
        totalAssets: objectsToGenerate.length,
        completedAssets: 0,
        message: `Found ${objectsToGenerate.length} objects to generate`
      });

      result.extractedObjects = objectsToGenerate;

      // Stage 2: Generate assets with Meshy.ai
      onProgress?.({
        stage: 'generating',
        progress: 0,
        totalAssets: objectsToGenerate.length,
        completedAssets: 0,
        message: 'Starting 3D asset generation...'
      });

      const generationPromises = objectsToGenerate.map(async (extractedObject, index) => {
        try {
          // Create Meshy generation request
          const meshyRequest: MeshyGenerationRequest = {
            prompt: extractedObject.suggestedPrompt,
            style: request.style || 'realistic',
            quality: request.quality || 'medium',
            output_format: request.outputFormat || 'glb'
          };

          // Validate request
          const validation = meshyApiService.validateRequest(meshyRequest);
          if (!validation.valid) {
            throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
          }

          // Update progress
          onProgress?.({
            stage: 'generating',
            progress: (index / objectsToGenerate.length) * 50,
            currentAsset: extractedObject.keyword,
            totalAssets: objectsToGenerate.length,
            completedAssets: index,
            message: `Generating ${extractedObject.keyword}...`
          });

          // Generate asset
          const generation = await meshyApiService.generateAsset(meshyRequest);
          
          // Stage 3: Store asset using available storage
          onProgress?.({
            stage: 'storing',
            progress: (index / objectsToGenerate.length) * 25,
            currentAsset: extractedObject.keyword,
            totalAssets: objectsToGenerate.length,
            completedAssets: index,
            message: `Storing ${extractedObject.keyword}...`
          });

          let storedAsset: StoredAsset | null = null;
          let alternativeStorageUsed = false;

          // Try Firebase Storage first
          if (firebaseStorageAvailable) {
            try {
              // Store initial metadata
              const assetId = await assetStorageService.storeAssetMetadata(
                {
                  id: generation.id,
                  prompt: generation.prompt,
                  status: generation.status,
                  format: request.outputFormat || 'glb',
                  createdAt: generation.created_at,
                  updatedAt: generation.updated_at
                },
                extractedObject,
                request.userId,
                request.skyboxId,
                request.originalPrompt
              );

              // Poll for completion
              const completedAsset = await meshyApiService.pollForCompletion(generation.id);
              
              // Calculate generation time and cost
              const generationTime = Date.now() - startTime;
              const cost = meshyApiService.getCostEstimate(request.quality || 'medium');

              // Update asset with completion data
              await assetStorageService.updateAssetCompletion(assetId, completedAsset, generationTime, cost);

              // Get the stored asset
              storedAsset = await assetStorageService.getAsset(assetId);
            } catch (firebaseError) {
              console.warn('⚠️ Firebase Storage failed, trying alternative storage:', firebaseError);
              alternativeStorageUsed = true;
            }
          }

          // If Firebase Storage failed or is not available, use alternative storage
          if (!storedAsset && alternativeStorageAvailable) {
            try {
              // Poll for completion first
              const completedAsset = await meshyApiService.pollForCompletion(generation.id);
              
              // Store the Meshy.ai URL directly
              const storageResult = await alternativeStorageService.storeMeshyAssetUrl(
                completedAsset.downloadUrl || completedAsset.previewUrl || '',
                `${extractedObject.keyword}.${request.outputFormat || 'glb'}`,
                request.userId,
                {
                  meshyId: generation.id,
                  originalPrompt: request.originalPrompt,
                  extractedObject,
                  skyboxId: request.skyboxId,
                  quality: request.quality || 'medium',
                  style: request.style || 'realistic'
                }
              );

              if (storageResult.success) {
                // Create a StoredAsset-like object for alternative storage
                storedAsset = {
                  id: storageResult.identifier!,
                  userId: request.userId,
                  skyboxId: request.skyboxId,
                  prompt: extractedObject.suggestedPrompt,
                  originalPrompt: request.originalPrompt,
                  category: extractedObject.category,
                  confidence: extractedObject.confidence,
                  status: 'completed',
                  downloadUrl: storageResult.url!,
                  previewUrl: storageResult.url!,
                  format: request.outputFormat || 'glb',
                  size: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  metadata: {
                    meshyId: generation.id,
                    generationTime: Date.now() - startTime,
                    cost: meshyApiService.getCostEstimate(request.quality || 'medium'),
                    quality: request.quality || 'medium',
                    style: request.style || 'realistic',
                    tags: [extractedObject.category, extractedObject.keyword],
                    storageProvider: storageResult.provider
                  }
                };
                alternativeStorageUsed = true;
              }
            } catch (alternativeError) {
              console.error('❌ Alternative storage also failed:', alternativeError);
              throw alternativeError;
            }
          }

          if (storedAsset) {
            result.assets.push(storedAsset);
            result.totalCost += meshyApiService.getCostEstimate(request.quality || 'medium');
            if (alternativeStorageUsed) {
              result.alternativeStorageUsed = true;
            }
          }

          return { success: true, assetId: storedAsset?.id || '', cost: meshyApiService.getCostEstimate(request.quality || 'medium') };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to generate ${extractedObject.keyword}: ${errorMessage}`);
          return { success: false, assetId: '', cost: 0, error: errorMessage };
        }
      });

      // Wait for all generations to complete
      const generationResults = await Promise.all(generationPromises);
      
      // Stage 4: Finalize and return results
      onProgress?.({
        stage: 'completed',
        progress: 100,
        totalAssets: objectsToGenerate.length,
        completedAssets: result.assets.length,
        message: `Generated ${result.assets.length} assets successfully`
      });

      result.success = result.assets.length > 0;
      result.totalTime = Date.now() - startTime;

      return result;
    } catch (error) {
      console.error('❌ Asset generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        assets: [],
        totalCost: 0,
        totalTime: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Generate a single asset for testing purposes
   */
  async generateSingleAsset(
    keyword: string,
    userId: string,
    skyboxId: string,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<AssetGenerationResult> {
    console.log(`🧪 Testing single asset generation: ${keyword}`);
    
    try {
      // Generate the asset
      const generationResult = await meshyApiService.generateAsset(keyword, quality);
      
      if (!generationResult.success) {
        throw new Error(`Generation failed: ${generationResult.error}`);
      }
      
      // Upload to Firebase Storage
      const uploadResult = await assetStorageService.uploadAsset(
        generationResult.assetUrl,
        keyword,
        userId,
        skyboxId,
        quality
      );
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error}`);
      }
      
      console.log(`✅ Single asset test successful: ${uploadResult.assetId}`);
      
      return {
        success: true,
        assets: [uploadResult.asset],
        totalCost: meshyApiService.getCostPerAsset(quality),
        totalTime: Date.now() - Date.now() // Will be calculated properly in real usage
      };
      
    } catch (error) {
      console.error('❌ Single asset test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        assets: [],
        totalCost: 0,
        totalTime: 0
      };
    }
  }

  /**
   * Get assets for a skybox
   */
  async getAssetsForSkybox(skyboxId: string): Promise<StoredAsset[]> {
    return assetStorageService.getAssetsForSkybox(skyboxId);
  }

  /**
   * Get user's assets
   */
  async getUserAssets(userId: string, limit?: number): Promise<StoredAsset[]> {
    return assetStorageService.getUserAssets(userId, limit);
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    return assetStorageService.deleteAsset(assetId);
  }

  /**
   * Check if Meshy.ai is properly configured
   */
  isMeshyConfigured(): boolean {
    return meshyApiService.isConfigured();
  }

  /**
   * Check if the service is fully available (Meshy + Storage)
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      console.log('🔧 Checking asset generation service availability...');
      
      const meshyConfigured = meshyApiService.isConfigured();
      console.log('✅ Meshy configured:', meshyConfigured);
      
      if (!meshyConfigured) {
        console.warn('⚠️ Meshy API not configured. Check VITE_MESHY_API_KEY environment variable.');
        return false;
      }
      
      const firebaseStorageAvailable = await assetStorageService.isStorageAvailable();
      const alternativeStorageAvailable = alternativeStorageService.isStorageAvailable();
      
      console.log('✅ Firebase Storage available:', firebaseStorageAvailable);
      console.log('✅ Alternative Storage available:', alternativeStorageAvailable);
      
      if (!firebaseStorageAvailable && !alternativeStorageAvailable) {
        console.warn('⚠️ No storage service available. This may be due to:');
        console.warn('   - User not authenticated');
        console.warn('   - Network connectivity problems');
        console.warn('   - Storage configuration issues');
        return false;
      }
      
      const fullyAvailable = meshyConfigured && (firebaseStorageAvailable || alternativeStorageAvailable);
      console.log('✅ Service fully available:', fullyAvailable);
      
      return fullyAvailable;
    } catch (error) {
      console.error('❌ Service availability check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed service status for debugging
   */
  async getServiceStatus(): Promise<{
    meshyConfigured: boolean;
    firebaseStorageAvailable: boolean;
    alternativeStorageAvailable: boolean;
    userAuthenticated: boolean;
    errors: string[];
  }> {
    const status = {
      meshyConfigured: false,
      firebaseStorageAvailable: false,
      alternativeStorageAvailable: false,
      userAuthenticated: false,
      errors: [] as string[]
    };

    try {
      // Check Meshy configuration
      status.meshyConfigured = meshyApiService.isConfigured();
      if (!status.meshyConfigured) {
        status.errors.push('Meshy API key not configured (VITE_MESHY_API_KEY)');
      }

      // Check Firebase storage availability
      try {
        status.firebaseStorageAvailable = await assetStorageService.isStorageAvailable();
        if (!status.firebaseStorageAvailable) {
          status.errors.push('Firebase Storage not available');
        }
      } catch (storageError) {
        status.errors.push(`Firebase Storage error: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
      }

      // Check alternative storage availability
      try {
        status.alternativeStorageAvailable = alternativeStorageService.isStorageAvailable();
        if (!status.alternativeStorageAvailable) {
          status.errors.push('Alternative Storage not available');
        }
      } catch (altStorageError) {
        status.errors.push(`Alternative Storage error: ${altStorageError instanceof Error ? altStorageError.message : 'Unknown error'}`);
      }

      // Check user authentication (if we have access to auth context)
      try {
        // This is a basic check - in a real app you'd get this from auth context
        const auth = await import('../config/firebase').then(m => m.auth);
        status.userAuthenticated = !!auth.currentUser;
        if (!status.userAuthenticated) {
          status.errors.push('User not authenticated');
        }
      } catch (authError) {
        status.errors.push('Unable to check authentication status');
      }

    } catch (error) {
      status.errors.push(`Service status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return status;
  }

  /**
   * Attempt to recover from storage issues
   */
  async attemptStorageRecovery(): Promise<boolean> {
    try {
      console.log('🔄 Attempting storage recovery...');
      
      // Try to reinitialize storage
      await assetStorageService.reinitializeStorage();
      
      // Check if recovery was successful
      const recovered = await assetStorageService.isStorageAvailable();
      
      if (recovered) {
        console.log('✅ Storage recovery successful');
      } else {
        console.log('❌ Storage recovery failed');
      }
      
      return recovered;
    } catch (error) {
      console.error('❌ Storage recovery attempt failed:', error);
      return false;
    }
  }

  /**
   * Check if the service is available (synchronous version for backward compatibility)
   */
  isServiceAvailableSync(): boolean {
    const meshyConfigured = meshyApiService.isConfigured();
    // For sync version, we'll assume storage is available if the service was initialized
    return meshyConfigured;
  }

  /**
   * Get available styles
   */
  async getAvailableStyles(): Promise<string[]> {
    return meshyApiService.getAvailableStyles();
  }

  /**
   * Get object categories
   */
  getObjectCategories() {
    return keywordExtractionService.getObjectCategories();
  }

  /**
   * Preview what objects would be extracted from a prompt (without generating)
   */
  previewExtraction(prompt: string): { hasObjects: boolean; objects: ExtractedObject[]; count: number } {
    const objects = keywordExtractionService.extractObjects(prompt);
    return {
      hasObjects: objects.length > 0,
      objects,
      count: objects.length
    };
  }

  /**
   * Estimate the cost for generating assets from a prompt
   */
  estimateCost(prompt: string, quality: 'low' | 'medium' | 'high' = 'medium'): {
    totalCost: number;
    perAsset: number;
    assetCount: number;
    breakdown: { [key: string]: number };
  } {
    const objects = keywordExtractionService.extractObjects(prompt);
    const perAssetCost = meshyApiService.getCostPerAsset(quality);
    const totalCost = objects.length * perAssetCost;
    
    const breakdown: { [key: string]: number } = {};
    objects.forEach(obj => {
      breakdown[obj.keyword] = perAssetCost;
    });
    
    return {
      totalCost,
      perAsset: perAssetCost,
      assetCount: objects.length,
      breakdown
    };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userId?: string) {
    return assetStorageService.getStorageStats(userId);
  }
}

export const assetGenerationService = new AssetGenerationService(); 