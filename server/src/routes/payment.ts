import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { db } from '../config/firebase-admin';
import * as admin from 'firebase-admin';

const router = Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

// Create order
router.post('/create-order', async (req, res) => {
  try {
    console.log('Received create-order request:', req.body);
    const { amount, currency = 'INR', planId } = req.body;

    if (!amount || !planId) {
      console.log('Missing required fields:', { amount, planId });
      return res.status(400).json({
        status: 'error',
        message: 'Amount and plan ID are required'
      });
    }

    console.log('Creating order with options:', { amount, currency, planId });
    const options = {
      amount: amount,
      currency,
      receipt: `order_${Date.now()}`,
      notes: {
        planId
      }
    };

    console.log('Razorpay instance:', { 
      hasKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create(options);
    console.log('Order created successfully:', order);
    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create order',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      userId,
      planId
    } = req.body;

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update subscription in Firestore
      const subscriptionRef = db.collection('subscriptions').doc(userId);
      const subscriptionData = {
        planId,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      };

      await subscriptionRef.set(subscriptionData, { merge: true });

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