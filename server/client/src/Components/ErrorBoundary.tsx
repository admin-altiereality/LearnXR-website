/**
 * Error Boundary
 * 
 * Error boundary component for catching React errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { productionLogger } from '../services/productionLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isBenignError?: boolean;
}

/** Errors from browser extensions / third-party iframes (Firebase Auth, Razorpay, etc.) when message port closes. Not app bugs. */
function isBenignExtensionOrIframeError(error: Error | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('message port closed') ||
    msg.includes('message channel closed') ||
    msg.includes('before a response was received') ||
    msg.includes('runtime.lasterror') ||
    msg.includes('extension context invalidated')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isBenignError = isBenignExtensionOrIframeError(error);
    return {
      hasError: true,
      error,
      isBenignError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isBenignError = isBenignExtensionOrIframeError(error);
    this.setState({
      error,
      errorInfo,
      isBenignError,
    });

    if (isBenignError) {
      console.warn('ErrorBoundary: benign extension/iframe error (ignoring for user):', error.message);
      return;
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Log to production logger (skip for benign errors)
    productionLogger.critical(
      `ErrorBoundary: ${error.message}`,
      'error-boundary',
      error,
      {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
      }
    );

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const benign = this.state.isBenignError === true;

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a] p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl p-8">
            {!benign && (
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            )}
            
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              {benign ? 'Connection hiccup' : 'Something went wrong'}
            </h2>
            
            <p className="text-slate-400 text-center mb-6">
              {benign
                ? 'A brief connection issue occurred (common when joining a class). Click Try Again to continue.'
                : 'An unexpected error occurred. Please try refreshing the page.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && !benign && (
              <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <p className="text-xs text-red-400 font-mono mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer hover:text-slate-400 mb-2">
                      Stack trace
                    </summary>
                    <pre className="overflow-auto max-h-48 text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                         text-sm font-medium text-white
                         bg-gradient-to-r from-cyan-500 to-blue-600
                         hover:from-cyan-400 hover:to-blue-500
                         rounded-lg transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              {!benign && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                           text-sm font-medium text-slate-300
                           bg-slate-800 hover:bg-slate-700
                           rounded-lg transition-all"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
