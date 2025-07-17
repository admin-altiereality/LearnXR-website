import api from '../config/axios';
import type { SkyboxStyle, SkyboxGenerationRequest, SkyboxGenerationResponse, SkyboxStatusResponse } from '../types/skybox';

export const skyboxApiService = {
  // Get available skybox styles
  async getStyles(page: number = 1, limit: number = 20) {
    try {
      const response = await api.get(`/skybox/styles?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Skybox styles fetch failed:', error);
      
      // Handle specific errors
      if (error.response?.status === 403) {
        throw new Error('Skybox service is not configured properly. Please contact support.');
      } else if (error.response?.status === 500) {
        throw new Error('Skybox service is temporarily unavailable. Please try again later.');
      }
      
      throw new Error(`Failed to fetch skybox styles: ${error.message}`);
    }
  },

  // Generate a new skybox
  async generateSkybox({ prompt, style_id, negative_prompt, userId }: { prompt: string; style_id: string|number; negative_prompt?: string; userId?: string }) {
    try {
      const response = await api.post('/skybox/generate', { 
        prompt, 
        skybox_style_id: style_id, // <-- FIXED: use correct field name
        negative_text: negative_prompt, 
        userId 
      });
      return response.data;
    } catch (error: any) {
      console.error('Skybox generation failed:', error);
      
      // Handle specific errors
      if (error.response?.status === 403) {
        throw new Error('Skybox generation service is not configured properly. Please contact support.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid request parameters. Please check your prompt and style selection.');
      } else if (error.response?.status === 500) {
        throw new Error('Skybox generation service is temporarily unavailable. Please try again later.');
      }
      
      throw new Error(`Failed to generate skybox: ${error.message}`);
    }
  },

  // Get skybox generation status
  async getSkyboxStatus(generationId: string): Promise<SkyboxStatusResponse> {
    try {
      const response = await api.get(`/skybox/status/${generationId}`);
      return response.data;
    } catch (error: any) {
      console.error('Skybox status fetch failed:', error);
      
      // Handle specific errors
      if (error.response?.status === 403) {
        throw new Error('Skybox service is not configured properly. Please contact support.');
      } else if (error.response?.status === 404) {
        throw new Error('Skybox generation not found. It may have expired.');
      } else if (error.response?.status === 500) {
        throw new Error('Skybox service is temporarily unavailable. Please try again later.');
      }
      
      throw new Error(`Failed to get skybox status: ${error.message}`);
    }
  },

  // Get skybox history
  async getSkyboxHistory(userId: string, page: number = 1, limit: number = 20) {
    try {
      const response = await api.get(`/skybox/history?userId=${userId}&page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Skybox history fetch failed:', error);
      
      // Handle specific errors
      if (error.response?.status === 403) {
        throw new Error('Skybox service is not configured properly. Please contact support.');
      } else if (error.response?.status === 500) {
        throw new Error('Skybox service is temporarily unavailable. Please try again later.');
      }
      
      throw new Error(`Failed to get skybox history: ${error.message}`);
    }
  }
}; 