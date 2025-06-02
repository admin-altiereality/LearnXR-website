import express from 'express';
import paymentRoutes from './payment';

const router = express.Router();

// Mount payment routes
router.use('/payment', paymentRoutes);

export { router }; 