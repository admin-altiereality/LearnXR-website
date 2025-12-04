# Firebase Permissions Setup Guide

## Current Issues

You're encountering permission errors when trying to:
1. Set Firebase Functions secrets (`BLOCKADE_API_KEY`)
2. Deploy Firebase Functions

## Required Permissions

You need the following IAM roles in your Google Cloud Project:

1. **Secret Manager Secret Accessor** - To set and access secrets
2. **Service Account User** - To deploy Firebase Functions
3. **Firebase Admin** or **Editor** - For general Firebase operations

## Solution: Request Permissions from Project Owner

### Step 1: Contact Project Owner

Ask the project owner (or someone with Owner/Admin access) to grant you the following roles:

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai
2. Find your email: `manavkhandelwal72@gmail.com`
3. Click "Edit" (pencil icon)
4. Add these roles:
   - **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`)
   - **Service Account User** (`roles/iam.serviceAccountUser`)
   - **Firebase Admin** (`roles/firebase.admin`) or **Editor** (`roles/editor`)

### Step 2: Alternative - Use Firebase Console

If you have Firebase Console access, you can set secrets via the Google Cloud Console:

1. Go to: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai
2. Click "CREATE SECRET"
3. Name: `BLOCKADE_API_KEY`
4. Secret value: Your BlockadeLabs API key
5. Click "CREATE SECRET"

### Step 3: Set the BlockadeLabs API Key

Once you have permissions, run:

```bash
firebase functions:secrets:set BLOCKADE_API_KEY
```

When prompted, paste your BlockadeLabs API key.

**To get your BlockadeLabs API key:**
1. Go to https://www.blockadelabs.com/
2. Sign in to your account
3. Navigate to API Keys section
4. Copy your API key

### Step 4: Deploy Functions

After setting the secret:

```bash
firebase deploy --only functions
```

## Quick Setup via Google Cloud Console

If you have Google Cloud Console access:

### 1. Create Secret via Console

1. Visit: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai
2. Click **"CREATE SECRET"**
3. Fill in:
   - **Name**: `BLOCKADE_API_KEY`
   - **Secret value**: Your BlockadeLabs API key
4. Click **"CREATE SECRET"**

### 2. Grant Secret Access to Functions

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai
2. Find the service account: `in3devoneuralai@appspot.gserviceaccount.com`
3. Click **"Edit"** (pencil icon)
4. Add role: **Secret Manager Secret Accessor**
5. Save

### 3. Deploy Functions

```bash
firebase deploy --only functions
```

## Verify Setup

After setting up, verify the API key is configured:

```bash
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

Or visit in browser:
```
https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

The response should show:
```json
{
  "blockadelabs": true,
  ...
}
```

## Current Status

- ✅ Firebase CLI logged in: `manavkhandelwal72@gmail.com`
- ❌ Missing: Secret Manager permissions
- ❌ Missing: Service Account User permissions
- ✅ Functions code is ready and built

## Next Steps

1. **Request permissions** from project owner, OR
2. **Use Google Cloud Console** to set the secret directly, OR
3. **Ask project owner** to set the secret for you

Once the secret is set and permissions are granted, you can deploy the functions and the skybox generation will work.

