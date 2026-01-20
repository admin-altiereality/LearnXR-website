# Curriculum Schema Implementation Summary

## Overview

A complete Firebase schema structure has been implemented for managing curriculum, class, subject, and chapter data. The schema maintains compatibility with existing `skyboxes` and `3d_assets` collections while providing a structured way to organize educational content.

## What Was Created

### 1. TypeScript Interfaces (`server/client/src/types/firebase.ts`)

Added two new interfaces:
- **`CurriculumChapter`**: Main document structure for chapters
- **`Topic`**: Structure for topics within chapters

### 2. Firestore Rules (`firestore.rules`)

Added rules for the `curriculum_chapters` collection:
- **Read**: All authenticated users can read curriculum chapters
- **Write**: Only admins can create, update, or delete curriculum chapters

### 3. Firestore Indexes (`firestore.indexes.json`)

Added composite indexes for efficient querying:
- `curriculum` + `class` + `subject` + `chapter_number` (specific chapter queries)
- `curriculum` + `class` + `subject` (all chapters in a subject)

### 4. Utility Functions (`server/client/src/utils/curriculumUtils.ts`)

Helper functions for:
- Generating deterministic document IDs
- Parsing document IDs
- Creating chapter objects
- Validating chapter structure

### 5. Service Layer (`server/client/src/services/curriculumService.ts`)

Complete service class for:
- Getting chapters by ID or filters
- Saving/updating chapters
- Managing skybox references
- Managing 3D asset references

### 6. Documentation

- **`docs/CURRICULUM_SCHEMA_GUIDE.md`**: Complete schema documentation
- **`docs/CURRICULUM_SCHEMA_EXAMPLE.ts`**: Usage examples

## Schema Structure

### Document ID Format
```
{curriculum}_{class}_{subject}_ch{chapter_number}
```
Example: `CBSE_8_Science_ch3`

### Document Structure
```json
{
  "curriculum": "CBSE | RBSE",
  "class": 8,
  "subject": "Science",
  "chapter_number": 3,
  "chapter_name": "Synthetic Fibres and Plastics",
  "topics": [
    {
      "topic_id": "auto_generated_uuid",
      "topic_name": "Structure of Synthetic Fibres",
      "topic_priority": 1,
      "learning_objective": "...",
      "scene_type": "mixed",
      "in3d_prompt": "...",
      "asset_list": ["polymer chains", "fiber strands"],
      "camera_guidance": "...",
      "skybox_id": "optional_reference",
      "skybox_ids": ["optional_array"],
      "asset_ids": ["optional_array"],
      "status": "pending | generated | failed",
      "generatedAt": "ISO_timestamp"
    }
  ],
  "createdAt": "ISO_timestamp",
  "updatedAt": "ISO_timestamp"
}
```

## Key Features

### 1. Skybox Integration
- Topics can reference skyboxes via `skybox_id` (single) or `skybox_ids` (multiple)
- Skybox documents remain in the existing `skyboxes` collection
- No changes needed to existing skybox structure

### 2. 3D Asset Integration
- Topics can reference 3D assets via `asset_ids` array
- Asset documents remain in the existing `3d_assets` collection
- No changes needed to existing asset structure

### 3. Deterministic Document IDs
- Document IDs are generated deterministically based on curriculum, class, subject, and chapter number
- Ensures consistent document IDs across environments
- Makes it easy to reference chapters programmatically

### 4. Validation
- Built-in validation ensures data integrity
- Validates required fields, data types, and constraints
- Returns detailed error messages for debugging

## Usage Example

```typescript
import { createCurriculumService } from './services/curriculumService';
import { db } from './firebase';

const curriculumService = createCurriculumService(db);

// Save a chapter
const documentId = await curriculumService.saveChapter(
  'CBSE',
  8,
  'Science',
  3,
  'Synthetic Fibres and Plastics',
  [
    {
      topic_name: 'Structure of Synthetic Fibres',
      topic_priority: 1,
      learning_objective: 'Understand how polymer chains form...',
      scene_type: 'mixed',
      in3d_prompt: 'A cutaway 3D visualization...',
      asset_list: ['polymer chains', 'fiber strands'],
      camera_guidance: 'Start with close-up...',
    },
  ]
);

// Get a chapter
const chapter = await curriculumService.getChapter('CBSE', 8, 'Science', 3);

// Update topic with skybox
await curriculumService.updateTopicSkybox(documentId, topicId, skyboxId);
```

## Next Steps

1. **Deploy Firestore Rules**: Deploy the updated `firestore.rules` to Firebase
2. **Deploy Indexes**: Deploy the updated `firestore.indexes.json` to Firebase
3. **Test the Schema**: Create a test chapter and verify it works
4. **Migrate Existing Data**: If you have existing curriculum data, migrate it to the new schema
5. **Integrate with UI**: Update your UI to use the new `CurriculumService`

## Important Notes

- **Skyboxes Collection**: Remains unchanged - topics reference skyboxes by ID
- **3D Assets Collection**: Remains unchanged - topics reference assets by ID
- **Document IDs**: Are deterministic and follow the pattern `{curriculum}_{class}_{subject}_ch{chapter_number}`
- **Topic IDs**: Should be UUIDs (auto-generated or provided)
- **Validation**: Always validate before saving to ensure data integrity

## Files Modified/Created

### Modified
- `server/client/src/types/firebase.ts` - Added interfaces
- `firestore.rules` - Added rules for curriculum_chapters
- `firestore.indexes.json` - Added indexes for queries

### Created
- `server/client/src/utils/curriculumUtils.ts` - Utility functions
- `server/client/src/services/curriculumService.ts` - Service layer
- `docs/CURRICULUM_SCHEMA_GUIDE.md` - Documentation
- `docs/CURRICULUM_SCHEMA_EXAMPLE.ts` - Usage examples
- `CURRICULUM_SCHEMA_IMPLEMENTATION.md` - This file

## Testing

To test the implementation:

1. Import the service in your code
2. Create a test chapter using `saveChapter()`
3. Query it back using `getChapter()`
4. Update a topic with a skybox reference
5. Verify the data structure in Firebase Console

## Support

For questions or issues:
1. Check `docs/CURRICULUM_SCHEMA_GUIDE.md` for detailed documentation
2. Review `docs/CURRICULUM_SCHEMA_EXAMPLE.ts` for usage examples
3. Check Firestore rules and indexes are deployed correctly
