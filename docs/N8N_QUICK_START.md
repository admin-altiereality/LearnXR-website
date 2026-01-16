# n8n Curriculum Processing - Quick Start Guide

## What Happens After Your Code Node Outputs the Schema

### Step-by-Step Process

1. **Send Schema to Webhook**
   - Your code node outputs an array of topics
   - Send POST request to: `https://your-n8n-instance.com/webhook/process-curriculum`
   - Body: The array of topics (JSON)

2. **Workflow Automatically:**
   - ✅ Splits topics into individual items
   - ✅ Generates skybox for each topic (using `in3d_prompt`)
   - ✅ Waits for skybox generation to complete
   - ✅ Splits `asset_list` into individual assets
   - ✅ Generates 3D asset for each item in `asset_list`
   - ✅ Waits for each asset generation to complete
   - ✅ Groups all assets back to their topics
   - ✅ Saves everything to Firebase
   - ✅ Returns success response

3. **Result:**
   - Data saved in Firebase: `curriculum_chapters/{curriculum}_{class}_{subject}_ch{chapter_number}`
   - Each topic has:
     - `skybox_id` and `skybox_url`
     - `asset_ids` and `asset_urls` arrays

## Quick Setup Checklist

- [ ] Deploy Firebase function: `firebase deploy --only functions`
- [ ] Import workflow: `workflows/n8n-curriculum-processing-workflow.json`
- [ ] Create credential: HTTP Header Auth with `X-In3d-Key`
- [ ] Set environment variable: `IN3D_API_KEY`
- [ ] Activate workflow
- [ ] Copy webhook URL
- [ ] Test with sample data

## Input Format

```json
[
  {
    "curriculum": "CBSE",
    "class": 7,
    "subject": "Science",
    "chapter_number": 1,
    "chapter_name": "Chapter Name",
    "topic_id": "topic_1",
    "topic_name": "Topic Name",
    "in3d_prompt": "A classroom scene...",
    "asset_list": ["globe", "microscope"]
  }
]
```

## Output Format

```json
{
  "success": true,
  "data": {
    "documentId": "CBSE_7_Science_ch1",
    "topics_count": 1
  }
}
```

## See Full Guide

For detailed instructions, see: `docs/N8N_CURRICULUM_PROCESSING_GUIDE.md`
