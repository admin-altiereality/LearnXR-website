/**
 * Standardized API Response Utility
 * Ensures consistent JSON responses across all endpoints for n8n compatibility
 */

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
  timestamp?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore?: boolean;
    totalPages?: number;
  };
}

export interface StandardErrorResponse {
  success: false;
  error: string;
  message: string;
  code: string;
  requestId?: string;
  timestamp: string;
  details?: any;
}

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  options: {
    requestId?: string;
    message?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore?: boolean;
      totalPages?: number;
    };
  } = {}
): StandardApiResponse<T> {
  const response: StandardApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  if (options.requestId) {
    response.requestId = options.requestId;
  }

  if (options.message) {
    response.message = options.message;
  }

  if (options.pagination) {
    response.pagination = options.pagination;
  }

  return response;
}

/**
 * Create an error response with standardized format
 */
export function errorResponse(
  error: string,
  message: string,
  code: string,
  statusCode: number = 400,
  options: {
    requestId?: string;
    details?: any;
  } = {}
): { statusCode: number; response: StandardErrorResponse } {
  return {
    statusCode,
    response: {
      success: false,
      error,
      message,
      code,
      requestId: options.requestId,
      timestamp: new Date().toISOString(),
      ...(options.details && { details: options.details })
    }
  };
}

/**
 * Standard error codes
 */
export enum ErrorCode {
  // Authentication & Authorization
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_API_KEY = 'INVALID_API_KEY',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  INSUFFICIENT_TIER = 'INSUFFICIENT_TIER',
  
  // Rate Limiting & Quotas
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CREDITS_EXHAUSTED = 'CREDITS_EXHAUSTED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Not Found
  NOT_FOUND = 'NOT_FOUND',
  GENERATION_NOT_FOUND = 'GENERATION_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Server Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  
  // Generation Specific
  GENERATION_FAILED = 'GENERATION_FAILED',
  GENERATION_TIMEOUT = 'GENERATION_TIMEOUT',
  STYLES_UNAVAILABLE = 'STYLES_UNAVAILABLE'
}

/**
 * HTTP status code mappings
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;
