import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SubscriptionPlan, UserSubscription } from '../types/subscription';
import api from '../config/axios';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billingCycle: 'monthly',
    features: [
      'Generate up to 5 skyboxes',
      'Basic styles available',
      'Standard quality output',
      'Community support'
    ],
    limits: {
      skyboxGenerations: 5,
      maxQuality: 'standard',
      customStyles: false,
      apiAccess: false
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 999, // ₹999/month
    billingCycle: 'monthly',
    features: [
      'Generate up to 50 skyboxes',
      'All styles available',
      'High quality output',
      'Priority support',
      'API access',
      'Custom style creation'
    ],
    limits: {
      skyboxGenerations: 50,
      maxQuality: 'high',
      customStyles: true,
      apiAccess: true
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 4999, // ₹4999/month
    billingCycle: 'monthly',
    features: [
      'Generate up to 100 skyboxes',
      'Everything in Pro',
      'Dedicated support',
      'Custom integration',
      'SLA guarantees',
      'Team management'
    ],
    limits: {
      skyboxGenerations: 100,
      maxQuality: 'ultra',
      customStyles: true,
      apiAccess: true
    }
  }
];

/**
 * Creates a default subscription document for a new user
 * @param userId - The user's unique identifier
 * @returns Default subscription document
 */
export const createDefaultSubscription = async (userId: string): Promise<UserSubscription> => {
  if (!db) {
    throw new Error('Firestore is not available');
  }

  const defaultSubscription: UserSubscription = {
    userId,
    planId: 'free',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usage: {
      skyboxGenerations: 0
    }
  };

  const subscriptionRef = doc(db, 'subscriptions', userId);
  await setDoc(subscriptionRef, defaultSubscription);
  
  console.log(`Default subscription created for user: ${userId}`);
  return defaultSubscription;
};

class SubscriptionService {
  async getUserSubscription(userId: string): Promise<UserSubscription> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const subscriptionRef = doc(db, 'subscriptions', userId);
      const subscriptionDoc = await getDoc(subscriptionRef);
      
      if (subscriptionDoc.exists()) {
        return subscriptionDoc.data() as UserSubscription;
      } else {
        // Create default free subscription using the helper function
        return await createDefaultSubscription(userId);
      }
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  async updateUserSubscription(userId: string, subscriptionData: Partial<UserSubscription>): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const subscriptionRef = doc(db, 'subscriptions', userId);
      await updateDoc(subscriptionRef, {
        ...subscriptionData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user subscription:', error);
      throw error;
    }
  }

  async incrementUsage(userId: string, usageType: keyof UserSubscription['usage']): Promise<void> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const subscriptionRef = doc(db, 'subscriptions', userId);
      const subscriptionDoc = await getDoc(subscriptionRef);
      
      if (subscriptionDoc.exists()) {
        const currentData = subscriptionDoc.data() as UserSubscription;
        const currentUsage = currentData.usage?.[usageType] || 0;
        
        await updateDoc(subscriptionRef, {
          [`usage.${usageType}`]: currentUsage + 1,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error incrementing usage:', error);
      throw error;
    }
  }

  async checkUsageLimit(userId: string, usageType: keyof UserSubscription['usage']): Promise<boolean> {
    try {
      if (!db) {
        throw new Error('Firestore is not available');
      }
      
      const subscription = await this.getUserSubscription(userId);
      const currentPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === subscription.planId);
      
      if (!currentPlan) {
        return false;
      }
      
      const currentUsage = subscription.usage?.[usageType] || 0;
      const limit = currentPlan.limits[usageType];
      
      return currentUsage < limit;
    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw error;
    }
  }

  async createSubscription(userId: string, planId: string, planName: string) {
    const response = await api.post('/api/subscription/create', { userId, planId, planName });
    return response.data;
  }

  async getUserSubscriptionStatus(userId: string) {
    const response = await api.post('/api/user/subscription-status', { userId });
    return response.data;
  }

  getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
  }

  getAllPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }
}

export const subscriptionService = new SubscriptionService();