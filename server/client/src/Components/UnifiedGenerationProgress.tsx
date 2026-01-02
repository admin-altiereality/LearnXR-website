import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UnifiedGenerationProgressProps {
  skyboxProgress: number;
  meshProgress: number;
  skyboxEnabled: boolean;
  meshEnabled: boolean;
  skyboxMessage?: string;
  meshMessage?: string;
  overallMessage?: string;
}

export const UnifiedGenerationProgress: React.FC<UnifiedGenerationProgressProps> = ({
  skyboxProgress,
  meshProgress,
  skyboxEnabled,
  meshEnabled
}) => {
  // Determine if we're generating both
  const isDualGeneration = skyboxEnabled && meshEnabled;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full space-y-2.5 p-2.5 bg-gradient-to-br from-[#0f0f0f]/60 to-[#0a0a0a]/80 border border-[#1a1a1a]/50 rounded-lg backdrop-blur-sm"
      >
        {/* Dual Progress Indicators (when both are enabled) */}
        {isDualGeneration && (
          <div className="grid grid-cols-2 gap-3">
            {/* Skybox Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-300 flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-sky-400/80 animate-pulse" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-sky-400/40 animate-ping" />
                  </div>
                  <span className="tracking-[0.05em]">Skybox</span>
                </span>
                <span className="text-[11px] font-semibold text-sky-400 tabular-nums">
                  {Math.round(skyboxProgress)}%
                </span>
              </div>
              <div className="relative w-full h-1.5 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${skyboxProgress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-sky-500 via-sky-400 to-indigo-500 relative overflow-hidden"
                >
                  <motion.div
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: 'linear'
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                </motion.div>
              </div>
            </div>

            {/* Mesh Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-300 flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-purple-400/80 animate-pulse" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-purple-400/40 animate-ping" />
                  </div>
                  <span className="tracking-[0.05em]">3D Mesh</span>
                </span>
                <span className="text-[11px] font-semibold text-purple-400 tabular-nums">
                  {Math.round(meshProgress)}%
                </span>
              </div>
              <div className="relative w-full h-1.5 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${meshProgress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500 relative overflow-hidden"
                >
                  <motion.div
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: 'linear'
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  />
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* Single Generation Indicator (when only one is enabled) */}
        {!isDualGeneration && (
          <div className="space-y-2">
            {skyboxEnabled && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-300 flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-sky-400/80 animate-pulse" />
                      <div className="absolute inset-0 w-2 h-2 rounded-full bg-sky-400/40 animate-ping" />
                    </div>
                    <span className="tracking-[0.05em]">Skybox Generation</span>
                  </span>
                  <span className="text-[11px] font-semibold text-sky-400 tabular-nums">
                    {Math.round(skyboxProgress)}%
                  </span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${skyboxProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-sky-500 via-sky-400 to-indigo-500 relative overflow-hidden"
                  >
                    <motion.div
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: 'linear'
                      }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  </motion.div>
                </div>
              </div>
            )}
              {meshEnabled && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gray-300 flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-purple-400/80 animate-pulse" />
                      <div className="absolute inset-0 w-2 h-2 rounded-full bg-purple-400/40 animate-ping" />
                    </div>
                    <span className="tracking-[0.05em]">3D Mesh Generation</span>
                  </span>
                  <span className="text-[11px] font-semibold text-purple-400 tabular-nums">
                    {Math.round(meshProgress)}%
                  </span>
                </div>
                <div className="relative w-full h-2 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${meshProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500 relative overflow-hidden"
                  >
                    <motion.div
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: 'linear'
                      }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generation Status Icons */}
        <div className="flex items-center gap-3 pt-1 border-t border-[#1a1a1a]/50">
          {skyboxEnabled && (
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div
                animate={skyboxProgress === 100 ? { scale: [1, 1.3, 1] } : { scale: [1, 1.2, 1] }}
                transition={{ repeat: skyboxProgress === 100 ? 0 : Infinity, duration: 1.5 }}
                className={`w-2.5 h-2.5 rounded-full ${
                  skyboxProgress === 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-sky-400'
                }`}
              />
              <span className={`text-[10px] font-medium tracking-[0.05em] ${
                skyboxProgress === 100 ? 'text-emerald-400' : 'text-gray-400'
              }`}>
                Skybox {skyboxProgress === 100 ? '✓' : 'Processing'}
              </span>
            </motion.div>
          )}
          {meshEnabled && (
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                animate={meshProgress === 100 ? { scale: [1, 1.3, 1] } : { scale: [1, 1.2, 1] }}
                transition={{ repeat: meshProgress === 100 ? 0 : Infinity, duration: 1.5, delay: 0.3 }}
                className={`w-2.5 h-2.5 rounded-full ${
                  meshProgress === 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-purple-400'
                }`}
              />
              <span className={`text-[10px] font-medium tracking-[0.05em] ${
                meshProgress === 100 ? 'text-emerald-400' : 'text-gray-400'
              }`}>
                Mesh {meshProgress === 100 ? '✓' : 'Processing'}
              </span>
            </motion.div>
          )}
          {/* Show unified completion indicator */}
          {isDualGeneration && skyboxProgress === 100 && meshProgress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-emerald-400 font-semibold ml-auto"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px] tracking-[0.05em]">Complete</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

