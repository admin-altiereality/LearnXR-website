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
      console.warn('RazorpayService: Not in browser environment, skipping initialization');
      return;
    }
    if (!this.razorpayKeyId) {
      console.warn('Razorpay key ID not found in environment variables - payment features will be disabled');
      return;
    }
    this.isInitialized = true;
    this.loadRazorpayScript();
  }

  private loadRazorpayScript(): void {
    if (this.scriptLoaded || typeof window === 'undefined') return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      this.scriptLoaded = true;
    };
    script.onerror = (error) => {
      console.error('Failed to load Razorpay script:', error);
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
      throw new Error('Razorpay is not available in this environment');
    }
    if (!this.isInitialized) {
      throw new Error('Razorpay is not properly initialized. Please check your environment variables.');
    }
    if (!this.scriptLoaded) {
      return new Promise((resolve, reject) => {
        const checkScript = () => {
          if (this.scriptLoaded) {
            resolve();
          } else {
            setTimeout(checkScript, 100);
          }
        };
        checkScript();
        setTimeout(() => {
          reject(new Error('Razorpay script failed to load within 10 seconds'));
        }, 10000);
      });
    }
  }

  private async createOrder(planId: string, userId: string): Promise<{ id: string; amount: number }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Razorpay is not properly initialized');
      }
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) throw new Error('Invalid plan selected');
      const amountInPaise = Math.round(plan.price * 100);
      const response = await api.post('/api/payment/create-order', {
        amount: amountInPaise,
        currency: 'INR',
        planId,
        userId
      });
      return response.data.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  public async initializePayment(planId: string, userEmail: string, userId: string): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Payment is not available. Please check your configuration.');
      }
      await this.waitForRazorpayScript();
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }
      const order = await this.createOrder(planId, userId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }
      return new Promise<void>((resolve, reject) => {
        const options = {
          key: this.razorpayKeyId,
          amount: order.amount,
          currency: 'INR',
          name: 'In3D.Ai',
          description: `Upgrade to ${plan.name} Plan`,
          order_id: order.id,
          prefill: { email: userEmail },
          handler: async (response: any) => {
            try {
              await this.verifyPayment(response, userId, planId);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
            confirm_close: true,
            escape: true,
            handleback: true
          },
          theme: { color: '#3B82F6' },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      });
    } catch (error) {
      throw error;
    }
  }

  private async verifyPayment(response: any, userId: string, planId: string): Promise<void> {
    try {
      const verifyRes = await api.post('/api/payment/verify', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      });
      if (!verifyRes.data.success) {
        throw new Error('Payment verification failed');
      }
      // Create subscription after payment verification
      await api.post('/api/subscription/create', {
        userId,
        planId,
        planName: SUBSCRIPTION_PLANS.find(p => p.id === planId)?.name || planId
      });
    } catch (error) {
      console.error('Error verifying payment or creating subscription:', error);
      throw error;
    }
  }

  public isAvailable(): boolean {
    return this.isInitialized && !!this.razorpayKeyId;
  }
}

export const razorpayService = RazorpayService.getInstance(); 