#!/bin/bash

# Quick deployment script - finds the latest zip, extracts it, and deploys

# Use find with -print0 and xargs for better compatibility
ZIP_FILE=$(find . -maxdepth 1 -name "function-deploy-*.zip" -type f -print | sort | tail -1)

if [ -z "$ZIP_FILE" ] || [ ! -f "$ZIP_FILE" ]; then
    echo "❌ No zip file found. Run ./scripts/create-function-zip.sh first"
    exit 1
fi

echo "Found zip file: $ZIP_FILE"
echo "Size: $(du -h "$ZIP_FILE" | cut -f1)"
echo ""
echo "Extracting zip file to temporary directory..."

# Create temporary directory for extraction
TEMP_DEPLOY_DIR=$(mktemp -d)
echo "Extracting to: $TEMP_DEPLOY_DIR"

# Extract zip file
unzip -q "$ZIP_FILE" -d "$TEMP_DEPLOY_DIR"

if [ $? -ne 0 ]; then
    echo "❌ Failed to extract zip file!"
    rm -rf "$TEMP_DEPLOY_DIR"
    exit 1
fi

echo "✅ Extraction complete"
echo ""
echo "Deploying function..."
echo ""

gcloud functions deploy api \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source="$TEMP_DEPLOY_DIR" \
  --entry-point=api \
  --trigger-http \
  --allow-unauthenticated \
  --memory=512MiB \
  --timeout=60s \
  --max-instances=10 \
  --project=in3devoneuralai \
  --set-env-vars="FUNCTION_REGION=us-central1,GCLOUD_PROJECT=in3devoneuralai"

DEPLOY_STATUS=$?

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DEPLOY_DIR"

if [ $DEPLOY_STATUS -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Function URL: https://us-central1-in3devoneuralai.cloudfunctions.net/api"
    echo ""
    echo "Note: Secrets (BLOCKADE_API_KEY, etc.) need to be set separately using:"
    echo "  firebase functions:secrets:set BLOCKADE_API_KEY"
else
    echo ""
    echo "❌ Deployment failed!"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Function URL: https://us-central1-in3devoneuralai.cloudfunctions.net/api"
    echo ""
    echo "Note: Secrets (BLOCKADE_API_KEY, etc.) need to be set separately using:"
    echo "  firebase functions:secrets:set BLOCKADE_API_KEY"
else
    echo ""
    echo "❌ Deployment failed!"
    exit 1
fi

