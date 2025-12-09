# Quick Fix: Set BlockadeLabs API Key

## The Problem
The error "Skybox generation service is not configured properly" means the `BLOCKADE_API_KEY` secret is missing in Firebase Functions.

## Solution: Set the Secret via Google Cloud Console

### Step 1: Get Your BlockadeLabs API Key

1. Go to: **https://www.blockadelabs.com/**
2. Sign in to your account
3. Navigate to **API Keys** section (usually in Settings/Dashboard)
4. **Copy your API key**

### Step 2: Create the Secret in Google Cloud Console

1. **Open Google Cloud Console:**
   - Go to: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai
   - Make sure you're logged in with: `manavkhandelwal72@gmail.com`

2. **Create the Secret:**
   - Click **"CREATE SECRET"** button (top of the page)
   - **Name**: `BLOCKADE_API_KEY` (exactly this, case-sensitive)
   - **Secret value**: Paste your BlockadeLabs API key
   - Click **"CREATE SECRET"**

### Step 3: Grant Access to Firebase Functions Service Account

1. **Go to IAM & Admin:**
   - Visit: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai

2. **Find the Service Account:**
   - Look for: `in3devoneuralai@appspot.gserviceaccount.com`
   - If you don't see it, search for "App Engine default service account"

3. **Grant Secret Access:**
   - Click the **pencil icon** (Edit) next to the service account
   - Click **"ADD ANOTHER ROLE"**
   - Select: **"Secret Manager Secret Accessor"**
   - Click **"SAVE"**

### Step 4: Redeploy Firebase Functions

After setting the secret, you need to redeploy the functions:

```bash
firebase deploy --only functions
```

**Note:** If you get permission errors, you may need to ask the project owner to grant you the "Service Account User" role.

### Step 5: Verify It Works

1. **Check the API status:**
   - Visit: https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
   - Look for: `"blockadelabs": true`

2. **Test skybox generation:**
   - Go to your preview channel
   - Try generating a skybox
   - It should work now!

## Alternative: If You Don't Have Console Access

If you can't access Google Cloud Console, ask the project owner to:

1. Set the `BLOCKADE_API_KEY` secret in Secret Manager
2. Grant the service account "Secret Manager Secret Accessor" role
3. Grant you "Service Account User" role so you can deploy

## Quick Links

- **Secret Manager**: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai
- **IAM & Admin**: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai
- **BlockadeLabs Dashboard**: https://www.blockadelabs.com/
- **API Status Check**: https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check

## What Happens After Setup

Once the secret is set and functions are redeployed:
- ✅ Skybox generation will work
- ✅ No more "not configured properly" errors
- ✅ All In3D.Ai environment generation features will be functional

