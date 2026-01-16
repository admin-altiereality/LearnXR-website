/**
 * In3D API Key Validation Middleware
 * Validates API keys for external API access
 */

import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/apiKeyService';
import { ValidatedApiKeyUser, ApiKeyScope } from '../types/apiKey';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKeyUser?: ValidatedApiKeyUser;
    }
  }
}

interface ValidateApiKeyOptions {
  requiredScope?: ApiKeyScope;
  requireCredits?: boolean;
  requiredTiers?: string[];
}

/**
 * Middleware to validate In3D API keys
 * 
 * Reads API key from:
 * 1. Authorization: Bearer <key>
 * 2. X-In3d-Key: <key>
 * 
 * @param options - Validation options
 */
export function validateIn3dApiKey(options: ValidateApiKeyOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Provide via Authorization: Bearer <key> or X-In3d-Key header',
        code: 401
      });
      return;
    }

    try {
      // Validate the API key
      const apiKeyUser = await validateApiKey(apiKey);

      if (!apiKeyUser) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or revoked API key',
          code: 401
        });
        return;
      }

      // Check required scope
      if (options.requiredScope && apiKeyUser.scope !== options.requiredScope) {
        if (options.requiredScope === ApiKeyScope.FULL && apiKeyUser.scope === ApiKeyScope.READ) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'This endpoint requires full access scope. Your API key has read-only access.',
            code: 403
          });
          return;
        }
      }

      // Check subscription tier
      if (options.requiredTiers && options.requiredTiers.length > 0) {
        if (!options.requiredTiers.includes(apiKeyUser.subscriptionTier)) {
          res.status(403).json({
            error: 'Forbidden',
            message: `This endpoint requires one of the following subscription tiers: ${options.requiredTiers.join(', ')}. Your tier: ${apiKeyUser.subscriptionTier}`,
            code: 403
          });
          return;
        }
      }

      // Check credits
      if (options.requireCredits !== false && apiKeyUser.creditsRemaining <= 0) {
        res.status(429).json({
          error: 'Credits Exhausted',
          message: 'No credits remaining. Please upgrade your subscription or purchase more credits.',
          code: 429
        });
        return;
      }

      // Attach user info to request
      req.apiKeyUser = apiKeyUser;

      next();
    } catch (error: any) {
      console.error('API key validation error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to validate API key',
        code: 500
      });
    }
  };
}

/**
 * Simple middleware for read-only endpoints
 */
export const validateReadAccess = validateIn3dApiKey({
  requireCredits: false
});

/**
 * Middleware for write/generation endpoints
 */
export const validateFullAccess = validateIn3dApiKey({
  requiredScope: ApiKeyScope.FULL,
  requireCredits: true
});

/**
 * Middleware for pro-tier endpoints
 */
export const validateProAccess = validateIn3dApiKey({
  requiredScope: ApiKeyScope.FULL,
  requiredTiers: ['pro', 'team', 'enterprise'],
  requireCredits: true
});
