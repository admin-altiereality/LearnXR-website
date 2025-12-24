export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type PaymentProvider = 'razorpay' | 'paddle';
export type CountrySource = 'billing' | 'ip' | 'locale' | 'manual';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // Monthly price in INR for Razorpay
  yearlyPrice: number; // Yearly price in INR for Razorpay
  priceUSD: number; // Monthly price in USD for Paddle
  yearlyPriceUSD: number; // Yearly price in USD for Paddle
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
  isCustomPricing?: boolean;
  // Paddle price IDs for international payments
  paddlePriceIdMonthly?: string;
  paddlePriceIdYearly?: string;
  // Razorpay plan IDs for subscription payments
  razorpayPlanIdMonthly?: string;
  razorpayPlanIdYearly?: string;
}

export interface UserSubscription {
  userId: string;
  planId: string;
  planName?: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  
  // Billing period
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  
  // Provider-specific IDs
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  
  // Webhook idempotency
  lastEventId?: string;
  lastEventAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Usage tracking
  usage: {
    skyboxGenerations: number;
    count?: number;
    limit?: number;
  };
  
  // Legacy fields for backward compatibility
  orderId?: string;
  paymentId?: string;
  amount?: number;
  paymentMethod?: string;
  lastPayment?: {
    amount: number;
    date: Date;
    transactionId: string;
  };
}

export interface UserGeoInfo {
  country: string; // ISO 3166-1 alpha-2 code
  countryName: string;
  paymentProvider: PaymentProvider;
  countrySource: CountrySource;
  detectedAt: string;
}

export interface PaymentProviderResult {
  provider: PaymentProvider;
  country: string;
  countrySource: CountrySource;
  confidence: 'high' | 'medium' | 'low';
}

// Country codes that should use Razorpay (India only)
export const RAZORPAY_COUNTRIES = ['IN'];

// Helper to check if country should use Razorpay
export const shouldUseRazorpay = (countryCode: string): boolean => {
  return RAZORPAY_COUNTRIES.includes(countryCode.toUpperCase());
};
