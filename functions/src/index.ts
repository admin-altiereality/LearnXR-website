/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios from 'axios';
import Razorpay from 'razorpay';

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// Explicit CORS middleware for all responses
app.use((req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(cors({ origin: true }));
app.use(express.json());

// List of public endpoints (method + path)
const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/api/skybox/styles' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/env-check' },
  { method: 'POST', path: '/api/skybox/generate' },
  { method: 'GET', path: '/api/skybox/status' },
  { method: 'POST', path: '/api/payment/create-order' },
  { method: 'POST', path: '/api/payment/verify' },
  { method: 'POST', path: '/api/subscription/create' },
  { method: 'GET', path: '/api/subscription' },
  { method: 'POST', path: '/api/user/subscription-status' }
];

const isPublicEndpoint = (req: Request) =>
  PUBLIC_ENDPOINTS.some(
    ep => ep.method === req.method && req.path.startsWith(ep.path)
  );

const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  if (isPublicEndpoint(req)) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'No token' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid token' });
  }
};

app.use(authenticateUser);

// Initialize Firebase Functions config

// Initialize Razorpay with environment variables (Firebase Functions v2)
let razorpayConfig = { key_id: '', key_secret: '' };
let razorpay: any = null;
let BLOCKADE_API_KEY = '';

try {
  razorpayConfig = {
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  };

  // Only initialize Razorpay if keys are available
  if (razorpayConfig.key_id && razorpayConfig.key_secret) {
    razorpay = new Razorpay(razorpayConfig);
  }

  // BlockadeLabs API configuration
  BLOCKADE_API_KEY = process.env.BLOCKADE_API_KEY || '';
} catch (error) {
  console.error('Error loading environment variables:', error);
}
const BLOCKADE_BASE_URL = 'https://backend.blockadelabs.com';

// Environment check endpoint
app.get('/api/env-check', (req: any, res: any) => {
  console.log('Environment variables:', {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? 'SET' : 'NOT_SET',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? 'SET' : 'NOT_SET',
    BLOCKADE_API_KEY: process.env.BLOCKADE_API_KEY ? 'SET' : 'NOT_SET'
  });
  
  res.json({
    environment: 'production',
    firebase: true,
    razorpay: !!razorpayConfig.key_id,
    blockadelabs: !!BLOCKADE_API_KEY,
    env_debug: {
      razorpay_key_length: razorpayConfig.key_id?.length || 0,
      blockadelabs_key_length: BLOCKADE_API_KEY?.length || 0
    },
    timestamp: new Date().toISOString()
  });
});

// Skybox Styles API
app.get('/api/skybox/styles', async (req: any, res: any) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    // Try to fetch from BlockadeLabs API
    if (BLOCKADE_API_KEY) {
      try {
        const response = await axios.get(`${BLOCKADE_BASE_URL}/api/v1/skybox/styles`, {
          headers: {
            'x-api-key': BLOCKADE_API_KEY,
            'Content-Type': 'application/json'
          },
          params: { page, limit }
        });
        
        return res.json({
          success: true,
          data: response.data
        });
      } catch (error) {
        console.error('BlockadeLabs API error:', error);
        // Fallback to Firebase data
      }
    }
    
    // Fallback: Get styles from Firebase
    const db = admin.firestore();
    const stylesRef = db.collection('skyboxStyles');
    const snapshot = await stylesRef
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .get();
    
    const styles = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({
      success: true,
      data: {
        styles,
        pagination: {
          page,
          limit,
          total: styles.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching skybox styles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch skybox styles'
    });
  }
});

// Skybox Generation API
app.post('/api/skybox/generate', async (req: any, res: any) => {
  try {
    const { prompt, style_id, negative_prompt } = req.body;
    
    if (!BLOCKADE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BlockadeLabs API key not configured'
      });
    }
    
    // Create generation request
    const generationResponse = await axios.post(`${BLOCKADE_BASE_URL}/api/v1/skybox/generations`, {
      prompt,
      style_id,
      negative_prompt: negative_prompt || '',
      webhook_url: null
    }, {
      headers: {
        'x-api-key': BLOCKADE_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      success: true,
      data: generationResponse.data
    });
  } catch (error) {
    console.error('Error generating skybox:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate skybox'
    });
  }
});

// Skybox Status API
app.get('/api/skybox/status/:generationId', async (req: any, res: any) => {
  try {
    const { generationId } = req.params;
    
    if (!BLOCKADE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BlockadeLabs API key not configured'
      });
    }
    
    const response = await axios.get(`${BLOCKADE_BASE_URL}/api/v1/skybox/generations/${generationId}`, {
      headers: {
        'x-api-key': BLOCKADE_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error checking skybox status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check skybox status'
    });
  }
});

// Payment APIs
app.post('/api/payment/create-order', async (req: any, res: any) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;
    
    if (!razorpayConfig.key_id || !razorpayConfig.key_secret) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured'
      });
    }
    
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency,
      receipt,
      notes: notes || {}
    };
    
    const order = await razorpay.orders.create(options);
    
    // Store order in Firebase
    const db = admin.firestore();
    await db.collection('orders').doc(order.id).set({
      ...order,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'created'
    });
    
    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: razorpayConfig.key_id
      }
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order'
    });
  }
});

app.post('/api/payment/verify', async (req: any, res: any) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    if (!razorpayConfig.key_secret) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured'
      });
    }
    
    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', razorpayConfig.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }
    
    // Update order status in Firebase
    const db = admin.firestore();
    await db.collection('orders').doc(razorpay_order_id).update({
      status: 'paid',
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
      paidAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      data: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        status: 'verified'
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Subscription Management APIs
app.post('/api/subscription/create', async (req: any, res: any) => {
  try {
    const { userId, planId, planName } = req.body;
    
    if (!razorpayConfig.key_id || !razorpayConfig.key_secret) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured'
      });
    }
    
    // Create subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // 12 months
      notes: {
        userId,
        planName
      }
    });
    
    // Store subscription in Firebase
    const db = admin.firestore();
    await db.collection('subscriptions').doc(subscription.id).set({
      ...subscription,
      userId,
      planName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: subscription.status
    });
    
    res.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        key_id: razorpayConfig.key_id
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
});

app.get('/api/subscription/:subscriptionId', async (req: any, res: any) => {
  try {
    const { subscriptionId } = req.params;
    
    if (!razorpayConfig.key_secret) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured'
      });
    }
    
    const subscription = await razorpay.subscriptions.fetch(subscriptionId);
    
    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

// User Management APIs
app.post('/api/user/subscription-status', async (req: any, res: any) => {
  try {
    const { userId } = req.body;
    
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
        }
      });
    }
    
    const subscription = snapshot.docs[0].data();
    
    res.json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription
      }
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req: any, res: any) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: true,
      razorpay: !!razorpayConfig.key_id,
      blockadelabs: !!BLOCKADE_API_KEY
    }
  });
});

// Export the Express app as a Firebase Function v2
export const api = onRequest({
  memory: '256MiB',
  timeoutSeconds: 60,
  maxInstances: 10,
  cors: true,
  region: 'us-central1',
  invoker: 'public',
  secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'BLOCKADE_API_KEY']
}, app);
