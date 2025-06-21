import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

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
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log additional context for debugging
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href
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
