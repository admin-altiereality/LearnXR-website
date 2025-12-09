#!/bin/bash

# Create a zip file for manual deployment
# This script creates a deployment-ready zip file that can be uploaded via gcloud or Firebase Console

set -e

echo "=== Creating Function Deployment Package ==="
echo ""

# Store project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT/functions"

# Step 1: Build TypeScript
echo "Step 1: Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Step 2: Create temp directory
echo ""
echo "Step 2: Packaging files..."
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# Copy compiled code
cp -r lib "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
cp package-lock.json "$TEMP_DIR/"

# Copy dataconnect if exists
if [ -d "src/dataconnect-admin-generated" ]; then
    mkdir -p "$TEMP_DIR/src"
    cp -r src/dataconnect-admin-generated "$TEMP_DIR/src/"
fi

# Step 3: Install production dependencies
echo ""
echo "Step 3: Installing production dependencies..."
cd "$TEMP_DIR"
npm ci --production --ignore-scripts

# Step 4: Create zip
echo ""
echo "Step 4: Creating zip file..."
ZIP_FILE="$PROJECT_ROOT/function-deploy-$(date +%Y%m%d-%H%M%S).zip"
cd "$TEMP_DIR"
zip -r "$ZIP_FILE" . -x "*.git*" "*.DS_Store" "*.log" > /dev/null
cd "$PROJECT_ROOT"

echo ""
echo "✅ Zip file created: $ZIP_FILE"
echo "Size: $(du -h "$ZIP_FILE" | cut -f1)"
echo ""
echo "To deploy using gcloud, run:"
echo "  gcloud functions deploy api \\"
echo "    --gen2 \\"
echo "    --runtime=nodejs22 \\"
echo "    --region=us-central1 \\"
echo "    --source=$ZIP_FILE \\"
echo "    --entry-point=api \\"
echo "    --trigger-http \\"
echo "    --allow-unauthenticated \\"
echo "    --memory=512MiB \\"
echo "    --timeout=60s \\"
echo "    --max-instances=10 \\"
echo "    --project=in3devoneuralai"
echo ""
echo "Or use the quick deploy script:"
echo "  ./DEPLOY_NOW.sh"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

