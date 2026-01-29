# Browser Console Debugging Guide

## Overview

All logs are now visible in the browser console (F12) with enhanced formatting and styling. The application logs to both:
1. **Browser Console (F12)** - Immediate visibility for debugging
2. **Firestore** - Persistent storage for production debugging

## Accessing the Console

- **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (Mac)
- **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows/Linux) / `Cmd+Option+K` (Mac)
- **Safari**: Enable Developer menu first, then `Cmd+Option+C`

## Log Levels and Colors

The console uses color-coded logs for easy identification:

- 🔍 **DEBUG** - Gray (`#94a3b8`) - Detailed debugging information
- ℹ️ **INFO** - Blue (`#60a5fa`) - General information
- ✅ **SUCCESS** - Green (`#10b981`) - Successful operations
- ⚠️ **WARNING** - Yellow (`#fbbf24`) - Warnings that don't break functionality
- ❌ **ERROR** - Red (`#f87171`) - Errors that need attention
- 🚨 **CRITICAL** - Red with background (`#ef4444`) - Critical errors requiring immediate attention

## What Gets Logged

### 1. Application Initialization
- App startup message
- Environment information (mode, base URL, user agent)
- Timestamp

### 2. API Calls
All API calls are logged with:
- Method (GET, POST, PUT, DELETE, etc.)
- URL endpoint
- Status code
- Duration (in milliseconds)
- Response data (for successful calls)
- Error details (for failed calls)

Example:
```
✅ API: POST /api/assistant [200] (245ms)
❌ API: GET /api/data [401] (120ms)
```

### 3. Errors
All errors are logged with:
- Error message
- Error stack trace
- Error code (if available)
- Context information
- User information
- URL where error occurred
- Session ID

### 4. User Actions
Important user actions are logged:
- Button clicks
- Form submissions
- Navigation events
- Data changes

### 5. Component Lifecycle
React component mount/unmount/update events (in development mode)

## Console Features

### Grouped Logs
Errors and critical issues are grouped for easier navigation:
- Click to expand/collapse
- See all related information in one place

### Tables
Metadata and structured data are displayed as tables:
- Click on table headers to sort
- Easier to read complex data structures

### Stack Traces
Full stack traces are available for:
- JavaScript errors
- React component errors
- API errors

## Using Console Utilities

The application provides global console utilities accessible from the browser console:

```javascript
// Enhanced logging
consoleLog.info('Information message');
consoleLog.success('Success message');
consoleLog.warn('Warning message');
consoleLog.error('Error message', errorObject);
consoleLog.critical('Critical message', errorObject);

// API call logging
logApiCall('POST', '/api/endpoint', 200, 150);

// User action logging
logUserAction('button-clicked', { buttonId: 'submit' });

// Component logging
logComponent.mount('MyComponent', props);
logComponent.update('MyComponent', changes);
logComponent.unmount('MyComponent');

// Table display
consoleLog.table(data, 'Data Label');

// Timing
consoleLog.time('Operation');
// ... do work ...
consoleLog.timeEnd('Operation');
```

## Filtering Logs

Use the browser console's filter options:

1. **Filter by text**: Type in the filter box to search logs
2. **Filter by level**: 
   - Click the filter icon
   - Select log levels (Errors, Warnings, Info, etc.)
3. **Filter by source**: Filter by file or component name

## Common Debugging Scenarios

### 1. Debugging API Calls
```javascript
// All API calls are automatically logged
// Look for logs starting with: ✅ API: or ❌ API:
// Check the status code, duration, and response data
```

### 2. Debugging Errors
```javascript
// Errors are logged with full context
// Look for logs starting with: ❌ ERROR: or 🚨 CRITICAL:
// Expand the grouped log to see:
// - Error message
// - Stack trace
// - Error code
// - User context
// - URL where error occurred
```

### 3. Debugging User Actions
```javascript
// User actions are logged with details
// Look for logs starting with: 👤 User Action:
// Check the action name and associated data
```

### 4. Performance Debugging
```javascript
// API call durations are logged
// Look for: (XXXms) in API logs
// Use consoleLog.time() and consoleLog.timeEnd() for custom timing
```

## Tips for Effective Debugging

1. **Use Console Filters**: Filter by error level or search for specific terms
2. **Expand Grouped Logs**: Click on grouped logs to see all details
3. **Check Stack Traces**: Always check stack traces for error location
4. **Monitor API Calls**: Watch for slow API calls (high duration)
5. **Check Network Tab**: Use Network tab alongside Console for API debugging
6. **Use Breakpoints**: Set breakpoints in Sources tab for step-by-step debugging

## Production vs Development

- **Development**: More verbose logging, component lifecycle events
- **Production**: Essential logs only, but all errors and API calls are still logged

## Accessing Production Logs

For production debugging, logs are also stored in Firestore:
1. Log in as superadmin
2. Navigate to "Production Logs" in sidebar
3. View, filter, and export logs from the admin interface

## Console Shortcuts

- `Ctrl+L` (Windows/Linux) / `Cmd+K` (Mac) - Clear console
- `Ctrl+F` (Windows/Linux) / `Cmd+F` (Mac) - Search in console
- `Esc` - Toggle console drawer (when DevTools is docked)

## Best Practices

1. **Always check console first** when debugging issues
2. **Look for error patterns** - multiple similar errors indicate systemic issues
3. **Check API call durations** - slow calls may indicate performance issues
4. **Use console filters** to focus on specific error types
5. **Export console logs** if needed (right-click on console → Save as...)
