import express from 'express';
import { 
  upsertSubscription, 
  hasExistingSubscription,
  getUserSubscription,
  cancelSubscription,
  hasActivePaidSubscription
} from '../services/subscriptionService';

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

/**
 * Create or update subscription
 * POST /subscription/create
 */
router.post('/create', async (req, res) => {
  try {
    const { userId, planId, planName, orderId, paymentId, provider = 'razorpay', billingCycle = 'monthly' } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'userId and planId are required'
      });
    }

    // Calculate period dates
    const periodStart = new Date();
    const periodEnd = new Date();
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Upsert the subscription
    await upsertSubscription(userId, {
      planId,
      planName: planName || planId.charAt(0).toUpperCase() + planId.slice(1),
      status: 'active',
      provider,
      cancelAtPeriodEnd: false,
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      usage: { skyboxGenerations: 0 }, // Reset usage on new subscription
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
        status: 'active',
        provider,
        currentPeriodEnd: periodEnd.toISOString()
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

/**
 * Get subscription status
 * POST /subscription/status
 */
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

    const subscription = await getUserSubscription(userId);
    const hasSubscription = await hasExistingSubscription(userId);

    res.json({
      success: true,
      status: 'success',
      data: {
        userId,
        hasSubscription,
        subscription: subscription ? {
          planId: subscription.planId,
          planName: subscription.planName,
          status: subscription.status,
          provider: subscription.provider,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          usage: subscription.usage
        } : null
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

/**
 * Get full subscription details
 * GET /subscription/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      data: subscription
    });

  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get subscription'
    });
  }
});

/**
 * Cancel subscription
 * POST /subscription/cancel
 */
router.post('/cancel', async (req, res) => {
  try {
    const { userId, cancelAtPeriodEnd = true, provider, subscriptionId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Get current subscription to verify
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    if (subscription.planId === 'free') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel free plan'
      });
    }

    // If provider subscription ID is provided, cancel with provider first
    // This would be handled by the respective webhook handlers when they receive the cancellation event
    
    // Update local subscription status
    await cancelSubscription(userId, cancelAtPeriodEnd);

    res.json({
      success: true,
      message: cancelAtPeriodEnd 
        ? 'Subscription will be cancelled at the end of the billing period'
        : 'Subscription cancelled immediately',
      data: {
        userId,
        cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
});

/**
 * Check if user has active paid subscription
 * GET /subscription/check-paid/:userId
 */
router.get('/check-paid/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const hasPaid = await hasActivePaidSubscription(userId);

    res.json({
      success: true,
      data: {
        userId,
        hasActivePaidSubscription: hasPaid
      }
    });

  } catch (error) {
    console.error('Error checking paid subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check subscription'
    });
  }
});

/**
 * Validate subscription access (for feature gating)
 * POST /subscription/validate-access
 */
router.post('/validate-access', async (req, res) => {
  try {
    const { userId, requiredPlan, requiredFeature } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          hasAccess: false,
          reason: 'no_subscription'
        }
      });
    }

    // Check if subscription is active
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return res.json({
        success: true,
        data: {
          hasAccess: false,
          reason: 'subscription_inactive',
          status: subscription.status
        }
      });
    }

    // If specific plan is required, check plan tier
    if (requiredPlan) {
      const planHierarchy = ['free', 'pro', 'team', 'enterprise'];
      const currentPlanIndex = planHierarchy.indexOf(subscription.planId);
      const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

      if (currentPlanIndex < requiredPlanIndex) {
        return res.json({
          success: true,
          data: {
            hasAccess: false,
            reason: 'insufficient_plan',
            currentPlan: subscription.planId,
            requiredPlan
          }
        });
      }
    }

    res.json({
      success: true,
      data: {
        hasAccess: true,
        planId: subscription.planId,
        status: subscription.status
      }
    });

  } catch (error) {
    console.error('Error validating access:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate access'
    });
  }
});

console.log('Subscription routes initialized with endpoints:');
console.log('- POST /create');
console.log('- POST /status');
console.log('- GET /:userId');
console.log('- POST /cancel');
console.log('- GET /check-paid/:userId');
console.log('- POST /validate-access');

export default router;
