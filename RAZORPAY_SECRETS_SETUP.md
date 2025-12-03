# Razorpay Secrets Setup Guide

This guide explains how to properly set up Razorpay secrets for Firebase Functions v2.

## ✅ Code Changes Made

The code has been updated to use Firebase Functions v2's proper secret management:

1. **Secrets are now defined using `defineSecret`** from `firebase-functions/v2/params`
2. **Secrets are accessed using `.value()` method** instead of `process.env`
3. **Function export passes secret references** instead of string names

## 🔧 Setting Up Secrets in Firebase

### Step 1: Set Secrets in Firebase Secret Manager

Run these commands in your terminal (replace with your actual values):

```bash
# Set Razorpay Key ID
echo -n "your_razorpay_key_id_here" | firebase functions:secrets:set RAZORPAY_KEY_ID

# Set Razorpay Key Secret
echo -n "your_razorpay_key_secret_here" | firebase functions:secrets:set RAZORPAY_KEY_SECRET

# Set Blockade API Key (if not already set)
echo -n "your_blockade_api_key_here" | firebase functions:secrets:set BLOCKADE_API_KEY
```

**Important Notes:**
- Use `-n` flag with `echo` to avoid adding a newline character
- Replace the placeholder values with your actual credentials
- Make sure you're logged into Firebase CLI: `firebase login`

### Step 2: Verify Secrets Are Set

```bash
# List all secrets
firebase functions:secrets:list

# Check if a specific secret exists
firebase functions:secrets:access RAZORPAY_KEY_ID
```

### Step 3: Deploy Functions

After setting secrets, deploy your functions:

```bash
cd functions
npm install  # Make sure dependencies are installed
npm run build  # Build TypeScript
cd ..
firebase deploy --only functions
```

## 🧪 Testing the Setup

### 1. Check Environment Endpoint

After deployment, test the `/env-check` endpoint:

```bash
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

Expected response:
```json
{
  "razorpay": true,
  "env_debug": {
    "razorpay_key_length": 20,  // Should be > 0
    "razorpay_secret_length": 32  // Should be > 0
  }
}
```

### 2. Test Payment Flow

1. Try creating a payment order
2. Check Firebase Functions logs for any errors
3. Verify Razorpay modal opens correctly

## 🔍 Troubleshooting

### Issue: `razorpay: false` in env-check

**Solution:**
1. Verify secrets are set: `firebase functions:secrets:list`
2. Check secret names match exactly (case-sensitive):
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `BLOCKADE_API_KEY`
3. Redeploy functions after setting secrets

### Issue: Function fails to deploy

**Solution:**
1. Make sure you're using Firebase CLI v11+ (supports secrets)
2. Check you're logged in: `firebase login`
3. Verify project is set: `firebase use in3devoneuralai`

### Issue: Secrets not accessible in function

**Solution:**
1. Ensure secrets are passed in function export (already done in code)
2. Check Firebase Console → Functions → Secret Manager
3. Verify function has permission to access secrets

## 📝 Key Differences from Old Approach

### Old (Incorrect):
```typescript
// ❌ Wrong: Using process.env directly
const key = process.env.RAZORPAY_KEY_ID;

export const api = onRequest({
  secrets: ['RAZORPAY_KEY_ID']  // String array
}, app);
```

### New (Correct):
```typescript
// ✅ Correct: Using defineSecret
const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const key = razorpayKeyId.value();

export const api = onRequest({
  secrets: [razorpayKeyId]  // Secret references
}, app);
```

## 🚀 Production Checklist

- [ ] Secrets are set in Firebase Secret Manager
- [ ] Function is deployed with secret references
- [ ] `/env-check` endpoint returns `razorpay: true`
- [ ] Payment order creation works
- [ ] Payment verification works
- [ ] Client-side `VITE_RAZORPAY_KEY_ID` is set for production build

## 📚 Additional Resources

- [Firebase Functions Secrets Documentation](https://firebase.google.com/docs/functions/config-env)
- [Firebase CLI Secrets Commands](https://firebase.google.com/docs/functions/manage-functions#set-secrets)

