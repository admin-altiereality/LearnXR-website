import React from 'react';
import { motion } from 'framer-motion';

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
  // Calculate overall progress - single unified value
  const calculateOverallProgress = () => {
    if (skyboxEnabled && meshEnabled) {
      // Dual generation: average of both
      return Math.round((skyboxProgress + meshProgress) / 2);
    } else if (skyboxEnabled) {
      return Math.round(skyboxProgress);
    } else if (meshEnabled) {
      return Math.round(meshProgress);
    }
    return 0;
  };

  const overallProgress = calculateOverallProgress();

  // Determine current stage message
  const getStageMessage = () => {
    if (overallMessage) return overallMessage;
    if (skyboxEnabled && meshEnabled) {
      return `Creating your immersive 3D environment... ${overallProgress}%`;
    } else if (skyboxEnabled) {
      return `Generating skybox... ${overallProgress}%`;
    } else if (meshEnabled) {
      return `Generating 3D mesh... ${overallProgress}%`;
    }
    return `Processing... ${overallProgress}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="w-full"
    >
      <div className="space-y-1.5">
        {/* Single Progress Bar Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-gray-300 flex items-center gap-2">
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${
                overallProgress === 100 ? 'bg-emerald-400' : 'bg-sky-400/80'
              } ${overallProgress < 100 ? 'animate-pulse' : ''}`} />
              {overallProgress < 100 && (
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-sky-400/40 animate-ping" />
              )}
            </div>
            <span className="tracking-[0.05em]">Generation</span>
          </span>
          <span className={`text-[11px] font-semibold tabular-nums ${
            overallProgress === 100 ? 'text-emerald-400' : 'text-sky-400'
          }`}>
            {overallProgress}%
          </span>
        </div>
        
        {/* Single Progress Bar */}
        <div className="relative w-full h-1.5 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={`h-full relative overflow-hidden ${
              overallProgress === 100
                ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                : skyboxEnabled && meshEnabled
                ? 'bg-gradient-to-r from-sky-500 via-violet-500 to-purple-500'
                : skyboxEnabled
                ? 'bg-gradient-to-r from-sky-500 via-sky-400 to-indigo-500'
                : 'bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500'
            }`}
          >
            {overallProgress < 100 && (
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
            )}
          </motion.div>
        </div>

        {/* Status Message */}
        <p className="text-[10px] text-gray-400 mt-1 truncate">
          {getStageMessage()}
        </p>
      </div>
    </motion.div>
  );
};

