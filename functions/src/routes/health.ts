/**
 * Health and environment check routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import { initializeServices, BLOCKADE_API_KEY, razorpay } from '../utils/services';
import { getSecret } from '../utils/config';

const router = Router();

router.get('/env-check', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  console.log(`[${requestId}] Environment check requested`);
  
  initializeServices();
  
  res.json({
    environment: 'production',
    firebase: true,
    blockadelabs: !!BLOCKADE_API_KEY,
    razorpay: !!razorpay,
    env_debug: {
      blockadelabs_key_length: BLOCKADE_API_KEY?.length || 0,
      razorpay_key_length: getSecret('RAZORPAY_KEY_ID').length,
      razorpay_secret_length: getSecret('RAZORPAY_KEY_SECRET').length
    },
    timestamp: new Date().toISOString(),
    requestId
  });
});

router.get('/health', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  // Initialize services to ensure secrets are loaded
  initializeServices();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: true,
      blockadelabs: !!BLOCKADE_API_KEY,
      razorpay: !!razorpay
    },
    env_debug: {
      blockadelabs_key_length: BLOCKADE_API_KEY?.length || 0,
      razorpay_key_length: getSecret('RAZORPAY_KEY_ID').length,
      razorpay_secret_length: getSecret('RAZORPAY_KEY_SECRET').length
    },
    requestId
  });
});

export default router;

