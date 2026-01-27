# Meshy API Key Update & Deployment Scripts

This directory contains scripts to update the Meshy API key and deploy Firebase Functions.

## Scripts Available

### 1. `update-meshy-key-and-deploy.sh` (Full-featured)
**Comprehensive script with cleanup options**

**Usage:**
```bash
# Basic usage (keeps old secret versions)
./scripts/update-meshy-key-and-deploy.sh <api_key>

# With cleanup of old secret versions
./scripts/update-meshy-key-and-deploy.sh <api_key> --cleanup-old-versions
```

**Example:**
```bash
./scripts/update-meshy-key-and-deploy.sh msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf --cleanup-old-versions
```

**Features:**
- ✅ Updates Meshy API key secret
- ✅ Lists all secret versions
- ✅ Optionally deletes old secret versions (with confirmation)
- ✅ Builds TypeScript functions
- ✅ Deploys functions
- ✅ Verifies deployment with health check

### 2. `quick-update-meshy-key.sh` (Quick & Simple)
**Fast script for quick updates**

**Usage:**
```bash
./scripts/quick-update-meshy-key.sh <api_key>
```

**Example:**
```bash
./scripts/quick-update-meshy-key.sh msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf
```

**Features:**
- ✅ Updates Meshy API key secret
- ✅ Builds TypeScript functions
- ✅ Deploys functions
- ⚠️ Does NOT clean up old secret versions

### 3. `update-meshy-key-and-deploy.ps1` (PowerShell)
**PowerShell version for Windows**

**Usage:**
```powershell
# Basic usage
.\scripts\update-meshy-key-and-deploy.ps1 -ApiKey "msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf"

# With cleanup
.\scripts\update-meshy-key-and-deploy.ps1 -ApiKey "msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf" -CleanupOldVersions
```

## Why Deploy After Updating Secret?

When you update a Firebase Functions secret:
1. **New version is created** - Firebase Secrets are versioned
2. **Functions use old version** - Functions are bound to a specific secret version at deployment time
3. **Redeploy required** - Functions must be redeployed to use the new secret version

Firebase will warn you:
```
i  1 functions are using stale version of secret MESHY_API_KEY:
	api(us-central1)
i  Please deploy your functions for the change to take effect
```

## Cleaning Up Old Secret Versions

### Why Clean Up?
- **Security**: Old API keys should be removed if compromised
- **Organization**: Keeps Secret Manager clean
- **Cost**: Minimal, but reduces clutter

### When to Clean Up
- ✅ When rotating keys for security
- ✅ When an old key is compromised
- ❌ Don't delete if you might need to rollback

### How It Works
The script uses `gcloud` to:
1. List all secret versions
2. Keep the latest version (the one you just created)
3. Delete all older versions (with your confirmation)

**Note:** You need `gcloud` CLI installed and authenticated for cleanup to work.

## Manual Steps (if scripts don't work)

If the scripts fail, you can do it manually:

```bash
# 1. Update the secret
echo -n "msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf" | firebase functions:secrets:set MESHY_API_KEY

# 2. Build functions
cd functions
npm run build
cd ..

# 3. Deploy functions
firebase deploy --only functions

# 4. (Optional) Delete old secret versions
gcloud secrets versions list MESHY_API_KEY --project=in3devoneuralai
# Then delete specific versions:
gcloud secrets versions destroy <version_number> --secret=MESHY_API_KEY --project=in3devoneuralai
```

## Verification

After deployment, verify the new key is working:

```bash
# Check health endpoint
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health

# Should show:
# {
#   "meshy": true,
#   ...
# }
```

## Troubleshooting

### Error: "Secret not found"
- Make sure you're logged into Firebase: `firebase login`
- Check project: `firebase use in3devoneuralai`

### Error: "Functions deployment failed"
- Check function logs: `firebase functions:log --only api`
- Verify TypeScript builds: `cd functions && npm run build`

### Error: "Cannot delete secret version"
- Old versions might be in use by other functions
- Some versions might already be deleted
- This is usually safe to ignore

### Cleanup doesn't work
- Install gcloud CLI: `gcloud --version`
- Authenticate: `gcloud auth login`
- Set project: `gcloud config set project in3devoneuralai`

## Current API Key

**Current Meshy API Key:** `msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf`

**Last Updated:** 2026-01-27

## Security Notes

⚠️ **Important:**
- Never commit API keys to version control
- Old secret versions are kept by default (for rollback)
- Delete old versions only if they're compromised
- Always verify deployment after updating keys
