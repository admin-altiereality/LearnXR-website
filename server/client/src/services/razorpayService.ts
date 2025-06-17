import { SUBSCRIPTION_PLANS } from './subscriptionService';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export class RazorpayService {
  private static instance: RazorpayService;
  private razorpayKeyId: string;
  private baseUrl: string;
  private scriptLoaded: boolean = false;

  private constructor() {
    this.razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/in3devoneuralwebsite/us-central1/api';
    console.log('RazorpayService initialized with key ID:', this.razorpayKeyId ? 'Present' : 'Missing');
    console.log('Using API base URL:', this.baseUrl);
    if (!this.razorpayKeyId) {
      console.error('Razorpay key ID not found in environment variables');
    }
    this.loadRazorpayScript();
  }

  private loadRazorpayScript(): void {
    if (this.scriptLoaded) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('Razorpay script loaded successfully');
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
    if (this.scriptLoaded) return;

    return new Promise((resolve, reject) => {
      const maxAttempts = 50; // 5 seconds total
      let attempts = 0;

      const checkInterval = setInterval(() => {
        attempts++;
        if (window.Razorpay) {
          clearInterval(checkInterval);
          this.scriptLoaded = true;
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('Razorpay script failed to load after 5 seconds'));
        }
      }, 100);
    });
  }

  private async createOrder(planId: string): Promise<{ id: string; amount: number }> {
    try {
      console.log('Creating order for plan:', planId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) throw new Error('Invalid plan selected');

      console.log('Plan details:', { name: plan.name, price: plan.price });

      // Convert price to paise (multiply by 100)
      const amountInPaise = Math.round(plan.price * 100);
      console.log('Amount in paise:', amountInPaise);

      const response = await fetch(`${this.baseUrl}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          planId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Create order failed:', error);
        throw new Error(error.message || 'Failed to create order');
      }

      const order = await response.json();
      console.log('Order created successfully:', order);
      return order.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  public async initializePayment(planId: string, userEmail: string, userId: string): Promise<void> {
    try {
      console.log('Initializing payment...', { planId, userEmail, userId });
      
      // Wait for Razorpay script to load
      await this.waitForRazorpayScript();
      
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }

      // Create order first
      const order = await this.createOrder(planId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);

      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      return new Promise<void>((resolve, reject) => {
        const options = {
          key: this.razorpayKeyId,
          amount: order.amount,
          currency: 'INR',
          name: 'Skybox AI',
          description: `Upgrade to ${plan.name} Plan`,
          order_id: order.id,
          prefill: {
            email: userEmail
          },
          handler: async (response: any) => {
            try {
              console.log('Payment successful, verifying...', response);
              await this.verifyPayment(response, userId, planId);
              resolve();
            } catch (error) {
              console.error('Payment verification failed:', error);
              reject(error);
            }
          },
          modal: {
            ondismiss: () => {
              console.log('Payment modal dismissed by user');
              reject(new Error('Payment cancelled'));
            }
          },
          theme: {
            color: '#3B82F6'
          }
        };

        console.log('Creating Razorpay instance with options:', { ...options, key: 'HIDDEN' });
        const razorpay = new window.Razorpay(options);
        console.log('Opening Razorpay modal...');
        razorpay.open();
      });
    } catch (error) {
      console.error('Payment initialization error:', error);
      throw error;
    }
  }

  private async verifyPayment(response: any, userId: string, planId: string): Promise<void> {
    try {
      console.log('Verifying payment...', { userId, planId, ...response });
      const verificationResponse = await fetch(`${this.baseUrl}/api/payment/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          userId,
          planId
        })
      });

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        console.error('Payment verification failed:', error);
        throw new Error(error.message || 'Payment verification failed');
      }

      const result = await verificationResponse.json();
      console.log('Payment verification result:', result);
      if (result.status !== 'success') {
        throw new Error(result.message || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }
}

export const razorpayService = RazorpayService.getInstance(); 