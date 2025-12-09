# Fresh Deployment Guide: Firebase Function via Google Cloud Console

## 📍 Deployment Package Location
```
/Users/gaurav/Desktop/Dec 2025 In3d/in3devoneuralwebsite-1/function-deploy.zip
```

---

## Step 1: Open Google Cloud Console

1. **Go to Cloud Functions:**
   - Open: **https://console.cloud.google.com/functions?project=in3devoneuralai**
   - Or navigate: Google Cloud Console → Cloud Functions

2. **Verify Project:**
   - Make sure you're in project: **in3devoneuralai**
   - If not, click the project dropdown at the top and select it

3. **Check Existing Functions:**
   - You should see an empty list (we deleted the old function)
   - If you see an `api` function, delete it first

---

## Step 2: Create New Function

1. **Click "CREATE FUNCTION"** button (top of the page)

2. **You'll see the function creation form with multiple sections**

---

## Step 3: Basic Configuration

### In the "Basics" section:

1. **Function name:**
   - Enter: `api`
   - ⚠️ Must be exactly `api` (lowercase)

2. **Region:**
   - Select: `us-central1` from the dropdown
   - ⚠️ Must match: `us-central1`

3. **Environment:**
   - Select: **"2nd gen"** (if available)
   - If "2nd gen" is not available, use "1st gen"

4. **Click "NEXT"** to proceed

---

## Step 4: Runtime Configuration

### In the "Runtime, build, connections and security settings" section:

1. **Click to expand** this section (if collapsed)

2. **Runtime:**
   - **Runtime service account:** Leave as default
   - **Runtime:** Select `Node.js 22` (or latest available Node.js version)

3. **Memory and timeout:**
   - **Memory:** `512 MiB`
   - **Timeout:** `60 seconds`
   - **Min instances:** `0`
   - **Max instances:** `10`

4. **Execution:**
   - **Invocation:** Select **"Allow unauthenticated invocations"**
   - This allows your frontend to call the function without authentication

5. **Click "NEXT"** to proceed

---

## Step 5: Upload Source Code ⭐ (CRITICAL STEP)

### This is where you upload the ZIP file:

1. **Scroll to "Source code" section**

2. **Select source:**
   - You'll see options:
     - ⬜ Inline editor
     - ⬜ **Zip upload** ← **SELECT THIS ONE**
     - ⬜ Cloud Storage
     - ⬜ Cloud Source Repositories

3. **Click the "Zip upload" radio button**

4. **Click "Browse" or "Choose file" button**

5. **Navigate to and select:**
   ```
   /Users/gaurav/Desktop/Dec 2025 In3d/in3devoneuralwebsite-1/function-deploy.zip
   ```
   - File size should be: ~110KB
   - File name: `function-deploy.zip`

6. **Wait for upload to complete:**
   - You'll see a progress indicator
   - Wait until you see: "Upload complete" or the file name appears

7. **Entry point:**
   - In the "Entry point" field below the upload area
   - Enter: `api`
   - ⚠️ This tells Cloud Functions which exported function to use

---

## Step 6: Set Environment Variables ⭐ (CRITICAL STEP)

### This is required for the function to work:

1. **Still in "Runtime, build, connections and security settings" section**

2. **Scroll down to "Runtime environment variables"**

3. **Click "ADD VARIABLE" button**

4. **Enter the following:**
   - **Name:** `BLOCKADE_API_KEY`
   - **Value:** `IdJujdKPd1Is8F7e2rwE8UCEOSAiViP53VIaF7W1sPA2Hhkmmy3CmVLxtd3r`
   - ⚠️ Copy the value exactly (no spaces before/after)

5. **Click "DONE" or checkmark** to save the variable

6. **Verify it appears in the list:**
   - You should see: `BLOCKADE_API_KEY` in the environment variables list

---

## Step 7: Review and Deploy

1. **Review all settings:**
   - ✅ Function name: `api`
   - ✅ Region: `us-central1`
   - ✅ Runtime: `Node.js 22`
   - ✅ Entry point: `api`
   - ✅ Memory: `512 MiB`
   - ✅ Timeout: `60 seconds`
   - ✅ Max instances: `10`
   - ✅ Source: `function-deploy.zip` (uploaded)
   - ✅ Environment variable: `BLOCKADE_API_KEY` (set)
   - ✅ Invocation: Allow unauthenticated

2. **Scroll to the bottom of the page**

3. **Click the blue "DEPLOY" button** (usually bottom right)

---

## Step 8: Wait for Deployment

1. **You'll be redirected to the Functions list page**

2. **Watch the deployment progress:**
   - Status will show: **"Deploying..."** with a spinner
   - This typically takes **2-5 minutes**

3. **Wait for completion:**
   - Status will change to: **"Active"** (green checkmark)
   - ⚠️ Don't close the browser tab during deployment

---

## Step 9: Verify Deployment

1. **Once status shows "Active":**
   - Click on the function name `api`

2. **Check the function details:**
   - Go to **"Testing"** tab
   - You'll see the function URL:
     ```
     https://us-central1-in3devoneuralai.cloudfunctions.net/api
     ```

3. **Test the health endpoint:**
   - In the "Testing" tab, try:
     - **HTTP method:** GET
     - **Path:** `/health`
   - Click "TEST THE FUNCTION"
   - Should return: `{"status":"healthy",...}`

4. **Or test via browser:**
   - Open: `https://us-central1-in3devoneuralai.cloudfunctions.net/api/health`
   - Should return JSON with status: "healthy"

---

## Step 10: Update Preview Channel (If Needed)

If you have a preview channel deployed:

1. **The function URL is automatically used by Firebase Hosting**
2. **No additional configuration needed** - the rewrite rule in `firebase.json` handles it
3. **Test your preview channel** to verify the function works

---

## 🎯 Quick Checklist

Before clicking DEPLOY, verify:

- [ ] Function name: `api`
- [ ] Region: `us-central1`
- [ ] Runtime: `Node.js 22`
- [ ] Entry point: `api`
- [ ] Memory: `512 MiB`
- [ ] Timeout: `60 seconds`
- [ ] Source: `function-deploy.zip` uploaded
- [ ] Environment variable: `BLOCKADE_API_KEY` set
- [ ] Invocation: Allow unauthenticated

---

## ⚠️ Troubleshooting

### If deployment fails:

1. **Check the "Logs" tab:**
   - Look for error messages
   - Common issues:
     - Missing environment variable
     - Wrong entry point
     - Build errors

2. **Verify ZIP file:**
   - Make sure `function-deploy.zip` contains:
     - `package.json`
     - `lib/index.js` (compiled code)
     - `src/index.ts` (source)

3. **Check environment variable:**
   - Ensure `BLOCKADE_API_KEY` is set correctly
   - No extra spaces or quotes

### If function deploys but doesn't work:

1. **Check function logs:**
   - Go to function → "Logs" tab
   - Look for runtime errors

2. **Test endpoints:**
   - Try `/health` endpoint first
   - Then try `/env-check` to verify API key is loaded

3. **Verify function URL:**
   - Make sure you're using the correct URL
   - Format: `https://us-central1-in3devoneuralai.cloudfunctions.net/api`

---

## 📞 Need Help?

**Common Issues:**

1. **"Function not found" error:**
   - Check entry point is set to `api`
   - Verify the ZIP contains `lib/index.js` with exported `api` function

2. **"API key not configured" error:**
   - Check environment variable `BLOCKADE_API_KEY` is set
   - Verify the value is correct (no spaces)

3. **"Timeout" error:**
   - Increase timeout to 120 seconds if needed
   - Check function logs for slow operations

---

## ✅ Success Indicators

After successful deployment, you should see:

- ✅ Function status: **"Active"** (green)
- ✅ Function URL accessible
- ✅ `/health` endpoint returns: `{"status":"healthy"}`
- ✅ `/env-check` shows: `blockadelabs: true`
- ✅ No errors in function logs

---

## 🚀 Next Steps

After deployment:

1. **Test the function endpoints:**
   - Health: `/api/health`
   - Styles: `/api/skybox/styles`
   - Generate: `/api/skybox/generate`

2. **Update preview channel** (if you have one):
   - The function will automatically be used via Firebase Hosting rewrites

3. **Monitor function logs:**
   - Check for any runtime errors
   - Monitor performance metrics

---

**Ready to deploy?** Follow the steps above, and your function will be live in 2-5 minutes! 🎉
