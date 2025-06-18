import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Error boundary for catching React errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
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
          <div style={{ textAlign: 'center' }}>
            <h1>Something went wrong</h1>
            <p>Please refresh the page or try again later.</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{
                padding: '10px 20px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
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
