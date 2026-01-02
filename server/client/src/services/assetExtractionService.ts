// Asset Extraction Service (Frontend)
// Calls backend API to extract ONLY 3D asset phrases from prompt

import api from '../config/axios';

export interface AssetExtractionResult {
  assets: string[]; // Array of exact phrases from prompt that are 3D assets
  success: boolean;
  error?: string;
}

class AssetExtractionService {
  /**
   * Extract 3D asset phrases from prompt using AI
   */
  async extractAssets(prompt: string): Promise<AssetExtractionResult> {
    try {
      if (!prompt || !prompt.trim()) {
        return {
          assets: [],
          success: true
        };
      }

      console.log('🔍 Extracting 3D assets from prompt:', prompt.substring(0, 50) + '...');

      const response = await api.post<{ assets: string[] }>('/ai-detection/extract-assets', {
        prompt: prompt.trim()
      });

      const assets = Array.isArray(response.data.assets) ? response.data.assets : [];

      console.log('✅ Asset extraction result:', {
        count: assets.length,
        assets: assets
      });

      return {
        assets: assets,
        success: true
      };
    } catch (error: any) {
      console.error('❌ Asset extraction error:', error);
      
      return {
        assets: [],
        success: false,
        error: error.response?.data?.error || 
               error.message || 
               'Asset extraction failed'
      };
    }
  }
}

export const assetExtractionService = new AssetExtractionService();

