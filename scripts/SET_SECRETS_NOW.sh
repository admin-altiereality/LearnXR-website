#!/bin/bash

# Quick script to set Firebase Functions secrets
# Usage: ./SET_SECRETS_NOW.sh

echo ""
echo "=== Setting Firebase Functions Secrets ==="
echo ""
echo "You will be prompted to enter each secret value."
echo "Values are hidden as you type for security."
echo ""

# Function to set a secret with proper syntax
set_secret() {
    local secret_name=$1
    local description=$2
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Setting: $secret_name"
    if [ -n "$description" ]; then
        echo "Description: $description"
    fi
    echo ""
    read -sp "Enter the value (input will be hidden): " secret_value
    echo ""
    
    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipping $secret_name (empty value provided)"
        return 0
    fi
    
    echo "Setting secret..."
    echo -n "$secret_value" | firebase functions:secrets:set "$secret_name"
    
    if [ $? -eq 0 ]; then
        echo "✅ $secret_name set successfully"
        return 0
    else
        echo "❌ Failed to set $secret_name"
        return 1
    fi
}

# Set BLOCKADE_API_KEY
set_secret "BLOCKADE_API_KEY" "BlockadeLabs API key for skybox generation (get from https://www.blockadelabs.com/)"

# Set RAZORPAY_KEY_ID
set_secret "RAZORPAY_KEY_ID" "Razorpay public key ID for payments (get from https://dashboard.razorpay.com/)"

# Set RAZORPAY_KEY_SECRET
set_secret "RAZORPAY_KEY_SECRET" "Razorpay secret key for payments (get from https://dashboard.razorpay.com/)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "=== Secret Setup Complete ==="
echo ""
echo "All secrets have been set. The function will automatically use them."
echo ""
echo "To verify, test the health endpoint:"
echo "  curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health"
echo ""
echo "The response should show blockadelabs and razorpay as 'true' if secrets are set correctly."
echo ""

