# How to Check Available Assistants

This guide shows you how to find what curriculum, class, and subject combinations are available in your OpenAI account.

## Method 1: Browser Console (Easiest)

1. Open your application in the browser
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. The available assistants are automatically logged when the page loads
5. You can also manually check by running:

```javascript
// Get the API base URL (adjust if needed)
const apiUrl = 'http://localhost:5001/in3devoneuralai/us-central1/api'; // Local
// OR
const apiUrl = 'https://us-central1-in3devoneuralai.cloudfunctions.net/api'; // Production

// Fetch available assistants
fetch(`${apiUrl}/assistant/list?useAvatarKey=true`)
  .then(res => res.json())
  .then(data => {
    console.log('Available assistants:', data.assistants);
    console.table(data.assistants);
  });
```

## Method 2: Using Node.js Script

Run the provided script:

```bash
# For regular assistants
node scripts/list-available-assistants.js

# For avatar assistants (uses OPENAI_AVATAR_API_KEY)
node scripts/list-available-assistants.js --avatar

# Output as JSON
node scripts/list-available-assistants.js --json
```

**Note:** The script uses `fetch` which requires Node.js 18+ or you can install `node-fetch`:
```bash
npm install node-fetch
```

## Method 3: Using PowerShell (Windows)

```powershell
# For regular assistants
.\scripts\list-available-assistants.ps1

# For avatar assistants
.\scripts\list-available-assistants.ps1 -Avatar

# Output as JSON
.\scripts\list-available-assistants.ps1 -Json
```

## Method 4: Using cURL

```bash
# Local development
curl "http://localhost:5001/in3devoneuralai/us-central1/api/assistant/list?useAvatarKey=true"

# Production
curl "https://us-central1-in3devoneuralai.cloudfunctions.net/api/assistant/list?useAvatarKey=true"
```

## Method 5: Check in the UI

The dropdown menus in the Avatar Config section automatically filter to show only available combinations:

1. Open the main page
2. Look at the **Avatar Config** section
3. The dropdowns will only show:
   - **Curriculum**: Only curriculums that have assistants
   - **Class**: Only classes available for the selected curriculum
   - **Subject**: Only subjects available for the selected curriculum and class

## Understanding the Response

The API returns an array of objects like this:

```json
{
  "assistants": [
    {
      "curriculum": "NCERT",
      "class": "10",
      "subject": "Mathematics"
    },
    {
      "curriculum": "NCERT",
      "class": "10",
      "subject": "Science"
    },
    {
      "curriculum": "CBSE",
      "class": "5",
      "subject": "Social Studies"
    }
  ]
}
```

## Assistant Naming Convention

For assistants to be detected, they must be named in this exact format:

```
{Curriculum} {Class} {Subject} Teacher
```

**Examples:**
- ✅ `NCERT 10 Mathematics Teacher`
- ✅ `CBSE 5 Social Studies Teacher`
- ✅ `ICSE 12 Physics Teacher`
- ❌ `Math Teacher` (missing curriculum and class)
- ❌ `NCERT Class 10 Math` (wrong format)

## Troubleshooting

### No assistants found?

1. **Check OpenAI Dashboard**: Go to https://platform.openai.com/assistants and verify assistants exist
2. **Check naming**: Ensure assistants follow the naming convention above
3. **Check API Key**: Verify `OPENAI_AVATAR_API_KEY` or `OPENAI_API_KEY` is set correctly
4. **Check server logs**: Look for errors in the server console

### Getting errors?

- **401 Unauthorized**: API key is invalid or missing
- **500 Internal Server Error**: Check server logs for details
- **Network Error**: Verify the API endpoint URL is correct

## Creating New Assistants

Assistants are automatically created when you:
1. Select a curriculum, class, and subject in the UI
2. Start a conversation with the avatar

The assistant will be created with the name: `{Curriculum} {Class} {Subject} Teacher`

