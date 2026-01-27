/**
 * Error Display Component
 * 
 * Component for displaying user-friendly error messages with actions
 */

import React from 'react';
import { AlertCircle, RefreshCw, X, HelpCircle } from 'lucide-react';
import { classifyError, getErrorRecovery } from '../utils/errorHandler';
import type { ErrorClassification } from '../utils/errorHandler';

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}) => {
  const classification: ErrorClassification = classifyError(error);

  const getErrorIcon = () => {
    switch (classification.type) {
      case 'permission':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'network':
        return <AlertCircle className="w-5 h-5 text-blue-400" />;
      case 'file':
      case 'validation':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getErrorColor = () => {
    switch (classification.type) {
      case 'permission':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'network':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'file':
      case 'validation':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getErrorColor()} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getErrorIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold mb-1">
            {classification.userMessage}
          </h3>
          
          {classification.action && (
            <p className="text-xs opacity-90 mb-3">
              {classification.action}
            </p>
          )}

          {showDetails && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer opacity-75 hover:opacity-100 mb-2">
                Technical details
              </summary>
              <div className="text-xs font-mono opacity-75 bg-black/20 p-2 rounded">
                {classification.technicalMessage}
              </div>
            </details>
          )}

          <div className="flex items-center gap-2 mt-3">
            {classification.canRetry && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         bg-white/10 hover:bg-white/20 rounded-md
                         transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         bg-white/10 hover:bg-white/20 rounded-md
                         transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
