/**
 * React Hook for Production Logger
 * 
 * Provides easy access to production logging in React components
 */

import { useCallback } from 'react';
import { productionLogger, LogLevel } from '../services/productionLogger';

export function useProductionLogger() {
  const log = useCallback((
    level: LogLevel,
    message: string,
    context?: string,
    error?: Error | any,
    metadata?: Record<string, any>
  ) => {
    switch (level) {
      case 'debug':
        productionLogger.debug(message, context, metadata);
        break;
      case 'info':
        productionLogger.info(message, context, metadata);
        break;
      case 'warn':
        productionLogger.warn(message, context, error, metadata);
        break;
      case 'error':
        productionLogger.error(message, context, error, metadata);
        break;
      case 'critical':
        productionLogger.critical(message, context, error, metadata);
        break;
    }
  }, []);

  const logUserAction = useCallback((action: string, details?: Record<string, any>) => {
    productionLogger.logUserAction(action, details);
  }, []);

  const logApiCall = useCallback((
    endpoint: string,
    method: string,
    statusCode?: number,
    duration?: number,
    error?: Error
  ) => {
    productionLogger.logApiCall(endpoint, method, statusCode, duration, error);
  }, []);

  return {
    log,
    logUserAction,
    logApiCall,
    debug: (message: string, context?: string, metadata?: Record<string, any>) =>
      productionLogger.debug(message, context, metadata),
    info: (message: string, context?: string, metadata?: Record<string, any>) =>
      productionLogger.info(message, context, metadata),
    warn: (message: string, context?: string, error?: Error | any, metadata?: Record<string, any>) =>
      productionLogger.warn(message, context, error, metadata),
    error: (message: string, context?: string, error?: Error | any, metadata?: Record<string, any>) =>
      productionLogger.error(message, context, error, metadata),
    critical: (message: string, context?: string, error?: Error | any, metadata?: Record<string, any>) =>
      productionLogger.critical(message, context, error, metadata),
  };
}
