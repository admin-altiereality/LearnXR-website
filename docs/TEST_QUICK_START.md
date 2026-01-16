# Test Quick Start Guide

## Prerequisites

1. **Node.js** installed (for Node.js test script)
2. **Valid In3D API Key** (generate from Developer Portal)
3. **curl and jq** (for Bash script - Linux/Mac)
4. **bc** (for Bash script success rate calculation)

## Step 1: Generate an API Key

1. Log in to your In3D.ai account
2. Navigate to **Developer Settings** (or `/developer-settings`)
3. Click **"Create API Key"**
4. Enter a label (e.g., "Test Key")
5. Select scope:
   - **Read-only**: For testing read endpoints (styles, status)
   - **Full Access**: For testing all endpoints (generate, cancel)
6. **Copy the raw key immediately** - it won't be shown again!

## Step 2: Set Environment Variable

### Windows (PowerShell)
```powershell
$env:IN3D_API_KEY="in3d_live_your_actual_key_here"
```

### Windows (Command Prompt)
```cmd
set IN3D_API_KEY=in3d_live_your_actual_key_here
```

### Linux/Mac (Bash)
```bash
export IN3D_API_KEY="in3d_live_your_actual_key_here"
```

## Step 3: Run Tests

### Option 1: Node.js Script (Recommended - Cross-platform)

```bash
node scripts/test-api.js
```

**Expected Output:**
```
🚀 Starting In3D API Comprehensive Tests
Base URL: https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api
==================================================

📦 SKYBOX ENDPOINT TESTS
--------------------------------------------------

🧪 Testing: Get Skybox Styles (X-In3d-Key header)
   GET /skybox/styles?page=1&limit=10
   ✅ HTTP Status: 200
   ✅ Valid JSON response format
   ✅ Custom validation passed

...
```

### Option 2: Bash Script (Linux/Mac)

```bash
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

**Expected Output:**
```
Testing In3D API Endpoints
Base URL: https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api

Testing: Get Skybox Styles (X-In3d-Key header)
  GET /skybox/styles?page=1&limit=10
  ✓ HTTP Status: 200
  ✓ Valid JSON response format

...
```

## Step 4: Validate Test Scripts (Without API Key)

You can validate the test scripts are properly structured without an API key:

```bash
node scripts/validate-tests.js
```

This will check:
- ✅ Script files exist and are valid
- ✅ Required functions are present
- ✅ Test categories are included
- ✅ Error handling is implemented
- ✅ Documentation exists

## Understanding Test Results

### Success Indicators
- ✅ **Green checkmarks**: Test passed
- ✅ **HTTP Status matches expected**: Correct response code
- ✅ **Valid JSON format**: Response follows API standard
- ✅ **Custom validation passed**: Response data is correct

### Failure Indicators
- ❌ **Red X marks**: Test failed
- ❌ **Unexpected HTTP status**: Wrong response code
- ❌ **Invalid response format**: Response doesn't match API standard
- ❌ **Custom validation failed**: Response data is incorrect

### Test Summary

At the end, you'll see:
```
📊 Test Summary
==================================================
✅ Tests Passed: 13
❌ Tests Failed: 0
📈 Total Tests: 13
📊 Success Rate: 100.0%
```

## Common Issues

### Issue: "IN3D_API_KEY environment variable is not set"

**Solution:**
```bash
# Verify the variable is set
echo $IN3D_API_KEY  # Linux/Mac
echo %IN3D_API_KEY%  # Windows CMD
$env:IN3D_API_KEY    # Windows PowerShell

# Set it if missing
export IN3D_API_KEY="in3d_live_your_key"  # Linux/Mac
```

### Issue: "401 Unauthorized" errors

**Possible Causes:**
- API key is invalid or revoked
- API key format is incorrect (should start with `in3d_live_`)
- API key was copied incorrectly (extra spaces, missing characters)

**Solution:**
1. Generate a new API key from Developer Portal
2. Copy it carefully (no extra spaces)
3. Verify it starts with `in3d_live_`

### Issue: "403 Forbidden" errors

**Possible Causes:**
- API key has "Read-only" scope but trying to use write endpoints
- User's subscription tier doesn't allow the operation
- Credits exhausted

**Solution:**
1. Generate a new API key with "Full Access" scope
2. Check your subscription tier and credits
3. Upgrade if necessary

### Issue: "429 Too Many Requests"

**Solution:**
- Wait a few minutes before retrying
- Reduce request frequency
- Check rate limit headers in response

### Issue: Tests hang on status polling

**Solution:**
- Generation may take time (30 seconds to several minutes)
- Script will timeout after 5-10 polls
- Check generation status manually in Developer Portal

## Test Coverage

The test scripts cover:

### ✅ Skybox Endpoints
- Get styles (both auth header formats)
- Generate skybox
- Get generation status (with polling)

### ✅ Meshy Endpoints
- Generate 3D asset
- Get generation status

### ✅ Authentication
- Valid API key (X-In3d-Key)
- Valid API key (Authorization: Bearer)
- Invalid API key
- Missing API key

### ✅ Error Handling
- Missing required fields (400)
- Invalid request body (400)
- Invalid API key (401)
- Missing API key (401)

### ✅ Validation
- Pagination validation
- Response format validation

## Next Steps

After running tests successfully:

1. **Review Test Results**: Check which tests passed/failed
2. **Check API Documentation**: See `docs/API_REFERENCE.md` for details
3. **Set up n8n Integration**: Follow `docs/N8N_WORKFLOW_GUIDE.md`
4. **Monitor API Usage**: Check Developer Portal for usage stats

## Support

If tests fail consistently:
1. Check API status at Developer Portal
2. Verify API key is active and not revoked
3. Check your subscription tier and credits
4. Review error messages for specific issues
5. Consult `docs/TESTING_REPORT.md` for detailed troubleshooting

---

**Last Updated**: 2024-01-15
