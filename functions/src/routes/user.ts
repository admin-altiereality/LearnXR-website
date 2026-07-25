/**
 * User-related routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { syncUserRoleClaim } from '../utils/syncUserRoleClaim';

const router = Router();

function getAuthenticatedUid(req: Request): string | null {
  return (req as any).user?.uid ?? null;
}

router.post('/subscription-status', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const userId = getAuthenticatedUid(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      requestId,
    });
  }
  
  try {
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
          subscription: null,
        },
        requestId,
      });
    }
    
    const subscriptionDoc = snapshot.docs[0].data();
    const subscription = {
      planId: subscriptionDoc.planId,
      planName: subscriptionDoc.planName,
      status: subscriptionDoc.status,
      provider: subscriptionDoc.provider,
      billingCycle: subscriptionDoc.billingCycle,
      currentPeriodEnd: subscriptionDoc.currentPeriodEnd,
    };
    
    return res.json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription,
      },
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Error checking subscription status:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check subscription status',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
  }
});

router.post('/sync-claims', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const userId = getAuthenticatedUid(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required', requestId });
  }

  try {
    const role = await syncUserRoleClaim(userId);
    return res.json({ success: true, data: { role }, requestId });
  } catch (error) {
    console.error(`[${requestId}] Error syncing role claims:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync role claims',
      requestId,
    });
  }
});

router.post('/geo-info', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const userId = getAuthenticatedUid(req);
  const { country, countryName, provider, flag, source, confidence } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required', requestId });
  }
  
  try {
    const db = admin.firestore();
    await db.collection('user_geo_info').doc(userId).set({
      userId,
      country: country || 'US',
      countryName: countryName || 'United States',
      provider: provider || 'paddle',
      flag: flag || '🇺🇸',
      source: source || 'unknown',
      confidence: confidence || 'low',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    return res.json({
      success: true,
      data: { message: 'Geo info saved successfully' },
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Error saving geo info:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save geo info',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
  }
});

router.get('/geo-info/:userId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const authenticatedUid = getAuthenticatedUid(req);
  const { userId } = req.params;

  if (!authenticatedUid) {
    return res.status(401).json({ success: false, error: 'Authentication required', requestId });
  }
  if (userId !== authenticatedUid) {
    return res.status(403).json({ success: false, error: 'Forbidden', requestId });
  }
  
  try {
    const db = admin.firestore();
    const doc = await db.collection('user_geo_info').doc(userId).get();
    
    if (!doc.exists) {
      return res.json({ success: true, data: null, requestId });
    }
    
    return res.json({ success: true, data: doc.data(), requestId });
  } catch (error) {
    console.error(`[${requestId}] Error getting geo info:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get geo info',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
  }
});

export default router;
