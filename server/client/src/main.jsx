import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { productionLogger } from './services/productionLogger';
import './utils/consoleLogger'; // Initialize enhanced console logging
import LearnXRLoader from './Components/LearnXRLoader';

// Global error handlers for production debugging
// These will catch errors that occur outside React components
window.addEventListener('error', (event) => {
  const errorDetails = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.error('🚨 Global Error Handler:', errorDetails);
  
  // Log the full error object
  if (event.error) {
    console.error('Error object:', event.error);
    console.error('Error name:', event.error?.name);
    console.error('Error message:', event.error?.message);
    console.error('Error stack:', event.error?.stack);
  }
  
  // Log if it's a ReferenceError (like "cannot access 'Bt' before initialisation")
  if (event.error instanceof ReferenceError) {
    console.error('🔴 ReferenceError detected - This usually indicates:');
    console.error('  1. Circular dependency');
    console.error('  2. Variable accessed before initialization');
    console.error('  3. Hoisting issue');
    console.error('  4. Module import order problem');
  }

  // Log to production logger
  productionLogger.critical(
    `Global Error: ${event.message}`,
    'global-error-handler',
    event.error,
    {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }
  );
}, true);

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const rejectionDetails = {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.error('🚨 Unhandled Promise Rejection:', rejectionDetails);
  
  if (event.reason) {
    console.error('Rejection reason:', event.reason);
    if (event.reason instanceof Error) {
      console.error('Error stack:', event.reason.stack);
    }
  }

  // Log to production logger
  const error = event.reason instanceof Error 
    ? event.reason 
    : new Error(String(event.reason));
  
  productionLogger.error(
    `Unhandled Promise Rejection: ${error.message}`,
    'unhandled-rejection',
    error,
    {
      reason: String(event.reason),
    }
  );
}, true);

// Enhanced console logging initialization
const initConsoleLogging = () => {
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const mode = isDev ? 'Development' : 'Production';
  
  console.log(
    `%c🚀 LearnXR Application Started`,
    'color: #06b6d4; font-size: 16px; font-weight: bold; padding: 4px;'
  );
  console.log(
    `%c📊 Mode: ${mode} | Enhanced Logging: Enabled | Console: F12`,
    'color: #94a3b8; font-size: 12px;'
  );
  console.log(
    `%c📝 All logs are visible in browser console (F12) and stored in Firestore for production debugging`,
    'color: #60a5fa; font-size: 11px; font-style: italic;'
  );
  
  // Log environment info
  console.groupCollapsed('%c🔧 Environment Information', 'color: #fbbf24; font-weight: bold;');
  console.log('Mode:', mode);
  console.log('Environment:', import.meta.env.MODE);
  console.log('Base URL:', window.location.origin);
  console.log('User Agent:', navigator.userAgent);
  console.log('Timestamp:', new Date().toISOString());
  console.groupEnd();
};

// Initialize console logging
initConsoleLogging();

// Error boundary for catching React errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 React Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log additional context for debugging
    const errorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };
    
    console.error('📋 Error details:', errorDetails);
    
    // Special handling for ReferenceError (like "cannot access 'Bt' before initialisation")
    if (error instanceof ReferenceError) {
      console.error('🔴 ReferenceError detected in React component!');
      console.error('   This usually indicates:');
      console.error('   1. Circular dependency between modules');
      console.error('   2. Variable accessed before initialization');
      console.error('   3. Hoisting issue with let/const');
      console.error('   4. Module import order problem');
      console.error('   Check the component stack above to find the problematic component.');
    }
    
    // Log all available error properties
    console.error('🔍 Full error object:', {
      ...error,
      toString: error.toString(),
      constructor: error.constructor?.name,
    });

    // Log to production logger
    productionLogger.critical(
      `React Error Boundary: ${error.message}`,
      'react-error-boundary',
      error,
      {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
      }
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', padding: '20px' }}>
            <h1>Something went wrong</h1>
            <p>Please refresh the page or try again later.</p>
            {this.state.error && (
              <details style={{ marginTop: '20px', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', color: '#3B82F6' }}>Error Details</summary>
                <pre style={{ 
                  backgroundColor: '#1f2937', 
                  padding: '10px', 
                  borderRadius: '5px', 
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button 
              onClick={() => window.location.reload()} 
              style={{
                padding: '10px 20px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));

// Render loader first, then app
const AppWithLoader = () => {
  const [showLoader, setShowLoader] = React.useState(true);

  return (
    <>
      {showLoader && <LearnXRLoader onComplete={() => setShowLoader(false)} />}
      <App />
    </>
  );
};

root.render(
  <StrictMode>
    <ErrorBoundary>
      <AppWithLoader />
    </ErrorBoundary>
  </StrictMode>
);
