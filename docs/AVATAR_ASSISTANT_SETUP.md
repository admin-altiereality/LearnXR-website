# Avatar Assistant Setup Guide

## Overview

The Avatar Assistant uses a separate OpenAI API key to provide curriculum-specific educational assistance. Students can switch between different curricula, classes, and subjects to interact with specialized AI teachers.

## API Key Configuration

### For Local Development (Server)

Add the new API key to your `.env` file in the `server` directory:

```bash
# Avatar Assistant API Key (separate from main OpenAI key)
OPENAI_AVATAR_API_KEY=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
```

If `OPENAI_AVATAR_API_KEY` is not set, it will fall back to `OPENAI_API_KEY`.

### For Production (Firebase Functions)

Set the secret in Firebase:

```bash
firebase functions:secrets:set OPENAI_AVATAR_API_KEY
```

When prompted, paste the API key:
```
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
```

Then redeploy functions:

```bash
firebase deploy --only functions
```

## Features

### Curriculum/Class/Subject Selection

Users can select:
- **Curriculum**: NCERT, CBSE, ICSE, State Board
- **Class**: 1-12
- **Subject**: Mathematics, Science, English, Hindi, Social Studies, Physics, Chemistry, Biology, History, Geography, Computer Science

### Assistant Behavior

Each combination of curriculum/class/subject creates a specialized assistant that:
- Focuses on the specific curriculum content
- Uses age-appropriate language for the selected class
- Provides subject-specific explanations
- Accesses stored curriculum chapters and content

### Side Panel Interface

The Avatar Side Panel includes:
- **Configuration Selectors**: Dropdowns for curriculum, class, and subject
- **3D Avatar Display**: Interactive teacher avatar
- **Chat Interface**: Full conversation history
- **Message Input**: Type and send messages to the teacher

## Usage

1. Click the "Chat" button in the Teacher Avatar section (right side of create page)
2. Select your curriculum, class, and subject
3. Wait for the connection to establish (green indicator)
4. Start chatting with your teacher!

## Technical Details

### Assistant Service

The `OpenAIAssistantService` now supports:
- Multiple assistants cached by curriculum/class/subject combination
- Separate API key for avatar assistant
- Dynamic instruction generation based on selection

### API Endpoints

- `POST /assistant/create-thread` - Creates a new thread with curriculum/class/subject config
- `POST /assistant/message` - Sends a message with curriculum/class/subject context

Both endpoints accept:
```json
{
  "curriculum": "NCERT",
  "class": "10",
  "subject": "Mathematics",
  "useAvatarKey": true
}
```

## Troubleshooting

### Assistant Not Responding

1. Check that `OPENAI_AVATAR_API_KEY` is set correctly
2. Verify the API key has sufficient quota
3. Check browser console for error messages
4. Ensure the thread is created successfully (green indicator)

### Wrong Curriculum Content

- Make sure you've selected the correct curriculum, class, and subject
- The assistant uses the stored curriculum content for the selected combination
- Switching selections will create a new thread with the new configuration

### API Key Issues

- Verify the key starts with `sk-proj-`
- Check Firebase Functions logs for authentication errors
- Ensure the secret is properly set in Firebase

