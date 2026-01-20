# Deployment Note: Function Rewrite Configuration

## Current Configuration

The `firebase.json` file does **not** include a function rewrite for `/api/**` routes. This is intentional to avoid Cloud Run validation errors during preview channel deployments.

## Why This Works

The client application (`server/client/src/config/axios.ts`) is configured to call Firebase Functions directly via their full URL:
- Production: `https://us-central1-in3devoneuralai.cloudfunctions.net/api`
- Development: `http://localhost:5001/in3devoneuralai/us-central1/api` (when on localhost)

Therefore, the function rewrite in Firebase Hosting is **not required** for the application to work.

## If You Need the Rewrite

If you want to use cleaner URLs (e.g., `/api/skybox/styles` instead of the full function URL), you would need to:

1. **Fix the function deployment issue first:**
   - The function in `us-central1` shows `---` for memory, suggesting it's not fully deployed
   - Function deployment times out during analysis phase
   - This needs to be resolved before the rewrite can work

2. **Then add the rewrite back:**
   ```json
   "rewrites": [
     {
       "source": "/api/**",
       "function": {
         "functionId": "api",
         "region": "us-central1"
       }
     },
     {
       "source": "**",
       "destination": "/index.html"
     }
   ]
   ```

## Current Status

✅ **Working:** Client calls functions directly via full URL  
✅ **Working:** Preview channel deployment succeeds  
⚠️ **Issue:** Function rewrite causes Cloud Run validation errors  
⚠️ **Issue:** Function deployment times out during analysis

## Recommendation

Keep the current configuration (no function rewrite) until the function deployment timeout issue is resolved. The application works perfectly without it.

