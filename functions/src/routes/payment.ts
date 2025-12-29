/**
 * Payment-related routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { initializeServices, razorpay } from '../utils/services';
import { getSecret } from '../utils/config';

const router = Router();

router.post('/create-order', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { amount, currency = 'INR', receipt, notes, userId } = req.body;
  
  try {
    console.log(`[${requestId}] Creating payment order:`, { amount, currency, userId });
    
    initializeServices();
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    const options = {
      amount: amount,
      currency,
      receipt,
      notes: { ...notes, userId }
    };
    
    const order = await razorpay.orders.create(options);

    const db = admin.firestore();
    await db.collection('orders').doc(order.id).set({
      ...order,
      userId: userId || (req as any).user?.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'created'
    });

    console.log(`[${requestId}] Order created:`, order.id);

    return res.json({
      success: true,
      data: {
        id: order.id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: getSecret('RAZORPAY_KEY_ID')
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error creating payment order:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment order',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;
  
  try {
    console.log(`[${requestId}] Verifying payment:`, { 
      razorpay_order_id, 
      razorpay_payment_id,
      hasUserId: !!userId,
      hasPlanId: !!planId
    });
    
    const secret = getSecret('RAZORPAY_KEY_SECRET');
    if (!secret) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      console.error(`[${requestId}] Signature mismatch`);
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
        requestId
      });
    }
    
    // Update order status
    const db = admin.firestore();
    await db.collection('orders').doc(razorpay_order_id).update({
      status: 'paid',
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[${requestId}] Payment verified successfully`);
    
    return res.json({
      success: true,
      data: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        status: 'verified'
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error verifying payment:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Detect country endpoint (for payment provider selection)
router.get('/detect-country', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    // Get country from headers (Cloudflare/Firebase Hosting may provide this)
    const country = req.headers['cf-ipcountry'] || 
                   req.headers['x-country-code'] || 
                   req.headers['x-vercel-ip-country'] ||
                   'IN'; // Default to India for Razorpay
    
    // Also try to get from IP if available
    const ip = req.ip || 
               (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.socket.remoteAddress;
    
    console.log(`[${requestId}] Country detection:`, { country, ip });
    
    return res.json({
      success: true,
      data: {
        country: country as string,
        ip: ip,
        provider: country === 'IN' ? 'razorpay' : 'paddle' // Default logic
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error detecting country:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect country',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export default router;

