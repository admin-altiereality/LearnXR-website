// AI Detection Service (Frontend)
// Calls backend API for AI-based prompt detection

import api from '../config/axios';

export interface AIDetectionResult {
  promptType: 'mesh' | 'skybox' | 'both' | 'unknown';
  meshScore: number;
  skyboxScore: number;
  confidence: number;
  reasoning: string;
  meshDescription?: string;
  meshAssets?: string[]; // Array of exact phrases from prompt that are 3D assets
  skyboxDescription?: string;
  shouldGenerateMesh: boolean;
  shouldGenerateSkybox: boolean;
}

export interface AIDetectionResponse {
  success: boolean;
  data?: AIDetectionResult;
  method?: 'ai' | 'fallback';
  error?: string;
}

class AIDetectionService {
  /**
   * Detect prompt type using AI
   */
  async detectPromptType(prompt: string): Promise<AIDetectionResponse> {
    try {
      if (!prompt || !prompt.trim()) {
        return {
          success: false,
          error: 'Prompt is required'
        };
      }

      console.log('🤖 Requesting AI detection for prompt:', prompt.substring(0, 50) + '...');

      const response = await api.post<{
        success: boolean;
        data: AIDetectionResult;
        method: string;
        requestId?: string;
      }>('/ai-detection/detect', {
        prompt: prompt.trim()
      });

      console.log('✅ AI Detection response received:', response.data);
      console.log('📊 Response structure:', {
        hasSuccess: 'success' in (response.data || {}),
        hasData: 'data' in (response.data || {}),
        dataKeys: response.data?.data ? Object.keys(response.data.data) : [],
        fullResponse: response.data
      });

      // Handle nested response structure: { success: true, data: {...}, method: 'ai' }
      if (response.data.success && response.data.data) {
        const aiData = response.data.data;
        console.log('✅ AI Detection parsed:', {
          promptType: aiData.promptType,
          confidence: aiData.confidence,
          meshAssets: aiData.meshAssets,
          meshAssetsCount: aiData.meshAssets?.length || 0,
          method: response.data.method || 'ai'
        });

        return {
          success: true,
          data: aiData,
          method: (response.data.method || 'ai') as 'ai' | 'fallback'
        };
      } else if (response.data.promptType) {
        // Direct structure (fallback)
        return {
          success: true,
          data: response.data as AIDetectionResult,
          method: 'ai'
        };
      } else {
        console.error('❌ Unexpected response structure:', response.data);
        return {
          success: false,
          error: 'Unexpected response format from detection service',
          method: 'fallback'
        };
      }
    } catch (error: any) {
      console.error('❌ AI Detection error:', error);
      
      return {
        success: false,
        error: error.response?.data?.error || 
               error.message || 
               'AI detection failed',
        method: 'fallback'
      };
    }
  }

  /**
   * Check if AI detection is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Try a simple detection to check if service is available
      const result = await this.detectPromptType('test');
      return result.success && result.method === 'ai';
    } catch {
      return false;
    }
  }
}

export const aiDetectionService = new AIDetectionService();

