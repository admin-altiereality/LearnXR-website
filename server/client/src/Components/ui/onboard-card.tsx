"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { IoMdCheckmark } from "react-icons/io";
import { LuLoader } from "react-icons/lu";

interface OnboardCardProps {
  duration?: number;
  step1?: string;
  step2?: string;
  step3?: string;
  progress?: number; // Optional: external progress control (0-100)
  isVisible?: boolean; // Optional: control visibility
}

const OnboardCard = ({
  duration = 3000,
  step1 = "Skybox Generation",
  step2 = "3D Model Generation",
  step3 = "Assets Merging",
  progress: externalProgress,
  isVisible = true,
}: OnboardCardProps) => {
  const [progress, setProgress] = useState(0);
  const [animateKey, setAnimateKey] = useState(0);

  // Use external progress if provided, otherwise use internal animation
  const currentProgress = externalProgress !== undefined ? externalProgress : progress;

  useEffect(() => {
    if (externalProgress !== undefined) {
      // If external progress is provided, use it directly
      setProgress(externalProgress);
      return;
    }

    // Internal animation logic
    const forward = setTimeout(() => setProgress(100), 100);
    const reset = setTimeout(() => {
      setProgress(0); // Reset progress for next animation cycle
      setAnimateKey((k) => k + 1);
    }, duration + 2000);

    return () => {
      clearTimeout(forward);
      clearTimeout(reset);
    };
  }, [animateKey, duration, externalProgress]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "relative",
        "flex flex-col items-center justify-center gap-3 p-4",
        "w-full max-w-[500px] mx-auto",
        "pointer-events-none"
      )}
    >
      {/* Step 3 - Top (Future/Upcoming) */}
      <motion.div
        initial={{ opacity: 0.6, scale: 0.92 }}
        animate={{ opacity: 0.65, scale: 0.92 }}
        transition={{ duration: 0.3 }}
        className="w-full min-h-[85px] flex flex-col justify-center gap-3 rounded-xl border border-[#262626] bg-[#0a0a0a]/45 py-4 px-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-start gap-3 text-sm text-gray-400">
          <div className="flex items-center justify-center">
            <LuLoader className="w-5 h-5 text-gray-500" />
          </div>
          <div className="font-medium">{step3}</div>
        </div>
        <div className="ml-8 h-1.5 w-[calc(100%-2rem)] overflow-hidden rounded-full bg-[#1f1f1f]">
          <div className="h-full w-full bg-[#1f1f1f]" />
        </div>
      </motion.div>

      {/* Step 2 - Middle (Active/Processing) */}
      <motion.div
        initial={{ opacity: 0.9, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full min-h-[110px] flex flex-col justify-center gap-3 rounded-xl border-2 border-sky-500/50 bg-[#0a0a0a]/60 py-5 px-7 shadow-[0_12px_40px_rgba(14,165,233,0.2),0_0_0_1px_rgba(14,165,233,0.15)] relative overflow-hidden"
      >
        {/* Subtle animated glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-500/3 to-transparent animate-pulse" />
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 text-base text-sky-300 font-semibold">
            <div className="flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <LuLoader className="w-6 h-6 text-sky-400" />
              </motion.div>
            </div>
            <div>{step2}</div>
          </div>
          {/* Progress percentage - positioned on the right */}
          <div className="text-sm text-sky-400 font-bold">
            {Math.round(currentProgress)}%
          </div>
        </div>
        <div className="ml-8 h-2 w-[calc(100%-2rem)] overflow-hidden rounded-full bg-[#1f1f1f] relative z-10">
          <motion.div
            key={animateKey}
            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
            initial={{ width: 0 }}
            animate={{ width: `${currentProgress}%` }}
            transition={{ 
              duration: externalProgress !== undefined ? 0.3 : duration / 1000, 
              ease: "easeInOut" 
            }}
          />
        </div>
      </motion.div>

      {/* Step 1 - Bottom (Completed) */}
      <motion.div
        initial={{ opacity: 0.6, scale: 0.92 }}
        animate={{ opacity: 0.65, scale: 0.92 }}
        transition={{ duration: 0.3 }}
        className="w-full min-h-[85px] flex flex-col justify-center gap-3 rounded-xl border border-emerald-500/40 bg-[#0a0a0a]/45 py-4 px-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-start gap-3 text-sm text-emerald-300">
          <div className="relative flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <svg width="24" height="24" className="drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]">
                <circle cx="12" cy="12" r="9" fill="#22c55e" opacity="0.9" />
                <circle cx="12" cy="12" r="9" fill="url(#checkGradient)" />
                <defs>
                  <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="1" />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity="1" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <IoMdCheckmark className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="font-medium">{step1}</div>
        </div>
        <div className="ml-8 h-1.5 w-[calc(100%-2rem)] overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-green-500">
          <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-green-500" />
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardCard;

