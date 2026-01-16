import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';
// Razorpay removed - import Razorpay from 'razorpay';
import { db, isFirebaseInitialized } from '../config/firebase-admin';
import { 
  // shouldUseRazorpay removed,
  // mapRazorpayStatus removed,
  mapPaddleStatus,
  PaymentProvider,
  WebhookEvent
} from '../types/subscription';
import { 
  updateSubscriptionFromWebhook,
  upsertSubscription,
  getUserSubscription,
  resetUsageForNewPeriod
} from '../services/subscriptionService';

dotenv.config();

const router = express.Router();

console.log('Payment routes being initialized...');

// Razorpay removed - all payments use Paddle
const hasRazorpayCredentials = false;
const razorpay: any = null;

// Check if Paddle credentials are available
const hasPaddleCredentials = process.env.PADDLE_API_KEY && process.env.PADDLE_WEBHOOK_SECRET;

// Debug middleware for payment routes
router.use((req, res, next) => {
  console.log('Payment route received request:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    body: req.body,
    headers: {
      'content-type': req.headers['content-type'],
      'x-razorpay-signature': req.headers['x-razorpay-signature'] ? 'present' : 'absent',
      'paddle-signature': req.headers['paddle-signature'] ? 'present' : 'absent'
    }
  });
  next();
});

// ============================================
// GEO DETECTION
// ============================================

/**
 * Detect user's country from IP
 * GET /payment/detect-country
 */
router.get('/detect-country', async (req, res) => {
  try {
    // Get client IP
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               '';
    
    const clientIp = Array.isArray(ip) ? ip[0] : ip.split(',')[0].trim();
    
    console.log('Detecting country for IP:', clientIp);
    
    // For development/localhost, default to a test value
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('192.168')) {
      return res.json({
        success: true,
        data: {
          country: process.env.DEFAULT_COUNTRY || 'IN',
          countryName: 'India (Development)',
          source: 'default',
          ip: clientIp
        }
      });
    }
    
    // Use a free IP geolocation service
    try {
      const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`);
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        return res.json({
          success: true,
          data: {
            country: geoData.country_code || 'US',
            countryName: geoData.country_name || 'Unknown',
            source: 'ipapi',
            ip: clientIp
          }
        });
      }
    } catch (geoError) {
      console.warn('IP geolocation failed:', geoError);
    }
    
    // Fallback
    return res.json({
      success: true,
      data: {
        country: 'US',
        countryName: 'Unknown',
        source: 'fallback',
        ip: clientIp
      }
    });
  } catch (error) {
    console.error('Error detecting country:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect country'
    });
  }
});

/**
 * Determine payment provider based on country
 * POST /payment/determine-provider
 */
router.post('/determine-provider', (req, res) => {
  try {
    const { country, billingCountry } = req.body;
    
    // Priority: billing country > detected country
    const effectiveCountry = billingCountry || country || 'US';
    const provider: PaymentProvider = 'paddle'; // Razorpay removed
    
    return res.json({
      success: true,
      data: {
        provider,
        country: effectiveCountry,
        razorpayAvailable: false, // Razorpay removed
        paddleAvailable: hasPaddleCredentials
      }
    });
  } catch (error) {
    console.error('Error determining provider:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to determine provider'
    });
  }
});

// ============================================
// RAZORPAY ENDPOINTS
// ============================================

/**
 * Create Razorpay order
 * POST /payment/create-order
 */
router.post('/create-order', async (req, res) => {
  // Razorpay removed - endpoint disabled
  return res.status(503).json({
    success: false,
    status: 'error',
    message: 'Razorpay has been removed. Please use Paddle for payments.'
  });
  
  /* DISABLED - Razorpay removed
  try {
    if (!hasRazorpayCredentials || !razorpay) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    const { amount, currency, planId, userId, billingCycle } = req.body;
    
    if (!amount || !currency || !planId) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Amount, currency, and planId are required'
      });
    }

    const amountInPaise = parseInt(amount);
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Invalid amount'
      });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: planId,
        userId: userId,
        billingCycle: billingCycle || 'monthly'
      }
    });

    // Store order in Firestore for tracking
    if (isFirebaseInitialized() && db) {
      await db.collection('orders').doc(order.id).set({
        ...order,
        userId,
        planId,
        billingCycle: billingCycle || 'monthly',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'created'
      });
    }

    res.json({
      success: true,
      status: 'success',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create order'
    });
  }
  */
});

/**
 * Verify Razorpay payment signature
 */
const verifyPaymentHandler = async (req: express.Request, res: express.Response) => {
  // Razorpay removed - endpoint disabled
  return res.status(503).json({
    success: false,
    status: 'error',
    message: 'Razorpay has been removed. Please use Paddle for payments.'
  });
  
  /* DISABLED - Razorpay removed
  try {
    if (!hasRazorpayCredentials) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Payment service is not configured. Please contact support.'
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planId, billingCycle } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Missing required payment verification data'
      });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Update subscription in Firestore
      if (userId && planId && isFirebaseInitialized() && db) {
        // Calculate period end based on billing cycle
        const periodStart = new Date();
        const periodEnd = new Date();
        if (billingCycle === 'yearly') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        await upsertSubscription(userId, {
          planId,
          planName: planId.charAt(0).toUpperCase() + planId.slice(1),
          status: 'active',
          provider: 'razorpay',
          cancelAtPeriodEnd: false,
          currentPeriodStart: periodStart.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          usage: { skyboxGenerations: 0 } // Reset usage on new subscription
        });

        // Update order status
        await db.collection('orders').doc(razorpay_order_id).update({
          status: 'paid',
          paymentId: razorpay_payment_id,
          paidAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return res.json({
        success: true,
        status: 'success',
        message: 'Payment verified successfully'
      });
    }

    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'Invalid signature'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to verify payment'
    });
  }
  */
};

router.post('/verify-payment', verifyPaymentHandler);
router.post('/verify', verifyPaymentHandler);

/**
 * Razorpay Webhook Handler
 * POST /payment/razorpay/webhook
 */
router.post('/razorpay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Razorpay removed - endpoint disabled
  return res.status(503).json({ 
    error: 'Razorpay has been removed. Please use Paddle for payments.',
    received: false 
  });
  
  /* DISABLED - Razorpay removed
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    
    if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    // Verify webhook signature
    const body = req.body.toString();
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);
    const eventId = event.event_id || `rz_${Date.now()}`;
    const eventType = event.event;
    const payload = event.payload;

    console.log('Razorpay webhook received:', eventType, eventId);

    // Extract user ID from subscription notes
    let userId: string | undefined;
    if (payload.subscription?.entity?.notes?.userId) {
      userId = payload.subscription.entity.notes.userId;
    } else if (payload.payment?.entity?.notes?.userId) {
      userId = payload.payment.entity.notes.userId;
    }

    if (!userId) {
      console.warn('No userId found in webhook payload');
      return res.json({ received: true, processed: false, reason: 'no_user_id' });
    }

    // Map event to status
    const newStatus = mapRazorpayStatus(eventType);
    
    if (newStatus) {
      const webhookEvent: WebhookEvent = {
        id: eventId,
        type: eventType,
        provider: 'razorpay',
        data: payload
      };

      const updates: any = { status: newStatus };

      // Handle subscription-specific data
      if (payload.subscription?.entity) {
        const sub = payload.subscription.entity;
        updates.providerSubscriptionId = sub.id;
        if (sub.current_start) {
          updates.currentPeriodStart = new Date(sub.current_start * 1000).toISOString();
        }
        if (sub.current_end) {
          updates.currentPeriodEnd = new Date(sub.current_end * 1000).toISOString();
        }
      }

      // Reset usage on new billing period
      if (eventType === 'subscription.charged') {
        await resetUsageForNewPeriod(userId);
      }

      const processed = await updateSubscriptionFromWebhook(userId, eventId, updates, webhookEvent);
      
      return res.json({ received: true, processed });
    }

    return res.json({ received: true, processed: false, reason: 'unhandled_event' });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
  */
});

// ============================================
// PADDLE ENDPOINTS
// ============================================

/**
 * Create or get Paddle customer
 * POST /payment/paddle/customer
 */
router.post('/paddle/customer', async (req, res) => {
  try {
    if (!hasPaddleCredentials) {
      return res.status(503).json({
        success: false,
        error: 'Paddle not configured'
      });
    }

    const { email, userId } = req.body;

    // Check if user already has a Paddle customer ID
    const subscription = await getUserSubscription(userId);
    if (subscription?.providerCustomerId && subscription?.provider === 'paddle') {
      return res.json({
        success: true,
        data: { customerId: subscription.providerCustomerId }
      });
    }

    // Create new Paddle customer via API
    const paddleResponse = await fetch('https://api.paddle.com/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        custom_data: { userId }
      })
    });

    if (!paddleResponse.ok) {
      throw new Error('Failed to create Paddle customer');
    }

    const paddleData = await paddleResponse.json();
    const customerId = paddleData.data?.id;

    // Store customer ID
    if (userId && customerId) {
      await upsertSubscription(userId, {
        providerCustomerId: customerId,
        provider: 'paddle'
      });
    }

    return res.json({
      success: true,
      data: { customerId }
    });
  } catch (error) {
    console.error('Error creating Paddle customer:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
});

/**
 * Get Paddle customer portal URL
 * POST /payment/paddle/portal
 */
router.post('/paddle/portal', async (req, res) => {
  try {
    if (!hasPaddleCredentials) {
      return res.status(503).json({
        success: false,
        error: 'Paddle not configured'
      });
    }

    const { customerId } = req.body;

    // Get portal session from Paddle
    const paddleResponse = await fetch('https://api.paddle.com/customers/' + customerId + '/portal-sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!paddleResponse.ok) {
      throw new Error('Failed to create portal session');
    }

    const data = await paddleResponse.json();
    
    return res.json({
      success: true,
      data: { url: data.data?.urls?.general }
    });
  } catch (error) {
    console.error('Error getting Paddle portal:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get portal URL'
    });
  }
});

/**
 * Cancel Paddle subscription
 * POST /payment/paddle/cancel
 */
router.post('/paddle/cancel', async (req, res) => {
  try {
    if (!hasPaddleCredentials) {
      return res.status(503).json({
        success: false,
        error: 'Paddle not configured'
      });
    }

    const { subscriptionId, effectiveFrom = 'next_billing_period' } = req.body;

    const paddleResponse = await fetch(`https://api.paddle.com/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        effective_from: effectiveFrom
      })
    });

    if (!paddleResponse.ok) {
      throw new Error('Failed to cancel subscription');
    }

    return res.json({
      success: true,
      message: 'Subscription cancellation scheduled'
    });
  } catch (error) {
    console.error('Error cancelling Paddle subscription:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

/**
 * Paddle Webhook Handler
 * POST /payment/paddle/webhook
 */
router.post('/paddle/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['paddle-signature'] as string;
    
    if (!signature || !process.env.PADDLE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    // Verify Paddle webhook signature
    const body = req.body.toString();
    const ts = signature.split(';').find(s => s.startsWith('ts='))?.replace('ts=', '');
    const h1 = signature.split(';').find(s => s.startsWith('h1='))?.replace('h1=', '');

    if (!ts || !h1) {
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    const signedPayload = `${ts}:${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET)
      .update(signedPayload)
      .digest('hex');

    if (h1 !== expectedSignature) {
      console.error('Invalid Paddle webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body);
    const eventId = event.event_id || `paddle_${Date.now()}`;
    const eventType = event.event_type;
    const data = event.data;

    console.log('Paddle webhook received:', eventType, eventId);

    // Extract user ID from custom data
    let userId: string | undefined;
    if (data.custom_data?.userId) {
      userId = data.custom_data.userId;
    } else if (data.subscription?.custom_data?.userId) {
      userId = data.subscription.custom_data.userId;
    }

    if (!userId) {
      console.warn('No userId found in Paddle webhook payload');
      return res.json({ received: true, processed: false, reason: 'no_user_id' });
    }

    // Map event to status
    const newStatus = mapPaddleStatus(eventType);
    
    if (newStatus) {
      const webhookEvent: WebhookEvent = {
        id: eventId,
        type: eventType,
        provider: 'paddle',
        data
      };

      const updates: any = { 
        status: newStatus,
        provider: 'paddle'
      };

      // Handle subscription data
      if (data.id) {
        updates.providerSubscriptionId = data.id;
      }
      if (data.customer_id) {
        updates.providerCustomerId = data.customer_id;
      }
      if (data.current_billing_period) {
        updates.currentPeriodStart = data.current_billing_period.starts_at;
        updates.currentPeriodEnd = data.current_billing_period.ends_at;
      }
      if (data.scheduled_change?.action === 'cancel') {
        updates.cancelAtPeriodEnd = true;
      }

      // Extract plan from items
      if (data.items?.[0]?.price?.product_id) {
        const productId = data.items[0].price.product_id;
        // Map Paddle product ID to internal plan ID
        // This should be configured in env or database
        updates.planId = mapPaddleProductToPlan(productId);
      }

      // Reset usage on new billing period for charged events
      if (eventType === 'transaction.completed' || eventType === 'subscription.activated') {
        await resetUsageForNewPeriod(userId);
      }

      const processed = await updateSubscriptionFromWebhook(userId, eventId, updates, webhookEvent);
      
      return res.json({ received: true, processed });
    }

    return res.json({ received: true, processed: false, reason: 'unhandled_event' });
  } catch (error) {
    console.error('Error processing Paddle webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Map Paddle product ID to internal plan ID
 */
function mapPaddleProductToPlan(productId: string): string {
  const mapping: Record<string, string> = {
    [process.env.PADDLE_PRO_PRODUCT_ID || '']: 'pro',
    [process.env.PADDLE_TEAM_PRODUCT_ID || '']: 'team',
    [process.env.PADDLE_ENTERPRISE_PRODUCT_ID || '']: 'enterprise'
  };
  return mapping[productId] || 'pro';
}

console.log('Payment routes initialized with endpoints:');
console.log('- GET /detect-country');
console.log('- POST /determine-provider');
console.log('- POST /create-order');
console.log('- POST /verify-payment');
console.log('- POST /verify');
console.log('- POST /razorpay/webhook');
console.log('- POST /paddle/customer');
console.log('- POST /paddle/portal');
console.log('- POST /paddle/cancel');
console.log('- POST /paddle/webhook');

export default router;
