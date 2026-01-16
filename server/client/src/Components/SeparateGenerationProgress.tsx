import React from 'react';
import { motion } from 'framer-motion';

interface SeparateGenerationProgressProps {
  skyboxProgress: number;
  meshProgress: number;
  skyboxEnabled: boolean;
  meshEnabled: boolean;
  skyboxMessage?: string;
  meshMessage?: string;
}

export const SeparateGenerationProgress: React.FC<SeparateGenerationProgressProps> = ({
  skyboxProgress,
  meshProgress,
  skyboxEnabled,
  meshEnabled,
  skyboxMessage,
  meshMessage
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full"
    >
      <div className="grid grid-cols-2 gap-2">
        {/* Skybox Progress - Left */}
        {skyboxEnabled && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-300 flex items-center gap-1.5">
                <div className="relative">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    skyboxProgress === 100 ? 'bg-emerald-400' : 'bg-sky-400/80'
                  } ${skyboxProgress < 100 ? 'animate-pulse' : ''}`} />
                  {skyboxProgress < 100 && (
                    <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-sky-400/40 animate-ping" />
                  )}
                </div>
                <span className="tracking-[0.05em]">Skybox</span>
              </span>
              <span className={`text-[10px] font-semibold tabular-nums ${
                skyboxProgress === 100 ? 'text-emerald-400' : 'text-sky-400'
              }`}>
                {Math.round(skyboxProgress)}%
              </span>
            </div>
            
            <div className="relative w-full h-1 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${skyboxProgress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`h-full relative overflow-hidden ${
                  skyboxProgress === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-sky-500 via-sky-400 to-indigo-500'
                }`}
              >
                {skyboxProgress < 100 && (
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

            {skyboxMessage && (
              <p className="text-[9px] text-gray-400 truncate">
                {skyboxMessage}
              </p>
            )}
          </div>
        )}

        {/* 3D Asset Progress - Right */}
        {meshEnabled && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-gray-300 flex items-center gap-1.5">
                <div className="relative">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    meshProgress === 100 ? 'bg-emerald-400' : 'bg-purple-400/80'
                  } ${meshProgress < 100 ? 'animate-pulse' : ''}`} />
                  {meshProgress < 100 && (
                    <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-purple-400/40 animate-ping" />
                  )}
                </div>
                <span className="tracking-[0.05em]">3D Asset</span>
              </span>
              <span className={`text-[10px] font-semibold tabular-nums ${
                meshProgress === 100 ? 'text-emerald-400' : 'text-purple-400'
              }`}>
                {Math.round(meshProgress)}%
              </span>
            </div>
            
            <div className="relative w-full h-1 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${meshProgress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className={`h-full relative overflow-hidden ${
                  meshProgress === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500'
                }`}
              >
                {meshProgress < 100 && (
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

            {meshMessage && (
              <p className="text-[9px] text-gray-400 truncate">
                {meshMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
