import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SubscriptionPlan, UserSubscription } from '../types/subscription';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billingCycle: 'monthly',
    features: [
      'Generate up to 10 skyboxes',
      'Basic styles available',
      'Standard quality output',
      'Community support'
    ],
    limits: {
      skyboxGenerations: 10,
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
      'Unlimited skybox generations',
      'All styles available',
      'High quality output',
      'Priority support',
      'API access',
      'Custom style creation'
    ],
    limits: {
      skyboxGenerations: Infinity,
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
      'Everything in Pro',
      'Dedicated support',
      'Custom integration',
      'SLA guarantees',
      'Team management'
    ],
    limits: {
      skyboxGenerations: Infinity,
      maxQuality: 'ultra',
      customStyles: true,
      apiAccess: true
    }
  }
];

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
        // Create default free subscription
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
        
        await setDoc(subscriptionRef, defaultSubscription);
        return defaultSubscription;
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

  getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
  }

  getAllPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }
}

export const subscriptionService = new SubscriptionService();