/**
 * API Key Controller
 * Handles HTTP requests for API key management
 */

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  regenerateApiKey
} from '../services/apiKeyService';
import { ApiKeyScope } from '../types/apiKey';

// Extend Express Request type to include user from authenticateUser middleware
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
    }
  }
}

/**
 * POST /api/dev/api-keys
 * Create a new API key
 */
export async function handleCreateApiKey(req: Request, res: Response): Promise<void> {
  const requestId = (req as any).requestId;
  
  try {
    // authenticateUser middleware sets req.user
    if (!req.user?.uid) {
      console.log(`[${requestId}] ❌ Create API key: Authentication required`);
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId
      });
      return;
    }

    const { label, scope } = req.body;

    if (!label || typeof label !== 'string') {
      console.log(`[${requestId}] ❌ Create API key: Invalid label`);
      res.status(400).json({
        success: false,
        error: 'Label is required and must be a string',
        requestId
      });
      return;
    }

    if (!scope || !Object.values(ApiKeyScope).includes(scope)) {
      console.log(`[${requestId}] ❌ Create API key: Invalid scope`);
      res.status(400).json({
        success: false,
        error: 'Scope is required and must be "read" or "full"',
        requestId
      });
      return;
    }

    console.log(`[${requestId}] Creating API key for user ${req.user.uid}, label: ${label}, scope: ${scope}`);
    const result = await createApiKey(req.user.uid, { label, scope });
    console.log(`[${requestId}] ✅ API key created successfully: ${result.apiKey.keyPrefix}`);

    res.status(201).json(result);
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Create API key error:`, error);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    
    // Ensure response hasn't been sent
    if (res.headersSent) {
      console.error(`[${requestId}] ⚠️ Response already sent, cannot send error response`);
      return;
    }
    
    const statusCode = error.message?.includes('Maximum') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to create API key',
      requestId
    });
  }
}

/**
 * GET /api/dev/api-keys
 * List all API keys for the authenticated user
 */
export async function handleListApiKeys(req: Request, res: Response): Promise<void> {
  const requestId = (req as any).requestId;
  
  try {
    if (!req.user?.uid) {
      console.log(`[${requestId}] ❌ List API keys: Authentication required`);
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId
      });
      return;
    }

    console.log(`[${requestId}] Listing API keys for user ${req.user.uid}`);
    const keys = await listApiKeys(req.user.uid);
    console.log(`[${requestId}] ✅ Found ${keys.length} API keys`);

    res.json({
      success: true,
      apiKeys: keys,
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] ❌ List API keys error:`, error);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    
    if (res.headersSent) {
      console.error(`[${requestId}] ⚠️ Response already sent, cannot send error response`);
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list API keys',
      requestId
    });
  }
}

/**
 * POST /api/dev/api-keys/:id/revoke
 * Revoke an API key
 */
export async function handleRevokeApiKey(req: Request, res: Response): Promise<void> {
  const requestId = (req as any).requestId;
  
  try {
    if (!req.user?.uid) {
      console.log(`[${requestId}] ❌ Revoke API key: Authentication required`);
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      console.log(`[${requestId}] ❌ Revoke API key: Missing key ID`);
      res.status(400).json({
        success: false,
        error: 'API key ID is required',
        requestId
      });
      return;
    }

    console.log(`[${requestId}] Revoking API key ${id} for user ${req.user.uid}`);
    await revokeApiKey(req.user.uid, id);
    console.log(`[${requestId}] ✅ API key revoked successfully`);

    res.json({
      success: true,
      message: 'API key revoked successfully',
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Revoke API key error:`, error);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    
    if (res.headersSent) {
      console.error(`[${requestId}] ⚠️ Response already sent, cannot send error response`);
      return;
    }
    
    const statusCode = error.message?.includes('not found') ? 404 :
                       error.message?.includes('Unauthorized') ? 403 :
                       error.message?.includes('already revoked') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to revoke API key',
      requestId
    });
  }
}

/**
 * POST /api/dev/api-keys/:id/regenerate
 * Regenerate an API key (revoke old, create new with same config)
 */
export async function handleRegenerateApiKey(req: Request, res: Response): Promise<void> {
  const requestId = (req as any).requestId;
  
  try {
    if (!req.user?.uid) {
      console.log(`[${requestId}] ❌ Regenerate API key: Authentication required`);
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        requestId
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      console.log(`[${requestId}] ❌ Regenerate API key: Missing key ID`);
      res.status(400).json({
        success: false,
        error: 'API key ID is required',
        requestId
      });
      return;
    }

    console.log(`[${requestId}] Regenerating API key ${id} for user ${req.user.uid}`);
    const result = await regenerateApiKey(req.user.uid, id);
    console.log(`[${requestId}] ✅ API key regenerated successfully: ${result.apiKey.keyPrefix}`);

    res.status(201).json(result);
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Regenerate API key error:`, error);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    
    if (res.headersSent) {
      console.error(`[${requestId}] ⚠️ Response already sent, cannot send error response`);
      return;
    }
    
    const statusCode = error.message?.includes('not found') ? 404 :
                       error.message?.includes('Unauthorized') ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to regenerate API key',
      requestId
    });
  }
}
