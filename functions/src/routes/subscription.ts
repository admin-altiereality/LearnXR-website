/**
 * Subscription-related routes
 * Complete rewrite for Razorpay payment flow
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { initializeServices, razorpay } from '../utils/services';
import { getSecret } from '../utils/config';

const router = Router();

/**
 * GET /subscription/verify-credentials
 * Verify Razorpay credentials match dashboard (for debugging)
 */
router.get('/verify-credentials', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    // Get raw secrets to check for issues
    const rawKeyId = process.env.RAZORPAY_KEY_ID || '';
    const rawKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    
    // Get cleaned secrets (getSecret already cleans them)
    const keyId = getSecret('RAZORPAY_KEY_ID');
    const keySecret = getSecret('RAZORPAY_KEY_SECRET');
    
    // Check for newlines in raw secrets
    const keyIdHasNewlines = rawKeyId.includes('\n') || rawKeyId.includes('\r');
    const keySecretHasNewlines = rawKeySecret.includes('\n') || rawKeySecret.includes('\r');
    
    // Show first 8 and last 4 characters for verification
    const keyIdDisplay = keyId 
      ? `${keyId.substring(0, 8)}...${keyId.substring(keyId.length - 4)}` 
      : 'NOT SET';
    
    const keySecretDisplay = keySecret 
      ? `${keySecret.substring(0, 4)}...${keySecret.substring(keySecret.length - 4)}` 
      : 'NOT SET';
    
    // Initialize to verify
    initializeServices({
      razorpayKeyId: keyId,
      razorpayKeySecret: keySecret
    });
    
    // Try to verify credentials work by attempting to list plans
    let credentialsValid = false;
    let errorMessage = null;
    let testResult = null;
    
    if (razorpay) {
      try {
        // Try a simple API call to verify credentials - list plans (limit 1)
        const plans = await razorpay.plans.all({ count: 1 });
        credentialsValid = true;
        testResult = {
          method: 'plans.all',
          success: true,
          plansFound: plans?.items?.length || 0
        };
      } catch (testError: any) {
        credentialsValid = false;
        errorMessage = testError.error?.description || testError.message || 'Unknown error';
        testResult = {
          method: 'plans.all',
          success: false,
          error: testError.error?.code || 'UNKNOWN',
          description: errorMessage
        };
      }
    }
    
    return res.json({
      success: true,
      data: {
        credentials: {
          keyId: {
            present: !!keyId,
            length: keyId?.length || 0,
            rawLength: rawKeyId?.length || 0,
            display: keyIdDisplay,
            format: keyId?.startsWith('rzp_') ? 'VALID' : 'INVALID (should start with rzp_)',
            isTestMode: keyId?.includes('test') || false,
            hasNewlines: keyIdHasNewlines,
            issue: keyIdHasNewlines ? '⚠️ Key ID contains newlines - this causes authentication to fail!' : null
          },
          keySecret: {
            present: !!keySecret,
            length: keySecret?.length || 0,
            rawLength: rawKeySecret?.length || 0,
            display: keySecretDisplay,
            format: keySecret && keySecret.length >= 20 ? 'VALID' : 'INVALID (too short)',
            hasNewlines: keySecretHasNewlines,
            issue: keySecretHasNewlines ? '⚠️ Key Secret contains newlines - this causes authentication to fail!' : null
          }
        },
        razorpayInitialized: !!razorpay,
        credentialsValid,
        testResult,
        error: errorMessage,
        instructions: {
          step1: 'Go to Razorpay Dashboard → Settings → API Keys',
          step2: 'Check your Key ID (should match the display above)',
          step3: 'Check your Key Secret (should match the display above)',
          step4: 'Ensure you\'re checking the correct mode (Test/Live)',
          step5: 'If they don\'t match, update Firebase Secrets with correct values',
          fixNewlines: keyIdHasNewlines || keySecretHasNewlines ? {
            problem: 'Your secrets contain newline characters (\\r\\n) which cause authentication to fail',
            solution: 'Update Firebase Secrets and make sure to copy-paste WITHOUT newlines',
            command: 'firebase functions:secrets:set RAZORPAY_KEY_ID\nfirebase functions:secrets:set RAZORPAY_KEY_SECRET'
          } : null
        }
      },
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error verifying credentials:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify credentials',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

/**
 * POST /subscription/create
 * Creates a Razorpay subscription
 * 
 * Request body:
 * - userId: Firebase user ID
 * - planId: Razorpay plan ID (e.g., plan_RvpkuZw6KeqRQL)
 * - planName: Internal plan name (e.g., "Team")
 * - billingCycle: "monthly" | "yearly"
 * - userEmail: User's email address
 * - customerId: (optional) Existing Razorpay customer ID
 * 
 * Response:
 * - success: boolean
 * - data: { subscription_id, status, auth_link, key_id, customer_id }
 */
router.post('/create', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { 
    userId, 
    planId,           // Razorpay plan ID
    planName, 
    billingCycle, 
    userEmail, 
    customerId,
    // Optional: for updating existing subscription after payment
    providerSubscriptionId,
    razorpayPaymentId,
    razorpaySignature,
    orderId,
    paymentId
  } = req.body;
  
  try {
    console.log(`[${requestId}] ========== SUBSCRIPTION CREATE REQUEST ==========`);
    console.log(`[${requestId}] Request body:`, {
      userId,
      planId,
      planName,
      billingCycle,
      userEmail: userEmail ? `${userEmail.substring(0, 3)}***` : 'missing',
      hasCustomerId: !!customerId,
      hasProviderSubscriptionId: !!providerSubscriptionId,
      hasOrderId: !!orderId,
      hasPaymentId: !!paymentId
    });
    
    // Validate required fields
    if (!userId) {
      console.error(`[${requestId}] ❌ Missing userId`);
      return res.status(400).json({
        success: false,
        error: 'userId is required',
        requestId
      });
    }
    
    if (!planId) {
      console.error(`[${requestId}] ❌ Missing planId`);
      return res.status(400).json({
        success: false,
        error: 'planId is required',
        requestId
      });
    }
    
    // Initialize Razorpay service
    console.log(`[${requestId}] Initializing Razorpay service...`);
    
    // Check if secrets are available
    let keyId = getSecret('RAZORPAY_KEY_ID');
    let keySecret = getSecret('RAZORPAY_KEY_SECRET');
    
    // Clean secrets to remove any newlines or whitespace
    const cleanSecret = (s: string) => s.trim().replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '').trim();
    keyId = cleanSecret(keyId);
    keySecret = cleanSecret(keySecret);
    
    console.log(`[${requestId}] Razorpay credentials check:`, {
      hasKeyId: !!keyId,
      keyIdLength: keyId?.length || 0,
      keyIdPrefix: keyId ? `${keyId.substring(0, 8)}...` : 'missing',
      keyIdHasNewlines: keyId?.includes('\n') || keyId?.includes('\r'),
      hasKeySecret: !!keySecret,
      keySecretLength: keySecret?.length || 0,
      keySecretPrefix: keySecret ? `${keySecret.substring(0, 4)}...` : 'missing',
      keySecretHasNewlines: keySecret?.includes('\n') || keySecret?.includes('\r')
    });
    
    // Re-initialize with explicit secrets to ensure they're used
    initializeServices({
      razorpayKeyId: keyId,
      razorpayKeySecret: keySecret
    });
    
    if (!razorpay) {
      console.error(`[${requestId}] ❌ Razorpay service not initialized`);
      return res.status(500).json({
        success: false,
        error: 'Razorpay service not available',
        details: 'Razorpay credentials not configured',
        requestId
      });
    }
    console.log(`[${requestId}] ✅ Razorpay service initialized`);
    
    // SCENARIO 1: Update existing subscription after payment
    if (providerSubscriptionId) {
      console.log(`[${requestId}] Updating existing subscription: ${providerSubscriptionId}`);
      const db = admin.firestore();
      const subscriptionRef = db.collection('subscriptions').doc(providerSubscriptionId);
      const subscriptionDoc = await subscriptionRef.get();
      
      if (subscriptionDoc.exists) {
        await subscriptionRef.update({
          userId,
          planId: planId,
          planName: planName || 'Unknown',
          billingCycle: billingCycle || 'monthly',
          razorpayPaymentId: razorpayPaymentId || paymentId,
          razorpaySignature,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[${requestId}] ✅ Subscription updated`);
        return res.json({
          success: true,
          data: {
            subscription_id: providerSubscriptionId,
            status: 'updated'
          },
          requestId
        });
      }
    }
    
    // SCENARIO 2: Create subscription from verified one-time payment
    if (orderId && paymentId) {
      console.log(`[${requestId}] Creating subscription from verified payment`);
      const db = admin.firestore();
      
      // Calculate billing period
      const periodStart = new Date();
      const periodEnd = new Date();
      if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      
      // Create subscription record
      const subscriptionData = {
        userId,
        planId,
        planName: planName || planId,
        billingCycle: billingCycle || 'monthly',
        status: 'active',
        provider: 'razorpay',
        orderId,
        paymentId,
        currentPeriodStart: periodStart.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('subscriptions').doc(orderId).set(subscriptionData);
      console.log(`[${requestId}] ✅ Subscription created from payment`);
      
      return res.json({
        success: true,
        data: {
          subscription_id: orderId,
          status: 'active'
        },
        requestId
      });
    }
    
    // SCENARIO 3: Create new Razorpay subscription (main flow)
    if (!userEmail) {
      console.error(`[${requestId}] ❌ Missing userEmail`);
      return res.status(400).json({
        success: false,
        error: 'userEmail is required for subscription creation',
        requestId
      });
    }
    
    // Calculate total_count (number of billing cycles)
    // For yearly: 1 cycle, for monthly: 12 cycles
    const totalCount = billingCycle === 'yearly' ? 1 : 12;
    console.log(`[${requestId}] Billing cycle: ${billingCycle}, total_count: ${totalCount}`);
    
    // Get or create Razorpay customer
    let finalCustomerId = customerId;
    
    if (!finalCustomerId) {
      try {
        console.log(`[${requestId}] Checking for existing customer...`);
        const db = admin.firestore();
        const customerRef = db.collection('razorpay_customers')
          .where('userId', '==', userId)
          .limit(1);
        const existingCustomers = await customerRef.get();
        
        if (!existingCustomers.empty) {
          finalCustomerId = existingCustomers.docs[0].data().customerId;
          console.log(`[${requestId}] ✅ Using existing customer: ${finalCustomerId}`);
        } else {
          console.log(`[${requestId}] Creating new Razorpay customer...`);
          // Create new Razorpay customer
          const customerData: any = {
            email: userEmail,
            notes: { userId }
          };
          
          const customer = await razorpay.customers.create(customerData);
          finalCustomerId = customer.id;
          
          console.log(`[${requestId}] ✅ Created new Razorpay customer: ${finalCustomerId}`);
          
          // Store in Firestore
          await db.collection('razorpay_customers').doc(customer.id).set({
            customerId: customer.id,
            userId,
            userEmail,
            customerData: customer,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (customerError: any) {
        console.error(`[${requestId}] ⚠️ Error with customer (continuing anyway):`, {
          message: customerError.message,
          error: customerError.error,
          statusCode: customerError.statusCode
        });
        // Continue without customer_id - Razorpay will create one
      }
    } else {
      console.log(`[${requestId}] Using provided customer ID: ${finalCustomerId}`);
    }
    
    // Prepare subscription data for Razorpay
    const subscriptionData: any = {
      plan_id: planId, // Razorpay plan ID
      customer_notify: 1,
      total_count: totalCount,
      notes: {
        userId,
        planName: planName || 'Unknown',
        billingCycle: billingCycle || 'monthly'
      }
    };
    
    // Add customer_id if available
    if (finalCustomerId) {
      subscriptionData.customer_id = finalCustomerId;
    } else {
      // Fallback: use email
      subscriptionData.customer = {
        email: userEmail
      };
    }
    
    console.log(`[${requestId}] Creating Razorpay subscription with data:`, {
      plan_id: subscriptionData.plan_id,
      customer_id: subscriptionData.customer_id || 'using email',
      total_count: subscriptionData.total_count,
      hasCustomer: !!subscriptionData.customer_id
    });
    
    // Create subscription via Razorpay API
    let subscription;
    try {
      // Verify Razorpay instance has credentials
      if (!razorpay || !razorpay.key_id) {
        console.error(`[${requestId}] ❌ Razorpay instance invalid or missing credentials`);
        return res.status(500).json({
          success: false,
          error: 'Razorpay instance not properly initialized',
          details: 'Missing key_id in Razorpay instance',
          requestId
        });
      }
      
      console.log(`[${requestId}] Razorpay instance verified, key_id: ${razorpay.key_id?.substring(0, 4)}...`);
      
      subscription = await razorpay.subscriptions.create(subscriptionData);
      console.log(`[${requestId}] ✅ Razorpay subscription created:`, {
        id: subscription.id,
        status: subscription.status,
        hasAuthLink: !!subscription.auth_link
      });
    } catch (razorpayError: any) {
      console.error(`[${requestId}] ❌ Razorpay API error:`, {
        message: razorpayError.message,
        statusCode: razorpayError.statusCode,
        error: razorpayError.error,
        description: razorpayError.description,
        field: razorpayError.field,
        source: razorpayError.source,
        step: razorpayError.step,
        reason: razorpayError.reason,
        metadata: razorpayError.metadata,
        // Include request details for debugging
        requestPlanId: planId,
        requestCustomerId: finalCustomerId,
        requestTotalCount: totalCount
      });
      
      // Return detailed error
      return res.status(razorpayError.statusCode || 500).json({
        success: false,
        error: 'Failed to create Razorpay subscription',
        details: razorpayError.error?.description || 
                 razorpayError.description || 
                 razorpayError.message ||
                 'Unknown Razorpay error',
        errorCode: razorpayError.error?.code,
        field: razorpayError.field,
        requestId
      });
    }
    
    // Validate subscription response
    if (!subscription || !subscription.id) {
      console.error(`[${requestId}] ❌ Invalid subscription response:`, subscription);
      return res.status(500).json({
        success: false,
        error: 'Invalid subscription response from Razorpay',
        details: 'Subscription missing id property',
        requestId
      });
    }
    
    // Save subscription to Firestore
    console.log(`[${requestId}] Saving subscription to Firestore...`);
    const db = admin.firestore();
    try {
      await db.collection('subscriptions').doc(subscription.id).set({
        ...subscription,
        userId,
        planId: planId, // Store Razorpay plan ID
        planName: planName || 'Unknown',
        customerId: finalCustomerId || subscription.customer_id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: subscription.status
      });
      console.log(`[${requestId}] ✅ Subscription saved to Firestore`);
    } catch (firestoreError: any) {
      console.error(`[${requestId}] ⚠️ Error saving to Firestore (subscription still created):`, firestoreError);
      // Don't fail the request if Firestore save fails - subscription is already created in Razorpay
    }
    
    console.log(`[${requestId}] ========== SUBSCRIPTION CREATE SUCCESS ==========`);
    console.log(`[${requestId}] Subscription ID: ${subscription.id}`);
    console.log(`[${requestId}] Status: ${subscription.status}`);
    console.log(`[${requestId}] Auth Link: ${subscription.auth_link || 'N/A'}`);
    
    // Return success response
    return res.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        auth_link: subscription.auth_link || null,
        key_id: getSecret('RAZORPAY_KEY_ID'),
        customer_id: finalCustomerId || subscription.customer_id
      },
      requestId
    });
    
  } catch (error: any) {
    console.error(`[${requestId}] ❌❌❌ UNEXPECTED ERROR ❌❌❌`);
    console.error(`[${requestId}] Error:`, error);
    console.error(`[${requestId}] Stack:`, error.stack);
    console.error(`[${requestId}] ===========================================`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

/**
 * GET /subscription/:subscriptionId
 * Get subscription details
 */
router.get('/:subscriptionId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { subscriptionId } = req.params;
  
  try {
    console.log(`[${requestId}] Fetching subscription: ${subscriptionId}`);
    initializeServices();
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    const subscription = await razorpay.subscriptions.fetch(subscriptionId);
    
    return res.json({
      success: true,
      data: subscription,
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error fetching subscription:`, {
      subscriptionId,
      message: error.message,
      error: error.error,
      statusCode: error.statusCode
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export default router;
