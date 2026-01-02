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

      const response = await api.post<AIDetectionResult>('/ai-detection/detect', {
        prompt: prompt.trim()
      });

      console.log('✅ AI Detection response:', {
        promptType: response.data.promptType,
        confidence: response.data.confidence,
        method: 'ai'
      });

      return {
        success: true,
        data: response.data,
        method: 'ai'
      };
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

