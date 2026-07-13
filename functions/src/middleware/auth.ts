/**
 * Authentication middleware — strict public-endpoint allowlist.
 */

import { NextFunction, Request, Response } from 'express';
import * as admin from 'firebase-admin';

type PublicRoute = { method: string; path: string };

const PUBLIC_ROUTES: PublicRoute[] = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/skybox/styles' },
  { method: 'POST', path: '/skybox/webhook' },
  { method: 'POST', path: '/payment/verify' },
  { method: 'POST', path: '/payment/detect-country' },
  { method: 'POST', path: '/leads' },
  { method: 'POST', path: '/partners/register' },
  { method: 'POST', path: '/reports/lead' },
  { method: 'GET', path: '/linkedin/posts' },
  { method: 'GET', path: '/proxy-asset' },
];

function normalizePath(rawPath: string): string {
  let path = rawPath.split('?')[0] || '/';
  if (path.startsWith('/api/')) path = path.substring(4);
  if (path.startsWith('/api')) path = path.substring(4) || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  return path.replace(/\/+$/, '') || '/';
}

function collectPaths(req: Request): string[] {
  const candidates = [
    req.path,
    req.url?.split('?')[0],
    req.originalUrl?.split('?')[0],
    (req as any).originalPath,
  ].filter(Boolean) as string[];

  return [...new Set(candidates.map(normalizePath))];
}

const isPublicEndpoint = (req: Request): boolean => {
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') return true;

  const paths = collectPaths(req);
  return PUBLIC_ROUTES.some(({ method: allowedMethod, path: publicPath }) => {
    if (method !== allowedMethod) return false;
    return paths.some(
      (candidate) =>
        candidate === publicPath ||
        candidate.endsWith(publicPath) ||
        candidate.startsWith(`${publicPath}/`),
    );
  });
};

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;

  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const in3dKeyHeader = req.headers['x-in3d-key'] as string;
  const isPublic = isPublicEndpoint(req);
  const hasAuthHeader = authHeader?.startsWith('Bearer ');
  const hasIn3dKey = Boolean(in3dKeyHeader?.startsWith('in3d_live_'));
  const hasAnyAuth = hasAuthHeader || hasIn3dKey;

  if (!hasAnyAuth) {
    if (isPublic) return next();

    const { errorResponse, ErrorCode, HTTP_STATUS } = require('../utils/apiResponse');
    const { statusCode, response } = errorResponse(
      'Authentication required',
      'No token provided. Use Authorization: Bearer <token> or X-In3d-Key: <key> header',
      ErrorCode.AUTH_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      { requestId },
    );
    return res.status(statusCode).json(response);
  }

  if (hasIn3dKey && !hasAuthHeader) {
    return next();
  }

  const token = authHeader!.split('Bearer ')[1];
  if (token.startsWith('in3d_live_')) {
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    if (isPublic) {
      console.warn(`[${requestId}] Invalid token on public endpoint; continuing without user`);
      return next();
    }

    const { errorResponse, ErrorCode, HTTP_STATUS } = require('../utils/apiResponse');
    const { statusCode, response } = errorResponse(
      'Invalid token',
      'Invalid or expired token',
      ErrorCode.INVALID_TOKEN,
      HTTP_STATUS.UNAUTHORIZED,
      { requestId },
    );
    return res.status(statusCode).json(response);
  }
};

export { isPublicEndpoint };
