#!/bin/bash

# Update Meshy API Key and Deploy Functions
# This script updates the MESHY_API_KEY secret and deploys functions with the new key
# Optionally cleans up old secret versions

set -e  # Exit on error

PROJECT_ID="in3devoneuralai"
SECRET_NAME="MESHY_API_KEY"
FUNCTION_NAME="api"
REGION="us-central1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  Update Meshy API Key & Deploy Functions"
echo "=========================================="
echo ""

# Check if API key is provided as argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <meshy_api_key> [--cleanup-old-versions]${NC}"
    echo ""
    echo "Example:"
    echo "  $0 msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf"
    echo "  $0 msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf --cleanup-old-versions"
    echo ""
    exit 1
fi

NEW_API_KEY="$1"
CLEANUP_OLD_VERSIONS=false

if [ "$2" == "--cleanup-old-versions" ]; then
    CLEANUP_OLD_VERSIONS=true
fi

# Validate API key format
if [[ ! "$NEW_API_KEY" =~ ^msy_ ]]; then
    echo -e "${YELLOW}⚠️  Warning: API key doesn't start with 'msy_'. Are you sure this is correct?${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${CYAN}Step 1: Updating Meshy API Key Secret...${NC}"
echo "=========================================="
echo "Secret Name: $SECRET_NAME"
echo "API Key: ${NEW_API_KEY:0:10}...${NEW_API_KEY: -4}"
echo ""

# Update the secret
echo -n "$NEW_API_KEY" | firebase functions:secrets:set "$SECRET_NAME"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to update secret!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Secret updated successfully!${NC}"
echo ""

# List secret versions
echo -e "${CYAN}Step 2: Checking Secret Versions...${NC}"
echo "=========================================="
echo ""

# Get list of secret versions (using gcloud since Firebase CLI doesn't have this)
SECRET_VERSIONS=$(gcloud secrets versions list "$SECRET_NAME" --project="$PROJECT_ID" --format="value(name)" 2>/dev/null || echo "")

if [ -n "$SECRET_VERSIONS" ]; then
    VERSION_COUNT=$(echo "$SECRET_VERSIONS" | wc -l | tr -d ' ')
    echo "Found $VERSION_COUNT secret version(s)"
    echo ""
    
    if [ "$CLEANUP_OLD_VERSIONS" = true ] && [ "$VERSION_COUNT" -gt 1 ]; then
        echo -e "${YELLOW}⚠️  Cleanup mode enabled. Old versions will be deleted.${NC}"
        echo ""
        
        # Get the latest version (first in the list)
        LATEST_VERSION=$(echo "$SECRET_VERSIONS" | head -n 1)
        echo "Latest version (will be kept): $LATEST_VERSION"
        echo ""
        
        # Get old versions (all except the first one)
        OLD_VERSIONS=$(echo "$SECRET_VERSIONS" | tail -n +2)
        
        if [ -n "$OLD_VERSIONS" ]; then
            echo "Old versions to delete:"
            echo "$OLD_VERSIONS" | while read -r version; do
                echo "  - $version"
            done
            echo ""
            
            read -p "Delete old secret versions? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo ""
                echo "Deleting old versions..."
                echo "$OLD_VERSIONS" | while read -r version; do
                    # Extract version number from full path
                    VERSION_NUM=$(echo "$version" | awk -F'/' '{print $NF}')
                    echo "  Deleting version: $VERSION_NUM"
                    gcloud secrets versions destroy "$VERSION_NUM" \
                        --secret="$SECRET_NAME" \
                        --project="$PROJECT_ID" \
                        --quiet 2>/dev/null || echo "    ⚠️  Could not delete $VERSION_NUM (may already be deleted)"
                done
                echo -e "${GREEN}✅ Old versions cleanup complete!${NC}"
            else
                echo "Skipping cleanup of old versions."
            fi
        else
            echo "No old versions to delete."
        fi
    else
        echo "Old versions are kept (use --cleanup-old-versions to delete them)"
    fi
else
    echo "Could not list secret versions (this is okay if gcloud is not configured)"
fi

echo ""
echo -e "${CYAN}Step 3: Building Functions...${NC}"
echo "=========================================="
echo ""

cd functions

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    cd ..
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"
cd ..

echo ""
echo -e "${CYAN}Step 4: Deploying Functions...${NC}"
echo "=========================================="
echo ""
echo "This will deploy functions with the new Meshy API key."
echo "The deployment may take a few minutes..."
echo ""

firebase deploy --only functions

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Functions deployment failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Functions deployed successfully!${NC}"
echo ""

echo -e "${CYAN}Step 5: Verifying Deployment...${NC}"
echo "=========================================="
echo ""

# Wait a moment for the function to be ready
sleep 3

# Test the health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "https://us-central1-${PROJECT_ID}.cloudfunctions.net/api/health" || echo "")

if [ -n "$HEALTH_RESPONSE" ]; then
    # Check if meshy is configured
    if echo "$HEALTH_RESPONSE" | grep -q '"meshy":true'; then
        echo -e "${GREEN}✅ Meshy API key is working!${NC}"
    else
        echo -e "${YELLOW}⚠️  Meshy API key may not be configured correctly.${NC}"
        echo "Response: $HEALTH_RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠️  Could not verify deployment (endpoint may not be ready yet)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Function URL:"
echo "  https://us-central1-${PROJECT_ID}.cloudfunctions.net/api"
echo ""
echo "Health Check:"
echo "  https://us-central1-${PROJECT_ID}.cloudfunctions.net/api/health"
echo ""
echo "Next Steps:"
echo "  1. Test Meshy API generation from your app"
echo "  2. Check function logs if you encounter issues:"
echo "     firebase functions:log --only api"
echo ""
