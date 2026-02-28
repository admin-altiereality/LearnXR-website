/**
 * Proxy routes for external assets
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import axios from 'axios';
import { isProxyAssetUrlAllowed } from '../utils/proxyAssetValidation';

const router = Router();

/** Decode path-safe base64url (from getProxyAssetUrlForThreejs) back to target URL */
function decodeProxyAssetEncoded(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return decodeURIComponent(decoded);
  } catch {
    return null;
  }
}

// Handle CORS preflight requests
router.options('/proxy-asset', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});

// Path-based proxy for krpano Three.js: URL must end in .glb so plugin accepts it. Target URL is in path.
// Use regex so long base64 segment is matched reliably; also match /api/proxy-asset/... if path not normalized yet.
const pathProxyGlbRegex = /^\/(?:api\/)?proxy-asset\/([^/]+)\/model\.glb\/?$/;
const pathProxyGlbExtract = /proxy-asset\/([^/]+)\/model\.glb/;

// CORS preflight for path-based proxy (e.g. OPTIONS /proxy-asset/xxx/model.glb)
router.options(pathProxyGlbRegex, (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});

router.get(pathProxyGlbRegex, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;

  const send502 = (details: string) => {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Upstream asset unavailable',
        details,
        requestId,
        code: 'UPSTREAM_ERROR',
      });
    }
  };

  try {
    // Use normalized path first, then original (path normalization may strip /api)
    const pathStr = req.path || (req as any).originalPath || req.url || '';
    const pathMatch = pathStr.match(pathProxyGlbExtract);
    const encoded = pathMatch ? pathMatch[1] : '';
    const targetUrl = decodeProxyAssetEncoded(encoded);
    if (!targetUrl) {
      res.status(400).json({ error: 'Invalid encoded URL in path', requestId });
      return;
    }
    if (!isProxyAssetUrlAllowed(targetUrl)) {
      res.status(400).json({ error: 'URL not allowed for proxy', requestId });
      return;
    }

    console.log(`[${requestId}] Proxying asset (path-based):`, targetUrl.substring(0, 120) + (targetUrl.length > 120 ? '...' : ''));
    const origin = (req.get('origin') || req.get('referer') || '').replace(/\/$/, '') || 'https://learnxr-evoneuralai.web.app';
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Referer': origin + '/',
    };

    let response;
    try {
      response = await axios.get(targetUrl, {
        responseType: 'stream',
        headers: fetchHeaders,
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: () => true, // accept all statuses so we can handle 4xx/5xx without throw
      });
    } catch (axiosErr: any) {
      const upstreamStatus = axiosErr?.response?.status;
      const code = axiosErr?.code;
      const msg = axiosErr?.message || 'Unknown error';
      console.error(`[${requestId}] Asset proxy (path) upstream request failed: status=${upstreamStatus} code=${code} message=${msg}`);
      send502(upstreamStatus ? `Upstream returned ${upstreamStatus}` : msg);
      return;
    }

    if (response.status >= 400) {
      console.error(`[${requestId}] Asset proxy (path) upstream returned:`, response.status, response.statusText);
      const message = response.status === 404
        ? 'Upstream URL returned 404; signed asset URLs may have expired.'
        : `Upstream returned ${response.status}`;
      send502(message);
      return;
    }
    if (!response.data) {
      console.error(`[${requestId}] Asset proxy (path) upstream returned no data`);
      send502('No data received');
      return;
    }

    let contentType = response.headers['content-type'] || '';
    if (!contentType) contentType = 'model/gltf-binary';
    else if (contentType === 'application/octet-stream') contentType = 'model/gltf-binary';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    response.data.on('error', (err: Error) => {
      console.error(`[${requestId}] Asset proxy (path) stream error:`, err?.message || err);
      try { res.destroy(); } catch (_) { /* ignore */ }
    });
    res.on('error', (err: Error) => {
      console.error(`[${requestId}] Asset proxy (path) response stream error:`, err?.message || err);
    });
    response.data.pipe(res);
    console.log(`[${requestId}] Asset proxy (path) successful`);
  } catch (error: any) {
    const upstreamStatus = error?.response?.status;
    const code = error?.code;
    const msg = error?.message || 'Unknown error';
    console.error(`[${requestId}] Asset proxy (path) error: status=${upstreamStatus} code=${code} message=${msg}`);
    send502(upstreamStatus ? `Upstream returned ${upstreamStatus}` : msg);
  }
});

router.get('/proxy-asset', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  let urlParam = req.query.url;
  // Some query parsers split on & and break signed URLs; use raw query if parsed value looks truncated
  if (typeof urlParam !== 'string' || (urlParam.includes('assets.meshy.ai') && !urlParam.includes('Key-Pair-Id') && req.originalUrl?.includes('url='))) {
    const raw = req.originalUrl || '';
    const match = raw.match(/[?&]url=([^&]+(?:\&(?:Key-Pair-Id|Signature|Policy)=[^&]*)*)/);
    if (match && match[1]) {
      urlParam = match[1]; // may still be encoded
    }
  }
  const url = typeof urlParam === 'string' ? urlParam : '';

  try {
    if (!url) {
      return res.status(400).json({
        error: 'URL parameter is required',
        requestId
      });
    }

    // Decode until stable so single- or double-encoded query params (e.g. signed URLs with &) work
    let decodedUrl = url;
    let prev = '';
    while (prev !== decodedUrl) {
      prev = decodedUrl;
      try {
        decodedUrl = decodeURIComponent(decodedUrl);
      } catch {
        break;
      }
    }
    if (!isProxyAssetUrlAllowed(decodedUrl)) {
      return res.status(400).json({
        error: 'URL not allowed for proxy',
        requestId
      });
    }
    console.log(`[${requestId}] Proxying asset request:`, decodedUrl.substring(0, 120) + (decodedUrl.length > 120 ? '...' : ''));

    // Use app origin as Referer so origins that check it (e.g. Meshy CDN) allow the request
    const origin = (req.get('origin') || req.get('referer') || '').replace(/\/$/, '') || 'https://learnxr-evoneuralai.web.app';
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Referer': origin + '/',
    };

    const response = await axios.get(decodedUrl, {
      responseType: 'stream',
      headers: fetchHeaders,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true, // accept all so we handle 4xx/5xx without throw; always return 502 for upstream errors
    });

    // Upstream 4xx/5xx: return 502 so client never sees 500 from our proxy
    if (response.status >= 400) {
      console.error(`[${requestId}] Asset proxy upstream returned ${response.status}:`, response.statusText);
      if (!res.headersSent) {
        return res.status(502).json({
          error: 'Upstream asset unavailable',
          details: response.status === 404
            ? 'Upstream URL returned 404; signed asset URLs may have expired.'
            : `Upstream returned ${response.status}`,
          requestId,
          code: 'UPSTREAM_ERROR',
        });
      }
      return;
    }

    if (!response.data) {
      console.error(`[${requestId}] Asset proxy upstream returned no data`);
      return res.status(502).json({ 
        error: 'Upstream asset unavailable',
        details: 'No data received',
        requestId 
      });
    }

    let contentType = response.headers['content-type'] || 'application/octet-stream';
    // Ensure GLB/GLTF is recognized (some origins return application/octet-stream)
    if (contentType === 'application/octet-stream' && /\.glb(\?|$)/i.test(decodedUrl)) {
      contentType = 'model/gltf-binary';
    } else if (contentType === 'application/octet-stream' && /\.gltf(\?|$)/i.test(decodedUrl)) {
      contentType = 'model/gltf+json';
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    response.data.pipe(res);
    
    console.log(`[${requestId}] Asset proxy successful`);
    return;
  } catch (error: any) {
    const upstreamStatus = error?.response?.status;
    console.error(`[${requestId}] Asset proxy error:`, error?.message || error, 'upstreamStatus=', upstreamStatus);
    if (res.headersSent) return;
    const details = error?.response ? `Upstream returned ${error.response.status}` : (error?.message || 'Request failed');
    return res.status(502).json({
      error: 'Upstream asset unavailable',
      details,
      requestId,
    });
  }
});

export default router;

