# Setting Firebase Functions Secrets

## Quick Method (Using Script)

Run the interactive script:
```bash
./scripts/set-function-secrets.sh
```

This will prompt you to enter each secret value securely.

## Manual Method

If you prefer to set secrets manually, use these commands:

### 1. Set BLOCKADE_API_KEY
```bash
echo -n "your_blockade_api_key_here" | firebase functions:secrets:set BLOCKADE_API_KEY
```

**Get your BlockadeLabs API key from:**
- https://www.blockadelabs.com/
- Sign up/login → Dashboard → API Keys

### 2. Set RAZORPAY_KEY_ID
```bash
echo -n "your_razorpay_key_id_here" | firebase functions:secrets:set RAZORPAY_KEY_ID
```

**Get your Razorpay Key ID from:**
- https://dashboard.razorpay.com/
- Settings → API Keys → Key ID

### 3. Set RAZORPAY_KEY_SECRET
```bash
echo -n "your_razorpay_key_secret_here" | firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

**Get your Razorpay Key Secret from:**
- https://dashboard.razorpay.com/
- Settings → API Keys → Key Secret

## Important Notes

- Use `-n` flag with `echo` to avoid adding a newline character
- Replace the placeholder values with your actual credentials
- Make sure you're logged into Firebase CLI: `firebase login`
- Secrets are stored securely in Google Secret Manager

## Verify Secrets Are Set

```bash
# List all secrets
firebase functions:secrets:list

# Check if a specific secret exists (will show the value)
firebase functions:secrets:access BLOCKADE_API_KEY
```

## After Setting Secrets

The function will automatically use these secrets. You don't need to redeploy the function - secrets are accessed at runtime.

However, if you want to verify the function can access them, test the health endpoint:
```bash
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health
```

The response should show:
```json
{
  "status": "healthy",
  "services": {
    "firebase": true,
    "blockadelabs": true,  // Should be true after setting BLOCKADE_API_KEY
    "razorpay": true       // Should be true after setting RAZORPAY keys
  }
}
```

