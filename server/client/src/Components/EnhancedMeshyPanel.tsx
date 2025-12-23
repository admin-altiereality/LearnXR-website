import React, { useState, useEffect, useCallback, useRef } from 'react';
import { meshyApiService, type MeshyGenerationRequest, type MeshyStyle } from '../services/meshyApiService';
import { Meshy3DViewer, MeshyAssetCard } from './Meshy3DViewer';
import { useAuth } from '../contexts/AuthContext';
import { backgroundGenerationService } from '../services/backgroundGenerationService';
import { useLoading } from '../contexts/LoadingContext';

interface EnhancedMeshyPanelProps {
  onAssetGenerated?: (asset: any) => void;
  onGenerationStart?: () => void;
  onClose?: () => void;
  className?: string;
}

interface GenerationProgress {
  stage: 'idle' | 'generating' | 'polling' | 'completed' | 'failed';
  progress: number;
  message: string;
  taskId?: string;
  estimatedTime?: number;
}

export const EnhancedMeshyPanel: React.FC<EnhancedMeshyPanelProps> = ({
  onAssetGenerated,
  onGenerationStart,
  onClose,
  className = ''
}) => {
  const { user } = useAuth();
  const { showLoading, hideLoading, updateProgress: updateGlobalProgress } = useLoading();
  
  // Helper to get localStorage key
  const getStorageKey = useCallback(() => {
    return user?.uid ? `meshy_ui_state_${user.uid}` : null;
  }, [user?.uid]);

  // Initialize state from localStorage using lazy initializers
  // This function is called once during component initialization
  const getInitialStateFromStorage = (): any => {
    // Try to get user ID from auth context or from any stored state
    // We'll check all possible user IDs in localStorage as a fallback
    if (!user?.uid) {
      // Try to find any meshy_ui_state_* key as fallback
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('meshy_ui_state_')) {
            const stored = localStorage.getItem(key);
            if (stored) {
              const uiState = JSON.parse(stored);
              const oneHourAgo = Date.now() - 60 * 60 * 1000;
              if (uiState.timestamp && uiState.timestamp >= oneHourAgo) {
                return uiState;
              }
            }
          }
        }
      } catch (error) {
        // Ignore errors during fallback search
      }
      return null;
    }
    
    const key = `meshy_ui_state_${user.uid}`;
    
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const uiState = JSON.parse(stored);
      
      // Only restore if stored state is recent (within last hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (uiState.timestamp && uiState.timestamp < oneHourAgo) {
        localStorage.removeItem(key);
        return null;
      }
      
      return uiState;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  };

  // Get cached state once (lazy initialization)
  const cachedStateRef = useRef<any>(null);
  if (cachedStateRef.current === null) {
    cachedStateRef.current = getInitialStateFromStorage();
  }
  const cachedState = cachedStateRef.current;

  // Initialize state with localStorage values (lazy initialization - only called once on mount)
  const [prompt, setPrompt] = useState(cachedState?.prompt || '');
  const [negativePrompt, setNegativePrompt] = useState(cachedState?.negativePrompt || '');
  const [selectedArtStyle, setSelectedArtStyle] = useState<'realistic' | 'sculpture'>(cachedState?.selectedArtStyle || 'realistic');
  const [selectedAiModel, setSelectedAiModel] = useState<'meshy-4' | 'meshy-5'>(cachedState?.selectedAiModel || 'meshy-4');
  const [selectedTopology, setSelectedTopology] = useState<'quad' | 'triangle'>(cachedState?.selectedTopology || 'triangle');
  const [targetPolycount, setTargetPolycount] = useState(cachedState?.targetPolycount ?? 30000);
  const [shouldRemesh, setShouldRemesh] = useState(cachedState?.shouldRemesh ?? true);
  const [symmetryMode, setSymmetryMode] = useState<'off' | 'auto' | 'on'>(cachedState?.symmetryMode || 'auto');
  const [moderation, setModeration] = useState(cachedState?.moderation ?? false);
  const [seed, setSeed] = useState<number | undefined>(cachedState?.seed);
  const [isGenerating, setIsGenerating] = useState(cachedState?.isGenerating ?? false);
  const [progress, setProgress] = useState<GenerationProgress>(cachedState?.progress || {
    stage: 'idle',
    progress: 0,
    message: 'Ready to generate'
  });
  const [generatedAssets, setGeneratedAssets] = useState<any[]>(cachedState?.generatedAssets || []);
  const [availableStyles, setAvailableStyles] = useState<MeshyStyle[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [isRestoring, setIsRestoring] = useState(!cachedState);
  const currentTaskIdRef = useRef<string | null>(null);
  const hasRestoredRef = useRef(false);
  const restorationInProgressRef = useRef(false);
  const skipNextSaveRef = useRef(false); // Skip saving during restoration

  // Save UI state to localStorage whenever it changes (but skip during restoration)
  const saveUIStateToStorage = useCallback(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    
    const key = getStorageKey();
    if (!key || !hasRestoredRef.current) return; // Don't save until initial restoration is done
    
    const uiState = {
      prompt,
      negativePrompt,
      selectedArtStyle,
      selectedAiModel,
      selectedTopology,
      targetPolycount,
      shouldRemesh,
      symmetryMode,
      moderation,
      seed,
      isGenerating,
      progress,
      generatedAssets,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(uiState));
      console.log('💾 Saved UI state to localStorage');
    } catch (error) {
      console.error('Failed to save UI state to localStorage:', error);
    }
  }, [
    getStorageKey,
    prompt,
    negativePrompt,
    selectedArtStyle,
    selectedAiModel,
    selectedTopology,
    targetPolycount,
    shouldRemesh,
    symmetryMode,
    moderation,
    seed,
    isGenerating,
    progress,
    generatedAssets
  ]);

  // Debounced save to localStorage - saves after 500ms of no changes
  // This prevents excessive localStorage writes while ensuring state is saved during generation
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!hasRestoredRef.current) return; // Don't save until initial restoration is done
    
    // Clear previous timeout
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    
    // Save after 500ms of no changes
    debouncedSaveRef.current = setTimeout(() => {
      saveUIStateToStorage();
    }, 500);
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [
    prompt,
    negativePrompt,
    selectedArtStyle,
    selectedAiModel,
    selectedTopology,
    targetPolycount,
    shouldRemesh,
    symmetryMode,
    moderation,
    seed,
    isGenerating,
    progress.stage,
    progress.progress,
    progress.message,
    progress.taskId,
    generatedAssets.length, // Watch length to detect changes
    hasRestoredRef.current
  ]);

  // Re-read localStorage when user changes
  useEffect(() => {
    if (user?.uid && cachedStateRef.current === null) {
      const newCachedState = getInitialStateFromStorage();
      if (newCachedState) {
        cachedStateRef.current = newCachedState;
        // Update state from cached values
        if (newCachedState.prompt) setPrompt(newCachedState.prompt);
        if (newCachedState.negativePrompt !== undefined) setNegativePrompt(newCachedState.negativePrompt);
        if (newCachedState.selectedArtStyle) setSelectedArtStyle(newCachedState.selectedArtStyle);
        if (newCachedState.selectedAiModel) setSelectedAiModel(newCachedState.selectedAiModel);
        if (newCachedState.selectedTopology) setSelectedTopology(newCachedState.selectedTopology);
        if (newCachedState.targetPolycount !== undefined) setTargetPolycount(newCachedState.targetPolycount);
        if (newCachedState.shouldRemesh !== undefined) setShouldRemesh(newCachedState.shouldRemesh);
        if (newCachedState.symmetryMode) setSymmetryMode(newCachedState.symmetryMode);
        if (newCachedState.moderation !== undefined) setModeration(newCachedState.moderation);
        if (newCachedState.seed !== undefined) setSeed(newCachedState.seed);
        if (newCachedState.isGenerating !== undefined) setIsGenerating(newCachedState.isGenerating);
        if (newCachedState.progress) setProgress(newCachedState.progress);
        if (newCachedState.generatedAssets) setGeneratedAssets(newCachedState.generatedAssets);
        setIsRestoring(false);
      }
    }
  }, [user?.uid]);

  // Load available styles and usage on component mount
  useEffect(() => {
    loadStyles();
    loadUsage();
    
    // If we restored from localStorage, mark as restored and skip saving during Firestore restoration
    if (cachedState) {
      console.log('✅ Instant UI restoration from localStorage complete');
      skipNextSaveRef.current = true; // Skip saving during Firestore restoration
    }
    
    // Restore active generation from Firestore (asynchronous, updates if different)
    if (!hasRestoredRef.current && !restorationInProgressRef.current) {
      hasRestoredRef.current = true;
      restorationInProgressRef.current = true;
      restoreActiveGeneration().finally(() => {
        restorationInProgressRef.current = false;
        // After Firestore restoration, allow saving again
        skipNextSaveRef.current = false;
      });
    }
    
    // Cleanup on unmount
    // Note: We only unregister the callback - polling continues in the background
    return () => {
      if (currentTaskIdRef.current) {
        // Unregister callback but DON'T stop polling
        // Polling continues independently and updates Firestore
        backgroundGenerationService.unregisterProgressCallback(currentTaskIdRef.current);
        console.log(`📝 Component unmounting, unregistered callback for ${currentTaskIdRef.current}, but polling continues`);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore active generation if one exists
  const restoreActiveGeneration = useCallback(async () => {
    if (!user?.uid) {
      setIsRestoring(false);
      return;
    }

    try {
      console.log('🔄 Starting UI restoration for user:', user.uid);
      setIsRestoring(true);
      
      // Initialize service for user (fetches active jobs from Firestore)
      await backgroundGenerationService.initializeForUser(user.uid);
      
      // Get ALL tasks for this user (including recently completed)
      const allTasks = backgroundGenerationService.getAllTasks();
      const meshyTasks = allTasks
        .filter(task => task.type === 'meshy' && task.userId === user.uid)
        .sort((a, b) => b.startedAt - a.startedAt); // Most recent first
      
      console.log(`📊 Found ${meshyTasks.length} Meshy tasks for user`);
      
      if (meshyTasks.length > 0) {
        const latestTask = meshyTasks[meshyTasks.length - 1];
        console.log('✅ Restoring task:', latestTask.id, 'Status:', latestTask.status, 'Progress:', latestTask.progress);
        
        currentTaskIdRef.current = latestTask.id;
        
        // FIRST: Restore UI state BEFORE setting generating state
        // This ensures the form fields are populated before the UI renders
        if (latestTask.uiState) {
          console.log('📝 Restoring UI state:', latestTask.uiState);
          setPrompt(latestTask.uiState.prompt || latestTask.prompt);
          setNegativePrompt(latestTask.uiState.negativePrompt || '');
          if (latestTask.uiState.artStyle) setSelectedArtStyle(latestTask.uiState.artStyle as 'realistic' | 'sculpture');
          if (latestTask.uiState.aiModel) setSelectedAiModel(latestTask.uiState.aiModel as 'meshy-4' | 'meshy-5');
          if (latestTask.uiState.topology) setSelectedTopology(latestTask.uiState.topology as 'quad' | 'triangle');
          if (latestTask.uiState.targetPolycount) setTargetPolycount(latestTask.uiState.targetPolycount);
          if (latestTask.uiState.shouldRemesh !== undefined) setShouldRemesh(latestTask.uiState.shouldRemesh);
          if (latestTask.uiState.symmetryMode) setSymmetryMode(latestTask.uiState.symmetryMode as 'off' | 'auto' | 'on');
          if (latestTask.uiState.moderation !== undefined) setModeration(latestTask.uiState.moderation);
          if (latestTask.uiState.seed !== undefined) setSeed(latestTask.uiState.seed);
        } else {
          // Fallback: restore prompt at least
          console.log('⚠️ No UI state found, using prompt only');
          setPrompt(latestTask.prompt);
        }
        
        // THEN: Set generating state and progress
        setIsGenerating(latestTask.status !== 'completed' && latestTask.status !== 'failed');
        setProgress({
          stage: latestTask.status === 'polling' ? 'polling' : 
                 latestTask.status === 'completed' ? 'completed' :
                 latestTask.status === 'failed' ? 'failed' : 'generating',
          progress: latestTask.progress,
          message: latestTask.message,
          taskId: latestTask.taskId
        });
        
        // Restore generated assets if task is completed
        if (latestTask.status === 'completed' && latestTask.result) {
          console.log('✅ Task already completed, restoring assets and UI');
          if (!Array.isArray(latestTask.result)) {
            // Single asset - ensure it has proper metadata
            const assetWithMetadata = {
              ...latestTask.result,
              metadata: {
                ...latestTask.result.metadata,
                category: 'custom',
                confidence: 1,
                originalPrompt: latestTask.prompt,
                userId: user.uid,
                generationTime: latestTask.completedAt || Date.now(),
                cost: estimateCost(),
                art_style: latestTask.metadata?.artStyle || latestTask.uiState?.artStyle,
                ai_model: latestTask.metadata?.aiModel || latestTask.uiState?.aiModel,
                topology: latestTask.metadata?.topology || latestTask.uiState?.topology,
                target_polycount: latestTask.metadata?.targetPolycount || latestTask.uiState?.targetPolycount
              }
            };
            setGeneratedAssets([assetWithMetadata]);
            onAssetGenerated?.(assetWithMetadata);
            console.log('✅ Restored completed asset:', assetWithMetadata.id);
          } else {
            // Multiple assets
            setGeneratedAssets(latestTask.result);
            console.log(`✅ Restored ${latestTask.result.length} completed assets`);
          }
          setIsGenerating(false);
          setProgress({
            stage: 'completed',
            progress: 100,
            message: 'Generation completed successfully!',
            taskId: latestTask.taskId
          });
          hideLoading();
        } else if (latestTask.status === 'failed') {
          setError(latestTask.error || 'Generation failed');
          setIsGenerating(false);
          hideLoading();
        } else {
          // Task is still in progress - show loading
          showLoading({
            type: '3d-asset',
            progress: latestTask.progress,
            message: latestTask.message,
            stage: latestTask.stage || latestTask.status
          });
        }
        
        // Register callback to receive updates
        backgroundGenerationService.registerProgressCallback(latestTask.id, (progressUpdate) => {
          console.log('📊 Progress update:', progressUpdate);
          setProgress({
            stage: progressUpdate.stage as any,
            progress: progressUpdate.progress,
            message: progressUpdate.message,
            taskId: progressUpdate.taskId
          });
          
          // Immediately save progress to localStorage (bypass debounce for critical updates)
          if (hasRestoredRef.current) {
            const key = getStorageKey();
            if (key) {
              try {
                const currentState = {
                  prompt,
                  negativePrompt,
                  selectedArtStyle,
                  selectedAiModel,
                  selectedTopology,
                  targetPolycount,
                  shouldRemesh,
                  symmetryMode,
                  moderation,
                  seed,
                  isGenerating: latestTask.status !== 'completed' && latestTask.status !== 'failed',
                  progress: {
                    stage: progressUpdate.stage as any,
                    progress: progressUpdate.progress,
                    message: progressUpdate.message,
                    taskId: progressUpdate.taskId
                  },
                  generatedAssets,
                  timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(currentState));
                console.log('💾 Saved progress update to localStorage (restoration)');
              } catch (error) {
                console.error('Failed to save progress to localStorage:', error);
              }
            }
          }
          
          updateGlobalProgress(progressUpdate.progress, progressUpdate.message, progressUpdate.stage);
          
          // Update global loading indicator
          if (progressUpdate.progress < 100) {
            showLoading({
              type: '3d-asset',
              progress: progressUpdate.progress,
              message: progressUpdate.message,
              stage: progressUpdate.stage
            });
          } else {
            hideLoading();
            // Check if task completed
            const task = backgroundGenerationService.getTask(latestTask.id);
            if (task && task.status === 'completed' && task.result) {
              handleTaskCompleted(task);
            }
          }
        });
      } else {
        console.log('ℹ️ No active tasks found');
      }
    } catch (error) {
      console.error('❌ Failed to restore active generation:', error);
      setError('Failed to restore generation state');
    } finally {
      setIsRestoring(false);
      restorationInProgressRef.current = false;
      console.log('✅ UI restoration complete');
    }
  }, [user?.uid, showLoading, hideLoading, updateGlobalProgress, onAssetGenerated, estimateCost]);

  const handleTaskCompleted = useCallback((task: any) => {
    setIsGenerating(false);
    setProgress({
      stage: 'completed',
      progress: 100,
      message: 'Generation completed successfully!'
    });
    hideLoading();
    
    if (task.result && !Array.isArray(task.result)) {
      const assetWithMetadata = {
        ...task.result,
        metadata: {
          ...task.result.metadata,
          category: 'custom',
          confidence: 1,
          originalPrompt: task.prompt,
          userId: user?.uid,
          generationTime: task.completedAt || Date.now(),
          cost: estimateCost(),
          art_style: task.metadata?.artStyle,
          ai_model: task.metadata?.aiModel,
          topology: task.metadata?.topology,
          target_polycount: task.metadata?.targetPolycount
        }
      };
      
      setGeneratedAssets(prev => [assetWithMetadata, ...prev]);
      onAssetGenerated?.(assetWithMetadata);
    }
    
    currentTaskIdRef.current = null;
    loadUsage();
  }, [user, onAssetGenerated, hideLoading]);

  const loadStyles = async () => {
    try {
      const styles = await meshyApiService.getAvailableStyles();
      setAvailableStyles(styles);
    } catch (error) {
      console.error('Failed to load styles:', error);
    }
  };

  const loadUsage = async () => {
    try {
      const usageData = await meshyApiService.getUsage();
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const validatePrompt = useCallback((text: string) => {
    if (!text.trim()) return 'Prompt is required';
    if (text.length > 600) return 'Prompt must be 600 characters or less';
    return null;
  }, []);

  const estimateCost = useCallback(() => {
    // Meshy doesn't provide quality-based pricing, using fixed cost
    return 0.05; // Estimated cost per generation
  }, []);

  const estimateTime = useCallback(() => {
    // Meshy doesn't provide quality-based timing, using fixed time
    return 90; // Estimated time in seconds
  }, []);

  const handleGenerate = async () => {
    if (!user?.uid) {
      setError('You must be logged in to generate 3D assets');
      return;
    }

    const promptError = validatePrompt(prompt);
    if (promptError) {
      setError(promptError);
      return;
    }

    if (!meshyApiService.isConfigured()) {
      setError('Meshy API is not configured. Please contact support.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({
      stage: 'generating',
      progress: 0,
      message: 'Initiating generation...'
    });
    
    // Save UI state immediately when generation starts
    const uiState = {
      prompt,
      negativePrompt,
      artStyle: selectedArtStyle,
      aiModel: selectedAiModel,
      topology: selectedTopology,
      targetPolycount,
      shouldRemesh,
      symmetryMode,
      moderation,
      seed
    };
    
    onGenerationStart?.(); // Call the new prop

    // Show global loading indicator
    showLoading({
      type: '3d-asset',
      progress: 0,
      message: 'Initiating generation...',
      stage: 'generating'
    });

    try {
      const request: MeshyGenerationRequest = {
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        art_style: selectedArtStyle,
        seed: seed || Math.floor(Math.random() * 1000000),
        ai_model: selectedAiModel,
        topology: selectedTopology,
        target_polycount: targetPolycount,
        should_remesh: shouldRemesh,
        symmetry_mode: symmetryMode,
        moderation: moderation
      };

      // Validate request
      const validation = meshyApiService.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      // Save UI state
      const uiState = {
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim(),
        artStyle: selectedArtStyle,
        aiModel: selectedAiModel,
        topology: selectedTopology,
        targetPolycount: targetPolycount,
        shouldRemesh: shouldRemesh,
        symmetryMode: symmetryMode,
        moderation: moderation,
        seed: seed
      };

      // Start background generation with UI state
      const taskId = await backgroundGenerationService.startMeshyGeneration(
        user.uid,
        request,
        uiState,
        (progressUpdate) => {
          setProgress({
            stage: progressUpdate.stage as any,
            progress: progressUpdate.progress,
            message: progressUpdate.message,
            taskId: progressUpdate.taskId
          });
          
          // Immediately save progress to localStorage (bypass debounce for critical updates)
          if (hasRestoredRef.current) {
            const key = getStorageKey();
            if (key) {
              try {
                const currentState = {
                  prompt,
                  negativePrompt,
                  selectedArtStyle,
                  selectedAiModel,
                  selectedTopology,
                  targetPolycount,
                  shouldRemesh,
                  symmetryMode,
                  moderation,
                  seed,
                  isGenerating: true,
                  progress: {
                    stage: progressUpdate.stage as any,
                    progress: progressUpdate.progress,
                    message: progressUpdate.message,
                    taskId: progressUpdate.taskId
                  },
                  generatedAssets,
                  timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(currentState));
                console.log('💾 Saved progress update to localStorage');
              } catch (error) {
                console.error('Failed to save progress to localStorage:', error);
              }
            }
          }
          
          updateGlobalProgress(progressUpdate.progress, progressUpdate.message, progressUpdate.stage);
          
          // Update global loading indicator
          showLoading({
            type: '3d-asset',
            progress: progressUpdate.progress,
            message: progressUpdate.message,
            stage: progressUpdate.stage
          });
        }
      );

      currentTaskIdRef.current = taskId;

      // Register callback to handle completion - will be called by the service
      backgroundGenerationService.registerProgressCallback(taskId, (progressUpdate) => {
        // Progress updates are already handled above
        // Check for completion
        if (progressUpdate.progress >= 100 || progressUpdate.stage === 'completed') {
          // Small delay to ensure task is updated
          setTimeout(() => {
            const task = backgroundGenerationService.getTask(taskId);
            if (task && task.status === 'completed') {
              handleTaskCompleted(task);
            }
          }, 500);
        }
      });

    } catch (error) {
      console.error('Generation failed:', error);
      
      // Extract user-friendly error message
      let errorMessage = 'Generation failed';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for specific error types
        if (errorMessage.includes('402') || errorMessage.includes('Insufficient funds')) {
          errorMessage = '⚠️ Insufficient funds in your Meshy.ai account. Please add credits to continue generating 3D assets.';
        } else if (errorMessage.includes('401') || errorMessage.includes('Invalid')) {
          errorMessage = '⚠️ Invalid Meshy API key. Please check your API configuration.';
        } else if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
          errorMessage = '⚠️ Rate limit exceeded. Please wait a moment before trying again.';
        }
      }
      
      setError(errorMessage);
      setProgress({
        stage: 'failed',
        progress: 0,
        message: errorMessage
      });
      hideLoading();
      setIsGenerating(false);
    }
  };

  const handleDownload = async (assetId: string) => {
    const asset = generatedAssets.find(a => a.id === assetId);
    if (!asset?.downloadUrl) return;

    try {
      console.log('📥 Starting download for asset:', assetId);
      console.log('🔗 Download URL:', asset.downloadUrl);
      
      // Use the improved download method with fallback strategies
      const blob = await meshyApiService.downloadAsset(asset.downloadUrl);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asset.prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${asset.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('✅ Download completed successfully');
    } catch (error) {
      console.error('❌ Download failed:', error);
      setError(`Failed to download asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (assetId: string) => {
    setGeneratedAssets(prev => prev.filter(a => a.id !== assetId));
  };

  const handleView = (assetId: string) => {
    // This could open a modal or navigate to a full-screen viewer
    console.log('View asset:', assetId);
  };

  // Show loading state while restoring
  if (isRestoring) {
    return (
      <div className={`bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/50 p-2 sm:p-3 lg:p-4 w-full ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">Restoring generation state...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/50 p-2 sm:p-3 lg:p-4 w-full ${className}`}>
      {/* Header - Hidden in this context since it's in the left panel */}
      {onClose && (
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">🎨 3D Asset Generator</h2>
            <p className="text-gray-400 text-xs">Powered by Meshy.ai</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Usage Info - Compact */}
      {usage && (
        <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-300">Quota:</span>
            <span className="text-white">{usage.quota_remaining}/{usage.quota_limit}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-blue-300">Cost:</span>
            <span className="text-white">${usage.total_cost.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${((usage.quota_limit - usage.quota_remaining) / usage.quota_limit) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Generation Form */}
      <div className="space-y-2 sm:space-y-3 mb-2 sm:mb-3">
        {/* Prompt Input */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Describe your 3D object *
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A futuristic spaceship with glowing engines and metallic wings"
            className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            rows={2}
            maxLength={600}
            disabled={isGenerating}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{prompt.length}/600</span>
            <span>${estimateCost().toFixed(2)} | ~{Math.ceil(estimateTime() / 60)}min</span>
          </div>
        </div>

        {/* Negative Prompt */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
            Negative Prompt (optional)
          </label>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="e.g., blurry, low quality, distorted"
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            maxLength={1000}
            disabled={isGenerating}
          />
        </div>

        {/* Basic Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          {/* Art Style Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
              Art Style
            </label>
            <select
              value={selectedArtStyle}
              onChange={(e) => setSelectedArtStyle(e.target.value as 'realistic' | 'sculpture')}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="realistic">Realistic</option>
              <option value="sculpture">Sculpture</option>
            </select>
          </div>

          {/* AI Model Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
              AI Model
            </label>
            <select
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value as 'meshy-4' | 'meshy-5')}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="meshy-4">Meshy 4 (Faster)</option>
              <option value="meshy-5">Meshy 5 (Better Quality)</option>
            </select>
          </div>
        </div>

        {/* Advanced Controls Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          <span>Advanced Options</span>
        </button>

        {/* Advanced Controls */}
        {showAdvanced && (
          <div className="space-y-3 sm:space-y-4 p-2 sm:p-3 lg:p-4 bg-gray-800/30 rounded-lg border border-gray-700/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {/* Topology */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Topology
                </label>
                <select
                  value={selectedTopology}
                  onChange={(e) => setSelectedTopology(e.target.value as 'quad' | 'triangle')}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="triangle">Triangle (Default)</option>
                  <option value="quad">Quad (Better for editing)</option>
                </select>
              </div>

              {/* Target Polycount */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Target Polycount
                </label>
                <input
                  type="number"
                  min="100"
                  max="300000"
                  value={targetPolycount}
                  onChange={(e) => setTargetPolycount(parseInt(e.target.value))}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Range: 100 - 300,000
                </div>
              </div>

              {/* Symmetry Mode */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Symmetry Mode
                </label>
                <select
                  value={symmetryMode}
                  onChange={(e) => setSymmetryMode(e.target.value as 'off' | 'auto' | 'on')}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="auto">Auto (Recommended)</option>
                  <option value="on">On (Force symmetry)</option>
                  <option value="off">Off (No symmetry)</option>
                </select>
              </div>

              {/* Seed */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Seed (Optional)
                </label>
                <input
                  type="number"
                  value={seed || ''}
                  onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Random"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Leave empty for random
                </div>
              </div>
            </div>

            {/* Remesh and Moderation Options */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={shouldRemesh}
                  onChange={(e) => setShouldRemesh(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-300">Should Remesh (Recommended)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={moderation}
                  onChange={(e) => setModeration(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-300">Enable Content Moderation</span>
              </label>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-2 sm:p-3 bg-red-900/50 border border-red-500/50 rounded-md">
            <div className="text-red-400 text-xs sm:text-sm">{error}</div>
          </div>
        )}

        {/* Progress Display - Always visible when generating, completed, or when progress exists */}
        {(isGenerating || progress.stage === 'completed' || (progress.stage !== 'idle' && progress.progress > 0)) && (
          <div className={`p-2 sm:p-3 lg:p-4 rounded-lg mb-2 sm:mb-3 border ${
            progress.stage === 'completed' 
              ? 'bg-emerald-900/20 border-emerald-700/30' 
              : progress.stage === 'failed'
              ? 'bg-red-900/20 border-red-700/30'
              : 'bg-blue-900/20 border-blue-700/30'
          }`}>
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className={`text-xs sm:text-sm font-medium ${
                progress.stage === 'completed' 
                  ? 'text-emerald-300' 
                  : progress.stage === 'failed'
                  ? 'text-red-300'
                  : 'text-blue-300'
              }`}>
                {progress.message}
              </span>
              {progress.progress > 0 && (
                <span className={`text-xs sm:text-sm font-semibold ${
                  progress.stage === 'completed' 
                    ? 'text-emerald-400' 
                    : progress.stage === 'failed'
                    ? 'text-red-400'
                    : 'text-blue-400'
                }`}>
                  {Math.round(progress.progress)}%
                </span>
              )}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2">
              <div 
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  progress.stage === 'completed' 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500' 
                    : progress.stage === 'failed'
                    ? 'bg-gradient-to-r from-red-500 to-red-600'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(progress.progress, 100)}%` }}
              ></div>
            </div>
            {progress.estimatedTime && progress.stage !== 'completed' && (
              <div className="text-xs text-gray-400 mt-1">
                ~{Math.ceil(progress.estimatedTime / 60)} minutes remaining
              </div>
            )}
            {progress.stage && progress.stage !== 'idle' && (
              <div className={`text-xs mt-1 capitalize ${
                progress.stage === 'completed' 
                  ? 'text-emerald-400' 
                  : progress.stage === 'failed'
                  ? 'text-red-400'
                  : 'text-blue-400'
              }`}>
                {progress.stage === 'completed' ? '✅ Completed' : 
                 progress.stage === 'failed' ? '❌ Failed' :
                 `Stage: ${progress.stage}`}
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-blue-500/50 to-purple-600/50 hover:from-blue-600/60 hover:to-purple-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50 text-sm sm:text-base"
        >
          {isGenerating ? 'Generating...' : `Generate 3D Asset (${estimateCost().toFixed(2)})`}
        </button>
      </div>

      {/* Generated Assets */}
      {generatedAssets.length > 0 && (
        <div className="mt-4 sm:mt-6 lg:mt-8">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-4">Generated Assets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            {generatedAssets.map((asset) => (
              <MeshyAssetCard
                key={asset.id}
                asset={asset}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onView={handleView}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 