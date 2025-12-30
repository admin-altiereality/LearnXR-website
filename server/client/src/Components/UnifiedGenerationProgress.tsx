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
  meshEnabled,
  overallMessage
}) => {
  // Calculate overall progress as average of both (when both enabled)
  const overallProgress = skyboxEnabled && meshEnabled
    ? Math.round((skyboxProgress + meshProgress) / 2)
    : skyboxEnabled
    ? Math.round(skyboxProgress)
    : Math.round(meshProgress);

  // Determine if we're generating both
  const isDualGeneration = skyboxEnabled && meshEnabled;
  
  // Get status message
  const getStatusMessage = () => {
    if (overallMessage) return overallMessage;
    
    // Check if both are complete
    const bothComplete = isDualGeneration && skyboxProgress === 100 && meshProgress === 100;
    const skyboxComplete = skyboxEnabled && skyboxProgress === 100;
    const meshComplete = meshEnabled && meshProgress === 100;
    
    if (bothComplete) {
      return '✨ Your immersive 3D environment is ready!';
    } else if (skyboxComplete && meshEnabled) {
      return 'Skybox complete! Finalizing 3D mesh...';
    } else if (meshComplete && skyboxEnabled) {
      return '3D mesh complete! Finalizing skybox...';
    } else if (isDualGeneration) {
      if (overallProgress < 10) return 'Initializing generation...';
      if (overallProgress < 30) return 'Creating your 3D environment...';
      if (overallProgress < 60) return 'Generating skybox and 3D mesh in parallel...';
      if (overallProgress < 90) return 'Finalizing your immersive experience...';
      return 'Almost ready!';
    } else if (skyboxEnabled) {
      if (skyboxProgress < 10) return 'Initializing skybox generation...';
      if (skyboxProgress < 50) return 'Creating your environment...';
      if (skyboxProgress < 90) return 'Rendering skybox...';
      return 'Finalizing...';
    } else {
      if (meshProgress < 10) return 'Initializing mesh generation...';
      if (meshProgress < 50) return 'Creating 3D model...';
      if (meshProgress < 90) return 'Rendering mesh...';
      return 'Finalizing...';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full space-y-3"
      >
        {/* Unified Progress Bar */}
        <div className="space-y-2">
          {/* Status Message */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">
              {getStatusMessage()}
            </span>
            <span className="text-xs text-sky-400 font-semibold">
              {overallProgress}%
            </span>
          </div>

          {/* Main Unified Progress Bar */}
          <div className="relative w-full h-2 rounded-full bg-[#1f1f1f] overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-purple-500/20" />
            
            {/* Unified progress fill with blended gradient */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden"
            >
              {/* Animated shimmer effect */}
              <motion.div
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: 'linear'
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />
            </motion.div>
          </div>

          {/* Dual Progress Indicators (when both are enabled) */}
          {isDualGeneration && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {/* Skybox Mini Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    Skybox
                  </span>
                  <span className="text-sky-400 font-medium">
                    {Math.round(skyboxProgress)}%
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-[#1f1f1f] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${skyboxProgress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-500"
                  />
                </div>
              </div>

              {/* Mesh Mini Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    3D Mesh
                  </span>
                  <span className="text-purple-400 font-medium">
                    {Math.round(meshProgress)}%
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-[#1f1f1f] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${meshProgress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Single Generation Indicator (when only one is enabled) */}
          {!isDualGeneration && (
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                skyboxEnabled ? 'bg-sky-400' : 'bg-purple-400'
              } animate-pulse`} />
              <span className="text-[10px] text-gray-400">
                {skyboxEnabled ? 'Skybox generation in progress' : '3D mesh generation in progress'}
              </span>
            </div>
          )}
        </div>

        {/* Generation Status Icons */}
        <div className="flex items-center gap-4 text-[10px]">
          {skyboxEnabled && (
            <motion.div 
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div
                animate={skyboxProgress === 100 ? { scale: [1, 1.3, 1] } : { scale: [1, 1.2, 1] }}
                transition={{ repeat: skyboxProgress === 100 ? 0 : Infinity, duration: 1.5 }}
                className={`w-2 h-2 rounded-full ${
                  skyboxProgress === 100 ? 'bg-emerald-500' : 'bg-sky-400'
                }`}
              />
              <span className={skyboxProgress === 100 ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
                Skybox {skyboxProgress === 100 ? '✓' : '...'}
              </span>
            </motion.div>
          )}
          {meshEnabled && (
            <motion.div 
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                animate={meshProgress === 100 ? { scale: [1, 1.3, 1] } : { scale: [1, 1.2, 1] }}
                transition={{ repeat: meshProgress === 100 ? 0 : Infinity, duration: 1.5, delay: 0.3 }}
                className={`w-2 h-2 rounded-full ${
                  meshProgress === 100 ? 'bg-emerald-500' : 'bg-purple-400'
                }`}
              />
              <span className={meshProgress === 100 ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
                Mesh {meshProgress === 100 ? '✓' : '...'}
              </span>
            </motion.div>
          )}
          {/* Show unified completion indicator */}
          {isDualGeneration && skyboxProgress === 100 && meshProgress === 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-emerald-400 font-semibold"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Complete</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

