# OpenAI API Key Setup for Firebase Functions

## Problem
The prompt enhancement feature requires the `OPENAI_API_KEY` to be set as a Firebase Secret. If this secret is not configured, the enhancement endpoint will return a 503 error.

## Solution: Set the OpenAI API Key Secret

### Step 1: Get Your OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Create a new API key
4. Copy the key (it starts with `sk-`)

### Step 2: Set the Secret in Firebase

Run this command in your terminal (from the project root):

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

When prompted, paste your OpenAI API key and press Enter.

### Step 3: Verify the Secret is Set

```bash
firebase functions:secrets:access OPENAI_API_KEY
```

This will show the first few characters of the key to confirm it's set.

### Step 4: Redeploy Functions

After setting the secret, you need to redeploy the functions:

```bash
firebase deploy --only functions
```

## Why This is Needed

- Preview channels use the **same Firebase Functions** as production
- The `OPENAI_API_KEY` is stored as a Firebase Secret for security
- Secrets must be explicitly set and are not automatically available
- Once set, the secret is available to all functions in the project

## Troubleshooting

### Check if Secret is Set
```bash
firebase functions:secrets:list
```

You should see `OPENAI_API_KEY` in the list.

### Check Function Logs
```bash
firebase functions:log --only api
```

Look for:
- `✅ OpenAI initialized in Firebase Functions` - Secret is working
- `⚠️ OPENAI_API_KEY not found` - Secret is missing

### Common Issues

1. **Secret not set**: Run `firebase functions:secrets:set OPENAI_API_KEY`
2. **Functions not redeployed**: Run `firebase deploy --only functions` after setting secret
3. **Wrong project**: Make sure you're in the correct Firebase project (`firebase use`)

## Security Notes

- Secrets are encrypted and stored securely by Firebase
- Secrets are only accessible within Firebase Functions
- Never commit API keys to version control
- Use different keys for development and production if needed

