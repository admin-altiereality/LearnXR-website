import api from '../config/axios';
import type { SkyboxStatusResponse } from '../types/skybox';

export const skyboxApiService = {
  // Get available skybox styles
  async getStyles(page: number = 1, limit: number = 20) {
    try {
      console.log('🌅 Fetching skybox styles from API...', { page, limit });
      const response = await api.get(`/skybox/styles?page=${page}&limit=${limit}`);
      
      console.log('✅ Skybox styles API response:', {
        success: response.data?.success,
        hasData: !!response.data?.data,
        dataLength: Array.isArray(response.data?.data) ? response.data.data.length : 0,
        fullResponse: response.data
      });
      
      // Handle different response structures
      if (response.data?.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
          styles: response.data.data, // Also provide as 'styles' for compatibility
          pagination: response.data.pagination
        };
      }
      
      // Fallback: if data is directly in response
      if (response.data?.data) {
        return {
          success: true,
          data: response.data.data,
          styles: response.data.data
        };
      }
      
      // If response.data is already an array
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
          styles: response.data
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Skybox styles fetch failed:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url
      });
      
      // Handle specific errors
      if (error.response?.status === 403) {
        throw new Error('Skybox service is not configured properly. Please contact support.');
      } else if (error.response?.status === 500) {
        const errorMessage = error.response?.data?.error || 'Unknown error';
        throw new Error(`Skybox service error: ${errorMessage}`);
      } else if (error.response?.status === 503) {
        throw new Error('Skybox service is temporarily unavailable. Please try again later.');
      } else if (!error.response) {
        // Network error - check if it's a localhost connection issue
        const baseURL = error.config?.baseURL || '';
        if (baseURL.includes('localhost') || baseURL.includes('127.0.0.1')) {
          throw new Error('Cannot connect to local Firebase emulator. The app is trying to use production Firebase Functions instead. If you need to use the emulator, make sure it\'s running with "firebase emulators:start".');
        }
        throw new Error('Network error. Please check your internet connection and API configuration.');
      }
      
      throw new Error(`Failed to fetch skybox styles: ${error.message || 'Unknown error'}`);
    }
  },

  // Generate a new skybox
  async generateSkybox({ prompt, style_id, negative_prompt, userId }: { prompt: string; style_id: string|number; negative_prompt?: string; userId?: string }) {
    try {
      // Validate inputs
      if (!prompt || !prompt.trim()) {
        console.error('❌ Skybox generation validation failed: Prompt is empty');
        throw new Error('Prompt is required. Please enter a description for your environment.');
      }
      
      if (style_id === null || style_id === undefined || style_id === '') {
        console.error('❌ Skybox generation validation failed: Style ID is missing', { style_id });
        throw new Error('Style selection is required. Please select an In3D.Ai style.');
      }
      
      // Convert style_id to number if it's a string
      const styleIdNumber = typeof style_id === 'string' ? parseInt(style_id, 10) : Number(style_id);
      
      if (isNaN(styleIdNumber) || styleIdNumber <= 0) {
        console.error('❌ Skybox generation validation failed: Invalid style ID', { 
          original: style_id, 
          converted: styleIdNumber 
        });
        throw new Error('Invalid style selection. Please select a valid In3D.Ai style.');
      }
      
      const requestPayload = { 
        prompt: prompt.trim(), 
        style_id: styleIdNumber, // Backend expects 'style_id', not 'skybox_style_id'
        negative_prompt: negative_prompt?.trim() || undefined, // Backend expects 'negative_prompt', not 'negative_text'
        userId 
      };
      
      console.log('🌅 Sending skybox generation request:', {
        prompt: requestPayload.prompt.substring(0, 50) + '...',
        style_id: requestPayload.style_id,
        has_negative_prompt: !!requestPayload.negative_prompt,
        userId: requestPayload.userId ? 'present' : 'missing'
      });
      
      const response = await api.post('/skybox/generate', requestPayload);
      
      console.log('✅ Skybox generation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Skybox generation failed:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Handle specific errors
      if (error.response?.status === 403) {
        // Could be API key issue or BlockadeLabs API issue
        const errorMessage = error.response?.data?.error || error.response?.data?.message;
        if (errorMessage?.includes('API key') || errorMessage?.includes('not configured')) {
          throw new Error('BlockadeLabs API key is not configured. Please contact support to set up the API key.');
        }
        throw new Error('Skybox generation service is not configured properly. Please contact support.');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message;
        if (errorMessage?.includes('Missing required fields')) {
          throw new Error('Invalid request: Please provide both a prompt and select a style.');
        }
        throw new Error('Invalid request parameters. Please check your prompt and style selection.');
      } else if (error.response?.status === 500 || error.response?.status === 503) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message;
        const errorCode = error.response?.data?.code;
        
        if (errorCode === 'API_KEY_NOT_CONFIGURED' || errorMessage?.includes('BlockadeLabs API') || errorMessage?.includes('not configured')) {
          throw new Error('BlockadeLabs API key is not configured in Firebase Functions. Please contact support to set up the API key.');
        }
        throw new Error('Skybox generation service is temporarily unavailable. Please try again later.');
      } else if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message;
        if (errorMessage?.includes('API key') || errorMessage?.includes('authentication')) {
          throw new Error('Invalid BlockadeLabs API key. Please contact support.');
        }
        throw new Error('Authentication failed. Please try again.');
      }
      
      // Handle network errors
      if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      throw new Error(`Failed to generate skybox: ${error.message || 'Unknown error'}`);
    }
  },

  // Get skybox generation status
  async getSkyboxStatus(generationId: string): Promise<SkyboxStatusResponse> {
    try {
      const response = await api.get(`/skybox/status/${generationId}`, {
        timeout: 30000 // 30 second timeout
      });
      
      // Normalize response structure
      if (response.data?.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
          requestId: response.data.requestId
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Skybox status fetch failed:', error);
      console.error('Generation ID:', generationId);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code
      });
      
      // Handle network/timeout errors
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Request timed out. The skybox may still be processing. Please try again.');
      }
      
      // Handle specific HTTP errors
      if (error.response?.status === 403) {
        throw new Error('Skybox service is not configured properly. Please contact support.');
      } else if (error.response?.status === 404) {
        // More helpful error message
        const errorData = error.response?.data;
        if (errorData?.error === 'Generation not found' || errorData?.code === 'GENERATION_NOT_FOUND') {
          throw new Error('Skybox generation not found. The generation may have expired or was never created. Please try generating a new skybox.');
        }
        throw new Error('Skybox generation not found. It may have expired. Please try generating a new skybox.');
      } else if (error.response?.status === 500) {
        const errorData = error.response?.data;
        if (errorData?.error?.includes('not configured')) {
          throw new Error('Skybox service is not configured. Please contact support.');
        }
        throw new Error('Skybox service is temporarily unavailable. Please try again later.');
      } else if (error.response?.status === 503) {
        throw new Error('Skybox service is temporarily unavailable. Please try again later.');
      }
      
      // Handle network errors
      if (!error.response) {
        // Check if it's a localhost connection error (emulator not running)
        if (error.config?.baseURL?.includes('localhost')) {
          throw new Error('Local Firebase emulator is not running. Please start it with "firebase emulators:start" or use the production API.');
        }
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      throw new Error(`Failed to get skybox status: ${error.message || 'Unknown error'}`);
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