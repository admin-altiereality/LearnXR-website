import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './config/firebase-admin';
import { router } from './routes';

// Load environment variables
dotenv.config();
console.log('Starting server...');

// Log environment variables (without sensitive data)
console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ? 'Present' : 'Missing',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ? 'Present' : 'Missing'
});

export { db };

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
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

// Mount routes
console.log('Mounting main router at /api');
app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res, next) => {
  console.log('404 Not Found:', req.method, req.originalUrl);
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log(`Health check endpoint: http://localhost:${PORT}/health`);
});
