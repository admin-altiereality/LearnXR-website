/**
 * Meshy.ai API proxy routes
 * Proxies Meshy API requests through Firebase Functions for security and CORS handling
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import axios from 'axios';
import { initializeServices, MESHY_API_KEY } from '../utils/services';
import { validateFullAccess } from '../middleware/validateIn3dApiKey';
import { requireRole } from '../middleware/rbac';
import { successResponse, errorResponse, ErrorCode, HTTP_STATUS } from '../utils/apiResponse';
import {
  backfillAssets,
  finalizeAnimatedAsset,
  finalizeGeneratedAsset,
  registerUploadedAsset,
  type FinalizeAnimatedAssetInput,
  type FinalizeGeneratedAssetInput,
  type RegisterUploadedAssetInput,
} from '../services/meshyAssetStorage';
import {
  cancelRegenerationJob,
  createRegenerationJob,
  getRegenerationJob,
  retryFailedRegenerationItems,
} from '../services/meshyAssetRegeneration';

const router = Router();

const MESHY_API_BASE_URL = 'https://api.meshy.ai/openapi/v2';
const MESHY_API_V1_BASE_URL = 'https://api.meshy.ai/openapi/v1';

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

const requireContentEditor = requireRole(['admin', 'superadmin', 'associate']);
const requireSuperadmin = requireRole(['superadmin']);

/**
 * Persist Meshy output files into Firebase Storage and register a renderable asset.
 * POST /meshy/finalize-generated-asset
 */
router.post('/finalize-generated-asset', validateFullAccess, requireContentEditor, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  try {
    const assetKind = String(req.body?.assetKind || 'generated');
    const authenticatedUserId = (req as any).user?.uid as string | undefined;

    if (assetKind === 'animation') {
      const result = await finalizeAnimatedAsset(req, req.body as FinalizeAnimatedAssetInput);
      setCorsHeaders(res);
      return res.status(HTTP_STATUS.OK).json(successResponse(result, {
        requestId,
        message: 'Animated 3D asset persisted successfully',
      }));
    }

    if (assetKind === 'uploaded') {
      const result = await registerUploadedAsset(req, req.body as RegisterUploadedAssetInput, authenticatedUserId);
      setCorsHeaders(res);
      return res.status(HTTP_STATUS.OK).json(successResponse(result, {
        requestId,
        message: 'Uploaded 3D asset registered successfully',
      }));
    }

    const body = req.body as FinalizeGeneratedAssetInput;
    if (!body?.sourceAssetId || !body?.sourceCollection || !body?.chapterId || !body?.topicId || !body?.modelUrls?.glb) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'sourceAssetId, sourceCollection, chapterId, topicId, and modelUrls.glb are required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      setCorsHeaders(res);
      return res.status(statusCode).json(response);
    }

    const result = await finalizeGeneratedAsset(req, body, authenticatedUserId);
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(result, {
      requestId,
      message: 'Generated 3D asset persisted successfully',
    }));
  } catch (error: any) {
    console.error(`[${requestId}] Finalize generated asset error:`, error?.message || error);
    const { statusCode, response } = errorResponse(
      'Finalize failed',
      error?.message || 'Failed to persist generated 3D asset',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    setCorsHeaders(res);
    return res.status(statusCode).json(response);
  }
});

/**
 * Backfill existing 3D asset documents with Storage paths and token render URLs.
 * POST /meshy/backfill-assets
 */
router.post('/backfill-assets', validateFullAccess, requireSuperadmin, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  try {
    const limit = Number(req.body?.limit || 50);
    const result = await backfillAssets(req, Number.isFinite(limit) ? limit : 50);
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(result, {
      requestId,
      message: '3D asset backfill completed',
    }));
  } catch (error: any) {
    console.error(`[${requestId}] Backfill assets error:`, error?.message || error);
    const { statusCode, response } = errorResponse(
      'Backfill failed',
      error?.message || 'Failed to backfill 3D assets',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    setCorsHeaders(res);
    return res.status(statusCode).json(response);
  }
});

/**
 * Create a superadmin regeneration scan or live job.
 * POST /meshy/regeneration/jobs
 */
router.post('/regeneration/jobs', validateFullAccess, requireSuperadmin, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  try {
    const createdBy = String((req as any).user?.uid || '');
    const result = await createRegenerationJob({
      ...req.body,
      createdBy,
    });
    setCorsHeaders(res);
    return res.status(req.body?.dryRun === true ? HTTP_STATUS.OK : HTTP_STATUS.ACCEPTED).json(successResponse(result, {
      requestId,
      message: req.body?.dryRun === true ? 'Broken 3D asset scan completed' : '3D asset regeneration job queued',
    }));
  } catch (error: any) {
    console.error(`[${requestId}] Create regeneration job error:`, error?.message || error);
    const { statusCode, response } = errorResponse(
      'Regeneration job failed',
      error?.message || 'Failed to create regeneration job',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    setCorsHeaders(res);
    return res.status(statusCode).json(response);
  }
});

/**
 * Get a regeneration job and its item results.
 * GET /meshy/regeneration/jobs/:jobId
 */
router.get('/regeneration/jobs/:jobId', validateFullAccess, requireSuperadmin, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  try {
    const result = await getRegenerationJob(req.params.jobId);
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(result, {
      requestId,
      message: '3D asset regeneration job retrieved',
    }));
  } catch (error: any) {
    console.error(`[${requestId}] Get regeneration job error:`, error?.message || error);
    const { statusCode, response } = errorResponse(
      'Regeneration job lookup failed',
      error?.message || 'Failed to retrieve regeneration job',
      ErrorCode.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      { requestId }
    );
    setCorsHeaders(res);
    return res.status(statusCode).json(response);
  }
});

/**
 * Cancel pending items in a regeneration job.
 * POST /meshy/regeneration/jobs/:jobId/cancel
 */
router.post('/regeneration/jobs/:jobId/cancel', validateFullAccess, requireSuperadmin, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  try {
    const result = await cancelRegenerationJob(req.params.jobId);
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(result, {
      requestId,
      message: 'Pending regeneration items cancelled',
    }));
  } catch (error: any) {
    console.error(`[${requestId}] Cancel regeneration job error:`, error?.message || error);
    const { statusCode, response } = errorResponse(
      'Regeneration cancel failed',
      error?.message || 'Failed to cancel regeneration job',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    setCorsHeaders(res);
    return res.status(statusCode).json(response);
  }
});

/**
 * Retry failed items in a regeneration job.
 * POST /meshy/regeneration/jobs/:jobId/retry-failed
 */
router.post('/regeneration/jobs/:jobId/retry-failed', validateFullAccess, requireSuperadmin, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  try {
    const result = await retryFailedRegenerationItems(req.params.jobId);
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(result, {
      requestId,
      message: 'Failed regeneration items queued for retry',
    }));
  } catch (error: any) {
    console.error(`[${requestId}] Retry regeneration job error:`, error?.message || error);
    const { statusCode, response } = errorResponse(
      'Regeneration retry failed',
      error?.message || 'Failed to retry failed regeneration items',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    setCorsHeaders(res);
    return res.status(statusCode).json(response);
  }
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

    const {
      prompt,
      mode,
      preview_task_id,
      negative_prompt,
      art_style,
      ai_model,
      topology,
      target_polycount,
      should_remesh,
      symmetry_mode,
      moderation,
      model_type,
      decimation_mode,
      pose_mode,
      target_formats,
      auto_size,
      origin_at,
      alpha_thumbnail,
      enable_pbr,
      hd_texture,
      remove_lighting,
      texture_prompt,
      texture_image_url,
    } = req.body;

    // Meshy v2 uses the same endpoint for preview and refine. Keep this proxy
    // route compatible with both so preview-channel clients never need a Meshy key.
    if (mode === 'refine') {
      if (!preview_task_id || typeof preview_task_id !== 'string') {
        const { statusCode, response } = errorResponse(
          'Validation error',
          'preview_task_id is required for refine tasks',
          ErrorCode.MISSING_REQUIRED_FIELD,
          HTTP_STATUS.BAD_REQUEST,
          { requestId }
        );
        return res.status(statusCode).json(response);
      }

      const model = ai_model === 'meshy-5' || ai_model === 'meshy-6' || ai_model === 'latest' ? ai_model : 'meshy-6';
      const refinePayload: Record<string, unknown> = {
        mode: 'refine',
        preview_task_id: preview_task_id.trim(),
        ai_model: model,
        enable_pbr: enable_pbr !== undefined ? Boolean(enable_pbr) : true,
        hd_texture: hd_texture !== undefined ? Boolean(hd_texture) : true,
        remove_lighting: remove_lighting !== undefined ? Boolean(remove_lighting) : true,
        target_formats: Array.isArray(target_formats) && target_formats.length ? target_formats : ['glb'],
        auto_size: auto_size !== undefined ? Boolean(auto_size) : true,
        origin_at: origin_at === 'center' ? 'center' : 'bottom',
        moderation: moderation !== undefined ? Boolean(moderation) : true,
      };
      if (typeof texture_prompt === 'string' && texture_prompt.trim()) {
        refinePayload.texture_prompt = texture_prompt.trim().slice(0, 600);
      }
      if (typeof texture_image_url === 'string' && texture_image_url.trim()) {
        refinePayload.texture_image_url = texture_image_url.trim();
      }
      if (alpha_thumbnail !== undefined) {
        refinePayload.alpha_thumbnail = Boolean(alpha_thumbnail);
      }

      const response = await axios.post(`${MESHY_API_BASE_URL}/text-to-3d`, refinePayload, {
        headers: {
          'Authorization': `Bearer ${MESHY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      setCorsHeaders(res);
      return res.status(HTTP_STATUS.ACCEPTED).json(successResponse(response.data, {
        requestId,
        message: '3D asset refine initiated successfully'
      }));
    }

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
      model_type: model_type || 'standard',
      topology: topology || 'triangle',
      target_polycount: target_polycount ?? 30000,
      should_remesh: should_remesh !== undefined ? should_remesh : defaultShouldRemesh,
      target_formats: Array.isArray(target_formats) && target_formats.length ? target_formats : ['glb'],
      auto_size: auto_size !== undefined ? Boolean(auto_size) : true,
      origin_at: origin_at === 'center' ? 'center' : 'bottom',
      moderation: moderation !== undefined ? Boolean(moderation) : true,
    };
    if (includeArtStyle) {
      payload.art_style = art_style || 'realistic';
      payload.symmetry_mode = symmetry_mode || 'auto';
    }
    if (decimation_mode !== undefined) {
      payload.decimation_mode = Number(decimation_mode);
    }
    if (pose_mode === 'a-pose' || pose_mode === 't-pose' || pose_mode === '') {
      payload.pose_mode = pose_mode;
    }
    if (alpha_thumbnail !== undefined) {
      payload.alpha_thumbnail = Boolean(alpha_thumbnail);
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

// ─── Meshy v1: Auto-Rigging & Animation API ─────────────────────────────────

/**
 * Create a rigging task
 * POST /meshy/rigging
 * Body: { input_task_id?: string, model_url?: string, height_meters?: number }
 */
router.post('/rigging', validateFullAccess, async (req: Request, res: Response) => {
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
    const { input_task_id, model_url, height_meters } = req.body;
    if (!input_task_id && !model_url) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Either input_task_id or model_url is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }
    const payload: Record<string, unknown> = {};
    if (input_task_id) payload.input_task_id = input_task_id;
    if (model_url) payload.model_url = model_url;
    if (height_meters != null && typeof height_meters === 'number') payload.height_meters = height_meters;

    const response = await axios.post(`${MESHY_API_V1_BASE_URL}/rigging`, payload, {
      headers: { 'Authorization': `Bearer ${MESHY_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(response.data, { requestId, message: 'Rigging task created' }));
  } catch (error: any) {
    console.error(`[${requestId}] Meshy rigging create error:`, error?.response?.data ?? error?.message);
    setCorsHeaders(res);
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy rigging error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }
    const { statusCode, response: errorResp } = errorResponse(
      'Rigging failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

/**
 * Get rigging task status and result
 * GET /meshy/rigging/:id
 */
router.get('/rigging/:id', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { id } = req.params;
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
    if (!id) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Rigging task ID is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }
    const response = await axios.get(`${MESHY_API_V1_BASE_URL}/rigging/${id}`, {
      headers: { 'Authorization': `Bearer ${MESHY_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    setCorsHeaders(res);
    return res.json(successResponse(response.data, { requestId, message: 'Rigging task retrieved' }));
  } catch (error: any) {
    console.error(`[${requestId}] Meshy rigging get error:`, error?.response?.data ?? error?.message);
    setCorsHeaders(res);
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy rigging error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }
    const { statusCode, response: errorResp } = errorResponse(
      'Rigging status check failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

/**
 * Create an animation task
 * POST /meshy/animations
 * Body: { rig_task_id: string, action_id: number, post_process?: object }
 */
router.post('/animations', validateFullAccess, async (req: Request, res: Response) => {
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
    const { rig_task_id, action_id, post_process } = req.body;
    if (!rig_task_id || typeof action_id !== 'number') {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'rig_task_id and action_id (number) are required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }
    const payload: Record<string, unknown> = { rig_task_id, action_id };
    if (post_process && typeof post_process === 'object') payload.post_process = post_process;

    const response = await axios.post(`${MESHY_API_V1_BASE_URL}/animations`, payload, {
      headers: { 'Authorization': `Bearer ${MESHY_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    setCorsHeaders(res);
    return res.status(HTTP_STATUS.OK).json(successResponse(response.data, { requestId, message: 'Animation task created' }));
  } catch (error: any) {
    console.error(`[${requestId}] Meshy animation create error:`, error?.response?.data ?? error?.message);
    setCorsHeaders(res);
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy animation error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }
    const { statusCode, response: errorResp } = errorResponse(
      'Animation failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

/**
 * Get animation task status and result
 * GET /meshy/animations/:id
 */
router.get('/animations/:id', validateFullAccess, async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { id } = req.params;
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
    if (!id) {
      const { statusCode, response } = errorResponse(
        'Validation error',
        'Animation task ID is required',
        ErrorCode.MISSING_REQUIRED_FIELD,
        HTTP_STATUS.BAD_REQUEST,
        { requestId }
      );
      return res.status(statusCode).json(response);
    }
    const response = await axios.get(`${MESHY_API_V1_BASE_URL}/animations/${id}`, {
      headers: { 'Authorization': `Bearer ${MESHY_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    setCorsHeaders(res);
    return res.json(successResponse(response.data, { requestId, message: 'Animation task retrieved' }));
  } catch (error: any) {
    console.error(`[${requestId}] Meshy animation get error:`, error?.response?.data ?? error?.message);
    setCorsHeaders(res);
    if (error.response) {
      const { statusCode, response: errorResp } = errorResponse(
        'External API error',
        error.response.data?.error?.message || error.response.data?.message || 'Meshy animation error',
        ErrorCode.EXTERNAL_API_ERROR,
        error.response.status || HTTP_STATUS.BAD_GATEWAY,
        { requestId, details: error.response.data }
      );
      return res.status(statusCode).json(errorResp);
    }
    const { statusCode, response: errorResp } = errorResponse(
      'Animation status check failed',
      error.message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { requestId }
    );
    return res.status(statusCode).json(errorResp);
  }
});

export default router;

