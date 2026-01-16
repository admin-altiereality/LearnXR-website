# Curriculum Schema Guide

This document describes the Firebase schema structure for curriculum, class, subject, and chapter data.

## Overview

The curriculum data is stored in the `curriculum_chapters` collection in Firestore. Each document represents a chapter within a specific curriculum, class, and subject combination.

## Collection Structure

**Collection Name:** `curriculum_chapters`

**Document ID Format:** `{curriculum}_{class}_{subject}_ch{chapter_number}`

**Example:** `CBSE_8_Science_ch3`

## Document Schema

```typescript
{
  "curriculum": "CBSE | RBSE",  // Required: Curriculum name (uppercase)
  "class": 8,                    // Required: Class number (1-12)
  "subject": "Science",          // Required: Subject name
  "chapter_number": 3,           // Required: Chapter number (positive integer)
  "chapter_name": "Synthetic Fibres and Plastics",  // Required: Chapter display name
  "topics": [                    // Required: Array of topics (at least 1)
    {
      "topic_id": "auto_generated_uuid",  // Auto-generated unique ID
      "topic_name": "Structure of Synthetic Fibres",  // Required: Topic name
      "topic_priority": 1,                // Required: Priority order (1-15)
      "learning_objective": "Understand how polymer chains form...",  // Required
      "scene_type": "mixed",             // Required: "mesh" | "skybox" | "mixed"
      "in3d_prompt": "A cutaway 3D visualization...",  // Required: Detailed prompt
      "asset_list": ["polymer chains", "fiber strands"],  // Required: Array of asset names
      "camera_guidance": "Start with close-up...",      // Required: Camera instructions
      "skybox_id": "optional_skybox_reference",         // Optional: Reference to skyboxes collection
      "skybox_ids": ["skybox1", "skybox2"],             // Optional: Multiple skybox references
      "asset_ids": ["asset1", "asset2"],                // Optional: References to 3d_assets collection
      "status": "pending" | "generated" | "failed",    // Optional: Generation status
      "generatedAt": "2024-01-10T00:00:00Z"            // Optional: ISO timestamp
    }
  ],
  "createdAt": "2024-01-10T00:00:00Z",  // Optional: ISO timestamp
  "updatedAt": "2024-01-10T00:00:00Z"   // Optional: ISO timestamp
}
```

## Skybox Integration

The schema maintains compatibility with the existing `skyboxes` collection:

- **skybox_id**: Single reference to a skybox document ID (from `skyboxes` collection)
- **skybox_ids**: Array of skybox document IDs (for multiple variations)
- When a skybox is generated for a topic, store its ID in `skybox_id` or add to `skybox_ids`
- The skybox document structure remains unchanged in the `skyboxes` collection

## Example Document

```json
{
  "curriculum": "CBSE",
  "class": 8,
  "subject": "Science",
  "chapter_number": 3,
  "chapter_name": "Synthetic Fibres and Plastics",
  "topics": [
    {
      "topic_id": "550e8400-e29b-41d4-a716-446655440000",
      "topic_name": "Structure of Synthetic Fibres",
      "topic_priority": 1,
      "learning_objective": "Understand how polymer chains form synthetic fibres and how their structure affects strength and flexibility.",
      "scene_type": "mixed",
      "in3d_prompt": "A cutaway 3D visualization showing long polymer chains arranged in parallel strands, zoomed-in molecular structures transitioning into visible fibre threads, neutral background, clear spacing between chains, soft studio lighting, camera switching from macro to mid-range view.",
      "asset_list": ["polymer chains", "fiber strands", "molecular nodes"],
      "camera_guidance": "Start with close-up molecular view, slowly zoom out to show fibre formation",
      "skybox_id": "1234567890",
      "status": "generated",
      "generatedAt": "2024-01-10T12:00:00Z"
    }
  ],
  "createdAt": "2024-01-10T10:00:00Z",
  "updatedAt": "2024-01-10T12:00:00Z"
}
```

## Document ID Generation

Use the utility function to generate deterministic document IDs:

```typescript
import { generateChapterDocumentId } from '../utils/curriculumUtils';

const docId = generateChapterDocumentId('CBSE', 8, 'Science', 3);
// Returns: "CBSE_8_Science_ch3"
```

## Querying

### Query by Curriculum, Class, and Subject

```typescript
import { collection, query, where } from 'firebase/firestore';

const chaptersQuery = query(
  collection(db, 'curriculum_chapters'),
  where('curriculum', '==', 'CBSE'),
  where('class', '==', 8),
  where('subject', '==', 'Science')
);
```

### Query by Chapter Number

```typescript
const chapterQuery = query(
  collection(db, 'curriculum_chapters'),
  where('curriculum', '==', 'CBSE'),
  where('class', '==', 8),
  where('subject', '==', 'Science'),
  where('chapter_number', '==', 3)
);
```

## Firestore Rules

- **Read**: All authenticated users can read curriculum chapters
- **Write**: Only admins can create, update, or delete curriculum chapters

## Indexes

The following composite indexes are configured in `firestore.indexes.json`:

1. `curriculum` + `class` + `subject` + `chapter_number` (for specific chapter queries)
2. `curriculum` + `class` + `subject` (for all chapters in a subject)

## Validation

Use the validation utility before saving:

```typescript
import { validateCurriculumChapter } from '../utils/curriculumUtils';

const validation = validateCurriculumChapter(chapterData);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}
```

## Best Practices

1. **Deterministic IDs**: Always use `generateChapterDocumentId()` to ensure consistent document IDs
2. **Topic IDs**: Generate unique topic IDs (UUIDs recommended) for each topic
3. **Skybox References**: Store skybox IDs after generation to maintain the relationship
4. **Status Tracking**: Use `status` field to track generation progress
5. **Timestamps**: Always include `createdAt` and `updatedAt` timestamps
6. **Validation**: Always validate before saving to Firestore

## Migration from Existing Data

If you have existing curriculum data in a different format:

1. Map existing data to the new schema structure
2. Generate document IDs using `generateChapterDocumentId()`
3. Ensure all required fields are present
4. Validate using `validateCurriculumChapter()`
5. Batch write to Firestore

## Related Collections

- **skyboxes**: Contains generated skybox environments (referenced by `skybox_id` or `skybox_ids`)
- **3d_assets**: Contains generated 3D mesh objects (referenced by `asset_ids`)
