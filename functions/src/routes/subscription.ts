/**
 * Subscription-related routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { initializeServices, razorpay } from '../utils/services';
import { getSecret } from '../utils/config';

const router = Router();

router.post('/create', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId, planId, planName, billingCycle, userEmail } = req.body;
  
  try {
    console.log(`[${requestId}] Creating subscription:`, { userId, planId, planName, billingCycle });
    
    initializeServices();
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    // Determine total_count based on billing cycle
    // For yearly plans, total_count should be 1 (one year), for monthly it's 12 (12 months)
    const totalCount = billingCycle === 'yearly' ? 1 : 12;
    
    // Create subscription with customer details if email is provided
    const subscriptionData: any = {
      plan_id: planId,
      customer_notify: 1,
      total_count: totalCount,
      notes: {
        userId,
        planName,
        billingCycle: billingCycle || 'monthly'
      }
    };
    
    // Add customer details if email is provided (helps with payment method selection)
    if (userEmail) {
      subscriptionData.customer = {
        email: userEmail
      };
    }
    
    const subscription = await razorpay.subscriptions.create(subscriptionData);
    
    const db = admin.firestore();
    await db.collection('subscriptions').doc(subscription.id).set({
      ...subscription,
      userId,
      planName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: subscription.status
    });
    
    console.log(`[${requestId}] Subscription created:`, subscription.id);
    console.log(`[${requestId}] Subscription status:`, subscription.status);
    console.log(`[${requestId}] Subscription auth_link:`, subscription.auth_link);
    
    return res.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        auth_link: subscription.auth_link, // Include auth_link for redirect-based checkout
        key_id: getSecret('RAZORPAY_KEY_ID')
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error creating subscription:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

router.get('/:subscriptionId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { subscriptionId } = req.params;
  
  try {
    console.log(`[${requestId}] Fetching subscription:`, subscriptionId);
    
    initializeServices();
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    const subscription = await razorpay.subscriptions.fetch(subscriptionId);
    
    return res.json({
      success: true,
      data: subscription,
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error fetching subscription:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export default router;

