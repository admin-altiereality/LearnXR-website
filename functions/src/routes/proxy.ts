/**
 * Proxy routes for external assets
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Handle CORS preflight requests
router.options('/proxy-asset', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});
router.options('/proxy-asset/model.glb', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});
router.options('/proxy-asset/model.gltf', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});
router.options('/api/proxy-asset/model.glb', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});
router.options('/api/proxy-asset/model.gltf', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.status(204).send();
});

async function handleProxyAsset(req: Request, res: Response, contentTypeOverride?: string): Promise<void> {
  const requestId = (req as any).requestId;
  const { url } = req.query;

  try {
    if (!url || typeof url !== 'string') {
      res.status(400).json({
        error: 'URL parameter is required',
        requestId,
      });
      return;
    }

    console.log(`[${requestId}] Proxying asset request:`, url);
    const decodedUrl = decodeURIComponent(url);
    console.log(`[${requestId}] Decoded URL:`, decodedUrl);

    const response = await axios.get(decodedUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'In3D.ai-WebApp/1.0',
        Accept: '*/*',
        'Accept-Encoding': 'identity',
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (response.status >= 400) {
      console.error(`[${requestId}] Asset proxy failed with status ${response.status}:`, response.statusText);
      const contentType = response.headers['content-type'] || '';
      const isTextContent = contentType.includes('text/') || contentType.includes('application/json');
      let errorMessage = `Failed to fetch asset: ${response.status} ${response.statusText}`;
      if (isTextContent) {
        try {
          const errorData = await new Promise<string>((resolve) => {
            let data = '';
            response.data.on('data', (chunk: Buffer) => {
              if (data.length < 1000) {
                data += chunk.toString('utf8', 0, Math.min(chunk.length, 1000 - data.length));
              }
            });
            response.data.on('end', () => resolve(data));
          });
          if (errorData.trim().startsWith('{') || errorData.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(errorData);
              if (parsed.error || parsed.message) {
                errorMessage += ` - ${parsed.error || parsed.message}`;
              }
            } catch {
              if (errorData.length < 200) errorMessage += ` - ${errorData}`;
            }
          } else if (errorData.length < 200) {
            errorMessage += ` - ${errorData}`;
          }
        } catch (e) {
          console.warn(`[${requestId}] Could not read error response:`, e);
        }
      } else {
        console.warn(`[${requestId}] Error response is binary (${contentType}), not parsing`);
      }
      res.status(response.status).json({
        error: errorMessage,
        requestId,
        originalUrl: decodedUrl.substring(0, 100) + '...',
      });
      return;
    }

    if (!response.data) {
      console.error(`[${requestId}] Asset proxy failed: No data received`);
      res.status(500).json({
        error: 'Failed to fetch asset: No data received',
        requestId,
      });
      return;
    }

    const contentType =
      contentTypeOverride ||
      response.headers['content-type'] ||
      'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    response.data.pipe(res);
    console.log(`[${requestId}] Asset proxy successful`);
  } catch (error: any) {
    console.error(`[${requestId}] Asset proxy error:`, error);
    if (error.response) {
      res.status(error.response.status).json({
        error: `Failed to fetch asset: ${error.response.status} ${error.response.statusText}`,
        requestId,
      });
      return;
    }
    res.status(500).json({
      error: 'Internal server error during asset proxy',
      details: error.message,
      requestId,
    });
  }
}

router.get('/proxy-asset', (req, res) => handleProxyAsset(req, res));
// Krpano Three.js plugin detects format from URL path; path must end in .glb/.gltf. Force
// Content-Type so the plugin and loaders accept the response even if upstream returns wrong type.
router.get('/proxy-asset/model.glb', (req, res) =>
  handleProxyAsset(req, res, 'model/gltf-binary'),
);
router.get('/proxy-asset/model.gltf', (req, res) =>
  handleProxyAsset(req, res, 'model/gltf+json'),
);
// Client calls .../api/proxy-asset/model.glb; some runtimes pass path with /api prefix before normalization.
router.get('/api/proxy-asset/model.glb', (req, res) =>
  handleProxyAsset(req, res, 'model/gltf-binary'),
);
router.get('/api/proxy-asset/model.gltf', (req, res) =>
  handleProxyAsset(req, res, 'model/gltf+json'),
);

export default router;

