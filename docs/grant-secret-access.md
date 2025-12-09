# Grant Secret Access to Service Account

## Current Status
- ✅ Secret `BLOCKADE_API_KEY` exists
- ✅ Your account has Secret Manager Admin role
- ❌ Service account `in3devoneuralai@appspot.gserviceaccount.com` needs "Secret Manager Secret Accessor" role

## Steps to Fix

### Step 1: Grant Access to Service Account

In the Google Cloud Console (where you're currently viewing the permissions):

1. Click the **"Grant access"** button (top right)
2. In the "New principals" field, enter:
   ```
   in3devoneuralai@appspot.gserviceaccount.com
   ```
3. Click "Select a role" dropdown
4. Search for and select: **"Secret Manager Secret Accessor"**
5. Click **"SAVE"**

### Step 2: Verify Access

After granting access, you should see:
- `in3devoneuralai@appspot.gserviceaccount.com` in the permissions list
- With role: **"Secret Manager Secret Accessor"**

### Step 3: Redeploy Functions

Once access is granted, redeploy the functions:

```bash
firebase deploy --only functions
```

**Note:** If you get a permission error for deployment, you'll need "Service Account User" role. But the secret access should work once granted.

## What This Fixes

- ✅ Firebase Functions can now read `BLOCKADE_API_KEY`
- ✅ `/skybox/styles` endpoint will work
- ✅ Skybox generation will work
- ✅ All In3D.Ai features will be functional

