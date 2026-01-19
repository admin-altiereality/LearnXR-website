/**
 * LessonModeOverlay - Controls the lesson flow on the /main page
 * 
 * Shows lesson progress, controls avatar scripts, and displays MCQs
 * when a lesson is active from the Content Studio.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLesson, LessonPhase } from '../contexts/LessonContext';
import {
  X,
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  BookOpen,
  MessageSquare,
  Award,
  ArrowRight,
  RefreshCw,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react';

interface LessonModeOverlayProps {
  avatarRef: React.RefObject<{ sendMessage: (text: string) => Promise<void>; stopSpeaking?: () => void }>;
  onSetSkybox?: (url: string) => void;
  onSet3DAsset?: (url: string) => void;
}

export const LessonModeOverlay = ({
  avatarRef,
  onSetSkybox,
  onSet3DAsset,
}: LessonModeOverlayProps) => {
  const {
    activeLesson,
    lessonPhase,
    setPhase,
    advanceScript,
    getCurrentScript,
    hasNextScript,
    endLesson,
    submitQuizResults,
  } = useLesson();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScriptPlaying, setCurrentScriptPlaying] = useState('');
  const [mcqAnswers, setMcqAnswers] = useState<{ [key: string]: number }>({});
  const [showResults, setShowResults] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const hasSetSkybox = useRef(false);
  
  // Set skybox when lesson starts
  useEffect(() => {
    if (activeLesson?.topic?.skybox_url && onSetSkybox && !hasSetSkybox.current) {
      console.log('🖼️ Setting lesson skybox:', activeLesson.topic.skybox_url);
      onSetSkybox(activeLesson.topic.skybox_url);
      hasSetSkybox.current = true;
    }
  }, [activeLesson, onSetSkybox]);
  
  // Set 3D asset when lesson starts
  useEffect(() => {
    if (activeLesson?.topic?.asset_urls?.[0] && onSet3DAsset) {
      console.log('📦 Setting lesson 3D asset:', activeLesson.topic.asset_urls[0]);
      onSet3DAsset(activeLesson.topic.asset_urls[0]);
    }
  }, [activeLesson, onSet3DAsset]);
  
  // Start intro when lesson loads
  useEffect(() => {
    if (lessonPhase === 'loading' && activeLesson) {
      // Give time for skybox to load
      setTimeout(() => {
        setPhase('intro');
      }, 1500);
    }
  }, [lessonPhase, activeLesson, setPhase]);
  
  // Play current script via avatar
  const playCurrentScript = useCallback(async () => {
    const script = getCurrentScript();
    if (!script) {
      console.log('📚 No script available for current phase');
      return;
    }
    
    setIsPlaying(true);
    setCurrentScriptPlaying(script);
    
    // If muted or no avatar, just display the text without speaking
    if (isMuted || !avatarRef.current) {
      console.log('📚 Displaying script text (muted or no avatar):', script.substring(0, 50));
      // Auto-advance after a delay to simulate reading time
      setTimeout(() => {
        setIsPlaying(false);
      }, Math.min(script.length * 50, 5000)); // ~50ms per character, max 5s
      return;
    }
    
    try {
      await avatarRef.current.sendMessage(script);
    } catch (error) {
      console.error('Error playing script via avatar:', error);
      // Even if avatar fails, show the script text
    } finally {
      setIsPlaying(false);
    }
  }, [getCurrentScript, avatarRef, isMuted]);
  
  // Auto-play script when phase changes
  useEffect(() => {
    if (['intro', 'explanation', 'outro'].includes(lessonPhase) && !isPlaying) {
      playCurrentScript();
    }
  }, [lessonPhase, playCurrentScript, isPlaying]);
  
  // Skip to next phase
  const handleNext = useCallback(() => {
    if (hasNextScript()) {
      advanceScript();
    } else if (activeLesson?.topic?.mcqs && activeLesson.topic.mcqs.length > 0) {
      setPhase('quiz');
    } else {
      setPhase('completed');
    }
  }, [hasNextScript, advanceScript, activeLesson, setPhase]);
  
  // Handle MCQ answer selection
  const handleMcqAnswer = (mcqId: string, optionIndex: number) => {
    setMcqAnswers((prev) => ({ ...prev, [mcqId]: optionIndex }));
  };
  
  // Submit quiz
  const handleSubmitQuiz = () => {
    if (!activeLesson?.topic?.mcqs) return;
    
    let correct = 0;
    activeLesson.topic.mcqs.forEach((mcq) => {
      if (mcqAnswers[mcq.id] === mcq.correct_option_index) {
        correct++;
      }
    });
    
    submitQuizResults(correct, activeLesson.topic.mcqs.length);
    setShowResults(true);
  };
  
  // Handle close lesson
  const handleClose = () => {
    hasSetSkybox.current = false;
    endLesson();
  };
  
  // Get phase label
  const getPhaseLabel = () => {
    switch (lessonPhase) {
      case 'loading': return 'Loading...';
      case 'intro': return 'Introduction';
      case 'explanation': return 'Explanation';
      case 'outro': return 'Summary';
      case 'quiz': return 'Quiz Time';
      case 'completed': return 'Completed!';
      default: return '';
    }
  };
  
  // Get phase progress
  const getProgress = () => {
    switch (lessonPhase) {
      case 'loading': return 10;
      case 'intro': return 25;
      case 'explanation': return 50;
      case 'outro': return 75;
      case 'quiz': return 90;
      case 'completed': return 100;
      default: return 0;
    }
  };
  
  if (!activeLesson || lessonPhase === 'idle') {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Top Banner - Lesson Info */}
      <div className="absolute top-0 left-0 right-0 pointer-events-auto">
        <div className="bg-gradient-to-b from-black/80 via-black/60 to-transparent py-4 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              {/* Lesson Info */}
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">
                      {activeLesson.topic.topic_name}
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                      {getPhaseLabel()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {activeLesson.chapter.chapter_name} • {activeLesson.chapter.subject}
                  </p>
                </div>
              </div>
              
              {/* Controls */}
              <div className="flex items-center gap-3">
                {/* Mute Button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-2 rounded-lg transition-colors ${
                    isMuted 
                      ? 'text-red-400 bg-red-500/10' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Panel - Script/Quiz */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
        <div className="bg-gradient-to-t from-black/90 via-black/80 to-transparent pt-16 pb-6 px-6">
          <div className="max-w-4xl mx-auto">
            {/* Script Display */}
            {['intro', 'explanation', 'outro'].includes(lessonPhase) && (
              <div className="bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <MessageSquare className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white leading-relaxed">
                      {isPlaying ? currentScriptPlaying : getCurrentScript() || 'No script available'}
                    </p>
                    {isPlaying && (
                      <div className="flex items-center gap-2 mt-3 text-cyan-400 text-sm">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        Speaking...
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Navigation Buttons */}
                <div className="flex items-center justify-end gap-3 mt-6">
                  {!isPlaying && (
                    <button
                      onClick={playCurrentScript}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                               text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20
                               rounded-lg border border-cyan-500/30 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Replay
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold
                             text-white bg-gradient-to-r from-emerald-500 to-teal-600
                             hover:from-emerald-400 hover:to-teal-500
                             rounded-lg shadow-lg shadow-emerald-500/25 transition-all"
                  >
                    {hasNextScript() ? 'Continue' : activeLesson.topic.mcqs?.length ? 'Start Quiz' : 'Complete'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Quiz Display */}
            {lessonPhase === 'quiz' && !showResults && activeLesson.topic.mcqs && (
              <div className="bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 max-h-[60vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Award className="w-6 h-6 text-amber-400" />
                  Test Your Knowledge
                </h3>
                
                <div className="space-y-6">
                  {activeLesson.topic.mcqs.map((mcq, idx) => (
                    <div key={mcq.id} className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                      <p className="text-white font-medium mb-4">
                        {idx + 1}. {mcq.question}
                      </p>
                      <div className="grid gap-2">
                        {mcq.options.map((option, optIdx) => (
                          <button
                            key={optIdx}
                            onClick={() => handleMcqAnswer(mcq.id, optIdx)}
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-all
                                      ${mcqAnswers[mcq.id] === optIdx
                                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                        : 'bg-slate-800/30 border-slate-700/30 text-slate-300 hover:border-slate-600'
                                      }`}
                          >
                            <span className="font-medium mr-3">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={Object.keys(mcqAnswers).length < (activeLesson.topic.mcqs?.length || 0)}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-semibold
                             text-white bg-gradient-to-r from-amber-500 to-orange-600
                             hover:from-amber-400 hover:to-orange-500
                             rounded-lg shadow-lg shadow-amber-500/25 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Submit Answers
                  </button>
                </div>
              </div>
            )}
            
            {/* Results Display */}
            {(lessonPhase === 'completed' || showResults) && (
              <div className="bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Lesson Complete!</h3>
                <p className="text-slate-400 mb-6">
                  You've completed {activeLesson.topic.topic_name}
                </p>
                
                {activeLesson.topic.mcqs && activeLesson.topic.mcqs.length > 0 && (
                  <div className="mb-6 p-4 bg-slate-900/50 rounded-xl inline-block">
                    <p className="text-sm text-slate-400 mb-1">Quiz Score</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      {Object.values(mcqAnswers).filter((ans, idx) => 
                        ans === activeLesson.topic.mcqs![idx]?.correct_option_index
                      ).length} / {activeLesson.topic.mcqs.length}
                    </p>
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handleClose}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-semibold
                             text-white bg-gradient-to-r from-emerald-500 to-teal-600
                             hover:from-emerald-400 hover:to-teal-500
                             rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Finish Lesson
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonModeOverlay;
