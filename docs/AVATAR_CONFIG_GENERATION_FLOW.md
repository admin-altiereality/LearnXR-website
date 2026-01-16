# Avatar Config Generation Flow - What Happens Now

## Overview

When you generate skyboxes or 3D assets with avatar config (curriculum, class, subject) selected, the system now automatically saves this metadata with your generations.

## Current Flow (After Integration)

### Step 1: User Selects Avatar Config
```
User selects:
- Curriculum: "CBSE"
- Class: "8"
- Subject: "Science"
```

### Step 2: User Generates Content
- User enters a prompt
- Clicks "Generate"
- System generates skybox/3D assets

### Step 3: Content is Saved with Metadata
The skybox document now includes:
```javascript
{
  userId: "user123",
  promptUsed: "A 3D visualization of...",
  title: "Generated Skybox",
  imageUrl: "https://...",
  style_id: 123,
  variations: [...],
  
  // NEW: Curriculum metadata (if avatar config was selected)
  curriculum: "CBSE",
  class: 8,
  subject: "Science",
  
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## What This Enables

### 1. Query by Curriculum
You can now query all skyboxes for a specific curriculum/class/subject:

```typescript
import { collection, query, where } from 'firebase/firestore';

// Get all skyboxes for CBSE Class 8 Science
const skyboxesQuery = query(
  collection(db, 'skyboxes'),
  where('curriculum', '==', 'CBSE'),
  where('class', '==', 8),
  where('subject', '==', 'Science')
);
```

### 2. Filter in UI
- Show only skyboxes for selected curriculum
- Group by class/subject
- Filter history by curriculum

### 3. Link to Curriculum Chapters (Future)
When you create curriculum chapters, you can link generated skyboxes:

```typescript
// After generating skybox
const skyboxId = generationId;

// Link to a topic in curriculum chapter
await curriculumService.updateTopicSkybox(
  'CBSE_8_Science_ch3', // chapter document ID
  'topic-uuid-here',   // topic ID
  skyboxId              // skybox ID
);
```

## Behavior Details

### When Avatar Config is Selected
✅ **Curriculum metadata IS saved** to skybox document
- `curriculum`: "CBSE" | "RBSE" | etc.
- `class`: 8 (number)
- `subject`: "Science"

### When Avatar Config is NOT Selected
✅ **Skybox still saves normally**
- No curriculum fields added
- Backward compatible
- Existing skyboxes unaffected

### Optional Fields
All curriculum fields are **optional**:
- If avatar config is not selected, fields are omitted
- Existing skyboxes without these fields work normally
- No breaking changes

## Example Scenarios

### Scenario 1: Generate with Avatar Config
```
1. Select: CBSE, Class 8, Science
2. Generate: "A 3D model of a cell"
3. Result: Skybox saved with curriculum="CBSE", class=8, subject="Science"
```

### Scenario 2: Generate without Avatar Config
```
1. No selection (or incomplete selection)
2. Generate: "A 3D model of a cell"
3. Result: Skybox saved normally, no curriculum fields
```

### Scenario 3: Query Skyboxes
```
1. User wants to see all CBSE Class 8 Science skyboxes
2. Query: where curriculum="CBSE", class=8, subject="Science"
3. Result: All matching skyboxes returned
```

## Integration with Curriculum Schema

The skybox metadata integrates with the curriculum schema:

```
curriculum_chapters (collection)
  └── CBSE_8_Science_ch3 (document)
      └── topics[]
          └── topic
              └── skybox_id: "skybox123" ← Links to skyboxes collection
              
skyboxes (collection)
  └── skybox123 (document)
      ├── curriculum: "CBSE" ← Metadata for querying
      ├── class: 8
      ├── subject: "Science"
      └── ... other fields
```

## Benefits

1. **Organization**: Skyboxes are tagged with curriculum info
2. **Querying**: Easy to find skyboxes by curriculum/class/subject
3. **Linking**: Can link skyboxes to curriculum chapters/topics
4. **Backward Compatible**: Existing skyboxes still work
5. **Optional**: Works with or without avatar config

## Next Steps

1. ✅ **Done**: Curriculum metadata saved with skyboxes
2. ✅ **Done**: Firestore indexes added for querying
3. 📝 **Future**: Add UI to filter history by curriculum
4. 📝 **Future**: Add UI to link skyboxes to curriculum chapters
5. 📝 **Future**: Auto-suggest curriculum based on prompt content

## Code Changes Made

### 1. Updated Skybox Interface
```typescript
export interface Skybox {
  // ... existing fields
  curriculum?: string;  // NEW
  class?: number;       // NEW
  subject?: string;     // NEW
}
```

### 2. Updated Skybox Save Logic
```typescript
const skyboxData = {
  // ... existing fields
  ...(avatarConfig.curriculum && avatarConfig.class && avatarConfig.subject ? {
    curriculum: avatarConfig.curriculum,
    class: parseInt(avatarConfig.class) || null,
    subject: avatarConfig.subject,
  } : {}),
};
```

### 3. Added Firestore Indexes
- Index for: `curriculum` + `class` + `subject` + `createdAt`
- Index for: `curriculum` + `class` + `createdAt`

## Testing

To test the integration:

1. Select avatar config (curriculum, class, subject)
2. Generate a skybox
3. Check Firestore console - skybox should have curriculum fields
4. Query skyboxes by curriculum - should work

## Troubleshooting

**Q: Skybox doesn't have curriculum fields?**
- Check if avatar config is fully selected (all 3 fields)
- Check browser console for errors
- Verify avatarConfig state is populated

**Q: Can't query by curriculum?**
- Deploy Firestore indexes: `firebase deploy --only firestore:indexes`
- Wait for indexes to build (may take a few minutes)
- Check index status in Firebase Console

**Q: Existing skyboxes affected?**
- No, existing skyboxes are unchanged
- Only new generations include curriculum metadata
- Backward compatible
