// useGenerate Hook - Unified generation system for skybox and mesh assets
// Uses Promise.allSettled() to call both APIs in parallel

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { skyboxApiService } from '../services/skyboxApiService';
import { meshyApiService } from '../services/meshyApiService';
import { unifiedStorageService } from '../services/unifiedStorageService';
import type { 
  GenerationRequest, 
  GenerationResponse, 
  GenerationProgress,
  UnifiedGenerationHookResult,
  Job,
  SkyboxResult,
  MeshResult,
  DownloadInfo,
  ApiError
} from '../types/unifiedGeneration';

interface SkyboxApiResponse {
  success: boolean;
  data?: {
    generationId: string;
    status: string;
  };
  error?: string;
}

interface MeshyApiResponse {
  success: boolean;
  result?: string;
  error?: string;
}

export const useGenerate = (): UnifiedGenerationHookResult => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const validateRequest = useCallback((request: GenerationRequest): string[] => {
    const errors: string[] = [];
    
    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }
    
    if (request.prompt && request.prompt.length > 1000) {
      errors.push('Prompt must be 1000 characters or less');
    }
    
    if (!request.userId) {
      errors.push('User ID is required');
    }
    
    if (request.skyboxConfig && !request.skyboxConfig.styleId) {
      errors.push('Skybox style ID is required when skybox generation is enabled');
    }
    
    return errors;
  }, []);

  const pollSkyboxStatus = useCallback(async (
    generationId: string,
    jobId: string,
    onProgress: (progress: number) => void
  ): Promise<SkyboxResult> => {
    const maxAttempts = 30; // 5 minutes max
    const pollInterval = 10000; // 10 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await skyboxApiService.getSkyboxStatus(generationId);
        
        if (response.success && response.data) {
          const status = response.data.status;
          
          if (status === 'completed' || status === 'complete') {
            return {
              id: generationId,
              status: 'completed',
              fileUrl: response.data.file_url,
              thumbnailUrl: response.data.thumbnail_url,
              downloadUrl: response.data.file_url,
              prompt: response.data.prompt || '',
              styleId: response.data.style_id || '',
              format: 'png',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: {
                size: response.data.size,
                style: response.data.style_name
              }
            };
          } else if (status === 'failed' || status === 'error') {
            throw new Error(`Skybox generation failed: ${response.data.error || 'Unknown error'}`);
          }
          
          // Update progress
          const progressPercent = Math.min((attempts / maxAttempts) * 100, 95);
          onProgress(progressPercent);
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error polling skybox status:', error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('Skybox generation timed out');
  }, []);

  const pollMeshStatus = useCallback(async (
    taskId: string,
    jobId: string,
    onProgress: (progress: number) => void
  ): Promise<MeshResult> => {
    try {
      const completedAsset = await meshyApiService.pollForCompletion(taskId);
      
      return {
        id: taskId,
        status: 'completed',
        downloadUrl: completedAsset.downloadUrl,
        previewUrl: completedAsset.previewUrl,
        prompt: completedAsset.prompt || '',
        format: 'glb',
        quality: 'medium',
        style: 'realistic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          polycount: completedAsset.metadata?.polycount,
          size: completedAsset.metadata?.size,
          generationTime: completedAsset.metadata?.generationTime,
          cost: completedAsset.metadata?.cost
        }
      };
    } catch (error) {
      console.error('Error polling mesh status:', error);
      throw error;
    }
  }, []);

  const generateSkybox = useCallback(async (
    request: GenerationRequest,
    jobId: string
  ): Promise<SkyboxResult> => {
    if (!request.skyboxConfig) {
      throw new Error('Skybox configuration is required');
    }

    const response = await skyboxApiService.generateSkybox({
      prompt: request.prompt,
      style_id: request.skyboxConfig.styleId,
      negative_prompt: request.skyboxConfig.negativePrompt,
      userId: request.userId
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to start skybox generation');
    }

    return await pollSkyboxStatus(
      response.data.generationId,
      jobId,
      (progress) => {
        setProgress(prev => prev ? {
          ...prev,
          skyboxProgress: progress,
          overallProgress: (progress + prev.meshProgress) / 2
        } : null);
      }
    );
  }, [pollSkyboxStatus]);

  const generateMesh = useCallback(async (
    request: GenerationRequest,
    jobId: string
  ): Promise<MeshResult> => {
    const meshConfig = request.meshConfig || {};
    
    const meshRequest = {
      prompt: request.prompt,
      art_style: meshConfig.style || 'realistic',
      ai_model: meshConfig.aiModel || 'meshy-4',
      topology: meshConfig.topology || 'triangle',
      target_polycount: meshConfig.targetPolycount || 30000,
      should_remesh: true,
      symmetry_mode: 'auto' as const,
      moderation: false
    };

    const response = await meshyApiService.generateAsset(meshRequest);

    if (!response.result) {
      throw new Error('Failed to start mesh generation');
    }

    return await pollMeshStatus(
      response.result,
      jobId,
      (progress) => {
        setProgress(prev => prev ? {
          ...prev,
          meshProgress: progress,
          overallProgress: (prev.skyboxProgress + progress) / 2
        } : null);
      }
    );
  }, [pollMeshStatus]);

  const generateAssets = useCallback(async (
    request: GenerationRequest
  ): Promise<GenerationResponse> => {
    try {
      // Validate request
      const validationErrors = validateRequest(request);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      if (!user?.uid) {
        throw new Error('User must be logged in');
      }

      setIsGenerating(true);
      setError(null);

      // Create job
      const jobId = unifiedStorageService.generateJobId();
      const job = await unifiedStorageService.createJob(jobId, request.prompt, user.uid);
      setCurrentJob(job);

      // Initialize progress
      setProgress({
        jobId,
        stage: 'initializing',
        skyboxProgress: 0,
        meshProgress: 0,
        overallProgress: 0,
        message: 'Initializing generation...',
        errors: []
      });

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Generate timestamp for storage
      const timestamp = unifiedStorageService.generateTimestamp();

      // Start parallel generation using Promise.allSettled
      const generationPromises: Promise<SkyboxResult | MeshResult>[] = [];
      
      // Add skybox generation if configured
      if (request.skyboxConfig) {
        setProgress(prev => prev ? { ...prev, stage: 'skybox_generating', message: 'Generating skybox...' } : null);
        generationPromises.push(generateSkybox(request, jobId));
      }

      // Add mesh generation if configured
      if (request.meshConfig !== false) { // Default to true unless explicitly false
        setProgress(prev => prev ? { ...prev, stage: 'mesh_generating', message: 'Generating mesh...' } : null);
        generationPromises.push(generateMesh(request, jobId));
      }

      if (generationPromises.length === 0) {
        throw new Error('At least one generation type must be enabled');
      }

      // Execute parallel generation
      const results = await Promise.allSettled(generationPromises);
      
      // Process results
      let skyboxResult: SkyboxResult | undefined;
      let meshResult: MeshResult | undefined;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const asset = result.value;
          if ('styleId' in asset) {
            skyboxResult = asset as SkyboxResult;
          } else {
            meshResult = asset as MeshResult;
          }
        } else {
          const errorMessage = result.reason?.message || 'Unknown error';
          errors.push(errorMessage);
          console.error(`Generation error:`, result.reason);
        }
      });

      // Store assets in Firebase Storage
      setProgress(prev => prev ? { ...prev, stage: 'storing', message: 'Storing assets...' } : null);
      
      let skyboxUrl: string | undefined;
      let meshUrl: string | undefined;

      if (skyboxResult && skyboxResult.downloadUrl) {
        try {
          skyboxUrl = await unifiedStorageService.storeAssetFromUrl(
            skyboxResult.downloadUrl,
            jobId,
            user.uid,
            timestamp,
            'skybox',
            skyboxResult.format
          );
        } catch (error) {
          console.error('Failed to store skybox:', error);
          errors.push(`Failed to store skybox: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (meshResult && meshResult.downloadUrl) {
        try {
          meshUrl = await unifiedStorageService.storeAssetFromUrl(
            meshResult.downloadUrl,
            jobId,
            user.uid,
            timestamp,
            'mesh',
            meshResult.format
          );
        } catch (error) {
          console.error('Failed to store mesh:', error);
          errors.push(`Failed to store mesh: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Determine final job status
      let finalStatus: Job['status'] = 'failed';
      if (skyboxResult && meshResult) {
        finalStatus = 'completed';
      } else if (skyboxResult || meshResult) {
        finalStatus = 'partial';
      }

      // Update job with final results
      const jobUpdates: Partial<Job> = {
        status: finalStatus,
        skyboxUrl,
        meshUrl,
        skyboxResult,
        meshResult,
        errors,
        metadata: {
          totalTime: Date.now() - new Date(job.createdAt).getTime(),
          totalCost: (skyboxResult?.metadata?.size || 0) + (meshResult?.metadata?.cost || 0),
          retryCount: 0
        }
      };

      await unifiedStorageService.updateJob(jobId, jobUpdates);
      const updatedJob = await unifiedStorageService.getJob(jobId);
      setCurrentJob(updatedJob);

      // Complete progress
      setProgress(prev => prev ? {
        ...prev,
        stage: 'completed',
        skyboxProgress: 100,
        meshProgress: 100,
        overallProgress: 100,
        message: finalStatus === 'completed' ? 'Generation completed successfully!' : 
                 finalStatus === 'partial' ? 'Generation partially completed' : 
                 'Generation failed',
        errors
      } : null);

      return {
        success: finalStatus !== 'failed',
        jobId,
        skybox: skyboxResult,
        mesh: meshResult,
        errors,
        message: finalStatus === 'completed' ? 'Assets generated successfully' : 
                 finalStatus === 'partial' ? 'Some assets generated successfully' : 
                 'Generation failed'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      setProgress(prev => prev ? {
        ...prev,
        stage: 'failed',
        message: errorMessage,
        errors: [errorMessage]
      } : null);

      return {
        success: false,
        jobId: currentJob?.id || '',
        errors: [errorMessage],
        message: errorMessage
      };
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [user, validateRequest, generateSkybox, generateMesh, currentJob]);

  const downloadAsset = useCallback(async (
    jobId: string,
    type: 'skybox' | 'mesh'
  ): Promise<DownloadInfo> => {
    try {
      const downloadInfo = await unifiedStorageService.getDownloadInfo(jobId, type);
      
      // Create download link
      const link = document.createElement('a');
      link.href = downloadInfo.url;
      link.download = downloadInfo.filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return downloadInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download asset';
      throw new Error(errorMessage);
    }
  }, []);

  const cancelGeneration = useCallback(async (jobId: string): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setIsGenerating(false);
    setProgress(null);
    
    // Update job status
    if (currentJob && currentJob.id === jobId) {
      await unifiedStorageService.updateJob(jobId, {
        status: 'failed',
        errors: ['Generation cancelled by user']
      });
    }
  }, [currentJob]);

  const retryGeneration = useCallback(async (jobId: string): Promise<GenerationResponse> => {
    const job = await unifiedStorageService.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const request: GenerationRequest = {
      prompt: job.prompt,
      userId: job.userId,
      skyboxConfig: job.skyboxResult ? {
        styleId: job.skyboxResult.styleId,
        negativePrompt: job.skyboxResult.negativePrompt
      } : undefined,
      meshConfig: job.meshResult ? {
        quality: job.meshResult.quality,
        style: job.meshResult.style,
        format: job.meshResult.format
      } : undefined
    };

    return await generateAssets(request);
  }, [generateAssets]);

  return {
    isGenerating,
    progress,
    currentJob,
    error,
    generateAssets,
    downloadAsset,
    cancelGeneration,
    retryGeneration
  };
}; 