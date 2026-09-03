/**
 * LinkedIn routes for company activity
 * Public endpoint - no authentication required
 */

import { Request, Response, Router } from 'express';
import { getLinkedInPosts } from '../services/linkedinService';
import { cacheable } from '../utils/cacheHeaders';

const router = Router();

// LinkedIn posts endpoint for company activity
// Public route (mounted before authenticateUser), identical for every caller, and
// backed by a slow RSS fetch — the one place here where a shared cache is correct.
router.get('/posts', cacheable({ scope: 'public', maxAge: 300, sMaxAge: 900 }), async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    console.log(`[${requestId}] 🔗 Fetching LinkedIn posts...`);
    const posts = await getLinkedInPosts();
    
    // Determine the source based on environment variables
    let source = 'unknown';
    if (process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_COMPANY_URN) {
      source = 'linkedin-api';
    } else {
      source = 'rss-feed';
    }
    
    console.log(`[${requestId}] ✅ Successfully fetched ${posts.length} posts from ${source}`);
    
    res.json({
      success: true,
      posts: posts,
      lastUpdated: new Date().toISOString(),
      source: source,
      count: posts.length
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] ❌ LinkedIn posts error:`, errorMessage);
    
    // Return error response instead of mock data
    res.status(500).json({
      success: false,
      error: 'Failed to fetch LinkedIn posts',
      message: errorMessage,
      requestId,
      hint: 'Please check LinkedIn API credentials or RSS feed configuration'
    });
  }
});

export default router;
