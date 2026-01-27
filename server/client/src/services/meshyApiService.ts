// Meshy.ai API Service for 3D Asset Generation
// Updated to match official Meshy API documentation: https://docs.meshy.ai/en/api/text-to-3d

export interface MeshyGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  art_style?: 'realistic' | 'sculpture';
  seed?: number;
  ai_model?: 'meshy-4' | 'meshy-5' | 'meshy-6' | 'latest';
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
  should_remesh?: boolean;
  symmetry_mode?: 'off' | 'auto' | 'on';
  moderation?: boolean;
}

export interface MeshyRefineRequest {
  preview_task_id: string;
  enable_pbr?: boolean; // Generate PBR maps (metallic, roughness, normal) in addition to base color
  texture_prompt?: string; // Additional text prompt to guide texturing (max 600 chars)
  texture_image_url?: string; // 2D image to guide texturing
  ai_model?: 'meshy-5' | 'latest';
  moderation?: boolean;
}

export interface MeshyGenerationResponse {
  result: string; // This is the task ID
}

export interface MeshyTaskStatus {
  id: string;
  model_urls: {
    glb?: string;
    fbx?: string;
    usdz?: string;
    obj?: string;
    mtl?: string;
  };
  prompt: string;
  negative_prompt?: string;
  art_style: string;
  texture_richness?: string;
  texture_prompt?: string;
  texture_image_url?: string;
  thumbnail_url?: string;
  video_url?: string;
  progress: number;
  seed: number;
  started_at: number;
  created_at: number;
  finished_at: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  preceding_tasks: number;
  task_error: {
    message: string;
  };
}

export interface MeshyAsset {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  downloadUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  format: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
  estimatedCompletion?: string;
  progress?: number;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    category?: string;
    confidence?: number;
    originalPrompt?: string;
    userId?: string;
    skyboxId?: string;
    vertices?: number;
    faces?: number;
    textures?: number;
    animations?: number;
    // Meshy API specific fields
    art_style?: string;
    seed?: number;
    texture_prompt?: string;
    model_urls?: {
      glb?: string;
      fbx?: string;
      usdz?: string;
      obj?: string;
      mtl?: string;
    };
  };
}

export interface MeshyStyle {
  id: string;
  name: string;
  description: string;
  category: string;
  preview_url?: string;
  tags: string[];
}

export interface MeshyUsage {
  total_generations: number;
  successful_generations: number;
  failed_generations: number;
  total_cost: number;
  quota_remaining: number;
  quota_limit: number;
  reset_date: string;
}

// Get the correct API base URL
const getApiBaseUrl = () => {
  // Check for explicit API base URL from environment
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Use local backend in development
  if (import.meta.env.DEV) {
    return 'http://localhost:5001/in3devoneuralai/us-central1/api';
  }
  
  // Use Firebase Functions in production
  const region = 'us-central1';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
};

export class MeshyApiService {
  private apiKey: string;
  private baseUrl: string;
  private proxyBaseUrl: string;
  private useProxy: boolean;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private timeout: number = 30000;
  
  constructor() {
    this.apiKey = import.meta.env.VITE_MESHY_API_KEY || '';
    this.baseUrl = import.meta.env.VITE_MESHY_API_BASE_URL || 'https://api.meshy.ai/openapi/v2';
    this.proxyBaseUrl = getApiBaseUrl();
    
    // Check if we're in a preview channel (preview channels typically don't have env vars)
    const isPreviewChannel = window.location.hostname.includes('--') || 
                            window.location.hostname.includes('web.app');
    
    // Use proxy if:
    // 1. API key is not available
    // 2. Explicitly configured to use proxy
    // 3. We're in a preview channel (safer to use proxy)
    this.useProxy = !this.apiKey || 
                    import.meta.env.VITE_USE_MESHY_PROXY === 'true' ||
                    (isPreviewChannel && !import.meta.env.VITE_MESHY_API_KEY);
    
    if (!this.apiKey && !this.useProxy) {
      console.warn('Meshy API key not configured. Will attempt to use Firebase proxy.');
    }
    
    if (this.useProxy) {
      console.log('🔧 Meshy service using Firebase proxy:', this.proxyBaseUrl);
    } else {
      console.log('🔧 Meshy service using direct API with client key');
    }
  }
  
  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    // Service is configured if we have either an API key or proxy is enabled
    const configured = (!!this.apiKey && this.apiKey.length > 0) || this.useProxy;
    console.log(`🔧 Meshy service configured: ${configured} (proxy: ${this.useProxy}, hasKey: ${!!this.apiKey})`);
    return configured;
  }

  /**
   * Make authenticated API request with retry logic
   * Routes through Firebase proxy if useProxy is true
   */
  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {}, 
    retryCount: number = 0
  ): Promise<Response> {
    // Use proxy if configured
    if (this.useProxy) {
      return this.makeProxyRequest(endpoint, options, retryCount);
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'In3D.ai-WebApp/1.0',
        ...options.headers,
      },
      signal: controller.signal, // Use AbortSignal for timeout
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      clearTimeout(timeoutId); // Clear timeout on successful fetch
      
      // Handle 401 (Unauthorized) - Invalid API key, fall back to proxy
      if (response.status === 401 && !this.useProxy) {
        console.warn('⚠️ Invalid API key detected (401). Falling back to Firebase proxy...');
        // Switch to proxy mode for this and future requests
        this.useProxy = true;
        // Retry with proxy
        return this.makeProxyRequest(endpoint, options, 0);
      }
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay * Math.pow(2, retryCount);
        
        if (retryCount < this.maxRetries) {
          console.log(`🔄 Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, options, retryCount + 1);
        }
      }
      
      // Handle server errors with retry
      if (response.status >= 500 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`🔄 Server error, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options, retryCount + 1);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
      
      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`🔄 Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Make request through Firebase proxy
   */
  private async makeProxyRequest(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<Response> {
    // Map Meshy API endpoints to proxy routes
    let proxyEndpoint = '';
    if (endpoint === '/text-to-3d' && options.method === 'POST') {
      proxyEndpoint = `${this.proxyBaseUrl}/meshy/generate`;
    } else if (endpoint.startsWith('/text-to-3d/') && options.method === 'GET') {
      const taskId = endpoint.replace('/text-to-3d/', '');
      proxyEndpoint = `${this.proxyBaseUrl}/meshy/status/${taskId}`;
    } else if (endpoint.includes('/cancel') && options.method === 'POST') {
      const taskId = endpoint.split('/')[2];
      proxyEndpoint = `${this.proxyBaseUrl}/meshy/cancel/${taskId}`;
    } else {
      throw new Error(`Unsupported proxy endpoint: ${endpoint}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const proxyOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...(options.body && { body: options.body }),
    };

    try {
      const response = await fetch(proxyEndpoint, proxyOptions);
      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay * Math.pow(2, retryCount);
        
        if (retryCount < this.maxRetries) {
          console.log(`🔄 Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeProxyRequest(endpoint, options, retryCount + 1);
        }
      }

      // Handle server errors with retry
      if (response.status >= 500 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`🔄 Server error, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeProxyRequest(endpoint, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`🔄 Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeProxyRequest(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Create a refine task to add textures to a preview task
   */
  async createRefineTask(request: MeshyRefineRequest): Promise<MeshyGenerationResponse> {
    if (!this.isConfigured()) {
      throw new Error('Meshy API key not configured');
    }

    try {
      console.log('🎨 Creating Meshy refine task:', {
        preview_task_id: request.preview_task_id,
        enable_pbr: request.enable_pbr,
        texture_prompt: request.texture_prompt?.substring(0, 50) + '...'
      });

      const payload = {
        mode: 'refine',
        preview_task_id: request.preview_task_id,
        enable_pbr: request.enable_pbr !== false, // Default to true for full textures
        ...(request.texture_prompt && { texture_prompt: request.texture_prompt.trim() }),
        ...(request.texture_image_url && { texture_image_url: request.texture_image_url }),
        ai_model: request.ai_model || 'latest',
        moderation: request.moderation || false,
      };

      console.log('📤 Sending refine request to Meshy API:', {
        url: `${this.baseUrl}/text-to-3d`,
        payload: payload
      });

      const response = await this.makeRequest('/text-to-3d', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Meshy refine API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });
        throw new Error(`Meshy refine API error: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.message || 'Unknown error'}`);
      }

      let responseData = await response.json();
      console.log('📥 Meshy refine API response:', responseData);
      
      // Handle proxy response wrapper (if using Firebase proxy)
      if (responseData.success && responseData.data) {
        responseData = responseData.data;
        console.log('📥 Unwrapped proxy response:', responseData);
      }
      
      // Handle different response formats
      let taskId: string | undefined;
      
      if (responseData.result) {
        taskId = responseData.result;
      } else if (responseData.id) {
        taskId = responseData.id;
      } else if (responseData.task_id) {
        taskId = responseData.task_id;
      } else if (typeof responseData === 'string') {
        taskId = responseData;
      }
      
      if (!taskId || taskId === 'undefined' || taskId.trim() === '') {
        console.error('❌ No task ID in refine response:', responseData);
        throw new Error(`Invalid response from Meshy refine API: No task ID received. Response: ${JSON.stringify(responseData)}`);
      }
      
      console.log('✅ Meshy refine task created with task ID:', taskId);
      return { result: taskId };
    } catch (error) {
      console.error('❌ Error creating refine task with Meshy:', error);
      throw error;
    }
  }

  /**
   * Generate a 3D asset using Meshy.ai (Preview stage - mesh only, no texture)
   */
  async generateAsset(request: MeshyGenerationRequest): Promise<MeshyGenerationResponse> {
    if (!this.isConfigured()) {
      throw new Error('Meshy API key not configured');
    }

    // Validate request
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    try {
      console.log('🚀 Initiating Meshy 3D generation:', {
        prompt: request.prompt.substring(0, 50) + '...',
        art_style: request.art_style,
        ai_model: request.ai_model
      });

      // Use latest model (meshy-6) by default for better quality
      const aiModel = request.ai_model || 'latest';
      
      const payload: any = {
        mode: 'preview',
        prompt: request.prompt.trim(),
        ai_model: aiModel,
        topology: request.topology || 'triangle',
        target_polycount: request.target_polycount || (aiModel === 'meshy-6' || aiModel === 'latest' ? 30000 : 30000),
        should_remesh: request.should_remesh !== undefined ? request.should_remesh : (aiModel === 'meshy-6' || aiModel === 'latest' ? false : true),
        symmetry_mode: request.symmetry_mode || 'auto',
        moderation: request.moderation || false,
      };

      // Only include art_style for legacy models (meshy-4, meshy-5)
      // Meshy-6/latest ignores art_style and may cause errors if included
      if (aiModel === 'meshy-4' || aiModel === 'meshy-5') {
        payload.art_style = request.art_style || 'realistic';
        if (request.seed) {
          payload.seed = request.seed;
        }
      }

      console.log('📤 Sending request to Meshy API:', {
        url: `${this.baseUrl}/text-to-3d`,
        payload: payload
      });

      const response = await this.makeRequest('/text-to-3d', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Meshy API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });
        throw new Error(`Meshy API error: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.message || 'Unknown error'}`);
      }

      let responseData = await response.json();
      console.log('📥 Meshy API response:', responseData);
      
      // Handle proxy response wrapper (if using Firebase proxy)
      if (responseData.success && responseData.data) {
        responseData = responseData.data;
        console.log('📥 Unwrapped proxy response:', responseData);
      }
      
      console.log('📥 Meshy API response (stringified):', JSON.stringify(responseData, null, 2));
      
      // Handle different response formats
      let taskId: string | undefined;
      
      if (responseData.result) {
        taskId = responseData.result;
      } else if (responseData.id) {
        taskId = responseData.id;
      } else if (responseData.task_id) {
        taskId = responseData.task_id;
      } else if (typeof responseData === 'string') {
        taskId = responseData;
      }
      
      const data = responseData;
      
      if (!taskId || taskId === 'undefined' || taskId.trim() === '') {
        console.error('❌ No task ID in response:', data);
        throw new Error(`Invalid response from Meshy API: No task ID received. Response: ${JSON.stringify(data)}`);
      }
      
      console.log('✅ Meshy generation initiated with task ID:', taskId);
      return { result: taskId };
    } catch (error) {
      console.error('❌ Error generating 3D asset with Meshy:', error);
      throw error;
    }
  }
  
  /**
   * Get the status of a generation task
   */
  async getGenerationStatus(taskId: string): Promise<MeshyTaskStatus> {
    if (!this.isConfigured()) {
      throw new Error('Meshy API key not configured');
    }
    
    if (!taskId || taskId === 'undefined') {
      throw new Error('Invalid task ID: Cannot check status without a valid task ID');
    }
    
    try {
      console.log(`🔍 Checking status for task: ${taskId}`);
      const response = await this.makeRequest(`/text-to-3d/${taskId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Status check error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });
        throw new Error(`Meshy API error: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.message || 'Unknown error'}`);
      }
      
      let responseData = await response.json();
      
      // Handle proxy response wrapper (if using Firebase proxy)
      if (responseData.success && responseData.data) {
        responseData = responseData.data;
        console.log('📥 Unwrapped proxy status response');
      }
      
      const data = responseData;
      console.log('📊 Task status:', data.status, 'Progress:', data.progress + '%');
      console.log('📦 Full status response:', JSON.stringify(data, null, 2));
      
      // Ensure model_urls is properly structured
      if (data.status === 'SUCCEEDED' && !data.model_urls) {
        console.warn('⚠️ Task succeeded but no model_urls found. Response:', data);
        // Try to extract model URLs from alternative fields
        if (data.model_url || data.download_url || data.url) {
          console.log('🔄 Found alternative URL fields, constructing model_urls object');
          data.model_urls = {
            glb: data.model_url || data.download_url || data.url
          };
        }
      }
      
      // Validate required fields
      if (!data.id && !data.task_id) {
        console.warn('⚠️ No task ID in status response, using provided taskId parameter');
        data.id = taskId; // Use the taskId parameter passed to the function
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error getting generation status from Meshy:', error);
      throw error;
    }
  }
  
  /**
   * Poll for generation completion with exponential backoff
   */
  async pollForCompletion(
    taskId: string, 
    maxAttempts: number = 120, 
    baseIntervalMs: number = 3000
  ): Promise<MeshyAsset> {
    if (!taskId || taskId === 'undefined') {
      throw new Error('Invalid task ID: Cannot poll for completion without a valid task ID');
    }
    
    let attempts = 0;
    let currentInterval = baseIntervalMs;
    
    console.log(`🔄 Starting polling for task ${taskId}`);
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.getGenerationStatus(taskId);
        
        // Log progress
        if (status.progress !== undefined) {
          console.log(`📊 Generation progress: ${status.progress}%`);
        }
        
        if (status.status === 'SUCCEEDED') {
          console.log('✅ Generation completed successfully');
          return this.mapToAsset(status);
        } else if (status.status === 'FAILED') {
          const errorMsg = status.task_error?.message || 'Unknown error';
          throw new Error(`Generation failed: ${errorMsg}`);
        } else if (status.status === 'CANCELED') {
          throw new Error('Generation was cancelled');
        }
        
        // Exponential backoff with jitter
        const jitter = Math.random() * 0.1 * currentInterval;
        const delay = currentInterval + jitter;
        
        console.log(`⏳ Waiting ${Math.round(delay)}ms before next poll (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase interval for next attempt (exponential backoff)
        currentInterval = Math.min(currentInterval * 1.2, 30000); // Max 30 seconds
        attempts++;
      } catch (error) {
        console.error(`❌ Error polling task ${taskId}:`, error);
        attempts++;
        
        // If it's a network error, wait longer before retrying
        if (error instanceof Error && (
          error.message.includes('network') || 
          error.message.includes('fetch') ||
          error.message.includes('timeout')
        )) {
          await new Promise(resolve => setTimeout(resolve, currentInterval * 2));
        }
      }
    }
    
    throw new Error(`Generation timed out after ${maxAttempts} attempts (${Math.round(maxAttempts * baseIntervalMs / 1000)}s)`);
  }
  
  /**
   * Map Meshy API response to our asset format
   */
  mapToAsset(status: MeshyTaskStatus): MeshyAsset {
    // Log the status to help debug
    console.log('🔄 Mapping Meshy status to asset:', {
      id: status.id,
      status: status.status,
      hasModelUrls: !!status.model_urls,
      modelUrls: status.model_urls
    });
    
    // Extract download URL - prioritize GLB, fallback to other formats
    let downloadUrl = status.model_urls?.glb;
    let format = 'glb';
    
    if (!downloadUrl && status.model_urls) {
      // Fallback to other formats if GLB is not available
      downloadUrl = status.model_urls.fbx || status.model_urls.obj || status.model_urls.usdz;
      if (status.model_urls.fbx) format = 'fbx';
      else if (status.model_urls.obj) format = 'obj';
      else if (status.model_urls.usdz) format = 'usdz';
    }
    
    if (!downloadUrl && status.status === 'SUCCEEDED') {
      console.warn('⚠️ Task succeeded but no download URL found in model_urls:', status.model_urls);
    }
    
    return {
      id: status.id,
      prompt: status.prompt,
      status: this.mapStatus(status.status),
      downloadUrl: downloadUrl,
      previewUrl: status.video_url,
      thumbnailUrl: status.thumbnail_url,
      format: format,
      size: undefined, // Not provided by Meshy API
      createdAt: new Date(status.created_at > 1000000000000 ? status.created_at : status.created_at * 1000).toISOString(), // Handle both ms and seconds
      updatedAt: new Date(((status.finished_at || status.started_at || status.created_at) > 1000000000000 ? 
        (status.finished_at || status.started_at || status.created_at) : 
        (status.finished_at || status.started_at || status.created_at) * 1000)).toISOString(),
      estimatedCompletion: undefined, // Not provided by Meshy API
      progress: status.progress,
      error: status.task_error?.message ? {
        code: 'TASK_ERROR',
        message: status.task_error.message,
        details: status.task_error
      } : undefined,
      metadata: {
        art_style: status.art_style,
        seed: status.seed,
        texture_prompt: status.texture_prompt,
        texture_urls: status.texture_urls, // Include texture URLs for separate download
        model_urls: status.model_urls // Include full model_urls for reference
      }
    };
  }

  /**
   * Map Meshy status to our status format
   */
  private mapStatus(meshyStatus: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    switch (meshyStatus) {
      case 'PENDING': return 'pending';
      case 'IN_PROGRESS': return 'processing';
      case 'SUCCEEDED': return 'completed';
      case 'FAILED': return 'failed';
      case 'CANCELED': return 'cancelled';
      default: return 'pending';
    }
  }

  /**
   * Get available styles (fallback since Meshy doesn't provide this endpoint)
   */
  async getAvailableStyles(): Promise<MeshyStyle[]> {
    console.log('📋 Using fallback styles (Meshy API does not provide styles endpoint)');
    return [
      { id: 'realistic', name: 'Realistic', description: 'Photorealistic style', category: 'realistic', tags: ['realistic', 'photorealistic'] },
      { id: 'sculpture', name: 'Sculpture', description: 'Sculpture style', category: 'sculpture', tags: ['sculpture', 'artistic'] }
    ];
  }

  /**
   * Get usage statistics (fallback since Meshy doesn't provide this endpoint)
   */
  async getUsage(): Promise<MeshyUsage> {
    console.log('📊 Using fallback usage (Meshy API does not provide usage endpoint)');
    return {
      total_generations: 0,
      successful_generations: 0,
      failed_generations: 0,
      total_cost: 0,
      quota_remaining: 100,
      quota_limit: 100,
      reset_date: new Date().toISOString()
    };
  }

  /**
   * Cancel a generation task
   */
  async cancelGeneration(taskId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Meshy API key not configured');
    }
    
    try {
      console.log(`🛑 Cancelling task: ${taskId}`);
      const response = await this.makeRequest(`/text-to-3d/${taskId}/cancel`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to cancel generation: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.message || 'Unknown error'}`);
      }
      
      console.log('✅ Task cancelled successfully');
    } catch (error) {
      console.error('❌ Error cancelling generation:', error);
      throw error;
    }
  }

  /**
   * Validate generation request
   */
  validateRequest(request: MeshyGenerationRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    } else if (request.prompt.length > 600) {
      errors.push('Prompt must be 600 characters or less');
    }

    if (request.art_style && !['realistic', 'sculpture'].includes(request.art_style)) {
      errors.push('Art style must be either "realistic" or "sculpture"');
    }

    if (request.ai_model && !['meshy-4', 'meshy-5'].includes(request.ai_model)) {
      errors.push('AI model must be either "meshy-4" or "meshy-5"');
    }

    if (request.topology && !['quad', 'triangle'].includes(request.topology)) {
      errors.push('Topology must be either "quad" or "triangle"');
    }

    if (request.target_polycount && (request.target_polycount < 100 || request.target_polycount > 300000)) {
      errors.push('Target polycount must be between 100 and 300,000');
    }

    if (request.symmetry_mode && !['off', 'auto', 'on'].includes(request.symmetry_mode)) {
      errors.push('Symmetry mode must be either "off", "auto", or "on"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get cost per asset (estimated)
   */
  getCostPerAsset(quality: 'low' | 'medium' | 'high' | 'ultra'): number {
    // Meshy doesn't provide pricing info via API, using estimates
    const costs = {
      low: 0.02,
      medium: 0.05,
      high: 0.10,
      ultra: 0.20
    };
    return costs[quality] || costs.medium;
  }

  /**
   * Estimate generation time
   */
  estimateGenerationTime(quality: 'low' | 'medium' | 'high' | 'ultra'): number {
    // Meshy doesn't provide timing info via API, using estimates
    const times = {
      low: 45,
      medium: 90,
      high: 180,
      ultra: 300
    };
    return times[quality] || times.medium;
  }

  /**
   * Get cost estimate
   */
  getCostEstimate(quality: 'low' | 'medium' | 'high' | 'ultra'): number {
    return this.getCostPerAsset(quality);
  }

  /**
   * Test the connection to Meshy API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Meshy API key not configured',
        details: { apiKey: !!this.apiKey, baseUrl: this.baseUrl }
      };
    }

    try {
      console.log('🔍 Testing Meshy API connection...');
      console.log('🔧 Base URL:', this.baseUrl);
      console.log('🔑 API Key:', this.apiKey.substring(0, 10) + '...');
      
      // Test by fetching existing tasks (this is a valid endpoint that requires authentication)
      const response = await fetch(`${this.baseUrl}/text-to-3d`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📊 API response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API connection successful, found', Array.isArray(data) ? data.length : 0, 'existing tasks');
        
        return {
          success: true,
          message: 'Meshy API connection successful',
          details: {
            baseUrl: this.baseUrl,
            existingTasks: Array.isArray(data) ? data.length : 0,
            responseStatus: response.status,
            responseStatusText: response.statusText
          }
        };
      } else {
        console.log('❌ API test failed:', response.status, response.statusText);
        const errorData = await response.text().catch(() => 'Unable to read error response');
        
        return {
          success: false,
          message: `API test failed: ${response.status} ${response.statusText}`,
          details: { 
            baseUrl: this.baseUrl, 
            status: response.status,
            statusText: response.statusText,
            errorData: errorData
          }
        };
      }
    } catch (error) {
      console.error('❌ Meshy API connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { baseUrl: this.baseUrl, error }
      };
    }
  }

  /**
   * Get a proxy URL for downloading assets to avoid CORS issues
   */
  getProxyDownloadUrl(assetUrl: string): string {
    if (!assetUrl) return '';
    
    // Always use proxy to avoid CORS issues in both development and production
    return `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(assetUrl)}`;
  }

  /**
   * Refresh expired Meshy asset URL by fetching task status
   * Extracts task ID from URL or uses provided taskId
   */
  async refreshMeshyUrl(assetUrl: string, taskId?: string): Promise<string | null> {
    try {
      // Extract task ID from URL if not provided
      let extractedTaskId = taskId;
      if (!extractedTaskId && assetUrl.includes('assets.meshy.ai')) {
        // Try to extract task ID from URL pattern: .../tasks/{taskId}/output/...
        const taskIdMatch = assetUrl.match(/\/tasks\/([a-zA-Z0-9_-]+)\//);
        if (taskIdMatch) {
          extractedTaskId = taskIdMatch[1];
        }
      }

      if (!extractedTaskId) {
        console.warn('⚠️ Cannot refresh Meshy URL: No task ID found');
        return null;
      }

      console.log(`🔄 Refreshing Meshy URL for task: ${extractedTaskId}`);
      
      // Get fresh task status from Meshy API
      const taskStatus = await this.getGenerationStatus(extractedTaskId);
      
      if (taskStatus.status === 'SUCCEEDED' && taskStatus.model_urls) {
        // Return the GLB URL (preferred format)
        const refreshedUrl = taskStatus.model_urls.glb || 
                            taskStatus.model_urls.fbx || 
                            taskStatus.model_urls.obj ||
                            taskStatus.model_urls.usdz;
        
        if (refreshedUrl) {
          console.log('✅ Successfully refreshed Meshy URL');
          return refreshedUrl;
        }
      }

      console.warn('⚠️ Task status does not have valid model URLs');
      return null;
    } catch (error) {
      console.error('❌ Failed to refresh Meshy URL:', error);
      return null;
    }
  }

  /**
   * Download an asset with fallback strategies
   */
  async downloadAsset(assetUrl: string): Promise<Blob> {
    if (!assetUrl) {
      throw new Error('Asset URL is required');
    }

    // Try multiple download strategies
    const strategies = [
      // Strategy 1: Proxy download (primary method to avoid CORS)
      async () => {
        console.log('🔄 Trying proxy download...');
        const proxyUrl = `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(assetUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Proxy download failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
      },
      
      // Strategy 2: Direct download (fallback if proxy fails)
      async () => {
        console.log('🔄 Trying direct download...');
        const response = await fetch(assetUrl, {
          method: 'GET',
          mode: 'cors',
        });
        
        if (!response.ok) {
          throw new Error(`Direct download failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
      },
      
      // Strategy 3: Using a CORS proxy service (last resort)
      async () => {
        console.log('🔄 Trying CORS proxy service...');
        const corsProxyUrl = `https://cors-anywhere.herokuapp.com/${assetUrl}`;
        const response = await fetch(corsProxyUrl, {
          method: 'GET',
          headers: {
            'Origin': window.location.origin,
          },
        });
        
        if (!response.ok) {
          throw new Error(`CORS proxy download failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
      }
    ];

    let lastError: Error | null = null;

    for (let i = 0; i < strategies.length; i++) {
      try {
        const blob = await strategies[i]();
        console.log(`✅ Download successful using strategy ${i + 1}`);
        return blob;
      } catch (error) {
        console.warn(`⚠️ Strategy ${i + 1} failed:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // If this is the last strategy, don't continue
        if (i === strategies.length - 1) {
          break;
        }
      }
    }

    // If all strategies failed, throw the last error
    console.error('❌ All download strategies failed');
    throw lastError || new Error('Failed to download asset');
  }
}

export const meshyApiService = new MeshyApiService(); 