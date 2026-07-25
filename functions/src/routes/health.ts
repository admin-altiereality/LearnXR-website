/**
 * Health routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import { initializeServices, BLOCKADE_API_KEY, MESHY_API_KEY, razorpay } from '../utils/services';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/env-check', requireRole(['superadmin']), (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  initializeServices();

  res.json({
    status: 'ok',
    services: {
      firebase: true,
      blockadelabs: !!BLOCKADE_API_KEY,
      meshy: !!MESHY_API_KEY,
      razorpay: !!razorpay,
    },
    timestamp: new Date().toISOString(),
    requestId,
  });
});

router.get('/health', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  initializeServices();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId,
  });
});

export default router;
