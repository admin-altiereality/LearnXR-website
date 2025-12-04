# Preview Channel Skybox Generation - Troubleshooting

## Current Status ✅

- ✅ API is working (`https://us-central1-in3devoneuralai.cloudfunctions.net/api`)
- ✅ BlockadeLabs is configured
- ✅ Functions are deployed
- ✅ Preview channel is accessible

## Most Likely Issues

### Issue 1: Client Not Rebuilt/Redeployed

The preview channel might be using an old build that doesn't have the latest code or API configuration.

**Solution:**
```powershell
# Rebuild and redeploy to preview channel
.\deploy-preview-channel.ps1 -ChannelName "manav-evoneuralai-v0jy9nt0"
```

Or manually:
```powershell
# 1. Build client
cd server/client
npm run build:firebase
cd ../..

# 2. Deploy to preview channel
firebase hosting:channel:deploy manav-evoneuralai-v0jy9nt0
```

### Issue 2: Browser Cache

The browser might be using cached JavaScript that has old API URLs or error handling.

**Solution:**
1. Open preview channel: https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app/main
2. Press `F12` → **Application** tab
3. Clear **Local Storage** and **Session Storage**
4. Press `Ctrl+F5` (hard refresh)

Or use the console script:
1. Press `F12` → **Console** tab
2. Paste contents of `clear-browser-storage.js`
3. Press Enter
4. Refresh page (`Ctrl+F5`)

### Issue 3: API URL Mismatch

The client might be using the wrong API URL. Check in browser console:

1. Open preview channel
2. Press `F12` → **Console** tab
3. Type: `import.meta.env.VITE_API_BASE_URL`
4. Should show: `undefined` (uses default) or `https://us-central1-in3devoneuralai.cloudfunctions.net/api`

If it shows `http://localhost:5001/...`, the client is in dev mode.

**Solution:** Rebuild with production mode:
```powershell
cd server/client
npm run build:firebase
```

### Issue 4: CORS Errors

Check browser console for CORS errors when making API requests.

**Solution:** CORS should be handled by Firebase Functions. If you see CORS errors:
1. Check Firebase Functions logs: `firebase functions:log`
2. Verify CORS is enabled in `functions/src/index.ts`

### Issue 5: Authentication Issues

The API requires Firebase authentication. Check if you're logged in:

1. Open preview channel
2. Check top right corner for user icon
3. If not logged in, log in first
4. Try generating again

## Step-by-Step Fix

### Quick Fix (Try This First):

1. **Clear browser storage:**
   - F12 → Application → Clear Local/Session Storage
   - Ctrl+F5 to hard refresh

2. **Check browser console:**
   - F12 → Console tab
   - Try generating a skybox
   - Look for error messages
   - Check Network tab for failed requests

3. **If still not working, rebuild and redeploy:**
   ```powershell
   .\deploy-preview-channel.ps1 -ChannelName "manav-evoneuralai-v0jy9nt0"
   ```

### Detailed Debugging:

1. **Open browser console** (F12) before generating
2. **Try generating a skybox**
3. **Check for errors:**
   - Red errors in console
   - Failed requests in Network tab
   - 404/403/500 status codes

4. **Common error patterns:**
   - `Network Error` → API not reachable (check URL)
   - `404 Not Found` → Wrong API endpoint
   - `403 Forbidden` → Authentication issue
   - `500 Internal Server Error` → Server-side issue (check functions logs)
   - `CORS error` → CORS configuration issue

## Verify API is Working

Run this to verify the API:
```powershell
.\test-skybox-api.ps1
```

Should show:
- ✅ BlockadeLabs configured: True
- ✅ Styles endpoint working

## Check Function Logs

If generation fails, check Firebase Functions logs:
```powershell
firebase functions:log --only api
```

Look for:
- Skybox generation requests
- Error messages
- API key issues

## Still Not Working?

1. **Check the exact error message** in browser console
2. **Check Network tab** for the failed request:
   - What URL was called?
   - What was the response?
   - What status code?
3. **Check Firebase Functions logs** for server-side errors
4. **Verify you're logged in** to Firebase Auth

## Expected Behavior

When working correctly:
1. Enter prompt → Select style → Click Generate
2. Console shows: "🌅 Starting skybox generation..."
3. API request to `/skybox/generate` succeeds
4. Generation ID received
5. Polling starts (status checks every 10 seconds)
6. Progress indicator shows
7. Skybox completes in 30-60 seconds
8. Skybox image appears

## Quick Test

Test the API directly from PowerShell:
```powershell
# This requires authentication, but tests if API is reachable
Invoke-WebRequest -Uri "https://us-central1-in3devoneuralai.cloudfunctions.net/api/skybox/styles" -UseBasicParsing
```

If this works, the API is fine and the issue is in the client.

