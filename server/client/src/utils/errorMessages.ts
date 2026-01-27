/**
 * Error Messages
 * 
 * Centralized error message definitions with user-friendly messages
 */

export interface ErrorMessage {
  userMessage: string;
  technicalMessage: string;
  canRetry: boolean;
  action?: string;
  helpLink?: string;
}

/**
 * Error message map
 */
export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Permission errors
  'permission-denied': {
    userMessage: 'You need admin or superadmin role to perform this action.',
    technicalMessage: 'Permission denied: User does not have required role',
    canRetry: false,
    action: 'Contact your administrator to request access.',
  },
  'unauthenticated': {
    userMessage: 'You must be logged in to perform this action.',
    technicalMessage: 'User not authenticated',
    canRetry: false,
    action: 'Please log in and try again.',
  },

  // Network errors
  'unavailable': {
    userMessage: 'Service temporarily unavailable. Please try again in a moment.',
    technicalMessage: 'Service unavailable',
    canRetry: true,
  },
  'deadline-exceeded': {
    userMessage: 'Request timed out. Please check your connection and try again.',
    technicalMessage: 'Request deadline exceeded',
    canRetry: true,
  },
  'internal': {
    userMessage: 'An internal error occurred. Please try again.',
    technicalMessage: 'Internal server error',
    canRetry: true,
  },
  'aborted': {
    userMessage: 'Request was cancelled. Please try again.',
    technicalMessage: 'Request aborted',
    canRetry: true,
  },
  'resource-exhausted': {
    userMessage: 'Service is busy. Please try again in a moment.',
    technicalMessage: 'Resource exhausted',
    canRetry: true,
  },

  // Validation errors
  'invalid-argument': {
    userMessage: 'Invalid input provided. Please check your data and try again.',
    technicalMessage: 'Invalid argument',
    canRetry: false,
  },
  'failed-precondition': {
    userMessage: 'Operation cannot be performed in current state.',
    technicalMessage: 'Failed precondition',
    canRetry: false,
  },
  'out-of-range': {
    userMessage: 'Value is out of acceptable range.',
    technicalMessage: 'Out of range',
    canRetry: false,
  },

  // File errors
  'file-too-large': {
    userMessage: 'File is too large. Maximum size is 100MB.',
    technicalMessage: 'File size exceeds limit',
    canRetry: false,
    action: 'Please use a smaller file.',
  },
  'invalid-file-type': {
    userMessage: 'Invalid file format. Please use GLB, GLTF, FBX, or OBJ files.',
    technicalMessage: 'Invalid file type',
    canRetry: false,
    action: 'Please convert your file to a supported format.',
  },
  'file-corrupted': {
    userMessage: 'File appears to be corrupted or invalid.',
    technicalMessage: 'File corruption detected',
    canRetry: false,
    action: 'Please check your file and try again.',
  },

  // Unknown error
  'unknown': {
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: 'Unknown error',
    canRetry: true,
  },
};

/**
 * Get error message for error code
 */
export function getErrorMessage(errorCode: string): ErrorMessage {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['unknown'];
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: any): string {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  const message = getErrorMessage(errorCode);
  return message.userMessage;
}

/**
 * Get error action suggestion
 */
export function getErrorAction(error: any): string | undefined {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  const message = getErrorMessage(errorCode);
  return message.action;
}

/**
 * Check if error is retryable
 */
export function isErrorRetryable(error: any): boolean {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  const message = getErrorMessage(errorCode);
  return message.canRetry;
}
