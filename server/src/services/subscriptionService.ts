import { getFirestore } from 'firebase-admin/firestore';
import { 
  UserSubscription, 
  SubscriptionStatus, 
  PaymentProvider,
  WebhookEvent 
} from '../types/subscription';

const SUBSCRIPTION_COLLECTION = 'subscriptions';
const WEBHOOK_EVENTS_COLLECTION = 'webhook_events';

export interface DefaultSubscription {
  userId: string;
  planId: string;
  planName?: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  usage: {
    skyboxGenerations: number;
  };
  orderId?: string;
  paymentId?: string;
  amount?: number;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  lastEventId?: string;
  lastEventAt?: string;
  processedEventIds?: string[];
}

/**
 * Creates a default subscription document for a new user on the server-side
 */
export const createDefaultSubscriptionServer = async (
  userId: string, 
  planId: string = 'free',
  provider: PaymentProvider = 'razorpay'
): Promise<DefaultSubscription> => {
  const db = getFirestore();
  
  const defaultSubscription: DefaultSubscription = {
    userId,
    planId,
    planName: planId.charAt(0).toUpperCase() + planId.slice(1),
    status: 'active',
    provider,
    cancelAtPeriodEnd: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usage: {
      skyboxGenerations: 0
    },
    processedEventIds: []
  };

  await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).set(defaultSubscription);
  
  console.log(`✅ Default subscription created for user: ${userId} with plan: ${planId}`);
  return defaultSubscription;
};

/**
 * Checks if a user has an existing subscription
 */
export const hasExistingSubscription = async (userId: string): Promise<boolean> => {
  const db = getFirestore();
  
  try {
    const subscriptionDoc = await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).get();
    return subscriptionDoc.exists;
  } catch (error) {
    console.error('Error checking existing subscription:', error);
    return false;
  }
};

/**
 * Get user subscription
 */
export const getUserSubscription = async (userId: string): Promise<DefaultSubscription | null> => {
  const db = getFirestore();
  
  try {
    const subscriptionDoc = await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).get();
    if (subscriptionDoc.exists) {
      const data = subscriptionDoc.data() as DefaultSubscription;
      // Ensure backward compatibility
      return {
        ...data,
        status: data.status || 'active',
        provider: data.provider || 'razorpay',
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
        processedEventIds: data.processedEventIds || []
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
};

/**
 * Creates a subscription document only if one doesn't exist
 */
export const createSubscriptionIfNotExists = async (
  userId: string, 
  planId: string = 'free',
  provider: PaymentProvider = 'razorpay'
): Promise<DefaultSubscription | null> => {
  try {
    const exists = await hasExistingSubscription(userId);
    
    if (!exists) {
      return await createDefaultSubscriptionServer(userId, planId, provider);
    } else {
      console.log(`ℹ️  User ${userId} already has a subscription`);
      return null;
    }
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

/**
 * Updates existing subscription or creates new one
 */
export const upsertSubscription = async (
  userId: string, 
  subscriptionData: Partial<DefaultSubscription>
): Promise<void> => {
  const db = getFirestore();
  
  try {
    const subscriptionRef = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (subscriptionDoc.exists) {
      // Update existing subscription
      await subscriptionRef.update({
        ...subscriptionData,
        updatedAt: new Date().toISOString()
      });
      console.log(`✅ Subscription updated for user: ${userId}`);
    } else {
      // Create new subscription
      const newSubscription: DefaultSubscription = {
        userId,
        planId: 'free',
        status: 'active',
        provider: 'razorpay',
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usage: {
          skyboxGenerations: 0
        },
        processedEventIds: [],
        ...subscriptionData
      };
      
      await subscriptionRef.set(newSubscription);
      console.log(`✅ New subscription created for user: ${userId}`);
    }
  } catch (error) {
    console.error('Error upserting subscription:', error);
    throw error;
  }
};

/**
 * Check if webhook event has already been processed (idempotency)
 */
export const isEventProcessed = async (userId: string, eventId: string): Promise<boolean> => {
  const db = getFirestore();
  
  try {
    // Check in subscription document
    const subscription = await getUserSubscription(userId);
    if (subscription?.processedEventIds?.includes(eventId)) {
      return true;
    }
    
    // Also check dedicated webhook events collection
    const eventDoc = await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId).get();
    return eventDoc.exists;
  } catch (error) {
    console.error('Error checking event processing status:', error);
    return false;
  }
};

/**
 * Mark webhook event as processed
 */
export const markEventProcessed = async (
  userId: string, 
  eventId: string,
  eventData: WebhookEvent
): Promise<void> => {
  const db = getFirestore();
  
  try {
    const batch = db.batch();
    
    // Update subscription with processed event ID
    const subscriptionRef = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    batch.update(subscriptionRef, {
      lastEventId: eventId,
      lastEventAt: new Date().toISOString(),
      processedEventIds: getFirestore().FieldValue.arrayUnion(eventId)
    });
    
    // Store event in dedicated collection for audit trail
    const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);
    batch.set(eventRef, {
      ...eventData,
      userId,
      processedAt: new Date().toISOString()
    });
    
    await batch.commit();
    console.log(`✅ Event ${eventId} marked as processed for user ${userId}`);
  } catch (error) {
    console.error('Error marking event as processed:', error);
    throw error;
  }
};

/**
 * Update subscription from webhook event
 */
export const updateSubscriptionFromWebhook = async (
  userId: string,
  eventId: string,
  updates: {
    status?: SubscriptionStatus;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    planId?: string;
    amount?: number;
  },
  eventData: WebhookEvent
): Promise<boolean> => {
  // Check idempotency first
  const alreadyProcessed = await isEventProcessed(userId, eventId);
  if (alreadyProcessed) {
    console.log(`⚠️  Event ${eventId} already processed, skipping`);
    return false;
  }
  
  // Update subscription
  await upsertSubscription(userId, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
  
  // Mark event as processed
  await markEventProcessed(userId, eventId, eventData);
  
  return true;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (
  userId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<void> => {
  const db = getFirestore();
  
  try {
    const subscriptionRef = db.collection(SUBSCRIPTION_COLLECTION).doc(userId);
    
    if (cancelAtPeriodEnd) {
      // Cancel at period end - user keeps access until period ends
      await subscriptionRef.update({
        cancelAtPeriodEnd: true,
        updatedAt: new Date().toISOString()
      });
      console.log(`✅ Subscription marked for cancellation at period end: ${userId}`);
    } else {
      // Immediate cancellation
      await subscriptionRef.update({
        status: 'canceled',
        cancelAtPeriodEnd: false,
        updatedAt: new Date().toISOString()
      });
      console.log(`✅ Subscription cancelled immediately: ${userId}`);
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
};

/**
 * Check if user has active paid subscription
 */
export const hasActivePaidSubscription = async (userId: string): Promise<boolean> => {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;
  
  return (
    subscription.planId !== 'free' &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  );
};

/**
 * Reset usage for a new billing period
 */
export const resetUsageForNewPeriod = async (userId: string): Promise<void> => {
  const db = getFirestore();
  
  try {
    await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).update({
      'usage.skyboxGenerations': 0,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ Usage reset for user: ${userId}`);
  } catch (error) {
    console.error('Error resetting usage:', error);
    throw error;
  }
};

/**
 * Expire subscription when past period end
 */
export const expireSubscription = async (userId: string): Promise<void> => {
  const db = getFirestore();
  
  try {
    await db.collection(SUBSCRIPTION_COLLECTION).doc(userId).update({
      status: 'expired',
      planId: 'free',
      cancelAtPeriodEnd: false,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ Subscription expired for user: ${userId}`);
  } catch (error) {
    console.error('Error expiring subscription:', error);
    throw error;
  }
};
