import { BlockadeLabsSdk } from '@blockadelabs/sdk';
import { env } from '../config/env';

// Cache for skybox styles to reduce API calls
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Skybox Style Interface
export interface SkyboxStyle {
  id: number;
  name: string;
  description?: string;
  preview_image_url?: string;
  category?: string;
  model?: string;
  image_jpg?: string;
  image_webp?: string;
}

// Pagination Interface
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Skybox Generation Interface
export interface SkyboxGenerationRequest {
  prompt: string;
  skybox_style_id: number;
  remix_imagine_id?: string;
  webhook_url?: string;
  negative_text?: string;
}

// Skybox Generation Response - Updated to match SDK types
export interface SkyboxGenerationResponse {
  id: number; // Changed from string to number to match SDK
  status: 'pending' | 'complete' | 'failed';
  file_url?: string;
  title?: string;
  prompt?: string;
  created_at?: string;
  type?: string;
  skybox_style_id?: number;
  skybox_style_name?: string;
  queue_position?: number;
  thumb_url?: string;
  user_id?: number;
  username?: string;
  obfuscated_id?: string;
  pusher_channel?: string;
  depth_map_url?: string;
}

// API Response Interface
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

class SkyboxService {
  private sdk: BlockadeLabsSdk | null = null;
  private stylesCache: CacheEntry<SkyboxStyle[]> | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    if (env.API_KEY && env.API_KEY.trim() !== '') {
      this.sdk = new BlockadeLabsSdk({ api_key: env.API_KEY });
    }
  }

  /** Throws if BlockadeLabs API key was not configured (allows server to start without it for local/testing). */
  private getSdk(): BlockadeLabsSdk {
    if (!this.sdk) {
      throw new Error('BlockadeLabs API key is required. Set API_KEY in server/.env to use skybox features.');
    }
    return this.sdk;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(cache: CacheEntry<any>): boolean {
    return Date.now() - cache.timestamp < cache.ttl;
  }

  /**
   * Paginate styles array
   */
  private paginateStyles(styles: SkyboxStyle[], page: number, limit: number): {
    styles: SkyboxStyle[];
    pagination: PaginationInfo;
  } {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStyles = styles.slice(startIndex, endIndex);
    const total = styles.length;
    const totalPages = Math.ceil(total / limit);

    return {
      styles: paginatedStyles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get skybox styles with caching and pagination
   */
  async getSkyboxStyles(page: number = 1, limit: number = 20): Promise<{
    styles: SkyboxStyle[];
    pagination: PaginationInfo;
  }> {
    try {
      // Validate pagination parameters
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      // Check cache first
      if (this.stylesCache && this.isCacheValid(this.stylesCache)) {
        console.log('Returning cached skybox styles');
        return this.paginateStyles(this.stylesCache.data, page, limit);
      }

      console.log('Fetching fresh skybox styles from BlockadeLabs API');
      const styles = await this.getSdk().getSkyboxStyles();
      
      // Cache the results
      this.stylesCache = {
        data: styles,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL
      };

      console.log(`Fetched ${styles.length} skybox styles from API`);
      return this.paginateStyles(styles, page, limit);
    } catch (error) {
      console.error('Error fetching skybox styles:', error);
      throw new Error(`Failed to fetch skybox styles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new skybox
   */
  async generateSkybox(request: SkyboxGenerationRequest): Promise<SkyboxGenerationResponse> {
    try {
      // Validate required fields
      if (!request.prompt || request.prompt.trim().length === 0) {
        throw new Error('Prompt is required');
      }

      if (!request.skybox_style_id || request.skybox_style_id <= 0) {
        throw new Error('Valid skybox_style_id is required');
      }

      // Validate prompt length
      if (request.prompt.length < 3 || request.prompt.length > 1000) {
        throw new Error('Prompt must be between 3 and 1000 characters');
      }

      console.log('Generating skybox with parameters:', {
        prompt: request.prompt.substring(0, 50) + '...',
        skybox_style_id: request.skybox_style_id,
        has_remix: !!request.remix_imagine_id,
        has_webhook: !!request.webhook_url
      });

      const generation = await this.getSdk().generateSkybox({
        prompt: request.prompt.trim(),
        skybox_style_id: request.skybox_style_id,
        remix_id: request.remix_imagine_id ? parseInt(request.remix_imagine_id) : undefined,
        webhook_url: request.webhook_url,
        negative_text: request.negative_text
      });

      console.log('Skybox generation initiated:', generation.id);
      return generation as SkyboxGenerationResponse;
    } catch (error) {
      console.error('Error generating skybox:', error);
      throw new Error(`Failed to generate skybox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get generation status by ID
   */
  async getGenerationStatus(generationId: string): Promise<SkyboxGenerationResponse> {
    try {
      if (!generationId || generationId.trim().length === 0) {
        throw new Error('Valid generation ID is required');
      }

      console.log('Checking generation status for:', generationId);
      const status = await this.getSdk().getImagineById({ id: generationId });
      
      console.log('Generation status:', {
        id: generationId,
        status: status.status,
        has_file: !!status.file_url
      });

      return status as SkyboxGenerationResponse;
    } catch (error) {
      console.error('Error getting generation status:', error);
      throw new Error(`Failed to get generation status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the styles cache
   */
  clearCache(): void {
    this.stylesCache = null;
    console.log('Skybox styles cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    hasCache: boolean;
    isValid: boolean;
    age: number;
    ttl: number;
  } {
    if (!this.stylesCache) {
      return {
        hasCache: false,
        isValid: false,
        age: 0,
        ttl: this.CACHE_TTL
      };
    }

    const age = Date.now() - this.stylesCache.timestamp;
    const isValid = this.isCacheValid(this.stylesCache);

    return {
      hasCache: true,
      isValid,
      age,
      ttl: this.CACHE_TTL
    };
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    details: {
      apiKeyConfigured: boolean;
      cacheStatus: any;
      lastApiCall?: string;
    };
  }> {
    try {
      const cacheStatus = this.getCacheStatus();
      
      // Test API connection by fetching a small number of styles
      const testStyles = await this.getSdk().getSkyboxStyles();
      
      return {
        status: 'healthy',
        message: 'Skybox service is operational',
        details: {
          apiKeyConfigured: !!env.API_KEY,
          cacheStatus,
          lastApiCall: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Skybox service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          apiKeyConfigured: !!env.API_KEY,
          cacheStatus: this.getCacheStatus()
        }
      };
    }
  }
}

// Export singleton instance
export const skyboxService = new SkyboxService(); 