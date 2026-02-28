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
  try {
    console.log(`[${requestId}] Proxying asset (path-based):`, targetUrl.substring(0, 120) + (targetUrl.length > 120 ? '...' : ''));
    const origin = (req.get('origin') || req.get('referer') || '').replace(/\/$/, '') || 'https://learnxr-evoneuralai.web.app';
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Referer': origin + '/',
    };
    const response = await axios.get(targetUrl, {
      responseType: 'stream',
      headers: fetchHeaders,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
    if (response.status >= 400) {
      console.error(`[${requestId}] Asset proxy (path) upstream returned:`, response.status, response.statusText);
      const message = response.status === 404
        ? 'Upstream URL returned 404; signed asset URLs may have expired.'
        : `Failed to fetch asset: ${response.status} ${response.statusText}`;
      res.status(response.status).json({
        error: message,
        requestId,
        code: 'UPSTREAM_ERROR',
      });
      return;
    }
    if (!response.data) {
      res.status(500).json({ error: 'No data received', requestId });
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
    response.data.pipe(res);
    console.log(`[${requestId}] Asset proxy (path) successful`);
  } catch (error: any) {
    console.error(`[${requestId}] Asset proxy (path) error:`, error);
    res.status(500).json({
      error: error?.response ? `Failed to fetch asset: ${error.response.status}` : 'Internal server error',
      requestId,
    });
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
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    // Check if the response is an error (4xx status)
    if (response.status >= 400) {
      console.error(`[${requestId}] Asset proxy failed with status ${response.status}:`, response.statusText);
      
      // Check content type to determine if we should try to parse as text/JSON
      const contentType = response.headers['content-type'] || '';
      const isTextContent = contentType.includes('text/') || contentType.includes('application/json');
      
      // Try to get error message from response (only for text/JSON content)
      let errorMessage = `Failed to fetch asset: ${response.status} ${response.statusText}`;
      if (isTextContent) {
        try {
          const errorData = await new Promise<string>((resolve) => {
            let data = '';
            response.data.on('data', (chunk: Buffer) => { 
              // Only read first 1000 bytes to avoid memory issues
              if (data.length < 1000) {
                data += chunk.toString('utf8', 0, Math.min(chunk.length, 1000 - data.length));
              }
            });
            response.data.on('end', () => resolve(data));
          });
          
          // Try to parse as JSON if it looks like JSON
          if (errorData.trim().startsWith('{') || errorData.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(errorData);
              if (parsed.error || parsed.message) {
                errorMessage += ` - ${parsed.error || parsed.message}`;
              }
            } catch {
              // Not valid JSON, use as-is if it's reasonable length
              if (errorData.length < 200) {
                errorMessage += ` - ${errorData}`;
              }
            }
          } else if (errorData.length < 200) {
            errorMessage += ` - ${errorData}`;
          }
        } catch (e) {
          // Ignore error reading error response
          console.warn(`[${requestId}] Could not read error response:`, e);
        }
      } else {
        // Binary content (image, etc.) - don't try to parse, just return generic error
        console.warn(`[${requestId}] Error response is binary (${contentType}), not parsing`);
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        requestId,
        originalUrl: decodedUrl.substring(0, 100) + '...' // Log first 100 chars for debugging
      });
    }

    if (!response.data) {
      console.error(`[${requestId}] Asset proxy failed: No data received`);
      return res.status(500).json({ 
        error: 'Failed to fetch asset: No data received',
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
    console.error(`[${requestId}] Asset proxy error:`, error);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: `Failed to fetch asset: ${error.response.status} ${error.response.statusText}`,
        requestId 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error during asset proxy',
      requestId 
    });
  }
});

export default router;

