#!/bin/bash

# Deploy Firebase Functions directly from source directory
# This avoids zip file issues and uses the actual source structure

set -e

PROJECT_ID="in3devoneuralai"
FUNCTION_NAME="api"
REGION="us-central1"
RUNTIME="nodejs22"
ENTRY_POINT="api"
MEMORY="512MiB"
TIMEOUT="60s"
MAX_INSTANCES="10"

echo ""
echo "=== Deploying Firebase Function directly from source ==="
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo "Project: $PROJECT_ID"
echo ""

# Step 1: Build TypeScript
echo "Step 1: Building TypeScript code..."
cd functions
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Step 2: Install all dependencies (gcloud will build from source)
echo ""
echo "Step 2: Installing dependencies..."
npm ci

# Step 3: Deploy using gcloud
# Note: gcloud will build from TypeScript source automatically
echo ""
echo "Step 3: Deploying function using gcloud..."
echo "This may take a few minutes (gcloud will build from source)..."
echo ""

cd ..

# Deploy from functions directory - gcloud will build it
# Note: Secrets need to be set separately and will be accessed via defineSecret in code
gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --runtime="$RUNTIME" \
  --region="$REGION" \
  --source="functions" \
  --entry-point="$ENTRY_POINT" \
  --trigger-http \
  --allow-unauthenticated \
  --memory="$MEMORY" \
  --timeout="$TIMEOUT" \
  --max-instances="$MAX_INSTANCES" \
  --project="$PROJECT_ID" \
  --set-env-vars="FUNCTION_REGION=$REGION,GCLOUD_PROJECT=$PROJECT_ID" \
  --set-secrets="BLOCKADE_API_KEY=BLOCKADE_API_KEY:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Function URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/$FUNCTION_NAME"
    echo ""
    echo "Note: Secrets (BLOCKADE_API_KEY, etc.) need to be set separately using:"
    echo "  firebase functions:secrets:set BLOCKADE_API_KEY"
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "Check the build logs at:"
    echo "  https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
    exit 1
fi

