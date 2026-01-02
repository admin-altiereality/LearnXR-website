// Prompt Enhancement Service (Frontend)
// Calls backend API for AI-based prompt enhancement using OpenAI

import api from '../config/axios';

export interface PromptEnhancementResponse {
  success: boolean;
  data?: {
    originalPrompt: string;
    enhancedPrompt: string;
    method: 'ai' | 'fallback';
  };
  error?: string;
}

class PromptEnhancementService {
  /**
   * Enhance prompt using AI
   */
  async enhancePrompt(prompt: string): Promise<PromptEnhancementResponse> {
    try {
      if (!prompt || !prompt.trim()) {
        throw new Error('Prompt is required');
      }

      console.log('✨ Requesting AI enhancement for prompt:', prompt.substring(0, 50) + '...');

      const response = await api.post<{
        originalPrompt: string;
        enhancedPrompt: string;
        method: string;
      }>('/ai-detection/enhance', {
        prompt: prompt.trim()
      });

      console.log('✅ AI Enhancement response received');

      return {
        success: true,
        data: {
          originalPrompt: response.data.originalPrompt,
          enhancedPrompt: response.data.enhancedPrompt,
          method: response.data.method as 'ai' | 'fallback'
        }
      };
    } catch (error: any) {
      console.error('❌ AI Enhancement error:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          'Failed to enhance prompt';

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if AI enhancement is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const result = await this.enhancePrompt('test');
      return result.success && result.data?.method === 'ai';
    } catch {
      return false;
    }
  }
}

export const promptEnhancementService = new PromptEnhancementService();

