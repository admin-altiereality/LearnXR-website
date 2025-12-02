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
  createdAt: string;
  updatedAt: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: string;
  lastPayment?: {
    amount: number;
    date: Date;
    transactionId: string;
  };
  usage: {
    skyboxGenerations: number;
    count?: number;
    limit?: number;
  };
  orderId?: string;
  paymentId?: string;
  amount?: number;
}