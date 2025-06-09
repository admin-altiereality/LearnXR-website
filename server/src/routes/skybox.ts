import { Router } from 'express';
import { BlockadeLabsSdk } from '@blockadelabs/sdk';
import { env } from '../config/env';

const router = Router();
const sdk = new BlockadeLabsSdk({ api_key: env.API_KEY });

// Get skybox styles with pagination
router.get('/getSkyboxStyles', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 9;
    
    const skyboxStyles = await sdk.getSkyboxStyles();
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedStyles = skyboxStyles.slice(startIndex, endIndex);
    const hasMore = endIndex < skyboxStyles.length;

    res.json({
      styles: paginatedStyles,
      hasMore,
      total: skyboxStyles.length
    });
  } catch (error) {
    console.error('Error fetching skybox styles:', error);
    res.status(500).json({ error: 'Failed to fetch skybox styles' });
  }
});

export default router; 