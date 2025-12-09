# Enable BLOCKADE_API_KEY Secret

## Issue
The secret `BLOCKADE_API_KEY` is in a **DISABLED** state, which prevents Firebase Functions from accessing it.

## Solution: Enable the Secret Version

### Option 1: Via Google Cloud Console (Recommended)

1. **Go to Secret Manager:**
   - Visit: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai

2. **Click on the secret:**
   - Find and click on `BLOCKADE_API_KEY`

3. **Enable the latest version:**
   - Go to the **"Versions"** tab
   - Find the latest version (should show as "DISABLED")
   - Click the **three-dot menu** (⋮) next to the disabled version
   - Select **"Enable"**

4. **Verify:**
   - The version should now show as "Enabled"

### Option 2: Create a New Version

If enabling doesn't work, create a new version:

1. **Go to Secret Manager:**
   - Visit: https://console.cloud.google.com/security/secret-manager?project=in3devoneuralai

2. **Click on the secret:**
   - Find and click on `BLOCKADE_API_KEY`

3. **Add a new version:**
   - Click **"ADD VERSION"**
   - Paste your BlockadeLabs API key
   - Click **"ADD VERSION"**

4. **Disable the old version (optional):**
   - Go to the **"Versions"** tab
   - Disable the old disabled version to avoid confusion

## After Enabling

Once the secret is enabled, try deploying again:

```bash
firebase deploy --only functions
```

## Verify Secret Access

After deployment, test the API:

```bash
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

Expected response should show:
```json
{
  "blockadelabs": true,
  ...
}
```

