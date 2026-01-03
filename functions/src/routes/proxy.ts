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

router.get('/proxy-asset', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { url } = req.query;
  
  try {
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'URL parameter is required',
        requestId 
      });
    }

    console.log(`[${requestId}] Proxying asset request:`, url);

    // Decode the URL to handle double encoding issues
    const decodedUrl = decodeURIComponent(url);
    console.log(`[${requestId}] Decoded URL:`, decodedUrl);

    const response = await axios.get(decodedUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'In3D.ai-WebApp/1.0',
        'Accept': '*/*',
        'Accept-Encoding': 'identity', // Prevent compression issues
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    // Check if the response is an error (4xx status)
    if (response.status >= 400) {
      console.error(`[${requestId}] Asset proxy failed with status ${response.status}:`, response.statusText);
      
      // Try to get error message from response
      let errorMessage = `Failed to fetch asset: ${response.status} ${response.statusText}`;
      try {
        const errorData = await new Promise((resolve) => {
          let data = '';
          response.data.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          response.data.on('end', () => resolve(data));
        });
        if (errorData) {
          errorMessage += ` - ${errorData}`;
        }
      } catch (e) {
        // Ignore error reading error response
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

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
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
      details: error.message,
      requestId 
    });
  }
});

export default router;

