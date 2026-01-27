/**
 * useRetry Hook
 * 
 * Hook for retrying operations with exponential backoff
 */

import { useState, useCallback } from 'react';
import { isRetryableError } from '../utils/permissionHelpers';
import { classifyError } from '../utils/errorHandler';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: any | null;
}

/**
 * Hook for retrying operations
 */
export function useRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): [
  () => Promise<T>,
  RetryState
] {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 8000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null,
  });

  const executeWithRetry = useCallback(async (): Promise<T> => {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setState({
          isRetrying: attempt > 1,
          attempt: attempt - 1,
          lastError: null,
        });

        const result = await operation();
        
        // Success - reset state
        setState({
          isRetrying: false,
          attempt: 0,
          lastError: null,
        });

        return result;
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (!isRetryableError(error)) {
          setState({
            isRetrying: false,
            attempt: attempt - 1,
            lastError: error,
          });
          throw error;
        }

        // If this is the last attempt, throw the error
        if (attempt === maxAttempts) {
          setState({
            isRetrying: false,
            attempt: attempt - 1,
            lastError: error,
          });
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );

        // Call onRetry callback
        if (onRetry) {
          onRetry(attempt, error);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
  }, [operation, maxAttempts, initialDelay, maxDelay, backoffMultiplier, onRetry]);

  return [executeWithRetry, state];
}

/**
 * Simple retry function (non-hook version)
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 8000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      // Call onRetry callback
      if (onRetry) {
        onRetry(attempt, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
