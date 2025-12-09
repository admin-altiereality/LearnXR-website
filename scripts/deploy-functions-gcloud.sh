#!/bin/bash

# Deploy Firebase Functions using gcloud with zip file upload
# This is a workaround for when firebase deploy times out

set -e  # Exit on error

PROJECT_ID="in3devoneuralai"
FUNCTION_NAME="api"
REGION="us-central1"
RUNTIME="nodejs22"
ENTRY_POINT="api"
MEMORY="512MiB"
TIMEOUT="60s"
MAX_INSTANCES="10"

echo ""
echo "=== Deploying Firebase Function using gcloud ==="
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo "Project: $PROJECT_ID"
echo ""

# Step 1: Build the TypeScript code
echo "Step 1: Building TypeScript code..."
cd functions
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Step 2: Create a temporary directory for packaging
echo ""
echo "Step 2: Packaging function code..."
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# Copy necessary files
cp -r lib "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
cp package-lock.json "$TEMP_DIR/"

# Copy dataconnect if it exists
if [ -d "src/dataconnect-admin-generated" ]; then
    mkdir -p "$TEMP_DIR/src"
    cp -r src/dataconnect-admin-generated "$TEMP_DIR/src/"
fi

# Create .gcloudignore to exclude unnecessary files
cat > "$TEMP_DIR/.gcloudignore" << EOF
# This file specifies files that are *not* uploaded to Google Cloud
# using gcloud. It follows the same syntax as .gitignore

.gcloudignore
.git
.gitignore
node_modules/
.env
.env.local
*.log
.DS_Store
EOF

# Step 3: Install production dependencies in temp directory
echo ""
echo "Step 3: Installing production dependencies..."
cd "$TEMP_DIR"
npm ci --production --ignore-scripts

# Step 4: Deployment package is ready in TEMP_DIR
echo ""
echo "Step 4: Deployment package ready"
echo "Package size: $(du -sh "$TEMP_DIR" | cut -f1)"
echo ""
echo "Note: gcloud will deploy directly from the directory (not zip)"

# Step 5: Deploy using gcloud
echo ""
echo "Step 5: Deploying function using gcloud..."
echo "This may take a few minutes..."

# For Firebase Functions v2 (Gen 2), gcloud expects a directory, not a zip file
# We'll deploy directly from the temp directory

gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --runtime="$RUNTIME" \
  --region="$REGION" \
  --source="$TEMP_DIR" \
  --entry-point="$ENTRY_POINT" \
  --trigger-http \
  --allow-unauthenticated \
  --memory="$MEMORY" \
  --timeout="$TIMEOUT" \
  --max-instances="$MAX_INSTANCES" \
  --project="$PROJECT_ID" \
  --set-env-vars="FUNCTION_REGION=$REGION,GCLOUD_PROJECT=$PROJECT_ID"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Deployment failed!"
    rm -rf "$TEMP_DIR"
    rm -f "$ZIP_FILE"
    exit 1
fi

# Cleanup
echo ""
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Function URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/$FUNCTION_NAME"
echo ""

