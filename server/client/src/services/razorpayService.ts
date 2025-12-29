/**
 * Razorpay Payment Service
 * Complete rewrite - clean implementation
 */

import api from '../config/axios';
import { SUBSCRIPTION_PLANS } from './subscriptionService';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export class RazorpayService {
  private static instance: RazorpayService;
  private razorpayKeyId: string;
  private scriptLoaded: boolean = false;
  private isInitialized: boolean = false;

  private constructor() {
    this.razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
    
    if (typeof window === 'undefined') {
      console.warn('RazorpayService: Not in browser environment');
      return;
    }
    
    if (!this.razorpayKeyId) {
      console.warn('Razorpay key ID not found - payment features disabled');
      return;
    }
    
    this.isInitialized = true;
    this.loadRazorpayScript();
  }

  private loadRazorpayScript(): void {
    if (this.scriptLoaded || typeof window === 'undefined') return;
    
    // Check if script already loaded
    if (window.Razorpay) {
      this.scriptLoaded = true;
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      this.scriptLoaded = true;
      console.log('✅ Razorpay script loaded');
    };
    script.onerror = (error) => {
      console.error('❌ Failed to load Razorpay script:', error);
    };
    document.body.appendChild(script);
  }

  public static getInstance(): RazorpayService {
    if (!RazorpayService.instance) {
      RazorpayService.instance = new RazorpayService();
    }
    return RazorpayService.instance;
  }

  private async waitForRazorpayScript(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Razorpay not available in this environment');
    }
    
    if (!this.isInitialized) {
      throw new Error('Razorpay not initialized');
    }
    
    // Wait for script to load
    let attempts = 0;
    while (!this.scriptLoaded && attempts < 100) {
      if (window.Razorpay) {
        this.scriptLoaded = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.Razorpay) {
      throw new Error('Razorpay script failed to load');
    }
  }

  /**
   * Create Razorpay subscription via backend
   */
  private async createSubscription(
    planId: string,
    userId: string,
    userEmail: string,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<{ subscriptionId: string; authLink: string | null }> {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Invalid plan selected');
    }
    
    // Get Razorpay plan ID
    const razorpayPlanId = billingCycle === 'yearly' 
      ? plan.razorpayPlanIdYearly 
      : plan.razorpayPlanIdMonthly;
    
    if (!razorpayPlanId) {
      throw new Error(`Razorpay plan ID not configured for ${planId} (${billingCycle})`);
    }
    
    console.log('📞 Creating subscription via API:', {
      userId,
      razorpayPlanId,
      planName: plan.name,
      billingCycle
    });
    
    try {
      const response = await api.post('/subscription/create', {
        userId,
        planId: razorpayPlanId, // Razorpay plan ID
        planName: plan.name,
        billingCycle,
        userEmail
      });
      
      if (!response.data?.success) {
        const errorMsg = response.data?.details || response.data?.error || 'Subscription creation failed';
        throw new Error(errorMsg);
      }
      
      const data = response.data.data;
      if (!data?.subscription_id) {
        throw new Error('Invalid response: missing subscription_id');
      }
      
      console.log('✅ Subscription created:', data.subscription_id);
      
      return {
        subscriptionId: data.subscription_id,
        authLink: data.auth_link || null
      };
      
    } catch (error: any) {
      console.error('❌ Subscription creation failed:', error);
      
      const errorMessage = error.response?.data?.details || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to create subscription';
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Initialize payment flow
   */
  public async initializePayment(
    planId: string,
    userEmail: string,
    userId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<void> {
    try {
      // Validate initialization
      if (!this.isInitialized) {
        throw new Error('Razorpay not initialized. Please check configuration.');
      }
      
      // Wait for Razorpay script
      await this.waitForRazorpayScript();
      
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }
      
      // Get plan details
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }
      
      // Create subscription via backend
      const { subscriptionId, authLink } = await this.createSubscription(
        planId,
        userId,
        userEmail,
        billingCycle
      );
      
      // FLOW 1: Use auth_link redirect (preferred for subscriptions)
      if (authLink) {
        console.log('🔄 Redirecting to Razorpay auth_link');
        window.location.href = authLink;
        return;
      }
      
      // FLOW 2: Use checkout.js modal (fallback)
      console.log('💳 Opening Razorpay checkout modal');
      
      const billingText = billingCycle === 'yearly' ? ' (Yearly)' : ' (Monthly)';
      const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
      
      return new Promise<void>((resolve, reject) => {
        const options: any = {
          key: this.razorpayKeyId,
          subscription_id: subscriptionId,
          name: 'In3D.Ai',
          description: `${plan.name} Plan${billingText}`,
          prefill: {
            email: userEmail
          },
          handler: async (response: any) => {
            try {
              console.log('✅ Payment successful:', response);
              
              // Update subscription with payment details
              await api.post('/subscription/create', {
                userId,
                planId, // Internal plan ID
                planName: plan.name,
                billingCycle,
                providerSubscriptionId: subscriptionId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });
              
              resolve();
            } catch (error) {
              console.error('❌ Error updating subscription:', error);
              reject(error);
            }
          },
          modal: {
            ondismiss: () => {
              reject(new Error('Payment cancelled by user'));
            }
          },
          theme: {
            color: '#3B82F6'
          }
        };
        
        try {
          const rzp = new window.Razorpay(options);
          
          rzp.on('payment.failed', (response: any) => {
            console.error('❌ Payment failed:', response.error);
            reject(new Error(`Payment failed: ${response.error?.description || 'Unknown error'}`));
          });
          
          rzp.open();
        } catch (error) {
          console.error('❌ Error opening Razorpay modal:', error);
          reject(new Error('Failed to open payment modal'));
        }
      });
      
    } catch (error) {
      console.error('❌ Payment initialization error:', error);
      throw error;
    }
  }

  /**
   * Check if Razorpay is available
   */
  public isAvailable(): boolean {
    return this.isInitialized && !!this.razorpayKeyId;
  }
}

export const razorpayService = RazorpayService.getInstance();
