/**
 * Loading States Components
 * 
 * Reusable loading components for different states
 */

import React from 'react';
import { Loader2, Box, Package } from 'lucide-react';

/**
 * Skeleton loader for asset grid
 */
export const AssetGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-xl border border-slate-700/30 bg-slate-800/30 animate-pulse"
        >
          <div className="aspect-square bg-slate-900/50 rounded-lg mb-2" />
          <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-1" />
          <div className="h-3 bg-slate-700/50 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton loader for asset list
 */
export const AssetListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 rounded-xl border border-slate-700/30 bg-slate-800/30 animate-pulse"
        >
          <div className="w-14 h-14 bg-slate-900/50 rounded-lg flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Loading spinner
 */
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <Loader2 className={`${sizeClasses[size]} text-cyan-500 animate-spin ${className}`} />
  );
};

/**
 * Full page loading state
 */
export const FullPageLoading: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
};

/**
 * Empty state component
 */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}> = ({ icon, title, message, action }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center mb-6 border border-white/10">
        {icon || <Package className="w-12 h-12 text-slate-500" />}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 text-center max-w-md mb-8">{message}</p>
      {action}
    </div>
  );
};
