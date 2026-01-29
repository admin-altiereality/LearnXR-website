/**
 * Error Handler
 * 
 * Centralized error handling with classification and recovery
 */

import { getUserErrorMessage, getErrorAction, isErrorRetryable } from './errorMessages';
import { isPermissionError, isRetryableError } from './permissionHelpers';
import { productionLogger } from '../services/productionLogger';

/**
 * Error classification
 */
export type ErrorType = 
  | 'permission'
  | 'network'
  | 'validation'
  | 'file'
  | 'unknown';

/**
 * Error classification result
 */
export interface ErrorClassification {
  type: ErrorType;
  code: string;
  userMessage: string;
  technicalMessage: string;
  canRetry: boolean;
  action?: string;
  requiresRole?: string[];
}

/**
 * Classify error
 */
export function classifyError(error: any): ErrorClassification {
  const errorCode = error?.code || error?.error?.code || 'unknown';
  const technicalMessage = error?.message || error?.error?.message || 'Unknown error';

  // Permission errors
  if (isPermissionError(error)) {
    return {
      type: 'permission',
      code: errorCode,
      userMessage: getUserErrorMessage(error),
      technicalMessage,
      canRetry: false,
      action: getErrorAction(error),
      requiresRole: ['admin', 'superadmin'],
    };
  }

  // Network errors
  if (isRetryableError(error)) {
    return {
      type: 'network',
      code: errorCode,
      userMessage: getUserErrorMessage(error),
      technicalMessage,
      canRetry: true,
      action: getErrorAction(error),
    };
  }

  // File errors
  if (errorCode.includes('file') || errorCode.includes('size') || errorCode.includes('format')) {
    return {
      type: 'file',
      code: errorCode,
      userMessage: getUserErrorMessage(error),
      technicalMessage,
      canRetry: false,
      action: getErrorAction(error),
    };
  }

  // Validation errors
  if (errorCode.includes('invalid') || errorCode.includes('validation')) {
    return {
      type: 'validation',
      code: errorCode,
      userMessage: getUserErrorMessage(error),
      technicalMessage,
      canRetry: false,
      action: getErrorAction(error),
    };
  }

  // Unknown error
  return {
    type: 'unknown',
    code: errorCode,
    userMessage: getUserErrorMessage(error),
    technicalMessage,
    canRetry: isErrorRetryable(error),
    action: getErrorAction(error),
  };
}

/**
 * Log error for debugging
 */
export function logError(error: any, context?: string): void {
  const classification = classifyError(error);
  
  // Log to console for immediate visibility
  console.error(`[Error${context ? `: ${context}` : ''}]`, {
    type: classification.type,
    code: classification.code,
    userMessage: classification.userMessage,
    technicalMessage: classification.technicalMessage,
    error: error,
  });

  // Log to production logger for Firestore storage
  const errorObj = error instanceof Error ? error : new Error(classification.technicalMessage);
  productionLogger.error(
    `Error: ${classification.userMessage}`,
    context || 'error-handler',
    errorObj,
    {
      type: classification.type,
      code: classification.code,
      canRetry: classification.canRetry,
      requiresRole: classification.requiresRole,
    }
  );
}

/**
 * Get error recovery suggestion
 */
export function getErrorRecovery(error: any): string {
  const classification = classifyError(error);

  if (classification.action) {
    return classification.action;
  }

  switch (classification.type) {
    case 'permission':
      return 'Contact your administrator to request the required permissions.';
    case 'network':
      return 'Check your internet connection and try again.';
    case 'file':
      return 'Please verify your file format and size, then try again.';
    case 'validation':
      return 'Please check your input and try again.';
    default:
      return 'Please try again. If the problem persists, contact support.';
  }
}
