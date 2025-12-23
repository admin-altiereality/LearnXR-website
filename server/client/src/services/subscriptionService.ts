import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SubscriptionPlan, UserSubscription } from '../types/subscription';
import api from '../config/axios';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    billingCycle: 'monthly',
    features: [
      '5 generations per month',
      '1 asset per generation',
      'Maximum 5 assets per month',
      'Community support'
    ],
    limits: {
      skyboxGenerations: 5,
      assetsPerGeneration: 1,
      maxAssetsPerMonth: 5,
      maxQuality: 'standard',
      customStyles: false,
      apiAccess: false,
      commercialRights: false,
      teamCollaboration: false,
      unityUnrealIntegration: false,
      supportLevel: 'community'
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12000, // ₹12,000/month
    yearlyPrice: 120000, // ₹1,20,000/year
    billingCycle: 'monthly',
    features: [
      '60 generations per month',
      '3 assets per generation',
      'Maximum 180 assets per month',
      'Commercial rights included',
      'API access',
      'Unity / Unreal integration',
      'Standard support'
    ],
    limits: {
      skyboxGenerations: 60,
      assetsPerGeneration: 3,
      maxAssetsPerMonth: 180,
      maxQuality: 'high',
      customStyles: true,
      apiAccess: true,
      commercialRights: true,
      teamCollaboration: false,
      unityUnrealIntegration: true,
      supportLevel: 'standard'
    }
  },
  {
    id: 'team',
    name: 'Team',
    price: 25000, // ₹25,000/month
    yearlyPrice: 250000, // ₹2,50,000/year
    billingCycle: 'monthly',
    features: [
      '120 generations per month',
      '4 assets per generation',
      'Maximum 480 assets per month',
      'Commercial rights included',
      'Team collaboration',
      'API access',
      'Unity / Unreal integration',
      'Priority support'
    ],
    limits: {
      skyboxGenerations: 120,
      assetsPerGeneration: 4,
      maxAssetsPerMonth: 480,
      maxQuality: 'high',
      customStyles: true,
      apiAccess: true,
      commercialRights: true,
      teamCollaboration: true,
      unityUnrealIntegration: true,
      supportLevel: 'priority'
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0, // Custom pricing
    yearlyPrice: 0, // Custom pricing
    billingCycle: 'monthly',
    isCustomPricing: true,
    features: [
      'Custom generation quota',
      'Up to 5 assets per generation',
      'Custom maximum assets per month',
      'Commercial rights included',
      'Team collaboration',
      'API access',
      'Unity / Unreal integration',
      'Dedicated support'
    ],
    limits: {
      skyboxGenerations: Infinity, // Custom
      assetsPerGeneration: 5,
      maxAssetsPerMonth: Infinity, // Custom
      maxQuality: 'ultra',
      customStyles: true,
      apiAccess: true,
      commercialRights: true,
      teamCollaboration: true,
      unityUnrealIntegration: true,
      supportLevel: 'dedicated'
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
      
      // Map usage types to limit keys - only skyboxGenerations is supported
      if (usageType === 'skyboxGenerations') {
        const limit = currentPlan.limits.skyboxGenerations;
        return currentUsage < limit;
      }
      
      // For other usage types (count, limit), return true (no limit check)
      return true;
    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw error;
    }
  }

  async createSubscription(userId: string, planId: string, planName: string) {
    const response = await api.post('/subscription/create', { userId, planId, planName });
    return response.data;
  }

  async getUserSubscriptionStatus(userId: string) {
    const response = await api.post('/subscription/status', { userId });
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