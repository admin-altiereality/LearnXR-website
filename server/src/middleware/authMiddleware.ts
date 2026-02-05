/**
 * Firebase Auth Middleware
 * Verifies Firebase ID tokens for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { getAdminApp } from '../config/firebase-admin';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

/**
 * Middleware to verify Firebase ID token
 */
export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      code: 401
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const adminApp = getAdminApp();
    if (!adminApp) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service not available. Ensure Firebase Admin is configured (service account JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env).',
        code: 503
      });
      return;
    }

    const decodedToken = await admin.auth(adminApp).verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };

    next();
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      code: 401
    });
  }
}
