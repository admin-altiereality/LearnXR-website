/**
 * CreateGenerationContext - Global context for managing Create page generation state
 * 
 * Provides a centralized way to manage generation state across all pages,
 * with localStorage persistence to maintain state across navigation and page refreshes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface GenerationProgress {
  skyboxProgress: number;
  meshProgress: number;
  overallProgress: number;
  stage: string;
  message: string;
  jobId?: string;
  errors?: string[];
}

interface AssetGenerationProgress {
  stage: string;
  progress: number;
  message: string;
  taskId?: string;
}

interface SelectedSkybox {
  id: number | string;
  name: string;
  image_jpg?: string;
  image?: string;
  [key: string]: any;
}

interface GeneratedVariation {
  image: string;
  image_jpg?: string;
  title?: string;
  prompt?: string;
  generationId?: string;
  status?: string;
  [key: string]: any;
}

interface CreateGenerationState {
  // Skybox generation state
  isGenerating: boolean;
  isGenerating3DAsset: boolean;
  skyboxProgress: number;
  assetGenerationProgress: AssetGenerationProgress | null;
  generationProgress: GenerationProgress | null;
  
  // Generation metadata
  currentJobId: string | null;
  prompt: string | null;
  startedAt: number | null;
  
  // UI State - persisted during generation
  negativeText: string | null;
  selectedSkybox: SelectedSkybox | null;
  numVariations: number;
  generated3DAsset: any | null;
  
  // Generated skybox variations (for 3D viewer background)
  generatedVariations: GeneratedVariation[];
  currentVariationIndex: number;
}

interface CreateGenerationContextType {
  state: CreateGenerationState;
  setGenerating: (isGenerating: boolean) => void;
  setGenerating3DAsset: (isGenerating: boolean) => void;
  setSkyboxProgress: (progress: number) => void;
  setAssetGenerationProgress: (progress: AssetGenerationProgress | null) => void;
  setGenerationProgress: (progress: GenerationProgress | null) => void;
  setCurrentJobId: (jobId: string | null) => void;
  setPrompt: (prompt: string | null) => void;
  setNegativeText: (negativeText: string | null) => void;
  setSelectedSkybox: (skybox: SelectedSkybox | null) => void;
  setNumVariations: (numVariations: number) => void;
  setGenerated3DAsset: (asset: any | null) => void;
  setGeneratedVariations: (variations: GeneratedVariation[]) => void;
  setCurrentVariationIndex: (index: number) => void;
  resetGeneration: () => void;
  startGeneration: (prompt: string, jobId?: string) => void;
}

const CreateGenerationContext = createContext<CreateGenerationContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'create_generation_state';
const STORAGE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

const getStorageKey = (userId: string | null): string | null => {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : null;
};

const loadStateFromStorage = (userId: string | null): CreateGenerationState | null => {
  const key = getStorageKey(userId);
  if (!key) return null;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    
    // Check if state is expired
    if (parsed.timestamp && Date.now() - parsed.timestamp > STORAGE_EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }

    // Restore state if generation is in progress OR if we have UI state to restore
    if (parsed.state && (parsed.state.isGenerating || parsed.state.isGenerating3DAsset || 
        parsed.state.prompt || parsed.state.selectedSkybox)) {
      return parsed.state;
    }

    return null;
  } catch (error) {
    console.error('Failed to load generation state from storage:', error);
    return null;
  }
};

const saveStateToStorage = (userId: string | null, state: CreateGenerationState): void => {
  const key = getStorageKey(userId);
  if (!key) return;

  try {
    const data = {
      state,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save generation state to storage:', error);
  }
};

const initialState: CreateGenerationState = {
  isGenerating: false,
  isGenerating3DAsset: false,
  skyboxProgress: 0,
  assetGenerationProgress: null,
  generationProgress: null,
  currentJobId: null,
  prompt: null,
  startedAt: null,
  negativeText: null,
  selectedSkybox: null,
  numVariations: 5,
  generated3DAsset: null,
  generatedVariations: [],
  currentVariationIndex: 0
};

export const CreateGenerationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<CreateGenerationState>(() => {
    // Initialize with default state first
    // We'll restore from storage after user is loaded
    return initialState;
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (user?.uid) {
      saveStateToStorage(user.uid, state);
    }
  }, [state, user?.uid]);

  // Load state when user is available (after initial mount)
  useEffect(() => {
    if (user?.uid) {
      try {
        const restored = loadStateFromStorage(user.uid);
        if (restored) {
          setState(restored);
        }
      } catch (error) {
        console.error('Failed to restore generation state:', error);
        // Continue with initial state if restoration fails
      }
    } else {
      // Clear state when user logs out
      setState(initialState);
    }
  }, [user?.uid]);

  const setGenerating = useCallback((isGenerating: boolean) => {
    setState(prev => ({
      ...prev,
      isGenerating,
      startedAt: isGenerating && !prev.startedAt ? Date.now() : prev.startedAt
    }));
  }, []);

  const setGenerating3DAsset = useCallback((isGenerating3DAsset: boolean) => {
    setState(prev => ({
      ...prev,
      isGenerating3DAsset,
      startedAt: isGenerating3DAsset && !prev.startedAt ? Date.now() : prev.startedAt
    }));
  }, []);

  const setSkyboxProgress = useCallback((skyboxProgress: number) => {
    setState(prev => ({ ...prev, skyboxProgress }));
  }, []);

  const setAssetGenerationProgress = useCallback((assetGenerationProgress: AssetGenerationProgress | null) => {
    setState(prev => ({ ...prev, assetGenerationProgress }));
  }, []);

  const setGenerationProgress = useCallback((generationProgress: GenerationProgress | null) => {
    setState(prev => ({ ...prev, generationProgress }));
  }, []);

  const setCurrentJobId = useCallback((currentJobId: string | null) => {
    setState(prev => ({ ...prev, currentJobId }));
  }, []);

  const setPrompt = useCallback((prompt: string | null) => {
    setState(prev => ({ ...prev, prompt }));
  }, []);

  const setNegativeText = useCallback((negativeText: string | null) => {
    setState(prev => ({ ...prev, negativeText }));
  }, []);

  const setSelectedSkybox = useCallback((selectedSkybox: SelectedSkybox | null) => {
    setState(prev => ({ ...prev, selectedSkybox }));
  }, []);

  const setNumVariations = useCallback((numVariations: number) => {
    setState(prev => ({ ...prev, numVariations }));
  }, []);

  const setGenerated3DAsset = useCallback((generated3DAsset: any | null) => {
    setState(prev => ({ ...prev, generated3DAsset }));
  }, []);

  const setGeneratedVariations = useCallback((generatedVariations: GeneratedVariation[]) => {
    setState(prev => ({ ...prev, generatedVariations }));
  }, []);

  const setCurrentVariationIndex = useCallback((currentVariationIndex: number) => {
    setState(prev => ({ ...prev, currentVariationIndex }));
  }, []);

  const resetGeneration = useCallback(() => {
    const key = getStorageKey(user?.uid || null);
    if (key) {
      localStorage.removeItem(key);
    }
    setState(initialState);
  }, [user?.uid]);

  const startGeneration = useCallback((prompt: string, jobId?: string) => {
    setState(prev => ({
      ...prev,
      isGenerating: true,
      prompt,
      currentJobId: jobId || prev.currentJobId,
      startedAt: Date.now(),
      skyboxProgress: 0,
      generationProgress: null
    }));
  }, []);

  return (
    <CreateGenerationContext.Provider
      value={{
        state,
        setGenerating,
        setGenerating3DAsset,
        setSkyboxProgress,
        setAssetGenerationProgress,
        setGenerationProgress,
        setCurrentJobId,
        setPrompt,
        setNegativeText,
        setSelectedSkybox,
        setNumVariations,
        setGenerated3DAsset,
        setGeneratedVariations,
        setCurrentVariationIndex,
        resetGeneration,
        startGeneration
      }}
    >
      {children}
    </CreateGenerationContext.Provider>
  );
};

export const useCreateGeneration = (): CreateGenerationContextType => {
  const context = useContext(CreateGenerationContext);
  if (!context) {
    throw new Error('useCreateGeneration must be used within CreateGenerationProvider');
  }
  return context;
};

