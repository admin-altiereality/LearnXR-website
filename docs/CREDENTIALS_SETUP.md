# 🔐 Credentials Setup Guide

This guide will help you set up all the required credentials for the in3devoneural website.

## 📋 Required Credentials

### 1. **BlockadeLabs API Key** (for Skybox Generation)
- **Purpose**: Generate 3D skybox environments
- **Get it from**: https://www.blockadelabs.com/
- **Steps**:
  1. Sign up/login to BlockadeLabs
  2. Go to your dashboard
  3. Copy your API key
  4. Add to server `.env` as `API_KEY`

### 2. **Razorpay Payment Gateway**
- **Purpose**: Handle subscription payments
- **Get it from**: https://dashboard.razorpay.com/
- **Steps**:
  1. Create/login to Razorpay account
  2. Go to Settings → API Keys
  3. Generate new key pair
  4. Add to server `.env`:
     - `RAZORPAY_KEY_ID` (Key ID)
     - `RAZORPAY_KEY_SECRET` (Key Secret)
  5. Add to client `.env`:
     - `VITE_RAZORPAY_KEY_ID` (Key ID - same as above)

### 3. **Firebase Configuration**
- **Purpose**: Authentication, database, and hosting
- **Get it from**: https://console.firebase.google.com/
- **Steps**:
  1. Go to your Firebase project: `in3devoneuralai`
  2. **For Client-side** (already configured):
     - Go to Project Settings → General
     - Copy the Firebase config object
     - Add to client `.env` (already done)
  3. **For Server-side**:
     - Go to Project Settings → Service Accounts
     - Click "Generate new private key"
     - Download the JSON file
     - Add to server `.env`:
       - `FIREBASE_PROJECT_ID`
       - `FIREBASE_CLIENT_EMAIL`
       - `FIREBASE_PRIVATE_KEY` (the entire private key string)

## 🚀 Setup Instructions

### Step 1: Server Environment Variables
1. Copy `server/env.template` to `server/.env`
2. Fill in your actual values:
   ```bash
   # Copy template
   cp server/env.template server/.env
   
   # Edit with your values
   nano server/.env
   ```

### Step 2: Client Environment Variables
1. Copy `server/client/env.template` to `server/client/.env`
2. Fill in your actual values:
   ```bash
   # Copy template
   cp server/client/env.template server/client/.env
   
   # Edit with your values
   nano server/client/.env
   ```

### Step 3: Netlify Environment Variables (for production)
1. Go to your Netlify dashboard
2. Navigate to Site Settings → Environment Variables
3. Add these variables:
   - `VITE_RAZORPAY_KEY_ID` = your Razorpay public key
   - `VITE_API_URL` = your production API URL

## 🔧 Environment Variables Reference

### Server (.env)
```env
NODE_ENV=development
SERVER_PORT=5002
API_KEY=your_blockadelabs_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
FIREBASE_PROJECT_ID=in3devoneuralai
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@in3devoneuralai.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### Client (.env)
```env
VITE_RAZORPAY_KEY_ID=your_razorpay_public_key_id
VITE_API_URL=http://localhost:5002
VITE_FIREBASE_API_KEY=AIzaSyBo9VsJMft4Qqap5oUmQowwbjiMQErloqU
VITE_FIREBASE_AUTH_DOMAIN=in3devoneuralai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=in3devoneuralai
VITE_FIREBASE_STORAGE_BUCKET=in3devoneuralai.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=708037023303
VITE_FIREBASE_APP_ID=1:708037023303:web:f0d5b319b05aa119288362
VITE_FIREBASE_MEASUREMENT_ID=G-FNENMQ3BMF
```

## 🛡️ Security Notes

1. **Never commit `.env` files** to version control
2. **Use different keys** for development and production
3. **Rotate keys regularly** for security
4. **Limit API key permissions** to minimum required
5. **Monitor usage** to detect unauthorized access

## 🚨 Troubleshooting

### Common Issues:
1. **"Missing environment variables"** - Check that all required variables are set
2. **"Payment service not configured"** - Verify Razorpay credentials
3. **"Firebase not initialized"** - Check Firebase service account key
4. **"API key invalid"** - Verify BlockadeLabs API key

### Testing:
1. **Server**: `npm start` in server directory
2. **Client**: `npm run dev` in server/client directory
3. **Check logs** for any missing credential errors

## 📞 Support

If you encounter issues:
1. Check the error logs
2. Verify all credentials are correctly set
3. Ensure API keys have proper permissions
4. Contact support with specific error messages 