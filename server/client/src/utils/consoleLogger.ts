/**
 * Enhanced Console Logger
 * 
 * Provides enhanced console logging utilities that work alongside
 * the production logger, ensuring all logs are visible in browser F12 console
 */

/**
 * Enhanced console log with styling
 */
export const consoleLog = {
  debug: (message: string, ...args: any[]) => {
    console.log(
      `%c🔍 DEBUG: ${message}`,
      'color: #94a3b8; font-weight: normal;',
      ...args
    );
  },

  info: (message: string, ...args: any[]) => {
    console.info(
      `%cℹ️ INFO: ${message}`,
      'color: #60a5fa; font-weight: bold;',
      ...args
    );
  },

  success: (message: string, ...args: any[]) => {
    console.log(
      `%c✅ SUCCESS: ${message}`,
      'color: #10b981; font-weight: bold;',
      ...args
    );
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(
      `%c⚠️ WARNING: ${message}`,
      'color: #fbbf24; font-weight: bold;',
      ...args
    );
  },

  error: (message: string, error?: Error | any, ...args: any[]) => {
    console.groupCollapsed(
      `%c❌ ERROR: ${message}`,
      'color: #f87171; font-weight: bold; background: #fee2e2; padding: 2px 4px; border-radius: 2px;'
    );
    console.error('Message:', message);
    if (error) {
      console.error('Error:', error);
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
        console.error('Name:', error.name);
      }
    }
    if (args.length > 0) {
      console.error('Additional data:', ...args);
    }
    console.groupEnd();
  },

  critical: (message: string, error?: Error | any, ...args: any[]) => {
    console.group(
      `%c🚨 CRITICAL: ${message}`,
      'color: #ef4444; font-weight: bold; background: #fee2e2; padding: 4px 8px; border-radius: 4px; font-size: 14px;'
    );
    console.error('Message:', message);
    if (error) {
      console.error('Error:', error);
      if (error instanceof Error) {
        console.error('Stack:', error.stack);
        console.error('Name:', error.name);
      }
    }
    if (args.length > 0) {
      console.error('Additional data:', ...args);
    }
    console.trace('Call stack:');
    console.groupEnd();
  },

  table: (data: any, label?: string) => {
    if (label) {
      console.log(`%c📊 ${label}`, 'color: #8b5cf6; font-weight: bold;');
    }
    console.table(data);
  },

  group: (label: string, collapsed = false) => {
    const method = collapsed ? console.groupCollapsed : console.group;
    method(`%c📁 ${label}`, 'color: #8b5cf6; font-weight: bold;');
  },

  groupEnd: () => {
    console.groupEnd();
  },

  time: (label: string) => {
    console.time(`⏱️ ${label}`);
  },

  timeEnd: (label: string) => {
    console.timeEnd(`⏱️ ${label}`);
  },
};

/**
 * Log API call to console
 */
export const logApiCall = (
  method: string,
  url: string,
  statusCode?: number,
  duration?: number,
  error?: Error
) => {
  const statusEmoji = error
    ? '❌'
    : statusCode && statusCode >= 400
    ? '⚠️'
    : '✅';

  const statusColor = error
    ? '#f87171'
    : statusCode && statusCode >= 400
    ? '#fbbf24'
    : '#10b981';

  console.log(
    `%c${statusEmoji} API: ${method.toUpperCase()} ${url}${statusCode ? ` [${statusCode}]` : ''}${duration ? ` (${duration}ms)` : ''}`,
    `color: ${statusColor}; font-weight: bold;`,
    error || ''
  );
};

/**
 * Log user action to console
 */
export const logUserAction = (action: string, details?: Record<string, any>) => {
  console.log(
    `%c👤 User Action: ${action}`,
    'color: #06b6d4; font-weight: bold;',
    details || ''
  );
};

/**
 * Log component lifecycle
 */
export const logComponent = {
  mount: (componentName: string, props?: any) => {
    console.log(
      `%c⚛️ Component Mounted: ${componentName}`,
      'color: #10b981; font-weight: bold;',
      props || ''
    );
  },

  unmount: (componentName: string) => {
    console.log(
      `%c⚛️ Component Unmounted: ${componentName}`,
      'color: #f87171; font-weight: bold;'
    );
  },

  update: (componentName: string, changes?: any) => {
    console.log(
      `%c⚛️ Component Updated: ${componentName}`,
      'color: #fbbf24; font-weight: bold;',
      changes || ''
    );
  },
};

// Make console logger available globally for easy access
if (typeof window !== 'undefined') {
  (window as any).consoleLog = consoleLog;
  (window as any).logApiCall = logApiCall;
  (window as any).logUserAction = logUserAction;
  (window as any).logComponent = logComponent;
}
