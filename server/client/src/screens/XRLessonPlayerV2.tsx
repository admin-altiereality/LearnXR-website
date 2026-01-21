/**
 * XRLessonPlayerV2 - Immersive WebXR Lesson Player
 * 
 * Built following Meta Project Flowerbed patterns for Quest Browser compatibility.
 * 
 * Features:
 * - Full WebXR immersive-vr support for Meta Quest
 * - GLB skybox loading as 360° environment
 * - 3D asset loading and placement
 * - VR UI panels for TTS, MCQ, and lesson info
 * - Controller-based raycast interactions
 * - Optimized for Quest Browser performance
 * 
 * @see https://github.com/meta-quest/ProjectFlowerbed
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesson } from '../contexts/LessonContext';
import { XRManager, getXRManager, disposeXRManager } from '../xr/xrManager';
import { VRSceneManager, LessonContent, LoadingProgress } from '../xr/vrSceneManager';
import { VRUISystem, MCQQuestion, TTSSection } from '../xr/vrUISystem';
import {
  Play,
  Pause,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Glasses,
  Monitor,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface XRCapabilities {
  isVRSupported: boolean;
  deviceType: string;
  hasControllers: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

const XRLessonPlayerV2: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeLesson } = useLesson();
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<VRSceneManager | null>(null);
  const xrManagerRef = useRef<XRManager | null>(null);
  const vrUIRef = useRef<VRUISystem | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // State
  const [xrCapabilities, setXRCapabilities] = useState<XRCapabilities | null>(null);
  const [isInVR, setIsInVR] = useState(false);
  const [lessonData, setLessonData] = useState<LessonContent | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    stage: 'initializing',
    progress: 0,
    message: 'Checking VR capabilities...',
  });
  const [ttsData, setTtsData] = useState<TTSSection[]>([]);
  const [mcqData, setMcqData] = useState<MCQQuestion[]>([]);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // Get lesson identifiers
  const lessonId = searchParams.get('lessonId') || activeLesson?.chapter?.chapter_id;
  const topicId = searchParams.get('topicId') || activeLesson?.topic?.topic_id;
  
  // ============================================================================
  // Check VR Capabilities
  // ============================================================================
  
  useEffect(() => {
    const checkCapabilities = async () => {
      const xrManager = getXRManager();
      xrManagerRef.current = xrManager;
      
      const caps = await xrManager.checkCapabilities();
      setXRCapabilities({
        isVRSupported: caps.isVRSupported,
        deviceType: caps.deviceType,
        hasControllers: caps.hasControllers,
      });
      
      console.log('[XRLessonPlayerV2] XR Capabilities:', caps);
      
      if (!caps.isVRSupported) {
        setLoadingProgress({
          stage: 'error',
          progress: 0,
          message: 'VR Not Supported',
          error: 'Please open this page on a Meta Quest headset to experience VR.',
        });
      }
    };
    
    checkCapabilities();
    
    return () => {
      disposeXRManager();
    };
  }, []);
  
  // ============================================================================
  // Load Lesson Data
  // ============================================================================
  
  useEffect(() => {
    const loadLessonData = async () => {
      // Try sessionStorage first
      const stored = sessionStorage.getItem('activeLesson');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setLessonData(parsed);
          console.log('[XRLessonPlayerV2] Loaded from sessionStorage:', parsed);
          return;
        } catch (e) {
          console.error('[XRLessonPlayerV2] Failed to parse sessionStorage:', e);
        }
      }
      
      // Try context
      if (activeLesson) {
        setLessonData(activeLesson as LessonContent);
        console.log('[XRLessonPlayerV2] Loaded from context');
        return;
      }
      
      // Fetch from Firestore
      if (lessonId) {
        try {
          setLoadingProgress(prev => ({ ...prev, message: 'Loading lesson data...' }));
          
          const chapterRef = doc(db, 'curriculum_chapters', lessonId);
          const chapterSnap = await getDoc(chapterRef);
          
          if (chapterSnap.exists()) {
            const data = chapterSnap.data();
            const topic = topicId
              ? data.topics?.find((t: any) => t.topic_id === topicId)
              : data.topics?.[0];
            
            setLessonData({
              chapter: {
                chapter_id: lessonId,
                chapter_name: data.chapter_name,
                chapter_number: data.chapter_number || 1,
                curriculum: data.curriculum,
                class_name: data.class,
                subject: data.subject,
              },
              topic: topic || {},
              image3dasset: data.image3dasset,
            });
            console.log('[XRLessonPlayerV2] Loaded from Firestore');
          } else {
            throw new Error('Lesson not found');
          }
        } catch (error: any) {
          console.error('[XRLessonPlayerV2] Failed to load lesson:', error);
          setLoadingProgress({
            stage: 'error',
            progress: 0,
            message: 'Failed to load lesson',
            error: error.message,
          });
        }
      } else {
        setLoadingProgress({
          stage: 'error',
          progress: 0,
          message: 'No lesson selected',
          error: 'Please select a lesson from the Lessons page.',
        });
      }
    };
    
    loadLessonData();
  }, [lessonId, topicId, activeLesson]);
  
  // ============================================================================
  // Load TTS Data
  // ============================================================================
  
  useEffect(() => {
    const loadTTSData = async () => {
      if (!lessonData?.chapter?.chapter_id) return;
      
      try {
        const ttsRef = collection(db, 'chapter_tts');
        const q = query(ttsRef, where('chapter_id', '==', lessonData.chapter.chapter_id));
        const snapshot = await getDocs(q);
        
        const sections: TTSSection[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.audio_url) {
            sections.push({
              id: doc.id,
              section: data.section || 'explanation',
              text: data.text || '',
              audioUrl: data.audio_url,
            });
          }
        });
        
        // Also check topic TTS
        if (lessonData.topic?.tts_audio_url) {
          sections.push({
            id: 'topic-tts',
            section: 'explanation',
            text: lessonData.topic.avatar_explanation || '',
            audioUrl: lessonData.topic.tts_audio_url,
          });
        }
        
        setTtsData(sections);
        console.log('[XRLessonPlayerV2] TTS sections loaded:', sections.length);
      } catch (error) {
        console.error('[XRLessonPlayerV2] Failed to load TTS:', error);
      }
    };
    
    loadTTSData();
  }, [lessonData]);
  
  // ============================================================================
  // Load MCQ Data
  // ============================================================================
  
  useEffect(() => {
    const loadMCQData = async () => {
      if (!lessonData?.chapter?.chapter_id) return;
      
      try {
        const mcqRef = collection(db, 'chapter_mcqs');
        const q = query(mcqRef, where('chapter_id', '==', lessonData.chapter.chapter_id));
        const snapshot = await getDocs(q);
        
        const questions: MCQQuestion[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.question && data.options) {
            questions.push({
              id: doc.id,
              question: data.question,
              options: data.options.map((opt: string, idx: number) => ({
                index: idx,
                text: opt,
                isCorrect: idx === data.correct_option_index,
              })),
              correctIndex: data.correct_option_index,
            });
          }
        });
        
        setMcqData(questions);
        console.log('[XRLessonPlayerV2] MCQ questions loaded:', questions.length);
      } catch (error) {
        console.error('[XRLessonPlayerV2] Failed to load MCQ:', error);
      }
    };
    
    loadMCQData();
  }, [lessonData]);
  
  // ============================================================================
  // Initialize Scene
  // ============================================================================
  
  useEffect(() => {
    if (!containerRef.current || !lessonData || !xrCapabilities) return;
    
    const initializeScene = async () => {
      console.log('[XRLessonPlayerV2] Initializing scene...');
      
      // Create scene manager
      const sceneManager = new VRSceneManager({
        enableShadows: false,
        groundPlane: true,
      });
      sceneManagerRef.current = sceneManager;
      
      // Track progress
      sceneManager.onProgress(setLoadingProgress);
      
      // Initialize renderer
      const renderer = sceneManager.initialize(containerRef.current!);
      
      // Initialize XR manager with renderer
      if (xrManagerRef.current) {
        await xrManagerRef.current.initialize(renderer);
      }
      
      // Load skybox
      const skyboxUrl = lessonData.topic?.skybox_url || lessonData.topic?.skybox_glb_url;
      if (skyboxUrl) {
        await sceneManager.loadSkybox(skyboxUrl);
      }
      
      // Load 3D assets
      const assetUrls = lessonData.topic?.asset_urls || [];
      await sceneManager.loadAssets(assetUrls, lessonData.image3dasset);
      
      // Create VR UI
      const vrUI = new VRUISystem(sceneManager.getScene(), sceneManager.getCamera());
      vrUIRef.current = vrUI;
      await vrUI.initialize();
      
      // Create lesson info panel
      vrUI.createInfoPanel({
        curriculum: lessonData.chapter.curriculum,
        className: lessonData.chapter.class_name,
        subject: lessonData.chapter.subject,
        chapterName: lessonData.chapter.chapter_name,
        topicName: lessonData.topic?.topic_name || '',
        learningObjective: lessonData.topic?.learning_objective || '',
      });
      
      // Create TTS panel if audio available
      if (ttsData.length > 0) {
        vrUI.createTTSPanel(ttsData[0].audioUrl, ttsData[0].section);
        vrUI.setOnTTSPlay(() => setIsAudioPlaying(true));
        vrUI.setOnTTSPause(() => setIsAudioPlaying(false));
      }
      
      // Create MCQ panel if questions available
      if (mcqData.length > 0) {
        vrUI.createMCQPanel(mcqData[0]);
        vrUI.setOnMCQAnswer(handleMCQAnswer);
      }
      
      // Set exit callback
      vrUI.setOnExit(() => navigate('/lessons'));
      
      // Add controllers to scene
      if (xrManagerRef.current) {
        const { rays, grips } = xrManagerRef.current.getControllers();
        rays.forEach(ray => sceneManager.add(ray));
        grips.forEach(grip => sceneManager.add(grip));
      }
      
      // Start render loop
      startRenderLoop(renderer, sceneManager, vrUI);
      
      // Mark complete
      sceneManager.setComplete();
      
      console.log('[XRLessonPlayerV2] Scene initialized');
    };
    
    initializeScene();
    
    return () => {
      // Cleanup
      cancelAnimationFrame(animationFrameRef.current);
      sceneManagerRef.current?.dispose();
      vrUIRef.current?.dispose();
    };
  }, [lessonData, xrCapabilities, ttsData, mcqData, navigate]);
  
  // ============================================================================
  // Render Loop
  // ============================================================================
  
  const startRenderLoop = (
    renderer: THREE.WebGLRenderer,
    sceneManager: VRSceneManager,
    vrUI: VRUISystem
  ) => {
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    
    // Use setAnimationLoop for XR compatibility
    renderer.setAnimationLoop((time, frame) => {
      // Update VR UI
      vrUI.update();
      
      // Handle controller interactions
      if (xrManagerRef.current?.isInSession()) {
        const { rays } = xrManagerRef.current.getControllers();
        rays.forEach(ray => {
          const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(ray.quaternion);
          vrUI.updateRaycast(ray.position, direction);
        });
      }
      
      // Render
      renderer.render(scene, camera);
    });
  };
  
  // ============================================================================
  // MCQ Handler
  // ============================================================================
  
  const handleMCQAnswer = useCallback((questionId: string, answerIndex: number) => {
    const question = mcqData.find(q => q.id === questionId);
    if (!question) return;
    
    const isCorrect = question.options[answerIndex]?.isCorrect || false;
    const correctAnswer = question.options[question.correctIndex]?.text || '';
    
    vrUIRef.current?.showMCQResult(isCorrect, correctAnswer);
    
    // Move to next question after delay
    setTimeout(() => {
      if (currentMcqIndex < mcqData.length - 1) {
        setCurrentMcqIndex(prev => prev + 1);
        vrUIRef.current?.createMCQPanel(mcqData[currentMcqIndex + 1]);
      }
    }, 2000);
  }, [mcqData, currentMcqIndex]);
  
  // ============================================================================
  // Enter VR
  // ============================================================================
  
  const enterVR = useCallback(async () => {
    if (!xrManagerRef.current || !xrCapabilities?.isVRSupported) {
      console.warn('[XRLessonPlayerV2] VR not available');
      return;
    }
    
    try {
      console.log('[XRLessonPlayerV2] Entering VR...');
      
      await xrManagerRef.current.requestSession({
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking'],
        onSessionStart: () => setIsInVR(true),
        onSessionEnd: () => setIsInVR(false),
      });
      
    } catch (error) {
      console.error('[XRLessonPlayerV2] Failed to enter VR:', error);
      setLoadingProgress({
        stage: 'error',
        progress: 0,
        message: 'Failed to enter VR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [xrCapabilities]);
  
  // ============================================================================
  // Exit VR
  // ============================================================================
  
  const exitVR = useCallback(async () => {
    if (xrManagerRef.current) {
      await xrManagerRef.current.endSession();
      setIsInVR(false);
    }
  }, []);
  
  // ============================================================================
  // Navigate Back
  // ============================================================================
  
  const goBack = useCallback(() => {
    if (isInVR) {
      exitVR();
    }
    navigate('/lessons');
  }, [navigate, isInVR, exitVR]);
  
  // ============================================================================
  // Render - Non-VR Fallback Message
  // ============================================================================
  
  const renderNonVRMessage = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
    >
      <div className="max-w-lg w-full mx-4 p-8 bg-slate-900/90 rounded-2xl border border-slate-700/50 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-3">
          VR Device Required
        </h2>
        
        <p className="text-slate-300 mb-6">
          Please open this page on a <span className="text-cyan-400 font-semibold">Meta Quest</span> headset 
          using the Quest Browser to experience this lesson in VR.
        </p>
        
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
            <Glasses className="w-6 h-6 text-purple-400" />
            <div className="text-left">
              <p className="text-sm font-medium text-white">Meta Quest 2 / 3 / Pro</p>
              <p className="text-xs text-slate-400">Open in Quest Browser</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl opacity-50">
            <Monitor className="w-6 h-6 text-slate-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-400">Desktop Browser</p>
              <p className="text-xs text-slate-500">Not supported for VR</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl opacity-50">
            <Smartphone className="w-6 h-6 text-slate-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-400">Mobile Browser</p>
              <p className="text-xs text-slate-500">Not supported for VR</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/30 mb-6">
          <p className="text-sm text-cyan-300">
            <strong>Tip:</strong> On your Quest, open the browser and navigate to this URL, 
            then click "Enter VR" to begin the immersive lesson.
          </p>
        </div>
        
        <button
          onClick={goBack}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Lessons
        </button>
      </div>
    </motion.div>
  );
  
  // ============================================================================
  // Render - Loading Overlay
  // ============================================================================
  
  const renderLoadingOverlay = () => {
    if (loadingProgress.stage === 'complete') return null;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/95 backdrop-blur-sm"
      >
        <div className="max-w-md w-full mx-4 p-6 bg-slate-900/90 rounded-2xl border border-slate-700/50">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            {loadingProgress.stage === 'error' ? (
              <>
                <AlertCircle className="w-6 h-6 text-red-400" />
                Error
              </>
            ) : (
              <>
                <Glasses className="w-6 h-6 text-cyan-400" />
                Preparing VR Experience
              </>
            )}
          </h2>
          
          {/* Progress bar */}
          <div className="h-2 bg-slate-800 rounded-full mb-4 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                loadingProgress.stage === 'error'
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-cyan-500 to-purple-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${loadingProgress.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          {/* Stage indicators */}
          <div className="space-y-2 mb-4">
            {['initializing', 'skybox', 'assets', 'ui'].map((stage) => (
              <div
                key={stage}
                className={`flex items-center gap-2 text-sm ${
                  loadingProgress.stage === stage
                    ? 'text-cyan-300'
                    : loadingProgress.progress > (['initializing', 'skybox', 'assets', 'ui'].indexOf(stage) + 1) * 25
                    ? 'text-emerald-300'
                    : 'text-slate-500'
                }`}
              >
                {loadingProgress.stage === stage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : loadingProgress.progress > (['initializing', 'skybox', 'assets', 'ui'].indexOf(stage) + 1) * 25 ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-current" />
                )}
                <span className="capitalize">{stage === 'ui' ? 'VR Interface' : stage}</span>
              </div>
            ))}
          </div>
          
          {/* Status message */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {loadingProgress.stage !== 'error' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>{loadingProgress.message}</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-300">{loadingProgress.error}</span>
              </>
            )}
          </div>
          
          {/* Error actions */}
          {loadingProgress.stage === 'error' && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={goBack}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };
  
  // ============================================================================
  // Render - VR Controls
  // ============================================================================
  
  const renderVRControls = () => {
    if (!xrCapabilities?.isVRSupported) return null;
    if (loadingProgress.stage !== 'complete') return null;
    
    return (
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <button
          onClick={isInVR ? exitVR : enterVR}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all ${
            isInVR
              ? 'bg-red-500 hover:bg-red-400 text-white'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white'
          }`}
        >
          <Glasses className="w-5 h-5" />
          {isInVR ? 'Exit VR' : 'Enter VR'}
        </button>
        
        {/* Device info */}
        <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 text-xs text-slate-400">
          {xrCapabilities.deviceType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </div>
      </div>
    );
  };
  
  // ============================================================================
  // Main Render
  // ============================================================================
  
  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      {/* Three.js container */}
      <div ref={containerRef} className="absolute inset-0 z-10" />
      
      {/* Non-VR fallback message */}
      {xrCapabilities && !xrCapabilities.isVRSupported && renderNonVRMessage()}
      
      {/* Loading overlay */}
      <AnimatePresence>
        {xrCapabilities?.isVRSupported && loadingProgress.stage !== 'complete' && renderLoadingOverlay()}
      </AnimatePresence>
      
      {/* VR controls */}
      {renderVRControls()}
      
      {/* Back button */}
      <button
        onClick={goBack}
        className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/90 text-white/80 hover:text-white hover:bg-slate-700 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Exit</span>
      </button>
      
      {/* Lesson info (when loaded) */}
      {lessonData && loadingProgress.stage === 'complete' && !isInVR && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700/50 text-center">
          <p className="text-xs text-cyan-400 uppercase tracking-wide">
            {lessonData.chapter.curriculum} • Class {lessonData.chapter.class_name}
          </p>
          <h2 className="text-sm font-semibold text-white">
            {lessonData.topic?.topic_name || lessonData.chapter.chapter_name}
          </h2>
        </div>
      )}
      
      {/* TTS controls (2D mode only) */}
      {loadingProgress.stage === 'complete' && ttsData.length > 0 && !isInVR && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (isAudioPlaying) {
                  vrUIRef.current?.pauseTTS();
                } else {
                  vrUIRef.current?.playTTS();
                }
                setIsAudioPlaying(!isAudioPlaying);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all"
            >
              {isAudioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span className="text-sm font-medium">
                {isAudioPlaying ? 'Pause' : 'Play'} Narration
              </span>
            </button>
          </div>
        </div>
      )}
      
      {/* VR instruction (when loaded, not in VR) */}
      {xrCapabilities?.isVRSupported && loadingProgress.stage === 'complete' && !isInVR && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-center"
        >
          <p className="text-sm text-purple-300">
            <Glasses className="w-4 h-4 inline mr-2" />
            Click <strong>Enter VR</strong> to begin the immersive experience
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default XRLessonPlayerV2;
