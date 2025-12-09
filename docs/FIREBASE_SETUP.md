# Firebase Setup Guide

This guide will help you set up and deploy your project to Firebase.

## Prerequisites

1. **Firebase CLI** - Already installed globally
   ```bash
   firebase --version
   ```

2. **Firebase Project** - Already configured
   - Project ID: `in3devoneuralai`
   - Project URL: https://console.firebase.google.com/project/in3devoneuralai

## Environment Variables Setup

### Client Environment Variables

Create a `.env` file in `server/client/` directory:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyBo9VsJMft4Qqap5oUmQowwbjiMQErloqU
VITE_FIREBASE_AUTH_DOMAIN=in3devoneuralai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=in3devoneuralai
VITE_FIREBASE_STORAGE_BUCKET=in3devoneuralai.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=708037023303
VITE_FIREBASE_APP_ID=1:708037023303:web:f0d5b319b05aa119288362
VITE_FIREBASE_MEASUREMENT_ID=G-FNENMQ3BMF

# API Configuration
# For development (local Firebase Functions emulator)
VITE_API_BASE_URL=http://localhost:5001/in3devoneuralai/us-central1/api
# For production (Firebase Functions)
# VITE_API_BASE_URL=https://us-central1-in3devoneuralai.cloudfunctions.net/api

# Use Firebase Functions Emulator (set to 'true' for local development)
VITE_USE_FUNCTIONS_EMULATOR=false

# Other API Keys
VITE_MESHY_API_KEY=your_meshy_api_key_here
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id_here
```

### Server Environment Variables

The server uses Firebase Admin SDK. Ensure you have the service account key file:
- `in3devoneuralai-firebase-adminsdk-fbsvc-6e8e1092c4.json`

Or set environment variables:
```bash
FIREBASE_PROJECT_ID=in3devoneuralai
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@in3devoneuralai.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

## Firebase Services Configuration

### 1. Firebase Hosting

The project is configured to deploy the client build to Firebase Hosting:
- **Public Directory**: `server/client/dist`
- **Configuration**: `firebase.json`

### 2. Firebase Functions

Firebase Functions are located in the `functions/` directory:
- **Source**: `functions/src/index.ts`
- **Build Output**: `functions/lib/`
- **Runtime**: Node.js 22

#### Functions Secrets

Set up secrets for Firebase Functions:
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set BLOCKADE_API_KEY
```

### 3. Firestore Database

- **Rules File**: `firestore.rules`
- **Indexes File**: `firestore.indexes.json`

### 4. Firebase Storage

- **Rules File**: `storage.rules`

## Building and Deploying

### Build the Client

```bash
cd server/client
npm install
npm run build
```

### Deploy to Firebase

#### Deploy Everything
```bash
firebase deploy
```

#### Deploy Only Hosting
```bash
firebase deploy --only hosting
```

#### Deploy Only Functions
```bash
firebase deploy --only functions
```

#### Deploy to Preview Channel
```bash
firebase hosting:channel:deploy <channel-name>
```

Example:
```bash
firebase hosting:channel:deploy manav-evoneuralai
```

### Client-Specific Deployment Scripts

From `server/client/` directory:
```bash
# Build for Firebase
npm run build:firebase

# Deploy to Firebase Hosting
npm run deploy:firebase

# Deploy to preview channel
npm run deploy:firebase:channel <channel-name>
```

## Firebase Configuration Files

### `firebase.json`

Main Firebase configuration file with:
- Hosting configuration
- Functions configuration
- Firestore rules
- Storage rules

### Security Headers

The project includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## API Configuration

The project uses a centralized API configuration utility (`server/client/src/utils/apiConfig.ts`) that:
- Reads API base URL from environment variables
- Falls back to appropriate defaults for development/production
- Supports Firebase Functions emulator for local development

### API Base URL Logic

1. **Environment Variable** (Priority 1): Uses `VITE_API_BASE_URL` if set
2. **Development Mode**: Uses local Firebase Functions emulator URL
3. **Production Mode**: Uses Firebase Functions production URL

## Firebase Authentication

The project uses Firebase Authentication. Make sure to:
1. Enable authentication providers in Firebase Console
2. Add authorized domains for preview channels
3. Configure OAuth providers if needed

## Troubleshooting

### Build Issues

1. **Missing Environment Variables**
   - Ensure `.env` file exists in `server/client/`
   - Check that all `VITE_*` variables are set

2. **Firebase Functions Build Errors**
   - Run `cd functions && npm install`
   - Check TypeScript compilation: `npm run build`

### Deployment Issues

1. **Authentication Errors**
   - Run `firebase login`
   - Check project: `firebase use`

2. **Hosting Deployment Fails**
   - Ensure `server/client/dist` exists
   - Run `npm run build` in `server/client/` first

3. **Functions Deployment Fails**
   - Check secrets are set: `firebase functions:secrets:access`
   - Verify Node.js version matches (22)

### Preview Channel Issues

1. **Auth Domain Not Added**
   - Add preview channel domain to Firebase Auth authorized domains
   - Visit: https://console.firebase.google.com/project/in3devoneuralai/authentication/providers

## Project Structure

```
.
├── firebase.json              # Firebase configuration
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json    # Firestore indexes
├── storage.rules              # Storage security rules
├── functions/                 # Firebase Functions
│   ├── src/
│   │   └── index.ts          # Functions entry point
│   └── package.json
└── server/
    └── client/                # React client app
        ├── src/
        │   ├── config/
        │   │   └── firebase.ts    # Firebase client config
        │   └── utils/
        │       └── apiConfig.ts   # API configuration utility
        └── dist/              # Build output (deployed to hosting)
```

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Hosting Guide](https://firebase.google.com/docs/hosting)
- [Firebase Functions Guide](https://firebase.google.com/docs/functions)
- [Firebase Console](https://console.firebase.google.com/project/in3devoneuralai)

