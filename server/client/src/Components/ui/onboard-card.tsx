"use client";

import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { IoMdCheckmark } from "react-icons/io";
import { LuLoader } from "react-icons/lu";
import { useCreateGeneration } from "../../contexts/CreateGenerationContext";

interface OnboardCardProps {
  duration?: number;
  step1?: string;
  step2?: string;
  step3?: string;
  progress?: number; // Optional: external progress control (0-100)
  isVisible?: boolean; // Optional: control visibility
  currentStep?: number; // 1, 2, or 3 - which step is currently active
  completedSteps?: number[]; // Array of completed step numbers
}

interface Step {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'completed';
  progress: number;
}

const OnboardCard = ({
  duration = 3000,
  step1 = "Skybox Generation",
  step2 = "3D Model Generation",
  step3 = "Assets Merging",
  progress: externalProgress,
  isVisible: externalIsVisible,
  currentStep: externalCurrentStep,
  completedSteps: externalCompletedSteps,
}: OnboardCardProps) => {
  // Use global generation context (always available since OnboardCard is used within CreateGenerationProvider)
  const generationContext = useCreateGeneration();
  const generationState = generationContext?.state || null;
  
  const [animateKey, setAnimateKey] = useState(0);
  
  // Determine visibility from context or props
  // Hide when both generations are complete
  const isVisible = useMemo(() => {
    if (externalIsVisible !== undefined) return externalIsVisible;
    if (generationState) {
      // Show if either is generating, or if both just completed (for completion animation)
      const bothJustCompleted = !generationState.isGenerating && 
                                 !generationState.isGenerating3DAsset &&
                                 generationState.skyboxProgress >= 100 &&
                                 (generationState.assetGenerationProgress?.progress === 100 || 
                                  !generationState.assetGenerationProgress);
      return generationState.isGenerating || generationState.isGenerating3DAsset || bothJustCompleted;
    }
    return false;
  }, [externalIsVisible, generationState]);

  // Calculate steps based on generation state
  const steps = useMemo<Step[]>(() => {
    if (!generationState && !externalCurrentStep) {
      // Fallback to default steps if no context
      return [
        { id: 1, label: step1, status: 'pending', progress: 0 },
        { id: 2, label: step2, status: 'pending', progress: 0 },
        { id: 3, label: step3, status: 'pending', progress: 0 },
      ];
    }

    const stepsArray: Step[] = [];
    
    // Step 1: Skybox Generation
    const skyboxCompleted = generationState 
      ? !generationState.isGenerating && generationState.skyboxProgress >= 100
      : externalCompletedSteps?.includes(1) || false;
    const skyboxActive = generationState 
      ? generationState.isGenerating
      : externalCurrentStep === 1;
    const skyboxProgress = generationState 
      ? generationState.skyboxProgress 
      : (externalCurrentStep === 1 && externalProgress !== undefined ? externalProgress : 0);
    
    stepsArray.push({
      id: 1,
      label: step1 || "Skybox Generation",
      status: skyboxCompleted ? 'completed' : (skyboxActive ? 'active' : 'pending'),
      progress: skyboxProgress
    });

    // Step 2: 3D Model Generation
    const assetCompleted = generationState 
      ? !generationState.isGenerating3DAsset && generationState.assetGenerationProgress?.progress === 100
      : externalCompletedSteps?.includes(2) || false;
    const assetActive = generationState 
      ? generationState.isGenerating3DAsset
      : externalCurrentStep === 2;
    const assetProgress = generationState 
      ? (generationState.assetGenerationProgress?.progress || 0)
      : (externalCurrentStep === 2 && externalProgress !== undefined ? externalProgress : 0);
    
    stepsArray.push({
      id: 2,
      label: step2 || (generationState?.assetGenerationProgress?.message || "3D Model Generation"),
      status: assetCompleted ? 'completed' : (assetActive ? 'active' : 'pending'),
      progress: assetProgress
    });

    // Step 3: Assets Merging (only show if both are done or in progress)
    const bothCompleted = skyboxCompleted && assetCompleted;
    const mergingActive = skyboxCompleted && assetActive;
    const mergingProgress = mergingActive ? assetProgress : (bothCompleted ? 100 : 0);
    
    stepsArray.push({
      id: 3,
      label: step3 || "Assets Merging",
      status: bothCompleted ? 'completed' : (mergingActive ? 'active' : 'pending'),
      progress: mergingProgress
    });

    return stepsArray;
  }, [generationState, step1, step2, step3, externalCurrentStep, externalCompletedSteps, externalProgress]);

  // Auto-reset when both generations complete
  useEffect(() => {
    if (generationState && !generationState.isGenerating && !generationState.isGenerating3DAsset) {
      // Both generations complete - reset after a delay
      const resetTimer = setTimeout(() => {
        setAnimateKey(0);
      }, 2000);
      return () => clearTimeout(resetTimer);
    }
  }, [generationState]);

  useEffect(() => {
    // If using context, don't use internal animation
    if (generationState) {
      return;
    }

    // Internal animation logic (only if not using context and no external progress)
    if (externalProgress === undefined) {
      const reset = setTimeout(() => {
        setAnimateKey((k) => k + 1);
      }, duration + 2000);

      return () => {
        clearTimeout(reset);
      };
    }
  }, [animateKey, duration, externalProgress, generationState]);

  if (!isVisible) return null;

  // Get steps in display order: completed at bottom, active in middle, pending at top
  const completedStepsList = steps.filter(s => s.status === 'completed');
  const activeStep = steps.find(s => s.status === 'active');
  const pendingStepsList = steps.filter(s => s.status === 'pending');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative",
        "flex flex-col items-center justify-center gap-2.5 p-3",
        "w-full max-w-[520px] mx-auto",
        "pointer-events-none"
      )}
    >
      {/* Pending Steps - Top */}
      <AnimatePresence mode="popLayout">
        {pendingStepsList.map((step) => (
          <motion.div
            key={`pending-${step.id}`}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 0.7, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full min-h-[70px] flex flex-col justify-center gap-2 rounded-2xl border border-[#262626] backdrop-blur-xl bg-[#141414]/60 py-3 px-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/[0.01] via-transparent to-purple-500/[0.01] pointer-events-none" />
            
            <div className="relative flex items-center justify-start gap-2.5 text-xs text-gray-400">
              <div className="flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <LuLoader className="w-4 h-4 text-gray-500/60" />
                </motion.div>
              </div>
              <div className="font-medium">{step.label}</div>
            </div>
            <div className="ml-8 h-1.5 w-[calc(100%-2rem)] overflow-hidden rounded-full bg-[#1f1f1f]/80 backdrop-blur-sm">
              <div className="h-full w-full bg-[#1f1f1f]" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Active Step - Middle */}
      <AnimatePresence mode="wait">
        {activeStep && (
          <motion.div
            key={`active-${activeStep.id}`}
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full min-h-[90px] flex flex-col justify-center gap-3 rounded-2xl border-2 border-sky-500/60 backdrop-blur-2xl bg-[#141414]/85 py-4 px-6 shadow-[0_12px_40px_rgba(14,165,233,0.25),0_0_0_1px_rgba(14,165,233,0.2),0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            {/* Animated gradient border glow */}
            <motion.div
              className="absolute -inset-0.5 rounded-2xl opacity-60 blur-xl"
              animate={{
                background: [
                  "linear-gradient(135deg, rgba(14,165,233,0.4), rgba(99,102,241,0.3), rgba(14,165,233,0.4))",
                  "linear-gradient(135deg, rgba(99,102,241,0.4), rgba(14,165,233,0.3), rgba(99,102,241,0.4))",
                  "linear-gradient(135deg, rgba(14,165,233,0.4), rgba(99,102,241,0.3), rgba(14,165,233,0.4))",
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Subtle animated glow effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-500/5 to-transparent"
              animate={{
                x: ["-100%", "100%"]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            
            <div className="relative flex items-center justify-between z-10">
              <div className="flex items-center gap-3 text-sm text-sky-300 font-semibold">
                <div className="relative flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="relative"
                  >
                    <LuLoader className="w-5 h-5 text-sky-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
                    <motion.div
                      className="absolute inset-0 rounded-full bg-sky-400/30 blur-md"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0.8, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </motion.div>
                </div>
                <div className="flex items-center gap-2">
                  <span>{activeStep.label}</span>
                  <motion.span
                    className="text-xs text-sky-400/80 font-normal"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Generating...
                  </motion.span>
                </div>
              </div>
              {/* Progress percentage - positioned on the right */}
              <motion.div
                className="text-base text-sky-300 font-bold tabular-nums"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                key={Math.round(activeStep.progress)}
              >
                {Math.round(activeStep.progress)}%
              </motion.div>
            </div>
            <div className="ml-9 h-2 w-[calc(100%-2.25rem)] overflow-hidden rounded-full bg-[#1f1f1f]/90 backdrop-blur-sm relative z-10">
              {/* Progress bar with animated gradient */}
              <motion.div
                key={`progress-${activeStep.id}-${animateKey}`}
                className="h-full rounded-full relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${activeStep.progress}%` }}
                transition={{ 
                  duration: generationState ? 0.5 : (externalProgress !== undefined ? 0.3 : duration / 1000), 
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                {/* Animated gradient background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  style={{
                    backgroundSize: "200% 100%"
                  }}
                />
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ["-100%", "100%"]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completed Steps - Bottom (animated to slide down) */}
      <AnimatePresence mode="popLayout">
        {completedStepsList.map((step) => (
          <motion.div
            key={`completed-${step.id}`}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 0.8, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.16, 1, 0.3, 1],
              layout: { duration: 0.5 }
            }}
            className="relative w-full min-h-[70px] flex flex-col justify-center gap-2 rounded-2xl border border-emerald-500/50 backdrop-blur-xl bg-[#141414]/60 py-3 px-5 shadow-[0_8px_32px_rgba(34,197,94,0.15),0_0_0_1px_rgba(34,197,94,0.1)] overflow-hidden"
          >
            {/* Subtle emerald glow overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-transparent to-emerald-500/[0.02] pointer-events-none" />
            
            <div className="relative flex items-center justify-start gap-2.5 text-xs text-emerald-300">
              <div className="relative flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 200, 
                    damping: 15,
                    delay: 0.2 
                  }}
                  className="relative"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(34,197,94,0.6)] flex items-center justify-center">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 20,
                        delay: 0.3 
                      }}
                    >
                      <IoMdCheckmark className="w-3 h-3 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
                    </motion.div>
                  </div>
                  {/* Pulsing glow effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </motion.div>
              </div>
              <div className="font-medium">{step.label}</div>
            </div>
            <div className="ml-7 h-1.5 w-[calc(100%-1.75rem)] overflow-hidden rounded-full bg-[#1f1f1f]/80 backdrop-blur-sm relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 rounded-full relative overflow-hidden"
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{
                    x: ["-100%", "100%"]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default OnboardCard;

