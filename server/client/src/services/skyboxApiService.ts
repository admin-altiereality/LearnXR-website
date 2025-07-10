import api from '../config/axios';
import type { SkyboxStyle, SkyboxGenerationRequest, SkyboxGenerationResponse, SkyboxStatusResponse } from '../types/skybox';

export const skyboxApiService = {
  // Get available skybox styles
  async getStyles(page: number = 1, limit: number = 20) {
    const response = await api.get(`/skybox/styles?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Generate a new skybox
  async generateSkybox({ prompt, style_id, negative_prompt, userId }: { prompt: string; style_id: string|number; negative_prompt?: string; userId?: string }) {
    const response = await api.post('/skybox/generate', { 
      prompt, 
      style_id: style_id, 
      negative_text: negative_prompt, 
      userId 
    });
    return response.data;
  },

  // Get skybox generation status
  async getSkyboxStatus(generationId: string): Promise<SkyboxStatusResponse> {
    const response = await api.get(`/skybox/status/${generationId}`);
    return response.data;
  },

  // Get skybox history
  async getSkyboxHistory(userId: string, page: number = 1, limit: number = 20) {
    const response = await api.get(`/skybox/history?userId=${userId}&page=${page}&limit=${limit}`);
    return response.data;
  }
}; 