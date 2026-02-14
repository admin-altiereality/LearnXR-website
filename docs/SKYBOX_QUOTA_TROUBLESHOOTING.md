# Skybox Generation - Quota Exceeded Troubleshooting

## Symptom

- **Error**: "API quota has been exhausted. Please add credits at blockadelabs.com or contact support."
- **API**: `POST /skybox/generate` returns `403 Forbidden` with `code: QUOTA_EXCEEDED`
- **Cause**: The BlockadeLabs API key has run out of generation credits

## Root Cause

Skybox generation uses the [BlockadeLabs API](https://www.blockadelabs.com/). Each generation consumes credits from your BlockadeLabs account. When the monthly or plan quota is exhausted, the API returns 403 with a quota error.

## How to Fix

### 1. Add Credits / Upgrade Plan

1. Go to [BlockadeLabs](https://www.blockadelabs.com/) and sign in
2. Open your account / billing settings
3. Add credits or upgrade to a higher plan:
   - **Essential**: $20/month – 100 credits
   - **Standard**: $48/month – 300 credits
   - **Business**: $112/month – 500 credits (full API access)

### 2. Verify API Key

Ensure the correct BlockadeLabs API key is set in Firebase:

```bash
firebase functions:secrets:access BLOCKADE_API_KEY
```

To update the key:

```bash
echo -n "YOUR_NEW_BLOCKADE_API_KEY" | firebase functions:secrets:set BLOCKADE_API_KEY
```

Then redeploy functions:

```bash
firebase deploy --only functions
```

### 3. Check Health Endpoint

Verify BlockadeLabs is configured:

```
GET https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/health
```

Look for `blockadelabs: true` in the response.

## Code Changes (Error Handling)

The app now surfaces the actual API error message instead of a generic "Failed to create skybox generation":

- **skyboxApiService.ts**: Handles 4xx responses (axios `validateStatus` allows them) and throws the real error message for `QUOTA_EXCEEDED`, `INVALID_REQUEST`, etc.
- **MainSection.jsx**: Uses the API error message when available and shows quota-specific text when the error mentions quota/credits/exhausted.
