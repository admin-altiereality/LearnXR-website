export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial' | 'limited';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // Monthly price
  yearlyPrice: number; // Yearly price
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: {
    skyboxGenerations: number;
    assetsPerGeneration: number;
    maxAssetsPerMonth: number;
    maxQuality: string;
    customStyles: boolean;
    apiAccess: boolean;
    commercialRights: boolean;
    teamCollaboration: boolean;
    unityUnrealIntegration: boolean;
    supportLevel: 'community' | 'standard' | 'priority' | 'dedicated';
  };
  isCustomPricing?: boolean; // For Enterprise plan
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