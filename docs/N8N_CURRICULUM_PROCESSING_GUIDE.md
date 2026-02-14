# n8n Curriculum Processing Workflow - Step-by-Step Guide

This guide provides detailed step-by-step instructions for setting up and using the n8n workflow to process curriculum schemas, generate skyboxes and 3D assets, and store everything in Firebase.

## Overview

The workflow processes curriculum topic schemas by:
1. **Extracting** `in3d_prompt` for skybox generation
2. **Extracting** `asset_list` for 3D asset generation  
3. **Generating** skyboxes using the In3D API
4. **Generating** 3D assets using the Meshy API
5. **Storing** all data in Firebase Firestore

## Prerequisites

1. **n8n Instance**: Self-hosted or n8n.cloud account
2. **API Keys**:
   - In3D API Key (for skybox and asset generation)
   - Access to Firebase Functions API
3. **Firebase Project**: Configured with Firestore enabled
4. **Environment Variables**: Set up in n8n
   - `IN3D_API_KEY`: Your In3D API key
   - `SKYBOX_STYLE_ID`: (Optional) Skybox style ID (defaults to `3` for M3 UHD Render)

---

## Step 1: Deploy Firebase Function

Before setting up n8n, deploy the curriculum route to Firebase Functions.

### 1.1 Verify Files

Ensure these files exist:
- ✅ `functions/src/routes/curriculum.ts` (created)
- ✅ `functions/src/index.ts` (updated with curriculum route)

### 1.2 Deploy

```bash
cd functions
npm install  # If needed
cd ..
firebase deploy --only functions
```

### 1.3 Verify Deployment

Test the endpoint:
```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/curriculum/test-doc-id" \
  -H "X-In3d-Key: your_api_key"
```

---

## Step 2: Import n8n Workflow

### 2.1 Open n8n

1. Log in to your n8n instance
2. Navigate to **Workflows** in the sidebar

### 2.2 Import Workflow

1. Click the **+** button or **Import from File**
2. Select `workflows/n8n-curriculum-processing-workflow.json`
3. Click **Import**

The workflow will appear in your workflows list.

---

## Step 3: Configure API Key Credential

### 3.1 Create HTTP Header Auth Credential

1. In n8n, go to **Settings** → **Credentials**
2. Click **Add Credential**
3. Search for **HTTP Header Auth**
4. Click **Create**

### 3.2 Configure Credential

Fill in the form:
- **Credential Name**: `In3D API Key`
- **Header Name**: `X-In3d-Key`
- **Header Value**: `your_in3d_api_key_here` (or use `{{ $env.IN3D_API_KEY }}`)

### 3.3 Save Credential

Click **Save** to store the credential.

---

## Step 4: Set Environment Variable

### 4.1 Access Environment Variables

1. In n8n, go to **Settings** → **Environment Variables**
2. Or set via environment variable in your n8n deployment

### 4.2 Add Variable

Add the following:
- **Name**: `IN3D_API_KEY`
- **Value**: Your actual In3D API key

### 4.3 Save

Save the environment variable.

---

## Step 5: Configure Workflow Nodes

### 5.1 Webhook Trigger Node

1. Click on **Webhook Trigger** node
2. Verify settings:
   - **HTTP Method**: `POST`
   - **Path**: `process-curriculum`
3. **Copy the Webhook URL** - you'll need this later
   - Example: `https://your-n8n-instance.com/webhook/process-curriculum`

### 5.2 Code Nodes - Verify Configuration

The Code nodes are pre-configured, but verify:

#### Split Topics (Code)
- Should extract topics array from webhook body
- No changes needed

#### Merge Skybox Data (Code)
- Combines skybox response with topic data
- No changes needed

#### Split Asset List (Code)
- Splits `asset_list` into individual items
- No changes needed

#### Merge Asset Data (Code)
- Combines asset response with topic data
- No changes needed

#### Group by Topic (Code)
- Groups all assets back to their topics
- Prepares data for Firebase
- No changes needed

### 5.3 HTTP Request Nodes

#### Generate Skybox
1. Click on **Generate Skybox** node
2. Verify:
   - **Method**: `POST`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate`
   - **Authentication**: Select your **In3D API Key** credential
   - **Header**: `X-In3d-Key` = `{{ $env.IN3D_API_KEY }}`
   - **Body**:
     - `prompt` = `{{ $json.in3d_prompt }}`
     - `style_id` = `1`

#### Poll Skybox Status
1. Click on **Poll Skybox Status** node
2. Verify:
   - **Method**: `GET`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/status/{{ $('Generate Skybox').item.json.data.generationId }}`
   - **Authentication**: Select your **In3D API Key** credential

#### Generate 3D Asset
1. Click on **Generate 3D Asset** node
2. Verify:
   - **Method**: `POST`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/meshy/generate`
   - **Authentication**: Select your **In3D API Key** credential
   - **Body**:
     - `prompt` = `{{ $json.asset_name }}`
     - `art_style` = `realistic`
     - `ai_model` = `meshy-4`

#### Poll Asset Status
1. Click on **Poll Asset Status** node
2. Verify:
   - **Method**: `GET`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/meshy/status/{{ $('Generate 3D Asset').item.json.data.id }}`
   - **Authentication**: Select your **In3D API Key** credential

#### Save to Firebase
1. Click on **Save to Firebase** node
2. Verify:
   - **Method**: `POST`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/curriculum/save`
   - **Authentication**: Select your **In3D API Key** credential
   - **Body Content Type**: `JSON`
   - **Body**: `{{ JSON.stringify($json) }}`

### 5.4 IF Nodes

#### Is Skybox Processing?
1. Click on **Is Skybox Processing?** node
2. Verify condition:
   - **Value 1**: `{{ $json.data.status }}`
   - **Operation**: `Not Equal`
   - **Value 2**: `completed`

#### Is Asset Processing?
1. Click on **Is Asset Processing?** node
2. Verify condition:
   - **Value 1**: `{{ $json.data.status }}`
   - **Operation**: `Not Equal`
   - **Value 2**: `completed`

### 5.5 Wait Nodes

#### Wait 5s (Skybox)
- **Amount**: `5`
- **Unit**: `seconds`

#### Wait 10s (Asset)
- **Amount**: `10`
- **Unit**: `seconds`

---

## Step 6: Activate Workflow

### 6.1 Activate

1. Click the **Active** toggle in the top-right corner
2. The workflow is now active and listening for webhook requests

### 6.2 Test Webhook

You can test the webhook URL:
```bash
curl -X POST "https://your-n8n-instance.com/webhook/process-curriculum" \
  -H "Content-Type: application/json" \
  -d '[{
    "curriculum": "CBSE",
    "class": 7,
    "subject": "Science",
    "chapter_number": 1,
    "chapter_name": "Test Chapter",
    "topic_id": "test_topic",
    "topic_name": "Test Topic",
    "in3d_prompt": "A simple test classroom",
    "asset_list": ["desk"]
  }]'
```

---

## Step 7: Using the Workflow (After Code Node Output)

This section explains what happens **after** your code node outputs the schema array.

### 7.1 Send Data to Webhook

From your automation (n8n code node or external system), send a POST request to the webhook URL:

**Request Format:**

The webhook accepts either an array of topics or an object with `topics` array. Each topic must include:

**Required for TTS (avatar narration):** Use one of these formats:
- `topic_avatar_intro`, `topic_avatar_explanation`, `topic_avatar_outro` (flat)
- `avatar_scripts_by_language.en.intro`, `.explanation`, `.outro`
- `topic_avatar_scripts.en.intro`, `.explanation`, `.outro`

**Required for MCQs:** Use one of these formats:
- `mcq1_question`, `mcq1_option1`, `mcq1_option2`, ... `mcq1_correct_option_index`, etc. (flat, up to mcq5)
- `mcqs` array: `[{ question, options: [{text, correct?}], correct_index?, explanation? }]`

```json
{
  "curriculum": "CBSE",
  "class": 1,
  "subject": "Science",
  "chapter_number": 1,
  "chapter_name": "Life Around Us",
  "topics": [
    {
      "topic_id": "introduction_to_animals_and_birds",
      "topic_name": "Introduction to Animals and Birds",
      "topic_priority": 1,
      "learning_objective": "To identify common animals and birds...",
      "topic_avatar_intro": "Today we will learn about animals and birds.",
      "topic_avatar_explanation": "Animals and birds live around us...",
      "topic_avatar_outro": "Now you know about animals and birds.",
      "scene_type": "mixed",
      "in3d_prompt": "A vibrant classroom scene showing animals...",
      "asset_list": ["monkey_3d_model"],
      "camera_guidance": "slow orbit 45° around the monkey...",
      "mcq1_question": "Which animal lives in trees?",
      "mcq1_option1": "Fish",
      "mcq1_option2": "Monkey",
      "mcq1_option3": "Dog",
      "mcq1_option4": "Cat",
      "mcq1_correct_option_index": 1,
      "mcq1_question_id": "q1_which_animal_lives_in_trees"
    }
  ]
}
```

**Alternative: avatar_scripts_by_language**
```json
{
  "avatar_scripts_by_language": {
    "en": {
      "intro": "Today we will learn...",
      "explanation": "Animals and birds live...",
      "outro": "Now you know..."
    }
  }
}
```

**Alternative: mcqs array**
```json
{
  "mcqs": [
    {
      "question": "Which animal lives in trees?",
      "options": [
        { "text": "Fish" },
        { "text": "Monkey", "correct": true },
        { "text": "Dog" },
        { "text": "Cat" }
      ],
      "correct_index": 1,
      "explanation": "Monkeys live in trees."
    }
  ]
}
```

### 7.2 Workflow Execution Flow

After the webhook receives data, the workflow executes in this order:

1. **Split Topics (Code)**
   - Takes the array and splits into individual topic items
   - Each topic becomes a separate workflow item

2. **Generate Skybox** (for each topic)
   - Sends `in3d_prompt` to skybox generation API
   - Returns generation ID and status

3. **Is Skybox Processing?**
   - Checks if status is "completed"
   - If not, goes to Wait → Poll → Check again (loop)
   - If yes, continues to next step

4. **Merge Skybox Data (Code)**
   - Combines skybox URL/ID with original topic data

5. **Split Asset List (Code)**
   - Takes `asset_list` array (e.g., `["globe", "microscope"]`)
   - Creates separate items for each asset

6. **Generate 3D Asset** (for each asset)
   - Sends asset name as prompt to Meshy API
   - Returns task ID and status

7. **Is Asset Processing?**
   - Checks if status is "completed"
   - If not, goes to Wait → Poll → Check again (loop)
   - If yes, continues to next step

8. **Merge Asset Data (Code)**
   - Combines asset URL/ID with topic data

9. **Group by Topic (Code)**
   - Groups all assets back to their parent topics
   - Prepares complete chapter structure with:
     - All topics
     - Skybox URLs for each topic
     - Asset URLs for each topic

10. **Save to Firebase**
    - Sends complete chapter data to Firebase
    - Stores in `curriculum_chapters` collection
    - Document ID: `{curriculum}_{class}_{subject}_ch{chapter_number}`

11. **Respond to Webhook**
    - Returns success response with document ID

### 7.3 Expected Response

After completion, you'll receive:

```json
{
  "success": true,
  "data": {
    "documentId": "CBSE_7_Science_ch1",
    "curriculum": "CBSE",
    "class": 7,
    "subject": "Science",
    "chapter_number": 1,
    "chapter_name": "The Ever-Evolving World of Science",
    "topics_count": 5
  },
  "message": "Curriculum chapter saved successfully",
  "requestId": "req_...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Step 8: Verify Data in Firebase

### 8.1 Check Firestore

1. Go to Firebase Console
2. Navigate to **Firestore Database**
3. Open `curriculum_chapters` collection
4. Find document: `CBSE_7_Science_ch1` (or your document ID)

### 8.2 Verify Structure

The document should contain:
- ✅ All topic fields
- ✅ `skybox_id` and `skybox_url` for each topic
- ✅ `asset_ids` and `asset_urls` arrays for each topic
- ✅ `status: "generated"` for topics with assets

### 8.3 Output Schema (Matches Previous Save-Lesson Flow)

The curriculum/save route produces a schema aligned with the previous save-lesson flow:

**Chapter-level:**
- `approved`, `approvedAt`, `approvedBy`
- `chapter_name_by_language` (en, hi)
- `supported_languages`, `moi`
- `mcq_ids_by_language`, `tts_ids_by_language`
- `sharedAssets` (image_ids, meshy_asset_ids, skybox_glb_urls, meshy_glb_urls)
- `skybox_glb_urls`, `meshy_glb_urls`
- `pdf_images_approved`, `pdf_images_generated`, `pdf_images_pending_approval`, `pdf_images_rejected`
- `text_to_3d_asset_ids`, `texture_request_ids` (placeholder arrays)

**Topic-level:**
- `topic_name_by_language`, `learning_objective_by_language`
- `avatar_scripts_by_language`
- `mcq_ids_by_language`, `tts_ids_by_language`
- `skybox_stored_glb_url`, `negative_text`, `negative_text_short`
- `sharedAssets` (asset_ids, meshy_asset_ids)

**TTS ID format:** `{topicId}_{intro|explanation|outro}_{lang}_female_professional`

**MCQ support:** `mcqs_by_language` (en/hi arrays) or flat `mcq1_question`... or `mcqs` array

**Multi-language:** Pass `avatar_scripts_by_language.en` and `avatar_scripts_by_language.hi` for TTS in both languages.

---

## Step 9: Monitoring and Troubleshooting

### 9.1 Monitor Workflow Executions

1. In n8n, go to **Executions**
2. Click on any execution to see detailed logs
3. Check each node's input/output data

### 9.2 Common Issues

#### Skybox Generation Stuck
- **Check**: In3D API key is valid
- **Check**: API quota/limits
- **Solution**: Increase wait time in "Wait 5s" node

#### Asset Generation Stuck
- **Check**: Meshy API key is valid
- **Check**: API quota/limits
- **Solution**: Increase wait time in "Wait 10s" node

#### Firebase Save Fails
- **Check**: Firebase credentials
- **Check**: Firestore rules allow writes
- **Check**: Document ID format is correct

#### Code Node Errors
- **Check**: Input data format matches expected schema
- **Check**: All required fields are present
- **View**: Code node output in execution logs

### 9.3 Debug Tips

1. **Test Individual Nodes**: Click "Execute Node" on each node to test
2. **View Data**: Click on any node to see input/output JSON
3. **Check Logs**: View execution logs for error messages
4. **Validate Schema**: Ensure your input matches the expected format

---

## Step 10: Integration with Your Automation

### 10.1 From n8n Code Node

If you have a code node that outputs the schema:

```javascript
// In your code node, output the schema array
return topics.map(topic => ({
  json: topic
}));
```

Then connect to **HTTP Request** node:
- **Method**: `POST`
- **URL**: Your webhook URL
- **Body**: `{{ JSON.stringify($json) }}`

### 10.2 From External System

Send POST request with the schema array as JSON body.

### 10.3 From Another n8n Workflow

Use **HTTP Request** node to call the webhook URL.

---

## Performance Considerations

- **Processing Time**: 
  - Skybox: ~30-60 seconds per topic
  - Assets: ~60-120 seconds per asset
  - Total: Depends on number of topics and assets

- **Parallel Processing**: Topics are processed in parallel where possible

- **Rate Limiting**: Be aware of API rate limits for both In3D and Meshy

- **Wait Times**: Adjust based on API response times:
  - Skybox: 5 seconds (default)
  - Assets: 10 seconds (default)

---

## Next Steps

After successful processing:

1. ✅ Verify data in Firebase Console
2. ✅ Use the saved curriculum data in your application
3. ✅ Reference skybox and asset URLs in your 3D scenes
4. ✅ Query curriculum chapters using the document ID format

---

## Support

If you encounter issues:

1. Check n8n execution logs
2. Check Firebase Functions logs: `firebase functions:log`
3. Verify API keys are valid
4. Ensure all environment variables are set
5. Test individual nodes in isolation

---

## Summary

The workflow automatically:
- ✅ Extracts `in3d_prompt` and `asset_list` from each topic
- ✅ Generates skyboxes for each topic
- ✅ Generates 3D assets for each item in `asset_list`
- ✅ Polls until generation completes
- ✅ Groups all data by topic
- ✅ Saves everything to Firebase Firestore (including remix_ids for regeneration)
- ✅ Returns success response with document ID

## Additional Features

### Skybox Style Configuration

The workflow now uses **M3 UHD Render** as the default skybox style. You can configure this via the `SKYBOX_STYLE_ID` environment variable in n8n.

**See:** [Skybox Style and Remix ID Guide](./N8N_SKYBOX_STYLE_AND_REMIX_GUIDE.md) for details.

### Remix ID for Regeneration

All generated skyboxes and 3D assets now include `remix_id` fields that allow you to regenerate assets if they're not up to the mark.

**Stored fields:**
- `skybox_remix_id`: For regenerating skyboxes
- `asset_remix_ids`: Array of remix IDs for regenerating 3D assets

**See:** [Skybox Style and Remix ID Guide](./N8N_SKYBOX_STYLE_AND_REMIX_GUIDE.md) for usage instructions.

## Related Documentation

- [Skybox Style and Remix ID Guide](./N8N_SKYBOX_STYLE_AND_REMIX_GUIDE.md) - Configure skybox styles and use remix IDs
- [MCQ Storage Guide](./MCQ_STORAGE_GUIDE.md) - How MCQ fields are stored
- [N8N Quick Start](./N8N_QUICK_START.md) - Quick setup checklist

You just need to send the schema array to the webhook URL!
