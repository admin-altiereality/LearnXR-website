import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SubscriptionPlan, UserSubscription, PaymentProvider } from '../types/subscription';
import api from '../config/axios';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    priceUSD: 0,
    yearlyPriceUSD: 0,
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
    yearlyPrice: 120000, // ₹1,20,000/year (17% discount)
    priceUSD: 149, // $149/month
    yearlyPriceUSD: 1490, // $1,490/year (17% discount)
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
    },
    // These will be set from environment/backend
    paddlePriceIdMonthly: process.env.VITE_PADDLE_PRO_MONTHLY_PRICE_ID || '',
    paddlePriceIdYearly: process.env.VITE_PADDLE_PRO_YEARLY_PRICE_ID || '',
    razorpayPlanIdMonthly: process.env.VITE_RAZORPAY_PRO_MONTHLY_PLAN_ID || '',
    razorpayPlanIdYearly: process.env.VITE_RAZORPAY_PRO_YEARLY_PLAN_ID || ''
  },
  {
    id: 'team',
    name: 'Team',
    price: 25000, // ₹25,000/month
    yearlyPrice: 250000, // ₹2,50,000/year (17% discount)
    priceUSD: 299, // $299/month
    yearlyPriceUSD: 2990, // $2,990/year (17% discount)
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
    },
    paddlePriceIdMonthly: process.env.VITE_PADDLE_TEAM_MONTHLY_PRICE_ID || '',
    paddlePriceIdYearly: process.env.VITE_PADDLE_TEAM_YEARLY_PRICE_ID || '',
    razorpayPlanIdMonthly: process.env.VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID || '',
    razorpayPlanIdYearly: process.env.VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID || ''
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0, // Custom pricing
    yearlyPrice: 0, // Custom pricing
    priceUSD: 0,
    yearlyPriceUSD: 0,
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
export const createDefaultSubscription = async (
  userId: string,
  provider: PaymentProvider = 'razorpay'
): Promise<UserSubscription> => {
  if (!db) {
    throw new Error('Firestore is not available');
  }

  const defaultSubscription: UserSubscription = {
    userId,
    planId: 'free',
    planName: 'Free',
    status: 'active',
    provider,
    cancelAtPeriodEnd: false,
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
        const data = subscriptionDoc.data() as UserSubscription;
        // Ensure backward compatibility with old records
        return {
          ...data,
          status: data.status || 'active',
          provider: data.provider || 'razorpay',
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false
        };
      } else {
        // Create default free subscription
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
      
      // Check if subscription is active
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return false;
      }
      
      const currentPlan = SUBSCRIPTION_PLANS.find(plan => plan.id === subscription.planId);
      
      if (!currentPlan) {
        return false;
      }
      
      const currentUsage = subscription.usage?.[usageType] || 0;
      
      // Map usage types to limit keys
      if (usageType === 'skyboxGenerations') {
        const limit = currentPlan.limits.skyboxGenerations;
        return currentUsage < limit;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking usage limit:', error);
      throw error;
    }
  }

  /**
   * Check if user has an active paid subscription
   */
  async hasActivePaidSubscription(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      return (
        subscription.planId !== 'free' &&
        (subscription.status === 'active' || subscription.status === 'trialing')
      );
    } catch (error) {
      console.error('Error checking paid subscription:', error);
      return false;
    }
  }

  /**
   * Check if subscription is expiring soon (within 7 days)
   */
  isExpiringSoon(subscription: UserSubscription): boolean {
    if (!subscription.currentPeriodEnd) return false;
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const now = new Date();
    const daysUntilExpiry = (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  /**
   * Get the billing portal URL for subscription management
   */
  async getBillingPortalUrl(userId: string): Promise<string | null> {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (subscription.provider === 'paddle' && subscription.providerCustomerId) {
        // Paddle customer portal
        const response = await api.post('/payment/paddle/portal', {
          customerId: subscription.providerCustomerId
        });
        return response.data.data?.url || null;
      } else if (subscription.provider === 'razorpay' && subscription.providerSubscriptionId) {
        // Razorpay doesn't have a customer portal, return null
        // Users will manage through our UI
        return null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting billing portal URL:', error);
      return null;
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

  async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    const response = await api.post('/subscription/cancel', { userId, cancelAtPeriodEnd });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel subscription');
    }
  }

  getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
  }

  getAllPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  /**
   * Get next tier upgrade option
   */
  getNextTierUpgrade(currentPlanId: string): SubscriptionPlan | null {
    const tiers = ['free', 'pro', 'team', 'enterprise'];
    const currentIndex = tiers.indexOf(currentPlanId);
    if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
      return null;
    }
    return this.getPlanById(tiers[currentIndex + 1]) || null;
  }

  /**
   * Check if user is on the highest tier
   */
  isOnHighestTier(planId: string): boolean {
    return planId === 'enterprise';
  }
}

export const subscriptionService = new SubscriptionService();
