import { Request, Response } from 'express';
import { skyboxService, SkyboxGenerationRequest, ApiResponse } from '../services/skyboxService';

/**
 * Get skybox styles with pagination
 * GET /api/skybox/styles
 */
export const getSkyboxStyles = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    console.log(`Skybox API: GET /styles - page: ${page}, limit: ${limit}`);

    const result = await skyboxService.getSkyboxStyles(page, limit);

    const response: ApiResponse<{ styles: any[] }> = {
      success: true,
      data: {
        styles: result.styles
      },
      message: `Retrieved ${result.styles.length} skybox styles`,
      pagination: result.pagination
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Skybox API Error - getSkyboxStyles:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch skybox styles'
    };

    res.status(400).json(response);
  }
};

/**
 * Generate a new skybox
 * POST /api/skybox/generate
 */
export const generateSkybox = async (req: Request, res: Response) => {
  try {
    const { prompt, skybox_style_id, remix_imagine_id, webhook_url, negative_text } = req.body;

    console.log(`Skybox API: POST /generate - style_id: ${skybox_style_id}`);

    // Validate required fields
    if (!prompt || !skybox_style_id) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: prompt and skybox_style_id are required'
      };
      return res.status(400).json(response);
    }

    const request: SkyboxGenerationRequest = {
      prompt: prompt.trim(),
      skybox_style_id: parseInt(skybox_style_id),
      remix_imagine_id,
      webhook_url,
      negative_text
    };

    const generation = await skyboxService.generateSkybox(request);

    const response: ApiResponse<{ id: string; status: string }> = {
      success: true,
      data: {
        id: generation.id.toString(),
        status: generation.status
      },
      message: 'Skybox generation initiated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Skybox API Error - generateSkybox:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to generate skybox'
    };

    res.status(400).json(response);
  }
};

/**
 * Get generation status by ID
 * GET /api/skybox/status/:generationId
 */
export const getGenerationStatus = async (req: Request, res: Response) => {
  try {
    const { generationId } = req.params;

    console.log(`Skybox API: GET /status/${generationId}`);

    if (!generationId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Valid generation ID is required'
      };
      return res.status(400).json(response);
    }

    const status = await skyboxService.getGenerationStatus(generationId);

    const response: ApiResponse<any> = {
      success: true,
      data: status,
      message: `Generation status: ${status.status}`
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Skybox API Error - getGenerationStatus:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to get generation status'
    };

    res.status(400).json(response);
  }
};

/**
 * Health check endpoint
 * GET /api/skybox/health
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    console.log('Skybox API: GET /health');

    const health = await skyboxService.healthCheck();

    const response: ApiResponse<any> = {
      success: health.status === 'healthy',
      data: {
        status: health.status,
        message: health.message,
        details: health.details
      },
      message: health.message
    };

    res.status(health.status === 'healthy' ? 200 : 503).json(response);
  } catch (error) {
    console.error('Skybox API Error - healthCheck:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'SERVICE_ERROR',
      message: 'Health check failed'
    };

    res.status(503).json(response);
  }
};

/**
 * Clear cache endpoint
 * DELETE /api/skybox/cache
 */
export const clearCache = async (req: Request, res: Response) => {
  try {
    console.log('Skybox API: DELETE /cache');

    skyboxService.clearCache();

    const response: ApiResponse<null> = {
      success: true,
      message: 'Cache cleared successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Skybox API Error - clearCache:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'SERVICE_ERROR',
      message: 'Failed to clear cache'
    };

    res.status(500).json(response);
  }
};

/**
 * Legacy endpoint for backward compatibility
 * GET /api/skybox/getSkyboxStyles
 */
export const getSkyboxStylesLegacy = async (req: Request, res: Response) => {
  try {
    console.log('Skybox API: GET /getSkyboxStyles (legacy)');

    const result = await skyboxService.getSkyboxStyles(1, 100); // Get all styles for legacy compatibility

    const response: ApiResponse<{ styles: any[] }> = {
      success: true,
      data: {
        styles: result.styles
      },
      message: `Retrieved ${result.styles.length} skybox styles`
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Skybox API Error - getSkyboxStylesLegacy:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to fetch skybox styles'
    };

    res.status(400).json(response);
  }
};

/**
 * Legacy endpoint for backward compatibility
 * POST /api/skybox/generateSkybox
 */
export const generateSkyboxLegacy = async (req: Request, res: Response) => {
  try {
    const { prompt, skybox_style_id, remix_imagine_id, webhook_url } = req.body;

    console.log(`Skybox API: POST /generateSkybox (legacy) - style_id: ${skybox_style_id}`);

    // Validate required fields
    if (!prompt || !skybox_style_id) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields: prompt and skybox_style_id are required'
      };
      return res.status(400).json(response);
    }

    const request: SkyboxGenerationRequest = {
      prompt: prompt.trim(),
      skybox_style_id: parseInt(skybox_style_id),
      remix_imagine_id,
      webhook_url
    };

    const generation = await skyboxService.generateSkybox(request);

    const response: ApiResponse<any> = {
      success: true,
      data: generation,
      message: 'Skybox generation initiated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Skybox API Error - generateSkyboxLegacy:', error);
    
    const response: ApiResponse<null> = {
      success: false,
      error: 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Failed to generate skybox'
    };

    res.status(400).json(response);
  }
};

/**
 * Get user skyboxes with pagination
 * GET /api/skybox/user
 */
export const getUserSkyboxes = async (req: Request, res: Response) => {
  try {
    // In a real implementation, you would fetch from your DB or service
    // For now, return an empty array and mock pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const data: any[] = [];
    const pagination = {
      page,
      limit,
      total: 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    };
    res.status(200).json({ success: true, data: { data, pagination } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Failed to fetch user skyboxes' });
  }
};
