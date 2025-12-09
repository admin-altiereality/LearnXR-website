# Firebase Deployment Guide

## Overview
This guide covers deploying the In3D Neural Website to Firebase Hosting, Functions, Firestore, and Storage.

## Prerequisites

1. **Firebase CLI Installation**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Login**
   ```bash
   firebase login
   ```

3. **Project Initialization** (if not already done)
   ```bash
   firebase init
   ```

## Current Firebase Configuration

### Project Details
- **Project ID**: `in3devoneuralai`
- **Project Console**: https://console.firebase.google.com/project/in3devoneuralai/overview
- **Hosting URL**: https://in3devoneuralai.web.app

### Services Configured
- ✅ **Hosting** - Static web hosting
- ✅ **Functions** - Cloud Functions for API
- ✅ **Firestore** - NoSQL database
- ✅ **Storage** - File storage

## Deployment Process

### 1. Build the Client Application
```bash
cd server/client
npm run build
cd ../..
```

### 2. Deploy to Firebase

#### Deploy Everything
```bash
firebase deploy
```

#### Deploy Specific Services
```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy only database and storage
firebase deploy --only firestore,storage

# Deploy hosting and functions
firebase deploy --only hosting,functions
```

### 3. Environment Variables for Firebase Functions

Set environment variables for Firebase Functions:

```bash
# Set environment variables
firebase functions:config:set meshy.api_key="your_meshy_api_key"
firebase functions:config:set razorpay.key_id="your_razorpay_key_id"
firebase functions:config:set razorpay.key_secret="your_razorpay_secret"
firebase functions:config:set firebase.project_id="in3devoneuralai"
firebase functions:config:set firebase.client_email="your_firebase_client_email"
firebase functions:config:set firebase.private_key="your_firebase_private_key"

# Deploy functions with new config
firebase deploy --only functions
```

## Firebase Configuration Files

### firebase.json
```json
{
  "hosting": {
    "public": "server/client/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### firestore.rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write assets
    match /assets/{assetId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow authenticated users to read/write subscriptions
    match /subscriptions/{subscriptionId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### storage.rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload files
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Deployment Commands

### Quick Deploy Script
Create a `deploy.sh` script:

```bash
#!/bin/bash

echo "🚀 Starting Firebase deployment..."

# Build the client
echo "📦 Building client application..."
cd server/client
npm run build
cd ../..

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy

echo "✅ Deployment complete!"
echo "🌐 Your app is live at: https://in3devoneuralai.web.app"
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

### Automated Deployment with GitHub Actions

Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd server/client
          npm install
          
      - name: Build
        run: |
          cd server/client
          npm run build
          
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: in3devoneuralai
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear cache and rebuild
   cd server/client
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. **Firebase Functions Environment Variables**
   ```bash
   # Check current config
   firebase functions:config:get
   
   # Set missing variables
   firebase functions:config:set service.key="value"
   ```

3. **Permission Issues**
   ```bash
   # Check Firebase project access
   firebase projects:list
   
   # Switch projects if needed
   firebase use in3devoneuralai
   ```

4. **Hosting Cache Issues**
   ```bash
   # Clear Firebase cache
   firebase hosting:clear
   firebase deploy --only hosting
   ```

### Debug Commands

```bash
# Check Firebase status
firebase projects:list
firebase use

# Check functions logs
firebase functions:log

# Check hosting status
firebase hosting:channel:list

# Test functions locally
firebase emulators:start
```

## Performance Optimization

### Hosting Optimization
- ✅ **Static file caching** - Configured in firebase.json
- ✅ **Gzip compression** - Automatic with Firebase Hosting
- ✅ **CDN distribution** - Global CDN included

### Functions Optimization
- ✅ **Cold start optimization** - Keep functions warm
- ✅ **Memory allocation** - Optimize based on usage
- ✅ **Timeout configuration** - Set appropriate timeouts

## Monitoring and Analytics

### Firebase Console
- **Hosting**: Monitor traffic and performance
- **Functions**: View logs and execution metrics
- **Firestore**: Monitor database usage
- **Storage**: Track file uploads and downloads

### Custom Analytics
```javascript
// Track custom events
import { getAnalytics, logEvent } from "firebase/analytics";

const analytics = getAnalytics();
logEvent(analytics, 'asset_generated', {
  asset_type: '3d_model',
  generation_time: 5000
});
```

## Security Best Practices

1. **Environment Variables**
   - Never commit sensitive data
   - Use Firebase Functions config for secrets
   - Rotate API keys regularly

2. **Firestore Rules**
   - Implement proper authentication checks
   - Use role-based access control
   - Validate data on write

3. **Storage Rules**
   - Restrict file uploads by type and size
   - Implement user-based access control
   - Scan uploaded files for malware

## Cost Optimization

### Hosting
- **Free Tier**: 10GB storage, 360MB/day transfer
- **Paid Tier**: $0.026/GB storage, $0.15/GB transfer

### Functions
- **Free Tier**: 2M invocations/month, 400K GB-seconds
- **Paid Tier**: $0.40 per million invocations

### Firestore
- **Free Tier**: 1GB storage, 50K reads/day, 20K writes/day
- **Paid Tier**: $0.18/GB storage, $0.06/100K reads, $0.18/100K writes

### Storage
- **Free Tier**: 5GB storage, 1GB/day download
- **Paid Tier**: $0.026/GB storage, $0.12/GB download

## Next Steps

1. **Set up monitoring** - Configure alerts and dashboards
2. **Implement CI/CD** - Automate deployments with GitHub Actions
3. **Add custom domain** - Configure custom domain in Firebase Console
4. **Enable SSL** - Automatic with Firebase Hosting
5. **Set up backups** - Regular Firestore and Storage backups 