import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createDefaultSubscription } from '../services/subscriptionService';
import { UserSubscription } from '../types/subscription';

/**
 * Test utility to verify subscription document creation
 */
export const testSubscriptionCreation = async (userId: string): Promise<{
  success: boolean;
  message: string;
  subscription?: UserSubscription;
}> => {
  try {
    // Check if subscription already exists
    const subscriptionRef = doc(db, 'subscriptions', userId);
    const existingDoc = await getDoc(subscriptionRef);
    
    if (existingDoc.exists()) {
      const subscription = existingDoc.data() as UserSubscription;
      return {
        success: true,
        message: 'Subscription already exists',
        subscription
      };
    }
    
    // Create a default subscription
    const subscription = await createDefaultSubscription(userId);
    
    // Verify the subscription was created
    const verifyDoc = await getDoc(subscriptionRef);
    
    if (verifyDoc.exists()) {
      const verifiedSubscription = verifyDoc.data() as UserSubscription;
      
      // Validate the subscription structure
      const isValid = 
        verifiedSubscription.userId === userId &&
        verifiedSubscription.planId === 'free' &&
        verifiedSubscription.status === 'active' &&
        verifiedSubscription.usage.skyboxGenerations === 0 &&
        verifiedSubscription.createdAt &&
        verifiedSubscription.updatedAt;
      
      if (isValid) {
        return {
          success: true,
          message: 'Subscription created and verified successfully',
          subscription: verifiedSubscription
        };
      } else {
        return {
          success: false,
          message: 'Subscription created but structure validation failed'
        };
      }
    } else {
      return {
        success: false,
        message: 'Subscription creation failed - document not found after creation'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error testing subscription creation: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Test to verify subscription collection rules work correctly
 */
export const testSubscriptionAccess = async (userId: string): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    if (!db) {
      throw new Error('Firestore is not available');
    }
    
    const subscriptionRef = doc(db, 'subscriptions', userId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    
    if (subscriptionDoc.exists()) {
      const subscription = subscriptionDoc.data() as UserSubscription;
      
      // Verify user owns the subscription
      if (subscription.userId === userId) {
        return {
          success: true,
          message: 'Subscription access test passed'
        };
      } else {
        return {
          success: false,
          message: 'Subscription access test failed - userId mismatch'
        };
      }
    } else {
      return {
        success: false,
        message: 'Subscription access test failed - document not found'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error testing subscription access: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}; 