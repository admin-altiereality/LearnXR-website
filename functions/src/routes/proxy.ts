/**
 * Proxy routes for external assets
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import axios from 'axios';

const router = Router();

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

    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'In3D.ai-WebApp/1.0',
      },
      timeout: 30000,
    });

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

