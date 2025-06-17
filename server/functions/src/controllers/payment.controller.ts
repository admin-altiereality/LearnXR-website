import crypto from 'crypto';
import { Request, Response } from 'express';
import Razorpay from 'razorpay';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'INR', planId } = req.body;

    if (!amount || !planId) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount and planId are required'
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

    const order = await razorpay.orders.create(options);
    
    res.json({
      status: 'success',
      data: order
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create order'
    });
  }
};

// Verify payment
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      userId,
      planId
    } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !userId || !planId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters'
      });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid signature'
      });
    }

    // TODO: Update user's subscription status in your database
    // This is where you would update the user's plan in your database

    res.json({
      status: 'success',
      message: 'Payment verified successfully'
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to verify payment'
    });
  }
}; 