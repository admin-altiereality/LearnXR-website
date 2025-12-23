/**
 * Unified Payment Service
 * 
 * Routes payments to the correct provider based on user location:
 * - India → Razorpay (UPI, local cards, compliance)
 * - International → Paddle (global cards, tax handling)
 */

import { razorpayService } from './razorpayService';
import { paddleService } from './paddleService';
import { 
  determinePaymentProvider, 
  detectUserCountry,
  saveUserGeoInfo,
  getCountryName,
  getCountryFlag 
} from './geoPaymentService';
import { SUBSCRIPTION_PLANS } from './subscriptionService';
import { PaymentProvider, PaymentProviderResult, UserGeoInfo } from '../types/subscription';
import api from '../config/axios';

export interface CheckoutOptions {
  planId: string;
  userId: string;
  userEmail: string;
  billingCycle: 'monthly' | 'yearly';
  billingCountry?: string; // User-selected billing country
  onSuccess?: () => void;
  onCancel?: () => void;
  onError?: (error: Error) => void;
}

export interface CheckoutResult {
  provider: PaymentProvider;
  country: string;
  countryName: string;
  success: boolean;
}

class UnifiedPaymentService {
  private currentProvider: PaymentProviderResult | null = null;

  /**
   * Detect the appropriate payment provider for the current user
   */
  async detectProvider(billingCountry?: string): Promise<PaymentProviderResult> {
    this.currentProvider = await determinePaymentProvider(billingCountry);
    return this.currentProvider;
  }

  /**
   * Get the current detected provider
   */
  getCurrentProvider(): PaymentProviderResult | null {
    return this.currentProvider;
  }

  /**
   * Initialize checkout with the appropriate provider
   */
  async checkout(options: CheckoutOptions): Promise<CheckoutResult> {
    const { planId, userId, userEmail, billingCycle, billingCountry, onSuccess, onCancel, onError } = options;

    // Validate plan
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Invalid plan selected');
    }

    if (plan.isCustomPricing) {
      throw new Error('Enterprise plan requires custom pricing. Please contact sales.');
    }

    if (plan.id === 'free') {
      throw new Error('Free plan does not require payment');
    }

    // Determine payment provider
    const providerResult = await this.detectProvider(billingCountry);
    console.log('Payment provider determined:', providerResult);

    // Save user's geo info for future reference
    const geoInfo: UserGeoInfo = {
      country: providerResult.country,
      countryName: getCountryName(providerResult.country),
      paymentProvider: providerResult.provider,
      countrySource: providerResult.countrySource,
      detectedAt: new Date().toISOString()
    };
    await saveUserGeoInfo(userId, geoInfo);

    // Route to appropriate provider
    if (providerResult.provider === 'razorpay') {
      return this.checkoutWithRazorpay(options, providerResult);
    } else {
      return this.checkoutWithPaddle(options, providerResult);
    }
  }

  /**
   * Checkout with Razorpay (India)
   */
  private async checkoutWithRazorpay(
    options: CheckoutOptions,
    providerResult: PaymentProviderResult
  ): Promise<CheckoutResult> {
    const { planId, userId, userEmail, billingCycle, onSuccess, onCancel, onError } = options;

    if (!razorpayService.isAvailable()) {
      throw new Error('Razorpay is not available. Please try again or contact support.');
    }

    try {
      await razorpayService.initializePayment(planId, userEmail, userId, billingCycle);
      
      onSuccess?.();
      
      return {
        provider: 'razorpay',
        country: providerResult.country,
        countryName: getCountryName(providerResult.country),
        success: true
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Payment cancelled') {
          onCancel?.();
        } else {
          onError?.(error);
        }
      }
      throw error;
    }
  }

  /**
   * Checkout with Paddle (International)
   */
  private async checkoutWithPaddle(
    options: CheckoutOptions,
    providerResult: PaymentProviderResult
  ): Promise<CheckoutResult> {
    const { planId, userId, userEmail, billingCycle, onSuccess, onCancel, onError } = options;

    if (!paddleService.isAvailable()) {
      throw new Error('Paddle is not available. Please try again or contact support.');
    }

    return new Promise((resolve, reject) => {
      paddleService.openCheckout({
        planId,
        userId,
        userEmail,
        billingCycle,
        country: providerResult.country,
        successCallback: () => {
          onSuccess?.();
          resolve({
            provider: 'paddle',
            country: providerResult.country,
            countryName: getCountryName(providerResult.country),
            success: true
          });
        },
        closeCallback: () => {
          onCancel?.();
          resolve({
            provider: 'paddle',
            country: providerResult.country,
            countryName: getCountryName(providerResult.country),
            success: false
          });
        }
      }).catch((error) => {
        onError?.(error);
        reject(error);
      });
    });
  }

  /**
   * Get the billing portal URL for the user's provider
   */
  async getBillingPortalUrl(userId: string, provider: PaymentProvider, customerId?: string): Promise<string | null> {
    if (provider === 'paddle' && customerId) {
      return paddleService.getCustomerPortalUrl(customerId);
    }
    // Razorpay doesn't have a customer portal - users manage via our UI
    return null;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    provider: PaymentProvider, 
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<boolean> {
    try {
      const response = await api.post('/subscription/cancel', {
        provider,
        subscriptionId,
        cancelAtPeriodEnd
      });
      return response.data.success;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      return false;
    }
  }

  /**
   * Check if either payment provider is available
   */
  isPaymentAvailable(): boolean {
    return razorpayService.isAvailable() || paddleService.isAvailable();
  }

  /**
   * Get price display based on provider
   */
  getPriceDisplay(
    planId: string, 
    billingCycle: 'monthly' | 'yearly', 
    provider: PaymentProvider
  ): string {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) return 'N/A';
    
    if (plan.isCustomPricing) return 'Contact Sales';
    
    if (provider === 'razorpay') {
      const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
      if (price === 0) return 'Free';
      return `₹${price.toLocaleString('en-IN')}`;
    } else {
      const price = billingCycle === 'yearly' ? plan.yearlyPriceUSD : plan.priceUSD;
      if (price === 0) return 'Free';
      return `$${price}`;
    }
  }

  /**
   * Get the detected country info for display
   */
  async getCountryDisplayInfo(): Promise<{ 
    country: string; 
    countryName: string; 
    flag: string; 
    provider: PaymentProvider 
  }> {
    const detected = await detectUserCountry();
    const providerResult = await this.detectProvider();
    
    return {
      country: detected.country,
      countryName: getCountryName(detected.country),
      flag: getCountryFlag(detected.country),
      provider: providerResult.provider
    };
  }
}

export const unifiedPaymentService = new UnifiedPaymentService();

