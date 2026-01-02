# AI Detection Setup Guide

## Overview

The AI Detection system uses OpenAI's GPT models to intelligently analyze prompts and determine whether they describe:
- **3D Mesh Objects** (cars, statues, furniture, characters, etc.)
- **Skybox Environments** (rooms, landscapes, cityscapes, etc.)
- **Both** (when a prompt contains both elements)

## Setup Instructions

### 1. Install Dependencies

The OpenAI package is already added to `server/package.json`. Install it:

```bash
cd server
npm install
```

### 2. Configure OpenAI API Key

Set the `OPENAI_API_KEY` environment variable:

**For local development:**
```bash
# In server/.env file
OPENAI_API_KEY=sk-your-api-key-here
```

**For production (Firebase Functions):**
```bash
# Set as Firebase Functions secret (required)
firebase functions:secrets:set OPENAI_API_KEY
# Then enter your API key when prompted: sk-proj-YOUR_API_KEY_HERE

# Note: The secret is automatically loaded in functions/src/index.ts
```

**For server deployment:**
Set the environment variable in your hosting platform (Vercel, Railway, etc.)

### 3. Verify Setup

The service will automatically check if the API key is configured on startup:
- ✅ If configured: Uses AI detection
- ⚠️ If not configured: Falls back to rule-based detection

## How It Works

### Hybrid Detection Approach

1. **AI Detection (Primary)**: Uses GPT-4o-mini to analyze the prompt
   - Provides reasoning for the detection
   - Returns confidence scores
   - Suggests what should be generated

2. **Rule-Based Fallback**: If AI is unavailable, uses the existing prompt parser
   - Keyword-based detection
   - Pattern matching
   - Context-aware analysis

### API Endpoint

**POST** `/api/ai-detection/detect`

**Request:**
```json
{
  "prompt": "A futuristic cityscape with flying vehicles"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "promptType": "skybox",
    "meshScore": 0.15,
    "skyboxScore": 0.92,
    "confidence": 0.95,
    "reasoning": "The prompt describes a cityscape environment with vehicles as part of the scene, not standalone objects.",
    "meshDescription": "",
    "skyboxDescription": "A futuristic cityscape with flying vehicles",
    "shouldGenerateMesh": false,
    "shouldGenerateSkybox": true
  },
  "method": "ai"
}
```

## Integration

The AI detection is automatically integrated into:

1. **MainSection.jsx**: Uses AI detection before generation starts
2. **PromptPanel.tsx**: Shows AI analysis in the UI
3. **promptParserService.ts**: Hybrid detection method

## Cost Considerations

- **Model**: GPT-4o-mini (cost-effective)
- **Average cost**: ~$0.0001 per detection
- **Token usage**: ~200-300 tokens per request

To reduce costs:
- Cache results for similar prompts
- Use rule-based fallback for simple cases
- Consider upgrading to GPT-4 for higher accuracy if needed

## Testing

Test the AI detection:

```javascript
// In browser console
import { aiDetectionService } from './services/aiDetectionService';

const result = await aiDetectionService.detectPromptType("A detailed medieval sword");
console.log(result);
```

## Troubleshooting

### AI Detection Not Working

1. **Check API Key**: Verify `OPENAI_API_KEY` is set correctly
2. **Check Logs**: Look for "AI Detection Service initialized" message
3. **Check Network**: Ensure backend can reach OpenAI API
4. **Fallback**: System will automatically use rule-based detection if AI fails

### High Costs

1. **Use GPT-4o-mini**: Already configured (cheapest option)
2. **Implement Caching**: Cache results for similar prompts
3. **Rate Limiting**: Add rate limiting to prevent abuse

## Example Prompts

### Should Detect as Mesh:
- "A detailed medieval fantasy sword"
- "A vintage 1950s red convertible car"
- "An ornate crystal vase"

### Should Detect as Skybox:
- "A futuristic cityscape with flying vehicles"
- "360° panoramic view of a mystical forest"
- "A cozy library room with bookshelves"

### Should Detect as Both:
- "A car parked on a beach at sunset"
- "A statue in an ancient temple courtyard"
- "A chandelier hanging in a grand ballroom"

