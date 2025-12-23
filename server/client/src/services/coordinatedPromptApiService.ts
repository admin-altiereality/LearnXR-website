// Coordinated Prompt API Service
// Client-side service for calling the coordinated prompt generation API

import api from '../config/axios';
import type { CoordinatedGenerationOutput } from './coordinatedPromptGeneratorService';

export interface CoordinatedPromptRequest {
  prompt: string;
}

export interface CoordinatedPromptResponse {
  success: boolean;
  data?: CoordinatedGenerationOutput;
  error?: string;
}

export const coordinatedPromptApiService = {
  /**
   * Generate coordinated prompts and metadata
   * @param prompt User's input prompt
   * @returns Coordinated generation output with skybox prompt, asset prompt, and grounding metadata
   */
  async generate(prompt: string): Promise<CoordinatedPromptResponse> {
    try {
      if (!prompt || !prompt.trim()) {
        throw new Error('Prompt is required');
      }

      console.log('🎯 Generating coordinated prompts for:', prompt.substring(0, 50) + '...');

      const response = await api.post<CoordinatedGenerationOutput>('/coordinated-prompt/generate', {
        prompt: prompt.trim()
      });

      console.log('✅ Coordinated prompt generation successful');

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('❌ Coordinated prompt generation failed:', error);
      
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          'Failed to generate coordinated prompts';

      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

