# Dual Payment Gateway Setup Guide

This guide explains how to set up the dual payment gateway system (Razorpay + Paddle) for geo-based payment routing.

## Overview

The system routes payments based on user location:
- **India (IN)** → Razorpay (UPI, local cards, better conversion)
- **All other countries** → Paddle (international cards, tax handling, compliance)

## Environment Variables

### Client-Side (`.env` in `server/client/`)

```env
# Razorpay (India)
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx          # Razorpay Key ID
VITE_RAZORPAY_PRO_MONTHLY_PLAN_ID=           # Optional: Razorpay subscription plan ID
VITE_RAZORPAY_PRO_YEARLY_PLAN_ID=
VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID=
VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID=

# Paddle (International)
VITE_PADDLE_CLIENT_TOKEN=live_xxxxx          # Paddle client-side token
VITE_PADDLE_ENVIRONMENT=sandbox              # 'sandbox' or 'production'
VITE_PADDLE_PRO_MONTHLY_PRICE_ID=pri_xxxxx   # Paddle price IDs
VITE_PADDLE_PRO_YEARLY_PRICE_ID=pri_xxxxx
VITE_PADDLE_TEAM_MONTHLY_PRICE_ID=pri_xxxxx
VITE_PADDLE_TEAM_YEARLY_PRICE_ID=pri_xxxxx
```

### Server-Side (`.env` in `server/`)

```env
# Razorpay (India)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

# Paddle (International)
PADDLE_API_KEY=xxxxx
PADDLE_WEBHOOK_SECRET=pdl_xxxxx
PADDLE_PRO_PRODUCT_ID=pro_xxxxx
PADDLE_TEAM_PRODUCT_ID=pro_xxxxx
PADDLE_ENTERPRISE_PRODUCT_ID=pro_xxxxx

# Geo Detection
DEFAULT_COUNTRY=IN                          # Default for localhost testing
```

## Razorpay Setup

### 1. Create Razorpay Account
1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Complete KYC verification
3. Get API keys from Settings → API Keys

### 2. Create Subscription Plans (Optional)
If using Razorpay Subscriptions instead of one-time payments:
1. Go to Dashboard → Subscriptions → Plans
2. Create plans for each tier (Pro Monthly, Pro Yearly, etc.)
3. Copy the plan IDs to environment variables

### 3. Configure Webhooks
1. Go to Dashboard → Settings → Webhooks
2. Add webhook endpoint: `https://your-domain.com/api/payment/razorpay/webhook`
3. Select events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.halted`
4. Copy the webhook secret

## Paddle Setup

### 1. Create Paddle Account
1. Sign up at [paddle.com](https://paddle.com)
2. Complete seller verification
3. Get API credentials from Developer Tools

### 2. Create Products & Prices
1. Go to Catalog → Products
2. Create products for each tier:
   - Pro Plan
   - Team Plan
   - Enterprise Plan
3. Add prices for each billing cycle (monthly/yearly)
4. Copy the price IDs to environment variables

### 3. Configure Webhooks
1. Go to Developer Tools → Notifications
2. Add webhook endpoint: `https://your-domain.com/api/payment/paddle/webhook`
3. Select events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.activated`
   - `subscription.canceled`
   - `subscription.past_due`
   - `transaction.completed`
   - `transaction.payment_failed`
4. Copy the webhook secret

## Testing

### Test Country Detection
```bash
# India IP → Should route to Razorpay
curl -H "X-Forwarded-For: 103.21.125.1" https://your-domain.com/api/payment/detect-country

# US IP → Should route to Paddle
curl -H "X-Forwarded-For: 8.8.8.8" https://your-domain.com/api/payment/detect-country
```

### Test Payment Flow

#### Razorpay Test Cards
- Success: `4111 1111 1111 1111`
- Failure: `5267 3181 8797 5449`
- UPI: Use `success@razorpay` for test UPI

#### Paddle Sandbox
- Use test credit card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVV: Any 3 digits

### Acceptance Tests

| Scenario | Expected Provider |
|----------|------------------|
| India IP + India billing | Razorpay |
| US IP + US billing | Paddle |
| India IP + US billing | Paddle (billing wins) |
| Unknown IP + no billing | Paddle (default) |

## Subscription Data Model

Each subscription document in Firestore contains:

```typescript
{
  userId: string;
  planId: 'free' | 'pro' | 'team' | 'enterprise';
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  provider: 'razorpay' | 'paddle';
  
  // Billing period
  currentPeriodStart: string;      // ISO date
  currentPeriodEnd: string;        // ISO date
  cancelAtPeriodEnd: boolean;
  
  // Provider IDs
  providerCustomerId: string;      // Paddle customer ID or Razorpay customer ID
  providerSubscriptionId: string;  // Paddle/Razorpay subscription ID
  
  // Webhook idempotency
  lastEventId: string;
  lastEventAt: string;
  processedEventIds: string[];
  
  // Usage
  usage: {
    skyboxGenerations: number;
  };
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

## Webhook Idempotency

The system prevents duplicate processing of webhook events:

1. Each webhook event has a unique `eventId`
2. Before processing, we check if `eventId` exists in `processedEventIds`
3. After processing, we add `eventId` to both `processedEventIds` array and `webhook_events` collection
4. Duplicate events are acknowledged but not reprocessed

## Feature Gating

Access to premium features is controlled server-side:

```typescript
// Example: Check if user can use a feature
const subscription = await getUserSubscription(userId);

if (subscription.status !== 'active' && subscription.status !== 'trialing') {
  throw new Error('Subscription not active');
}

if (subscription.planId === 'free') {
  throw new Error('Premium feature requires upgrade');
}
```

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Ensure webhook secret is correct
   - Check that raw body is used for verification (not parsed JSON)

2. **Country detection returns wrong country**
   - Check X-Forwarded-For header is set correctly by your proxy/CDN
   - Ensure IP geolocation service is not rate-limited

3. **Paddle checkout doesn't open**
   - Verify `VITE_PADDLE_CLIENT_TOKEN` is set
   - Check browser console for Paddle SDK errors
   - Ensure price IDs are valid for your environment (sandbox vs production)

4. **Razorpay popup blocked**
   - Enable popups for the domain
   - The system will fall back to redirect method if popup fails

### Support

For payment-related issues, contact:
- Razorpay: support@razorpay.com
- Paddle: support@paddle.com
- Our team: support@in3d.ai

