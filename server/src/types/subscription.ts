/**
 * Subscription Types - Server Side
 * Professional-grade subscription data model
 */

export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
export type PaymentProvider = 'razorpay' | 'paddle';
export type CountrySource = 'billing' | 'ip' | 'locale' | 'manual';

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceINR: number;
  yearlyPriceINR: number;
  priceUSD: number;
  yearlyPriceUSD: number;
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
  };
  isCustomPricing?: boolean;
  // Provider-specific plan IDs
  razorpayPlanIdMonthly?: string;
  razorpayPlanIdYearly?: string;
  paddlePriceIdMonthly?: string;
  paddlePriceIdYearly?: string;
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
  processedEventIds?: string[]; // Array to track processed webhook events
  
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
}

export interface UserGeoInfo {
  country: string;
  countryName: string;
  paymentProvider: PaymentProvider;
  countrySource: CountrySource;
  detectedAt: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  provider: PaymentProvider;
  data: Record<string, any>;
  processedAt?: string;
  signature?: string;
}

// Razorpay webhook event types
export type RazorpayEventType = 
  | 'subscription.authenticated'
  | 'subscription.activated'
  | 'subscription.charged'
  | 'subscription.pending'
  | 'subscription.halted'
  | 'subscription.cancelled'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'payment.authorized'
  | 'payment.captured'
  | 'payment.failed';

// Paddle webhook event types
export type PaddleEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.activated'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.canceled'
  | 'subscription.past_due'
  | 'transaction.completed'
  | 'transaction.payment_failed';

// Map provider events to internal status
export const mapRazorpayStatus = (event: RazorpayEventType): SubscriptionStatus | null => {
  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.resumed':
      return 'active';
    case 'subscription.pending':
    case 'subscription.halted':
      return 'past_due';
    case 'subscription.cancelled':
      return 'canceled';
    case 'subscription.paused':
      return 'past_due';
    default:
      return null;
  }
};

export const mapPaddleStatus = (event: PaddleEventType | string): SubscriptionStatus | null => {
  switch (event) {
    case 'subscription.created':
    case 'subscription.activated':
    case 'subscription.resumed':
    case 'transaction.completed':
      return 'active';
    case 'subscription.past_due':
    case 'subscription.paused':
    case 'transaction.payment_failed':
      return 'past_due';
    case 'subscription.canceled':
      return 'canceled';
    default:
      return null;
  }
};

// Countries that should use Razorpay
export const RAZORPAY_COUNTRIES = ['IN'];

export const shouldUseRazorpay = (countryCode: string): boolean => {
  return RAZORPAY_COUNTRIES.includes(countryCode.toUpperCase());
};

