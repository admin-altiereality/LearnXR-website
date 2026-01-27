/**
 * Progress Indicator Component
 * 
 * Component for showing operation progress
 */

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProgressIndicatorProps {
  progress: number;
  message?: string;
  error?: string;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  message,
  error,
  className = '',
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`space-y-2 ${className}`}>
      {message && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">{message}</span>
          <span className="text-slate-500">{Math.round(clampedProgress)}%</span>
        </div>
      )}

      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            error
              ? 'bg-red-500'
              : progress === 100
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500'
          }`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {progress === 100 && !error && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>Complete</span>
        </div>
      )}
    </div>
  );
};

/**
 * Inline progress indicator
 */
export const InlineProgress: React.FC<{
  progress: number;
  size?: 'sm' | 'md';
}> = ({ progress, size = 'md' }) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const height = size === 'sm' ? 'h-1' : 'h-2';

  return (
    <div className={`w-full ${height} bg-slate-800 rounded-full overflow-hidden`}>
      <div
        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
};
