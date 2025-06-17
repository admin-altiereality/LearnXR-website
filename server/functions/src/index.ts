/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as cors from "cors";
import * as dotenv from "dotenv";
import * as express from "express";
import { onRequest } from "firebase-functions/v2/https";
import { paymentRoutes } from "./routes";

// Load environment variables
dotenv.config();

const app = express();

// Add CORS middleware with more permissive settings
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-rtb-fingerprint-id'],
  exposedHeaders: ['x-rtb-fingerprint-id'],
  credentials: true
}));

// Add raw body handling middleware
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Add routes
app.use('/api/payment', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Export the Express app as a Firebase Function v2
export const api = onRequest({
  cors: true,
  maxInstances: 10,
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60,
}, app);
