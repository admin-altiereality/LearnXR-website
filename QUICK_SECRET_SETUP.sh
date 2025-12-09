#!/bin/bash

# Quick secret setup - copy and paste your values

echo ""
echo "=== Quick Secret Setup ==="
echo ""
echo "This script will help you set secrets using copy-paste."
echo "You'll need your actual secret values ready."
echo ""

# BLOCKADE_API_KEY
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. BLOCKADE_API_KEY"
echo "   Get from: https://www.blockadelabs.com/"
echo ""
read -p "Paste your BlockadeLabs API key: " blockade_key
if [ -n "$blockade_key" ]; then
    echo -n "$blockade_key" | firebase functions:secrets:set BLOCKADE_API_KEY
    if [ $? -eq 0 ]; then
        echo "✅ BLOCKADE_API_KEY set"
    else
        echo "❌ Failed to set BLOCKADE_API_KEY"
    fi
else
    echo "⚠️  Skipped BLOCKADE_API_KEY"
fi

# RAZORPAY_KEY_ID
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. RAZORPAY_KEY_ID"
echo "   Get from: https://dashboard.razorpay.com/ → Settings → API Keys"
echo ""
read -p "Paste your Razorpay Key ID: " razorpay_id
if [ -n "$razorpay_id" ]; then
    echo -n "$razorpay_id" | firebase functions:secrets:set RAZORPAY_KEY_ID
    if [ $? -eq 0 ]; then
        echo "✅ RAZORPAY_KEY_ID set"
    else
        echo "❌ Failed to set RAZORPAY_KEY_ID"
    fi
else
    echo "⚠️  Skipped RAZORPAY_KEY_ID"
fi

# RAZORPAY_KEY_SECRET
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. RAZORPAY_KEY_SECRET"
echo "   Get from: https://dashboard.razorpay.com/ → Settings → API Keys"
echo ""
read -p "Paste your Razorpay Key Secret: " razorpay_secret
if [ -n "$razorpay_secret" ]; then
    echo -n "$razorpay_secret" | firebase functions:secrets:set RAZORPAY_KEY_SECRET
    if [ $? -eq 0 ]; then
        echo "✅ RAZORPAY_KEY_SECRET set"
    else
        echo "❌ Failed to set RAZORPAY_KEY_SECRET"
    fi
else
    echo "⚠️  Skipped RAZORPAY_KEY_SECRET"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Secret setup complete!"
echo ""
echo "Test the function:"
echo "  curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health"
echo ""

