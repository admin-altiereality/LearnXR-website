/**
 * Meshy.ai API proxy routes
 * Proxies Meshy API requests through Firebase Functions for security and CORS handling
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import axios from 'axios';
import { initializeServices, MESHY_API_KEY } from '../utils/services';
import { validateFullAccess } from '../middleware/validateIn3dApiKey';
import { successResponse, errorResponse, ErrorCode, HTTP_STATUS } from '../utils/apiResponse';

const router = Router();

const MESHY_API_BASE_URL = 'https://api.meshy.ai/openapi/v2';

// Helper to handle CORS
const setCorsHeaders = (res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
};

// Handle CORS preflight
router.options('*', (req: Request, res: Response) => {
  setCorsHeaders(res);
  res.status(204).send();
});

/**
 * Generate a 3D asset using Meshy.ai
 * POST /meshy/generate
 * Requires FULL scope API key
 */
router.post('/generate', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    initializeServices();
    
    if (!MESHY_API_KEY) {
      const { statusCode, response } = errorResponse(
        'Service configuration error',
        'Meshy API is not configured. Please contact support.',
        ErrorCode.SERVICE_UNAVAILABLE,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    const { prompt, negative_prompt, art_style, ai_model, topology, target_polycount, should_remesh, symmetry_mode, moderation } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Prompt is required and must be a non-empty string',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    // Meshy v2 accepts only: latest, meshy-6, meshy-5 (meshy-4 is not valid and causes "invalid format")
    const model = ai_model === 'meshy-6' || ai_model === 'meshy-5' ? ai_model : 'latest';
    // art_style is deprecated for Meshy-6/latest; only send for meshy-5 to avoid API errors
    const includeArtStyle = model === 'meshy-5';

    console.log(`[${requestId}] Meshy generation requested:`, {
      prompt: prompt.substring(0, 50) + '...',
      ai_model: model,
      include_art_style: includeArtStyle
    });

    // should_remesh: default false for latest/meshy-6, true for meshy-5 (per Meshy v2 docs)
    const defaultShouldRemesh = model === 'meshy-5';
    const payload: Record<string, unknown> = {
      mode: 'preview',
      prompt: prompt.trim(),
      ai_model: model,
      topology: topology || 'triangle',
      target_polycount: target_polycount ?? 30000,
      should_remesh: should_remesh !== undefined ? should_remesh : defaultShouldRemesh,
      symmetry_mode: symmetry_mode || 'auto',
      moderation: moderation || false,
    };
    if (includeArtStyle) {
      payload.art_style = art_style || 'realistic';
    }
    if (negative_prompt && typeof negative_prompt === 'string' && negative_prompt.trim()) {
      payload.negative_prompt = negative_prompt.trim();
    }

    const response = await axios.post(`${MESHY_API_BASE_URL}/text-to-3d`, payload, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    setCorsHeaders(res);
    return res.status(HTTP_STATUS.ACCEPTED).json(successResponse(response.data, {
      requestId,
      message: '3D asset generation initiated successfully'
    }));

  } catch (error: any) {
    console.error(`[${requestId}] Meshy generation error:`, error);
    
    setCorsHeaders(res);
    
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy API error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }

    const { statusCode, response: errorResp } = errorResponse(
      'Generation failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

/**
 * Get generation status
 * GET /meshy/status/:taskId
 * Requires READ or FULL scope
 */
router.get('/status/:taskId', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { taskId } = req.params;

  try {
    initializeServices();
    
    if (!MESHY_API_KEY) {
      const { statusCode, response } = errorResponse(
        'Service configuration error',
        'Meshy API is not configured. Please contact support.',
        ErrorCode.SERVICE_UNAVAILABLE,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    if (!taskId) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Task ID is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    console.log(`[${requestId}] Checking Meshy status for task:`, taskId);

    const response = await axios.get(`${MESHY_API_BASE_URL}/text-to-3d/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    setCorsHeaders(res);
    return res.json(successResponse(response.data, {
      requestId,
      message: 'Generation status retrieved successfully'
    }));

  } catch (error: any) {
    console.error(`[${requestId}] Meshy status check error:`, error);
    
    setCorsHeaders(res);
    
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy API error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }

    const { statusCode, response: errorResp } = errorResponse(
      'Status check failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

/**
 * Cancel a generation task
 * POST /meshy/cancel/:taskId
 * Requires FULL scope
 */
router.post('/cancel/:taskId', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { taskId } = req.params;

  try {
    initializeServices();
    
    if (!MESHY_API_KEY) {
      const { statusCode, response } = errorResponse(
        'Service configuration error',
        'Meshy API is not configured. Please contact support.',
        ErrorCode.SERVICE_UNAVAILABLE,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    if (!taskId) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Task ID is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }

    console.log(`[${requestId}] Cancelling Meshy task:`, taskId);

    const response = await axios.post(`${MESHY_API_BASE_URL}/text-to-3d/${taskId}/cancel`, {}, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    setCorsHeaders(res);
    return res.json(successResponse(response.data, {
      requestId,
      message: 'Generation task cancelled successfully'
    }));

  } catch (error: any) {
    console.error(`[${requestId}] Meshy cancel error:`, error);
    
    setCorsHeaders(res);
    
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy API error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }

    const { statusCode, response: errorResp } = errorResponse(
      'Cancellation failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

export default router;

