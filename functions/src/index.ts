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
// OPENAI_API_KEY is read from Secret Manager (e.g. projects/427897409662/secrets/OPENAI_API_KEY)
// Used by AI Teacher Support, Personalized Learning, and other AI features.
const blockadelabsApiKey = defineSecret("BLOCKADE_API_KEY");
const meshyApiKey = defineSecret("MESHY_API_KEY");
// Razorpay secrets removed - payment system not needed
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const openaiAvatarApiKey = defineSecret("OPENAI_AVATAR_API_KEY");
const linkedinAccessToken = defineSecret("LINKEDIN_ACCESS_TOKEN");
const linkedinCompanyURN = defineSecret("LINKEDIN_COMPANY_URN");
// Lazy Express app creation - only initialize when function is called
// NOTE: Do NOT recreate the Express app per request — that causes repeated module loads
// and can balloon memory usage (which surfaces as intermittent 500s and missing CORS headers
// because the platform returns the crash response).
let app: express.Application | null = null;

const getApp = (): express.Application => {
  if (app) return app;

  // Initialize admin first (safe to call multiple times)
  initializeAdmin();
  
  // Create Express app once per instance
  app = express();

    // CORS: set headers early for all responses so preflight and errors still get them.
    const isAllowedOrigin = (origin: string | undefined): boolean => {
      if (!origin) return true;
      const o = origin.toLowerCase();
      return o.includes('.web.app') || o.includes('.firebaseapp.com') || o.includes('localhost') || o.includes('127.0.0.1');
    };
    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      if (isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-In3d-Key');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
      next();
    });

    // CORS configuration - allow Firebase Hosting + localhost.
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-In3d-Key'],
      exposedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
      optionsSuccessStatus: 204
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    
    app.use(express.json());
    
    // Custom middleware
    app.use(pathNormalization);
    app.use(requestLogging);
    
    // Routes (loaded lazily to avoid deployment timeout)
    // Import routes only when app is created, not at module load time
    const linkedinRoutes = require('./routes/linkedin').default;
    const authRoutes = require('./routes/auth').default;

    // Mount public routes FIRST (before authentication)
    app.use('/linkedin', linkedinRoutes);
    app.use('/auth', authRoutes);

    // Apply authentication middleware
    app.use(authenticateUser);
    
    // Import and mount other routes AFTER authentication
    const healthRoutes = require('./routes/health').default;
    const skyboxRoutes = require('./routes/skybox').default;
    const meshyRoutes = require('./routes/meshy').default;
    const paymentRoutes = require('./routes/payment').default;
    const subscriptionRoutes = require('./routes/subscription').default;
    const userRoutes = require('./routes/user').default;
    const proxyRoutes = require('./routes/proxy').default;
    const aiDetectionRoutes = require('./routes/aiDetection').default;
    const assistantRoutes = require('./routes/assistant').default;
    const apiKeyRoutes = require('./routes/apiKey').default;
    const classSessionRoutes = require('./routes/classSessions').default;
    const curriculumRoutes = require('./routes/curriculum').default;
    const lmsRoutes = require('./routes/lms').default;
    const aiEducationRoutes = require('./routes/aiEducation').default;
    const assessmentRoutes = require('./routes/assessment').default;
    const pdfRoutes = require('./routes/pdf').default;

    // Mount protected routes AFTER authentication
    app.use('/', healthRoutes);
    app.use('/skybox', skyboxRoutes);
    app.use('/meshy', meshyRoutes);
    app.use('/payment', paymentRoutes);
    app.use('/subscription', subscriptionRoutes);
    app.use('/user', userRoutes);
    app.use('/', proxyRoutes);
    app.use('/ai-detection', aiDetectionRoutes);
    app.use('/assistant', assistantRoutes);
    app.use('/dev/api-keys', apiKeyRoutes);
    app.use('/class-sessions', classSessionRoutes);
    // When client calls .../api/class-sessions/join, some deployments pass path with /api prefix
    app.use('/api/class-sessions', classSessionRoutes);
    app.use('/curriculum', curriculumRoutes);
    app.use('/lms', lmsRoutes);
    app.use('/ai-education', aiEducationRoutes);
    app.use('/assessment', assessmentRoutes);
    app.use('/pdf', pdfRoutes);
    app.use('/api/pdf', pdfRoutes);

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
    // 512MiB is too tight for some routes (logs show OOM at ~521MiB),
    // and crashes manifest as 500 + missing CORS headers in the browser.
    memory: '1GiB',
    timeoutSeconds: 60,
    maxInstances: 10,
    cors: true, // Allow all origins (handled more specifically in Express CORS middleware)
    region: 'us-central1',
    invoker: 'public',
    secrets: [blockadelabsApiKey, meshyApiKey, openaiApiKey, openaiAvatarApiKey, linkedinAccessToken, linkedinCompanyURN]
  },
  (req, res) => {
  // Load secrets and set as environment variables
  // Also pass directly to initializeServices for immediate use
  try {
    let blockadeKey: string | undefined;
    let meshyKey: string | undefined;
    // Razorpay removed - payment system not needed
    let openaiKey: string | undefined;
    let openaiAvatarKey: string | undefined;
    let linkedinToken: string | undefined;
    let linkedinURN: string | undefined;
    
    try {
      blockadeKey = blockadelabsApiKey.value();
    } catch (err: any) {
      console.error('Error accessing BLOCKADE_API_KEY:', err?.message || err);
    }
    
    try {
      meshyKey = meshyApiKey.value();
      // Clean the API key - remove any whitespace, newlines, or "Bearer " prefix
      if (meshyKey) {
        meshyKey = meshyKey.trim().replace(/^Bearer\s+/i, '').replace(/\r?\n/g, '').replace(/\s+/g, '');
      }
    } catch (err: any) {
      console.error('Error accessing MESHY_API_KEY:', err?.message || err);
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
    
    try {
      openaiAvatarKey = openaiAvatarApiKey.value();
      // Clean the API key - remove any whitespace, newlines, or "Bearer " prefix
      if (openaiAvatarKey) {
        openaiAvatarKey = openaiAvatarKey.trim().replace(/^Bearer\s+/i, '').replace(/\r?\n/g, '').replace(/\s+/g, '');
      }
    } catch (err: any) {
      console.warn('⚠️ OPENAI_AVATAR_API_KEY not found, will fallback to OPENAI_API_KEY:', err?.message || err);
    }
    
    try {
      linkedinToken = linkedinAccessToken.value();
      if (linkedinToken) {
        linkedinToken = linkedinToken.trim();
      }
    } catch (err: any) {
      console.warn('⚠️ LINKEDIN_ACCESS_TOKEN not found:', err?.message || err);
    }
    
    try {
      linkedinURN = linkedinCompanyURN.value();
      if (linkedinURN) {
        linkedinURN = linkedinURN.trim();
      }
    } catch (err: any) {
      console.warn('⚠️ LINKEDIN_COMPANY_URN not found:', err?.message || err);
    }

    // Set in process.env for routes that use getSecret()
    if (blockadeKey) process.env.BLOCKADE_API_KEY = blockadeKey;
    if (meshyKey) {
      process.env.MESHY_API_KEY = meshyKey;
      console.log('🔑 Meshy API key cleaned and set, length:', meshyKey.length);
    }
    // Razorpay removed - payment system not needed
    if (openaiKey) {
      process.env.OPENAI_API_KEY = openaiKey;
      console.log('🔑 OpenAI API key cleaned and set, length:', openaiKey.length);
    }
    if (openaiAvatarKey) {
      process.env.OPENAI_AVATAR_API_KEY = openaiAvatarKey;
      console.log('🔑 OpenAI Avatar API key cleaned and set, length:', openaiAvatarKey.length);
    } else {
      console.log('⚠️ OPENAI_AVATAR_API_KEY not set, will use OPENAI_API_KEY as fallback');
    }
    
    // Set LinkedIn secrets
    if (linkedinToken) {
      process.env.LINKEDIN_ACCESS_TOKEN = linkedinToken;
      console.log('🔑 LinkedIn Access Token set, length:', linkedinToken.length);
    } else {
      console.warn('⚠️ LINKEDIN_ACCESS_TOKEN not set - LinkedIn API will not work');
    }
    
    if (linkedinURN) {
      process.env.LINKEDIN_COMPANY_URN = linkedinURN;
      console.log('🔑 LinkedIn Company URN set:', linkedinURN);
    } else {
      console.warn('⚠️ LINKEDIN_COMPANY_URN not set - LinkedIn API will not work');
    }

    console.log('Secrets loaded:', {
      hasBlockade: !!blockadeKey,
      blockadeLength: blockadeKey?.length || 0,
      hasMeshy: !!meshyKey,
      meshyKeyLength: meshyKey?.length || 0,
      hasOpenAI: !!openaiKey,
      openaiKeyLength: openaiKey?.length || 0,
      hasOpenAIAvatar: !!openaiAvatarKey,
      openaiAvatarKeyLength: openaiAvatarKey?.length || 0,
      hasLinkedInToken: !!linkedinToken,
      linkedinTokenLength: linkedinToken?.length || 0,
      hasLinkedInURN: !!linkedinURN
    });
    
    // Initialize services with secrets directly
    const { initializeServices } = require('./utils/services');
    initializeServices({
      blockadelabsApiKey: blockadeKey,
      meshyApiKey: meshyKey
      // Razorpay removed - payment system not needed
    });
  } catch (error: any) {
    console.error('Error loading secrets:', error?.message || error, error?.stack);
    // Still try to initialize with environment variables as fallback
    const { initializeServices } = require('./utils/services');
    initializeServices();
  }
  
  // Lazy initialization - only create app when function is called
  const expressApp = getApp();
  expressApp(req, res);
});
