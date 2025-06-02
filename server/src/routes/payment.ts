import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/firebase-admin';
import * as admin from 'firebase-admin';
import Razorpay from 'razorpay';

const router = Router();

// Initialize Razorpay with error handling
const initializeRazorpay = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be provided in environment variables');
  }

  return new Razorpay({
    key_id,
    key_secret
  });
};

let razorpay: Razorpay;
try {
  razorpay = initializeRazorpay();
  console.log('Razorpay initialized successfully');
} catch (error) {
  console.error('Failed to initialize Razorpay:', error);
  throw error;
}

interface PaymentVerificationRequest {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  userId: string;
  planId: string;
}

interface CreateOrderRequest {
  amount: number;
  currency?: string;
  planId: string;
}

// Create Razorpay order
router.post('/create-order', async (req: Request<{}, {}, CreateOrderRequest>, res: Response) => {
  try {
    const { amount, currency = 'INR', planId } = req.body;

    if (!amount || !planId) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount and plan ID are required'
      });
    }

    const options = {
      amount: amount,
      currency,
      receipt: `order_${Date.now()}`,
      notes: {
        planId
      }
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create order'
    });
  }
});

// Verify Razorpay payment
router.post('/verify', async (req: Request<{}, {}, PaymentVerificationRequest>, res: Response) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      userId,
      planId
    } = req.body;

    // Get the Razorpay key secret from environment variables
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      throw new Error('Razorpay key secret not configured');
    }

    // Verify the payment signature
    const generated_signature = crypto
      .createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment is verified, update user's subscription
      const subscriptionRef = db.collection('subscriptions').doc(userId);
      const subscriptionDoc = await subscriptionRef.get();

      const subscriptionData = {
        planId,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      };

      if (subscriptionDoc.exists) {
        await subscriptionRef.update(subscriptionData);
      } else {
        // Create new subscription if it doesn't exist
        await subscriptionRef.set({
          ...subscriptionData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          userId
        });
      }

      res.json({
        status: 'success',
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Invalid payment signature'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Payment verification failed'
    });
  }
});

export default router; 