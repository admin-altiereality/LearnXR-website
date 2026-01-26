import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Global error handlers for production debugging
// These will catch errors that occur outside React components
window.addEventListener('error', (event) => {
  console.error('🚨 Global Error Handler:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  });
  
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
}, true);

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled Promise Rejection:', {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  });
  
  if (event.reason) {
    console.error('Rejection reason:', event.reason);
    if (event.reason instanceof Error) {
      console.error('Error stack:', event.reason.stack);
    }
  }
}, true);

// Log when modules are loaded (helps debug initialization order)
if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
  console.log('🔍 Development mode: Enhanced error logging enabled');
} else {
  console.log('🔍 Production mode: Enhanced error logging enabled');
  console.log('📝 All console logs are preserved for debugging');
}

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
    console.error('📋 Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
    
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

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
