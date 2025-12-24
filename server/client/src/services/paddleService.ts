/**
 * Paddle Payment Service for International Payments
 * 
 * Handles checkout, subscription management, and webhook integration
 * for users outside India.
 */

import api from '../config/axios';
import { SUBSCRIPTION_PLANS } from './subscriptionService';

declare global {
  interface Window {
    Paddle: any;
  }
}

export interface PaddleCheckoutOptions {
  planId: string;
  userId: string;
  userEmail: string;
  billingCycle: 'monthly' | 'yearly';
  country?: string;
  successCallback?: () => void;
  closeCallback?: () => void;
}

export interface PaddleCustomer {
  id: string;
  email: string;
  name?: string;
}

export class PaddleService {
  private static instance: PaddleService;
  private isInitialized: boolean = false;
  private scriptLoaded: boolean = false;
  private paddleEnvironment: 'sandbox' | 'production' = 'sandbox';
  private paddleClientToken: string = '';

  private constructor() {
    this.paddleClientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '';
    this.paddleEnvironment = import.meta.env.VITE_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
    
    if (typeof window === 'undefined') {
      console.warn('PaddleService: Not in browser environment, skipping initialization');
      return;
    }
    
    if (!this.paddleClientToken) {
      console.warn('Paddle client token not found - international payment features will be disabled');
      return;
    }
    
    this.loadPaddleScript();
  }

  private loadPaddleScript(): void {
    if (this.scriptLoaded || typeof window === 'undefined') return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    
    script.onload = () => {
      this.scriptLoaded = true;
      this.initializePaddle();
    };
    
    script.onerror = (error) => {
      console.error('Failed to load Paddle script:', error);
    };
    
    document.body.appendChild(script);
  }

  private initializePaddle(): void {
    if (!window.Paddle || !this.paddleClientToken) return;
    
    try {
      window.Paddle.Environment.set(this.paddleEnvironment);
      window.Paddle.Initialize({
        token: this.paddleClientToken,
        eventCallback: (event: any) => {
          this.handlePaddleEvent(event);
        }
      });
      this.isInitialized = true;
      console.log('Paddle initialized successfully in', this.paddleEnvironment, 'mode');
    } catch (error) {
      console.error('Failed to initialize Paddle:', error);
    }
  }

  private handlePaddleEvent(event: any): void {
    console.log('Paddle event:', event);
    
    switch (event.name) {
      case 'checkout.completed':
        console.log('Checkout completed:', event.data);
        break;
      case 'checkout.closed':
        console.log('Checkout closed');
        break;
      case 'checkout.error':
        console.error('Checkout error:', event.data);
        break;
    }
  }

  public static getInstance(): PaddleService {
    if (!PaddleService.instance) {
      PaddleService.instance = new PaddleService();
    }
    return PaddleService.instance;
  }

  private async waitForPaddleScript(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Paddle is not available in this environment');
    }
    
    if (!this.paddleClientToken) {
      throw new Error('Paddle is not properly configured. Please check your environment variables.');
    }
    
    if (!this.scriptLoaded || !this.isInitialized) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        
        const checkScript = () => {
          if (this.scriptLoaded && this.isInitialized) {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error('Paddle script failed to load within 5 seconds'));
          } else {
            attempts++;
            setTimeout(checkScript, 100);
          }
        };
        checkScript();
      });
    }
  }

  /**
   * Get the Paddle price ID for a plan
   */
  private getPriceId(planId: string, billingCycle: 'monthly' | 'yearly'): string {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new Error(`Invalid plan: ${planId}`);
    }
    
    if (plan.isCustomPricing) {
      throw new Error('Enterprise plan requires custom pricing. Please contact sales.');
    }
    
    const priceId = billingCycle === 'yearly' 
      ? plan.paddlePriceIdYearly 
      : plan.paddlePriceIdMonthly;
    
    if (!priceId) {
      throw new Error(`Paddle price ID not configured for ${plan.name} plan (${billingCycle})`);
    }
    
    return priceId;
  }

  /**
   * Open Paddle checkout overlay
   */
  public async openCheckout(options: PaddleCheckoutOptions): Promise<void> {
    try {
      await this.waitForPaddleScript();
      
      if (!window.Paddle) {
        throw new Error('Paddle SDK not loaded');
      }
      
      const priceId = this.getPriceId(options.planId, options.billingCycle);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === options.planId);
      
      // First, create or get customer from our backend
      const customerResponse = await api.post('/payment/paddle/customer', {
        email: options.userEmail,
        userId: options.userId
      });
      
      const customerId = customerResponse.data.data?.customerId;
      
      // Open Paddle checkout
      window.Paddle.Checkout.open({
        items: [
          {
            priceId: priceId,
            quantity: 1
          }
        ],
        customer: customerId ? { id: customerId } : { email: options.userEmail },
        customData: {
          userId: options.userId,
          planId: options.planId,
          planName: plan?.name || options.planId,
          billingCycle: options.billingCycle
        },
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          locale: 'en',
          successUrl: `${window.location.origin}/payment-success?provider=paddle`,
          showAddDiscounts: true
        },
        successCallback: (data: any) => {
          console.log('Paddle checkout success:', data);
          options.successCallback?.();
        },
        closeCallback: () => {
          console.log('Paddle checkout closed');
          options.closeCallback?.();
        }
      });
    } catch (error) {
      console.error('Paddle checkout error:', error);
      throw error;
    }
  }

  /**
   * Get customer portal URL for subscription management
   */
  public async getCustomerPortalUrl(customerId: string): Promise<string | null> {
    try {
      const response = await api.post('/payment/paddle/portal', { customerId });
      return response.data.data?.url || null;
    } catch (error) {
      console.error('Failed to get Paddle customer portal URL:', error);
      return null;
    }
  }

  /**
   * Cancel subscription (via our backend)
   */
  public async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const response = await api.post('/payment/paddle/cancel', { subscriptionId });
      return response.data.success;
    } catch (error) {
      console.error('Failed to cancel Paddle subscription:', error);
      return false;
    }
  }

  /**
   * Update subscription payment method
   */
  public async updatePaymentMethod(subscriptionId: string): Promise<string | null> {
    try {
      const response = await api.post('/payment/paddle/update-payment', { subscriptionId });
      return response.data.data?.url || null;
    } catch (error) {
      console.error('Failed to get payment update URL:', error);
      return null;
    }
  }

  public isAvailable(): boolean {
    return this.isInitialized && !!this.paddleClientToken;
  }

  /**
   * Get price display for a plan in USD
   */
  public getPriceDisplay(planId: string, billingCycle: 'monthly' | 'yearly'): string {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) return 'N/A';
    
    if (plan.isCustomPricing) return 'Contact Sales';
    
    const price = billingCycle === 'yearly' ? plan.yearlyPriceUSD : plan.priceUSD;
    if (price === 0) return 'Free';
    
    return `$${price}`;
  }
}

export const paddleService = PaddleService.getInstance();

