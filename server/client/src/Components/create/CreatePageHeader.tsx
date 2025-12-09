/**

 * CreatePageHeader - Glassmorphism header for In3D.AI Create Page
 * 
 * A modern, sleek header component with glassmorphism design inspired by
 * skybox.blockadelabs.com. Features soft shadows, smooth transitions,
 * and a clean minimal aesthetic.
 */

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface CreatePageHeaderProps {
  planName: string;
  currentUsage: number;
  currentLimit: number;
  isUnlimited: boolean;
  isGenerating: boolean;
  generationsRemaining: number | string;
  onUpgrade?: () => void;
}

const CreatePageHeader: React.FC<CreatePageHeaderProps> = ({
  planName,
  currentUsage,
  currentLimit,
  isUnlimited,
  isGenerating,
  generationsRemaining,
  onUpgrade
}) => {
  const { user } = useAuth();
  const usagePercentage = isUnlimited ? 0 : Math.min((currentUsage / currentLimit) * 100, 100);
  const isTrialUser = planName?.toLowerCase() === 'free' || planName?.toLowerCase() === 'free plan';

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Glassmorphism container */}
      <div className="mx-4 mt-4">
        <div className="
          relative
          backdrop-blur-xl
          bg-white/[0.03]
          border border-white/[0.08]
          rounded-2xl
          shadow-[0_8px_32px_rgba(0,0,0,0.4)]
          px-6 py-4
          overflow-hidden
        ">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/[0.03] via-transparent to-purple-500/[0.03] pointer-events-none" />
          
          {/* Content */}
          <div className="relative flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              {/* Logo mark */}
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                {/* Pulse animation when generating */}
                {isGenerating && (
                  <div className="absolute inset-0 rounded-xl bg-sky-400/30 animate-ping" />
                )}
              </div>
              
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold text-white tracking-tight">
                  In3D<span className="text-sky-400">.AI</span>
                </h1>
                <span className="text-[11px] text-gray-400 tracking-wide">
                  Environment Studio
                </span>
              </div>
            </div>

            {/* Center - Status indicator */}
            <div className="hidden md:flex items-center gap-3">
              {isGenerating ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-sky-300 font-medium">Generating...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                  <span className="text-xs text-emerald-300 font-medium">Ready</span>
                </div>
              )}
            </div>

            {/* Right side - User & Plan info */}
            <div className="flex items-center gap-4">
              {/* Usage info */}
              <div className="hidden sm:flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className={`
                    text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full
                    ${isTrialUser 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }
                  `}>
                    {planName}
                  </span>
                </div>
                
                {!isUnlimited && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          usagePercentage > 80 
                            ? 'bg-gradient-to-r from-red-500 to-orange-500' 
                            : 'bg-gradient-to-r from-sky-400 to-emerald-400'
                        }`}
                        style={{ width: `${usagePercentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {generationsRemaining} left
                    </span>
                  </div>
                )}
              </div>

              {/* Upgrade button for trial users */}
              {isTrialUser && onUpgrade && (
                <button
                  onClick={onUpgrade}
                  className="
                    hidden sm:flex items-center gap-2
                    px-4 py-2 rounded-xl
                    bg-gradient-to-r from-violet-500 to-purple-600
                    hover:from-violet-400 hover:to-purple-500
                    text-white text-xs font-semibold
                    shadow-lg shadow-purple-500/25
                    transition-all duration-300
                    hover:shadow-purple-500/40 hover:scale-105
                  "
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Upgrade</span>
                </button>
              )}

              {/* User avatar */}
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center overflow-hidden">
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-gray-900" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default CreatePageHeader;

