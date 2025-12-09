#!/bin/bash

# Deploy to Preview Channel: manav-evoneuralai
# This script deploys functions and hosting to the existing preview channel

set -e  # Exit on error

CHANNEL_NAME="manav-evoneuralai"
PROJECT_ID="in3devoneuralai"

echo ""
echo "=== Deploying to Preview Channel: $CHANNEL_NAME ==="
echo ""
echo "This will:"
echo "  1. Deploy Firebase Functions (shared, needed for API)"
echo "  2. Build the client application"
echo "  3. Deploy Hosting to preview channel ONLY (not production)"
echo ""
echo "Preview URL will be: https://${PROJECT_ID}--${CHANNEL_NAME}.web.app"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "Step 1: Deploying Functions..."
echo "================================"
firebase deploy --only functions

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Functions deployment failed!"
    exit 1
fi

echo ""
echo "Step 2: Building client..."
echo "==========================="
cd server/client
npm run build:firebase

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Client build failed!"
    cd ../..
    exit 1
fi

cd ../..

echo ""
echo "Step 3: Deploying Hosting to Preview Channel..."
echo "================================================"
echo "Note: Function rewrite is disabled in firebase.json to avoid Cloud Run validation errors."
echo "The client calls the function directly via URL, so this is not needed."
firebase hosting:channel:deploy $CHANNEL_NAME

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Preview channel deployment failed!"
    exit 1
fi

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Preview Channel URL:"
echo "https://${PROJECT_ID}--${CHANNEL_NAME}.web.app"
echo ""
echo "Note: Functions are deployed to production (shared), but hosting is only on preview channel."
echo ""

