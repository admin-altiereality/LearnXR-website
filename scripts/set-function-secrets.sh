#!/bin/bash

# Script to set Firebase Functions secrets interactively
# This will prompt you to enter each secret value

set -e

echo ""
echo "=== Setting Firebase Functions Secrets ==="
echo ""
echo "This script will help you set the required secrets for Firebase Functions."
echo "You will be prompted to enter each secret value."
echo ""
echo "Note: Secrets are stored securely in Google Secret Manager."
echo ""

# Check if firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Function to set a secret
set_secret() {
    local secret_name=$1
    local description=$2
    
    echo ""
    echo "Setting: $secret_name"
    if [ -n "$description" ]; then
        echo "Description: $description"
    fi
    echo ""
    read -sp "Enter the value for $secret_name (input will be hidden): " secret_value
    echo ""
    
    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipping $secret_name (empty value)"
        return
    fi
    
    # Use echo -n to avoid newline, pipe to firebase
    echo -n "$secret_value" | firebase functions:secrets:set "$secret_name"
    
    if [ $? -eq 0 ]; then
        echo "✅ $secret_name set successfully"
    else
        echo "❌ Failed to set $secret_name"
        return 1
    fi
}

# Set BLOCKADE_API_KEY
set_secret "BLOCKADE_API_KEY" "BlockadeLabs API key for skybox generation"

# Set RAZORPAY_KEY_ID
set_secret "RAZORPAY_KEY_ID" "Razorpay public key ID for payments"

# Set RAZORPAY_KEY_SECRET
set_secret "RAZORPAY_KEY_SECRET" "Razorpay secret key for payments"

echo ""
echo "=== Secret Setup Complete ==="
echo ""
echo "All secrets have been set. The function will automatically use them."
echo ""
echo "To verify secrets are set, run:"
echo "  firebase functions:secrets:access BLOCKADE_API_KEY"
echo ""

