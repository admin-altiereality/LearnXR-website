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
  private isInitialized: boolean = false;

  private constructor() {
    this.razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
    
    // Use Netlify functions for production, local server for development
    const isProduction = import.meta.env.PROD && window.location.hostname !== 'localhost';
    if (isProduction) {
      this.baseUrl = '/.netlify/functions';
    } else {
      this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5002';
    }
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('RazorpayService: Not in browser environment, skipping initialization');
      return;
    }

    console.log('RazorpayService initialized with key ID:', this.razorpayKeyId ? 'Present' : 'Missing');
    console.log('Using API base URL:', this.baseUrl);
    console.log('Environment:', isProduction ? 'Production' : 'Development');
    
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
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Razorpay script failed to load within 10 seconds'));
        }, 10000);
      });
    }
  }

  private async createOrder(planId: string): Promise<{ id: string; amount: number }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Razorpay is not properly initialized');
      }

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
      if (!this.isInitialized) {
        throw new Error('Payment is not available. Please check your configuration.');
      }

      console.log('Initializing payment...', { planId, userEmail, userId });
      
      // Wait for Razorpay script to load
      await this.waitForRazorpayScript();
      
      if (typeof window === 'undefined' || !window.Razorpay) {
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
            },
            // Handle COOP restrictions
            confirm_close: true,
            escape: true
          },
          theme: {
            color: '#3B82F6'
          },
          // Add additional options to handle COOP restrictions
          config: {
            display: {
              blocks: {
                utib: {
                  name: "Pay using UPI",
                  instruments: [
                    {
                      method: "upi"
                    }
                  ]
                },
                other: {
                  name: "Other Payment methods",
                  instruments: [
                    {
                      method: "card"
                    },
                    {
                      method: "netbanking"
                    }
                  ]
                }
              },
              sequence: ["block.utib", "block.other"],
              preferences: {
                show_default_blocks: false
              }
            }
          }
        };

        console.log('Creating Razorpay instance with options:', { ...options, key: 'HIDDEN' });
        
        try {
          const razorpay = new window.Razorpay(options);
          console.log('Opening Razorpay modal...');
          
          // Handle potential COOP errors
          razorpay.open();
          
          // Add a timeout to handle cases where the modal doesn't open properly
          setTimeout(() => {
            // Check if the modal opened successfully
            if (document.querySelector('.razorpay-container')) {
              console.log('Razorpay modal opened successfully');
            } else {
              console.warn('Razorpay modal may not have opened properly');
            }
          }, 1000);
          
        } catch (modalError) {
          console.error('Error opening Razorpay modal:', modalError);
          reject(new Error('Failed to open payment modal. Please try again.'));
        }
      });
    } catch (error) {
      console.error('Payment initialization error:', error);
      throw error;
    }
  }

  private async verifyPayment(response: any, userId: string, planId: string): Promise<void> {
    try {
      console.log('Verifying payment...', { userId, planId, ...response });

      const verifyResponse = await fetch(`${this.baseUrl}/api/payment/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          userId,
          planId
        })
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        console.error('Payment verification failed:', error);
        throw new Error(error.message || 'Payment verification failed');
      }

      const result = await verifyResponse.json();
      console.log('Payment verified successfully:', result);
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.razorpayKeyId !== '';
  }
}

export const razorpayService = RazorpayService.getInstance(); 