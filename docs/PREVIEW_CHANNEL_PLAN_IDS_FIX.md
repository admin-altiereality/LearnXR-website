# Fix: Team Yearly Plan Not Working on Preview Channel

## Issue
The Team Yearly plan is not working on the preview channel, even though the plan ID is correctly configured.

## Root Cause
Vite bakes environment variables into the JavaScript bundle at **build time**. If the preview channel was deployed before the plan IDs were added or updated, the old build doesn't include the new environment variables.

## Solution: Rebuild and Redeploy

### Step 1: Verify Plan IDs in .env
Make sure `server/client/.env` contains:
```env
VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID=plan_RvpkuZw6KeqRQL
VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID=plan_RvpktTFO9wqJH0
VITE_RAZORPAY_PRO_MONTHLY_PLAN_ID=plan_Rvpkr9pQPWCXLo
VITE_RAZORPAY_PRO_YEARLY_PLAN_ID=plan_RvpksLVQcNdDUg
VITE_RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID=plan_RvpkvliI4gyQPY
VITE_RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID=plan_RvpkwzuciCJhFY
```

### Step 2: Clean Build (Recommended)
```powershell
cd server/client
# Remove old build
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
# Rebuild with fresh environment variables
npm run build:firebase
cd ../..
```

### Step 3: Deploy to Preview Channel
```powershell
# Option 1: Use the deployment script
.\scripts\deploy-preview-channel.ps1

# Option 2: Manual deployment
firebase hosting:channel:deploy your-channel-name
```

## Verification

After redeploying, check the browser console on the preview channel:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to select Team Yearly plan
4. Look for any warnings about missing plan IDs

If you see a warning like:
```
⚠️ Razorpay plan ID not found for team (yearly)
```

This means the environment variable wasn't included in the build. Make sure:
- ✅ `.env` file exists in `server/client/`
- ✅ Plan IDs are correctly set
- ✅ You rebuilt the client (`npm run build:firebase`)
- ✅ You redeployed to the preview channel

## Quick Test

To verify plan IDs are loaded in the build:

1. After building, check `server/client/dist/assets/*.js`
2. Search for `plan_RvpkuZw6KeqRQL` (Team Yearly Plan ID)
3. If found, the build includes the plan ID ✅
4. If not found, the environment variable wasn't loaded ❌

## Common Issues

### Issue: Plan ID is empty/undefined
**Solution**: 
- Check `.env` file is in `server/client/` directory
- Verify no extra spaces or quotes around the plan ID
- Make sure variable name matches exactly: `VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID`

### Issue: Old build still deployed
**Solution**: 
- Always rebuild after changing `.env` variables
- Clear browser cache or use incognito mode
- Check deployment timestamp matches your rebuild time

### Issue: Environment variable not loading
**Solution**:
- Restart your dev server if testing locally
- Make sure variable starts with `VITE_`
- Check for typos in variable names
- Verify `.env` file encoding is UTF-8

## Notes

- Environment variables are **baked into the build** at build time
- Preview channels use the same build process as production
- Changes to `.env` require a **rebuild and redeploy**
- The plan IDs are now accessed via `import.meta.env` (Vite standard)

