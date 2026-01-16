# Curriculum Generation Integration Guide

## Current Behavior (Before Integration)

When you generate a skybox with avatar config selected:

1. **Avatar Config is Selected**: User selects curriculum, class, and subject
2. **Generation Happens**: User generates skybox/3D assets
3. **Skybox is Saved**: Skybox is saved to `skyboxes` collection with:
   - `userId` - User who generated it
   - `promptUsed` - The prompt used
   - `title` - Generated title
   - `imageUrl` - Skybox image URL
   - `style_id` - Style used
   - `variations` - All variations
   - **BUT**: Curriculum/class/subject info is NOT currently saved

## What Happens Now (After Schema Creation)

**Current State**: The new curriculum schema exists, but it's **not automatically integrated** with the generation flow yet.

### What Works:
- ✅ Skybox generation still works normally
- ✅ Skyboxes are saved to `skyboxes` collection
- ✅ Avatar config (curriculum/class/subject) is available in state
- ✅ New `curriculum_chapters` collection structure is ready

### What's Missing:
- ❌ Skybox documents don't include curriculum/class/subject metadata
- ❌ No automatic linking to curriculum chapters
- ❌ No way to query skyboxes by curriculum/class/subject

## Integration Options

### Option 1: Add Curriculum Metadata to Skyboxes (Recommended)

**What it does**: Adds curriculum/class/subject to skybox documents for easy querying.

**Implementation**:
```typescript
// In MainSection.jsx, when saving skybox:
const skyboxData = {
  userId: user.uid,
  promptUsed: prompt,
  title: variationResults[0].title,
  imageUrl: variationResults[0].image,
  style_id: selectedSkybox.id,
  // ADD THESE:
  curriculum: avatarConfig.curriculum || null,
  class: avatarConfig.class || null,
  subject: avatarConfig.subject || null,
  // ... rest of fields
};
```

**Benefits**:
- Easy to query: "Show all skyboxes for CBSE Class 8 Science"
- Backward compatible (fields are optional)
- No breaking changes

### Option 2: Link to Curriculum Chapters

**What it does**: When generating, optionally link to a specific chapter/topic.

**Implementation**:
1. User selects chapter/topic from curriculum
2. Generate skybox
3. Save skybox ID to the topic's `skybox_id` or `skybox_ids` field

**Benefits**:
- Organized by curriculum structure
- Can track which topics have generated content
- Supports the curriculum schema fully

### Option 3: Hybrid Approach (Best)

**What it does**: Combine both - save metadata AND optionally link to chapters.

**Implementation**:
1. Always save curriculum/class/subject metadata to skybox
2. If user selects a specific chapter/topic, also link it there

## Recommended Implementation

### Step 1: Add Metadata to Skybox Documents

Modify the skybox save logic in `MainSection.jsx`:

```typescript
const skyboxData = {
  userId: user.uid,
  promptUsed: prompt,
  title: variationResults[0].title,
  imageUrl: variationResults[0].image,
  style_id: selectedSkybox.id,
  style_name: selectedSkybox.name || selectedSkybox.title || null,
  negative_prompt: negativeText || '',
  status: 'completed',
  variations: variationsArray,
  generationIds: variations.map(id => id.toString()),
  
  // NEW: Add curriculum metadata if available
  ...(avatarConfig.curriculum && avatarConfig.class && avatarConfig.subject ? {
    curriculum: avatarConfig.curriculum,
    class: parseInt(avatarConfig.class) || null,
    subject: avatarConfig.subject,
  } : {}),
  
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
};
```

### Step 2: Update Firestore Indexes

Add index for querying by curriculum:

```json
{
  "collectionGroup": "skyboxes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "curriculum", "order": "ASCENDING" },
    { "fieldPath": "class", "order": "ASCENDING" },
    { "fieldPath": "subject", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Step 3: Optional - Link to Curriculum Chapters

If you want to link generated skyboxes to specific topics:

```typescript
// After skybox is generated and saved:
if (avatarConfig.curriculum && avatarConfig.class && avatarConfig.subject) {
  // Optionally: Let user select chapter/topic, then:
  const curriculumService = createCurriculumService(db);
  await curriculumService.updateTopicSkybox(
    chapterDocumentId,
    topicId,
    generationId // skybox ID
  );
}
```

## Query Examples

### Query skyboxes by curriculum:
```typescript
const skyboxesQuery = query(
  collection(db, 'skyboxes'),
  where('curriculum', '==', 'CBSE'),
  where('class', '==', 8),
  where('subject', '==', 'Science')
);
```

### Query skyboxes for a specific topic:
```typescript
// Get chapter
const chapter = await curriculumService.getChapter('CBSE', 8, 'Science', 3);
const topic = chapter.topics.find(t => t.topic_id === topicId);

// Get skybox
if (topic.skybox_id) {
  const skybox = await getDoc(doc(db, 'skyboxes', topic.skybox_id));
}
```

## Migration Path

1. **Phase 1** (Now): Add curriculum metadata to new skybox generations
2. **Phase 2** (Later): Add UI to select chapter/topic before generation
3. **Phase 3** (Future): Auto-link to curriculum chapters based on prompt analysis

## Current Status

- ✅ Curriculum schema is ready
- ✅ Skybox generation works
- ⚠️ Integration not yet implemented
- 📝 Need to add metadata saving to generation flow

## Next Steps

1. **Immediate**: Add curriculum metadata to skybox documents (Option 1)
2. **Short-term**: Add Firestore index for curriculum queries
3. **Medium-term**: Add UI for chapter/topic selection
4. **Long-term**: Auto-link to curriculum based on content analysis
