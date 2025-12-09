# Preview Channel Deployment Guide

## Overview

When testing, you can deploy **hosting** to a preview channel instead of production. This allows you to test changes without affecting the live site.

**Note:** Firebase Functions are shared and deploy to production, but this is safe since they're API endpoints that don't affect the UI.

## Quick Deploy to Preview Channel

### Option 1: Use the PowerShell Script (Recommended)

```powershell
.\deploy-preview-channel.ps1
```

Or specify a custom channel name:
```powershell
.\deploy-preview-channel.ps1 -ChannelName "my-test-channel"
```

### Option 2: Manual Commands

1. **Deploy Functions** (needed for API):
   ```bash
   firebase deploy --only functions
   ```

2. **Build Client:**
   ```bash
   cd server/client
   npm run build:firebase
   cd ../..
   ```

3. **Deploy to Preview Channel:**
   ```bash
   firebase hosting:channel:deploy test-channel
   ```

## What Gets Deployed Where

- ✅ **Functions**: Deployed to production (shared, needed for API)
- ✅ **Hosting**: Deployed to preview channel only (NOT production)

## Access Your Preview Channel

After deployment, you'll get a URL like:
```
https://in3devoneuralai--test-channel.web.app
```

## Important Notes

1. **Functions are shared**: All preview channels use the same Firebase Functions, so API changes affect all channels
2. **Hosting is isolated**: Each preview channel has its own hosting deployment
3. **No production impact**: Deploying to preview channels does NOT affect your production site
4. **Channel names**: Use descriptive names like `test-20240115` or `feature-skybox-fix`

## Clean Up Old Channels

Preview channels persist until you delete them. To manage channels:

1. Go to: https://console.firebase.google.com/project/in3devoneuralai/hosting
2. Click on "Channels" tab
3. Delete old/unused channels

## Production Deployment

When ready for production, use:
```bash
firebase deploy --only hosting
```

This deploys hosting to production (functions are already there).

