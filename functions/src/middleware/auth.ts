/**
 * Authentication middleware
 * ULTRA-PERMISSIVE for payment endpoints - checks raw URL
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Public endpoints that don't require authentication
const PUBLIC_PATHS = [
  '/skybox/styles',
  '/health',
  '/env-check',
  '/skybox/generate',
  '/skybox/status',
  '/skybox/history',
  '/skybox/webhook',
  '/payment/create-order',
  '/payment/verify',
  '/payment/detect-country',
  '/subscription/create',  // CRITICAL: Payment endpoint must be public
  '/subscription/verify-credentials',  // Credential verification endpoint
  '/subscription',
  '/user/subscription-status',
  '/proxy-asset',
  '/ai-detection/enhance',  // Allow prompt enhancement without auth
  '/ai-detection/detect',  // Allow AI detection without auth
  '/ai-detection/extract-assets',  // Allow asset extraction without auth
  '/assistant/create-thread',  // Allow assistant thread creation without auth
  '/assistant/message',  // Allow assistant messages without auth
  '/assistant/tts/generate',  // Allow TTS generation without auth
  '/assistant/lipsync/generate',  // Allow viseme generation without auth
  '/assistant/list',  // Allow listing assistants without auth
  '/linkedin/posts'  // Allow LinkedIn posts without auth (public company activity)
];

const isPublicEndpoint = (req: Request): boolean => {
  const requestId = (req as any).requestId;
  
  // Get the RAW original URL before any processing
  const rawUrl = req.originalUrl || req.url || '';
  const rawPath = req.path || '';
  
  // Check raw URL string directly (most reliable) - FIRST CHECK
  const urlString = (rawUrl || '').toLowerCase();
  const pathString = (rawPath || '').toLowerCase();
  
  // CRITICAL: Check for LinkedIn endpoints (BEFORE any normalization)
  // This catches /api/linkedin/posts, /linkedin/posts, etc.
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    const hasLinkedIn = urlString.includes('linkedin') || pathString.includes('linkedin');
    const hasPosts = urlString.includes('posts') || pathString.includes('posts');
    
    if (hasLinkedIn && hasPosts) {
      console.log(`[${requestId}] [AUTH] ✅ ALLOWING LinkedIn endpoint (raw URL/path check):`, {
        method: req.method,
        rawUrl,
        rawPath,
        urlString,
        pathString
      });
      return true; // EARLY RETURN - don't check anything else
    }
  }
  
  // CRITICAL: Check raw URL for subscription/create (BEFORE any normalization)
  // This catches /api/subscription/create, /subscription/create, etc.
  if (req.method === 'POST' || req.method === 'OPTIONS') {
    const hasSubscription = urlString.includes('subscription') || pathString.includes('subscription');
    const hasCreate = urlString.includes('create') || pathString.includes('create');
    
    if (hasSubscription && hasCreate) {
      console.log(`[${requestId}] [AUTH] ✅ ALLOWING (raw URL/path check):`, {
        rawUrl,
        rawPath,
        urlString,
        pathString
      });
      return true; // EARLY RETURN - don't check anything else
    }
    
    // CRITICAL: Check for ai-detection endpoints (BEFORE any normalization)
    const hasAiDetection = urlString.includes('ai-detection') || pathString.includes('ai-detection');
    const hasEnhance = urlString.includes('enhance') || pathString.includes('enhance');
    const hasDetect = urlString.includes('detect') || pathString.includes('detect');
    
    // Allow both /enhance and /detect endpoints
    if (hasAiDetection && (hasEnhance || hasDetect)) {
      console.log(`[${requestId}] [AUTH] ✅ ALLOWING ai-detection endpoint (raw URL/path check):`, {
        method: req.method,
        rawUrl,
        rawPath,
        urlString,
        pathString,
        endpoint: hasEnhance ? 'enhance' : 'detect'
      });
      return true; // EARLY RETURN - don't check anything else
    }
    
    // CRITICAL: Check for assistant endpoints (BEFORE any normalization)
    const hasAssistant = urlString.includes('assistant') || pathString.includes('assistant');
    if (hasAssistant) {
      console.log(`[${requestId}] [AUTH] ✅ ALLOWING assistant endpoint (raw URL/path check):`, {
        method: req.method,
        rawUrl,
        rawPath,
        urlString,
        pathString
      });
      return true; // EARLY RETURN - don't check anything else
    }
  }
  
  // Get ALL possible path representations
  const originalPath = (req as any).originalPath || '';
  const currentPath = req.path || '';
  const urlPath = req.url?.split('?')[0] || '';
  
  // Collect all path variations
  const allPaths = [
    originalPath,
    currentPath,
    urlPath,
    rawUrl.split('?')[0],
    // Also check with /api prefix removed
    originalPath.startsWith('/api/') ? originalPath.substring(4) : originalPath,
    currentPath.startsWith('/api/') ? currentPath.substring(4) : currentPath,
    urlPath.startsWith('/api/') ? urlPath.substring(4) : urlPath,
    rawUrl.startsWith('/api/') ? rawUrl.substring(4).split('?')[0] : rawUrl.split('?')[0]
  ].filter(Boolean) as string[];
  
  // Normalize all paths
  const normalizedPaths = allPaths.map(p => {
    let normalized = p.split('?')[0];
    if (normalized.startsWith('/api/')) {
      normalized = normalized.substring(4);
    }
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized;
  });
  
  // Remove duplicates
  const uniquePaths = [...new Set(normalizedPaths)];
  
  // CRITICAL: Check if ANY path variation matches subscription/create
  const isSubscriptionCreate = uniquePaths.some(path => {
    return path === '/subscription/create' || 
           path.endsWith('/subscription/create') ||
           (path.includes('subscription') && path.includes('create'));
  });
  
  // Debug logging
  console.log(`[${requestId}] [AUTH] Path analysis:`, {
    method: req.method,
    rawUrl,
    rawPath,
    originalPath,
    currentPath,
    urlPath,
    uniquePaths: uniquePaths.slice(0, 5), // Show first 5
    isSubscriptionCreate,
    willAllow: isSubscriptionCreate && req.method === 'POST'
  });
  
  // CRITICAL: Always allow POST to subscription/create
  if (req.method === 'POST' && isSubscriptionCreate) {
    console.log(`[${requestId}] [AUTH] ✅ EXPLICITLY ALLOWING subscription/create`);
    return true;
  }
  
  // CRITICAL: Always allow POST/OPTIONS to ai-detection endpoints
  const isAiDetectionEndpoint = uniquePaths.some(path => {
    return path === '/ai-detection/enhance' || 
           path === '/ai-detection/detect' ||
           path === '/ai-detection/extract-assets' ||
           path.endsWith('/ai-detection/enhance') ||
           path.endsWith('/ai-detection/detect') ||
           path.endsWith('/ai-detection/extract-assets') ||
           (path.includes('ai-detection') && (path.includes('enhance') || path.includes('detect') || path.includes('extract-assets')));
  });
  
  if ((req.method === 'POST' || req.method === 'OPTIONS' || req.method === 'GET') && isAiDetectionEndpoint) {
    console.log(`[${requestId}] [AUTH] ✅ EXPLICITLY ALLOWING ai-detection endpoint`);
    return true;
  }
  
  // CRITICAL: Always allow POST/OPTIONS/GET to assistant endpoints
  const isAssistantEndpoint = uniquePaths.some(path => {
    return path === '/assistant/create-thread' ||
           path === '/assistant/message' ||
           path === '/assistant/tts/generate' ||
           path === '/assistant/lipsync/generate' ||
           path === '/assistant/list' ||
           path.startsWith('/assistant/') ||
           (path.includes('assistant') && (path.includes('create-thread') || path.includes('message') || path.includes('tts') || path.includes('lipsync') || path.includes('list')));
  });
  
  if ((req.method === 'POST' || req.method === 'OPTIONS' || req.method === 'GET') && isAssistantEndpoint) {
    console.log(`[${requestId}] [AUTH] ✅ EXPLICITLY ALLOWING assistant endpoint`);
    return true;
  }
  
  // Check if any normalized path matches public endpoints
  const isPublic = uniquePaths.some(normalizedPath => {
    return PUBLIC_PATHS.some(publicPath => {
      return normalizedPath === publicPath || normalizedPath.startsWith(publicPath + '/');
    });
  });
  
  if (isPublic) {
    console.log(`[${requestId}] [AUTH] ✅ Public endpoint allowed`);
    return true;
  }
  
  console.log(`[${requestId}] [AUTH] ❌ Endpoint requires authentication`);
  return false;
};

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  
  // Always allow OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] [AUTH] ✅ Allowing OPTIONS request (CORS preflight)`);
    return next();
  }
  
  // Check for authentication token
  const authHeader = req.headers.authorization;
  const in3dKeyHeader = req.headers['x-in3d-key'] as string;
  const isPublic = isPublicEndpoint(req);
  
  // Check if we have any form of authentication
  const hasAuthHeader = authHeader?.startsWith('Bearer ');
  const hasIn3dKey = in3dKeyHeader && in3dKeyHeader.startsWith('in3d_live_');
  const hasAnyAuth = hasAuthHeader || hasIn3dKey;
  
  // If no auth is provided
  if (!hasAnyAuth) {
    // For public endpoints, allow without auth
    if (isPublic) {
      console.log(`[${requestId}] [AUTH] ✅ Public endpoint, no auth required`);
      return next();
    }
    
    // For protected endpoints, require auth
    // Use standardized error response format for n8n compatibility
    console.log(`[${requestId}] [AUTH] ❌ No auth token provided - BLOCKING`);
    console.log(`[${requestId}] [AUTH] Request details:`, {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      url: req.url,
      originalPath: (req as any).originalPath
    });
    
    const { errorResponse, ErrorCode, HTTP_STATUS } = require('../utils/apiResponse');
    const { statusCode, response } = errorResponse(
      'Authentication required',
      'No token provided. Use Authorization: Bearer <token> or X-In3d-Key: <key> header',
      ErrorCode.AUTH_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
  
  // If X-In3d-Key is provided, let validateIn3dApiKey handle it
  if (hasIn3dKey && !hasAuthHeader) {
    console.log(`[${requestId}] [AUTH] 🔑 X-In3d-Key header detected, allowing validateIn3dApiKey to handle authentication`);
    return next();
  }
  
  // Auth header is provided - verify token (even for public endpoints)
  // This allows validateReadAccess/validateFullAccess to use Firebase Auth
  const token = authHeader!.split('Bearer ')[1];
  
  // Check if it's an In3D API key (starts with in3d_live_)
  // If so, don't try to verify as Firebase token - let validateIn3dApiKey handle it
  if (token.startsWith('in3d_live_')) {
    console.log(`[${requestId}] [AUTH] 🔑 In3D API key detected in Authorization header, skipping Firebase token verification`);
    // Allow to proceed - validateIn3dApiKey will handle validation
    return next();
  }
  
  // It's a Firebase token - verify it
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    console.log(`[${requestId}] [AUTH] ✅ Firebase token verified, user: ${decoded.uid}`);
    next();
  } catch (err) {
    // Token verification failed
    // For public endpoints, still allow (but without req.user set)
    // This allows endpoints that truly don't need auth to work
    if (isPublic) {
      console.log(`[${requestId}] [AUTH] ⚠️ Firebase token verification failed for public endpoint, allowing without auth:`, err);
      return next();
    }
    
    // For protected endpoints, block the request
    // Use standardized error response format for n8n compatibility
    console.error(`[${requestId}] [AUTH] ❌ Token verification failed:`, err);
    const { errorResponse, ErrorCode, HTTP_STATUS } = require('../utils/apiResponse');
    const { statusCode, response } = errorResponse(
      'Invalid token',
      'Invalid or expired token',
      ErrorCode.INVALID_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      { requestId }
    );
    return res.status(statusCode).json(response);
  }
};
