# Netlify Deployment Guide

This guide explains how to deploy your React + Node.js application to Netlify with proper environment variable configuration.

## Environment Variables Setup

### 1. Frontend Environment Variables (Client)

In your Netlify dashboard, go to **Site settings** → **Environment variables** and add:

```env
# Razorpay Configuration
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=in3devoneuralai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=in3devoneuralai
VITE_FIREBASE_STORAGE_BUCKET=in3devoneuralai.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# API Configuration
VITE_API_URL=https://your-backend-domain.com
```

### 2. Backend Environment Variables (Netlify Functions)

For the payment functions, add these environment variables in Netlify:

```env
# Razorpay Configuration (for Netlify Functions)
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here

# Firebase Admin SDK (for Netlify Functions)
FIREBASE_PROJECT_ID=in3devoneuralai
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@in3devoneuralai.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Firebase Private Key Here\n-----END PRIVATE KEY-----"

# BlockadeLabs API (for skybox generation)
API_KEY=your_blockadelabs_api_key_here
```

## Getting Your Credentials

### Razorpay Credentials
1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Sign up/Login to your account
3. Go to Settings → API Keys
4. Generate a new API key pair
5. Copy the `Key ID` and `Key Secret`

### Firebase Credentials
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. Extract the values for the environment variables

### BlockadeLabs API Key
1. Go to [BlockadeLabs](https://www.blockadelabs.com/)
2. Sign up/Login
3. Get your API key from the dashboard

## Deployment Steps

### 1. Connect to GitHub
1. Go to [Netlify](https://netlify.com/)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Select the repository

### 2. Configure Build Settings
- **Base directory**: `server/client`
- **Build command**: `npm run build`
- **Publish directory**: `dist`

### 3. Set Environment Variables
Add all the environment variables listed above in the Netlify dashboard.

### 4. Deploy
Click "Deploy site" and wait for the build to complete.

## Architecture

### Development
- Frontend: `http://localhost:5002` (served by Node.js server)
- Backend: `http://localhost:5002/api` (Node.js Express server)

### Production
- Frontend: Netlify (static hosting)
- Backend: Netlify Functions (serverless functions)

## Payment Flow

1. User clicks "SELECT PLAN"
2. Frontend calls Netlify Function: `/.netlify/functions/payment/create-order`
3. Netlify Function creates Razorpay order
4. Razorpay modal opens for payment
5. After payment, frontend calls: `/.netlify/functions/payment/verify-payment`
6. Netlify Function verifies payment and updates user subscription

## Troubleshooting

### Payment Not Working
1. Check if Razorpay credentials are set in Netlify environment variables
2. Verify the Netlify Functions are deployed correctly
3. Check browser console for any errors
4. Ensure the payment function is accessible at `/.netlify/functions/payment`

### Environment Variables Not Loading
1. Make sure environment variables are set in Netlify dashboard
2. Redeploy the site after adding new environment variables
3. Check if the variable names match exactly (case-sensitive)

### Functions Not Deploying
1. Ensure the `netlify/functions` directory exists
2. Check that `package.json` exists in the functions directory
3. Verify the `netlify.toml` configuration is correct

## Local Development

For local development, you can still use the Node.js server:

```bash
cd server
npm run dev
```

The frontend will automatically detect the environment and use the local server for API calls.

## Security Notes

- Never commit `.env` files to Git
- Use different API keys for development and production
- Regularly rotate your API keys
- Monitor your Razorpay dashboard for any suspicious activity 