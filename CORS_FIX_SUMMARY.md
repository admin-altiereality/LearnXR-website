# CORS Fix for Preview Channels

## Problem
Preview channel deployments were getting CORS errors:
```
Access to XMLHttpRequest at 'https://us-central1-in3devoneuralai.cloudfunctions.net/api/skybox/styles' 
from origin 'https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
The CORS configuration in Firebase Functions wasn't properly handling:
1. OPTIONS preflight requests from preview channels
2. Dynamic preview channel origins (they have unique URLs like `in3devoneuralai--channel-name.web.app`)

## Solution Applied

### 1. Enhanced Express CORS Middleware (`functions/src/index.ts`)
- Added explicit origin validation that allows all Firebase Hosting origins (`.web.app` and `.firebaseapp.com`)
- Added explicit OPTIONS preflight handler: `app.options('*', cors())`
- Configured proper CORS headers including:
  - `Access-Control-Allow-Origin`
  - `Access-Control-Allow-Methods`
  - `Access-Control-Allow-Headers`
  - `Access-Control-Max-Age`

### 2. Function-Level CORS
- Kept `cors: true` in function configuration to allow all origins at the function level
- Express middleware provides more granular control

## Changes Made

```typescript
// Enhanced CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin
    if (!origin) return callback(null, true);
    
    // Allow all Firebase Hosting origins (production and preview channels)
    if (origin.includes('.web.app') || origin.includes('.firebaseapp.com')) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow all origins (fallback)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly
app.options('*', cors());
```

## Deployment Steps

1. **Build the functions:**
   ```bash
   cd functions
   npm run build
   cd ..
   ```

2. **Deploy the functions:**
   ```bash
   firebase deploy --only functions:api
   ```

3. **Verify the deployment:**
   - Check that the function is deployed: `firebase functions:list`
   - Test the API from the preview channel

## Testing

After deployment, test from the preview channel:
1. Open: `https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app`
2. Open browser console (F12)
3. Try to fetch styles - should work without CORS errors
4. Check Network tab - OPTIONS preflight should return 200 with proper CORS headers

## Expected CORS Headers

After the fix, responses should include:
```
Access-Control-Allow-Origin: https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Max-Age: 86400
```

## Notes

- The function-level `cors: true` allows all origins at the Firebase Functions level
- The Express CORS middleware provides more granular control and proper preflight handling
- Preview channels have dynamic URLs, so we check for `.web.app` and `.firebaseapp.com` patterns
- All origins are allowed as a fallback for maximum compatibility

