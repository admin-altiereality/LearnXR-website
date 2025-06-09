import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './config/firebase-admin';
import paymentRoutes from './routes/payment';

// Load environment variables
dotenv.config();
console.log('Starting server...');

export { db };

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/payment', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint called');
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await new Promise((resolve, reject) => {
      const server = app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        console.log(`Health check endpoint: http://localhost:${PORT}/health`);
        resolve(true);
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Please try a different port or free up the port.`);
        } else {
          console.error('Failed to start server:', error);
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();
