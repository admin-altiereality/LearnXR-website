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

// Save user geo info for payment routing
router.post('/geo-info', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId, country, countryName, provider, flag, source, confidence } = req.body;
  
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
        requestId
      });
    }
    
    console.log(`[${requestId}] Saving geo info for user:`, { userId, country, provider });
    
    const db = admin.firestore();
    await db.collection('user_geo_info').doc(userId).set({
      userId,
      country: country || 'US',
      countryName: countryName || 'United States',
      provider: provider || 'paddle',
      flag: flag || '🇺🇸',
      source: source || 'unknown',
      confidence: confidence || 'low',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return res.json({
      success: true,
      data: { message: 'Geo info saved successfully' },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error saving geo info:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save geo info',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Get user geo info
router.get('/geo-info/:userId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId } = req.params;
  
  try {
    console.log(`[${requestId}] Getting geo info for user:`, userId);
    
    const db = admin.firestore();
    const doc = await db.collection('user_geo_info').doc(userId).get();
    
    if (!doc.exists) {
      return res.json({
        success: true,
        data: null,
        requestId
      });
    }
    
    return res.json({
      success: true,
      data: doc.data(),
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error getting geo info:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get geo info',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export default router;

