# Enable Firebase Services - Step by Step Guide

This guide will help you enable all required Firebase services for **learnxr-evoneuralai**.

## 🔐 Step 1: Enable Authentication

1. Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/authentication
2. Click **"Get Started"** if you see the button
3. Go to the **"Sign-in method"** tab
4. Enable these providers:
   - ✅ **Email/Password** - Click "Enable" and save
   - ✅ **Google** - Click "Enable", add support email, and save

## 📊 Step 2: Enable Firestore Database

1. Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/firestore
2. Click **"Create database"** if you see the button
3. Choose **"Start in production mode"** (we already deployed rules)
4. Select a location (recommended: `us-central1` or closest to your users)
5. Click **"Enable"**

**Note:** If you see "Database already exists", you're good to go!

## 📦 Step 3: Enable Storage

1. Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/storage
2. Click **"Get Started"** if you see the button
3. Choose **"Start in production mode"** (we already deployed rules)
4. Select the same location as Firestore (recommended: `us-central1`)
5. Click **"Done"**

**Note:** Storage bucket will be: `learnxr-evoneuralai.firebasestorage.app`

## ⚡ Step 4: Functions (Auto-enabled)

Functions are automatically available when you deploy. No manual enabling needed!

## 🔑 Step 5: Get Service Account Credentials

1. Go to: https://console.firebase.google.com/project/learnxr-evoneuralai/settings/serviceaccounts/adminsdk
2. Make sure you're on the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** in the confirmation dialog
5. The JSON file will download automatically
6. **Rename the file** to: `learnxr-evoneuralai-firebase-adminsdk-XXXXX.json` (keep the actual name from download)
7. **Move the file** to your project root directory: `D:\learnxr-evoneuralai\`

## ✅ Verification

After completing all steps, run:

```powershell
# Test the connection
node scripts/test-firebase-connection.js

# Or run the setup script
.\scripts\setup-firebase-complete.ps1
```

## 🚀 Quick Links

- **Project Overview**: https://console.firebase.google.com/project/learnxr-evoneuralai/overview
- **Authentication**: https://console.firebase.google.com/project/learnxr-evoneuralai/authentication
- **Firestore**: https://console.firebase.google.com/project/learnxr-evoneuralai/firestore
- **Storage**: https://console.firebase.google.com/project/learnxr-evoneuralai/storage
- **Functions**: https://console.firebase.google.com/project/learnxr-evoneuralai/functions
- **Service Accounts**: https://console.firebase.google.com/project/learnxr-evoneuralai/settings/serviceaccounts/adminsdk

