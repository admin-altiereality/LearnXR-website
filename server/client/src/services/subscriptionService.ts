import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
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
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const subscriptionRef = doc(db, 'subscriptions', userId);
      const subscriptionDoc = await getDoc(subscriptionRef);
      
      // Get user's generation count
      const skyboxesRef = collection(db, 'skyboxes');
      const userSkyboxesQuery = query(skyboxesRef, where('userId', '==', userId));
      const skyboxesSnapshot = await getDocs(userSkyboxesQuery);
      const generationCount = skyboxesSnapshot.size;
      
      if (subscriptionDoc.exists()) {
        const data = subscriptionDoc.data() as UserSubscription;
        return {
          ...data,
          usage: {
            count: generationCount,
            limit: data.usage?.limit || 10
          }
        };
      }
      
      // Create free tier subscription if none exists
      const freeTier: UserSubscription = {
        userId,
        planId: 'free',
        status: generationCount >= 10 ? 'limited' : 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        usage: {
          count: generationCount,
          limit: 10
        }
      };
      
      await setDoc(subscriptionRef, freeTier);
      return freeTier;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
  }

  async updateSubscription(userId: string, planId: string): Promise<void> {
    const subscriptionRef = doc(db, 'subscriptions', userId);
    await updateDoc(subscriptionRef, {
      planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cancelAtPeriodEnd: false
    });
  }

  async checkGenerationLimit(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return false;

    return subscription.usage.count < subscription.usage.limit;
  }
}

export const subscriptionService = new SubscriptionService();