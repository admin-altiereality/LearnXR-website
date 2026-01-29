/**
 * Production Logger Service
 * 
 * Centralized logging service that stores logs in Firestore for production debugging.
 * Logs are categorized by level and include context for easier debugging.
 */

import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  id?: string;
  level: LogLevel;
  message: string;
  context?: string;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  url?: string;
  userAgent?: string;
  timestamp?: Timestamp | Date;
  sessionId?: string;
}

class ProductionLogger {
  private sessionId: string;
  private isProduction: boolean;
  private logQueue: LogEntry[] = [];
  private queueProcessing = false;
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly BATCH_SIZE = 10;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
    
    // Process queue periodically
    if (this.isProduction) {
      setInterval(() => this.processQueue(), 5000); // Process every 5 seconds
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUser() {
    try {
      const auth = getAuth();
      return auth.currentUser;
    } catch {
      return null;
    }
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'authorization', 'auth'];
    
    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    error?: Error | any,
    metadata?: Record<string, any>
  ): LogEntry {
    const user = this.getCurrentUser();
    const entry: LogEntry = {
      level,
      message,
      context,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: new Date(),
    };

    if (user) {
      entry.userId = user.uid;
      entry.userEmail = user.email || undefined;
    }

    if (error) {
      entry.error = {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
      };
    }

    if (metadata) {
      entry.metadata = this.sanitizeMetadata(metadata);
    }

    return entry;
  }

  private async saveLogToFirestore(entry: LogEntry): Promise<void> {
    try {
      // Only save to Firestore in production or if explicitly enabled
      if (!this.isProduction && import.meta.env.VITE_ENABLE_LOGGING !== 'true') {
        // In development, just log to console
        console.log(`[${entry.level.toUpperCase()}]`, entry);
        return;
      }

      await addDoc(collection(db, 'production_logs'), {
        ...entry,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      // Fallback to console if Firestore fails
      console.error('Failed to save log to Firestore:', error);
      console.error('Original log entry:', entry);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queueProcessing || this.logQueue.length === 0) {
      return;
    }

    this.queueProcessing = true;

    try {
      const batch = [...this.logQueue];
      this.logQueue = [];

      // Process in batches to avoid overwhelming Firestore
      for (let i = 0; i < batch.length; i += this.BATCH_SIZE) {
        const batchChunk = batch.slice(i, i + this.BATCH_SIZE);
        await Promise.allSettled(
          batchChunk.map(entry => this.saveLogToFirestore(entry))
        );
      }
    } catch (error) {
      console.error('Error processing log queue:', error);
      // Re-add failed logs to queue (up to max size)
      if (this.logQueue.length < this.MAX_QUEUE_SIZE) {
        this.logQueue.push(...this.logQueue);
      }
    } finally {
      this.queueProcessing = false;
    }
  }

  private queueLog(entry: LogEntry): void {
    // Enhanced console logging with styling and grouping
    const timestamp = new Date().toISOString();
    const contextLabel = entry.context ? `[${entry.context}]` : '';
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      critical: '🚨'
    }[entry.level];

    // Create styled console log
    const consoleStyle = this.getConsoleStyle(entry.level);
    const logPrefix = `%c${levelEmoji} [${entry.level.toUpperCase()}]${contextLabel} ${timestamp}`;
    
    // Always log to console for immediate visibility in browser F12
    if (entry.level === 'error' || entry.level === 'critical') {
      console.groupCollapsed(logPrefix, consoleStyle);
      console.error('Message:', entry.message);
      if (entry.error) {
        console.error('Error:', entry.error);
        if (entry.error.stack) {
          console.error('Stack:', entry.error.stack);
        }
        if (entry.error.code) {
          console.error('Code:', entry.error.code);
        }
      }
      if (entry.metadata) {
        console.table(entry.metadata);
      }
      if (entry.userId) {
        console.log('User:', entry.userId, entry.userEmail || '');
      }
      if (entry.url) {
        console.log('URL:', entry.url);
      }
      if (entry.sessionId) {
        console.log('Session:', entry.sessionId);
      }
      console.groupEnd();
    } else if (entry.level === 'warn') {
      console.warn(logPrefix, consoleStyle, entry.message);
      if (entry.error) {
        console.warn('Warning details:', entry.error);
      }
      if (entry.metadata) {
        console.table(entry.metadata);
      }
    } else if (entry.level === 'info') {
      console.info(logPrefix, consoleStyle, entry.message);
      if (entry.metadata) {
        console.log('Details:', entry.metadata);
      }
    } else {
      // Debug level
      console.log(logPrefix, consoleStyle, entry.message);
      if (entry.metadata) {
        console.log('Details:', entry.metadata);
      }
    }

    // Also log the full entry object for detailed inspection
    if (entry.level === 'error' || entry.level === 'critical' || entry.level === 'warn') {
      console.log('Full log entry:', entry);
    }

    // Queue for Firestore
    if (this.isProduction || import.meta.env.VITE_ENABLE_LOGGING === 'true') {
      if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
        // Remove oldest entry
        this.logQueue.shift();
      }
      this.logQueue.push(entry);
      
      // Process immediately for critical errors
      if (entry.level === 'critical' || entry.level === 'error') {
        this.processQueue();
      }
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #94a3b8; font-weight: normal;',
      info: 'color: #60a5fa; font-weight: bold;',
      warn: 'color: #fbbf24; font-weight: bold;',
      error: 'color: #f87171; font-weight: bold;',
      critical: 'color: #ef4444; font-weight: bold; background: #fee2e2; padding: 2px 4px; border-radius: 2px;'
    };
    return styles[level];
  }

  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('debug', message, context, undefined, metadata);
    this.queueLog(entry);
  }

  info(message: string, context?: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('info', message, context, undefined, metadata);
    this.queueLog(entry);
  }

  warn(message: string, context?: string, error?: Error | any, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('warn', message, context, error, metadata);
    this.queueLog(entry);
  }

  error(message: string, context?: string, error?: Error | any, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('error', message, context, error, metadata);
    this.queueLog(entry);
  }

  critical(message: string, context?: string, error?: Error | any, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry('critical', message, context, error, metadata);
    this.queueLog(entry);
    // Process immediately for critical errors
    this.processQueue();
  }

  /**
   * Log a user action (for audit trail)
   */
  logUserAction(action: string, details?: Record<string, any>): void {
    this.info(`User action: ${action}`, 'user-action', details);
  }

  /**
   * Log API call
   */
  logApiCall(endpoint: string, method: string, statusCode?: number, duration?: number, error?: Error): void {
    const metadata: Record<string, any> = {
      endpoint,
      method,
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
    };

    if (error) {
      this.error(`API call failed: ${method} ${endpoint}`, 'api-call', error, metadata);
    } else if (statusCode && statusCode >= 400) {
      this.warn(`API call warning: ${method} ${endpoint} - Status ${statusCode}`, 'api-call', undefined, metadata);
    } else {
      // Log successful API calls at info level for visibility
      this.info(`API call: ${method} ${endpoint}${statusCode ? ` - ${statusCode}` : ''}${duration ? ` (${duration}ms)` : ''}`, 'api-call', metadata);
    }
  }

  /**
   * Flush all pending logs (useful before page unload)
   */
  async flush(): Promise<void> {
    await this.processQueue();
  }
}

// Singleton instance
export const productionLogger = new ProductionLogger();

// Flush logs before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    productionLogger.flush();
  });
}

// Export convenience functions
export const logDebug = (message: string, context?: string, metadata?: Record<string, any>) => 
  productionLogger.debug(message, context, metadata);

export const logInfo = (message: string, context?: string, metadata?: Record<string, any>) => 
  productionLogger.info(message, context, metadata);

export const logWarn = (message: string, context?: string, error?: Error | any, metadata?: Record<string, any>) => 
  productionLogger.warn(message, context, error, metadata);

export const logError = (message: string, context?: string, error?: Error | any, metadata?: Record<string, any>) => 
  productionLogger.error(message, context, error, metadata);

export const logCritical = (message: string, context?: string, error?: Error | any, metadata?: Record<string, any>) => 
  productionLogger.critical(message, context, error, metadata);
