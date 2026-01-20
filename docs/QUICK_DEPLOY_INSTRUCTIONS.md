# Quick Deployment Instructions - gcloud with Zip Upload

## Step 1: Create Deployment Package

```bash
./scripts/create-function-zip.sh
```

This will:
- Build TypeScript code
- Package all necessary files
- Install production dependencies
- Create a zip file in the project root (e.g., `function-deploy-20251209-164634.zip`)

## Step 2: Deploy Using gcloud

### Option A: Use the Quick Deploy Script
```bash
./DEPLOY_NOW.sh
```

### Option B: Manual Deployment
```bash
# Replace with your actual zip filename
ZIP_FILE="function-deploy-20251209-164634.zip"

gcloud functions deploy api \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source="$ZIP_FILE" \
  --entry-point=api \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MiB \
  --timeout=60s \
  --max-instances=10 \
  --project=in3devoneuralai \
  --set-env-vars="FUNCTION_REGION=us-central1,GCLOUD_PROJECT=in3devoneuralai"
```

## Step 3: Set Secrets (Required)

After deployment, set the secrets using Firebase CLI:

```bash
firebase functions:secrets:set BLOCKADE_API_KEY
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

## Verification

After deployment, test the function:

```bash
# Test health endpoint
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health

# Check function status
gcloud functions describe api --region=us-central1 --gen2

# View logs
gcloud functions logs read api --region=us-central1 --gen2 --limit=50
```

## Function URL

Your function will be available at:
```
https://us-central1-in3devoneuralai.cloudfunctions.net/api
```

## Troubleshooting

### If deployment fails with "Function already exists"
The function might already be deployed. You can:
1. Update it (the deploy command will update if it exists)
2. Or delete and redeploy:
   ```bash
   gcloud functions delete api --region=us-central1 --gen2
   # Then deploy again
   ```

### If you get permission errors
Make sure you're authenticated:
```bash
gcloud auth login
gcloud config set project in3devoneuralai
```

### If secrets are not working
Secrets need to be set separately. They're not included in the zip file for security reasons.

