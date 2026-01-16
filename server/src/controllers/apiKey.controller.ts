/**
 * API Key Controller
 * Handles HTTP requests for API key management
 */

import { Request, Response } from 'express';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  regenerateApiKey
} from '../services/apiKeyService';
import { ApiKeyScope } from '../types/apiKey';

/**
 * POST /api/dev/api-keys
 * Create a new API key
 */
export async function handleCreateApiKey(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { label, scope } = req.body;

    if (!label || typeof label !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Label is required and must be a string'
      });
      return;
    }

    if (!scope || !Object.values(ApiKeyScope).includes(scope)) {
      res.status(400).json({
        success: false,
        error: 'Scope is required and must be "read" or "full"'
      });
      return;
    }

    const result = await createApiKey(req.user.uid, { label, scope });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create API key error:', error);
    res.status(error.message.includes('Maximum') ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to create API key'
    });
  }
}

/**
 * GET /api/dev/api-keys
 * List all API keys for the authenticated user
 */
export async function handleListApiKeys(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const keys = await listApiKeys(req.user.uid);

    res.json({
      success: true,
      apiKeys: keys
    });
  } catch (error: any) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list API keys'
    });
  }
}

/**
 * POST /api/dev/api-keys/:id/revoke
 * Revoke an API key
 */
export async function handleRevokeApiKey(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'API key ID is required'
      });
      return;
    }

    await revokeApiKey(req.user.uid, id);

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('Unauthorized') ? 403 :
                       error.message.includes('already revoked') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to revoke API key'
    });
  }
}

/**
 * POST /api/dev/api-keys/:id/regenerate
 * Regenerate an API key (revoke old, create new with same config)
 */
export async function handleRegenerateApiKey(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'API key ID is required'
      });
      return;
    }

    const result = await regenerateApiKey(req.user.uid, id);

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Regenerate API key error:', error);
    
    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('Unauthorized') ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to regenerate API key'
    });
  }
}
