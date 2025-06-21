import crypto from 'crypto';
import { Request, Response } from 'express';
import Razorpay from 'razorpay';

// Check if Razorpay credentials are available
const hasRazorpayCredentials = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;

// Initialize Razorpay only if credentials are available
const razorpay = hasRazorpayCredentials ? new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
}) : null;

export const createOrder = async (req: Request, res: Response) => {
  try {
    // Check if Razorpay is configured
    if (!hasRazorpayCredentials || !razorpay) {
      return res.status(503).json({
        status: 'error',
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    const { amount, currency = 'INR', planId } = req.body;

    if (!amount || !planId) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount and planId are required'
      });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount, // amount in smallest currency unit (paise for INR)
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: planId
      }
    });

    res.json({
      status: 'success',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create order'
    });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    // Check if Razorpay is configured
    if (!hasRazorpayCredentials) {
      return res.status(503).json({
        status: 'error',
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment is successful
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
      message: 'Failed to verify payment'
    });
  }
}; 