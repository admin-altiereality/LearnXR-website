import { auth } from '../config/firebase';

// API base URL - use Firebase Functions in production, localhost in development
const getApiBaseUrl = () => {
  const region = 'us-central1';
  const projectId = 'in3devoneuralai';
  return import.meta.env.PROD 
    ? `https://${region}-${projectId}.cloudfunctions.net/api`
    : 'http://localhost:5001/in3devoneuralai/us-central1/api';
};

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authentication token if user is logged in
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting auth token:', error);
      }
    }

    return headers;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Skybox API methods
  async getSkyboxStyles(page: number = 1, limit: number = 20) {
    return this.makeRequest(`/skybox/styles?page=${page}&limit=${limit}`);
  }

  async generateSkybox(prompt: string, styleId: number, negativePrompt?: string) {
    return this.makeRequest('/skybox/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        style_id: styleId,
        negative_prompt: negativePrompt
      }),
    });
  }

  async getSkyboxStatus(generationId: string) {
    return this.makeRequest(`/skybox/status/${generationId}`);
  }

  // Payment API methods
  async createPaymentOrder(amount: number, currency: string = 'INR', receipt?: string, notes?: any) {
    return this.makeRequest('/payment/create-order', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency,
        receipt,
        notes
      }),
    });
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string) {
    return this.makeRequest('/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      }),
    });
  }

  // Subscription API methods
  async createSubscription(userId: string, planId: string, planName: string) {
    return this.makeRequest('/subscription/create', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        planId,
        planName
      }),
    });
  }

  async getSubscription(subscriptionId: string) {
    return this.makeRequest(`/subscription/${subscriptionId}`);
  }

  async getUserSubscriptionStatus(userId: string) {
    return this.makeRequest('/subscription/status', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  // Health check
  async healthCheck() {
    return this.makeRequest('/health');
  }

  async envCheck() {
    return this.makeRequest('/env-check');
  }
}

export const apiService = new ApiService(); 