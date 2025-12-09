# Final Setup Steps

## Current Status
- ✅ `BLOCKADE_API_KEY` secret exists
- ✅ Service account access granted (if you completed Step 1)
- ❌ Need "Service Account User" role to deploy functions

## What You Need to Do

### Option 1: Request "Service Account User" Role (Recommended)

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=in3devoneuralai
2. Find your email: `manavkhandelwal72@gmail.com`
3. Click "Edit" (pencil icon)
4. Click "ADD ANOTHER ROLE"
5. Select: **"Service Account User"** (`roles/iam.serviceAccountUser`)
6. Click "SAVE"

Then run:
```bash
firebase deploy --only functions
```

### Option 2: Ask Project Owner to Deploy

If you can't get the role, ask the project owner (`evoneural.ai@gmail.com`) to:

1. Verify service account has "Secret Manager Secret Accessor" on `BLOCKADE_API_KEY`
2. Run: `firebase deploy --only functions`

### Option 3: Test if Functions Already Work

If functions were deployed before, they might work now that secret access is granted. Test by visiting:

```
https://us-central1-in3devoneuralai.cloudfunctions.net/api/env-check
```

Look for: `"blockadelabs": true`

## Quick Checklist

- [ ] Service account `in3devoneuralai@appspot.gserviceaccount.com` has "Secret Manager Secret Accessor" role on `BLOCKADE_API_KEY`
- [ ] You have "Service Account User" role (or project owner will deploy)
- [ ] Functions are redeployed
- [ ] Test the API endpoint

## After Deployment

Once functions are deployed, test:
1. Visit preview channel: https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app
2. Check if styles load
3. Try generating a skybox

