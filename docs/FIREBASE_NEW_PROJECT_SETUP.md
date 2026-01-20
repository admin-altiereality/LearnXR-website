# Firebase New Project Setup Guide

## ✅ Completed Configuration Updates

All Firebase configuration files have been updated with your new project credentials:

- **Project ID**: `learnxr-evoneuralai`
- **API Key**: `AIzaSyBj8pKRSuj9XHD0eoM7tNQafH-2yXoOyag`
- **Storage Bucket**: `learnxr-evoneuralai.firebasestorage.app`

### Files Updated:
1. ✅ `.firebaserc` - Updated project ID
2. ✅ `server/client/src/config/firebase.ts` - Updated Firebase config with new credentials
3. ✅ `server/client/src/utils/apiConfig.ts` - Updated API URLs with new project ID
4. ✅ `server/client/env.template` - Updated template with new project ID
5. ✅ `server/env.template` - Updated server template with new project ID

## 🔧 Next Steps Required

### 1. Create Client Environment File

Since `.env` files are gitignored, you need to manually create `server/client/.env`:

```bash
# Navigate to client directory
cd server/client

# Create .env file with the following content:
```

**Content for `server/client/.env`:**
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyBj8pKRSuj9XHD0eoM7tNQafH-2yXoOyag
VITE_FIREBASE_AUTH_DOMAIN=learnxr-evoneuralai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=learnxr-evoneuralai
VITE_FIREBASE_STORAGE_BUCKET=learnxr-evoneuralai.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=427897409662
VITE_FIREBASE_APP_ID=1:427897409662:web:95fc2fe7d527ac911a082f
VITE_FIREBASE_MEASUREMENT_ID=G-CR7G315QSN

# API Configuration
# For development (local Firebase Functions emulator)
VITE_API_BASE_URL=http://localhost:5001/learnxr-evoneuralai/us-central1/api
# For production (Firebase Functions)
# VITE_API_BASE_URL=https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api

# Use Firebase Functions Emulator (set to 'true' for local development)
VITE_USE_FUNCTIONS_EMULATOR=false
```

### 2. Set Up Firebase Admin SDK (Server-Side)

You need to get the Firebase Admin SDK credentials for server-side operations:

#### Option A: Download Service Account Key (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/project/learnxr-evoneuralai/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Download the JSON file
4. Place it in the project root directory (e.g., `learnxr-evoneuralai-firebase-adminsdk-XXXXX.json`)
5. Update `server/src/config/firebase-admin.ts` to use the file (optional, see below)

#### Option B: Use Environment Variables
Create or update `server/.env` with:

```env
FIREBASE_PROJECT_ID=learnxr-evoneuralai
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-XXXXX@learnxr-evoneuralai.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**To get these values:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" to download the JSON
3. Extract:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)

### 3. Enable Firebase Services

In the Firebase Console, ensure these services are enabled:

1. **Authentication**
   - Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/authentication
   - Click "Get Started" if not already enabled
   - Configure sign-in methods as needed

2. **Firestore Database**
   - Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/firestore
   - Click "Create database" if not already created
   - Choose production or test mode
   - Select a location (e.g., `us-central1`)

3. **Storage**
   - Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/storage
   - Click "Get Started" if not already enabled
   - Choose production or test mode
   - Select a location (should match Firestore location)

4. **Functions**
   - Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/functions
   - Functions are automatically available when you deploy

### 4. Deploy Firestore and Storage Rules

Deploy your security rules:

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 5. Test the Connection

#### Test Client-Side Connection:
```bash
cd server/client
npm install  # If needed
npm run dev
```

Check the browser console for:
- ✅ Firebase configuration validation
- ✅ Firebase Storage initialized successfully
- ✅ Firebase Functions initialized

#### Test Server-Side Connection:
```bash
cd server
npm install  # If needed
npm run dev
```

Check the console for:
- ✅ Firebase Admin initialized successfully

#### Test Firebase Functions:
```bash
firebase emulators:start
```

### 6. Deploy to Firebase

Once everything is configured and tested:

```bash
# Build the client
cd server/client
npm run build

# Deploy everything
cd ../..
firebase deploy

# Or deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules,storage:rules
```

## 🔐 Firebase Functions Secrets

If you're using Firebase Functions with secrets (like API keys), set them up:

```bash
# Set secrets for Firebase Functions
firebase functions:secrets:set BLOCKADE_API_KEY
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set OPENAI_AVATAR_API_KEY
```

## 📝 Important Notes

1. **Storage Bucket Format**: Your new project uses the new format: `learnxr-evoneuralai.firebasestorage.app` (instead of `.appspot.com`)
2. **Environment Variables**: Always use environment variables for sensitive data, never commit them to git
3. **Service Account**: The service account key should be kept secure and never committed to version control
4. **Project ID**: All references to the old project ID (`in3devoneuralai`) have been updated to `learnxr-evoneuralai`

## 🐛 Troubleshooting

### Client-side errors:
- Check browser console for Firebase initialization errors
- Verify `.env` file exists in `server/client/` directory
- Ensure all `VITE_*` variables are set correctly

### Server-side errors:
- Check that `server/.env` exists with Firebase Admin credentials
- Verify service account has proper permissions
- Check server console for initialization errors

### Functions errors:
- Ensure Firebase Functions are enabled in the console
- Check that secrets are properly set
- Verify project ID matches in `.firebaserc`

## ✅ Verification Checklist

- [ ] Created `server/client/.env` with Firebase credentials
- [ ] Set up Firebase Admin SDK credentials (service account)
- [ ] Enabled Authentication in Firebase Console
- [ ] Created Firestore Database
- [ ] Enabled Storage in Firebase Console
- [ ] Deployed Firestore and Storage rules
- [ ] Tested client-side connection
- [ ] Tested server-side connection
- [ ] Set up Firebase Functions secrets (if needed)
- [ ] Deployed to Firebase (optional, for production)

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com/project/learnxr-evoneuralai)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)

