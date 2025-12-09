# Fix: "Skybox generation not found. It may have expired"

## Root Cause

This error occurs when:
1. The `BLOCKADE_API_KEY` secret is **DISABLED** in Google Cloud Secret Manager
2. Functions haven't been deployed after enabling the secret
3. The API key is invalid or expired

## Solution Steps

### Step 1: Enable the BLOCKADE_API_KEY Secret

The secret version is currently **DISABLED**. You need to enable it:

1. **Go to Secret Manager:**
   - Visit: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai

2. **Click on `BLOCKADE_API_KEY`**

3. **Go to "Versions" tab**

4. **Enable the latest version:**
   - Find the version marked as "DISABLED"
   - Click the **three-dot menu** (⋮) next to it
   - Select **"Enable"**

### Step 2: Verify Secret Access

1. **Check Permissions:**
   - Still in Secret Manager, go to **"Permissions"** tab
   - Verify `in3devoneuralai@appspot.gserviceaccount.com` has:
     - ✅ `Secret Manager Secret Accessor` role

2. **If missing, grant access:**
   - Go to: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai
   - Find: `in3devoneuralai@appspot.gserviceaccount.com`
   - Add role: `Secret Manager Secret Accessor`

### Step 3: Redeploy Functions

After enabling the secret, redeploy functions:

```powershell
firebase deploy --only functions
```

**Note:** The code has been fixed to use lazy initialization, so secrets are only accessed at runtime (not during deployment).

### Step 4: Test the API

Run the test script:

```powershell
.\test-skybox-api.ps1
```

Or manually test:

```powershell
Invoke-WebRequest -Uri "https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check" -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected response should show:
```json
{
  "blockadelabs": true,
  ...
}
```

### Step 5: Test Skybox Generation

After the API is working, try generating a skybox again on your preview channel:
- https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app/main

## Quick Fix Script

If you want to automate the testing:

```powershell
# 1. Test current status
.\test-skybox-api.ps1

# 2. If secret is disabled, enable it in Google Cloud Console
# 3. Then redeploy
firebase deploy --only functions

# 4. Test again
.\test-skybox-api.ps1
```

## Troubleshooting

### Error: "Cloud Secret Manager's latest version of secret 'BLOCKADE_API_KEY' is in illegal state DISABLED"

**Solution:** Enable the secret version in Google Cloud Console (Step 1 above)

### Error: "BLOCKADE_API_KEY is not configured"

**Solution:** 
1. Verify secret is enabled
2. Redeploy functions: `firebase deploy --only functions`
3. Wait 1-2 minutes for deployment to complete

### Error: "403 Forbidden" or "Invalid API key"

**Solution:**
1. Check if the API key value in the secret is correct
2. Verify the key is active in BlockadeLabs dashboard
3. Regenerate the key if needed and update the secret

## Verification Checklist

- [ ] Secret `BLOCKADE_API_KEY` is **ENABLED** (not disabled)
- [ ] Service account has `Secret Manager Secret Accessor` role
- [ ] Functions are deployed: `firebase deploy --only functions`
- [ ] `/env-check` endpoint returns `"blockadelabs": true`
- [ ] `/skybox/styles` endpoint works
- [ ] Preview channel can generate skyboxes

## Related Files

- `ENABLE_SECRET.md` - Detailed secret enabling instructions
- `test-skybox-api.ps1` - API testing script
- `PERMISSIONS_STATUS.md` - Current permissions status

