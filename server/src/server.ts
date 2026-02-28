import compression from 'compression';
import connectTimeout from 'connect-timeout';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { router as apiRouter } from './routes/index';
import paymentRoutes from './routes/payment';

// Load environment variables (cwd .env first, then server/.env so key is found when run from repo root)
dotenv.config();
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
try {
  const result = dotenv.config({ path: serverEnvPath });
  if (result.parsed && !process.env.OPENAI_API_KEY && (result.parsed as Record<string, string>).OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = (result.parsed as Record<string, string>).OPENAI_API_KEY;
  }
} catch (_) {}
console.log('Starting app...');

// Log environment variables (without sensitive data)
console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
  OPENAI_AVATAR_API_KEY: process.env.OPENAI_AVATAR_API_KEY ? 'Present' : 'Missing (will fallback to OPENAI_API_KEY)'
});

// Razorpay removed - all payments use Paddle

const app = express();
app.disable('x-powered-by');
const buildPath = path.resolve(process.cwd(), 'client/dist');
const isDevelopment = process.env.NODE_ENV === 'development';

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP may break inline scripts; configure separately if needed
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration (allow Firebase preview channels e.g. in3devoneuralai--manav-xxx.web.app)
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return cb(null, true);
    const allowed = [
      'https://in3d.evoneural.ai',
      'https://learnxr-evoneuralai.web.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5002'
    ];
    if (allowed.includes(origin)) return cb(null, true);
    if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.web\.app$/.test(origin)) return cb(null, true);
    if (origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) return cb(null, true);
    cb(new Error('Origin not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(compression());
app.use(connectTimeout('30s'));
app.use(express.json({ limit: '1mb' }));

// Stricter rate limit for auth routes (10 req/15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Global rate limiting (100 req/15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Debug middleware (development only; sanitize sensitive data)
app.use((req, res, next) => {
  if (isDevelopment) {
    const sanitize = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'object' && obj !== null) {
        const out: Record<string, unknown> = {};
        const sensitive = ['password', 'token', 'apiKey', 'authorization', 'secret', 'key'];
        for (const [k, v] of Object.entries(obj)) {
          if (sensitive.some(s => k.toLowerCase().includes(s))) {
            out[k] = '[REDACTED]';
          } else {
            out[k] = typeof v === 'object' && v !== null ? sanitize(v) : v;
          }
        }
        return out;
      }
      return obj;
    };
    console.log('Incoming request:', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      body: sanitize(req.body),
    });
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes (must come before static file serving)
console.log('Mounting payment routes at /api/payment');
app.use('/api/payment', paymentRoutes);

console.log('Mounting API routes at /api');
app.use('/api', apiRouter);

// Serve audio files from public directory
const publicPath = path.resolve(process.cwd(), 'server', 'public');
app.use('/audio', express.static(path.join(publicPath, 'audio')));
console.log('Serving audio files from:', path.join(publicPath, 'audio'));

// Serve static files from the React build (only in production)
if (!isDevelopment) {
  app.use(express.static(buildPath, {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
  }));

  // Handle React routing - serve index.html for all non-API routes (only in production)
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        status: 'error',
        message: `API endpoint not found: ${req.path}`
      });
    }

    const indexPath = path.join(buildPath, 'index.html');
    console.log('Serving React app from:', indexPath);
    
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({
          status: 'error',
          message: 'Failed to serve application'
        });
      }
    });
  });
} else {
  // In development, redirect to Vite dev server
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        status: 'error',
        message: `API endpoint not found: ${req.path}`
      });
    }
    
    // Redirect to Vite dev server
    res.redirect('http://localhost:3000' + req.path);
  });
}

// Centralized error handler (never expose stack traces to client in production)
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('app error:', err);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    status: 'error',
    message: isDev ? (err.message || 'Internal app error') : 'An error occurred',
    ...(isDev && err.stack ? { details: err.stack } : {})
  });
});

const PORT = process.env.SERVER_PORT || process.env.PORT || 5002;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
  if (isDevelopment) {
    console.log(`🔄 Development mode: Frontend redirects to http://localhost:3000`);
  } else {
    console.log(`📁 Static files served from: ${buildPath}`);
  }
});

// Graceful shutdown
const shutdown = () => {
  console.log('Received shutdown signal, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

