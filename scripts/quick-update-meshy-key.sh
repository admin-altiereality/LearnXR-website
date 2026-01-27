#!/bin/bash

# Quick script to update Meshy API key and deploy functions
# Usage: ./quick-update-meshy-key.sh <api_key>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <meshy_api_key>"
    echo "Example: $0 msy_99dtcoX87ocUGaNz8Qm1vX6s5XyLHAFg5aHf"
    exit 1
fi

API_KEY="$1"

echo "Updating Meshy API key..."
echo -n "$API_KEY" | firebase functions:secrets:set MESHY_API_KEY

echo ""
echo "Building functions..."
cd functions
npm run build
cd ..

echo ""
echo "Deploying functions..."
firebase deploy --only functions

echo ""
echo "✅ Done! Functions deployed with new Meshy API key."
