/**
 * User-related routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

router.post('/subscription-status', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId } = req.body;
  
  try {
    console.log(`[${requestId}] Checking subscription status for user:`, userId);
    
    const db = admin.firestore();
    const subscriptionsRef = db.collection('subscriptions');
    const snapshot = await subscriptionsRef
      .where('userId', '==', userId)
      .where('status', 'in', ['active', 'authenticated'])
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.json({
        success: true,
        data: {
          hasActiveSubscription: false,
          subscription: null
        },
        requestId
      });
    }
    
    const subscription = snapshot.docs[0].data();
    
    return res.json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error checking subscription status:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check subscription status',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export default router;

