#!/bin/bash

echo "🚀 Starting Firebase deployment..."

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: firebase.json not found. Please run this script from the project root."
    exit 1
fi

# Build the client
echo "📦 Building client application..."
cd server/client
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check for errors."
    exit 1
fi
cd ../..

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy

if [ $? -eq 0 ]; then
    echo "✅ Deployment complete!"
    echo "🌐 Your app is live at: https://in3devoneuralai.web.app"
    echo "📊 Firebase Console: https://console.firebase.google.com/project/in3devoneuralai/overview"
else
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi 