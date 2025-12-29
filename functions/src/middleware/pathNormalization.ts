/**
 * Path normalization middleware
 * Strips /api prefix from requests coming through Firebase Hosting rewrites
 */

import { Request, Response, NextFunction } from 'express';

export const pathNormalization = (req: Request, res: Response, next: NextFunction) => {
  // Store original path and URL
  (req as any).originalPath = req.path;
  (req as any).originalUrl = req.url;
  
  // Strip /api prefix if present (Firebase Hosting rewrites add it)
  if (req.path.startsWith('/api/')) {
    const newPath = req.path.substring(4); // Remove '/api'
    const newUrl = req.url.replace(req.path, newPath);
    
    // Update req.url which Express uses for routing
    req.url = newUrl;
    
    // Override the path property
    Object.defineProperty(req, 'path', {
      get: () => newPath,
      configurable: true,
      enumerable: true
    });
    
    console.log(`[PATH_NORM] Normalized: ${(req as any).originalPath} -> ${newPath}`);
  }
  
  next();
};
