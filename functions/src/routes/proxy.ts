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

