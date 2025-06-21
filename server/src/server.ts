import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { router as apiRouter } from './routes';
import paymentRoutes from './routes/payment';

// Load environment variables
dotenv.config();
console.log('Starting app...');

// Log environment variables (without sensitive data)
console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing (payment features disabled)',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing (payment features disabled)'
});

// Warn about missing payment configuration
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  Razorpay credentials not found. Payment features will be disabled.');
  console.warn('   To enable payments, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
}

const app = express();
const buildPath = path.resolve(process.cwd(), 'client/dist');

// CORS configuration
const corsOptions = {
  origin: [
    'https://in3d.evoneural.ai',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5002'
  ],
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

// Serve static files from the React build
app.use(express.static(buildPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

// Handle React routing - serve index.html for all non-API routes
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

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('app error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal app error'
  });
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api`);
  console.log(`📁 Static files served from: ${buildPath}`);
});

