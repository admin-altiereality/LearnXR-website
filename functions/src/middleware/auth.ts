/**
 * Authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/skybox/styles' },
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/env-check' },
  { method: 'POST', path: '/skybox/generate' },
  { method: 'GET', path: '/skybox/status' },
  { method: 'GET', path: '/skybox/history' },
  { method: 'POST', path: '/skybox/webhook' }, // Webhook endpoint - no auth required
  { method: 'POST', path: '/payment/create-order' },
  { method: 'POST', path: '/payment/verify' },
  { method: 'GET', path: '/subscription' },
  { method: 'POST', path: '/user/subscription-status' },
  { method: 'GET', path: '/proxy-asset' },
  { method: 'HEAD', path: '/proxy-asset' }
];

const isPublicEndpoint = (req: Request) => {
  let path = (req as any).normalizedPath || req.path.split('?')[0];
  
  if (path.startsWith('/api/')) {
    path = path.substring(4);
  } else if (path === '/api') {
    path = '/';
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  return PUBLIC_ENDPOINTS.some(
    ep => ep.method === req.method && (path === ep.path || path.startsWith(ep.path + '/'))
  );
};

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  
  if (isPublicEndpoint(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'AUTH_REQUIRED', 
      message: 'No token provided',
      requestId
    });
  }
  
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ 
      error: 'INVALID_TOKEN', 
      message: 'Invalid or expired token',
      requestId
    });
  }
};

