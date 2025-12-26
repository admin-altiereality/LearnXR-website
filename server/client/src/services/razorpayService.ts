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

  private async createOrderOrSubscription(planId: string, userId: string, userEmail: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<{ id: string; amount: number; isSubscription: boolean; authLink?: string }> {
    try {
      if (!this.isInitialized) {
        throw new Error('Razorpay is not properly initialized');
      }
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) throw new Error('Invalid plan selected');
      if (plan.isCustomPricing) {
        throw new Error('Enterprise plan requires custom pricing. Please contact sales.');
      }
      
      // Get the Razorpay plan ID for this plan and billing cycle
      const razorpayPlanId = billingCycle === 'yearly' 
        ? plan.razorpayPlanIdYearly 
        : plan.razorpayPlanIdMonthly;
      
      // Debug logging for plan IDs
      if (!razorpayPlanId) {
        console.warn(`⚠️ Razorpay plan ID not found for ${planId} (${billingCycle})`, {
          planId,
          billingCycle,
          razorpayPlanIdMonthly: plan.razorpayPlanIdMonthly,
          razorpayPlanIdYearly: plan.razorpayPlanIdYearly,
          envMonthly: import.meta.env.VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID,
          envYearly: import.meta.env.VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID
        });
      }
      
      // If we have a Razorpay subscription plan ID, use subscription flow
      if (razorpayPlanId) {
        try {
          console.log(`🔄 Creating Razorpay subscription with plan_id: ${razorpayPlanId}`);
          
          // Step 1: Create or get Razorpay customer (optional - backend will create if needed)
          // Note: We skip customer creation here and let the backend handle it
          // This simplifies the flow and reduces potential failure points
          let customerId: string | null = null;
          
          // Step 2: Create subscription with customer_id
          console.log(`📋 Creating subscription with:`, {
            userId,
            planId: razorpayPlanId,
            planName: plan.name,
            billingCycle,
            customerId
          });
          
          const subscriptionResponse = await api.post('/subscription/create', {
            userId,
            planId: razorpayPlanId, // Use Razorpay plan ID
            planName: plan.name,
            billingCycle,
            userEmail: userEmail,
            customerId: customerId // Pass customer_id if available
          });
          
          console.log(`📥 Subscription creation response:`, subscriptionResponse.data);
          
          // Check response structure
          if (!subscriptionResponse.data) {
            console.error('❌ No data in subscription response');
            throw new Error('Empty response from subscription creation endpoint');
          }
          
          if (!subscriptionResponse.data.success) {
            console.error('❌ Subscription creation failed:', subscriptionResponse.data);
            const errorMsg = subscriptionResponse.data.details || subscriptionResponse.data.error || 'Subscription creation failed';
            throw new Error(errorMsg);
          }
          
          if (!subscriptionResponse.data.data) {
            console.error('❌ No data object in response:', subscriptionResponse.data);
            throw new Error('Response missing data object');
          }
          
          if (!subscriptionResponse.data.data.subscription_id) {
            console.error('❌ No subscription_id in response data:', subscriptionResponse.data.data);
            throw new Error('Response missing subscription_id');
          }
          
          const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
          const subscriptionId = subscriptionResponse.data.data.subscription_id;
          const authLink = subscriptionResponse.data.data.auth_link;
          
          console.log('✅ Razorpay subscription created successfully:', subscriptionId);
          console.log('🔗 Subscription auth_link:', authLink);
          
          if (!authLink) {
            console.warn('⚠️ No auth_link in response - subscription may require manual payment setup');
          }
          
          return {
            id: subscriptionId,
            amount: Math.round(price * 100),
            isSubscription: true,
            authLink: authLink || undefined // Store auth_link for redirect
          };
        } catch (subscriptionError: any) {
          console.error('❌ Failed to create Razorpay subscription:', subscriptionError);
          console.error('📋 Error details:', {
            message: subscriptionError.message,
            response: subscriptionError.response?.data,
            status: subscriptionError.response?.status,
            statusText: subscriptionError.response?.statusText,
            fullError: subscriptionError
          });
          
          // Re-throw with more context
          const errorMessage = subscriptionError.response?.data?.details || 
                              subscriptionError.response?.data?.error || 
                              subscriptionError.message || 
                              'Failed to create subscription';
          throw new Error(errorMessage);
        }
      }
      
      // Fallback to one-time order if subscription plan ID not available
      const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
      const amountInPaise = Math.round(price * 100);
      
      const response = await api.post('/payment/create-order', {
        amount: amountInPaise,
        currency: 'INR',
        planId,
        userId,
        billingCycle,
        razorpayPlanId // Include Razorpay plan ID for reference/tracking
      });
      return {
        id: response.data.data.id,
        amount: response.data.data.amount,
        isSubscription: false
      };
    } catch (error) {
      console.error('Error creating order/subscription:', error);
      throw error;
    }
  }

  public async initializePayment(planId: string, userEmail: string, userId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('Payment is not available. Please check your configuration.');
      }
      await this.waitForRazorpayScript();
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }
      const orderOrSubscription = await this.createOrderOrSubscription(planId, userId, userEmail, billingCycle);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) {
        throw new Error('Invalid plan selected');
      }
      if (plan.isCustomPricing) {
        throw new Error('Enterprise plan requires custom pricing. Please contact sales.');
      }
      const billingText = billingCycle === 'yearly' ? ' (Yearly)' : ' (Monthly)';
      
      // For subscriptions, ALWAYS use auth_link redirect (Razorpay subscriptions require this)
      if (orderOrSubscription.isSubscription) {
        const authLink = (orderOrSubscription as any).authLink;
        if (authLink) {
          console.log('🔄 Redirecting to Razorpay subscription auth_link:', authLink);
          window.location.href = authLink;
          return Promise.resolve(); // Return immediately as we're redirecting
        } else {
          // If no auth_link, try to use checkout.js with subscription_id as fallback
          console.warn('⚠️ No auth_link available, attempting checkout.js with subscription_id');
          // Continue to checkout.js flow below - it will use subscription_id
        }
      }
      
      return new Promise<void>((resolve, reject) => {
        const baseOptions: any = {
          key: this.razorpayKeyId,
          name: 'In3D.Ai',
          description: `Upgrade to ${plan.name} Plan${billingText}`,
          handler: async (response: any) => {
            try {
              if (orderOrSubscription.isSubscription) {
                // For subscriptions, Razorpay handles the payment automatically
                // The response contains subscription_id, payment_id, and signature
                console.log('Subscription payment success:', response);
                
                // Update our database with subscription details
                // Note: For subscriptions, we use the internal planId (team, pro, etc.) not the Razorpay plan ID
                await api.post('/subscription/create', {
                  userId,
                  planId, // Internal plan ID (team, pro, etc.)
                  planName: plan.name,
                  billingCycle,
                  providerSubscriptionId: response.razorpay_subscription_id || orderOrSubscription.id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                });
              } else {
                // For one-time orders, verify payment first
                await this.verifyPayment(response, userId, planId, billingCycle);
              }
              resolve();
            } catch (error) {
              console.error('Error handling payment response:', error);
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
          
          // Use subscription_id for subscriptions, order_id for one-time payments
          ...(orderOrSubscription.isSubscription 
            ? { 
                subscription_id: orderOrSubscription.id
              }
            : { 
                order_id: orderOrSubscription.id, 
                amount: orderOrSubscription.amount, 
                currency: 'INR' 
              }
          ),
          
          // Add these options to prevent COOP issues
          config: {
            display: {
              blocks: {
                banks: {
                  name: "Pay using UPI",
                  instruments: [
                    {
                      method: "upi"
                    }
                  ]
                }
              },
              sequence: ["block.banks"],
              preferences: {
                show_default_blocks: false
              }
            }
          }
        };
        
        // Add prefill after all other options to avoid conflicts
        const options: any = {
          ...baseOptions,
          prefill: { email: userEmail }
        };
        
        try {
          const rzp = new window.Razorpay(options);
          
          // Add event listeners to handle popup issues
          rzp.on('payment.failed', (response: any) => {
            console.error('Payment failed:', response.error);
            reject(new Error(`Payment failed: ${response.error.description || 'Unknown error'}`));
          });
          
          rzp.on('payment.cancelled', () => {
            reject(new Error('Payment was cancelled by user'));
          });
          
          // Try to open the payment modal
          try {
            const popup = rzp.open();
            
            // Check if popup was blocked
            if (popup && popup.closed) {
              throw new Error('Popup blocked by browser');
            }
            
            // Add a timeout to detect if popup is blocked
            setTimeout(() => {
              if (popup && popup.closed) {
                reject(new Error('Popup blocked by browser. Please allow popups for this site.'));
              }
            }, 1000);
            
          } catch (popupError) {
            console.warn('Popup blocked, trying redirect method:', popupError);
            // Fallback to redirect method if popup is blocked
            this.initializePaymentWithRedirect(options, resolve, reject);
          }
        } catch (error) {
          console.error('Error opening Razorpay modal:', error);
          reject(new Error('Failed to open payment modal. Please try again.'));
        }
      });
    } catch (error) {
      console.error('Payment initialization error:', error);
      throw error;
    }
  }

  private initializePaymentWithRedirect(options: any, resolve: () => void, reject: (error: Error) => void): void {
    try {
      // Create a form and submit it to redirect to Razorpay
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://checkout.razorpay.com/v1/checkout.html';
      form.target = '_blank';
      
      // Add all the options as hidden fields
      Object.keys(options).forEach(key => {
        if (key !== 'handler' && key !== 'modal' && key !== 'config') {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = typeof options[key] === 'object' ? JSON.stringify(options[key]) : options[key];
          form.appendChild(input);
        }
      });
      
      // Add success and cancel URLs
      const successInput = document.createElement('input');
      successInput.type = 'hidden';
      successInput.name = 'callback_url';
      successInput.value = `${window.location.origin}/payment-success`;
      form.appendChild(successInput);
      
      const cancelInput = document.createElement('input');
      cancelInput.type = 'hidden';
      cancelInput.name = 'cancel_url';
      cancelInput.value = `${window.location.origin}/payment-cancelled`;
      form.appendChild(cancelInput);
      
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      
      // For redirect method, we can't easily track the result
      // The user will be redirected back to our success/cancel URLs
      resolve();
    } catch (error) {
      console.error('Error with redirect payment:', error);
      reject(new Error('Failed to initialize redirect payment'));
    }
  }

  private async verifyPayment(response: any, userId: string, planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<void> {
    try {
      const verifyRes = await api.post('/payment/verify', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      });
      if (!verifyRes.data.success) {
        throw new Error('Payment verification failed');
      }
      // Create subscription after payment verification
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      await api.post('/subscription/create', {
        userId,
        planId,
        planName: plan?.name || planId,
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        billingCycle
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