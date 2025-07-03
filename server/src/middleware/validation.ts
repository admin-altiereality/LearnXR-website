import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types/skybox';

/**
 * Validate skybox generation request
 */
export const validateSkyboxGeneration = (req: Request, res: Response, next: NextFunction) => {
  const { prompt, skybox_style_id } = req.body;

  // Check required fields
  if (!prompt || !skybox_style_id) {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Missing required fields: prompt and skybox_style_id are required',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  // Validate prompt
  if (typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.trim().length > 1000) {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Prompt must be a string between 3 and 1000 characters',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  // Validate skybox_style_id
  if (!Number.isInteger(skybox_style_id) || skybox_style_id < 1) {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'skybox_style_id must be a positive integer',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  // Validate optional fields
  if (req.body.remix_imagine_id && typeof req.body.remix_imagine_id !== 'string') {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'remix_imagine_id must be a string',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  if (req.body.webhook_url && typeof req.body.webhook_url !== 'string') {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'webhook_url must be a string',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  // Sanitize the prompt
  req.body.prompt = prompt.trim();

  next();
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (page < 1 || limit < 1 || limit > 100) {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100.',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  // Add validated values to request
  req.query.page = page.toString();
  req.query.limit = limit.toString();

  next();
};

/**
 * Validate generation ID parameter
 */
export const validateGenerationId = (req: Request, res: Response, next: NextFunction) => {
  const { generationId } = req.params;

  if (!generationId || typeof generationId !== 'string' || generationId.trim().length === 0) {
    const errorResponse: ApiErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Valid generation ID is required',
      timestamp: new Date().toISOString()
    };
    return res.status(400).json(errorResponse);
  }

  // Sanitize the generation ID
  req.params.generationId = generationId.trim();

  next();
}; 