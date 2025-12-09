# Test Skybox Generation - Step by Step Guide

## Quick Test Steps

### 1. Clear Browser Storage (Important!)

If you're seeing "Skybox generation not found" errors, clear stale data first:

**Chrome/Edge:**
1. Open your preview channel: https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app/main
2. Press `F12` to open DevTools
3. Go to **Application** tab (or **Storage** in Firefox)
4. In the left sidebar, expand **Local Storage**
5. Click on your site's URL
6. Click **Clear All** or delete individual items
7. Do the same for **Session Storage**
8. Close DevTools and **refresh the page** (Ctrl+F5 for hard refresh)

**Firefox:**
1. Press `F12` to open DevTools
2. Go to **Storage** tab
3. Expand **Local Storage** and **Session Storage**
4. Right-click and select **Delete All**
5. Refresh the page

### 2. Test Skybox Generation

1. **Go to your preview channel:**
   ```
   https://in3devoneuralai--manav-evoneuralai-v0jy9nt0.web.app/main
   ```

2. **Make sure you're logged in** (check top right corner)

3. **Enter a prompt**, for example:
   - "A futuristic city at sunset"
   - "A peaceful forest clearing"
   - "A cyberpunk street at night"

4. **Select a style** from the style picker

5. **Click "Generate"** or the generate button

6. **Watch the console** (F12 → Console tab) for:
   - ✅ "Starting skybox generation..."
   - ✅ "Skybox generation response:"
   - ✅ "Skybox generation initiated, polling for completion..."

### 3. Monitor the Generation

**In Browser Console (F12):**
- Look for progress updates
- Check for any error messages
- The generation should complete in 30-60 seconds

**Expected Success Flow:**
1. Generation request sent → ✅
2. Generation ID received → ✅
3. Polling starts → ✅
4. Status updates (pending → processing → completed) → ✅
5. Skybox image displayed → ✅

### 4. If You Still See Errors

**Error: "Skybox generation not found. It may have expired."**
- This means the generationId doesn't exist
- **Solution:** Clear storage and try a NEW generation (don't retry old ones)

**Error: "BlockadeLabs API key is not configured"**
- Check: `.\test-skybox-api.ps1`
- Verify secret is enabled in Google Cloud Console

**Error: "Network error" or timeout**
- Check your internet connection
- Try again after a few seconds

## API Testing (Alternative)

You can also test the API directly using PowerShell:

```powershell
# Test environment
.\test-skybox-api.ps1

# Test skybox generation (requires authentication)
# This would need to be done through the web interface
```

## Verification Checklist

Before testing, verify:
- [ ] Functions are deployed: `firebase deploy --only functions` completed successfully
- [ ] API is working: `.\test-skybox-api.ps1` shows BlockadeLabs: True
- [ ] Browser storage is cleared
- [ ] You're logged in to the preview channel
- [ ] You have a valid prompt and style selected

## Expected Results

✅ **Success:**
- Skybox generation starts immediately
- Progress indicator shows
- Skybox completes in 30-60 seconds
- Skybox image appears in the viewer

❌ **Failure:**
- Error message appears
- Check browser console for details
- Verify API status with test script

## Debugging Tips

1. **Open Browser Console (F12)** before generating
2. **Watch the Network tab** to see API calls
3. **Check for CORS errors** (shouldn't happen, but good to verify)
4. **Look for 404/403/500 errors** in Network tab

## Still Having Issues?

1. Check the browser console for detailed error messages
2. Run `.\test-skybox-api.ps1` to verify API status
3. Check Firebase Functions logs:
   ```
   firebase functions:log
   ```
4. Verify secret is enabled in Google Cloud Console

