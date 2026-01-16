# In3D API Reference

Complete API documentation for the In3D Developer Portal. All endpoints support authentication via API keys or Firebase Auth tokens.

## Base URL

**Production:**
```
https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api
```

**Local Development:**
```
http://localhost:5001/in3devoneuralai/us-central1/api
```

## Authentication

All endpoints require authentication via one of the following methods:

### Method 1: API Key (Recommended for n8n)

**Header:**
```
Authorization: Bearer in3d_live_<your_api_key>
```

**OR**

```
X-In3d-Key: in3d_live_<your_api_key>
```

### Method 2: Firebase Auth Token

**Header:**
```
Authorization: Bearer <firebase_id_token>
```

### API Key Scopes

- **READ**: View-only access (styles, status, history)
- **FULL**: Full access including generation capabilities

## Response Format

All API responses follow a standardized format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": { ... }
}
```

## Error Codes

| HTTP Status | Error Code | Description |
|------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 400 | `MISSING_REQUIRED_FIELD` | Required field is missing |
| 401 | `UNAUTHORIZED` | Authentication required or failed |
| 401 | `INVALID_API_KEY` | API key is invalid or revoked |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `INSUFFICIENT_SCOPE` | API key scope is insufficient |
| 403 | `QUOTA_EXCEEDED` | Generation quota exceeded |
| 404 | `NOT_FOUND` | Resource not found |
| 404 | `GENERATION_NOT_FOUND` | Generation ID not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 429 | `CREDITS_EXHAUSTED` | No credits remaining |
| 500 | `INTERNAL_ERROR` | Internal server error |
| 502 | `EXTERNAL_API_ERROR` | External API error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Endpoints

### Skybox API

#### 1. Get Skybox Styles

Retrieve available skybox styles for generation.

**Endpoint:** `GET /skybox/styles`

**Authentication:** READ or FULL scope

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (min: 1) |
| `limit` | integer | No | 100 | Items per page (min: 1, max: 100) |

**Example Request:**

```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/styles?page=1&limit=20" \
  -H "Authorization: Bearer in3d_live_your_api_key_here"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Cinematic",
      "description": "Professional cinematic style",
      "image_jpg": "https://example.com/cinematic.jpg",
      "category": "Professional"
    },
    {
      "id": 2,
      "name": "Fantasy",
      "description": "Fantasy art style",
      "image_jpg": "https://example.com/fantasy.jpg",
      "category": "Artistic"
    }
  ],
  "message": "Successfully retrieved 20 skybox styles",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 20,
    "hasMore": true
  },
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 2. Generate Skybox

Initiate a new skybox generation.

**Endpoint:** `POST /skybox/generate`

**Authentication:** FULL scope required

**Request Body:**

```json
{
  "prompt": "A futuristic cityscape at sunset with neon lights",
  "style_id": 1,
  "negative_prompt": "low-res, blurry, washed out",
  "export_wireframe": false,
  "mesh_density": 30000,
  "depth_scale": 3.0
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Description of the environment (3-1000 characters) |
| `style_id` | integer | Yes | Style ID from `/skybox/styles` |
| `negative_prompt` | string | No | Elements to avoid in generation |
| `export_wireframe` | boolean | No | Export 3D wireframe (GLB format) |
| `mesh_density` | integer | No | Target polygon count (if export_wireframe is true) |
| `depth_scale` | float | No | Depth scale (3.0 to 10.0, if export_wireframe is true) |

**Example Request:**

```bash
curl -X POST "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/generate" \
  -H "Authorization: Bearer in3d_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic cityscape at sunset",
    "style_id": 1
  }'
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "generationId": "12345678",
    "status": "pending",
    "id": 12345678,
    "prompt": "A futuristic cityscape at sunset",
    "style_id": 1
  },
  "message": "Skybox generation initiated successfully",
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 3. Get Generation Status

Check the status of a skybox generation.

**Endpoint:** `GET /skybox/status/:generationId`

**Authentication:** READ or FULL scope

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `generationId` | string | Yes | Generation ID from create response |

**Example Request:**

```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/skybox/status/12345678" \
  -H "Authorization: Bearer in3d_live_your_api_key_here"
```

**Example Response (Pending):**

```json
{
  "success": true,
  "data": {
    "id": "12345678",
    "status": "processing",
    "prompt": "A futuristic cityscape at sunset",
    "style_id": 1
  },
  "message": "Generation status retrieved successfully",
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Example Response (Completed):**

```json
{
  "success": true,
  "data": {
    "id": "12345678",
    "status": "completed",
    "file_url": "https://example.com/skybox.jpg",
    "thumbnail_url": "https://example.com/skybox-thumb.jpg",
    "prompt": "A futuristic cityscape at sunset",
    "style_id": 1
  },
  "message": "Generation status retrieved successfully",
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Values:**

- `pending`: Generation queued
- `processing`: Generation in progress
- `completed`: Generation finished successfully
- `failed`: Generation failed

### Meshy 3D Asset API

#### 1. Generate 3D Asset

Generate a 3D model using Meshy.ai.

**Endpoint:** `POST /meshy/generate`

**Authentication:** FULL scope required

**Request Body:**

```json
{
  "prompt": "A detailed medieval sword with ornate handle",
  "art_style": "realistic",
  "ai_model": "meshy-4",
  "topology": "triangle",
  "target_polycount": 30000,
  "should_remesh": true,
  "symmetry_mode": "auto",
  "negative_prompt": "low quality, blurry"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Description of the 3D asset |
| `art_style` | string | No | Art style (default: "realistic") |
| `ai_model` | string | No | AI model version (default: "meshy-4") |
| `topology` | string | No | Topology type (default: "triangle") |
| `target_polycount` | integer | No | Target polygon count (default: 30000) |
| `should_remesh` | boolean | No | Enable remeshing (default: true) |
| `symmetry_mode` | string | No | Symmetry mode (default: "auto") |
| `negative_prompt` | string | No | Elements to avoid |

**Example Request:**

```bash
curl -X POST "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/meshy/generate" \
  -H "Authorization: Bearer in3d_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A detailed medieval sword",
    "art_style": "realistic"
  }'
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "task_abc123",
    "status": "pending",
    "prompt": "A detailed medieval sword"
  },
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### 2. Get 3D Asset Status

Check the status of a 3D asset generation.

**Endpoint:** `GET /meshy/status/:taskId`

**Authentication:** READ or FULL scope

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task ID from generate response |

**Example Request:**

```bash
curl -X GET "https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api/meshy/status/task_abc123" \
  -H "Authorization: Bearer in3d_live_your_api_key_here"
```

**Example Response (Completed):**

```json
{
  "success": true,
  "data": {
    "id": "task_abc123",
    "status": "completed",
    "model_urls": {
      "glb": "https://example.com/model.glb",
      "usdz": "https://example.com/model.usdz"
    },
    "video_url": "https://example.com/preview.mp4",
    "thumbnail_url": "https://example.com/thumb.jpg"
  },
  "requestId": "req_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Rate Limiting

- **Read endpoints**: No strict rate limits (subject to fair use)
- **Generation endpoints**: Limited by user credits/subscription tier
- **429 Too Many Requests**: Returned when rate limit is exceeded

## Best Practices

1. **Store API Keys Securely**: Never commit API keys to version control
2. **Use Environment Variables**: Store keys in n8n credentials or environment variables
3. **Handle Errors Gracefully**: Always check `success` field in responses
4. **Poll for Status**: Use polling with exponential backoff for generation status
5. **Respect Rate Limits**: Implement retry logic with backoff for 429 errors
6. **Validate Inputs**: Validate prompts and parameters before sending requests

## n8n Integration

See [N8N_WORKFLOW_GUIDE.md](./N8N_WORKFLOW_GUIDE.md) for detailed n8n workflow setup instructions.

## Support

For API support, please contact support@in3d.ai or visit the Developer Portal.
