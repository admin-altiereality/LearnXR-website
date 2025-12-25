# Razorpay Subscription Plans Setup Guide

This guide explains how to create all subscription plans (Free, Pro, Team, Enterprise) for both monthly and yearly billing cycles on Razorpay.

## Overview

Your application supports the following subscription tiers:
- **Free**: ₹0/month (handled in app logic, no Razorpay plan needed)
- **Pro**: ₹12,000/month or ₹1,20,000/year
- **Team**: ₹25,000/month or ₹2,50,000/year
- **Enterprise**: ₹50,000/month or ₹5,00,000/year (custom pricing - adjust as needed)

## Prerequisites

1. **Razorpay Account**: You need an active Razorpay account
   - Sign up at: https://dashboard.razorpay.com/
   - Complete KYC verification if required

2. **API Credentials**: Get your Razorpay API keys
   - Go to: https://dashboard.razorpay.com/app/keys
   - Copy your **Key ID** (starts with `rzp_test_` or `rzp_live_`)
   - Copy your **Key Secret** (click "Reveal" to see it)

3. **Environment Setup**: Ensure you have Node.js installed

## Step 1: Set Up Environment Variables

Create or update your `.env` file in the root directory with your Razorpay credentials:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

**Important**: 
- Use **test** credentials (`rzp_test_`) for development
- Use **live** credentials (`rzp_live_`) for production
- Never commit these credentials to version control

## Step 2: Run the Plan Creation Script

The script will create all necessary plans automatically:

```bash
node scripts/create-razorpay-plans.js
```

### What the Script Does

1. Validates your Razorpay credentials
2. Creates 6 subscription plans:
   - Pro Monthly (₹12,000)
   - Pro Yearly (₹1,20,000)
   - Team Monthly (₹25,000)
   - Team Yearly (₹2,50,000)
   - Enterprise Monthly (₹50,000)
   - Enterprise Yearly (₹5,00,000)
3. Outputs the Plan IDs you need to add to your environment variables

### Expected Output

```
🚀 Creating Razorpay Subscription Plans...
============================================================
✅ Razorpay credentials found
   Key ID: rzp_test_xxx...
   Mode: TEST
============================================================

📦 Creating: Pro Monthly...
✅ Created: Pro Monthly
   Plan ID: plan_xxxxxxxxxxxxx
   Amount: ₹12,000
   Period: 1 month

[... similar output for all plans ...]

📊 Summary

✅ Successfully created 6 plans:

📝 Environment Variables to Add:

# Client Environment Variables (server/client/.env)
VITE_RAZORPAY_PRO_MONTHLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_PRO_YEARLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID=plan_xxxxxxxxxxxxx
```

## Step 3: Add Plan IDs to Environment Variables

Copy the Plan IDs from the script output and add them to your client environment file:

**File**: `server/client/.env`

```env
# Razorpay Plan IDs (created via scripts/create-razorpay-plans.js)
VITE_RAZORPAY_PRO_MONTHLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_PRO_YEARLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID=plan_xxxxxxxxxxxxx
VITE_RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID=plan_xxxxxxxxxxxxx
```

## Step 4: Restart Your Application

After adding the Plan IDs, restart your development server:

```bash
# If running the client
cd server/client
npm run dev

# Or if running the full stack
npm run dev
```

## Step 5: Verify Plans in Razorpay Dashboard

1. Go to: https://dashboard.razorpay.com/app/subscriptions/plans
2. You should see all 6 plans listed
3. Verify the amounts and billing periods are correct

## Important Notes

### Free Plan

The **Free plan** (₹0) is **NOT** created as a Razorpay subscription because:
- Razorpay doesn't support zero-amount subscription plans
- Free users are handled entirely in your application logic
- No payment processing is needed for free tier

### Enterprise Plan Pricing

The Enterprise plan uses placeholder pricing:
- Monthly: ₹50,000
- Yearly: ₹5,00,000

**To customize Enterprise pricing:**
1. Edit `scripts/create-razorpay-plans.js`
2. Update the `amount` values for Enterprise plans
3. Re-run the script (it will create new plans - old ones can be deleted from dashboard)
4. Or manually adjust pricing in Razorpay dashboard

### Test vs Live Mode

- **Test Mode**: Use for development and testing
  - Plans created in test mode won't work with live payments
  - Test cards: https://razorpay.com/docs/payments/test-card-details/

- **Live Mode**: Use for production
  - Switch to Live mode in Razorpay dashboard
  - Create plans again with live credentials
  - Update environment variables with live plan IDs

## Troubleshooting

### Error: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set"

**Solution**: Make sure your `.env` file is in the root directory and contains:
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

### Error: "Invalid credentials" or "Authentication failed"

**Solution**: 
1. Verify your Key ID and Key Secret are correct
2. Make sure you're using the right mode (test vs live)
3. Check if your Razorpay account is fully activated

### Error: "Plan already exists"

**Solution**: 
- Plans with the same name/amount might already exist
- Check Razorpay dashboard: https://dashboard.razorpay.com/app/subscriptions/plans
- Delete duplicate plans or use different names

### Plans Created But Not Showing in App

**Solution**:
1. Verify Plan IDs are correctly added to `server/client/.env`
2. Restart your development server
3. Check browser console for any errors
4. Verify the environment variables are being loaded (check Network tab)

## Manual Plan Creation (Alternative)

If you prefer to create plans manually via Razorpay dashboard:

1. Go to: https://dashboard.razorpay.com/app/subscriptions/plans
2. Click "Create Plan"
3. Fill in:
   - **Plan Name**: e.g., "Pro Monthly"
   - **Amount**: ₹12,000 (in rupees, not paise)
   - **Billing Period**: Monthly or Yearly
   - **Description**: (optional)
4. Click "Create"
5. Copy the Plan ID (starts with `plan_`)
6. Add to your `.env` file

## Updating Existing Plans

If you need to update plan pricing:

1. **Option 1**: Delete old plans and create new ones
   - Delete from Razorpay dashboard
   - Re-run the script with new amounts

2. **Option 2**: Create new plans with different names
   - Update script with new amounts
   - Run script to create new plans
   - Update environment variables

**Note**: You cannot modify existing plan amounts in Razorpay. You must create new plans.

## Production Deployment

Before going live:

1. ✅ Create plans in **Live Mode** (not test mode)
2. ✅ Use live Razorpay credentials
3. ✅ Update all environment variables with live plan IDs
4. ✅ Test subscription flow end-to-end
5. ✅ Verify webhook endpoints are configured
6. ✅ Set up proper error monitoring

## Related Documentation

- [Razorpay Subscriptions API](https://razorpay.com/docs/payments/subscriptions/)
- [Payment Setup Guide](./PAYMENT_SETUP_GUIDE.md)
- [Razorpay Secrets Setup](./RAZORPAY_SECRETS_SETUP.md)

## Support

If you encounter issues:
1. Check Razorpay dashboard for plan status
2. Review Razorpay API logs
3. Check application logs for errors
4. Contact Razorpay support: support@razorpay.com

