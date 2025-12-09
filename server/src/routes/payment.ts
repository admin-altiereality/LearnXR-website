import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';
import Razorpay from 'razorpay';
import { db, isFirebaseInitialized } from '../config/firebase-admin';

dotenv.config();

const router = express.Router();

console.log('Payment routes being initialized...');

// Check if Razorpay credentials are available
const hasRazorpayCredentials = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;

// Initialize Razorpay only if credentials are available
let razorpay: Razorpay | null = null;
if (hasRazorpayCredentials) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!
  });
  console.log('Razorpay initialized with key_id: Present');
} else {
  console.log('Razorpay not initialized - missing credentials');
}

// Debug middleware for payment routes
router.use((req, res, next) => {
  console.log('Payment route received request:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    body: req.body,
    headers: req.headers
  });
  next();
});

// Create order endpoint
router.post('/create-order', async (req, res) => {
  try {
    // Check if Razorpay is configured
    if (!hasRazorpayCredentials || !razorpay) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    const { amount, currency, planId } = req.body;
    
    // Validate required fields
    if (!amount || !currency || !planId) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Amount, currency, and planId are required'
      });
    }

    // Convert amount to paise and validate
    const amountInPaise = parseInt(amount);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid amount'
      });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: planId
      }
    });

    // Return the order details
    res.json({
      success: true,
      status: 'success',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create order'
    });
  }
});

// Shared verify payment handler so we can support both /verify and /verify-payment
const verifyPaymentHandler = async (req: express.Request, res: express.Response) => {
  try {
    // Check if Razorpay is configured
    if (!hasRazorpayCredentials) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Missing required payment verification data'
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update subscription in Firestore
      if (userId && planId && isFirebaseInitialized() && db) {
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const subscriptionData = {
          planId,
          status: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id
        };
        await subscriptionRef.set(subscriptionData, { merge: true });
      } else if (userId && planId) {
        console.warn('⚠️  Firebase not available - subscription update skipped');
      }

      return res.json({
        success: true,
        status: 'success',
        message: 'Payment verified successfully'
      });
    }

    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'Invalid signature'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to verify payment'
    });
  }
};

// Verify payment endpoints (both for compatibility)
router.post('/verify-payment', verifyPaymentHandler);
router.post('/verify', verifyPaymentHandler);

console.log('Payment routes initialized with endpoints:');
console.log('- POST /create-order');
console.log('- POST /verify-payment');

export default router; 