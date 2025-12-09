# BlockadeLabs API Key Setup Guide

## Issue
The error "Skybox generation service is not configured properly" indicates that the `BLOCKADE_API_KEY` secret is not set in Firebase Functions.

## Solution

You need to set the `BLOCKADE_API_KEY` secret in Firebase Functions. Here's how:

### Step 1: Get Your BlockadeLabs API Key

1. Go to [BlockadeLabs Dashboard](https://www.blockadelabs.com/)
2. Sign in to your account
3. Navigate to API Keys section
4. Copy your API key

### Step 2: Set the Secret in Firebase Functions

Run the following command in your terminal:

```bash
firebase functions:secrets:set BLOCKADE_API_KEY
```

When prompted, paste your BlockadeLabs API key.

### Step 3: Redeploy Firebase Functions

After setting the secret, you need to redeploy your functions:

```bash
firebase deploy --only functions
```

### Step 4: Verify the Setup

You can verify the API key is configured by checking the `/env-check` endpoint:

```bash
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

Or visit in your browser:
```
https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

The response should show `"blockadelabs": true` if the key is configured.

## Alternative: Using Environment Variables (Not Recommended for Production)

If you're testing locally, you can use environment variables, but for production, secrets are the recommended approach.

## Troubleshooting

### Error: Permission denied
If you get a permission error, make sure you're logged in:
```bash
firebase login
```

### Error: Secret doesn't exist
If the secret doesn't exist, create it:
```bash
firebase functions:secrets:set BLOCKADE_API_KEY
```

### Check if secret is set
You can check if the secret exists (but not view its value):
```bash
firebase functions:secrets:access BLOCKADE_API_KEY
```

Note: This command will fail if you don't have permission or if the secret doesn't exist.

## Important Notes

1. **Never commit API keys to version control** - Always use Firebase Secrets
2. **Secrets are encrypted** - Firebase automatically encrypts secrets
3. **Redeploy after setting secrets** - Functions need to be redeployed to use new secrets
4. **Secrets are project-specific** - Each Firebase project has its own secrets

## Related Files

- `functions/src/index.ts` - Where the secret is used
- `firebase.json` - Firebase configuration
- `functions/package.json` - Functions dependencies

