import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
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
const buildPath = path.resolve(process.cwd(), 'client/dist');
const isDevelopment = process.env.NODE_ENV === 'development';

// CORS configuration (allow Firebase preview channels e.g. in3devoneuralai--manav-xxx.web.app)
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return cb(null, true);
    const allowed = [
      'https://in3d.evoneural.ai',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5002'
    ];
    if (allowed.includes(origin)) return cb(null, true);
    if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.web\.app$/.test(origin)) return cb(null, true);
    if (origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) return cb(null, true);
    cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log('Incoming request:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    body: req.body,
    headers: req.headers
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('app error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal app error'
  });
});

const PORT = process.env.SERVER_PORT || process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
  if (isDevelopment) {
    console.log(`🔄 Development mode: Frontend redirects to http://localhost:3000`);
  } else {
    console.log(`📁 Static files served from: ${buildPath}`);
  }
});

