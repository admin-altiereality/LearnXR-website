# Meshy.ai Setup Guide for In3D.ai Application

## 🚨 Critical Issue: Missing Environment Configuration

Your application is experiencing issues in the `/main` section because the required environment variables are not configured. This guide will help you fix these issues.

## 🔧 Step 1: Create Environment File

1. **Navigate to the client directory:**
   ```bash
   cd server/client
   ```

2. **Create a `.env` file:**
   ```bash
   cp env.template .env
   ```

3. **Edit the `.env` file** and add your actual API keys and configuration.

## 🔑 Step 2: Required API Keys

### Meshy.ai API Key (CRITICAL)
1. Go to [Meshy.ai Settings](https://www.meshy.ai/settings/api-keys)
2. Create a new API key
3. Add it to your `.env` file:
   ```
   VITE_MESHY_API_KEY=your_meshy_api_key_here
   ```

### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > General
4. Copy the configuration values to your `.env` file:
   ```
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### API Base URL
```
VITE_API_BASE_URL=http://localhost:3001
```

## 🧪 Step 3: Test Configuration

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to the application

3. **Go to the `/main` section** and check the browser console for any errors

4. **Use the debug buttons** in the main section to test the configuration:
   - Click "Debug Services (Check Console)" to see detailed status
   - Click "Run Diagnostics" for comprehensive system check

## 🔍 Step 4: Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Meshy API key not configured"
**Solution:** Add your Meshy API key to the `.env` file

#### Issue 2: "Failed to load In3D.Ai styles"
**Solution:** Check your API base URL and network connectivity

#### Issue 3: "Storage configuration issues"
**Solution:** Verify Firebase configuration and storage rules

#### Issue 4: "3D Asset generation unavailable"
**Solution:** Ensure Meshy API key is valid and has sufficient credits

## 🎯 Step 5: Verification Checklist

- [ ] `.env` file exists in `server/client/` directory
- [ ] `VITE_MESHY_API_KEY` is set with a valid API key
- [ ] Firebase configuration is complete
- [ ] `VITE_API_BASE_URL` points to your backend server
- [ ] Development server starts without errors
- [ ] `/main` section loads without configuration errors
- [ ] Debug buttons show successful status checks

## 🚀 Step 6: Production Deployment

For production deployment, ensure you:

1. **Set environment variables** in your hosting platform (Netlify, Vercel, etc.)
2. **Update API URLs** to point to your production backend
3. **Configure Firebase** for production environment
4. **Test all features** before going live

## 📞 Support

If you continue to experience issues:

1. Check the browser console for detailed error messages
2. Use the diagnostic tools in the main section
3. Verify all API keys are valid and have sufficient credits
4. Ensure your backend server is running and accessible

## 🔧 Advanced Configuration

### Optional Features
- Enable debug mode: `VITE_DEBUG_MESHY=true`
- Enable development features: `VITE_ENABLE_DEV_FEATURES=true`
- Configure alternative storage providers
- Set up analytics and monitoring

### Performance Optimization
- Enable lazy loading: `VITE_ENABLE_LAZY_LOADING=true`
- Configure caching: `VITE_ENABLE_ASSET_CACHING=true`
- Set up service worker: `VITE_ENABLE_SERVICE_WORKER=true`

---

**Note:** This guide assumes you have access to the required API keys and services. If you don't have them, you'll need to sign up for the respective services first. 