/**
 * Subscription-related routes
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import * as admin from 'firebase-admin';
import { initializeServices, razorpay } from '../utils/services';
import { getSecret } from '../utils/config';

const router = Router();

// Create or get Razorpay customer
router.post('/customer', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId, userEmail, userName } = req.body;
  
  try {
    console.log(`[${requestId}] Creating/fetching Razorpay customer:`, { userId, userEmail });
    
    initializeServices();
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userEmail is required',
        requestId
      });
    }
    
    // Check if customer already exists in Firestore
    const db = admin.firestore();
    const customerRef = db.collection('razorpay_customers').where('userId', '==', userId).limit(1);
    const existingCustomers = await customerRef.get();
    
    if (!existingCustomers.empty) {
      const existingCustomer = existingCustomers.docs[0].data();
      console.log(`[${requestId}] Found existing customer:`, existingCustomer.customerId);
      return res.json({
        success: true,
        data: {
          customer_id: existingCustomer.customerId,
          customer: existingCustomer.customerData
        },
        requestId
      });
    }
    
    // Create new Razorpay customer
    const customerData: any = {
      email: userEmail,
      notes: {
        userId: userId
      }
    };
    
    if (userName) {
      customerData.name = userName;
    }
    
    const customer = await razorpay.customers.create(customerData);
    
    // Store customer in Firestore
    await db.collection('razorpay_customers').doc(customer.id).set({
      customerId: customer.id,
      userId,
      userEmail,
      customerData: customer,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[${requestId}] Razorpay customer created:`, customer.id);
    
    return res.json({
      success: true,
      data: {
        customer_id: customer.id,
        customer: customer
      },
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Error creating customer:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create customer',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

router.post('/create', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { userId, planId, planName, billingCycle, userEmail, customerId } = req.body;
  
  try {
    console.log(`[${requestId}] Creating subscription:`, { userId, planId, planName, billingCycle, customerId });
    
    initializeServices();
    
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured',
        requestId
      });
    }
    
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'planId is required',
        requestId
      });
    }
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userEmail is required for subscription creation',
        requestId
      });
    }
    
    // Determine total_count based on billing cycle
    // For yearly plans, total_count should be 1 (one year), for monthly it's 12 (12 months)
    const totalCount = billingCycle === 'yearly' ? 1 : 12;
    
    // Create or get customer first
    let finalCustomerId = customerId;
    
    if (!finalCustomerId && userEmail) {
      try {
        // Try to get existing customer
        const db = admin.firestore();
        const customerRef = db.collection('razorpay_customers').where('userId', '==', userId).limit(1);
        const existingCustomers = await customerRef.get();
        
        if (!existingCustomers.empty) {
          finalCustomerId = existingCustomers.docs[0].data().customerId;
          console.log(`[${requestId}] Using existing customer:`, finalCustomerId);
        } else {
          // Create new customer
          const customerData: any = {
            email: userEmail,
            notes: { userId }
          };
          const customer = await razorpay.customers.create(customerData);
          finalCustomerId = customer.id;
          
          // Store in Firestore
          await db.collection('razorpay_customers').doc(customer.id).set({
            customerId: customer.id,
            userId,
            userEmail,
            customerData: customer,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[${requestId}] Created new customer:`, finalCustomerId);
        }
      } catch (customerError) {
        console.error(`[${requestId}] Error creating/fetching customer:`, customerError);
        // Continue without customer_id - Razorpay will create one automatically
      }
    }
    
    // Create subscription with customer_id
    const subscriptionData: any = {
      plan_id: planId,
      customer_notify: 1,
      total_count: totalCount,
      notes: {
        userId,
        planName,
        billingCycle: billingCycle || 'monthly'
      }
    };
    
    // Use customer_id if available (preferred method)
    if (finalCustomerId) {
      subscriptionData.customer_id = finalCustomerId;
    } else if (userEmail) {
      // Fallback to email if customer_id not available
      subscriptionData.customer = {
        email: userEmail
      };
    }
    
    console.log(`[${requestId}] Creating Razorpay subscription with data:`, JSON.stringify(subscriptionData, null, 2));
    
    const subscription = await razorpay.subscriptions.create(subscriptionData);
    
    console.log(`[${requestId}] Razorpay subscription response:`, JSON.stringify(subscription, null, 2));
    
    // Validate subscription response
    if (!subscription || !subscription.id) {
      console.error(`[${requestId}] Invalid subscription response from Razorpay:`, subscription);
      return res.status(500).json({
        success: false,
        error: 'Invalid subscription response from Razorpay',
        details: 'Subscription object missing id property',
        requestId
      });
    }
    
    const db = admin.firestore();
    await db.collection('subscriptions').doc(subscription.id).set({
      ...subscription,
      userId,
      planName,
      customerId: finalCustomerId || subscription.customer_id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: subscription.status
    });
    
    console.log(`[${requestId}] Subscription created successfully:`, subscription.id);
    console.log(`[${requestId}] Subscription status:`, subscription.status);
    console.log(`[${requestId}] Subscription auth_link:`, subscription.auth_link);
    
    return res.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        auth_link: subscription.auth_link || null, // Always include auth_link for subscription payments
        key_id: getSecret('RAZORPAY_KEY_ID'),
        customer_id: finalCustomerId || subscription.customer_id
      },
      requestId
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error creating subscription:`, error);
    console.error(`[${requestId}] Error stack:`, error.stack);
    console.error(`[${requestId}] Error details:`, JSON.stringify(error, null, 2));
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error.error?.description || 
                        error.description || 
                        error.message ||
                        errorMessage;
    
    // Check for specific Razorpay errors
    let statusCode = 500;
    if (error.statusCode) {
      statusCode = error.statusCode;
    } else if (error.error?.code === 'BAD_REQUEST_ERROR') {
      statusCode = 400;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: 'Failed to create subscription',
      details: errorDetails,
      errorCode: error.error?.code || error.code,
      requestId
    });
  }
});

router.get('/:subscriptionId', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { subscriptionId } = req.params;
  
  try {
    console.log(`[${requestId}] Fetching subscription:`, subscriptionId);
    
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
  } catch (error) {
    console.error(`[${requestId}] Error fetching subscription:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export default router;

