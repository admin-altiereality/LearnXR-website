# API Testing Guide

Comprehensive guide for testing the In3D API endpoints, especially for n8n integration verification.

## Quick Start

### Using the Test Scripts

We provide two test scripts:

1. **Bash Script** (`scripts/test-api.sh`) - For Linux/Mac
2. **Node.js Script** (`scripts/test-api.js`) - Cross-platform

### Bash Script Usage

```bash
# Set your API key
export IN3D_API_KEY="in3d_live_your_api_key_here"

# Optional: Set custom base URL
export IN3D_API_URL="https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api"

# Run tests
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

### Node.js Script Usage

```bash
# Set your API key
export IN3D_API_KEY="in3d_live_your_api_key_here"

# Run tests
node scripts/test-api.js
```

## Manual Testing with cURL

### 1. Get Skybox Styles

```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles?page=1&limit=10" \
  -H "X-In3d-Key: in3d_live_your_api_key_here" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {...},
  "requestId": "...",
  "timestamp": "..."
}
```

### 2. Generate Skybox

```bash
curl -X POST "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate" \
  -H "X-In3d-Key: in3d_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "style_id": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "generationId": "12345678",
    "status": "pending"
  },
  "requestId": "...",
  "timestamp": "..."
}
```

### 3. Check Generation Status

```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/status/12345678" \
  -H "X-In3d-Key: in3d_live_your_api_key_here" \
  -H "Content-Type: application/json"
```

**Expected Response (Processing):**
```json
{
  "success": true,
  "data": {
    "id": "12345678",
    "status": "processing"
  }
}
```

**Expected Response (Completed):**
```json
{
  "success": true,
  "data": {
    "id": "12345678",
    "status": "completed",
    "file_url": "https://example.com/skybox.jpg"
  }
}
```

## Testing Error Responses

### Invalid API Key (401)

```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles" \
  -H "X-In3d-Key: in3d_live_invalid_key" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or revoked API key",
  "code": "401",
  "requestId": "...",
  "timestamp": "..."
}
```

### Missing Required Field (400)

```bash
curl -X POST "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate" \
  -H "X-In3d-Key: in3d_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "style_id": 1
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Validation error",
  "message": "Missing required fields: prompt and style_id are required",
  "code": "MISSING_REQUIRED_FIELD",
  "requestId": "...",
  "timestamp": "..."
}
```

### Insufficient Scope (403)

Using a READ-only API key for generation:

```bash
curl -X POST "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate" \
  -H "X-In3d-Key: in3d_live_read_only_key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test",
    "style_id": 1
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "This endpoint requires full access scope. Your API key has read-only access.",
  "code": "INSUFFICIENT_SCOPE",
  "requestId": "...",
  "timestamp": "..."
}
```

## Testing with Postman

### Import Collection

1. Create a new Postman collection
2. Add environment variables:
   - `base_url`: `https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api`
   - `api_key`: `in3d_live_your_api_key_here`

### Request Examples

**Get Styles:**
- Method: `GET`
- URL: `{{base_url}}/skybox/styles?page=1&limit=10`
- Headers:
  - `X-In3d-Key`: `{{api_key}}`
  - `Content-Type`: `application/json`

**Generate Skybox:**
- Method: `POST`
- URL: `{{base_url}}/skybox/generate`
- Headers:
  - `X-In3d-Key`: `{{api_key}}`
  - `Content-Type`: `application/json`
- Body (JSON):
  ```json
  {
    "prompt": "A beautiful sunset",
    "style_id": 1
  }
  ```

## Testing Response Format

All responses should follow this structure:

### Success Response
- ✅ `success: true`
- ✅ `data` field present
- ✅ `requestId` present
- ✅ `timestamp` present

### Error Response
- ✅ `success: false`
- ✅ `error` field present
- ✅ `message` field present
- ✅ `code` field present
- ✅ `requestId` present
- ✅ `timestamp` present

## Automated Testing Checklist

- [ ] Get styles endpoint returns 200
- [ ] Generate endpoint returns 202 (Accepted)
- [ ] Status endpoint returns valid status
- [ ] Invalid API key returns 401
- [ ] Missing fields return 400
- [ ] Insufficient scope returns 403
- [ ] All responses have standardized format
- [ ] Error messages are clear and actionable
- [ ] Request IDs are present in all responses

## Performance Testing

### Load Testing

Use tools like Apache Bench or k6:

```bash
# Test styles endpoint
ab -n 100 -c 10 \
  -H "X-In3d-Key: in3d_live_your_api_key_here" \
  "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles"
```

### Rate Limit Testing

Test rate limiting by making rapid requests:

```bash
for i in {1..20}; do
  curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles" \
    -H "X-In3d-Key: in3d_live_your_api_key_here"
  echo "Request $i"
done
```

## Integration Testing

### Test Complete Workflow

1. **Get available styles**
2. **Generate skybox** with first style
3. **Poll status** until completed
4. **Verify file URL** is present
5. **Download and verify** the generated image

### Test Error Scenarios

1. **Invalid API key** → Should return 401
2. **Missing prompt** → Should return 400
3. **Invalid style_id** → Should return 400
4. **Read-only key for generation** → Should return 403
5. **No credits** → Should return 429

## Continuous Integration

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run API Tests
        env:
          IN3D_API_KEY: ${{ secrets.IN3D_API_KEY }}
        run: |
          chmod +x scripts/test-api.sh
          ./scripts/test-api.sh
```

## Troubleshooting Test Failures

### Common Issues

1. **401 Unauthorized**: Check API key is correct and not revoked
2. **403 Forbidden**: Verify API key has correct scope
3. **429 Too Many Requests**: Wait and retry with backoff
4. **500 Internal Error**: Check server logs, may be temporary
5. **Timeout**: Increase timeout value, generation may take time

### Debug Tips

- Enable verbose logging in curl: `curl -v`
- Check response headers for rate limit info
- Verify request format matches documentation
- Test with Postman first, then automate

## Next Steps

After testing:
1. ✅ Verify all endpoints work correctly
2. ✅ Test error handling
3. ✅ Verify response formats
4. ✅ Set up monitoring
5. ✅ Document any issues found

For more information, see:
- [API Reference](./API_REFERENCE.md)
- [n8n Workflow Guide](./N8N_WORKFLOW_GUIDE.md)
