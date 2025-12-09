/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';

export const requestLogging = (req: Request, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(7);
  const originalPath = (req as any).originalPath || req.path;
  
  console.log(`[${requestId}] ${req.method} ${req.path} (original: ${originalPath})`, {
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined,
    headers: {
      'user-agent': req.headers['user-agent'],
      'authorization': req.headers.authorization ? 'Bearer ***' : 'none'
    }
  });
  
  (req as any).requestId = requestId;
  (req as any).normalizedPath = req.path;
  next();
};

