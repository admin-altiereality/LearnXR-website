#!/bin/bash

# Deploy to Preview Channel: lms-preview
# Deploys hosting to the LMS preview channel (build + channel deploy). Uses lms-preview, not lms.
# Optionally deploys functions with: DEPLOY_FUNCTIONS=1 ./scripts/deploy-preview-lms.sh

set -e

CHANNEL_NAME="lms-preview"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo ""
echo "=== Deploying to Firebase Preview Channel: $CHANNEL_NAME ==="
echo ""
echo "This will:"
echo "  1. Build the client (server/client)"
echo "  2. Deploy Hosting to preview channel '$CHANNEL_NAME' only (not production)"
if [ -n "${DEPLOY_FUNCTIONS}" ]; then
  echo "  3. Deploy Functions (shared)"
fi
echo ""
echo "Preview URL: https://learnxr-evoneuralai--${CHANNEL_NAME}.web.app"
echo ""

if [ -z "${CI}" ] && [ -z "${NONINTERACTIVE}" ]; then
  read -p "Press Enter to continue or Ctrl+C to cancel..."
fi

if [ -n "${DEPLOY_FUNCTIONS}" ]; then
  echo "Step 1: Deploying Functions..."
  firebase deploy --only functions
  echo ""
fi

echo "Step 2: Building client..."
cd server/client
npm run build:firebase
cd "$ROOT_DIR"

echo ""
echo "Step 3: Deploying Hosting to Preview Channel..."
firebase hosting:channel:deploy $CHANNEL_NAME

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Preview Channel URL:"
echo "  https://learnxr-evoneuralai--${CHANNEL_NAME}.web.app"
echo ""
