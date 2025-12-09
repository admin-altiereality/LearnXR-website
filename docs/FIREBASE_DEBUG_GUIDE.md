# Firebase Functions & Firestore Debugging Guide

## 🔒 **Firestore Permissions Issues**

### Common Causes of "Missing or insufficient permissions"

1. **Authentication Issues**
   - User not properly authenticated
   - Token expired or invalid
   - Missing `userId` field in documents

2. **Rule Structure Issues**
   - Incorrect field references
   - Missing required fields in `request.resource.data`
   - Admin role not properly set

3. **Collection Structure Issues**
   - Documents missing required fields
   - Incorrect document structure

### Debugging Steps

#### 1. Check Authentication Status
```javascript
// In your React app
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('User is signed in:', user.uid);
    // Get ID token for API calls
    user.getIdToken().then(token => {
      console.log('ID Token:', token);
    });
  } else {
    console.log('User is signed out');
  }
});
```

#### 2. Test Firestore Rules Locally
```bash
# Start Firebase emulator
firebase emulators:start --only firestore

# Test rules in emulator
firebase firestore:rules:test
```

#### 3. Check Document Structure
Ensure your skybox documents have this structure:
```javascript
{
  userId: "user_uid_here",
  prompt: "skybox description",
  style_id: "style_id_here",
  status: "pending|complete|failed",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  fileUrl: "url_when_complete",
  thumbnailUrl: "thumbnail_url_when_complete"
}
```

#### 4. Verify Admin Role
```javascript
// Set admin role for a user
const db = getFirestore();
await db.collection('users').doc(userId).set({
  role: 'admin',
  email: userEmail,
  createdAt: serverTimestamp()
});
```

## 🧠 **Blockade Labs API Integration**

### API Endpoints

#### 1. Generate Skybox
```bash
curl -X POST https://api-k2khuruyuq-uc.a.run.app/api/skybox/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "style_id": "style_id_here",
    "userId": "user_uid_here"
  }'
```

#### 2. Check Skybox Status
```bash
curl -X GET https://api-k2khuruyuq-uc.a.run.app/api/skybox/status/GENERATION_ID_HERE
```

#### 3. Get Skybox Styles
```bash
curl -X GET https://api-k2khuruyuq-uc.a.run.app/api/skybox/styles?page=1&limit=20
```

#### 4. Get User Skybox History
```bash
curl -X GET https://api-k2khuruyuq-uc.a.run.app/api/skybox/history \
  -H "Authorization: Bearer USER_ID_TOKEN"
```

### Environment Variables Setup

#### 1. Set Firebase Secrets
```bash
# Set Blockade Labs API key
firebase functions:secrets:set BLOCKADE_API_KEY

# Set Razorpay credentials
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

#### 2. Verify Secrets
```bash
# Check environment
curl -X GET https://api-k2khuruyuq-uc.a.run.app/api/env-check
```

## 🔍 **Debugging Tools**

### 1. Firebase Functions Logs
```bash
# View real-time logs
firebase functions:log --only api

# View specific function logs
firebase functions:log --only api --limit 50
```

### 2. Firestore Rules Testing
```bash
# Test specific rules
firebase firestore:rules:test --file test-rules.json
```

### 3. API Testing Script
```bash
# Test all endpoints
./test-api.sh
```

## 🚀 **Deployment Checklist**

### Before Deployment
- [ ] All TypeScript errors fixed
- [ ] Environment variables set in Firebase Secrets
- [ ] Firestore rules tested locally
- [ ] API endpoints tested in emulator

### After Deployment
- [ ] Functions deployed successfully
- [ ] Firestore rules deployed
- [ ] Environment check endpoint working
- [ ] Health check endpoint working
- [ ] API endpoints responding correctly

## 📝 **Common Error Solutions**

### 1. 500 Internal Server Error
- Check Firebase Functions logs
- Verify environment variables
- Check API key format and validity

### 2. 400 Bad Request
- Verify request body structure
- Check required fields
- Validate input data

### 3. 401 Unauthorized
- Check authentication token
- Verify user is signed in
- Check token expiration

### 4. 404 Not Found
- Verify generation ID exists
- Check API endpoint URL
- Validate document paths

## 🔧 **Testing Scripts**

### Test API Endpoints
```bash
#!/bin/bash
BASE_URL="https://api-k2khuruyuq-uc.a.run.app"

echo "Testing Firebase Functions API..."

# Health check
echo "1. Health check..."
curl -s "$BASE_URL/api/health" | jq '.'

# Environment check
echo "2. Environment check..."
curl -s "$BASE_URL/api/env-check" | jq '.'

# Skybox styles
echo "3. Skybox styles..."
curl -s "$BASE_URL/api/skybox/styles?page=1&limit=5" | jq '.'

echo "API testing complete!"
```

### Test Firestore Rules
```javascript
// test-rules.js
const admin = require('firebase-admin');
const db = admin.firestore();

async function testRules() {
  try {
    // Test skybox creation
    const skyboxData = {
      userId: 'test_user_id',
      prompt: 'Test skybox',
      style_id: 'test_style',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('skyboxes').doc('test_id').set(skyboxData);
    console.log('✅ Skybox creation test passed');
    
    // Test skybox reading
    const doc = await db.collection('skyboxes').doc('test_id').get();
    console.log('✅ Skybox reading test passed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRules();
```

## 📊 **Monitoring & Analytics**

### 1. Firebase Console
- Monitor function execution times
- Check error rates
- View resource usage

### 2. Custom Logging
- Request IDs for tracking
- Detailed error messages
- Performance metrics

### 3. Alerting
- Set up error notifications
- Monitor API response times
- Track failed requests

## 🛠 **Troubleshooting Commands**

```bash
# Deploy functions only
firebase deploy --only functions

# Deploy rules only
firebase deploy --only firestore:rules

# View function logs
firebase functions:log

# Test rules locally
firebase emulators:start --only firestore

# Check function status
firebase functions:list

# Update function configuration
firebase functions:config:set blockadelabs.api_key="your_key"
``` 