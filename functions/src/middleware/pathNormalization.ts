/**
 * Path normalization middleware
 * Strips /api prefix from requests coming through Firebase Hosting rewrites
 */

import { Request, Response, NextFunction } from 'express';

export const pathNormalization = (req: Request, res: Response, next: NextFunction) => {
  // Store original path
  (req as any).originalPath = req.path;
  
  // Strip /api prefix if present (Firebase Hosting rewrites add it)
  if (req.path.startsWith('/api/')) {
    const newPath = req.path.substring(4); // Remove '/api'
    // Modify req.url which Express uses for routing
    req.url = req.url.replace(req.path, newPath);
    // Also update the path property
    Object.defineProperty(req, 'path', {
      get: () => newPath,
      configurable: true
    });
  }
  next();
};

