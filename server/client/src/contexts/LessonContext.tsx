/**
 * LessonContext - Manages active lesson state across the application
 * 
 * Used to pass lesson data from Content Studio to VR Lesson Player for playback
 * Includes comprehensive error handling and session persistence
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface LessonTopic {
  topic_id: string;
  topic_name: string;
  topic_priority: number;
  learning_objective: string;
  in3d_prompt: string;
  
  // Skybox
  skybox_id?: string;
  skybox_url?: string;
  
  // Avatar scripts
  avatar_intro?: string;
  avatar_explanation?: string;
  avatar_outro?: string;
  
  // 3D Assets
  asset_list?: string[];
  asset_urls?: string[];
  asset_ids?: string[];
  
  // MCQs (flattened format)
  mcqs?: LessonMCQ[];
  
  // TTS Audio (language-specific)
  ttsAudio?: Array<{
    script_type: string;
    audio_url: string;
    language: string;
  }>;
  
  // Language code
  language?: string;
}

export interface LessonMCQ {
  id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
}

export interface LessonChapter {
  chapter_id: string;
  chapter_name: string;
  chapter_number: number;
  curriculum: string;
  class_name: string;
  subject: string;
}

export interface ActiveLesson {
  chapter: LessonChapter;
  topic: LessonTopic;
  startedAt: string;
}

export type LessonPhase = 
  | 'idle'           // No lesson active
  | 'loading'        // Loading lesson data
  | 'intro'          // Playing intro script
  | 'explanation'    // Playing explanation script
  | 'exploration'    // Free exploration
  | 'outro'          // Playing outro script
  | 'quiz'           // Showing MCQs
  | 'completed';     // Lesson finished

interface LessonContextType {
  // State
  activeLesson: ActiveLesson | null;
  lessonPhase: LessonPhase;
  currentScriptIndex: number;
  quizResults: { correct: number; total: number } | null;
  contextError: string | null;
  
  // Actions
  startLesson: (chapter: LessonChapter, topic: LessonTopic) => void;
  endLesson: () => void;
  setPhase: (phase: LessonPhase) => void;
  advanceScript: () => void;
  submitQuizResults: (correct: number, total: number) => void;
  clearError: () => void;
  
  // Helpers
  getCurrentScript: () => string | null;
  hasNextScript: () => boolean;
  isLessonActive: () => boolean;
}

// ============================================================================
// Debug Logger
// ============================================================================

const DEBUG = true;

const log = (emoji: string, message: string, data?: any) => {
  if (DEBUG) {
    if (data !== undefined) {
      console.log(`${emoji} [LessonContext] ${message}`, data);
    } else {
      console.log(`${emoji} [LessonContext] ${message}`);
    }
  }
};

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY = 'activeLesson';

// ============================================================================
// Context
// ============================================================================

const LessonContext = createContext<LessonContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

export const LessonProvider = ({ children }: { children: ReactNode }) => {
  const [activeLesson, setActiveLesson] = useState<ActiveLesson | null>(null);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('idle');
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [quizResults, setQuizResults] = useState<{ correct: number; total: number } | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  // Get scripts array from topic
  const getScripts = useCallback(() => {
    if (!activeLesson?.topic) return [];
    const scripts: string[] = [];
    if (activeLesson.topic.avatar_intro) scripts.push(activeLesson.topic.avatar_intro);
    if (activeLesson.topic.avatar_explanation) scripts.push(activeLesson.topic.avatar_explanation);
    if (activeLesson.topic.avatar_outro) scripts.push(activeLesson.topic.avatar_outro);
    return scripts;
  }, [activeLesson]);
  
  // Start a new lesson
  const startLesson = useCallback((chapter: LessonChapter, topic: LessonTopic) => {
    try {
      log('🚀', 'Starting lesson:', {
        chapterId: chapter.chapter_id,
        topicId: topic.topic_id,
        topicName: topic.topic_name,
        hasSkybox: !!topic.skybox_url,
        hasIntro: !!topic.avatar_intro,
        mcqCount: topic.mcqs?.length || 0,
      });
      
      // Validate chapter
      if (!chapter || !chapter.chapter_id) {
        throw new Error('Invalid chapter data: Missing chapter_id');
      }
      
      // Validate topic
      if (!topic || !topic.topic_id) {
        throw new Error('Invalid topic data: Missing topic_id');
      }
      
      const newLesson: ActiveLesson = {
        chapter,
        topic,
        startedAt: new Date().toISOString(),
      };
      
      // Update state
      setActiveLesson(newLesson);
      setCurrentScriptIndex(0);
      setQuizResults(null);
      setLessonPhase('loading');
      setContextError(null);
      
      // Store in sessionStorage for page navigation
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newLesson));
        log('💾', 'Lesson saved to sessionStorage');
      } catch (storageError) {
        console.warn('Could not save to sessionStorage:', storageError);
      }
      
      log('✅', 'Lesson started successfully');
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to start lesson';
      console.error('❌ [LessonContext] startLesson error:', error);
      setContextError(errorMessage);
      throw error;
    }
  }, []);
  
  // End the current lesson
  const endLesson = useCallback(() => {
    try {
      log('🛑', 'Ending lesson');
      setActiveLesson(null);
      setLessonPhase('idle');
      setCurrentScriptIndex(0);
      setQuizResults(null);
      setContextError(null);
      
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Could not remove from sessionStorage:', e);
      }
      
      log('✅', 'Lesson ended');
    } catch (error: any) {
      console.error('❌ [LessonContext] endLesson error:', error);
    }
  }, []);
  
  // Set lesson phase
  const setPhase = useCallback((phase: LessonPhase) => {
    log('📍', 'Setting phase:', phase);
    setLessonPhase(phase);
  }, []);
  
  // Advance to next script
  const advanceScript = useCallback(() => {
    try {
      const scripts = getScripts();
      log('⏩', 'Advancing script:', { current: currentScriptIndex, total: scripts.length });
      
      if (currentScriptIndex < scripts.length - 1) {
        setCurrentScriptIndex(prev => prev + 1);
        
        // Update phase based on index
        const nextIndex = currentScriptIndex + 1;
        if (nextIndex === 0) setLessonPhase('intro');
        else if (nextIndex === 1) setLessonPhase('explanation');
        else if (nextIndex === 2) setLessonPhase('outro');
      } else {
        // All scripts done, move to quiz if available
        if (activeLesson?.topic.mcqs && activeLesson.topic.mcqs.length > 0) {
          log('📝', 'Moving to quiz');
          setLessonPhase('quiz');
        } else {
          log('🎉', 'Lesson completed');
          setLessonPhase('completed');
        }
      }
    } catch (error: any) {
      console.error('❌ [LessonContext] advanceScript error:', error);
    }
  }, [currentScriptIndex, getScripts, activeLesson]);
  
  // Submit quiz results
  const submitQuizResults = useCallback((correct: number, total: number) => {
    log('📊', 'Quiz results:', { correct, total });
    setQuizResults({ correct, total });
    setLessonPhase('completed');
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setContextError(null);
  }, []);
  
  // Get current script text
  const getCurrentScript = useCallback(() => {
    const scripts = getScripts();
    return scripts[currentScriptIndex] || null;
  }, [getScripts, currentScriptIndex]);
  
  // Check if there's a next script
  const hasNextScript = useCallback(() => {
    const scripts = getScripts();
    return currentScriptIndex < scripts.length - 1;
  }, [getScripts, currentScriptIndex]);
  
  // Check if lesson is active
  const isLessonActive = useCallback(() => {
    return activeLesson !== null && lessonPhase !== 'idle' && lessonPhase !== 'completed';
  }, [activeLesson, lessonPhase]);
  
  // Restore lesson from sessionStorage on mount
  useEffect(() => {
    if (initialized) return;
    
    log('🔄', 'Initializing LessonContext...');
    
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        log('📦', 'Found stored lesson in sessionStorage');
        const lesson = JSON.parse(stored) as ActiveLesson;
        
        // Validate restored data
        if (lesson?.chapter?.chapter_id && lesson?.topic?.topic_id) {
          setActiveLesson(lesson);
          setLessonPhase('loading');
          log('✅', 'Lesson restored from sessionStorage:', {
            chapterId: lesson.chapter.chapter_id,
            topicId: lesson.topic.topic_id,
          });
        } else {
          log('⚠️', 'Invalid stored lesson data, clearing');
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } else {
        log('ℹ️', 'No stored lesson found');
      }
    } catch (e) {
      console.warn('Could not restore lesson from storage:', e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    
    setInitialized(true);
  }, [initialized]);
  
  // Log state changes
  useEffect(() => {
    if (activeLesson) {
      log('📋', 'Active lesson state:', {
        phase: lessonPhase,
        scriptIndex: currentScriptIndex,
        topicName: activeLesson.topic.topic_name,
        hasSkybox: !!activeLesson.topic.skybox_url,
      });
    }
  }, [activeLesson, lessonPhase, currentScriptIndex]);
  
  return (
    <LessonContext.Provider
      value={{
        activeLesson,
        lessonPhase,
        currentScriptIndex,
        quizResults,
        contextError,
        startLesson,
        endLesson,
        setPhase,
        advanceScript,
        submitQuizResults,
        clearError,
        getCurrentScript,
        hasNextScript,
        isLessonActive,
      }}
    >
      {children}
    </LessonContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

export const useLesson = () => {
  const context = useContext(LessonContext);
  if (!context) {
    console.error('❌ useLesson must be used within LessonProvider');
    throw new Error('useLesson must be used within LessonProvider');
  }
  return context;
};

// Hook to check and restore lesson from URL params
export const useLessonFromUrl = () => {
  const { startLesson } = useLesson();
  
  const checkUrlForLesson = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const lessonData = params.get('lesson');
    
    if (lessonData) {
      try {
        const { chapter, topic } = JSON.parse(decodeURIComponent(lessonData));
        startLesson(chapter, topic);
        
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('lesson');
        window.history.replaceState({}, '', url.toString());
        
        return true;
      } catch (e) {
        console.error('Failed to parse lesson data from URL:', e);
      }
    }
    return false;
  }, [startLesson]);
  
  return { checkUrlForLesson };
};
