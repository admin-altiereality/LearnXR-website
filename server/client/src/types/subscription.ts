export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial' | 'limited';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: {
    skyboxGenerations: number;
    maxQuality: string;
    customStyles: boolean;
    apiAccess: boolean;
  };
}

export interface UserSubscription {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: string;
  lastPayment?: {
    amount: number;
    date: Date;
    transactionId: string;
  };
  usage: {
    count: number;
    limit: number;
  };
}