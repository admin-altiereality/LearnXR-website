import api from '../config/axios';

export interface SkyboxStyle {
  id: number;
  name: string;
  description: string | null;
  'max-char': number;
  'negative-text-max-char': number;
  image: string | null;
  image_jpg: string | null;
  model: string;
  model_version: string;
  sort_order: number;
  premium: number;
  new: number;
  experimental: number;
  skybox_style_families_id: number | null;
}

export interface SkyboxGenerationRequest {
  prompt: string;
  style_id: number;
  negative_prompt?: string;
}

export interface SkyboxGenerationResponse {
  id: string;
  status: string;
  prompt: string;
  style_id: number;
  negative_prompt?: string;
  created_at: string;
  updated_at: string;
  file_url?: string;
  thumbnail_url?: string;
  webhook_url?: string;
}

export interface SkyboxStatusResponse {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  prompt: string;
  style_id: number;
  negative_prompt?: string;
  created_at: string;
  updated_at: string;
  file_url?: string;
  thumbnail_url?: string;
  webhook_url?: string;
  error?: string;
}

export const skyboxApiService = {
  // Get available skybox styles
  async getStyles(page: number = 1, limit: number = 20): Promise<{
    success: boolean;
    data: SkyboxStyle[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  }> {
    try {
      const response = await api.get(`/skybox/styles?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching skybox styles:', error);
      throw error;
    }
  },

  // Generate a new skybox
  async generateSkybox(generationRequest: SkyboxGenerationRequest): Promise<{
    success: boolean;
    data: SkyboxGenerationResponse;
  }> {
    try {
      const response = await api.post('/skybox/generate', generationRequest);
      return response.data;
    } catch (error) {
      console.error('Error generating skybox:', error);
      throw error;
    }
  },

  // Check skybox generation status
  async getSkyboxStatus(generationId: string): Promise<{
    success: boolean;
    data: SkyboxStatusResponse;
  }> {
    try {
      const response = await api.get(`/skybox/status/${generationId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking skybox status:', error);
      throw error;
    }
  },

  // Health check
  async healthCheck(): Promise<{
    environment: string;
    firebase: boolean;
    razorpay: boolean;
    blockadelabs: boolean;
    timestamp: string;
  }> {
    try {
      const response = await api.get('/env-check');
      return response.data;
    } catch (error) {
      console.error('Error checking API health:', error);
      throw error;
    }
  }
}; 