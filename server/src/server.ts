import { env } from "@/config/env";
import cors from "cors";
import express, { json } from "express";
import { router } from "@/routes";
import path from 'path';
import './config/firebase-admin'; // Initialize Firebase Admin
import paymentRoutes from './routes/payment';

const server = express();

server.use(json());
server.use(cors());

// API routes
server.use('/api', router);
server.use('/api/payment', paymentRoutes);

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React build directory
  server.use(express.static(path.join(__dirname, '../client/dist')));

  // Handle React routing, return all requests to React app
  server.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV);
});
