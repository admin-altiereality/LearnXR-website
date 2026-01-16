# Skybox Style Configuration and Remix ID Guide

This guide explains how to configure the skybox style (M3 UHD Render) and use remix IDs for regenerating assets.

## Skybox Style Configuration

### Default Style: M3 UHD Render

The n8n workflow now uses **M3 UHD Render** as the default skybox style instead of "Advanced (no style)".

### Finding the Correct Style ID

To find the style ID for "M3 UHD Render" or any other style:

1. **Query the Skybox Styles API:**
   ```bash
   curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles" \
     -H "X-In3d-Key: YOUR_API_KEY"
   ```

2. **Search for "M3 UHD Render" in the response:**
   ```json
   {
     "id": 3,
     "name": "M3 UHD Render",
     "description": "...",
     ...
   }
   ```

3. **Note the `id` field** - this is the style_id you need.

### Setting the Style ID in n8n

The workflow uses an environment variable `SKYBOX_STYLE_ID` with a default fallback to `3`:

1. **In n8n, go to Settings → Environment Variables**
2. **Add a new variable:**
   - **Name:** `SKYBOX_STYLE_ID`
   - **Value:** The style ID (e.g., `3` for M3 UHD Render)
3. **Save the environment variable**

The workflow will automatically use this value. If not set, it defaults to `3`.

**Current workflow configuration:**
```json
{
  "name": "style_id",
  "value": "={{ $env.SKYBOX_STYLE_ID || '3' }}"
}
```

## Remix ID for Regeneration

### What is Remix ID?

Remix ID is the generation ID that can be used to regenerate or remix existing skyboxes and 3D assets. This allows you to:
- Regenerate assets if the previous ones are not up to the mark
- Create variations of existing generations
- Maintain a reference to the original generation

### How Remix ID is Stored

#### Skybox Remix ID

When a skybox is generated, the workflow automatically stores:
- `skybox_id`: The generation ID
- `skybox_remix_id`: Same as skybox_id (for regeneration)

**Example in Firestore:**
```json
{
  "skybox_id": 14865300,
  "skybox_remix_id": 14865300,
  "skybox_url": "https://images.blockadelabs.com/..."
}
```

#### Asset Remix ID

When a 3D asset is generated, the workflow stores:
- `asset_id`: The task ID
- `asset_remix_id`: Same as asset_id (for regeneration)

**Example in Firestore:**
```json
{
  "assets": [
    {
      "asset_id": "019bc057-1c11-7691-8aa4-ca8cc5c18d14",
      "asset_remix_id": "019bc057-1c11-7691-8aa4-ca8cc5c18d14",
      "asset_url": "https://assets.meshy.ai/...",
      "asset_name": "globe_model"
    }
  ],
  "asset_ids": ["019bc057-1c11-7691-8aa4-ca8cc5c18d14"],
  "asset_remix_ids": ["019bc057-1c11-7691-8aa4-ca8cc5c18d14"]
}
```

### Using Remix ID to Regenerate

#### Regenerating a Skybox

To regenerate a skybox using its remix_id:

1. **Get the remix_id from Firestore:**
   ```javascript
   const topic = await db.collection('curriculum_chapters')
     .doc('CBSE_6_Social Science_ch1')
     .get();
   const skyboxRemixId = topic.data().topics[0].skybox_remix_id;
   ```

2. **Call the skybox generation API with remix_id:**
   ```bash
   curl -X POST "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate" \
     -H "X-In3d-Key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "A 3D globe showing latitudes and longitudes",
       "style_id": 3,
       "remix_imagine_id": 14865300
     }'
   ```

#### Regenerating a 3D Asset

For 3D assets, Meshy API doesn't currently support remix_id in the same way. However, you can:
- Use the same prompt and parameters
- Store the original prompt and parameters in Firestore for reference
- Use the asset_id to track which asset was regenerated

### Firestore Structure

The complete topic structure in Firestore includes:

```json
{
  "topic_id": "locating_places_on_the_earth",
  "topic_name": "Locating Places on the Earth",
  "skybox_id": 14865300,
  "skybox_remix_id": 14865300,
  "skybox_url": "https://images.blockadelabs.com/...",
  "asset_ids": ["019bc057-1c11-7691-8aa4-ca8cc5c18d14"],
  "asset_remix_ids": ["019bc057-1c11-7691-8aa4-ca8cc5c18d14"],
  "asset_urls": ["https://assets.meshy.ai/..."],
  "assets": [
    {
      "asset_id": "019bc057-1c11-7691-8aa4-ca8cc5c18d14",
      "asset_remix_id": "019bc057-1c11-7691-8aa4-ca8cc5c18d14",
      "asset_url": "https://assets.meshy.ai/...",
      "asset_name": "globe_model"
    }
  ],
  "status": "generated",
  "generatedAt": "2026-01-15T06:49:59.410Z",
  // ... all MCQ fields ...
}
```

## Troubleshooting

### Style ID Not Working

If the skybox generation fails or uses the wrong style:

1. **Verify the style exists:**
   ```bash
   curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles" \
     -H "X-In3d-Key: YOUR_API_KEY" | grep -i "M3"
   ```

2. **Check n8n environment variable:**
   - Go to Settings → Environment Variables
   - Verify `SKYBOX_STYLE_ID` is set correctly

3. **Check workflow node:**
   - Open "Generate Skybox" node
   - Verify `style_id` parameter uses: `={{ $env.SKYBOX_STYLE_ID || '3' }}`

### Remix ID Not Stored

If remix_id is missing in Firestore:

1. **Check workflow code nodes:**
   - "Merge Skybox Data (Code)" should extract `skybox_remix_id`
   - "Merge Asset Data (Code)" should extract `asset_remix_id`
   - "Group by Topic (Code)" should preserve remix_ids

2. **Verify API responses:**
   - Skybox generation should return `generationId` or `id`
   - Asset generation should return `result` (task ID)

3. **Check Firestore document:**
   - Verify the topic has `skybox_remix_id` and `asset_remix_ids` fields

## Related Documentation

- [N8N Curriculum Processing Guide](./N8N_CURRICULUM_PROCESSING_GUIDE.md)
- [MCQ Storage Guide](./MCQ_STORAGE_GUIDE.md)
- [N8N Quick Start](./N8N_QUICK_START.md)
