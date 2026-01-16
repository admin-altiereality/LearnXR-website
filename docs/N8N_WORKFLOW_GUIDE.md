# n8n Workflow Setup Guide for In3D API

Complete step-by-step guide for setting up n8n workflows with the In3D API.

## Prerequisites

1. **n8n Instance**: Self-hosted or n8n.cloud account
2. **In3D API Key**: Create one in the Developer Portal (Full Access scope required for generation)
3. **Basic n8n Knowledge**: Familiarity with n8n nodes and workflows

## Step 1: Get Your API Key

1. Log in to the In3D Developer Portal
2. Navigate to **Developer Settings** → **API Keys**
3. Click **Create API Key**
4. Enter a label (e.g., "n8n Production Workflow")
5. Select **Full Access** scope
6. **IMPORTANT**: Copy the API key immediately - it will only be shown once!
7. Store it securely in n8n credentials (see Step 2)

## Step 2: Store API Key in n8n

### Option A: Using n8n Credentials (Recommended)

1. In n8n, go to **Settings** → **Credentials**
2. Click **Add Credential**
3. Search for **HTTP Header Auth** or **Generic Credential Type**
4. Configure:
   - **Name**: `In3D API Key`
   - **Header Name**: `X-In3d-Key`
   - **Header Value**: `in3d_live_your_api_key_here`
5. Click **Save**

### Option B: Using Environment Variables

1. In your n8n instance, set environment variable:
   ```bash
   IN3D_API_KEY=in3d_live_your_api_key_here
   ```
2. Reference in workflow: `{{ $env.IN3D_API_KEY }}`

### Option C: Using n8n Variables (Workflow-specific)

1. In workflow settings, add variable:
   - **Name**: `in3d_api_key`
   - **Value**: `in3d_live_your_api_key_here`
2. Reference in nodes: `{{ $vars.in3d_api_key }}`

## Step 3: Create Basic Generation Workflow

### Workflow Overview

```
Webhook Trigger → HTTP Request (Generate) → IF (Status Check) → Wait → HTTP Request (Status) → Format Response → Respond to Webhook
```

### Node-by-Node Setup

#### Node 1: Webhook Trigger

1. Add **Webhook** node
2. Configure:
   - **HTTP Method**: `POST`
   - **Path**: `generate-3d-asset` (or your custom path)
   - **Response Mode**: `When Last Node Finishes`
3. Expected Input Format:
   ```json
   {
     "prompt": "A futuristic cityscape at sunset",
     "style_id": 1,
     "type": "skybox"
   }
   ```

#### Node 2: HTTP Request - Generate Skybox

1. Add **HTTP Request** node
2. Connect from Webhook Trigger
3. Configure:
   - **Method**: `POST`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate`
   - **Authentication**: 
     - **Type**: `Generic Credential Type`
     - **Credential**: Select your In3D API Key credential
     - **OR** Use Header Authentication:
       - **Header Name**: `X-In3d-Key`
       - **Header Value**: `in3d_live_your_api_key_here`
   - **Send Headers**: `true`
   - **Headers**:
     ```
     Content-Type: application/json
     ```
   - **Send Body**: `true`
   - **Body Content Type**: `JSON`
   - **Body**:
     ```json
     {
       "prompt": "={{ $json.prompt }}",
       "style_id": "={{ $json.style_id || 1 }}",
       "negative_prompt": "={{ $json.negative_prompt || '' }}"
     }
     ```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "generationId": "12345678",
    "status": "pending"
  },
  "requestId": "req_1234567890"
}
```

#### Node 3: IF Node - Check Status

1. Add **IF** node
2. Connect from Generate node
3. Configure:
   - **Mode**: `Expression`
   - **Value 1**: `={{ $json.data.status }}`
   - **Operation**: `Not Equal`
   - **Value 2**: `completed`

**Logic:**
- **True** (still processing): Continue to Wait → Poll Status
- **False** (completed): Go to Format Response

#### Node 4: Wait Node

1. Add **Wait** node
2. Connect from IF node (True branch)
3. Configure:
   - **Amount**: `5`
   - **Unit**: `seconds`

**Note**: Adjust wait time based on your needs. Skybox generation typically takes 30-60 seconds.

#### Node 5: HTTP Request - Poll Status

1. Add **HTTP Request** node
2. Connect from Wait node
3. Configure:
   - **Method**: `GET`
   - **URL**: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/status/={{ $('HTTP Request').item.json.data.generationId }}`
   - **Authentication**: Same as Generate node
   - **Send Headers**: `true`
   - **Headers**:
     ```
     X-In3d-Key: in3d_live_your_api_key_here
     ```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "12345678",
    "status": "processing",
    "file_url": null
  }
}
```

#### Node 6: Loop Back to IF Node

1. Connect Poll Status node back to IF node
2. This creates a polling loop until status is "completed"

#### Node 7: Format Response

1. Add **Set** node
2. Connect from IF node (False branch - completed)
3. Configure:
   - **Mode**: `Manual`
   - **Values**:
     ```
     status: ={{ $json.data.status }}
     file_url: ={{ $json.data.file_url }}
     thumbnail_url: ={{ $json.data.thumbnail_url }}
     generation_id: ={{ $json.data.id }}
     prompt: ={{ $json.data.prompt }}
     ```

#### Node 8: Respond to Webhook

1. Add **Respond to Webhook** node
2. Connect from Format Response node
3. Configure:
   - **Respond With**: `JSON`
   - **Response Body**: `={{ $json }}`

## Step 4: Advanced Workflow - Error Handling

### Add Error Handling Nodes

1. **Error Trigger Node**: Add after each HTTP Request node
2. **IF Node for Error Check**: Check if `success === false`
3. **Format Error Response**: Structure error messages
4. **Respond with Error**: Return error to webhook caller

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

## Step 5: Testing the Workflow

### Test with cURL

```bash
curl -X POST "https://your-n8n-instance.com/webhook/generate-3d-asset" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "style_id": 1
  }'
```

### Expected Flow

1. Webhook receives request
2. Generate request sent to In3D API
3. Status: "pending" → Wait 5s → Poll status
4. Status: "processing" → Wait 5s → Poll status
5. Status: "completed" → Format response → Return to caller

### Test Scenarios

1. **Valid Request**: Should complete successfully
2. **Invalid API Key**: Should return 401 error
3. **Missing Prompt**: Should return 400 validation error
4. **Invalid Style ID**: Should return 400 error
5. **Rate Limit**: Should return 429 error (retry with backoff)

## Step 6: Production Best Practices

### 1. Use Credentials Management

- Store API keys in n8n credentials, not in workflow code
- Use different keys for dev/staging/production
- Rotate keys regularly

### 2. Implement Retry Logic

Add **Retry** node after HTTP Request nodes:
- **Max Attempts**: 3
- **Retry On**: `4xx` and `5xx` errors
- **Wait Between Retries**: Exponential backoff

### 3. Add Timeout Handling

- Set timeout on HTTP Request nodes (30-60 seconds)
- Handle timeout errors gracefully
- Return meaningful error messages

### 4. Logging and Monitoring

- Add **Function** node to log requests/responses
- Monitor workflow execution times
- Set up alerts for failed generations

### 5. Rate Limiting

- Implement rate limiting in your workflow
- Use **Wait** nodes to space out requests
- Respect API rate limits (429 errors)

## Step 7: Complete Workflow Example

### JSON Export

See `workflows/n8n-in3d-workflow.json` for a complete workflow example.

### Import Steps

1. Copy the JSON from the workflow file
2. In n8n, click **Import from File** or **Import from URL**
3. Paste the JSON
4. Update API key references
5. Test the workflow

## Troubleshooting

### Common Issues

#### 1. "401 Unauthorized" Error

**Cause**: Invalid or missing API key

**Solution**:
- Verify API key is correct
- Check header name (`X-In3d-Key` or `Authorization`)
- Ensure key has correct scope (FULL for generation)

#### 2. "403 Forbidden" Error

**Cause**: Insufficient scope or quota exceeded

**Solution**:
- Check API key scope (needs FULL for generation)
- Verify user has remaining credits
- Check subscription tier requirements

#### 3. "429 Too Many Requests" Error

**Cause**: Rate limit exceeded

**Solution**:
- Implement exponential backoff
- Reduce request frequency
- Check user's rate limit tier

#### 4. Generation Stuck in "processing"

**Cause**: Generation may have failed or timed out

**Solution**:
- Check status endpoint directly
- Set maximum polling attempts
- Add timeout handling

#### 5. Webhook Not Responding

**Cause**: Workflow execution timeout or error

**Solution**:
- Check n8n execution logs
- Verify all nodes are connected correctly
- Test each node individually

## Advanced Use Cases

### 1. Batch Generation

Create multiple generations in parallel:
- Use **Split In Batches** node
- Process multiple prompts
- Aggregate results

### 2. Conditional Generation

Generate based on conditions:
- Use **IF** node to check conditions
- Different styles based on input
- Skip generation if conditions not met

### 3. Webhook Callbacks

Use webhooks for async processing:
- Send webhook URL in generation request
- Receive completion notification
- Process results asynchronously

## Support

For workflow issues or API questions:
- **Email**: support@in3d.ai
- **Documentation**: See [API_REFERENCE.md](./API_REFERENCE.md)
- **Developer Portal**: Check API key status and usage

## Next Steps

1. ✅ Set up your API key
2. ✅ Create basic workflow
3. ✅ Test with sample requests
4. ✅ Add error handling
5. ✅ Deploy to production
6. ✅ Monitor and optimize

Happy automating! 🚀
