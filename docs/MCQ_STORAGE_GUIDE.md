# MCQ Storage in Firestore - Implementation Guide

## Overview

The n8n workflow and Firebase function have been updated to **preserve and store all MCQ fields** along with the generated skyboxes and 3D assets.

## MCQ Fields Preserved

All MCQ fields from your schema are automatically preserved and stored in Firestore:

### For Each Topic:
- `mcq1_question_id`
- `mcq1_question`
- `mcq1_correct_option_index`
- `mcq1_correct_option_text`
- `mcq1_explanation`
- `mcq1_option1`
- `mcq1_option2`
- `mcq1_option3`
- `mcq1_option4`

- `mcq2_question_id`
- `mcq2_question`
- `mcq2_correct_option_index`
- `mcq2_correct_option_text`
- `mcq2_explanation`
- `mcq2_option1`
- `mcq2_option2`
- `mcq2_option3`
- `mcq2_option4`

- `mcq3_question_id` through `mcq3_option4`
- `mcq4_question_id` through `mcq4_option4`
- `mcq5_question_id` through `mcq5_option4`

## How It Works

### 1. Code Node Output

Your code node should output topics with all MCQ fields:

```javascript
return [
  {
    json: {
      curriculum: "CBSE",
      class: 7,
      subject: "Science",
      chapter_number: 1,
      chapter_name: "The Ever-Evolving World of Science",
      topic_id: "introduction_to_science_and_curiosity",
      topic_name: "Introduction to Science and Curiosity",
      in3d_prompt: "A teacher standing in a classroom...",
      asset_list: ["globe", "microscope"],
      // All MCQ fields
      mcq1_question_id: "mcq_1_introduction_to_science_and_curiosity",
      mcq1_question: "What is science primarily described as?",
      mcq1_correct_option_index: 1,
      mcq1_correct_option_text: "A process of asking questions and exploring",
      mcq1_explanation: "Science is described as a process...",
      mcq1_option1: "A process of asking questions and exploring",
      mcq1_option2: "A collection of facts to memorize",
      mcq1_option3: "A subject only about plants and animals",
      mcq1_option4: "Only about experiments in a laboratory",
      // ... mcq2, mcq3, mcq4, mcq5
    }
  }
];
```

### 2. Workflow Processing

The n8n workflow preserves MCQ fields through all processing steps:

1. **Split Topics (Code)** - Preserves `full_topic` with all MCQs
2. **Merge Skybox Data (Code)** - Merges skybox data while preserving all MCQ fields
3. **Split Asset List (Code)** - Preserves `full_topic` with all MCQs for each asset
4. **Merge Asset Data (Code)** - Preserves topic data including MCQs
5. **Group by Topic (Code)** - Groups assets while preserving all original fields including MCQs

### 3. Firebase Storage

The Firebase function uses the spread operator (`...topic`) to preserve **all fields** including MCQs:

```typescript
topics: topics.map((topic: any) => {
  return {
    ...topic, // Preserves ALL fields including MCQs
    skybox_id: topic.skybox_id || null,
    skybox_url: topic.skybox_url || null,
    asset_ids: [...],
    asset_urls: [...],
    // All MCQ fields are automatically included via ...topic
  };
})
```

## Firestore Document Structure

After processing, your Firestore document will look like:

```json
{
  "curriculum": "CBSE",
  "class": 7,
  "subject": "Science",
  "chapter_number": 1,
  "chapter_name": "The Ever-Evolving World of Science",
  "topics": [
    {
      "topic_id": "introduction_to_science_and_curiosity",
      "topic_name": "Introduction to Science and Curiosity",
      "in3d_prompt": "...",
      "asset_list": ["globe", "microscope"],
      "skybox_id": "skybox_123",
      "skybox_url": "https://...",
      "asset_ids": ["asset_456", "asset_789"],
      "asset_urls": ["https://...", "https://..."],
      "status": "generated",
      
      // All MCQ fields are preserved:
      "mcq1_question_id": "mcq_1_introduction_to_science_and_curiosity",
      "mcq1_question": "What is science primarily described as?",
      "mcq1_correct_option_index": 1,
      "mcq1_correct_option_text": "A process of asking questions and exploring",
      "mcq1_explanation": "Science is described as a process...",
      "mcq1_option1": "A process of asking questions and exploring",
      "mcq1_option2": "A collection of facts to memorize",
      "mcq1_option3": "A subject only about plants and animals",
      "mcq1_option4": "Only about experiments in a laboratory",
      
      "mcq2_question_id": "...",
      "mcq2_question": "...",
      // ... all mcq2 fields
      
      "mcq3_question_id": "...",
      // ... all mcq3 fields
      
      "mcq4_question_id": "...",
      // ... all mcq4 fields
      
      "mcq5_question_id": "...",
      // ... all mcq5 fields
      
      // ... other topic fields
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## Verification

### Check in Firebase Console

1. Go to Firebase Console → Firestore Database
2. Open `curriculum_chapters` collection
3. Open your document (e.g., `CBSE_7_Science_ch1`)
4. Expand a topic
5. Verify all MCQ fields are present:
   - `mcq1_question`, `mcq1_option1`, etc.
   - `mcq2_question`, `mcq2_option1`, etc.
   - `mcq3_*`, `mcq4_*`, `mcq5_*`

### Check in n8n Execution Logs

1. Open n8n workflow execution
2. Click on "Group by Topic (Code)" node
3. View output JSON
4. Verify `topics` array contains all MCQ fields

### Check Firebase Function Logs

The function logs MCQ fields detection:

```bash
firebase functions:log
```

Look for:
```
✅ MCQ fields detected: 45 fields (e.g., mcq1_question, mcq1_option1, mcq2_question)
```

## Troubleshooting

### Issue: MCQs Not Appearing in Firestore

**Check:**
1. Are MCQ fields in your code node output?
2. Are MCQ fields in the webhook request body?
3. Check "Group by Topic (Code)" node output in n8n

**Solution:**
- Verify your code node includes all MCQ fields
- Check n8n execution logs to see data at each step
- Ensure `full_topic` contains all MCQ fields

### Issue: Some MCQ Fields Missing

**Check:**
- Are all MCQ fields in the original schema?
- Are field names correct (mcq1_*, mcq2_*, etc.)?

**Solution:**
- Verify schema includes all MCQ fields
- Check field names match expected format

## Summary

✅ **All MCQ fields are automatically preserved** through the entire workflow  
✅ **MCQ fields are stored in Firestore** along with skybox and asset data  
✅ **No additional configuration needed** - just include MCQs in your schema  
✅ **MCQ fields are accessible** in the same document as topics  

The implementation uses JavaScript spread operators (`...topic`, `...fullTopicData`) to preserve all fields automatically, so any MCQ fields you include in your schema will be stored in Firestore.
