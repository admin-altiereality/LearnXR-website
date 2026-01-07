/**
 * Firebase Functions Entry Point
 * Minimal main file to avoid deployment timeouts
 * All routes are in separate modules loaded lazily
 */

import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initializeAdmin } from './utils/services';
import { pathNormalization } from './middleware/pathNormalization';
import { requestLogging } from './middleware/logging';
import { authenticateUser } from './middleware/auth';

// Define secrets for Firebase Functions v2
// Note: These must match the secret names set via firebase functions:secrets:set
const blockadelabsApiKey = defineSecret("BLOCKADE_API_KEY");
const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Lazy Express app creation - only initialize when function is called
// Note: app is reset on each request to ensure secrets are loaded
let app: express.Application | null = null;

const getApp = (): express.Application => {
  // Always reinitialize to ensure secrets are loaded from environment
  // Initialize admin first
  initializeAdmin();
  
  // Create Express app (always create new to ensure fresh initialization)
  app = express();
    
    // CORS configuration - allow all origins including preview channels
    app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow all Firebase Hosting origins (production and preview channels)
        if (origin.includes('.web.app') || origin.includes('.firebaseapp.com')) {
          return callback(null, true);
        }
        
        // Allow localhost for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        
        // Allow all origins (fallback)
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400 // 24 hours
    }));
    
    // Handle preflight requests explicitly
    app.options('*', cors());
    
    app.use(express.json());
    
    // Custom middleware
    app.use(pathNormalization);
    app.use(requestLogging);
    app.use(authenticateUser);
    
    // Routes (loaded lazily to avoid deployment timeout)
    // Import routes only when app is created, not at module load time
    const healthRoutes = require('./routes/health').default;
    const skyboxRoutes = require('./routes/skybox').default;
    const paymentRoutes = require('./routes/payment').default;
    const subscriptionRoutes = require('./routes/subscription').default;
    const userRoutes = require('./routes/user').default;
    const proxyRoutes = require('./routes/proxy').default;
    const aiDetectionRoutes = require('./routes/aiDetection').default;
    const assistantRoutes = require('./routes/assistant').default;
    
    app.use('/', healthRoutes);
    app.use('/skybox', skyboxRoutes);
    app.use('/payment', paymentRoutes);
    app.use('/subscription', subscriptionRoutes);
    app.use('/user', userRoutes);
    app.use('/', proxyRoutes);
    app.use('/ai-detection', aiDetectionRoutes);
    app.use('/assistant', assistantRoutes);
    
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
  
  return app;
};

// Export the Express app as a Firebase Function v2
// Secrets must be included in the options object
export const api = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
    cors: true, // Allow all origins (handled more specifically in Express CORS middleware)
    region: 'us-central1',
    invoker: 'public',
    secrets: [blockadelabsApiKey, razorpayKeyId, razorpayKeySecret, openaiApiKey] // Reference secrets - must match defineSecret names
  },
  (req, res) => {
  // Load secrets and set as environment variables
  // Also pass directly to initializeServices for immediate use
  try {
    let blockadeKey: string | undefined;
    let razorpayId: string | undefined;
    let razorpaySecret: string | undefined;
    let openaiKey: string | undefined;
    
    try {
      blockadeKey = blockadelabsApiKey.value();
    } catch (err: any) {
      console.error('Error accessing BLOCKADE_API_KEY:', err?.message || err);
    }
    
    try {
      razorpayId = razorpayKeyId.value();
    } catch (err: any) {
      console.error('Error accessing RAZORPAY_KEY_ID:', err?.message || err);
    }
    
    try {
      razorpaySecret = razorpayKeySecret.value();
    } catch (err: any) {
      console.error('Error accessing RAZORPAY_KEY_SECRET:', err?.message || err);
    }
    
    try {
      openaiKey = openaiApiKey.value();
      // Clean the API key - remove any whitespace, newlines, or "Bearer " prefix
      if (openaiKey) {
        openaiKey = openaiKey.trim().replace(/^Bearer\s+/i, '').replace(/\r?\n/g, '').replace(/\s+/g, '');
      }
    } catch (err: any) {
      console.error('Error accessing OPENAI_API_KEY:', err?.message || err);
    }
    
    // Set in process.env for routes that use getSecret()
    if (blockadeKey) process.env.BLOCKADE_API_KEY = blockadeKey;
    if (razorpayId) process.env.RAZORPAY_KEY_ID = razorpayId;
    if (razorpaySecret) process.env.RAZORPAY_KEY_SECRET = razorpaySecret;
    if (openaiKey) {
      process.env.OPENAI_API_KEY = openaiKey;
      console.log('🔑 OpenAI API key cleaned and set, length:', openaiKey.length);
    }
    
    console.log('Secrets loaded:', {
      hasBlockade: !!blockadeKey,
      blockadeLength: blockadeKey?.length || 0,
      hasRazorpayId: !!razorpayId,
      razorpayIdLength: razorpayId?.length || 0,
      hasRazorpaySecret: !!razorpaySecret,
      razorpaySecretLength: razorpaySecret?.length || 0,
      hasOpenAI: !!openaiKey,
      openaiKeyLength: openaiKey?.length || 0
    });
    
    // Initialize services with secrets directly
    const { initializeServices } = require('./utils/services');
    initializeServices({
      blockadelabsApiKey: blockadeKey,
      razorpayKeyId: razorpayId,
      razorpayKeySecret: razorpaySecret
    });
  } catch (error: any) {
    console.error('Error loading secrets:', error?.message || error, error?.stack);
    // Still try to initialize with environment variables as fallback
    const { initializeServices } = require('./utils/services');
    initializeServices();
  }
  
  // Reset app to force re-initialization with new secrets
  app = null;
  
  // Lazy initialization - only create app when function is called
  const expressApp = getApp();
  expressApp(req, res);
});
