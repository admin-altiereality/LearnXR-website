# Teacher Avatar with OpenAI Assistant & Lip Sync Setup Guide

## Overview

This guide explains how to set up and use the OpenAI Assistant-powered Teacher Avatar with lip sync for LearnXR.

## Features

- **OpenAI Assistant Integration**: Conversational AI teacher powered by GPT-4o-mini
- **Text-to-Speech**: Natural voice synthesis using OpenAI TTS API
- **Lip Sync**: Real-time viseme-based lip synchronization
- **3D Avatar Rendering**: React Three Fiber-based 3D avatar display
- **Educational Focus**: Optimized for K12 NCERT curriculum

## Prerequisites

1. **OpenAI API Key**: Required for Assistant API and TTS
   - Set `OPENAI_API_KEY` in your `.env` file
   - Get your key from: https://platform.openai.com/api-keys

2. **3D Avatar Model**: GLB/GLTF format with viseme blend shapes
   - Place in `server/client/public/models/teacher-avatar.glb`
   - Model should include morph targets for visemes (see Viseme Blend Shapes below)

## Setup Instructions

### 1. Environment Configuration

Add to `server/.env`:
```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 2. Install Dependencies

Dependencies are already included in `package.json`:
- `openai`: ^4.20.0 (already installed)
- `@react-three/fiber`: ^8.15.0 (already installed)
- `@react-three/drei`: ^9.88.0 (already installed)
- `three`: ^0.159.0 (already installed)

### 3. Directory Structure

Ensure these directories exist:
```
server/
  public/
    audio/          # Generated TTS audio files
  src/
    services/
      openaiAssistantService.ts
      textToSpeechService.ts
      lipSyncService.ts
    routes/
      assistant.ts
client/
  src/
    Components/
      TeacherAvatar.tsx
      LearnXRLessonScene.tsx
    services/
      lipSyncService.ts
  public/
    models/         # Place your avatar model here
```

## API Endpoints

### Create Thread
```http
POST /api/assistant/create-thread
Response: { threadId: string }
```

### Send Message
```http
POST /api/assistant/message
Body: { threadId: string, message: string }
Response: { response: string }
```

### Generate TTS
```http
POST /api/assistant/tts/generate
Body: { text: string, voice?: 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer' }
Response: { audioUrl: string }
```

### Generate Visemes
```http
POST /api/assistant/lipsync/generate
Body: { text: string }
Response: { visemes: VisemeFrame[] }
```

## Usage Examples

### Basic Teacher Avatar Component

```tsx
import { TeacherAvatar } from './Components/TeacherAvatar';

function MyComponent() {
  const avatarRef = useRef<{ sendMessage: (msg: string) => Promise<void> }>(null);

  const askQuestion = async () => {
    if (avatarRef.current) {
      await avatarRef.current.sendMessage("What is photosynthesis?");
    }
  };

  return (
    <div>
      <TeacherAvatar
        ref={avatarRef}
        avatarModelUrl="/models/teacher-avatar.glb"
        onMessage={(msg) => console.log('Student asked:', msg)}
        onResponse={(resp) => console.log('Teacher said:', resp)}
      />
      <button onClick={askQuestion}>Ask Question</button>
    </div>
  );
}
```

### LearnXR Lesson Scene

```tsx
import { LearnXRLessonScene } from './Components/LearnXRLessonScene';

function LessonPage() {
  const lessonContent = {
    title: "Photosynthesis",
    chapter: "Chapter 6: Life Processes",
    subtopic: "Photosynthesis in Plants",
    content: "Photosynthesis is the process by which plants convert light energy into chemical energy..."
  };

  return (
    <LearnXRLessonScene
      lessonContent={lessonContent}
      avatarModelUrl="/models/teacher-avatar.glb"
      onLessonComplete={() => console.log('Lesson completed!')}
    />
  );
}
```

## Viseme Blend Shapes

The avatar model should include morph targets (blend shapes) for these visemes:

| Viseme | Blend Shape Name | Description |
|--------|-----------------|-------------|
| 0 | `viseme_sil` | Silence (closed mouth) |
| 1 | `viseme_aa` | "ah" sound |
| 2 | `viseme_E` | "eh" sound |
| 3 | `viseme_I` | "ee" sound |
| 4 | `viseme_O` | "oh" sound |
| 5 | `viseme_U` | "oo" sound |
| 6 | `viseme_FV` | "f", "v" sounds |
| 7 | `viseme_MBP` | "m", "b", "p" sounds |
| 8 | `viseme_TH` | "th" sound |
| 9 | `viseme_TD` | "t", "d" sounds |
| 10 | `viseme_KG` | "k", "g" sounds |
| 11 | `viseme_CHSH` | "ch", "sh" sounds |
| 12 | `viseme_NNG` | "n", "ng" sounds |
| 13 | `viseme_L` | "l" sound |
| 14 | `viseme_R` | "r" sound |
| 15 | `viseme_SZ` | "s", "z" sounds |

**Note**: The component will try common naming variations if exact names don't match.

## Avatar Model Requirements

1. **Format**: GLB or GLTF
2. **Blend Shapes**: Must include viseme morph targets
3. **Animations**: Optional idle animation (named "idle")
4. **Polygon Count**: Recommended < 10k triangles for VR
5. **Textures**: Optimized for real-time rendering

### Recommended Avatar Sources

- **Ready Player Me**: https://readyplayer.me (supports visemes)
- **VRoid Studio**: https://vroid.com/studio (anime-style avatars)
- **Custom Models**: Use Blender with ARKit blend shapes

## Customization

### Assistant Instructions

Modify the assistant instructions in `server/src/services/openaiAssistantService.ts`:

```typescript
instructions: `You are a friendly K12 teacher...
  // Customize the teaching style here
`
```

### Voice Selection

Change the TTS voice in `TeacherAvatar.tsx`:

```typescript
body: JSON.stringify({ text: assistantText, voice: 'nova' })
// Options: 'nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'
```

### Lip Sync Accuracy

For better lip sync, integrate a phoneme recognition library:

```typescript
// In lipSyncService.ts, replace wordToPhonemes with:
import { getPhonemes } from 'phoneme-recognition-library';
```

## Troubleshooting

### Avatar Not Loading
- Check model path: `/models/teacher-avatar.glb`
- Verify GLB/GLTF format
- Check browser console for errors

### Lip Sync Not Working
- Verify model has morph targets
- Check blend shape names match expected format
- Inspect `faceMesh.morphTargetDictionary` in console

### Audio Not Playing
- Check audio file generation in `server/public/audio/`
- Verify CORS settings for audio files
- Check browser autoplay policies

### Assistant Not Responding
- Verify `OPENAI_API_KEY` is set
- Check API rate limits
- Review server logs for errors

## Performance Optimization

1. **Audio Caching**: TTS files are cached in `server/public/audio/`
2. **Model Optimization**: Use compressed GLB with Draco compression
3. **LOD System**: Implement Level of Detail for distant viewing
4. **Texture Compression**: Use KTX2 or Basis Universal

## Meta Quest Optimization

For Meta Quest deployment:

1. **Use OVR Lip Sync SDK**: Replace viseme system with OVR Lip Sync
2. **Reduce Polygon Count**: Target < 5k triangles
3. **Texture Compression**: Use ASTC or ETC2
4. **Audio Format**: Use OGG Vorbis for better compression

## Next Steps

1. Add your 3D avatar model to `server/client/public/models/`
2. Test the component with a simple question
3. Integrate into your lesson scenes
4. Customize assistant instructions for your curriculum
5. Optimize for Meta Quest if deploying to VR

## Support

For issues or questions:
- Check server logs: `server/src/routes/assistant.ts`
- Review browser console for frontend errors
- Verify OpenAI API key and quotas

