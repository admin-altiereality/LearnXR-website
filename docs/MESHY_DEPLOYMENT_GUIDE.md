# 🚀 Meshy.ai 3D Asset Generation - Production Deployment Guide

This comprehensive guide covers the deployment and configuration of the enhanced Meshy.ai 3D asset generation system for production use.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [API Key Setup](#api-key-setup)
4. [Firebase Configuration](#firebase-configuration)
5. [Deployment Steps](#deployment-steps)
6. [Testing & Validation](#testing--validation)
7. [Performance Optimization](#performance-optimization)
8. [Monitoring & Analytics](#monitoring--analytics)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)

## 🔧 Prerequisites

### Required Services
- ✅ Meshy.ai API account with credits
- ✅ Firebase project with Storage and Firestore enabled
- ✅ Node.js 18+ and npm/yarn
- ✅ Git for version control

### Required Dependencies
```bash
# Core dependencies (already in package.json)
npm install @react-three/fiber @react-three/drei three
npm install @types/three @types/uuid uuid

# Optional: For advanced features
npm install draco3d # For model compression
```

## 🔐 Environment Configuration

### 1. Client Environment Variables

Create/update `server/client/.env`:

```env
# Meshy.ai 3D Asset Generation API
VITE_MESHY_API_KEY=your_meshy_api_key_here
VITE_MESHY_API_BASE_URL=https://api.meshy.ai/v1

# Firebase Configuration (existing)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# API Configuration
VITE_API_BASE_URL=https://your-domain.com/api

# Optional: Debug Mode
VITE_DEBUG_MESHY=false
VITE_ENABLE_3D_PREVIEW=true
```

### 2. Server Environment Variables (Optional)

If using server-side Meshy operations, create `server/.env`:

```env
# Meshy.ai API (for server-side operations)
MESHY_API_KEY=your_meshy_api_key_here
MESHY_API_BASE_URL=https://api.meshy.ai/v1

# Rate Limiting
MESHY_RATE_LIMIT_PER_MINUTE=10
MESHY_RATE_LIMIT_PER_HOUR=100

# Caching
MESHY_CACHE_TTL=3600
```

## 🔑 API Key Setup

### 1. Get Meshy.ai API Key

1. **Visit Meshy.ai**: Go to [https://www.meshy.ai](https://www.meshy.ai)
2. **Sign Up/Login**: Create an account or log in
3. **Navigate to API**: Go to Settings → API Keys
4. **Generate Key**: Create a new API key with appropriate permissions
5. **Copy Key**: Save the key securely (you won't see it again)

### 2. API Key Permissions

Ensure your API key has the following permissions:
- ✅ Text-to-3D generation
- ✅ Model download access
- ✅ Usage statistics access
- ✅ Style access

### 3. Test API Key

```bash
# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.meshy.ai/v1/usage
```

## 🔥 Firebase Configuration

### 1. Enable Firebase Services

1. **Firebase Console**: Go to [Firebase Console](https://console.firebase.google.com)
2. **Select Project**: Choose your project
3. **Enable Services**:
   - Storage (for 3D asset files)
   - Firestore (for metadata)
   - Authentication (for user management)

### 2. Storage Rules

Update `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 3D Assets collection
    match /3d-assets/{userId}/{assetId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && resource.metadata.visibility == 'public';
    }
    
    // Public assets (optional)
    match /public-assets/{assetId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

### 3. Firestore Rules

Update `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 3D Assets collection
    match /3d_assets/{assetId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow read: if request.auth != null && resource.data.visibility == 'public';
    }
    
    // User assets summary
    match /users/{userId}/assets/{assetId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Generation history
    match /generations/{generationId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## 🚀 Deployment Steps

### 1. Build the Application

```bash
# Navigate to client directory
cd server/client

# Install dependencies
npm install

# Build for production
npm run build
```

### 2. Deploy to Firebase Hosting

```bash
# From project root
firebase deploy --only hosting
```

### 3. Deploy Firebase Functions (Optional)

```bash
# Deploy functions for server-side operations
firebase deploy --only functions
```

### 4. Verify Deployment

1. **Check Hosting URL**: Visit your Firebase hosting URL
2. **Test 3D Generation**: Try generating a simple 3D asset
3. **Check Storage**: Verify files are being stored in Firebase Storage
4. **Check Firestore**: Verify metadata is being stored in Firestore

## 🧪 Testing & Validation

### 1. Integration Tests

Run the built-in test panel:

```javascript
// Access the test panel in your app
// Navigate to: /meshy-test or use the MeshyTestPanel component
```

### 2. Manual Testing Checklist

- [ ] **API Connection**: Test Meshy API connectivity
- [ ] **Generation**: Generate a simple 3D asset
- [ ] **Download**: Download generated asset
- [ ] **Viewer**: Test 3D model viewer
- [ ] **Storage**: Verify Firebase Storage integration
- [ ] **Metadata**: Check Firestore metadata storage
- [ ] **User Limits**: Test user quota enforcement
- [ ] **Error Handling**: Test error scenarios

### 3. Performance Testing

```bash
# Test generation performance
curl -X POST https://your-domain.com/api/meshy/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt": "test cube", "quality": "low"}'
```

## ⚡ Performance Optimization

### 1. Client-Side Optimization

```javascript
// Enable lazy loading for 3D models
const Lazy3DViewer = React.lazy(() => import('./Meshy3DViewer'));

// Use React.memo for performance
const MeshyAssetCard = React.memo(({ asset, ...props }) => {
  // Component implementation
});
```

### 2. Caching Strategy

```javascript
// Implement asset caching
const cacheKey = `meshy-asset-${assetId}`;
const cachedAsset = localStorage.getItem(cacheKey);

if (cachedAsset) {
  return JSON.parse(cachedAsset);
}
```

### 3. CDN Configuration

Configure Firebase Storage for CDN:

```javascript
// Set cache headers for 3D assets
const metadata = {
  cacheControl: 'public, max-age=31536000',
  contentType: 'model/gltf-binary'
};
```

## 📊 Monitoring & Analytics

### 1. Firebase Analytics

```javascript
// Track 3D generation events
import { getAnalytics, logEvent } from 'firebase/analytics';

logEvent(analytics, '3d_asset_generated', {
  quality: selectedQuality,
  format: selectedFormat,
  style: selectedStyle,
  cost: estimatedCost
});
```

### 2. Error Monitoring

```javascript
// Track generation errors
logEvent(analytics, '3d_generation_error', {
  error_code: error.code,
  error_message: error.message,
  prompt_length: prompt.length
});
```

### 3. Usage Metrics

```javascript
// Track user usage
logEvent(analytics, 'meshy_usage', {
  user_id: user.uid,
  quota_remaining: usage.quota_remaining,
  total_cost: usage.total_cost
});
```

## 🔧 Troubleshooting

### Common Issues

#### 1. API Key Not Working

**Symptoms**: "Meshy API key not configured" error

**Solutions**:
```bash
# Check environment variable
echo $VITE_MESHY_API_KEY

# Verify API key format
# Should be a long string starting with 'meshy_'

# Test API key directly
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.meshy.ai/v1/usage
```

#### 2. Generation Timeout

**Symptoms**: Generation takes too long or times out

**Solutions**:
```javascript
// Increase timeout in meshyApiService.ts
private timeout: number = 60000; // 60 seconds

// Increase polling attempts
async pollForCompletion(
  generationId: string, 
  maxAttempts: number = 180, // 3 minutes with 1s intervals
  baseIntervalMs: number = 1000
)
```

#### 3. 3D Model Not Loading

**Symptoms**: 3D viewer shows loading indefinitely

**Solutions**:
```javascript
// Check CORS configuration
// Ensure Firebase Storage allows cross-origin requests

// Verify model URL
console.log('Model URL:', modelUrl);

// Check browser console for errors
// Look for CORS or network errors
```

#### 4. Storage Quota Exceeded

**Symptoms**: "Storage quota exceeded" error

**Solutions**:
```javascript
// Implement cleanup routine
const cleanupOldAssets = async (userId: string) => {
  const oldAssets = await getAssetsOlderThan(userId, 30); // 30 days
  await deleteAssets(oldAssets);
};
```

### Debug Mode

Enable debug mode for detailed logging:

```env
VITE_DEBUG_MESHY=true
```

This will log:
- API requests and responses
- Generation progress
- Error details
- Performance metrics

## 🔒 Security Best Practices

### 1. API Key Security

```javascript
// Never expose API key in client-side code
// Use environment variables only

// For server-side operations, use server environment variables
const apiKey = process.env.MESHY_API_KEY;
```

### 2. Rate Limiting

```javascript
// Implement client-side rate limiting
const rateLimiter = {
  requests: 0,
  lastReset: Date.now(),
  
  canMakeRequest() {
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.requests = 0;
      this.lastReset = now;
    }
    return this.requests < 10; // 10 requests per minute
  }
};
```

### 3. Input Validation

```javascript
// Validate all user inputs
const validatePrompt = (prompt: string) => {
  if (!prompt || prompt.length > 1000) {
    throw new Error('Invalid prompt');
  }
  
  // Check for malicious content
  const suspiciousPatterns = [/script/i, /javascript:/i, /data:/i];
  if (suspiciousPatterns.some(pattern => pattern.test(prompt))) {
    throw new Error('Suspicious content detected');
  }
};
```

### 4. User Authentication

```javascript
// Ensure user is authenticated before generation
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
```

## 📈 Scaling Considerations

### 1. Horizontal Scaling

```javascript
// Use load balancers for multiple instances
// Implement sticky sessions for WebSocket connections
// Use Redis for session storage
```

### 2. Database Optimization

```javascript
// Index frequently queried fields
// Use pagination for large result sets
// Implement caching for static data
```

### 3. CDN Configuration

```javascript
// Configure Firebase Storage for global CDN
// Use edge locations for faster asset delivery
// Implement cache invalidation strategies
```

## 🎯 Production Checklist

Before going live, ensure:

- [ ] **Environment Variables**: All required variables are set
- [ ] **API Keys**: Valid and tested Meshy API key
- [ ] **Firebase Rules**: Proper security rules configured
- [ ] **Error Handling**: Comprehensive error handling implemented
- [ ] **Monitoring**: Analytics and error tracking configured
- [ ] **Performance**: Optimized for production load
- [ ] **Security**: All security measures implemented
- [ ] **Testing**: All features tested thoroughly
- [ ] **Documentation**: User documentation prepared
- [ ] **Support**: Support channels established

## 📞 Support

For issues and questions:

1. **Check Documentation**: Review this guide and Meshy.ai docs
2. **Test Panel**: Use the built-in test panel for diagnostics
3. **Console Logs**: Check browser console for detailed errors
4. **Firebase Logs**: Check Firebase Functions logs
5. **Meshy Support**: Contact Meshy.ai support for API issues

## 🔄 Updates & Maintenance

### Regular Maintenance Tasks

1. **Monitor Usage**: Check API usage and costs monthly
2. **Update Dependencies**: Keep npm packages updated
3. **Review Logs**: Monitor error logs and performance
4. **Backup Data**: Regular backups of user assets
5. **Security Updates**: Keep security measures current

### Version Updates

```bash
# Update Meshy integration
npm update

# Test new features
npm run test

# Deploy updates
firebase deploy
```

---

**🎉 Congratulations!** Your Meshy.ai 3D asset generation system is now production-ready with enterprise-grade features, comprehensive error handling, and best-in-class practices. 