import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/payment.controller';

const router = Router();

// Create a new order
router.post('/create-order', createOrder);

// Verify payment
router.post('/verify-payment', verifyPayment);

export const paymentRoutes = router; 