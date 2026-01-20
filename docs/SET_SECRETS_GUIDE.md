# Setting Firebase Functions Secrets - Step by Step

## Method 1: Interactive Script (Recommended)

Run the script and enter each value when prompted:
```bash
./SET_SECRETS_NOW.sh
```

When prompted, type each secret value (input is hidden for security).

## Method 2: Manual Commands

If you prefer to set secrets manually, use these commands one at a time:

### 1. Set BLOCKADE_API_KEY

```bash
echo -n "YOUR_BLOCKADE_API_KEY_HERE" | firebase functions:secrets:set BLOCKADE_API_KEY
```

**Replace `YOUR_BLOCKADE_API_KEY_HERE` with your actual BlockadeLabs API key.**

**To get your BlockadeLabs API key:**
1. Go to https://www.blockadelabs.com/
2. Sign up or log in
3. Navigate to your dashboard/API settings
4. Copy your API key

### 2. Set RAZORPAY_KEY_ID

```bash
echo -n "YOUR_RAZORPAY_KEY_ID_HERE" | firebase functions:secrets:set RAZORPAY_KEY_ID
```

**Replace `YOUR_RAZORPAY_KEY_ID_HERE` with your actual Razorpay Key ID.**

**To get your Razorpay Key ID:**
1. Go to https://dashboard.razorpay.com/
2. Sign up or log in
3. Go to Settings → API Keys
4. Copy the **Key ID** (starts with `rzp_`)

### 3. Set RAZORPAY_KEY_SECRET

```bash
echo -n "YOUR_RAZORPAY_KEY_SECRET_HERE" | firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

**Replace `YOUR_RAZORPAY_KEY_SECRET_HERE` with your actual Razorpay Key Secret.**

**To get your Razorpay Key Secret:**
1. Go to https://dashboard.razorpay.com/
2. Sign up or log in
3. Go to Settings → API Keys
4. Copy the **Key Secret** (longer string, keep it secure!)

## Important Notes

- **Use `-n` flag**: The `-n` flag with `echo` prevents adding a newline character, which is important for secrets
- **No spaces**: Make sure there are no spaces around the `=` sign or in the secret value
- **Keep secrets secure**: Never share or commit secret values to version control

## Verify Secrets Are Set

After setting secrets, verify they're accessible:

```bash
# Test the health endpoint
curl https://us-central1-in3devoneuralai.cloudfunctions.net/api/health
```

Expected response (after secrets are set):
```json
{
  "status": "healthy",
  "timestamp": "2025-12-09T...",
  "services": {
    "firebase": true,
    "blockadelabs": true,    // Should be true after setting BLOCKADE_API_KEY
    "razorpay": true         // Should be true after setting RAZORPAY keys
  },
  "requestId": "..."
}
```

## Troubleshooting

### If secret setting fails:
1. Make sure you're logged in: `firebase login`
2. Check you're in the right project: `firebase projects:list`
3. Verify the secret name is correct (case-sensitive)

### If health check shows services as false:
1. Wait a few seconds after setting secrets (they may take a moment to propagate)
2. Verify the secret values are correct
3. Check function logs: `firebase functions:log`

## Example Commands (Replace with your actual values)

```bash
# Example - replace with your actual values
echo -n "sk_live_abc123xyz" | firebase functions:secrets:set BLOCKADE_API_KEY
echo -n "rzp_live_abc123xyz" | firebase functions:secrets:set RAZORPAY_KEY_ID
echo -n "secret_key_abc123xyz" | firebase functions:secrets:set RAZORPAY_KEY_SECRET
```

