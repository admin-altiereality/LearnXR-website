/**
 * Firebase Functions with Blockade Labs SDK Integration
 * Handles skybox generation, status checking, and user management
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import axios from 'axios';
import Razorpay from 'razorpay';

// Global options for cost control
setGlobalOptions({ maxInstances: 10 });

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// CORS middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] ${req.method} ${req.path}`, {
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined,
    headers: {
      'user-agent': req.headers['user-agent'],
      'authorization': req.headers.authorization ? 'Bearer ***' : 'none'
    }
  });
  
  (req as any).requestId = requestId;
  next();
});

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/skybox/styles' },
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/env-check' },
  { method: 'POST', path: '/skybox/generate' },
  { method: 'GET', path: '/skybox/status' },
  { method: 'GET', path: '/skybox/history' },
  { method: 'POST', path: '/payment/create-order' },
  { method: 'POST', path: '/payment/verify' },
  { method: 'POST', path: '/subscription/create' },
  { method: 'GET', path: '/subscription' },
  { method: 'POST', path: '/user/subscription-status' },
  { method: 'GET', path: '/proxy-asset' },
  { method: 'HEAD', path: '/proxy-asset' }
];

const isPublicEndpoint = (req: Request) => {
  const isPublic = PUBLIC_ENDPOINTS.some(
    ep => ep.method === req.method && req.path.startsWith(ep.path)
  );
  console.log(`[${(req as any).requestId}] Checking public endpoint: ${req.method} ${req.path} -> ${isPublic}`);
  return isPublic;
};

// Authentication middleware
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  console.log(`[${requestId}] Auth check for ${req.method} ${req.path}`);
  
  if (isPublicEndpoint(req)) {
    console.log(`[${requestId}] Public endpoint, skipping auth`);
    return next();
  }

  console.log(`[${requestId}] Private endpoint, checking auth`);
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'AUTH_REQUIRED', 
      message: 'No token provided',
      requestId: (req as any).requestId 
    });
  }
  
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ 
      error: 'INVALID_TOKEN', 
      message: 'Invalid or expired token',
      requestId: (req as any).requestId 
    });
  }
};

app.use(authenticateUser);

// Initialize services
let BLOCKADE_API_KEY = '';
let razorpay: Razorpay | null = null;

try {
  BLOCKADE_API_KEY = process.env.BLOCKADE_API_KEY || '';
  if (BLOCKADE_API_KEY) {
    // Clean the API key (remove any invalid characters)
    BLOCKADE_API_KEY = BLOCKADE_API_KEY.replace(/[^\w\-]/g, '');
    console.log('BlockadeLabs API key configured successfully');
  } else {
    console.warn('BLOCKADE_API_KEY not found in environment variables');
  }
} catch (error) {
  console.error('Failed to configure BlockadeLabs API key:', error);
}

try {
  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });
    console.log('Razorpay initialized successfully');
  } else {
    console.warn('Razorpay credentials not found in environment variables');
  }
} catch (error) {
  console.error('Failed to initialize Razorpay:', error);
}

// Environment check endpoint
app.get('/env-check', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  console.log(`[${requestId}] Environment check requested`);
  
      res.json({
      environment: 'production',
      firebase: true,
      blockadelabs: !!BLOCKADE_API_KEY,
      razorpay: !!razorpay,
      env_debug: {
        blockadelabs_key_length: process.env.BLOCKADE_API_KEY?.length || 0,
        razorpay_key_length: process.env.RAZORPAY_KEY_ID?.length || 0,
        razorpay_secret_length: process.env.RAZORPAY_KEY_SECRET?.length || 0
      },
      timestamp: new Date().toISOString(),
      requestId
    });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firebase: true,
      blockadelabs: !!BLOCKADE_API_KEY,
      razorpay: !!razorpay
    },
    requestId
  });
});

// Skybox Styles API
app.get('/skybox/styles', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  
  try {
    console.log(`[${requestId}] Fetching skybox styles, page: ${page}, limit: ${limit}`);
    
    if (BLOCKADE_API_KEY) {
      try {
        const response = await axios.get('https://backend.blockadelabs.com/api/v1/skybox/styles', {
          headers: {
            'x-api-key': BLOCKADE_API_KEY,
            'Content-Type': 'application/json'
          },
          params: { page, limit }
        });
        
        console.log(`[${requestId}] Successfully fetched ${response.data.length} styles from BlockadeLabs`);
        
        return res.json({
          success: true,
          data: response.data,
          pagination: {
            page,
            limit,
            total: response.data.length
          },
          requestId
        });
      } catch (error) {
        console.error(`[${requestId}] BlockadeLabs API error:`, error);
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
    
    console.log(`[${requestId}] Successfully fetched ${styles.length} styles from Firebase`);
    
    return res.json({
      success: true,
      data: styles,
      pagination: {
        page,
        limit,
        total: styles.length
      },
      requestId
    });
      } catch (error) {
      console.error(`[${requestId}] Error fetching skybox styles:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch skybox styles',
        requestId
      });
    }
});

// Skybox Generation API
app.post('/skybox/generate', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { prompt, style_id, negative_prompt, userId } = req.body;
  
  try {
    console.log(`[${requestId}] Skybox generation requested:`, { prompt, style_id, userId });
    
    if (!BLOCKADE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BlockadeLabs API not configured',
        requestId
      });
    }
    
    if (!prompt || !style_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: prompt and style_id',
        requestId
      });
    }
    
    // Create generation using BlockadeLabs API
    const response = await axios.post('https://backend.blockadelabs.com/api/v1/skybox', {
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
    
    const generation = response.data;
    console.log(`[${requestId}] Generation created:`, generation.id);
    
    // Validate generation ID
    if (!generation.id) {
      console.error(`[${requestId}] No generation ID returned from BlockadeLabs API`);
      return res.status(500).json({
        success: false,
        error: 'No generation ID returned from API',
        requestId
      });
    }
    
    // Store generation in Firestore
    const db = admin.firestore();
    const skyboxData: any = {
      generationId: generation.id,
      prompt,
      style_id,
      negative_prompt: negative_prompt || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    const resolvedUserId = userId || (req as any).user?.uid;
    if (resolvedUserId) {
      skyboxData.userId = resolvedUserId;
    }
    await db.collection('skyboxes').doc(generation.id.toString()).set(skyboxData);
    
    console.log(`[${requestId}] Skybox data stored in Firestore`);
    
    return res.json({
      success: true,
      data: {
        generationId: generation.id,
        status: 'pending',
        ...generation
      },
      requestId
    });
      } catch (error: any) {
      console.error(`[${requestId}] Error generating skybox:`, error);
      
      // Handle specific Blockade Labs API errors
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 403) {
          // Handle quota exceeded or API disabled
          let errorMessage = 'Generation quota exceeded';
          if (data && data.error) {
            if (data.error.includes('used every generation')) {
              errorMessage = 'API quota has been exhausted. Please contact support or try again later.';
            } else if (data.error.includes('generations are disabled')) {
              errorMessage = 'Skybox generation is temporarily disabled. Please try again later.';
            } else {
              errorMessage = data.error;
            }
          }
          
          return res.status(403).json({
            success: false,
            error: errorMessage,
            code: 'QUOTA_EXCEEDED',
            requestId
          });
        }
        
        if (status === 400) {
          return res.status(400).json({
            success: false,
            error: data?.error || 'Invalid request parameters',
            code: 'INVALID_REQUEST',
            requestId
          });
        }
        
        if (status === 401) {
          return res.status(401).json({
            success: false,
            error: 'Invalid API key or authentication failed',
            code: 'AUTH_ERROR',
            requestId
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to generate skybox',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
    }
});

// Skybox Status API
app.get('/skybox/status/:generationId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { generationId } = req.params;
  
  try {
    console.log(`[${requestId}] Checking status for generation: ${generationId}`);
    
    if (!BLOCKADE_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'BlockadeLabs API not configured',
        requestId
      });
    }
    
    if (!generationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing generation ID',
        requestId
      });
    }
    
    // Get generation status from BlockadeLabs API
    const response = await axios.get(`https://backend.blockadelabs.com/api/v1/skybox/generations/${generationId}`, {
      headers: {
        'x-api-key': BLOCKADE_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    const generation = response.data;
    console.log(`[${requestId}] Generation status:`, generation.status);
    
    // Update Firestore with latest status
    const db = admin.firestore();
    const updateData: any = {
      status: generation.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (generation.status === 'complete' && generation.file_url) {
      updateData.fileUrl = generation.file_url;
      updateData.thumbnailUrl = generation.thumbnail_url;
    }
    
    await db.collection('skyboxes').doc(generationId).update(updateData);
    
    return res.json({
      success: true,
      data: generation,
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error checking skybox status:`, error);
    
    // Check if it's a 404 error (generation not found)
    if (error instanceof Error && error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found',
        requestId
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check skybox status',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

// Skybox History API
app.get('/skybox/history', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const userId = (req as any).user?.uid;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  try {
    console.log(`[${requestId}] Fetching skybox history for user: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
        requestId
      });
    }
    
    const db = admin.firestore();
    const skyboxesRef = db.collection('skyboxes');
    const snapshot = await skyboxesRef
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .get();
    
    const skyboxes = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));
    
    console.log(`[${requestId}] Found ${skyboxes.length} skyboxes for user`);
    
    return res.json({
      success: true,
      data: skyboxes,
      pagination: {
        page,
        limit,
        total: skyboxes.length
      },
      requestId
    });
      } catch (error) {
      console.error(`[${requestId}] Error fetching skybox history:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch skybox history',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
    }
});

// Payment APIs
app.post('/payment/create-order', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { amount, currency = 'INR', receipt, notes, userId } = req.body;
  
  try {
    console.log(`[${requestId}] Creating payment order:`, { amount, currency, userId });
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    const options = {
      amount: amount, // Client already sends amount in paise
      currency,
      receipt,
      notes: { ...notes, userId }
    };
    
    const order = await razorpay.orders.create(options);

    // Store order in Firebase
    const db = admin.firestore();
    await db.collection('orders').doc(order.id).set({
      ...order,
      userId: userId || (req as any).user?.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'created'
    });

    console.log(`[${requestId}] Order created:`, order.id);

    // NOTE: The frontend expects `data.id` for Razorpay order_id.
    // We also keep `order_id` for backward compatibility with any
    // older clients or test tools that relied on that field.
    return res.json({
      success: true,
      data: {
        id: order.id,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID
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

app.post('/payment/verify', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  try {
    console.log(`[${requestId}] Verifying payment:`, { razorpay_order_id, razorpay_payment_id });
    
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
        requestId
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

// Subscription Management APIs
app.post('/subscription/create', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId, planId, planName } = req.body;
  
  try {
    console.log(`[${requestId}] Creating subscription:`, { userId, planId, planName });
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
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
    
    console.log(`[${requestId}] Subscription created:`, subscription.id);
    
    return res.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        key_id: process.env.RAZORPAY_KEY_ID
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

app.get('/subscription/:subscriptionId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { subscriptionId } = req.params;
  
  try {
    console.log(`[${requestId}] Fetching subscription:`, subscriptionId);
    
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

// User Management APIs
app.post('/user/subscription-status', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId } = req.body;
  
  try {
    console.log(`[${requestId}] Checking subscription status for user:`, userId);
    
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
      },
      requestId
    });
    }
    
    const subscription = snapshot.docs[0].data();
    
    return res.json({
      success: true,
      data: {
        hasActiveSubscription: true,
        subscription
      },
      requestId
    });
      } catch (error) {
      console.error(`[${requestId}] Error checking subscription status:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check subscription status',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
    }
});

// Proxy route for Meshy assets to handle CORS
app.get('/proxy-asset', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { url } = req.query;
  
  try {
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'URL parameter is required',
        requestId 
      });
    }

    console.log(`[${requestId}] Proxying asset request:`, url);

    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'In3D.ai-WebApp/1.0',
      },
      timeout: 30000, // 30 second timeout
    });

    if (!response.data) {
      console.error(`[${requestId}] Asset proxy failed: No data received`);
      return res.status(500).json({ 
        error: 'Failed to fetch asset: No data received',
        requestId 
      });
    }

    // Get the content type
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Stream the response
    response.data.pipe(res);
    
    console.log(`[${requestId}] Asset proxy successful`);
    return; // Explicit return for TypeScript
  } catch (error: any) {
    console.error(`[${requestId}] Asset proxy error:`, error);
    
    if (error.response) {
      // Forward the error status from the target server
      return res.status(error.response.status).json({ 
        error: `Failed to fetch asset: ${error.response.status} ${error.response.statusText}`,
        requestId 
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error during asset proxy',
      details: error.message,
      requestId 
    });
  }
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  console.error(`[${requestId}] Unhandled error:`, error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId
  });
});

// Export the Express app as a Firebase Function v2
export const api = onRequest({
  memory: '512MiB',
  timeoutSeconds: 60,
  maxInstances: 10,
  cors: true,
  region: 'us-central1',
  invoker: 'public',
  secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'BLOCKADE_API_KEY']
}, app);
