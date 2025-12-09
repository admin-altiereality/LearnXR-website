import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { StoredAsset } from '../services/assetStorageService';

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
  
  // Generation trigger
  triggerAssetGeneration: (prompt: string, skyboxId?: string) => Promise<void>;
  
  // Reset
  reset: () => void;
}

const AssetGenerationContext = createContext<AssetGenerationContextType | null>(null);

export const AssetGenerationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeSkybox, setActiveSkybox] = useState<SkyboxData | null>(null);
  const [activeSkyboxImageUrl, setActiveSkyboxImageUrl] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<StoredAsset[]>([]);
  const [firstGeneratedAsset, setFirstGeneratedAsset] = useState<StoredAsset | null>(null);
  const [isSkyboxLoading, setIsSkyboxLoading] = useState(false);
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);

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

