import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { StoredAsset } from '../services/assetStorageService';
import { backgroundGenerationService, type GenerationTask } from '../services/backgroundGenerationService';
import { useAuth } from './AuthContext';

interface SkyboxData {
  id?: string;
  image?: string;
  image_jpg?: string;
  title?: string;
  prompt?: string;
}

interface AssetGenerationContextType {
  // Skybox state
  activeSkybox: SkyboxData | null;
  setActiveSkybox: (skybox: SkyboxData | null) => void;
  activeSkyboxImageUrl: string | null;
  setActiveSkyboxImageUrl: (url: string | null) => void;
  
  // Asset state
  generatedAssets: StoredAsset[];
  setGeneratedAssets: (assets: StoredAsset[]) => void;
  firstGeneratedAsset: StoredAsset | null;
  setFirstGeneratedAsset: (asset: StoredAsset | null) => void;
  
  // Loading states
  isSkyboxLoading: boolean;
  setIsSkyboxLoading: (loading: boolean) => void;
  isAssetsLoading: boolean;
  setIsAssetsLoading: (loading: boolean) => void;
  
  // Background generation state
  activeGenerationTask: GenerationTask | null;
  activeGenerationProgress: {
    stage: string;
    progress: number;
    message: string;
    taskId?: string;
  } | null;
  
  // Generation trigger
  triggerAssetGeneration: (prompt: string, skyboxId?: string) => Promise<void>;
  
  // Reset
  reset: () => void;
}

const AssetGenerationContext = createContext<AssetGenerationContextType | null>(null);

export const AssetGenerationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeSkybox, setActiveSkybox] = useState<SkyboxData | null>(null);
  const [activeSkyboxImageUrl, setActiveSkyboxImageUrl] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<StoredAsset[]>([]);
  const [firstGeneratedAsset, setFirstGeneratedAsset] = useState<StoredAsset | null>(null);
  const [isSkyboxLoading, setIsSkyboxLoading] = useState(false);
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [activeGenerationTask, setActiveGenerationTask] = useState<GenerationTask | null>(null);
  const [activeGenerationProgress, setActiveGenerationProgress] = useState<{
    stage: string;
    progress: number;
    message: string;
    taskId?: string;
  } | null>(null);

  // Restore active generation task on mount
  useEffect(() => {
    const activeTasks = backgroundGenerationService.getActiveTasks();
    if (activeTasks.length > 0) {
      const latestTask = activeTasks[activeTasks.length - 1]; // Get most recent
      setActiveGenerationTask(latestTask);
      setActiveGenerationProgress({
        stage: latestTask.stage || latestTask.status,
        progress: latestTask.progress,
        message: latestTask.message,
        taskId: latestTask.taskId
      });
      
      // Register callback to receive updates
      backgroundGenerationService.registerProgressCallback(latestTask.id, (progress) => {
        setActiveGenerationProgress(progress);
        
        // Update task status
        const updatedTask = backgroundGenerationService.getTask(latestTask.id);
        if (updatedTask) {
          setActiveGenerationTask(updatedTask);
          
          // If completed, add to generated assets
          if (updatedTask.status === 'completed' && updatedTask.result) {
            if (Array.isArray(updatedTask.result)) {
              setGeneratedAssets(prev => [...updatedTask.result as StoredAsset[], ...prev]);
            } else {
              setGeneratedAssets(prev => [updatedTask.result as StoredAsset, ...prev]);
            }
            setActiveGenerationTask(null);
            setActiveGenerationProgress(null);
          } else if (updatedTask.status === 'failed' || updatedTask.status === 'cancelled') {
            setActiveGenerationTask(null);
            setActiveGenerationProgress(null);
          }
        }
      });
    }
  }, []);

  const triggerAssetGeneration = useCallback(async (prompt: string, skyboxId?: string) => {
    // This will be implemented by the component that uses this context
    console.log('Asset generation triggered:', { prompt, skyboxId });
  }, []);

  const reset = useCallback(() => {
    setActiveSkybox(null);
    setActiveSkyboxImageUrl(null);
    setGeneratedAssets([]);
    setFirstGeneratedAsset(null);
    setIsSkyboxLoading(false);
    setIsAssetsLoading(false);
    setActiveGenerationTask(null);
    setActiveGenerationProgress(null);
  }, []);

  return (
    <AssetGenerationContext.Provider
      value={{
        activeSkybox,
        setActiveSkybox,
        activeSkyboxImageUrl,
        setActiveSkyboxImageUrl,
        generatedAssets,
        setGeneratedAssets,
        firstGeneratedAsset,
        setFirstGeneratedAsset,
        isSkyboxLoading,
        setIsSkyboxLoading,
        isAssetsLoading,
        setIsAssetsLoading,
        activeGenerationTask,
        activeGenerationProgress,
        triggerAssetGeneration,
        reset
      }}
    >
      {children}
    </AssetGenerationContext.Provider>
  );
};

export const useAssetGeneration = () => {
  const context = useContext(AssetGenerationContext);
  if (!context) {
    throw new Error('useAssetGeneration must be used within AssetGenerationProvider');
  }
  return context;
};

