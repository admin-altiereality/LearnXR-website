import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export interface DefaultSubscription {
  userId: string;
  planId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  usage: {
    skyboxGenerations: number;
  };
}

/**
 * Creates a default subscription document for a new user on the server-side
 * @param userId - The user's unique identifier
 * @param planId - The plan ID (defaults to 'free')
 * @returns Default subscription document
 */
export const createDefaultSubscriptionServer = async (
  userId: string, 
  planId: string = 'free'
): Promise<DefaultSubscription> => {
  const db = getFirestore();
  
  const defaultSubscription: DefaultSubscription = {
    userId,
    planId,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usage: {
      skyboxGenerations: 0
    }
  };

  await db.collection('subscriptions').doc(userId).set(defaultSubscription);
  
  console.log(`✅ Default subscription created for user: ${userId} with plan: ${planId}`);
  return defaultSubscription;
};

/**
 * Checks if a user has an existing subscription
 * @param userId - The user's unique identifier
 * @returns boolean indicating if subscription exists
 */
export const hasExistingSubscription = async (userId: string): Promise<boolean> => {
  const db = getFirestore();
  
  try {
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    return subscriptionDoc.exists;
  } catch (error) {
    console.error('Error checking existing subscription:', error);
    return false;
  }
};

/**
 * Creates a subscription document only if one doesn't exist
 * @param userId - The user's unique identifier
 * @param planId - The plan ID (defaults to 'free')
 * @returns Promise<DefaultSubscription | null>
 */
export const createSubscriptionIfNotExists = async (
  userId: string, 
  planId: string = 'free'
): Promise<DefaultSubscription | null> => {
  try {
    const exists = await hasExistingSubscription(userId);
    
    if (!exists) {
      return await createDefaultSubscriptionServer(userId, planId);
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
 * @param userId - The user's unique identifier
 * @param subscriptionData - Subscription data to update/create
 * @returns Promise<void>
 */
export const upsertSubscription = async (
  userId: string, 
  subscriptionData: Partial<DefaultSubscription>
): Promise<void> => {
  const db = getFirestore();
  
  try {
    const subscriptionRef = db.collection('subscriptions').doc(userId);
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usage: {
          skyboxGenerations: 0
        },
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