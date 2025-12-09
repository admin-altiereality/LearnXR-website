# Deployment Guide

## Overview
This guide covers deploying the In3D Neural Website project to Firebase Hosting and Functions.

## Firebase Deployment

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project configured: `firebase init`
- All environment variables properly set up

### Steps for Firebase Deployment

1. **Prepare for Deployment**
   ```bash
   # Check current status
   git status
   
   # Ensure no sensitive files are being committed
   git diff --cached
   ```

2. **Add and Commit Changes**
   ```bash
   # Add safe files (avoid .env files)
   git add .
   
   # Commit with descriptive message
   git commit -m "feat: Your feature description"
   ```

3. **Push to GitHub**
   ```bash
   git push origin main
   ```

### Environment Variables Setup

#### For Local Development
1. Copy template files:
   ```bash
   cp server/.env.template server/.env
   cp server/client/.env.template server/client/.env
   ```

2. Fill in your actual values in the `.env` files

#### For Firebase Functions Production
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

### Required Environment Variables

#### Server (.env)
```
API_KEY=your_meshy_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
SERVER_PORT=5002
NODE_ENV=production
```

#### Client (.env)
```
VITE_API_BASE_URL=http://localhost:5001/in3devoneuralai/us-central1/api
VITE_MESHY_API_KEY=your_meshy_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Platform-Specific Deployment

### Firebase Hosting & Functions
1. Build the client application:
   ```bash
   cd server/client
   npm run build
   cd ../..
   ```

2. Deploy to Firebase:
   ```bash
   firebase deploy
   ```

3. Or deploy specific services:
   ```bash
   # Deploy only hosting
   firebase deploy --only hosting
   
   # Deploy only functions
   firebase deploy --only functions
   
   # Deploy hosting and functions
   firebase deploy --only hosting,functions
   ```

### Architecture

#### Development
- Frontend: `http://localhost:5002` (served by Node.js server)
- Backend: `http://localhost:5002/api` (Node.js Express server)
- Firebase Functions: `http://localhost:5001/in3devoneuralai/us-central1/api`

#### Production
- Frontend: Firebase Hosting (https://in3devoneuralai.web.app)
- Backend: Firebase Functions (https://us-central1-in3devoneuralai.cloudfunctions.net/api)

## Payment Flow

1. User clicks "SELECT PLAN"
2. Frontend calls Firebase Function: `/api/payment/create-order`
3. Firebase Function creates Razorpay order
4. Razorpay modal opens for payment
5. After payment, frontend calls: `/api/payment/verify`
6. Firebase Function verifies payment and updates user subscription

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