/**
 * useOptimisticUpdate Hook
 * 
 * Hook for optimistic UI updates with rollback on error
 */

import { useState, useCallback, useRef } from 'react';

export interface OptimisticUpdateOptions<T> {
  onUpdate: (data: T) => Promise<T>;
  onRollback?: (data: T) => void;
  onSuccess?: (data: T) => void;
  onError?: (error: any, data: T) => void;
}

export interface OptimisticUpdateState {
  isUpdating: boolean;
  hasError: boolean;
  error: any | null;
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  options: OptimisticUpdateOptions<T>
): [T, (updateFn: (data: T) => T) => Promise<void>, OptimisticUpdateState] {
  const [data, setData] = useState<T>(initialData);
  const [state, setState] = useState<OptimisticUpdateState>({
    isUpdating: false,
    hasError: false,
    error: null,
  });
  
  const previousDataRef = useRef<T>(initialData);

  const updateOptimistically = useCallback(
    async (updateFn: (data: T) => T) => {
      // Save current state for rollback
      previousDataRef.current = data;

      // Optimistically update UI
      const optimisticData = updateFn(data);
      setData(optimisticData);
      setState({
        isUpdating: true,
        hasError: false,
        error: null,
      });

      try {
        // Perform actual update
        const result = await options.onUpdate(optimisticData);

        // Update with server response
        setData(result);
        setState({
          isUpdating: false,
          hasError: false,
          error: null,
        });

        // Call success callback
        if (options.onSuccess) {
          options.onSuccess(result);
        }
      } catch (error: any) {
        // Rollback on error
        setData(previousDataRef.current);
        setState({
          isUpdating: false,
          hasError: true,
          error,
        });

        // Call rollback callback
        if (options.onRollback) {
          options.onRollback(previousDataRef.current);
        }

        // Call error callback
        if (options.onError) {
          options.onError(error, previousDataRef.current);
        }

        // Re-throw error so caller can handle it
        throw error;
      }
    },
    [data, options]
  );

  return [data, updateOptimistically, state];
}

/**
 * Simple optimistic update function (non-hook version)
 */
export async function optimisticUpdate<T>(
  currentData: T,
  updateFn: (data: T) => T,
  onUpdate: (data: T) => Promise<T>,
  onRollback?: (data: T) => void
): Promise<T> {
  const previousData = currentData;
  const optimisticData = updateFn(currentData);

  try {
    const result = await onUpdate(optimisticData);
    return result;
  } catch (error) {
    // Rollback
    if (onRollback) {
      onRollback(previousData);
    }
    throw error;
  }
}
