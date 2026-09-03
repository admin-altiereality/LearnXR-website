/**
 * Cache-Control helpers for read-only API routes.
 *
 * Two rules govern everything here:
 *
 * 1. Only `GET`/`HEAD` and only successful responses are given a freshness
 *    lifetime. The header is attached at `writeHead` time rather than up front so
 *    that a route which falls over and answers 500 does not hand a cache an error
 *    to serve for the next five minutes.
 *
 * 2. `public` (which permits a *shared* cache such as the Hosting CDN to store the
 *    response) is only ever correct for routes mounted BEFORE `authenticateUser` in
 *    index.ts. Everything after that line is answered per-user, and marking such a
 *    response `public` would let one user's data be served to another. Those routes
 *    get `private`, which still gives the browser a full cache hit on revalidation
 *    while keeping the response out of any shared cache.
 */

import { NextFunction, Request, RequestHandler, Response } from 'express';

export interface CacheOptions {
  /** `private` = browser only (default). `public` = shared caches too; pre-auth routes only. */
  scope?: 'public' | 'private';
  /** Browser freshness, seconds. */
  maxAge: number;
  /** Shared-cache freshness, seconds. Ignored unless scope is `public`. */
  sMaxAge?: number;
  /** Seconds a stale response may be served while it revalidates in the background. */
  staleWhileRevalidate?: number;
}

function buildCacheControl(options: CacheOptions): string {
  const scope = options.scope ?? 'private';
  const parts = [scope, `max-age=${options.maxAge}`];

  if (scope === 'public' && typeof options.sMaxAge === 'number') {
    parts.push(`s-maxage=${options.sMaxAge}`);
  }
  if (typeof options.staleWhileRevalidate === 'number') {
    parts.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  return parts.join(', ');
}

/**
 * Middleware that marks a successful GET/HEAD response cacheable.
 *
 * A route that sets its own `Cache-Control` keeps it — this never overwrites.
 */
export function cacheable(options: CacheOptions): RequestHandler {
  const value = buildCacheControl(options);

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function patchedWriteHead(this: Response, statusCode: number, ...rest: unknown[]) {
      // 2xx and 304 only. A 3xx redirect, 4xx or 5xx must not inherit the lifetime.
      const cacheableStatus = (statusCode >= 200 && statusCode < 300) || statusCode === 304;
      if (cacheableStatus && !res.getHeader('Cache-Control')) {
        res.setHeader('Cache-Control', value);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalWriteHead as any)(statusCode, ...rest);
    } as typeof res.writeHead;

    return next();
  };
}

/** Explicitly opt a route out of caching (auth exchanges, launch tokens, anything one-shot). */
export const noStore: RequestHandler = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
