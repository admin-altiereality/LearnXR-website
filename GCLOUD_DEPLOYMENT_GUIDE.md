# Deploying Firebase Functions using gcloud with Zip Upload

## Overview
This guide explains how to deploy Firebase Functions using `gcloud` CLI with a zip file upload, which is useful when `firebase deploy` times out.

## Prerequisites

1. **gcloud CLI installed and authenticated:**
   ```bash
   gcloud auth login
   gcloud config set project in3devoneuralai
   ```

2. **Required APIs enabled:**
   ```bash
   gcloud services enable cloudfunctions.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   ```

## Method 1: Automated Script

### Step 1: Create Deployment Package
```bash
./scripts/create-function-zip.sh
```

This will:
- Build the TypeScript code
- Package all necessary files
- Install production dependencies
- Create a zip file ready for deployment

### Step 2: Deploy Using Script
```bash
./scripts/deploy-functions-gcloud.sh
```

## Method 2: Manual Deployment

### Step 1: Build and Package
```bash
cd functions
npm run build
cd ..
```

### Step 2: Create Zip File
```bash
./scripts/create-function-zip.sh
```

This creates a zip file like: `function-deploy-YYYYMMDD-HHMMSS.zip`

### Step 3: Deploy with gcloud
```bash
gcloud functions deploy api \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=/path/to/function-deploy-YYYYMMDD-HHMMSS.zip \
  --entry-point=api \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MiB \
  --timeout=60s \
  --max-instances=10 \
  --project=in3devoneuralai \
  --set-env-vars="FUNCTION_REGION=us-central1,GCLOUD_PROJECT=in3devoneuralai"
```

## Setting Secrets

Firebase Functions secrets need to be set separately:

```bash
# Set secrets using Firebase CLI
firebase functions:secrets:set BLOCKADE_API_KEY
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET

# Or using gcloud (if using Secret Manager)
gcloud secrets versions access latest --secret="BLOCKADE_API_KEY" --project=in3devoneuralai
```

## Important Notes

1. **Secrets**: The gcloud deploy command doesn't automatically include Firebase secrets. You need to:
   - Either set them as environment variables (not recommended for secrets)
   - Or use Secret Manager and reference them in the deploy command
   - Or set them using `firebase functions:secrets:set` after deployment

2. **Function Name**: The function must be named `api` to match the export in `functions/src/index.ts`

3. **Region**: Must match the region in `functions/src/index.ts` (`us-central1`)

4. **Runtime**: Must match `package.json` (`nodejs22`)

## Troubleshooting

### Error: Function already exists
If the function already exists, you can update it by adding `--update-env-vars` or use:
```bash
gcloud functions delete api --region=us-central1 --gen2
# Then deploy again
```

### Error: Permission denied
Make sure you have the necessary permissions:
```bash
gcloud projects get-iam-policy in3devoneuralai
```

You need roles:
- `roles/cloudfunctions.developer`
- `roles/iam.serviceAccountUser`
- `roles/secretmanager.secretAccessor` (for secrets)

### Error: Timeout during deployment
The zip file might be too large. Check the size:
```bash
ls -lh function-deploy-*.zip
```

If it's very large (>50MB), you might need to:
- Exclude unnecessary files
- Use Cloud Build instead of direct upload

## Alternative: Using Cloud Build

For very large deployments, you can use Cloud Build:

```bash
gcloud builds submit --config=cloudbuild.yaml functions/
```

This requires a `cloudbuild.yaml` file in the functions directory.

## Verification

After deployment, verify the function:

```bash
# List functions
gcloud functions list --gen2 --region=us-central1

# Test the function
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health

# Check logs
gcloud functions logs read api --region=us-central1 --gen2 --limit=50
```

## Function URL

After successful deployment, your function will be available at:
```
https://us-central1-in3devoneuralai.cloudfunctions.net/api
```

