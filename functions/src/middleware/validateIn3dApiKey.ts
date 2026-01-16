/**
 * In3D API Key Validation Middleware
 * Validates API keys for external API access
 * Works alongside Firebase Auth - allows either authentication method
 */

import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/apiKeyService';
import { ValidatedApiKeyUser, ApiKeyScope } from '../types/apiKey';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyUser?: ValidatedApiKeyUser;
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

interface ValidateApiKeyOptions {
  requiredScope?: ApiKeyScope;
  requireCredits?: boolean;
  requiredTiers?: string[];
  allowFirebaseAuth?: boolean; // Allow Firebase Auth as alternative
}

/**
 * Middleware to validate In3D API keys
 * 
 * Reads API key from:
 * 1. Authorization: Bearer <key>
 * 2. X-In3d-Key: <key>
 * 
 * If allowFirebaseAuth is true, also accepts Firebase Auth tokens
 * 
 * @param options - Validation options
 */
export function validateIn3dApiKey(options: ValidateApiKeyOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = (req as any).requestId;
    
    // If Firebase Auth is allowed and user is already authenticated, skip API key check
    if (options.allowFirebaseAuth && req.user?.uid) {
      console.log(`[${requestId}] Using Firebase Auth, skipping API key validation`);
      return next();
    }

    // Extract API key from headers
    let apiKey: string | undefined;

    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer in3d_live_')) {
      apiKey = authHeader.split('Bearer ')[1];
    }

    // Fall back to X-In3d-Key header
    if (!apiKey) {
      apiKey = req.headers['x-in3d-key'] as string;
    }

    // No API key provided
    if (!apiKey) {
      console.log(`[${requestId}] ❌ No API key provided`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Provide via Authorization: Bearer <key> or X-In3d-Key header',
        code: 401,
        requestId
      });
      return;
    }

    try {
      // Validate the API key
      const apiKeyUser = await validateApiKey(apiKey);

      if (!apiKeyUser) {
        console.log(`[${requestId}] ❌ Invalid or revoked API key`);
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or revoked API key',
          code: 401,
          requestId
        });
        return;
      }

      // Check required scope
      if (options.requiredScope && apiKeyUser.scope !== options.requiredScope) {
        if (options.requiredScope === ApiKeyScope.FULL && apiKeyUser.scope === ApiKeyScope.READ) {
          console.log(`[${requestId}] ❌ Insufficient scope: requires FULL, has READ`);
          res.status(403).json({
            error: 'Forbidden',
            message: 'This endpoint requires full access scope. Your API key has read-only access.',
            code: 403,
            requestId
          });
          return;
        }
      }

      // Check subscription tier
      if (options.requiredTiers && options.requiredTiers.length > 0) {
        if (!options.requiredTiers.includes(apiKeyUser.subscriptionTier)) {
          console.log(`[${requestId}] ❌ Insufficient tier: requires ${options.requiredTiers.join(', ')}, has ${apiKeyUser.subscriptionTier}`);
          res.status(403).json({
            error: 'Forbidden',
            message: `This endpoint requires one of the following subscription tiers: ${options.requiredTiers.join(', ')}. Your tier: ${apiKeyUser.subscriptionTier}`,
            code: 403,
            requestId
          });
          return;
        }
      }

      // Check credits
      if (options.requireCredits !== false && apiKeyUser.creditsRemaining <= 0) {
        console.log(`[${requestId}] ❌ No credits remaining`);
        res.status(429).json({
          error: 'Credits Exhausted',
          message: 'No credits remaining. Please upgrade your subscription or purchase more credits.',
          code: 429,
          requestId
        });
        return;
      }

      // Attach user info to request (set req.user for compatibility)
      req.apiKeyUser = apiKeyUser;
      req.user = {
        uid: apiKeyUser.userId,
        email: undefined,
        name: undefined
      };

      console.log(`[${requestId}] ✅ API key validated: ${apiKeyUser.userId}, scope: ${apiKeyUser.scope}, credits: ${apiKeyUser.creditsRemaining}`);

      next();
    } catch (error: any) {
      console.error(`[${requestId}] ❌ API key validation error:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate API key',
        code: 500,
        requestId
      });
    }
  };
}

/**
 * Simple middleware for read-only endpoints
 * Allows both API keys (READ or FULL scope) and Firebase Auth
 */
export const validateReadAccess = validateIn3dApiKey({
  requireCredits: false,
  allowFirebaseAuth: true
});

/**
 * Middleware for write/generation endpoints
 * Requires FULL scope API key or Firebase Auth
 */
export const validateFullAccess = validateIn3dApiKey({
  requiredScope: ApiKeyScope.FULL,
  requireCredits: true,
  allowFirebaseAuth: true
});

/**
 * Middleware for pro-tier endpoints
 * Requires FULL scope + pro tier API key or Firebase Auth
 */
export const validateProAccess = validateIn3dApiKey({
  requiredScope: ApiKeyScope.FULL,
  requiredTiers: ['pro', 'team', 'enterprise'],
  requireCredits: true,
  allowFirebaseAuth: true
});
