# Skybox API Implementation

This document describes the professional implementation of the Skybox API for the IN3D Neural Website, based on the BlockadeLabs SDK Node Boilerplate patterns.

## Overview

The Skybox API provides a comprehensive interface for generating and managing 360-degree skybox images using the BlockadeLabs API. The implementation follows professional software engineering practices with proper error handling, caching, validation, and documentation.

## Architecture

### Service Layer Pattern
- **SkyboxService**: Centralized business logic with caching and error handling
- **Controller Layer**: Request/response handling with validation
- **Route Layer**: API endpoint definitions with middleware
- **Type Definitions**: TypeScript interfaces for type safety

### Key Features

1. **Intelligent Caching**: 30-minute cache for skybox styles to reduce API calls
2. **Comprehensive Validation**: Input validation with detailed error messages
3. **Pagination Support**: Efficient pagination for large datasets
4. **Error Handling**: Consistent error responses with proper HTTP status codes
5. **Type Safety**: Full TypeScript implementation with interfaces
6. **Backward Compatibility**: Legacy endpoint support
7. **Health Monitoring**: Built-in health check endpoints
8. **Professional Logging**: Structured logging for debugging

## File Structure

```
server/src/
├── services/
│   └── skyboxService.ts          # Business logic and caching
├── controllers/
│   └── skybox.controller.ts      # Request/response handling
├── routes/
│   └── skybox.ts                 # API endpoint definitions
├── middleware/
│   └── validation.ts             # Input validation middleware
├── types/
│   └── skybox.ts                 # TypeScript interfaces
└── tests/
    └── skybox.test.ts            # Unit tests
```

## API Endpoints

### Core Endpoints

| Method | Endpoint | Description | Parameters |
|--------|----------|-------------|------------|
| GET | `/api/skybox/styles` | Get skybox styles | `page`, `limit` |
| POST | `/api/skybox/generate` | Generate skybox | `prompt`, `skybox_style_id` |
| GET | `/api/skybox/status/:id` | Get generation status | `generationId` |
| GET | `/api/skybox/user` | Get user skyboxes | `page`, `limit` |
| DELETE | `/api/skybox/cache` | Clear cache | None |
| GET | `/api/skybox/health` | Health check | None |

### Legacy Endpoints (Backward Compatibility)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skybox/getSkyboxStyles` | Legacy styles endpoint |
| POST | `/api/skybox/generateSkybox` | Legacy generation endpoint |

## Implementation Details

### 1. SkyboxService Class

The service layer implements:
- **Singleton Pattern**: Single instance for consistent state
- **Caching Strategy**: 30-minute TTL for skybox styles
- **Error Handling**: Comprehensive error catching and logging
- **Pagination Logic**: Efficient data slicing and metadata

```typescript
class SkyboxService {
  private sdk: BlockadeLabsSdk;
  private stylesCache: CacheEntry<any> | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
}
```

### 2. Validation Middleware

Input validation ensures:
- **Required Fields**: Prompt and skybox_style_id validation
- **Data Types**: Type checking for all parameters
- **Length Limits**: Prompt length (3-1000 characters)
- **Range Validation**: Positive integers for IDs
- **Sanitization**: Input trimming and cleaning

### 3. Controller Layer

Controllers provide:
- **Consistent Responses**: Standardized success/error formats
- **HTTP Status Codes**: Proper status code usage
- **Error Logging**: Detailed error information for debugging
- **Development Mode**: Additional error details in development

### 4. Type Safety

TypeScript interfaces ensure:
- **Request Validation**: Type-safe request bodies
- **Response Consistency**: Structured response formats
- **API Documentation**: Self-documenting code
- **IDE Support**: IntelliSense and autocomplete

## Response Formats

### Success Response
```typescript
interface ApiSuccessResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}
```

### Error Response
```typescript
interface ApiErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: any; // Only in development
}
```

## Caching Strategy

### Cache Implementation
- **Memory Cache**: In-memory storage for skybox styles
- **TTL Management**: Automatic cache invalidation
- **Manual Clear**: Cache clearing endpoint for updates
- **Performance**: Reduced API calls to BlockadeLabs

### Cache Structure
```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
```

## Error Handling

### Error Types
- `VALIDATION_ERROR`: Invalid input parameters (400)
- `SKYBOX_STYLES_ERROR`: Styles fetching errors (500)
- `SKYBOX_GENERATION_ERROR`: Generation errors (500)
- `SKYBOX_STATUS_ERROR`: Status checking errors (500)
- `USER_SKYBOXES_ERROR`: User data errors (500)
- `CACHE_CLEAR_ERROR`: Cache operation errors (500)

### Error Response Format
```json
{
  "error": "ERROR_TYPE",
  "message": "Human readable message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": "Additional info (development only)"
}
```

## Testing

### Test Coverage
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Validation Tests**: Input validation testing
- **Error Tests**: Error handling verification

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Performance Optimizations

### 1. Caching
- Reduces API calls to BlockadeLabs
- 30-minute cache for static data
- Manual cache invalidation

### 2. Pagination
- Efficient data slicing
- Metadata for client-side pagination
- Configurable page sizes

### 3. Error Handling
- Fast failure for invalid requests
- Detailed logging for debugging
- Graceful degradation

## Security Considerations

### 1. Input Validation
- Type checking for all inputs
- Length limits on strings
- Range validation for numbers
- Sanitization of user input

### 2. Error Information
- No sensitive data in error responses
- Development-only detailed errors
- Structured error logging

### 3. API Key Management
- Environment variable configuration
- Secure key storage
- No key exposure in logs

## Monitoring and Logging

### Structured Logging
```typescript
console.log(`Skybox API: ${req.method} ${req.path}`, {
  query: req.query,
  body: req.method !== 'GET' ? req.body : undefined,
  timestamp: new Date().toISOString()
});
```

### Health Monitoring
- Built-in health check endpoint
- Service status reporting
- Endpoint documentation

## Deployment Considerations

### Environment Variables
```bash
API_KEY=your_blockadelabs_api_key
NODE_ENV=production
SERVER_PORT=5002
```

### Production Optimizations
- Disable detailed error responses
- Enable structured logging
- Configure proper CORS settings
- Set up monitoring and alerting

## Future Enhancements

### Planned Features
1. **Rate Limiting**: API rate limiting per user/IP
2. **Authentication**: User authentication and authorization
3. **Webhook Support**: Enhanced webhook handling
4. **Metrics**: Performance metrics and monitoring
5. **Redis Cache**: Distributed caching for scalability

### Scalability Improvements
1. **Database Integration**: Persistent storage for generations
2. **Queue System**: Background job processing
3. **CDN Integration**: Image delivery optimization
4. **Microservices**: Service decomposition

## Conclusion

This implementation provides a robust, scalable, and maintainable Skybox API that follows industry best practices. The code is well-documented, thoroughly tested, and ready for production deployment.

The architecture supports future enhancements while maintaining backward compatibility with existing integrations. The comprehensive error handling, caching strategy, and validation ensure reliable operation in production environments. 