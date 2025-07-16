// Error Handling Service - Comprehensive error handling and retry logic
// Provides retry mechanisms, exponential backoff, and error categorization

import type { ApiError, RetryConfig } from '../types/unifiedGeneration';

export class ErrorHandlingService {
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2,
    retryableErrors: [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMIT',
      'SERVER_ERROR',
      'QUOTA_EXCEEDED',
      'SERVICE_UNAVAILABLE'
    ]
  };

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: {
      operation: string;
      provider: 'skybox' | 'mesh';
      maxRetries?: number;
      retryDelay?: number;
    }
  ): Promise<T> {
    const maxRetries = context.maxRetries || this.retryConfig.maxRetries;
    const baseDelay = context.retryDelay || this.retryConfig.retryDelay;
    
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        console.log(`🔄 ${context.operation} attempt ${attempt + 1}/${maxRetries + 1} (${context.provider})`);
        const result = await fn();
        
        if (attempt > 0) {
          console.log(`✅ ${context.operation} succeeded after ${attempt} retries (${context.provider})`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        attempt++;
        
        console.error(`❌ ${context.operation} failed (attempt ${attempt}/${maxRetries + 1}):`, lastError.message);
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt > maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
        const finalDelay = delay + jitter;
        
        console.log(`⏳ Retrying ${context.operation} in ${Math.round(finalDelay)}ms (${context.provider})`);
        await this.sleep(finalDelay);
      }
    }

    // All retries failed
    const apiError = this.createApiError(lastError!, context.provider);
    throw this.enhanceError(lastError!, {
      operation: context.operation,
      provider: context.provider,
      attempts: attempt,
      apiError
    });
  }

  /**
   * Create standardized API error
   */
  createApiError(error: Error, provider: 'skybox' | 'mesh'): ApiError {
    const errorCode = this.categorizeError(error);
    
    return {
      provider,
      error: error.message,
      code: errorCode,
      retryable: this.isRetryableError(error),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Categorize error based on message and type
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('connection') || 
        message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests') ||
        message.includes('429')) {
      return 'RATE_LIMIT';
    }
    
    // Server errors
    if (message.includes('500') || message.includes('502') || 
        message.includes('503') || message.includes('504') ||
        message.includes('server error') || message.includes('internal error')) {
      return 'SERVER_ERROR';
    }
    
    // Quota exceeded
    if (message.includes('quota') || message.includes('limit exceeded') ||
        message.includes('insufficient credits')) {
      return 'QUOTA_EXCEEDED';
    }
    
    // Service unavailable
    if (message.includes('unavailable') || message.includes('down') ||
        message.includes('maintenance')) {
      return 'SERVICE_UNAVAILABLE';
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('invalid api key') ||
        message.includes('403') || message.includes('401')) {
      return 'AUTH_ERROR';
    }
    
    // Validation errors
    if (message.includes('invalid') || message.includes('validation') ||
        message.includes('bad request') || message.includes('400')) {
      return 'VALIDATION_ERROR';
    }
    
    // Default
    return 'UNKNOWN_ERROR';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorCode = this.categorizeError(error);
    return this.retryConfig.retryableErrors.includes(errorCode);
  }

  /**
   * Enhance error with additional context
   */
  private enhanceError(error: Error, context: {
    operation: string;
    provider: 'skybox' | 'mesh';
    attempts: number;
    apiError: ApiError;
  }): Error {
    const enhancedError = new Error(
      `${context.operation} failed after ${context.attempts} attempts (${context.provider}): ${error.message}`
    );
    
    // Add custom properties
    (enhancedError as any).originalError = error;
    (enhancedError as any).provider = context.provider;
    (enhancedError as any).operation = context.operation;
    (enhancedError as any).attempts = context.attempts;
    (enhancedError as any).apiError = context.apiError;
    (enhancedError as any).retryable = this.isRetryableError(error);
    
    return enhancedError;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle provider-specific errors
   */
  handleProviderError(error: Error, provider: 'skybox' | 'mesh'): {
    canRetry: boolean;
    shouldFailFast: boolean;
    userMessage: string;
    technicalMessage: string;
  } {
    const errorCode = this.categorizeError(error);
    const canRetry = this.isRetryableError(error);
    
    let userMessage = '';
    let shouldFailFast = false;
    
    switch (errorCode) {
      case 'NETWORK_ERROR':
        userMessage = 'Network connection issue. Please check your internet connection.';
        break;
        
      case 'TIMEOUT':
        userMessage = `${provider === 'skybox' ? 'Skybox' : '3D model'} generation is taking longer than expected. Please try again.`;
        break;
        
      case 'RATE_LIMIT':
        userMessage = 'Too many requests. Please wait a moment before trying again.';
        break;
        
      case 'SERVER_ERROR':
        userMessage = `${provider === 'skybox' ? 'Skybox' : '3D model'} service is temporarily unavailable. Please try again later.`;
        break;
        
      case 'QUOTA_EXCEEDED':
        userMessage = `${provider === 'skybox' ? 'Skybox' : '3D model'} generation quota exceeded. Please upgrade your plan or try again tomorrow.`;
        shouldFailFast = true;
        break;
        
      case 'SERVICE_UNAVAILABLE':
        userMessage = `${provider === 'skybox' ? 'Skybox' : '3D model'} service is temporarily down for maintenance.`;
        break;
        
      case 'AUTH_ERROR':
        userMessage = 'Authentication failed. Please check your API keys or contact support.';
        shouldFailFast = true;
        break;
        
      case 'VALIDATION_ERROR':
        userMessage = 'Invalid input parameters. Please check your prompt and settings.';
        shouldFailFast = true;
        break;
        
      default:
        userMessage = `${provider === 'skybox' ? 'Skybox' : '3D model'} generation failed. Please try again.`;
        break;
    }
    
    return {
      canRetry,
      shouldFailFast,
      userMessage,
      technicalMessage: error.message
    };
  }

  /**
   * Handle partial failures in parallel generation
   */
  handlePartialFailure(
    skyboxError: Error | null,
    meshError: Error | null
  ): {
    status: 'completed' | 'partial' | 'failed';
    message: string;
    errors: string[];
    canRetry: boolean;
  } {
    const errors: string[] = [];
    let canRetry = false;
    
    if (skyboxError) {
      const skyboxHandling = this.handleProviderError(skyboxError, 'skybox');
      errors.push(`Skybox: ${skyboxHandling.userMessage}`);
      canRetry = canRetry || (skyboxHandling.canRetry && !skyboxHandling.shouldFailFast);
    }
    
    if (meshError) {
      const meshHandling = this.handleProviderError(meshError, 'mesh');
      errors.push(`3D Model: ${meshHandling.userMessage}`);
      canRetry = canRetry || (meshHandling.canRetry && !meshHandling.shouldFailFast);
    }
    
    let status: 'completed' | 'partial' | 'failed' = 'completed';
    let message = '';
    
    if (skyboxError && meshError) {
      status = 'failed';
      message = 'Both skybox and 3D model generation failed';
    } else if (skyboxError || meshError) {
      status = 'partial';
      message = skyboxError ? 
        '3D model generated successfully, but skybox generation failed' :
        'Skybox generated successfully, but 3D model generation failed';
    } else {
      status = 'completed';
      message = 'Both skybox and 3D model generated successfully';
    }
    
    return {
      status,
      message,
      errors,
      canRetry
    };
  }

  /**
   * Create user-friendly error messages
   */
  createUserErrorMessage(error: Error, provider: 'skybox' | 'mesh'): string {
    const handling = this.handleProviderError(error, provider);
    return handling.userMessage;
  }

  /**
   * Log error for debugging
   */
  logError(error: Error, context: {
    operation: string;
    provider: 'skybox' | 'mesh';
    userId?: string;
    jobId?: string;
    prompt?: string;
  }): void {
    const apiError = this.createApiError(error, context.provider);
    
    console.error(`🚨 Error in ${context.operation}:`, {
      error: error.message,
      stack: error.stack,
      provider: context.provider,
      code: apiError.code,
      retryable: apiError.retryable,
      userId: context.userId,
      jobId: context.jobId,
      prompt: context.prompt?.substring(0, 100) + '...',
      timestamp: apiError.timestamp
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByProvider: Record<string, number>;
    errorsByType: Record<string, number>;
    retryableErrors: number;
    nonRetryableErrors: number;
  } {
    // This would typically be implemented with a persistent error tracking system
    // For now, return placeholder data
    return {
      totalErrors: 0,
      errorsByProvider: {},
      errorsByType: {},
      retryableErrors: 0,
      nonRetryableErrors: 0
    };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config
    };
  }

  /**
   * Get retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Check if service is healthy
   */
  async checkServiceHealth(provider: 'skybox' | 'mesh'): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // This would typically ping the service endpoints
      // For now, simulate a health check
      await this.sleep(100);
      
      return {
        healthy: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Circuit breaker pattern for repeated failures
   */
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: number;
    isOpen: boolean;
    timeout: number;
  }> = new Map();

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(provider: 'skybox' | 'mesh'): boolean {
    const breaker = this.circuitBreakers.get(provider);
    if (!breaker) return false;
    
    // Check if timeout has passed
    if (breaker.isOpen && Date.now() - breaker.lastFailure > breaker.timeout) {
      breaker.isOpen = false;
      breaker.failures = 0;
    }
    
    return breaker.isOpen;
  }

  /**
   * Record failure for circuit breaker
   */
  recordFailure(provider: 'skybox' | 'mesh'): void {
    const breaker = this.circuitBreakers.get(provider) || {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      timeout: 60000 // 1 minute
    };
    
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    // Open circuit if too many failures
    if (breaker.failures >= 5) {
      breaker.isOpen = true;
      console.warn(`🔴 Circuit breaker opened for ${provider} provider`);
    }
    
    this.circuitBreakers.set(provider, breaker);
  }

  /**
   * Record success for circuit breaker
   */
  recordSuccess(provider: 'skybox' | 'mesh'): void {
    const breaker = this.circuitBreakers.get(provider);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
    }
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService(); 