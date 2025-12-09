import express from 'express';
import { upsertSubscription, hasExistingSubscription } from '../services/subscriptionService';

const router = express.Router();

console.log('Subscription routes being initialized...');

// Debug middleware for subscription routes
router.use((req, res, next) => {
  console.log('Subscription route received request:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    body: req.body
  });
  next();
});

// Create or update subscription
router.post('/create', async (req, res) => {
  try {
    const { userId, planId, planName, orderId, paymentId } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'userId and planId are required'
      });
    }

    // Upsert the subscription (update existing or create new)
    await upsertSubscription(userId, {
      planId,
      status: 'active',
      ...(orderId && { orderId }),
      ...(paymentId && { paymentId })
    });

    console.log(`✅ Subscription created/updated for user: ${userId} with plan: ${planId}`);

    res.json({
      success: true,
      status: 'success',
      message: 'Subscription created successfully',
      data: {
        userId,
        planId,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create subscription'
    });
  }
});

// Get subscription status
router.post('/status', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'userId is required'
      });
    }

    const hasSubscription = await hasExistingSubscription(userId);

    res.json({
      success: true,
      status: 'success',
      data: {
        userId,
        hasSubscription
      }
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check subscription status'
    });
  }
});

console.log('Subscription routes initialized with endpoints:');
console.log('- POST /create');
console.log('- POST /status');

export default router;
