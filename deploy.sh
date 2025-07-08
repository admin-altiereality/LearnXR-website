#!/bin/bash

# In3D.ai Netlify Deployment Script
# This script helps automate the deployment process

set -e

echo "🚀 In3D.ai Netlify Deployment Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "netlify.toml" ]; then
    print_error "netlify.toml not found. Please run this script from the project root."
    exit 1
fi

print_status "Starting deployment process..."

# Step 1: Install dependencies
print_status "Installing dependencies..."
cd server/client
npm install
cd ../..

# Step 2: Build the project
print_status "Building the project..."
cd server/client
npm run build
cd ../..

# Step 3: Install function dependencies
print_status "Installing Netlify function dependencies..."
cd server/client/netlify/functions
npm install
cd ../../../..

# Step 4: Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    print_warning "Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Step 5: Check if user is logged in to Netlify
if ! netlify status &> /dev/null; then
    print_warning "Not logged in to Netlify. Please login:"
    netlify login
fi

# Step 6: Deploy to Netlify
print_status "Deploying to Netlify..."
cd server/client

# Check if site is already linked
if [ ! -f ".netlify/state.json" ]; then
    print_status "Linking to Netlify site..."
    netlify link
fi

# Deploy
print_status "Deploying..."
netlify deploy --prod

cd ../..

print_success "Deployment completed!"
echo ""
print_status "Next steps:"
echo "1. Set environment variables in Netlify dashboard:"
echo "   - BLOCKADELABS_API_KEY"
echo "   - RAZORPAY_KEY_ID"
echo "   - RAZORPAY_KEY_SECRET"
echo ""
echo "2. Test your deployment:"
echo "   - Visit: https://your-site.netlify.app/test-deployment.html"
echo "   - Check: https://your-site.netlify.app/api/env-check"
echo ""
echo "3. Verify all functions are working:"
echo "   - Skybox styles: /api/skybox/styles"
echo "   - Payment orders: /api/payment/create-order"
echo ""
print_success "Happy coding! 🎉" 