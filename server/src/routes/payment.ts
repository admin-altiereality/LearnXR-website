import express from 'express';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { db } from '../config/firebase-admin';
import * as admin from 'firebase-admin';

dotenv.config();

const router = express.Router();

console.log('Payment routes being initialized...');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

console.log('Razorpay initialized with key_id:', process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing');

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
  console.log('Creating order with data:', req.body);
  try {
    const { amount, currency, planId } = req.body;
    
    if (!amount || !currency || !planId) {
      console.log('Missing required fields:', { amount, currency, planId });
      return res.status(400).json({
        status: 'error',
        message: 'Amount, currency, and planId are required'
      });
    }

    const options = {
      amount: amount,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: planId
      }
    };

    console.log('Creating Razorpay order with options:', options);
    const order = await razorpay.orders.create(options);
    console.log('Order created successfully:', order);
    
    res.json({
      status: 'success',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create order'
    });
  }
});

// Verify payment endpoint
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required payment verification data'
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update subscription in Firestore
      if (userId && planId) {
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const subscriptionData = {
          planId,
          status: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id
        };
        await subscriptionRef.set(subscriptionData, { merge: true });
      }

      res.json({
        status: 'success',
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Invalid signature'
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to verify payment'
    });
  }
});

console.log('Payment routes initialized with endpoints:');
console.log('- POST /create-order');
console.log('- POST /verify-payment');

export default router; 