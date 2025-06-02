import { SUBSCRIPTION_PLANS } from './subscriptionService';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export class RazorpayService {
  private static instance: RazorpayService;
  private razorpayKeyId: string;

  private constructor() {
    this.razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    console.log('RazorpayService initialized with key ID:', this.razorpayKeyId ? 'Present' : 'Missing');
    if (!this.razorpayKeyId) {
      console.error('Razorpay key ID not found in environment variables');
    }
  }

  public static getInstance(): RazorpayService {
    if (!RazorpayService.instance) {
      RazorpayService.instance = new RazorpayService();
    }
    return RazorpayService.instance;
  }

  private async createOrder(planId: string): Promise<{ id: string; amount: number }> {
    try {
      console.log('Creating order for plan:', planId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) throw new Error('Invalid plan selected');

      console.log('Plan details:', { name: plan.name, price: plan.price });

      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: plan.price * 100, // Convert to paise
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
      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  public async initializePayment(planId: string, userEmail: string, userId: string): Promise<void> {
    console.log('Initializing payment...', { planId, userEmail, userId });
    
    if (!window.Razorpay) {
      console.error('Razorpay SDK not loaded. Checking script status...');
      const script = document.querySelector('script[src*="razorpay"]');
      console.log('Razorpay script element:', script ? 'Found' : 'Not found');
      throw new Error('Razorpay SDK not loaded');
    }

    try {
      // Create order first
      const order = await this.createOrder(planId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);

      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      console.log('Setting up Razorpay options...');
      return new Promise((resolve, reject) => {
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
      const verificationResponse = await fetch('/api/payment/verify', {
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