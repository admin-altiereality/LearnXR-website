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
      console.log('🌐 API Base URL:', api.defaults.baseURL);
      console.log('🌐 Full endpoint URL:', `${api.defaults.baseURL}/ai-detection/enhance`);
      
      // Check if user is authenticated
      const { auth } = await import('../config/firebase');
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        console.log('✅ User authenticated, token available:', token ? 'Yes' : 'No');
      } else {
        console.warn('⚠️ No authenticated user found');
      }

      // Make POST request using api.post() for better reliability
      console.log('📤 Sending POST request to /ai-detection/enhance');
      
      const response = await api.post<{
        success?: boolean;
        data?: {
          originalPrompt: string;
          enhancedPrompt: string;
          method: string;
        };
        originalPrompt?: string;
        enhancedPrompt?: string;
        method?: string;
        error?: string;
        requestId?: string;
      }>('/ai-detection/enhance', {
        prompt: prompt.trim()
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: (status: number) => status < 500 // Don't throw on 4xx errors
      });
      
      console.log('📥 Response received:', {
        status: response.status,
        method: response.config?.method?.toUpperCase(),
        url: response.config?.url
      });

      console.log('✅ AI Enhancement response received:', response.data);
      console.log('📊 Response structure:', {
        hasData: !!response.data,
        hasSuccess: 'success' in (response.data || {}),
        dataKeys: response.data ? Object.keys(response.data) : [],
        fullResponse: response.data
      });

      // Check response status first
      if (response.status >= 400) {
        const errorMsg = response.data?.error || `Server returned status ${response.status}`;
        console.error('❌ Enhancement request failed:', {
          status: response.status,
          error: errorMsg,
          data: response.data
        });
        return {
          success: false,
          error: errorMsg
        };
      }

      // Check if response has the expected structure
      if (!response.data) {
        console.error('❌ Response data is missing');
        return {
          success: false,
          error: 'Invalid response: no data received'
        };
      }

      // Server returns: { success: true, data: { originalPrompt, enhancedPrompt, method }, requestId }
      // Check if response has nested data structure (preferred format)
      if (response.data.success && response.data.data) {
        // Nested structure: { success: true, data: { ... } }
        const responseData = response.data.data;
        
        if (!responseData?.enhancedPrompt) {
          console.error('❌ Enhanced prompt missing in nested response:', responseData);
          return {
            success: false,
            error: responseData?.error || response.data.error || 'Enhanced prompt not found in response'
          };
        }

        console.log('✅ Enhancement successful (nested structure):', {
          originalLength: responseData.originalPrompt?.length || 0,
          enhancedLength: responseData.enhancedPrompt.length,
          method: responseData.method
        });

        return {
          success: true,
          data: {
            originalPrompt: responseData.originalPrompt || prompt.trim(),
            enhancedPrompt: responseData.enhancedPrompt,
            method: (responseData.method || 'ai') as 'ai' | 'fallback'
          }
        };
      } 
      
      // Direct structure: { originalPrompt, enhancedPrompt, method } or { success: true, enhancedPrompt, ... }
      if (response.data.enhancedPrompt) {
        console.log('✅ Enhancement successful (direct structure):', {
          originalLength: response.data.originalPrompt?.length || 0,
          enhancedLength: response.data.enhancedPrompt.length,
          method: response.data.method
        });
        
        return {
          success: true,
          data: {
            originalPrompt: response.data.originalPrompt || prompt.trim(),
            enhancedPrompt: response.data.enhancedPrompt,
            method: (response.data.method || 'ai') as 'ai' | 'fallback'
          }
        };
      }
      
      // Check if success is false
      if (response.data.success === false) {
        const errorMsg = response.data.error || 'Enhancement failed';
        console.error('❌ Enhancement failed (success: false):', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }
      
      // Unexpected structure
      console.error('❌ Unexpected response structure:', {
        status: response.status,
        data: response.data,
        dataKeys: Object.keys(response.data || {})
      });
      return {
        success: false,
        error: response.data.error || 'Unexpected response format from server. Please check console for details.'
      };
    } catch (error: any) {
      console.error('❌ AI Enhancement error:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        fullURL: error.config?.baseURL ? `${error.config.baseURL}${error.config.url}` : error.config?.url
      });
      
      let errorMessage = 'Failed to enhance prompt';
      
      // Network errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage = 'Cannot connect to enhancement service. Please check your internet connection.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Enhancement request timed out. Please try again.';
      }
      // HTTP errors
      else if (error.response?.status === 404) {
        errorMessage = 'Enhancement endpoint not found (404). The API route may not be properly configured.';
      } else if (error.response?.status === 503) {
        errorMessage = 'AI enhancement service is not available. OpenAI API key may not be configured.';
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        errorMessage = 'Authentication failed. Please try logging in again.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

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

