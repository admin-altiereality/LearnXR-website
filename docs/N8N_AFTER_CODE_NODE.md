# What to Do After Code Node Outputs Schema - Step-by-Step

This guide explains exactly what happens **after** your code node outputs the curriculum schema array and how to connect it to the n8n workflow.

## Prerequisites

✅ Firebase function deployed (`/curriculum/save` endpoint)  
✅ n8n workflow imported and configured  
✅ Webhook URL copied from n8n  

---

## Step 1: Your Code Node Output Format

Your code node should output an array of topic objects. Each topic must include:

**Required Fields:**
- `curriculum` (string)
- `class` (number)
- `subject` (string)
- `chapter_number` (number)
- `chapter_name` (string)
- `topic_id` (string)
- `topic_name` (string)
- `in3d_prompt` (string) - **Used for skybox generation**
- `asset_list` (array of strings) - **Used for 3D asset generation**

**Example Output:**
```javascript
// In your code node
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
      topic_priority: 1,
      learning_objective: "Understand the nature of science...",
      topic_avatar_intro: "Let's start by understanding...",
      topic_avatar_explanation: "Science is not just about...",
      topic_avatar_outro: "So, keep your curiosity alive...",
      scene_type: "mixed",
      in3d_prompt: "A teacher standing in a classroom with a globe, microscope, and butterfly models...",
      asset_list: ["globe", "microscope", "butterfly_model"],
      camera_guidance: "Focus on the teacher...",
      // ... MCQ fields
    }
  },
  // ... more topics
];
```

---

## Step 2: Connect Code Node to HTTP Request Node

### 2.1 Add HTTP Request Node

1. In n8n, add an **HTTP Request** node after your code node
2. Connect the output of your code node to this HTTP Request node

### 2.2 Configure HTTP Request Node

**Settings:**
- **Method**: `POST`
- **URL**: Your webhook URL from the workflow
  - Example: `https://your-n8n-instance.com/webhook/process-curriculum`
- **Authentication**: None (or use your API key if needed)
- **Send Body**: `true`
- **Body Content Type**: `JSON`
- **Body**: `={{ JSON.stringify($json) }}`

**Important:** Since your code node outputs an array, the HTTP Request will send each item separately. You have two options:

#### Option A: Send Each Topic Separately (Recommended for Large Batches)

Keep the connection as-is. Each topic will be processed individually.

#### Option B: Send All Topics at Once

If you want to send all topics in one request:

1. Add a **Code** node between your code node and HTTP Request
2. Use this code to collect all items:

```javascript
// Collect all items from previous node
const allItems = $input.all();

// Return single item with array of all topics
return [{
  json: {
    topics: allItems.map(item => item.json)
  }
}];
```

3. In HTTP Request node, set body to: `={{ JSON.stringify($json.topics) }}`

---

## Step 3: What Happens in the Workflow

Once the HTTP Request sends data to the webhook, the workflow automatically:

### 3.1 Split Topics (Code Node)
- Takes the array and creates one workflow item per topic
- Each topic is processed independently

### 3.2 Generate Skybox (for each topic)
- Extracts `in3d_prompt` from each topic
- Sends to: `POST /api/skybox/generate`
- Returns: `{ generationId, status }`

### 3.3 Poll Skybox Status
- Checks status every 5 seconds
- Continues until status is "completed"
- Gets final skybox URL

### 3.4 Merge Skybox Data
- Combines skybox URL/ID with original topic data
- Topic now has: `skybox_id` and `skybox_url`

### 3.5 Split Asset List (Code Node)
- Takes `asset_list` array (e.g., `["globe", "microscope"]`)
- Creates separate items for each asset
- Each asset is processed independently

### 3.6 Generate 3D Asset (for each asset)
- Uses asset name as prompt (e.g., "globe")
- Sends to: `POST /api/meshy/generate`
- Returns: `{ id, status }`

### 3.7 Poll Asset Status
- Checks status every 10 seconds
- Continues until status is "completed"
- Gets final asset URL (GLB file)

### 3.8 Merge Asset Data
- Combines asset URL/ID with topic data
- Each asset has: `asset_id` and `asset_url`

### 3.9 Group by Topic (Code Node)
- Groups all assets back to their parent topics
- Creates final structure:
  ```json
  {
    "curriculum": "CBSE",
    "class": 7,
    "subject": "Science",
    "chapter_number": 1,
    "chapter_name": "...",
    "topics": [
      {
        "topic_id": "...",
        "skybox_id": "skybox_123",
        "skybox_url": "https://...",
        "assets": [
          {
            "asset_id": "asset_456",
            "asset_url": "https://...",
            "asset_name": "globe"
          },
          // ... more assets
        ]
      }
    ]
  }
  ```

### 3.10 Save to Firebase
- Sends complete chapter to: `POST /api/curriculum/save`
- Stores in Firestore: `curriculum_chapters/{curriculum}_{class}_{subject}_ch{chapter_number}`
- Returns: `{ documentId, success: true }`

### 3.11 Respond to Webhook
- Returns success response to your HTTP Request node

---

## Step 4: Handle the Response

### 4.1 Check Response in HTTP Request Node

After the workflow completes, your HTTP Request node will receive:

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

### 4.2 Add Error Handling (Optional)

Add an **IF** node after HTTP Request:

**Condition:**
- **Value 1**: `{{ $json.success }}`
- **Operation**: `equals`
- **Value 2**: `true`

**True Branch**: Success - continue with your workflow  
**False Branch**: Error - handle error (log, notify, etc.)

---

## Step 5: Verify in Firebase

### 5.1 Check Firestore

1. Go to Firebase Console
2. Navigate to **Firestore Database**
3. Open `curriculum_chapters` collection
4. Find document: `CBSE_7_Science_ch1` (or your document ID)

### 5.2 Verify Data Structure

The document should contain:
- ✅ All original topic fields
- ✅ `skybox_id` and `skybox_url` for each topic
- ✅ `asset_ids` array with all asset IDs
- ✅ `asset_urls` array with all asset URLs
- ✅ `status: "generated"` for topics with assets

---

## Complete Workflow Diagram

```
Your Code Node
    ↓
[Outputs array of topics]
    ↓
HTTP Request Node
    ↓
[POST to webhook URL]
    ↓
n8n Curriculum Workflow
    ├─→ Split Topics
    ├─→ Generate Skybox (for each topic)
    ├─→ Poll Skybox Status (loop until complete)
    ├─→ Merge Skybox Data
    ├─→ Split Asset List
    ├─→ Generate 3D Asset (for each asset)
    ├─→ Poll Asset Status (loop until complete)
    ├─→ Merge Asset Data
    ├─→ Group by Topic
    ├─→ Save to Firebase
    └─→ Respond to Webhook
    ↓
HTTP Request Node (receives response)
    ↓
[Success/Error handling]
    ↓
Continue your workflow
```

---

## Troubleshooting

### Issue: Topics Not Processing

**Check:**
- Code node output format matches expected schema
- HTTP Request node body is correctly formatted
- Webhook URL is correct

**Solution:**
- View code node output in execution logs
- Test HTTP Request node separately

### Issue: Skybox Generation Fails

**Check:**
- `in3d_prompt` field exists and is not empty
- In3D API key is valid
- API quota not exceeded

**Solution:**
- Verify `in3d_prompt` in code node output
- Check n8n execution logs for error details

### Issue: Asset Generation Fails

**Check:**
- `asset_list` is an array (not empty)
- Asset names are valid strings
- Meshy API key is valid

**Solution:**
- Verify `asset_list` format in code node output
- Check n8n execution logs for error details

### Issue: Firebase Save Fails

**Check:**
- All required fields present (curriculum, class, subject, etc.)
- Document ID format is correct
- Firestore rules allow writes

**Solution:**
- Verify all required fields in code node output
- Check Firebase Functions logs

---

## Example: Complete n8n Setup

### Node 1: Code Node (Your Schema Generator)
```javascript
// Your code that generates the schema
const topics = [
  {
    curriculum: "CBSE",
    class: 7,
    subject: "Science",
    chapter_number: 1,
    chapter_name: "The Ever-Evolving World of Science",
    topic_id: "introduction_to_science_and_curiosity",
    topic_name: "Introduction to Science and Curiosity",
    in3d_prompt: "A teacher standing in a classroom...",
    asset_list: ["globe", "microscope", "butterfly_model"]
  }
];

return topics.map(topic => ({ json: topic }));
```

### Node 2: HTTP Request Node
- **Method**: `POST`
- **URL**: `https://your-n8n-instance.com/webhook/process-curriculum`
- **Body**: `={{ JSON.stringify($json) }}`

### Node 3: IF Node (Error Handling)
- **Condition**: `{{ $json.success }}` equals `true`
- **True**: Continue workflow
- **False**: Handle error

---

## Summary

**After your code node outputs the schema:**

1. ✅ Connect to HTTP Request node
2. ✅ Configure to POST to webhook URL
3. ✅ Send array of topics as JSON body
4. ✅ Workflow automatically processes everything
5. ✅ Receive success response with document ID
6. ✅ Verify data in Firebase

**That's it!** The workflow handles all the complexity of generating skyboxes, assets, and saving to Firebase automatically.
