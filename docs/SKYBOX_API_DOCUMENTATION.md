# Skybox API Documentation

This document describes the Skybox API endpoints for the IN3D Neural Website backend service.

## Base URL

```
http://localhost:5002/api/skybox
```

## Authentication

Currently, all endpoints are public. Future versions may require authentication.

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "error": "ERROR_TYPE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": {...} // Only in development mode
}
```

## Endpoints

### 1. Get Skybox Styles

Retrieves available skybox styles with pagination.

**Endpoint:** `GET /styles` or `GET /getSkyboxStyles` (legacy)

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 20, min: 1, max: 100)

**Example Request:**
```bash
curl -X GET "http://localhost:5002/api/skybox/styles?page=1&limit=10"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "styles": [
      {
        "id": 1,
        "name": "Cinematic",
        "description": "Professional cinematic style",
        "preview_image_url": "https://example.com/cinematic.jpg",
        "category": "Professional"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "hasMore": true,
      "totalPages": 5
    }
  },
  "message": "Skybox styles retrieved successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Generate Skybox

Initiates a new skybox generation.

**Endpoint:** `POST /generate` or `POST /generateSkybox` (legacy)

**Request Body:**
```json
{
  "prompt": "A futuristic cityscape at sunset",
  "skybox_style_id": 1,
  "remix_imagine_id": "optional-remix-id",
  "webhook_url": "https://your-webhook.com/callback"
}
```

**Required Fields:**
- `prompt`: String (3-1000 characters)
- `skybox_style_id`: Positive integer

**Optional Fields:**
- `remix_imagine_id`: String
- `webhook_url`: String (valid URL)

**Example Request:**
```bash
curl -X POST "http://localhost:5002/api/skybox/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic cityscape at sunset",
    "skybox_style_id": 1
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "gen_123456789",
    "status": "pending",
    "prompt": "A futuristic cityscape at sunset",
    "skybox_style_id": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Skybox generation initiated successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Get Skybox Status

Retrieves the status of a skybox generation.

**Endpoint:** `GET /status/:generationId`

**Path Parameters:**
- `generationId`: String (required)

**Example Request:**
```bash
curl -X GET "http://localhost:5002/api/skybox/status/gen_123456789"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "gen_123456789",
    "status": "completed",
    "prompt": "A futuristic cityscape at sunset",
    "skybox_style_id": 1,
    "file_url": "https://example.com/skybox.jpg",
    "thumbnail_url": "https://example.com/thumbnail.jpg",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:05:00.000Z"
  },
  "message": "Skybox status retrieved successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Get User Skyboxes

Retrieves user's skybox generations with pagination.

**Endpoint:** `GET /user`

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 20, min: 1, max: 100)

**Example Request:**
```bash
curl -X GET "http://localhost:5002/api/skybox/user?page=1&limit=10"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "gen_123456789",
        "status": "completed",
        "prompt": "A futuristic cityscape at sunset",
        "skybox_style_id": 1,
        "file_url": "https://example.com/skybox.jpg",
        "thumbnail_url": "https://example.com/thumbnail.jpg",
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:05:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "hasMore": true,
      "totalPages": 3
    }
  },
  "message": "User skyboxes retrieved successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Clear Cache

Clears the skybox styles cache.

**Endpoint:** `DELETE /cache`

**Example Request:**
```bash
curl -X DELETE "http://localhost:5002/api/skybox/cache"
```

**Example Response:**
```json
{
  "success": true,
  "data": null,
  "message": "Skybox styles cache cleared successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Health Check

Returns the health status of the skybox service.

**Endpoint:** `GET /health`

**Example Request:**
```bash
curl -X GET "http://localhost:5002/api/skybox/health"
```

**Example Response:**
```json
{
  "status": "ok",
  "service": "skybox",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "endpoints": [
    "GET /styles - Get skybox styles",
    "POST /generate - Generate skybox",
    "GET /status/:id - Get generation status",
    "GET /user - Get user skyboxes",
    "DELETE /cache - Clear cache"
  ]
}
```

## Error Codes

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `SKYBOX_STYLES_ERROR` | 500 | Error fetching skybox styles |
| `SKYBOX_GENERATION_ERROR` | 500 | Error generating skybox |
| `SKYBOX_STATUS_ERROR` | 500 | Error fetching skybox status |
| `USER_SKYBOXES_ERROR` | 500 | Error fetching user skyboxes |
| `CACHE_CLEAR_ERROR` | 500 | Error clearing cache |

## Rate Limiting

Currently, no rate limiting is implemented. Future versions may include rate limiting based on API key or user authentication.

## Caching

- Skybox styles are cached for 30 minutes to reduce API calls to BlockadeLabs
- Cache can be manually cleared using the `/cache` endpoint
- Cache is automatically invalidated after TTL expires

## Webhooks

When generating skyboxes, you can optionally provide a `webhook_url` that will be called when the generation is complete. The webhook will receive a POST request with the generation status.

## Development

To run the server in development mode:

```bash
cd server
npm run dev
```

The server will start on `http://localhost:5002` by default.

## Environment Variables

Required environment variables:

- `API_KEY`: BlockadeLabs API key
- `NODE_ENV`: Environment (development/production)
- `SERVER_PORT`: Server port (default: 5002)

## Testing

You can test the API endpoints using curl, Postman, or any HTTP client. Make sure the server is running and the BlockadeLabs API key is properly configured. 