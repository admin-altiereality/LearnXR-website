/**
 * XR Lesson Player V3 - Minimal Immersive WebXR Implementation
 * 
 * STEP 1: Just load the skybox GLB in immersive mode
 * 
 * Key differences from VRLessonPlayer:
 * - Uses WebXR API for true immersive-vr mode on Quest
 * - renderer.xr.enabled = true
 * - navigator.xr.requestSession('immersive-vr')
 * 
 * Key differences from XRLessonPlayerV2:
 * - Simplified - only skybox for now
 * - No three-mesh-ui (avoiding font issues)
 * - Minimal dependencies
 * 
 * Skybox source: stored_glb_url from skyboxes collection
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { ProfessionalLayoutSystem, PlacedAsset } from '../utils/webxr/professionalLayoutSystem';
import { VRLessonExperience } from '../utils/webxr/vrLessonExperience';
import { StableLayoutSystem } from '../utils/webxr/stableLayoutSystem';
import { SceneLayoutSystem, PlacementStrategy, AssetPlacement } from '../utils/webxr/sceneLayoutSystem';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, AlertTriangle, Glasses, SkipForward, Award, Home, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { reportSessionProgress, type ReportSessionQuizPayload } from '../services/classSessionService';
import type { SessionLessonPhase } from '../types/lms';
import { getApiBaseUrl } from '../utils/apiConfig';

// WebXR Utilities
import {
  LayoutEngine,
  createLayoutEngine,
  DEBUG_CATEGORIES,
} from '../utils/webxr';

// ============================================================================
// Types
// ============================================================================

interface LessonData {
  chapter: {
    chapter_id: string;
    chapter_name: string;
    curriculum: string;
    class_name: string;
    subject: string;
    mcq_ids?: string[];
    tts_ids?: string[];
    meshy_asset_ids?: string[];
  };
  topic: {
    topic_id: string;
    topic_name: string;
    skybox_id?: string | number;
    skybox_remix_id?: string | number;
    skybox_url?: string;
    skybox_glb_url?: string;
    asset_urls?: string[];
    meshy_asset_ids?: string[];
    mcq_ids?: string[];
    tts_ids?: string[];
    avatar_intro?: string;
    avatar_explanation?: string;
    avatar_outro?: string;
  };
  image3dasset?: string | null;
}

interface TTSData {
  id: string;
  section: string;
  audioUrl: string;
  text?: string;
}

interface MCQData {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface MeshyAsset {
  id: string;
  glbUrl: string;
  name?: string;
  thumbnailUrl?: string;
}

type LoadingState = 'loading' | 'ready' | 'error' | 'no-vr' | 'in-vr';
type LessonPhase = 'waiting' | 'intro' | 'content' | 'outro' | 'mcq' | 'complete';

// ============================================================================
// Error Boundary Component
// ============================================================================

class XRPlayerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[XRLessonPlayerV3] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card rounded-lg border border-destructive/50 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Component
// ============================================================================

const XRLessonPlayerV3: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assetsGroupRef = useRef<THREE.Group | null>(null);
  const primaryAssetRef = useRef<THREE.Group | null>(null);
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);
  
  // Professional Layout System - handles zones, collision, and placement
  const professionalLayoutRef = useRef<ProfessionalLayoutSystem | null>(null);
  const placedAssetsRef = useRef<PlacedAsset[]>([]);
  
  // VR Lesson Experience - world-class VR EdTech experience
  const vrExperienceRef = useRef<VRLessonExperience | null>(null);
  
  // Stable Layout System - crash-safe, deterministic asset staging
  const stableLayoutRef = useRef<StableLayoutSystem | null>(null);
  
  // Interaction guard - prevent runaway loops
  const interactionGuardRef = useRef<{
    lastInteractionTime: number;
    interactionCount: number;
    isProcessing: boolean;
  }>({ lastInteractionTime: 0, interactionCount: 0, isProcessing: false });
  
  // Ground plane constants
  const GROUND_LEVEL = 0;        // Y coordinate of the ground plane
  const TABLE_HEIGHT = 1.0;      // Height for placing objects (1m above ground)
  const ASSET_DISTANCE = 2.5;    // Distance from user to asset (closer for better view)
  const ASSET_RIGHT_OFFSET = 1.2; // How far right of center
  
  // Normalized asset sizing - ALL assets scaled to this size
  const NORMALIZED_SIZE = 1.0;   // All assets fit within 1.0m bounding box for better viewing
  
  // XR Controller refs
  const controller1Ref = useRef<THREE.Group | null>(null);
  const controller2Ref = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const controllerModelFactoryRef = useRef<XRControllerModelFactory | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const hoveredObjectRef = useRef<THREE.Object3D | null>(null);
  const lastGrabTimeRef = useRef<Map<string, number>>(new Map());
  const controllersSetupRef = useRef<Set<number>>(new Set());
  const inputSourcesRef = useRef<(XRInputSource | null)[]>([null, null]); // Store input sources for haptic feedback
  
  // VR UI refs
  const scriptPanelRef = useRef<THREE.Mesh | null>(null);
  const mcqPanelRef = useRef<THREE.Mesh | null>(null);
  const startPanelRef = useRef<THREE.Mesh | null>(null);
  const lastScriptPanelUpdateRef = useRef<number>(0);
  const lastProgressPercentRef = useRef<number>(-1);
  const lastMcqPanelStateRef = useRef<string>(''); // Track MCQ panel state to avoid redundant recreations
  
  // WebXR Systems refs
  const layoutEngineRef = useRef<LayoutEngine | null>(null);
  
  // State
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [skyboxUrl, setSkyboxUrl] = useState<string | null>(null);
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(null);
  const [isVRSupported, setIsVRSupported] = useState<boolean | null>(null);
  const [isSceneReady, setIsSceneReady] = useState(false);
  
  // Lesson content state
  const [ttsData, setTtsData] = useState<TTSData[]>([]);
  const [mcqData, setMcqData] = useState<MCQData[]>([]);
  const [meshyAssets, setMeshyAssets] = useState<MeshyAsset[]>([]);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('waiting');
  const [lessonStarted, setLessonStarted] = useState(false);
  const [currentTtsIndex, setCurrentTtsIndex] = useState(0);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(0);
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [mcqAnswered, setMcqAnswered] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);
  const mcqAnswerHistoryRef = useRef<Array<{ questionIndex: number; correct: boolean; selectedOptionIndex: number }>>([]);
  const pendingQuizReportRef = useRef<ReportSessionQuizPayload | null>(null);

  // TTS State Machine
  type TTSState = 'idle' | 'playing' | 'paused' | 'ended';
  const [ttsState, setTtsState] = useState<TTSState>('idle');
  const [audioProgress, setAudioProgress] = useState(0); // 0-1
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  // Debug state - expanded for comprehensive logging
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [debugExpanded, setDebugExpanded] = useState(true);
  
  // Asset dock state
  const [assetsVisible, setAssetsVisible] = useState(true);
  const [assetDockExpanded, setAssetDockExpanded] = useState(false);
  
  // Asset references map for dock control
  const assetRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  
  // Scene Layout System (production-grade, scalable layout)
  const sceneLayoutRef = useRef<SceneLayoutSystem | null>(null);
  const [placementStrategy, setPlacementStrategy] = useState<PlacementStrategy>('curved-arc');
  const assetPlacementsRef = useRef<AssetPlacement[]>([]);
  
  // Debug logger with category support - enhanced with timestamps and structured output
  const addDebug = useCallback((msg: string, category?: keyof typeof DEBUG_CATEGORIES) => {
    const prefix = category ? DEBUG_CATEGORIES[category] : '[V3]';
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const fullMsg = `${prefix} ${msg}`;
    console.log(`[${timestamp}] ${fullMsg}`);
    setDebugInfo(prev => [...prev.slice(-30), `${timestamp}: ${msg}`]); // Increased log retention
  }, []);
  
  // Structured debug helpers with enhanced context
  const debugXR = useCallback((msg: string) => {
    addDebug(`🥽 ${msg}`, 'XR');
  }, [addDebug]);
  
  const debugLayout = useCallback((msg: string) => {
    addDebug(`📐 ${msg}`, 'LAYOUT');
  }, [addDebug]);
  
  const debugUI = useCallback((msg: string) => {
    addDebug(`🖼️ ${msg}`, 'UI');
  }, [addDebug]);
  
  const debugAsset = useCallback((msg: string) => {
    addDebug(`📦 ${msg}`, 'ASSET');
  }, [addDebug]);
  
  const debugInteraction = useCallback((msg: string) => {
    addDebug(`👆 ${msg}`, 'INTERACTION');
  }, [addDebug]);
  
  const debugTTS = useCallback((msg: string) => {
    addDebug(`🔊 ${msg}`, 'TTS');
  }, [addDebug]);
  
  const debugQuiz = useCallback((msg: string) => {
    addDebug(`❓ ${msg}`, 'QUIZ');
  }, [addDebug]);
  
  // Comprehensive state logger - logs current state summary
  const logStateSummary = useCallback(() => {
    const summary = {
      loadingState,
      lessonPhase,
      lessonStarted,
      ttsCount: ttsData.length,
      mcqCount: mcqData.length,
      currentMcqIndex,
      mcqScore,
      assetsLoaded,
      isAudioPlaying,
      ttsState,
      layoutEngineReady: layoutEngineRef.current?.isReady() || false,
    };
    console.log('[STATE SUMMARY]', summary);
    addDebug(`State: phase=${lessonPhase}, started=${lessonStarted}, tts=${ttsData.length}, mcq=${mcqData.length}, score=${mcqScore}/${mcqData.length}`);
  }, [loadingState, lessonPhase, lessonStarted, ttsData.length, mcqData.length, currentMcqIndex, mcqScore, assetsLoaded, isAudioPlaying, ttsState, addDebug]);
  
  // ============================================================================
  // Load Lesson Data from SessionStorage
  // ============================================================================
  
  useEffect(() => {
    const loadLessonData = () => {
      addDebug('Loading lesson data from sessionStorage...');
      try {
        const stored = sessionStorage.getItem('activeLesson');
        if (stored) {
          const data = JSON.parse(stored);
          addDebug(`Lesson loaded: ${data.topic?.topic_name || 'unknown'}`);
          addDebug(`Skybox ID: ${data.topic?.skybox_id || 'none'}`);
          setLessonData(data);
        } else {
          addDebug('ERROR: No lesson data in sessionStorage');
          setErrorMessage('No lesson data found. Please select a lesson first.');
          setLoadingState('error');
        }
      } catch (err) {
        addDebug(`ERROR: Failed to parse: ${err}`);
        setErrorMessage('Failed to load lesson data');
        setLoadingState('error');
      }
    };
    
    loadLessonData();
  }, [addDebug]);

  // Report phase to class session for teacher live progress (when launched from class session)
  useEffect(() => {
    const sessionId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('learnxr_class_session_id') : null;
    if (!sessionId || !user?.uid) return;
    const map: Record<LessonPhase, SessionLessonPhase> = {
      waiting: 'idle',
      intro: 'intro',
      content: 'explanation',
      outro: 'outro',
      mcq: 'quiz',
      complete: 'completed',
    };
    const phase = map[lessonPhase];
    if (phase === 'completed' && pendingQuizReportRef.current) {
      const quiz = pendingQuizReportRef.current;
      pendingQuizReportRef.current = null;
      reportSessionProgress(
        sessionId,
        user.uid,
        profile?.displayName ?? profile?.name ?? undefined,
        'completed',
        undefined,
        quiz,
        profile?.email ?? user?.email ?? undefined
      ).catch(() => {});
    } else {
      reportSessionProgress(
        sessionId,
        user.uid,
        profile?.displayName ?? profile?.name ?? undefined,
        phase,
        undefined,
        undefined,
        profile?.email ?? user?.email ?? undefined
      ).catch(() => {});
    }
  }, [lessonPhase, user?.uid, user?.email, profile?.displayName, profile?.name, profile?.email]);

  // Reset quiz answer history when entering MCQ phase
  useEffect(() => {
    if (lessonPhase === 'mcq') mcqAnswerHistoryRef.current = [];
  }, [lessonPhase]);
  
  // ============================================================================
  // Fetch Skybox GLB URL from Firestore
  // ============================================================================
  
  useEffect(() => {
    const fetchSkyboxUrl = async () => {
      if (!lessonData?.topic) {
        addDebug('Waiting for lesson data...');
        return;
      }
      
      addDebug('Fetching skybox URL...');
      setLoadingMessage('Fetching skybox...');
      const topic = lessonData.topic;
      
      // Priority 1: Direct skybox_glb_url on topic
      if (topic.skybox_glb_url) {
        addDebug(`Direct skybox_glb_url: ${topic.skybox_glb_url.substring(0, 50)}...`);
        setSkyboxUrl(topic.skybox_glb_url);
        return;
      }
      
      // Priority 2: Fetch from skyboxes collection using skybox_id
      // IMPORTANT: Convert to string as Firestore doc() requires string IDs
      const rawSkyboxId = topic.skybox_id || topic.skybox_remix_id;
      const skyboxId = rawSkyboxId ? String(rawSkyboxId) : null;
      addDebug(`Skybox ID from topic: ${skyboxId || 'NONE'} (type: ${typeof rawSkyboxId})`);
      
      if (skyboxId) {
        try {
          addDebug(`Fetching from Firestore: skyboxes/${skyboxId}`);
          const skyboxDoc = await getDoc(doc(db, 'skyboxes', skyboxId));
          
          if (skyboxDoc.exists()) {
            const skyboxData = skyboxDoc.data();
            addDebug(`Skybox doc found! Fields: ${Object.keys(skyboxData).join(', ')}`);
            
            // Always store the image URL as fallback
            const imageUrl = skyboxData.fileUrl || skyboxData.imageUrl;
            if (imageUrl) {
              addDebug(`Setting fallback image: ${String(imageUrl).substring(0, 50)}...`);
              setFallbackImageUrl(String(imageUrl));
            }
            
            // Use stored_glb_url (Firebase Storage) - this is the GLB file
            if (skyboxData.stored_glb_url) {
              addDebug(`Using stored_glb_url: ${skyboxData.stored_glb_url.substring(0, 60)}...`);
              setSkyboxUrl(skyboxData.stored_glb_url);
              return;
            }
            
            // Fallback to image URLs if no GLB
            if (imageUrl) {
              addDebug(`No GLB, using image: ${String(imageUrl).substring(0, 60)}...`);
              setSkyboxUrl(String(imageUrl));
              return;
            }
            
            addDebug('ERROR: Skybox doc has no URL fields!');
          } else {
            addDebug(`ERROR: Skybox doc ${skyboxId} does not exist!`);
          }
        } catch (err) {
          addDebug(`ERROR fetching skybox: ${err}`);
        }
      }
      
      // Priority 3: Use skybox_url as final fallback
      if (topic.skybox_url) {
        addDebug(`Using topic.skybox_url: ${topic.skybox_url.substring(0, 60)}...`);
        setSkyboxUrl(topic.skybox_url);
        return;
      }
      
      addDebug('ERROR: No skybox URL found anywhere!');
      setErrorMessage('No skybox found for this lesson');
      setLoadingState('error');
    };
    
    fetchSkyboxUrl();
  }, [lessonData, addDebug]);
  
  // ============================================================================
  // Fetch TTS Audio Data
  // ============================================================================
  
  useEffect(() => {
    const fetchTTSData = async () => {
      if (!lessonData) return;
      
      // CRITICAL: Language is in topic.language, not lessonData.language
      const lessonLanguage = (lessonData as any).topic?.language || (lessonData as any).language || 'en';
      console.log('[TTS FETCH] Detected lesson language:', lessonLanguage);
      
      // Priority 1: Check if TTS audio is already in lessonData (from bundle)
      const ttsAudioFromStorage = (lessonData as any).ttsAudio;
      if (ttsAudioFromStorage && Array.isArray(ttsAudioFromStorage)) {
        // Filter by language (strict match)
        const languageFilteredTTS = ttsAudioFromStorage.filter((tts: any) => {
          const ttsLang = (tts.language || 'en').toLowerCase().trim();
          const targetLang = lessonLanguage.toLowerCase().trim();
          return ttsLang === targetLang;
        });
        
        if (languageFilteredTTS.length > 0) {
          // VERSION MARKER - v3.0 - Camera-relative asset positioning + TTS fix
          console.log('[TTS v3.0] ════════════════════════════════════════');
          console.log('[TTS v3.0] Processing', languageFilteredTTS.length, 'TTS entries');
          addDebug(`[v3.0] Processing ${languageFilteredTTS.length} TTS for ${lessonLanguage}`);
          
          const convertedTTS: TTSData[] = languageFilteredTTS.map((tts: any, index: number) => {
            const rawId = tts.id || '';
            const rawScriptType = tts.script_type;
            
            console.log(`[TTS v3.0] #${index + 1}: script_type="${rawScriptType}", id contains: intro=${rawId.includes('intro')}, expl=${rawId.includes('explanation')}, outro=${rawId.includes('outro')}`);
            
            // FORCE section extraction - ALWAYS extract from script_type or ID
            let sectionType: string;
            
            // Priority 1: Use script_type directly if valid
            if (rawScriptType === 'intro' || rawScriptType === 'introduction') {
              sectionType = 'intro';
              console.log(`[TTS v3.0]   → script_type match: intro`);
            } else if (rawScriptType === 'explanation' || rawScriptType === 'content') {
              sectionType = 'explanation';
              console.log(`[TTS v3.0]   → script_type match: explanation`);
            } else if (rawScriptType === 'outro' || rawScriptType === 'conclusion' || rawScriptType === 'summary') {
              sectionType = 'outro';
              console.log(`[TTS v3.0]   → script_type match: outro`);
            }
            // Priority 2: Extract from ID
            else if (rawId.toLowerCase().includes('intro')) {
              sectionType = 'intro';
              console.log(`[TTS v3.0]   → ID match: intro`);
            } else if (rawId.toLowerCase().includes('explanation')) {
              sectionType = 'explanation';
              console.log(`[TTS v3.0]   → ID match: explanation`);
            } else if (rawId.toLowerCase().includes('outro')) {
              sectionType = 'outro';
              console.log(`[TTS v3.0]   → ID match: outro`);
            }
            // Priority 3: Position in array
            else {
              if (index === 0) sectionType = 'intro';
              else if (index === languageFilteredTTS.length - 1) sectionType = 'outro';
              else sectionType = 'explanation';
              console.log(`[TTS v3.0]   → Position fallback: ${sectionType}`);
            }
            
            console.log(`[TTS v3.0]   FINAL: "${sectionType}"`);
            
            return {
              id: rawId,
              section: sectionType,
              audioUrl: tts.audio_url || tts.audioUrl || tts.url || '',
              text: tts.text || tts.script_text || '',
            };
          });
          
          console.log('[TTS v3.0] ════════════════════════════════════════');
          console.log('[TTS v3.0] RESULTS:');
          convertedTTS.forEach((t, i) => {
            console.log(`[TTS v3.0]   #${i + 1}: section="${t.section}"`);
          });
          
          setTtsData(convertedTTS);
          addDebug(`[v3.0] TTS: ${convertedTTS.map(t => t.section).join(', ')}`);
          return;
        } else {
          addDebug(`⚠️ No TTS found in bundle for language ${lessonLanguage}`, {
            totalTTS: ttsAudioFromStorage.length,
            sampleLanguages: ttsAudioFromStorage.slice(0, 3).map((t: any) => t.language || 'none'),
          });
        }
      }
      
      // Priority 2: Fetch from Firestore using IDs
      const ttsIds = lessonData.topic?.tts_ids || lessonData.chapter?.tts_ids || [];
      if (ttsIds.length === 0) {
        addDebug('No TTS IDs found');
        return;
      }
      
      addDebug(`Fetching ${ttsIds.length} TTS entries for language: ${lessonLanguage}...`);
      const ttsResults: TTSData[] = [];
      
      // Filter IDs by language (check if ID contains language indicator)
      const languageTtsIds = ttsIds.filter(id => {
        if (lessonLanguage === 'hi') {
          return id.includes('_hi') || id.includes('_hindi');
        } else {
          return !id.includes('_hi') && !id.includes('_hindi');
        }
      });
      
      for (const ttsId of languageTtsIds.slice(0, 3)) { // Max 3 for intro/explanation/outro
        try {
          const ttsDoc = await getDoc(doc(db, 'chapter_tts', ttsId));
          if (ttsDoc.exists()) {
            const data = ttsDoc.data();
            const ttsLang = data.language || 'en';
            
            // Only include if language matches
            if (ttsLang === lessonLanguage && (data.audio_url || data.audioUrl)) {
              // Extract section from ID (more reliable than data.section)
              let section = 'content';
              const idLower = ttsId.toLowerCase();
              if (idLower.includes('intro')) section = 'intro';
              else if (idLower.includes('explanation')) section = 'explanation';
              else if (idLower.includes('outro')) section = 'outro';
              
              ttsResults.push({
                id: ttsId,
                section: section,
                audioUrl: data.audio_url || data.audioUrl,
                text: data.text || data.content || '',
              });
              addDebug(`TTS loaded: ${section} (${ttsLang})`);
            }
          }
        } catch (err) {
          addDebug(`TTS error for ${ttsId}: ${err}`);
        }
      }
      
      setTtsData(ttsResults);
      
      // Comprehensive TTS debug logging
      console.log('[TTS DEBUG] ========================================');
      console.log('[TTS DEBUG] Language:', lessonLanguage);
      console.log('[TTS DEBUG] Total TTS loaded:', ttsResults.length);
      ttsResults.forEach((tts, idx) => {
        console.log(`[TTS DEBUG] TTS #${idx + 1}:`, {
          id: tts.id,
          section: tts.section,
          audioUrl: tts.audioUrl?.substring(0, 80) + '...',
          hasText: !!tts.text,
        });
      });
      console.log('[TTS DEBUG] ========================================');
      
      addDebug(`✅ Loaded ${ttsResults.length} TTS entries (language: ${lessonLanguage})`);
    };
    
    fetchTTSData();
  }, [lessonData, addDebug]);
  
  // ============================================================================
  // Fetch MCQ Data
  // ============================================================================
  
  useEffect(() => {
    const fetchMCQData = async () => {
      if (!lessonData) return;
      
      // CRITICAL: Language is in topic.language, not lessonData.language
      const lessonLanguage = (lessonData as any).topic?.language || (lessonData as any).language || 'en';
      console.log('[MCQ FETCH] Detected lesson language:', lessonLanguage);
      
      // Priority 1: Check if MCQs are already in lessonData (from bundle)
      if ((lessonData as any).topic?.mcqs && Array.isArray((lessonData as any).topic.mcqs)) {
        const mcqs = (lessonData as any).topic.mcqs;
        if (mcqs.length > 0) {
          // Convert to MCQData format with 1-based to 0-based index conversion
          const convertedMCQs: MCQData[] = mcqs.map((mcq: any) => {
            const options = Array.isArray(mcq.options) ? mcq.options : [];
            let rawIndex = mcq.correct_option_index ?? 0;
            if (typeof rawIndex !== 'number') rawIndex = parseInt(String(rawIndex), 10) || 0;
            // CRITICAL: Convert 1-based DB index to 0-based frontend index
            let correctAnswer = rawIndex;
            if (rawIndex >= 1 && rawIndex <= options.length) {
              correctAnswer = rawIndex - 1;
            }
            return {
              id: mcq.id || '',
              question: mcq.question || '',
              options: options,
              correctAnswer: Math.max(0, Math.min(correctAnswer, options.length - 1)),
              explanation: mcq.explanation || '',
            };
          });
          
          // Comprehensive MCQ debug logging for bundle data
          console.log('[MCQ DEBUG FROM BUNDLE] ========================================');
          console.log('[MCQ DEBUG] Language:', lessonLanguage);
          console.log('[MCQ DEBUG] Total MCQs from bundle:', convertedMCQs.length);
          convertedMCQs.forEach((mcq, idx) => {
            console.log(`[MCQ DEBUG] MCQ #${idx + 1}:`, {
              id: mcq.id,
              question: mcq.question?.substring(0, 50) + '...',
              optionsCount: mcq.options?.length,
              options: mcq.options,
              correctAnswer: mcq.correctAnswer,
              correctOptionText: mcq.options?.[mcq.correctAnswer] || 'N/A',
            });
          });
          console.log('[MCQ DEBUG] ========================================');
          
          setMcqData(convertedMCQs);
          addDebug(`✅ Loaded ${convertedMCQs.length} MCQs from bundle (language: ${lessonLanguage})`);
          return;
        }
      }
      
      // Priority 2: Fetch from Firestore using IDs
      const mcqIds = lessonData.topic?.mcq_ids || lessonData.chapter?.mcq_ids || [];
      if (mcqIds.length === 0) {
        addDebug('No MCQ IDs found');
        return;
      }
      
      addDebug(`Fetching ${mcqIds.length} MCQ entries for language: ${lessonLanguage}...`);
      const mcqResults: MCQData[] = [];
      
      // Filter IDs by language (check if ID contains language indicator)
      const languageMcqIds = mcqIds.filter(id => {
        if (lessonLanguage === 'hi') {
          return id.includes('_hi') || id.includes('_hindi');
        } else {
          return !id.includes('_hi') && !id.includes('_hindi');
        }
      });
      
      for (const mcqId of languageMcqIds.slice(0, 5)) { // Max 5 questions
        try {
          const mcqDoc = await getDoc(doc(db, 'chapter_mcqs', mcqId));
          if (mcqDoc.exists()) {
            const data = mcqDoc.data();
            const mcqLang = data.language || 'en';
            
            // Only include if language matches
            if (mcqLang === lessonLanguage) {
              const options = data.options || [];
              let rawIndex = data.correct_option_index ?? data.correct_answer ?? data.correctAnswer ?? 0;
              if (typeof rawIndex !== 'number') rawIndex = parseInt(String(rawIndex), 10) || 0;
              // CRITICAL: Convert 1-based DB index to 0-based frontend index
              let correctAnswer = rawIndex;
              if (rawIndex >= 1 && rawIndex <= options.length) {
                correctAnswer = rawIndex - 1;
              }
              mcqResults.push({
                id: mcqId,
                question: data.question || data.question_text || '',
                options: options,
                correctAnswer: Math.max(0, Math.min(correctAnswer, options.length - 1)),
                explanation: data.explanation || '',
              });
              addDebug(`MCQ loaded: ${mcqId} (${mcqLang})`);
            }
          }
        } catch (err) {
          addDebug(`MCQ error for ${mcqId}: ${err}`);
        }
      }
      
      setMcqData(mcqResults);
      
      // Comprehensive MCQ debug logging
      console.log('[MCQ DEBUG] ========================================');
      console.log('[MCQ DEBUG] Language:', lessonLanguage);
      console.log('[MCQ DEBUG] Total MCQs loaded:', mcqResults.length);
      mcqResults.forEach((mcq, idx) => {
        console.log(`[MCQ DEBUG] MCQ #${idx + 1}:`, {
          id: mcq.id,
          question: mcq.question?.substring(0, 50) + '...',
          optionsCount: mcq.options?.length,
          options: mcq.options,
          correctAnswer: mcq.correctAnswer,
          correctOptionText: mcq.options?.[mcq.correctAnswer] || 'N/A',
        });
      });
      console.log('[MCQ DEBUG] ========================================');
      
      addDebug(`✅ Loaded ${mcqResults.length} MCQs (language: ${lessonLanguage})`);
    };
    
    fetchMCQData();
  }, [lessonData, addDebug]);
  
  // ============================================================================
  // Fetch 3D Assets (Meshy)
  // ============================================================================
  
  useEffect(() => {
    const fetchMeshyAssets = async () => {
      if (!lessonData) return;
      
      // Priority 1: Check if 3D assets are already in lessonData (from bundle)
      if ((lessonData as any).assets3d && Array.isArray((lessonData as any).assets3d) && (lessonData as any).assets3d.length > 0) {
        const bundleAssets = (lessonData as any).assets3d;
        addDebug(`Using ${bundleAssets.length} 3D assets from bundle`);
        
        // Convert bundle assets to MeshyAsset format
        const convertedAssets: MeshyAsset[] = bundleAssets.map((asset: any) => ({
          id: asset.id || '',
          glbUrl: asset.glb_url || asset.stored_glb_url || asset.model_urls?.glb || '',
          name: asset.name || asset.prompt || 'Asset',
          thumbnailUrl: asset.thumbnail_url || asset.thumbnailUrl || '',
        })).filter((asset: MeshyAsset) => asset.glbUrl); // Only include assets with URLs
        
        setMeshyAssets(convertedAssets);
        addDebug(`✅ Loaded ${convertedAssets.length} 3D assets from bundle`);
        return;
      }
      
      // Priority 2: Check topic asset_urls from lessonData
      if (lessonData.topic?.asset_urls && Array.isArray(lessonData.topic.asset_urls) && lessonData.topic.asset_urls.length > 0) {
        const assetUrls = lessonData.topic.asset_urls;
        addDebug(`Using ${assetUrls.length} asset URLs from topic`);
        
        const convertedAssets: MeshyAsset[] = assetUrls.map((url: string, index: number) => ({
          id: `asset_${index}`,
          glbUrl: url,
          name: `Asset ${index + 1}`,
        }));
        
        setMeshyAssets(convertedAssets);
        addDebug(`✅ Loaded ${convertedAssets.length} 3D assets from topic URLs`);
        return;
      }
      
      // Priority 3: Check image3dasset
      if ((lessonData as any).image3dasset) {
        const img3d = (lessonData as any).image3dasset;
        const glbUrl = img3d.imagemodel_glb || img3d.imageasset_url;
        
        if (glbUrl) {
          const convertedAssets: MeshyAsset[] = [{
            id: img3d.imageasset_id || 'image3d_asset',
            glbUrl: glbUrl,
            name: 'Image 3D Asset',
          }];
          
          setMeshyAssets(convertedAssets);
          addDebug(`✅ Loaded image3dasset: ${glbUrl.substring(0, 60)}`);
          return;
        }
      }
      
      // Priority 4: Fallback to Firestore fetch using IDs
      const meshyIds = lessonData.topic?.meshy_asset_ids || lessonData.chapter?.meshy_asset_ids || [];
      if (meshyIds.length === 0) {
        addDebug('No Meshy asset IDs found');
        return;
      }
      
      addDebug(`Fetching ${meshyIds.length} 3D assets from Firestore...`);
      const assetResults: MeshyAsset[] = [];
      
      for (const assetId of meshyIds) {
        try {
          const assetDoc = await getDoc(doc(db, 'meshy_assets', assetId));
          if (assetDoc.exists()) {
            const data = assetDoc.data();
            // Prioritize stored_glb_url (our Firebase Storage), then model_urls.glb
            const glbUrl = data.stored_glb_url || data.model_urls?.glb || data.glb_url;
            if (glbUrl) {
              assetResults.push({
                id: assetId,
                glbUrl: glbUrl,
                name: data.name || data.prompt || 'Asset',
                thumbnailUrl: data.thumbnail_url || data.thumbnailUrl,
              });
              addDebug(`3D Asset found: ${data.name || assetId}`);
            }
          }
        } catch (err) {
          addDebug(`3D Asset error for ${assetId}: ${err}`);
        }
      }
      
      setMeshyAssets(assetResults);
      addDebug(`✅ Found ${assetResults.length} 3D assets from Firestore`);
    };
    
    fetchMeshyAssets();
  }, [lessonData, addDebug]);
  
  // ============================================================================
  // Check WebXR Support
  // ============================================================================
  
  useEffect(() => {
    const checkVRSupport = async () => {
      try {
        // Check WebGL support first
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          console.warn('[XRLessonPlayerV3] WebGL not available');
          setIsVRSupported(false);
          setErrorMessage('WebGL is not supported in this browser. Please use a modern browser with WebGL support.');
          setLoadingState('error');
          return;
        }
        
        if (!navigator.xr) {
          console.log('[XRLessonPlayerV3] WebXR not available (WebGL is OK)');
          setIsVRSupported(false);
          return;
        }
        
        try {
          const supported = await navigator.xr.isSessionSupported('immersive-vr');
          console.log('[XRLessonPlayerV3] immersive-vr supported:', supported);
          setIsVRSupported(supported);
        } catch (err) {
          console.error('[XRLessonPlayerV3] VR support check failed:', err);
          setIsVRSupported(false);
        }
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] VR/WebGL check error:', err);
        setIsVRSupported(false);
      }
    };
    
    checkVRSupport();
  }, []);
  
  // ============================================================================
  // Initialize Three.js Scene with WebXR
  // ============================================================================
  
  useEffect(() => {
    try {
      addDebug(`Scene init check: container=${!!containerRef.current}, skyboxUrl=${!!skyboxUrl}, vrSupport=${isVRSupported}`);
      
      if (!containerRef.current) {
        addDebug('Waiting for container ref...');
        return;
      }
      if (!skyboxUrl) {
        addDebug('Waiting for skybox URL...');
        return;
      }
      if (isVRSupported === null) {
        addDebug('Waiting for VR support check...');
        return;
      }
      
      addDebug('All conditions met, initializing scene...');
      setLoadingMessage('Setting up VR scene...');
      setIsSceneReady(false);
      
      // Create scene
      const scene = new THREE.Scene();
      scene.background = null; // Will be filled by skybox
      sceneRef.current = scene;
      
      // Create camera at origin (center of skybox)
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 1.6, 0); // Eye height
      cameraRef.current = camera;
      
      // Verify scene and camera were created
      if (!scene || !camera) {
        throw new Error('Failed to create scene or camera');
      }
      
      // Create WebGL renderer with XR enabled (with error handling)
      let renderer: THREE.WebGLRenderer;
      try {
        // Check WebGL support first
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          throw new Error('WebGL is not supported in this browser');
        }
        
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false, // Don't fail on performance issues
        });
        
        // Verify renderer was created successfully
        if (!renderer || !renderer.domElement) {
          throw new Error('Failed to create WebGL renderer');
        }
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        
        // STATE-OF-ART RENDERING: Enable high-quality shadows
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
        renderer.shadowMap.autoUpdate = true;
        
        // CRITICAL: Enable XR
        renderer.xr.enabled = true;
        
        rendererRef.current = renderer;
        
        if (containerRef.current) {
          containerRef.current.appendChild(renderer.domElement);
        }
        
        addDebug('✅ WebGL renderer created successfully');
      } catch (webglErr: any) {
        console.error('[XRLessonPlayerV3] WebGL creation error:', webglErr);
        addDebug(`WebGL error: ${webglErr?.message || webglErr}`);
        
        // Try fallback: create renderer without some features
        try {
          addDebug('Attempting fallback WebGL renderer...');
          renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false,
          });
          
          if (!renderer || !renderer.domElement) {
            throw new Error('Fallback renderer also failed');
          }
          
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.setPixelRatio(1); // Lower pixel ratio for compatibility
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.xr.enabled = true;
          
          rendererRef.current = renderer;
          
          if (containerRef.current) {
            containerRef.current.appendChild(renderer.domElement);
          }
          
          addDebug('✅ Fallback WebGL renderer created');
        } catch (fallbackErr: any) {
          console.error('[XRLessonPlayerV3] Fallback renderer also failed:', fallbackErr);
          throw new Error(`WebGL context creation failed: ${webglErr?.message || webglErr}. Fallback also failed: ${fallbackErr?.message || fallbackErr}`);
        }
      }
    
      // Add VR Button if supported (only if renderer was created successfully)
      // BUT: Hide until asset calculations are complete
      if (isVRSupported && containerRef.current && rendererRef.current) {
        try {
          const vrButton = VRButton.createButton(rendererRef.current);
          vrButton.style.position = 'absolute';
          vrButton.style.bottom = '20px';
          vrButton.style.left = '50%';
          vrButton.style.transform = 'translateX(-50%)';
          vrButton.style.zIndex = '100';
          vrButton.style.display = 'none'; // Hidden until calculations done
          containerRef.current.appendChild(vrButton);
          vrButtonRef.current = vrButton;
          
          // Listen for session start/end
          rendererRef.current.xr.addEventListener('sessionstart', () => {
            console.log(`${DEBUG_CATEGORIES.XR} VR session started`);
            
            // Store input sources for haptic feedback
            const session = rendererRef.current.xr.getSession();
            if (session && session.inputSources) {
              session.inputSources.forEach((inputSource, index) => {
                if (index < 2) {
                  inputSourcesRef.current[index] = inputSource;
                }
              });
              console.log(`[HAPTIC] Stored ${session.inputSources.length} input sources for haptic feedback`);
              addDebug(`Input sources stored: ${session.inputSources.length}`);
            }
            setLoadingState('in-vr');
            
            // Initialize layout engine and compute anchor from current head pose
            if (!layoutEngineRef.current) {
              layoutEngineRef.current = createLayoutEngine();
            }
            
            // CRITICAL: Must call initialize() before computeAnchor() for isReady() to return true
            const xrSession = rendererRef.current?.xr.getSession();
            if (xrSession) {
              layoutEngineRef.current.initialize(xrSession);
              console.log(`${DEBUG_CATEGORIES.LAYOUT} Layout engine initialized with XR session`);
            } else {
              layoutEngineRef.current.initialize();
              console.log(`${DEBUG_CATEGORIES.LAYOUT} Layout engine initialized without XR session`);
            }
            
            // Compute layout anchor after a brief delay for head tracking to stabilize
            setTimeout(() => {
              if (layoutEngineRef.current && cameraRef.current) {
                console.log(`\n🎯 [VR START] ════════════════════════════════════════`);
                console.log(`🎯 [VR START] Computing initial anchor on VR session start`);
                
                // Compute anchor
                layoutEngineRef.current.computeAnchor(cameraRef.current);
                
                // Get camera position for asset repositioning
                const cameraPos = new THREE.Vector3();
                cameraRef.current.getWorldPosition(cameraPos);
                console.log(`🎯 [VR START] Camera position: (${cameraPos.x.toFixed(3)}, ${cameraPos.y.toFixed(3)}, ${cameraPos.z.toFixed(3)})`);
                
                addDebug(`VR Session Started`);
                addDebug(`Camera Y: ${cameraPos.y.toFixed(2)}m`);
                
                // ═══════════════════════════════════════════════════════════════════
                // PROFESSIONAL LAYOUT: Update user pose and reposition assets
                // Uses collision-aware placement with zone management
                // ═══════════════════════════════════════════════════════════════════
                addDebug(`═══ VR SESSION STARTED ═══`);
                addDebug(`Camera Y: ${cameraPos.y.toFixed(2)}m`);
                
                // Update the professional layout system with current user pose
                if (professionalLayoutRef.current && cameraRef.current) {
                  professionalLayoutRef.current.updateUserPose(cameraRef.current, GROUND_LEVEL);
                  console.log(`[LayoutSystem] User pose updated for VR session`);
                  addDebug(`Layout System: User pose updated`);
                }
                
                // Update VR Lesson Experience with user pose
                if (vrExperienceRef.current && cameraRef.current) {
                  vrExperienceRef.current.updateUserPose(cameraRef.current, GROUND_LEVEL);
                  console.log(`[VRExperience] User pose updated for VR session`);
                  addDebug(`VR Experience: Stage positioned`);
                }
                
                addDebug(`Ground Level: ${GROUND_LEVEL}m`);
                addDebug(`Table Height: ${TABLE_HEIGHT}m`);
                addDebug(`Target Asset Y: ${(GROUND_LEVEL + TABLE_HEIGHT).toFixed(2)}m`);
                
                // ═══════════════════════════════════════════════════════════════════
                // STABLE LAYOUT ON VR SESSION START
                // Recompute anchors for VR mode and re-stage if needed
                // ═══════════════════════════════════════════════════════════════════
                const assetsGroup = sceneRef.current?.getObjectByName('assetsGroup');
                if (assetsGroup && assetsGroup.children.length > 0) {
                  console.log(`🎯 [VR START] ═══════════════════════════════════════`);
                  console.log(`🎯 [VR START] STABLE LAYOUT for ${assetsGroup.children.length} assets`);
                  
                  addDebug(`🔄 Stable Layout for ${assetsGroup.children.length} asset(s)`);
                  
                  // Initialize or update Stable Layout System
                  if (!stableLayoutRef.current) {
                    stableLayoutRef.current = new StableLayoutSystem({
                      stageDistance: 2.5,
                      stageWidth: 4.0,
                      stageDepth: 2.5,
                      horizontalOffset: 0.8,
                      floorHeight: GROUND_LEVEL,
                      modelSpacing: 0.5,
                      normalizedSize: 0.8,
                      environmentThreshold: 10.0,
                    });
                  }
                  
                  // Initialize or recompute anchors for VR
                  if (!stableLayoutRef.current.isReady()) {
                    stableLayoutRef.current.initialize(cameraRef.current, GROUND_LEVEL);
                  } else {
                    // Unlock and restage for VR mode
                    stableLayoutRef.current.unlockLayout();
                    stableLayoutRef.current.recomputeAnchors(cameraRef.current, GROUND_LEVEL);
                  }
                  
                  // Stage all models
                  const modelsToStage = assetsGroup.children as THREE.Object3D[];
                  const stagedModels = stableLayoutRef.current.stageModels(modelsToStage);
                  
                  addDebug(`Layout Engine Ready: ${stableLayoutRef.current.isReady()}`);
                  addDebug(`Models staged: ${stagedModels.length}`);
                  
                  // Log final positions
                  stagedModels.forEach((staged, index) => {
                    const pos = staged.model.position;
                    console.log(`🎯 [VR START] Asset ${index + 1}: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
                    addDebug(`Asset ${index + 1}: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
                  });
                  
                  console.log(`🎯 [VR START] ═══════════════════════════════════════`);
                } else {
                  console.log(`🎯 [VR START] No assets group found or empty`);
                  addDebug(`No assets to layout`);
                }
                
                console.log(`🎯 [VR START] ════════════════════════════════════════\n`);
                
                // Create START panel if lesson hasn't started
                if (!lessonStarted) {
                  createStartPanel();
                }
              }
            }, 500);
          });
          
          rendererRef.current.xr.addEventListener('sessionend', () => {
            console.log(`${DEBUG_CATEGORIES.XR} VR session ended`);
            setLoadingState('ready');
            
            // Remove start panel if exists
            if (startPanelRef.current && sceneRef.current) {
              sceneRef.current.remove(startPanelRef.current);
              startPanelRef.current = null;
            }
          });
        } catch (vrErr: any) {
          console.error('[XRLessonPlayerV3] VR button creation error:', vrErr);
          addDebug(`VR button error: ${vrErr?.message || vrErr}`);
        }
      }
    
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      setIsSceneReady(true);

      // If WebXR is not supported, enable a 2D/desktop fallback UI flow:
      // - mark scene as ready
      // - set loading state to 'ready'
      // - create the start panel so users can click to begin without a headset
      // - attach a pointer event listener that raycasts from the camera to UI panels
      if (!isVRSupported) {
        try {
          setLoadingState('ready');
          // Create the start panel (will be a clickable canvas texture)
          createStartPanel();

          // Pointer handler: translate screen pointer to a ray and detect UI button clicks
          const handlePointerDown = (event: PointerEvent) => {
            try {
              if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !raycasterRef.current) return;
              const rect = rendererRef.current.domElement.getBoundingClientRect();
              const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
              const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
              const mouse = new THREE.Vector2(x, y);
              raycasterRef.current.setFromCamera(mouse, cameraRef.current);

              const uiPanels = [scriptPanelRef.current, mcqPanelRef.current, startPanelRef.current].filter(Boolean) as THREE.Mesh[];
              const intersects = raycasterRef.current.intersectObjects(uiPanels, false);
              if (intersects.length === 0) return;

              const intersect = intersects[0];
              const panel = intersect.object as THREE.Mesh;
              if (!panel.userData.hasButtons || !panel.userData.buttons) return;

              // Convert world hit point to local panel coordinates, then to canvas pixels
              const localPoint = new THREE.Vector3();
              panel.worldToLocal(localPoint.copy(intersect.point));

              const canvasWidth = panel.userData.canvasWidth || 1000;
              const canvasHeight = panel.userData.canvasHeight || 700;

              // Panel geometry assumed to be width=2.0, height=1.4 (see createStartPanel)
              const canvasX = ((localPoint.x + 1.0) / 2.0) * canvasWidth;
              const canvasY = ((1.0 - localPoint.y) / 1.4) * canvasHeight;

              for (const button of panel.userData.buttons) {
                const { bounds, action } = button;
                if (
                  canvasX >= bounds.x &&
                  canvasX <= bounds.x + bounds.width &&
                  canvasY >= bounds.y &&
                  canvasY <= bounds.y + bounds.height
                ) {
                  try {
                    if (action && typeof action === 'function') {
                      action();
                    }
                  } catch (err: any) {
                    console.error('[XRLessonPlayerV3] Desktop UI action error:', err);
                  }
                  return;
                }
              }
            } catch (err: any) {
              console.error('[XRLessonPlayerV3] Desktop pointer handler error:', err);
            }
          };

          // Store handlers on renderer ref so cleanup can access same references
          (rendererRef as any)._desktopPointerDown = handlePointerDown;
          window.addEventListener('pointerdown', handlePointerDown);
        } catch (err: any) {
          console.error('[XRLessonPlayerV3] Desktop fallback init error:', err);
        }
      }
    }

    // Setup lighting
    // High ambient light since skybox uses MeshBasicMaterial (self-illuminating)
    // These lights are mainly for future 3D assets inside the skybox
    // STATE-OF-ART LIGHTING: High-quality lighting for asset rendering
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Main directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    directionalLight.shadow.bias = -0.0001;
    scene.add(directionalLight);
    
    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Rim light for edge definition
    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.3);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);
    
    // Add hemisphere light for natural lighting (sky/ground gradient)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    
    console.log('[XRLessonPlayerV3] Lights added: Ambient, Directional, Hemisphere');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // GROUND PLANE - Invisible reference surface for consistent asset placement
    // This provides a fixed Y=0 reference for all 3D assets
    // ═══════════════════════════════════════════════════════════════════════════
    const GROUND_Y = 0; // Ground level at Y=0
    const groundGeometry = new THREE.PlaneGeometry(50, 50); // 50m x 50m plane
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,           // Fully transparent - won't block skybox
      side: THREE.DoubleSide,
      depthWrite: false,    // Don't write to depth buffer
    });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2; // Rotate to horizontal (XZ plane)
    groundPlane.position.y = GROUND_Y;
    groundPlane.name = 'groundPlane';
    groundPlane.userData.isGround = true;
    groundPlane.userData.groundY = GROUND_Y;
    groundPlane.renderOrder = -1; // Render first (behind everything)
    scene.add(groundPlane);
    
    // Store ground reference for asset positioning
    groundPlaneRef.current = groundPlane;
    
    // Also add a subtle grid helper for development (semi-transparent)
    // This helps visualize the ground plane during testing
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.position.y = GROUND_Y + 0.001; // Slightly above ground to prevent z-fighting
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.15; // Very subtle
    gridHelper.name = 'groundGrid';
    gridHelper.visible = false; // Hidden by default - can enable for debugging
    scene.add(gridHelper);
    
    console.log(`[XRLessonPlayerV3] Ground plane added at Y=${GROUND_Y}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // PROFESSIONAL LAYOUT SYSTEM INITIALIZATION
    // Handles zone management, collision detection, and asset placement
    // ═══════════════════════════════════════════════════════════════════════
    const layoutSystem = new ProfessionalLayoutSystem({
      uiZone: {
        distance: 2.0,
        height: 0.0,
        width: 1.2,
        depth: 0.1,
      },
      assetZone: {
        minDistance: 2.0,
        maxDistance: 4.0,
        horizontalSpread: 90,
        verticalOffset: TABLE_HEIGHT,
      },
      interactionZone: {
        minDistance: 0.5,
        maxDistance: 5.0,
        floorY: GROUND_LEVEL,
        ceilingY: 3.0,
      },
    });
    layoutSystem.setNormalizedSize(NORMALIZED_SIZE);
    professionalLayoutRef.current = layoutSystem;
    
    console.log(`[XRLessonPlayerV3] Professional Layout System initialized`);
    addDebug(`═══ PROFESSIONAL LAYOUT SYSTEM ═══`);
    addDebug(`Normalized Size: ${NORMALIZED_SIZE}m`);
    addDebug(`UI Zone: 2.0m distance, left side`);
    addDebug(`Asset Zone: 2.0-4.0m, right side`);
    addDebug(`Collision Detection: ENABLED`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // VR LESSON EXPERIENCE - World-Class VR EdTech Layout
    // Creates stage platform, professional lighting, and natural grab controls
    // ═══════════════════════════════════════════════════════════════════════
    const vrExperience = new VRLessonExperience({
      panelSide: 'left',
      panel: {
        distance: 2.0,
        width: 1.2,
        height: 1.4,
        horizontalOffset: -1.0,
        verticalOffset: 0.0,
        tiltAngle: -8,
      },
      assetStage: {
        distance: 2.5,
        width: 3.0,
        depth: 2.0,
        horizontalOffset: 0.8,
        floorHeight: GROUND_LEVEL,
      },
      normalizedSize: NORMALIZED_SIZE,
      modelSpacing: 0.4,
    });
    vrExperience.initialize(scene);
    vrExperienceRef.current = vrExperience;
    
    console.log(`[XRLessonPlayerV3] VR Lesson Experience initialized`);
    addDebug(`═══ VR LESSON EXPERIENCE ═══`);
    addDebug(`Panel: LEFT side, 2.0m distance`);
    addDebug(`Asset Stage: RIGHT side, circular platform`);
    addDebug(`Stage Lighting: Spotlight + Ambient`);
    addDebug(`Natural Grab: ENABLED`);
    
    // Initialize raycaster for VR controller interaction
    const raycaster = new THREE.Raycaster();
    raycasterRef.current = raycaster;
    
    // Initialize XR Controller Model Factory
    const controllerModelFactory = new XRControllerModelFactory();
    controllerModelFactoryRef.current = controllerModelFactory;
    
    // Create reticle for raycast visualization
    const reticleGeometry = new THREE.RingGeometry(0.02, 0.04, 32);
    const reticleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    reticle.name = 'reticle';
    scene.add(reticle);
    reticleRef.current = reticle;
    
    // Setup XR Controllers
    const controller1 = rendererRef.current.xr.getController(0);
    const controller2 = rendererRef.current.xr.getController(1);
    
    // Setup controller connection handlers (only once per controller)
    const setupController = (controllerIndex: number, controller: THREE.Group) => {
      if (controllersSetupRef.current.has(controllerIndex)) {
        return; // Already setup
      }
      
      if (!rendererRef.current) {
        console.error('[XRLessonPlayerV3] Renderer not initialized when setting up controller');
        return;
      }
      
      controllersSetupRef.current.add(controllerIndex);
      addDebug(`Controller ${controllerIndex + 1} connected`);
      
      const controllerGrip = rendererRef.current.xr.getControllerGrip(controllerIndex);
      const gripModel = controllerModelFactory.createControllerModel(controllerGrip);
      controllerGrip.add(gripModel);
      scene.add(controllerGrip);
      
      if (controllerIndex === 0) {
        controller1Ref.current = controller;
      } else {
        controller2Ref.current = controller;
      }
      
      scene.add(controller);
      
      // Add ray visualization
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ]);
      const line = new THREE.Line(geometry);
      line.name = 'ray';
      line.scale.z = 5;
      controller.add(line);
      
      // Store input source for haptic feedback (update if session available)
      if (rendererRef.current?.xr?.getSession()) {
        const session = rendererRef.current.xr.getSession();
        if (session.inputSources && session.inputSources[controllerIndex]) {
          if (!inputSourcesRef.current) {
            inputSourcesRef.current = [];
          }
          inputSourcesRef.current[controllerIndex] = session.inputSources[controllerIndex];
          console.log(`[HAPTIC] Input source ${controllerIndex} stored for haptic feedback`);
        }
      }
      
      // Controller select handlers (debounced)
      const debouncedSelect = (() => {
        let timeout: NodeJS.Timeout | null = null;
        return () => {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(() => {
            handleControllerSelect(controller);
          }, 50);
        };
      })();
      
      controller.addEventListener('selectstart', debouncedSelect);
    };
    
    controller1.addEventListener('connected', () => setupController(0, controller1));
    controller2.addEventListener('connected', () => setupController(1, controller2));
    
    // Controller interaction handler
    const handleControllerSelect = (controller: THREE.Group) => {
      try {
        if (!raycasterRef.current || !controller) return;
        
        const raycaster = raycasterRef.current;
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyMatrix4(tempMatrix);
        
        const origin = new THREE.Vector3();
        controller.getWorldPosition(origin);
        
        raycaster.set(origin, direction);
        
        // Check panels first (for button clicks) - include start panel
        const panels = [scriptPanelRef.current, mcqPanelRef.current, startPanelRef.current].filter(Boolean) as THREE.Mesh[];
        const panelIntersects = raycaster.intersectObjects(panels, false);
        
        if (panelIntersects.length > 0) {
          const intersect = panelIntersects[0];
          const panel = intersect.object as THREE.Mesh;
          
          if (panel.userData.hasButtons && panel.userData.buttons && intersect.uv) {
            // Convert UV to canvas coordinates
            const uv = intersect.uv;
            // Use actual canvas dimensions from panel userData or defaults
            const canvasWidth = panel.userData.canvasWidth || (
              panel.userData.panelType === 'start' ? 1000 :
              panel.userData.panelType === 'strategy' ? 400 :
              1400
            );
            const canvasHeight = panel.userData.canvasHeight || (
              panel.userData.panelType === 'mcq' ? 1000 :
              panel.userData.panelType === 'start' ? 700 :
              panel.userData.panelType === 'strategy' ? 120 :
              800
            );
            const pixelX = uv.x * canvasWidth;
            const pixelY = (1 - uv.y) * canvasHeight;
            
            // Find clicked button
            for (const button of panel.userData.buttons) {
              const { bounds, action } = button;
              if (pixelX >= bounds.x && pixelX <= bounds.x + bounds.width &&
                  pixelY >= bounds.y && pixelY <= bounds.y + bounds.height) {
                // Debounce button clicks - reduced from 300ms to 100ms for more responsive clicks
                const buttonId = `${panel.name}_${bounds.x}_${bounds.y}`;
                const now = Date.now();
                const lastClick = lastGrabTimeRef.current.get(buttonId) || 0;
                if (now - lastClick < 100) {
                  console.log('[START BUTTON] Click debounced');
                  return;
                }
                lastGrabTimeRef.current.set(buttonId, now);
                
                // CRITICAL: Trigger haptic feedback for ALL button clicks
                if (controller1Ref.current) {
                  triggerHapticFeedback(controller1Ref.current);
                } else if (controller2Ref.current) {
                  triggerHapticFeedback(controller2Ref.current);
                }
                
                // Add explicit logging
                const buttonType = panel.userData.panelType === 'strategy' ? 'STRATEGY' : 'START';
                console.log(`[${buttonType} BUTTON] Click detected:`, {
                  buttonId,
                  pixelX: pixelX.toFixed(1),
                  pixelY: pixelY.toFixed(1),
                  bounds: {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                  },
                  uv: { x: uv.x.toFixed(3), y: uv.y.toFixed(3) },
                  canvasSize: { width: canvasWidth, height: canvasHeight }
                });
                
                // Execute immediately with error handling
                try {
                  if (action && typeof action === 'function') {
                    const buttonType = panel.userData.panelType === 'strategy' ? 'STRATEGY' : 'START';
                    console.log(`[${buttonType} BUTTON] Executing action`);
                    action();
                    // Trigger haptic feedback for button clicks
                    triggerHapticFeedback(controller);
                    if (panel.userData.panelType === 'strategy') {
                      addDebug(`✅ Strategy button clicked - changing layout`);
                    } else {
                      addDebug(`✅ START button clicked - lesson starting`);
                    }
                  } else {
                    console.warn(`[BUTTON] Action is not a function:`, action);
                    addDebug(`⚠️ Button action invalid`);
                  }
                } catch (err: any) {
                  console.error(`[BUTTON] Action error:`, err);
                  addDebug(`❌ Button error: ${err?.message || err}`);
                }
                return;
              }
            }
          }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // CRASH-SAFE 3D OBJECT GRABBING
        // Uses cached interactables from Stable Layout System
        // NO SCENE TRAVERSAL during interaction to prevent crash
        // ═══════════════════════════════════════════════════════════════
        
        // Guard against rapid-fire interactions
        const guard = interactionGuardRef.current;
        const now = Date.now();
        
        if (guard.isProcessing) {
          console.log('[XRLessonPlayerV3] CRASH GUARD: Interaction already processing, skipping');
          return;
        }
        
        // Rate limit: max 10 interactions per second
        if (now - guard.lastInteractionTime < 100) {
          guard.interactionCount++;
          if (guard.interactionCount > 10) {
            console.warn('[XRLessonPlayerV3] CRASH GUARD: Interaction rate limit hit');
            return;
          }
        } else {
          guard.interactionCount = 0;
        }
        guard.lastInteractionTime = now;
        guard.isProcessing = true;
        
        try {
          // Separate UI and asset layers for clean interaction
          const uiPanels: THREE.Mesh[] = [];
          const assetObjects: THREE.Object3D[] = [];
          
          // Collect UI panels first (priority)
          [scriptPanelRef.current, mcqPanelRef.current, startPanelRef.current].forEach(panel => {
            if (panel && panel.userData.layer === 'ui' && panel.visible) {
              uiPanels.push(panel);
            }
          });
          
          // Collect asset objects (only if not hitting UI)
          // CRITICAL FIX: Use getAllInteractableMeshes() for reliable raycast hit detection
          if (stableLayoutRef.current) {
            const interactableMeshes = stableLayoutRef.current.getAllInteractableMeshes();
            interactableMeshes.forEach((mesh) => {
              if (mesh.visible) {
                assetObjects.push(mesh);
              }
            });
            console.log(`[RAYCAST] Interactable meshes: ${assetObjects.length}`);
          }
          
          // Raycast UI layer first (priority)
          const uiIntersects = raycaster.intersectObjects(uiPanels, false);
          if (uiIntersects.length > 0) {
            const hitObject = uiIntersects[0].object;
            
            // Handle UI panel button clicks
            if (hitObject.userData.hasButtons && hitObject.userData.buttons) {
              const buttons = hitObject.userData.buttons;
              const canvasWidth = hitObject.userData.canvasWidth || 1000;
              const canvasHeight = hitObject.userData.canvasHeight || 700;
              
              // Convert 3D intersection to 2D canvas coordinates
              // Panel geometry is 2.0 x 1.4 units (width x height)
              const localPoint = new THREE.Vector3();
              hitObject.worldToLocal(localPoint.copy(uiIntersects[0].point));
              
              // Convert from local space (-1 to 1) to canvas coordinates (0 to width/height)
              // Panel extends from -1.0 to +1.0 in X, -0.7 to +0.7 in Y
              const canvasX = ((localPoint.x + 1.0) / 2.0) * canvasWidth;
              const canvasY = ((1.0 - localPoint.y) / 1.4) * canvasHeight; // Flip Y axis
              
              console.log(`[UI] Raycast hit at local (${localPoint.x.toFixed(3)}, ${localPoint.y.toFixed(3)}) -> canvas (${canvasX.toFixed(0)}, ${canvasY.toFixed(0)})`);
              
              // Check which button was clicked
              for (const button of buttons) {
                const { bounds, action } = button;
                if (
                  canvasX >= bounds.x &&
                  canvasX <= bounds.x + bounds.width &&
                  canvasY >= bounds.y &&
                  canvasY <= bounds.y + bounds.height
                ) {
                  console.log(`[UI] Button clicked at (${canvasX.toFixed(0)}, ${canvasY.toFixed(0)})`);
                  triggerHapticFeedback(controller);
                  action();
                  guard.isProcessing = false;
                  return;
                }
              }
            }
            
            guard.isProcessing = false;
            return; // UI handled, don't process as asset grab
          }
          
          // If no UI hit, check asset layer
          // CRITICAL FIX: Now raycasting against all meshes, not just root models
          const assetIntersects = raycaster.intersectObjects(assetObjects, false); // false = we already have meshes
          
          if (assetIntersects.length > 0) {
            const hitMesh = assetIntersects[0].object;
            
            // CRITICAL: Find the root model from the hit mesh
            let rootModel: THREE.Object3D | null = null;
            if (stableLayoutRef.current) {
              rootModel = stableLayoutRef.current.findRootModel(hitMesh);
            }
            
            // Log hit details for debugging
            console.log(`[RAYCAST] Hit mesh: "${hitMesh.name}" (${hitMesh.uuid.substring(0, 8)})`);
            console.log(`[RAYCAST] Root model: "${rootModel?.name || 'NOT FOUND'}" (${rootModel?.uuid.substring(0, 8) || 'N/A'})`);
            console.log(`[RAYCAST] Slot index: ${rootModel?.userData.slotIndex ?? 'N/A'}`);
            
            if (!rootModel) {
              console.warn(`[RAYCAST] ⚠️ Could not find root model for hit mesh "${hitMesh.name}"`);
              addDebug(`⚠️ Raycast hit mesh but no root model found`);
              guard.isProcessing = false;
              return;
            }
            
            const objId = rootModel.uuid || rootModel.name || 'unknown';
            
            // Debounce grabs
            const lastGrab = lastGrabTimeRef.current.get(objId) || 0;
            if (now - lastGrab < 300) {
              guard.isProcessing = false;
              return;
            }
            lastGrabTimeRef.current.set(objId, now);
            
            // Priority 1: Stable Layout System (crash-safe)
            if (stableLayoutRef.current) {
              const grabbed = stableLayoutRef.current.startGrab(rootModel, controller);
              if (grabbed) {
                // Mark root model as grabbed to disable gravity
                rootModel.userData.isGrabbed = true;
                // Trigger haptic feedback on successful grab
                triggerHapticFeedback(controller);
                console.log(`[GRAB] ✅ Successfully grabbed: "${rootModel.name}" (slot ${rootModel.userData.slotIndex})`);
                addDebug(`🎯 Grabbed: ${rootModel.name || 'object'} (slot ${rootModel.userData.slotIndex})`);
              } else {
                console.warn(`[GRAB] ❌ Failed to grab: "${rootModel.name}"`);
                addDebug(`❌ Grab failed: ${rootModel.name || 'object'}`);
              }
            }
            // Priority 2: VR Experience (legacy)
            else if (vrExperienceRef.current) {
              const grabbed = vrExperienceRef.current.startGrab(rootModel, controller);
              if (grabbed) {
                rootModel.userData.isGrabbed = true;
                rootModel.userData.grabController = controller;
                triggerHapticFeedback(controller);
                addDebug(`🎯 Grabbed: ${rootModel.name || 'object'} (VR Experience)`);
              }
            }
          }
        } catch (grabErr) {
          console.error('[XRLessonPlayerV3] CRASH GUARD: Error in grab:', grabErr);
        } finally {
          guard.isProcessing = false;
        }
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] Error in handleControllerSelect:', err);
      }
    };
    
    // Handle controller release (CRASH-SAFE)
    const handleControllerRelease = (controller: THREE.Group) => {
      try {
        // ═══════════════════════════════════════════════════════════════
        // CRASH-SAFE RELEASE - Priority order for stability
        // ═══════════════════════════════════════════════════════════════
        
        // Priority 1: Stable Layout System
        if (stableLayoutRef.current && stableLayoutRef.current.isGrabbing()) {
          const grabbedModel = stableLayoutRef.current.getGrabbedModel();
          stableLayoutRef.current.releaseGrab();
          
          if (grabbedModel) {
            grabbedModel.userData.isGrabbed = false;
            grabbedModel.userData.grabController = null;
            addDebug(`🎯 Released: ${grabbedModel.name || 'object'} (Stable Layout)`);
          }
          return;
        }
        
        // Priority 2: VR Experience
        if (vrExperienceRef.current && vrExperienceRef.current.isGrabbing()) {
          const grabbedObj = vrExperienceRef.current.getGrabbedObject();
          vrExperienceRef.current.releaseGrab();
          
          if (grabbedObj) {
            grabbedObj.userData.isGrabbed = false;
            grabbedObj.userData.grabController = null;
            addDebug(`🎯 Released: ${grabbedObj.name || 'object'} (VR Experience)`);
          }
          return;
        }
        
        // Priority 3: Fallback (NO SCENE TRAVERSAL - only check assets group)
        const assetsGroup = sceneRef.current?.getObjectByName('assetsGroup');
        if (assetsGroup) {
          assetsGroup.children.forEach((obj) => {
            if (obj.userData.isGrabbed && obj.userData.grabController === controller) {
              obj.userData.isGrabbed = false;
              obj.userData.grabController = null;
              addDebug(`Released: ${obj.name || 'object'}`);
            }
          });
        }
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] CRASH GUARD: Error in handleControllerRelease:', err);
      }
    };
    
    // Add release handlers
    controller1.addEventListener('selectend', () => handleControllerRelease(controller1));
    controller2.addEventListener('selectend', () => handleControllerRelease(controller2));
    
    // Load skybox inline (to avoid useCallback dependency issues)
    const imageFallback = fallbackImageUrl || lessonData?.topic?.skybox_url || null;
    
    (async () => {
      try {
        const urlStr = String(skyboxUrl || '');
        const fallbackStr = imageFallback ? String(imageFallback) : null;
        
        console.log('[XRLessonPlayerV3] Loading skybox:', urlStr.substring(0, 60));
        setLoadingMessage('Loading 360° environment...');
        
        // Setup loaders
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        gltfLoader.setDRACOLoader(dracoLoader);
        
        // Helper to load as equirectangular image
        const loadAsImage = async (imageUrl: string): Promise<void> => {
          console.log('[XRLessonPlayerV3] Loading as image:', imageUrl.substring(0, 60));
          const textureLoader = new THREE.TextureLoader();
          
          // Add crossOrigin for external images
          textureLoader.crossOrigin = 'anonymous';
          
          const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(
              imageUrl, 
              (tex) => {
                console.log('[XRLessonPlayerV3] Texture loaded:', tex.image?.width, 'x', tex.image?.height);
                resolve(tex);
              }, 
              undefined, 
              (err) => {
                console.error('[XRLessonPlayerV3] Texture load error:', err);
                reject(err);
              }
            );
          });
          
          // Configure texture for equirectangular mapping
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          // Create a large sphere (500 units radius) - camera is at center
          // Use FrontSide since we're INSIDE the sphere looking OUT
          // Flip UV coordinates by scaling geometry negatively on X
          const geometry = new THREE.SphereGeometry(500, 64, 32);
          geometry.scale(-1, 1, 1); // Flip to see texture from inside
          
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide, // We flipped geometry, so use FrontSide
          });
          
          const skyboxMesh = new THREE.Mesh(geometry, material);
          skyboxMesh.name = 'skybox';
          skyboxMesh.position.set(0, 0, 0); // Center at origin
          if (sceneRef.current) {
            sceneRef.current.add(skyboxMesh);
            console.log('[XRLessonPlayerV3] ✅ Image skybox added, children:', sceneRef.current.children.length);
            setLoadingState('ready');
          }
        };
        
        // Check if URL looks like GLB
        const urlLower = urlStr.toLowerCase();
        const looksLikeGLB = urlLower.includes('.glb') || urlLower.includes('.gltf');
        
        if (looksLikeGLB) {
          try {
            console.log('[XRLessonPlayerV3] Attempting GLB load...');
            const gltf = await new Promise<any>((resolve, reject) => {
              gltfLoader.load(urlStr, resolve, (p) => {
                const pct = p.total > 0 ? Math.round((p.loaded / p.total) * 100) : 0;
                setLoadingMessage(`Loading skybox: ${pct}%`);
              }, reject);
            });
            
            console.log('[XRLessonPlayerV3] GLB loaded, processing...');
            
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? 200 / maxDim : 1;
            
            gltf.scene.scale.setScalar(scale);
            gltf.scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
            
            gltf.scene.traverse((child: any) => {
              if (child instanceof THREE.Mesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat: any) => {
                  const tex = mat.map;
                  if (tex) {
                    child.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
                    tex.colorSpace = THREE.SRGBColorSpace;
                  } else {
                    mat.side = THREE.BackSide;
                    mat.depthWrite = false;
                  }
                });
              }
            });
            
            gltf.scene.name = 'skybox';
            gltf.scene.renderOrder = -1000;
            if (sceneRef.current) {
              sceneRef.current.add(gltf.scene);
              console.log('[XRLessonPlayerV3] ✅ GLB skybox added');
              setLoadingState('ready');
            }
            
          } catch (glbErr: any) {
            console.warn('[XRLessonPlayerV3] GLB failed:', glbErr?.message);
            const imageToLoad = fallbackStr || urlStr;
            await loadAsImage(imageToLoad);
          }
        } else {
          await loadAsImage(urlStr);
        }
        
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] Skybox load error:', err);
        setErrorMessage(`Failed to load skybox: ${err?.message || 'Unknown error'}`);
        setLoadingState('error');
      }
    })();
    
    // Animation loop (XR-compatible) - only if renderer exists
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.setAnimationLoop(() => {
        try {
          // Update billboards to face camera
          if (scriptPanelRef.current && cameraRef.current) {
            scriptPanelRef.current.lookAt(cameraRef.current.position);
          }
          if (mcqPanelRef.current && cameraRef.current) {
            mcqPanelRef.current.lookAt(cameraRef.current.position);
          }
          if (startPanelRef.current && cameraRef.current) {
            startPanelRef.current.lookAt(cameraRef.current.position);
          }
          
          // Gravity simulation: Make assets rest on dock when not grabbed
          if (assetsGroupRef.current && sceneLayoutRef.current && stableLayoutRef.current) {
            const isGrabbing = stableLayoutRef.current.isGrabbing();
            const dockSurfaceY = sceneLayoutRef.current.getAssetDockSurfaceY(GROUND_LEVEL);
            
            assetsGroupRef.current.children.forEach((asset) => {
              const obj = asset as THREE.Object3D;
              
              // Check if this specific asset is being grabbed
              const isThisAssetGrabbed = obj.userData.isGrabbed || isGrabbing;
              
              // Only apply gravity if asset rests on dock and is not being grabbed
              if (obj.userData.restsOnDock && !isThisAssetGrabbed && obj.userData.dockSurfaceY !== undefined) {
                const box = new THREE.Box3().setFromObject(obj);
                const size = box.getSize(new THREE.Vector3());
                const currentY = obj.position.y;
                const targetY = obj.userData.dockSurfaceY + size.y / 2;
                
                // If asset is above dock, apply gentle gravity
                if (currentY > targetY + 0.01) {
                  const gravity = 0.015; // Gentle downward force
                  obj.position.y = Math.max(targetY, currentY - gravity);
                  obj.updateMatrixWorld(true);
                } else if (currentY < targetY - 0.01) {
                  // If below dock, snap to surface
                  obj.position.y = targetY;
                  obj.updateMatrixWorld(true);
                }
              }
            });
          }
          
          // Ground plane is always transparent (no conditional visibility)
          
          // Update raycast for controllers (for hover feedback)
          if (raycasterRef.current && reticleRef.current && controller1Ref.current) {
            const raycaster = raycasterRef.current;
            const reticle = reticleRef.current;
            const controller = controller1Ref.current;
            
            if (controller.visible) {
              const tempMatrix = new THREE.Matrix4();
              tempMatrix.identity().extractRotation(controller.matrixWorld);
              
              const direction = new THREE.Vector3(0, 0, -1);
              direction.applyMatrix4(tempMatrix);
              
              const origin = new THREE.Vector3();
              controller.getWorldPosition(origin);
              
              raycaster.set(origin, direction);
              
              // Separate UI layer from asset layer for clean raycast
              const uiPanels: THREE.Mesh[] = [];
              const assetObjects: THREE.Object3D[] = [];
              
              // Collect UI panels (layer: 'ui')
              [scriptPanelRef.current, mcqPanelRef.current, startPanelRef.current].forEach(panel => {
                if (panel && panel.userData.layer === 'ui') {
                  uiPanels.push(panel);
                }
              });
              
              // Collect asset objects (layer: 'asset')
              if (sceneRef.current) {
                sceneRef.current.traverse((obj) => {
                  if (obj.userData.isInteractable && obj.visible && obj.userData.layer === 'asset') {
                    assetObjects.push(obj);
                  }
                });
              }
              
              // Priority: UI layer first, then assets
              const uiIntersects = raycaster.intersectObjects(uiPanels, false);
              const assetIntersects = uiIntersects.length === 0 
                ? raycaster.intersectObjects(assetObjects, false)
                : [];
              
              const intersects = [...uiIntersects, ...assetIntersects];
              
              if (intersects.length > 0) {
                const intersect = intersects[0];
                reticle.visible = true;
                reticle.position.copy(intersect.point);
                reticle.lookAt(origin);
                
                // Highlight hovered object (only 3D objects, not panels)
                const obj = intersect.object;
                if (obj.userData.isInteractable && !obj.userData.hasButtons) {
                  if (hoveredObjectRef.current !== obj) {
                    // Remove previous highlight
                    if (hoveredObjectRef.current && hoveredObjectRef.current.userData.originalScale) {
                      hoveredObjectRef.current.scale.copy(hoveredObjectRef.current.userData.originalScale);
                    }
                    
                    // Add new highlight
                    hoveredObjectRef.current = obj;
                    if (!obj.userData.originalScale) {
                      obj.userData.originalScale = new THREE.Vector3().copy(obj.scale);
                    }
                    obj.scale.multiplyScalar(1.05);
                  }
                } else {
                  // Clear 3D object highlight when hovering panels
                  if (hoveredObjectRef.current && hoveredObjectRef.current.userData.originalScale) {
                    hoveredObjectRef.current.scale.copy(hoveredObjectRef.current.userData.originalScale);
                    hoveredObjectRef.current = null;
                  }
                }
              } else {
                reticle.visible = false;
                if (hoveredObjectRef.current && hoveredObjectRef.current.userData.originalScale) {
                  hoveredObjectRef.current.scale.copy(hoveredObjectRef.current.userData.originalScale);
                  hoveredObjectRef.current = null;
                }
              }
            }
          }
          
          // Update grabbed objects position AND handle rotation/scale
          if (sceneRef.current) {
            // Get XR session for input sources (thumbstick data)
            const xrSession = rendererRef.current?.xr.getSession();
            let thumbstickX = 0;
            let thumbstickY = 0;
            
            if (xrSession) {
              // Read thumbstick input from controllers
              for (const inputSource of xrSession.inputSources) {
                if (inputSource.gamepad) {
                  const axes = inputSource.gamepad.axes;
                  // Axes 2 and 3 are typically the thumbstick (x, y)
                  if (axes.length >= 4) {
                    thumbstickX = axes[2] || 0;
                    thumbstickY = axes[3] || 0;
                  } else if (axes.length >= 2) {
                    thumbstickX = axes[0] || 0;
                    thumbstickY = axes[1] || 0;
                  }
                }
              }
            }
            
            // ═══════════════════════════════════════════════════════════════
            // CRASH-SAFE GRAB UPDATE - Use Stable Layout System
            // NO TRAVERSAL - uses cached interactables only
            // ═══════════════════════════════════════════════════════════════
            try {
              // Priority 1: Stable Layout System (crash-safe)
              if (stableLayoutRef.current && stableLayoutRef.current.isGrabbing()) {
                stableLayoutRef.current.updateGrab();
                
                // Apply thumbstick controls to grabbed model
                const grabbedModel = stableLayoutRef.current.getGrabbedModel();
                if (grabbedModel) {
                  // Thumbstick rotation
                  if (Math.abs(thumbstickX) > 0.1) {
                    grabbedModel.rotation.y += thumbstickX * 0.05;
                  }
                  // Thumbstick scale
                  if (Math.abs(thumbstickY) > 0.1) {
                    const scaleFactor = 1 + thumbstickY * 0.02;
                    const currentScale = grabbedModel.scale.x;
                    const newScale = Math.max(0.1, Math.min(5.0, currentScale * scaleFactor));
                    grabbedModel.scale.setScalar(newScale);
                  }
                }
              }
              // Priority 2: VR Experience (legacy)
              else if (vrExperienceRef.current && vrExperienceRef.current.isGrabbing()) {
                vrExperienceRef.current.updateGrab();
              }
            } catch (grabErr) {
              console.error('[XRLessonPlayerV3] CRASH GUARD: Error in grab update:', grabErr);
            }
          }
          
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        } catch (renderErr: any) {
          console.error('[XRLessonPlayerV3] Render error:', renderErr);
          // Don't stop the loop, just log the error
        }
      });
    }
    
    // Handle resize
    const handleResize = () => {
      try {
        if (cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = window.innerWidth / window.innerHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        }
      } catch (resizeErr: any) {
        console.error('[XRLessonPlayerV3] Resize error:', resizeErr);
      }
    };
    window.addEventListener('resize', handleResize);
    
      // Cleanup
      return () => {
        setIsSceneReady(false);
        try {
          window.removeEventListener('resize', handleResize);
          // Remove desktop pointer handler if we attached one
          try {
            const desktopHandler = (rendererRef as any)?._desktopPointerDown;
            if (desktopHandler) {
              window.removeEventListener('pointerdown', desktopHandler);
              (rendererRef as any)._desktopPointerDown = null;
            }
          } catch (e) {
            // ignore
          }
          if (rendererRef.current) {
            rendererRef.current.setAnimationLoop(null);
            rendererRef.current.dispose();
          }
          
          if (vrButtonRef.current && containerRef.current) {
            try {
              containerRef.current.removeChild(vrButtonRef.current);
            } catch (e) {
              // Button may already be removed
            }
          }
          if (containerRef.current && rendererRef.current?.domElement) {
            try {
              containerRef.current.removeChild(rendererRef.current.domElement);
            } catch (e) {
              // Element may already be removed
            }
          }
        } catch (cleanupErr: any) {
          console.error('[XRLessonPlayerV3] Cleanup error:', cleanupErr);
        }
      };
    } catch (initErr: any) {
      console.error('[XRLessonPlayerV3] Scene initialization error:', initErr);
      addDebug(`Scene init error: ${initErr?.message || initErr}`);
      setErrorMessage(`Failed to initialize scene: ${initErr?.message || 'Unknown error'}`);
      setLoadingState('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skyboxUrl, isVRSupported, fallbackImageUrl, addDebug]);
  
  // ============================================================================
  // Load 3D Assets into Scene
  // ============================================================================
  
  // Track if asset loading has been attempted to prevent duplicate logs
  const assetLoadingAttemptedRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Reset attempt flag when assets change
    if (meshyAssets.length > 0) {
      assetLoadingAttemptedRef.current = false;
    }
    
    // Log whenever this effect runs
    console.log('[XRLessonPlayerV3] ========== ASSET LOADING EFFECT TRIGGERED ==========');
    console.log('[XRLessonPlayerV3] Effect conditions:', {
      meshyAssetsLength: meshyAssets.length,
      loadingState,
      hasScene: !!sceneRef.current,
      alreadyAttempted: assetLoadingAttemptedRef.current,
      meshyAssets: meshyAssets.map(a => ({ 
        id: a.id, 
        name: a.name, 
        url: a.glbUrl?.substring(0, 50),
        fileSize: (a as any).fileSize ? `${((a as any).fileSize / (1024 * 1024)).toFixed(2)}MB` : 'unknown'
      }))
    });
    
    // Always log to debug panel
    addDebug(`========== ASSET LOADING EFFECT ==========`);
    addDebug(`Assets: ${meshyAssets.length} | State: ${loadingState} | Scene: ${!!sceneRef.current}`);
    addDebug(`Already attempted: ${assetLoadingAttemptedRef.current}`);
    
    try {
      // Allow asset loading when scene is ready OR when in VR
      if (!sceneRef.current || !isSceneReady) {
        console.warn('[XRLessonPlayerV3] Asset loading skipped: scene not ready');
        addDebug(`❌ Asset loading skipped: scene not ready`);
        return;
      }
      
      if (meshyAssets.length === 0) {
        console.warn('[XRLessonPlayerV3] Asset loading skipped: no assets');
        addDebug(`❌ Asset loading skipped: no assets (meshyAssets.length=0)`);
        return;
      }
      
      if (loadingState !== 'ready' && loadingState !== 'in-vr') {
        console.warn('[XRLessonPlayerV3] Asset loading skipped: wrong state', loadingState);
        addDebug(`❌ Asset loading skipped: state=${loadingState} (need 'ready' or 'in-vr')`);
        return;
      }
      
      // Mark as attempted to prevent duplicate logs
      if (assetLoadingAttemptedRef.current) {
        console.log('[XRLessonPlayerV3] Asset loading already attempted, skipping duplicate');
        addDebug(`⚠️ Asset loading already attempted, skipping duplicate`);
        return;
      }
      assetLoadingAttemptedRef.current = true;
      
      console.log('[XRLessonPlayerV3] ✅ Asset loading conditions met!');
      addDebug(`✅ Asset loading conditions met: scene ready, ${meshyAssets.length} asset(s), state=${loadingState}`);
      
      const scene = sceneRef.current;
      if (!scene) {
        console.error('[XRLessonPlayerV3] Scene ref exists but scene is null');
        addDebug(`❌ Scene ref exists but scene is null`);
        return;
      }
      
      // Check if assets are already loaded - but allow reload if count doesn't match
      const existingGroup = scene.getObjectByName('assetsGroup');
      if (existingGroup && existingGroup.children.length === meshyAssets.length) {
        console.log('[XRLessonPlayerV3] Assets group already exists with correct count, checking visibility...');
        addDebug(`⚠️ Assets group exists (${existingGroup.children.length} children), checking...`);
        
        // Check if assets are actually visible
        let hasVisibleAssets = false;
        existingGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh || (obj instanceof THREE.Group && obj.children.length > 0)) {
            if (obj.visible) hasVisibleAssets = true;
          }
        });
        
        if (hasVisibleAssets) {
          console.log('[XRLessonPlayerV3] Assets are visible, skipping reload');
          addDebug(`✅ Assets are visible, skipping reload`);
          return;
        } else {
          console.log('[XRLessonPlayerV3] Assets exist but not visible, reloading...');
          addDebug(`⚠️ Assets exist but not visible, removing and reloading...`);
          scene.remove(existingGroup);
          assetsGroupRef.current = null;
          
          // Unlock StableLayoutSystem and reset interaction state
          if (stableLayoutRef.current) {
            stableLayoutRef.current.unlockLayout();
            stableLayoutRef.current.releaseGrab(); // Release any grabbed models
          }
          // Reset interaction guard
          interactionGuardRef.current = { lastInteractionTime: 0, interactionCount: 0, isProcessing: false };
          lastGrabTimeRef.current.clear();
          hoveredObjectRef.current = null;
        }
      }
      
      // Remove existing group if it exists but is incomplete
      if (existingGroup && existingGroup.children.length !== meshyAssets.length) {
        console.log('[XRLessonPlayerV3] Removing incomplete assets group');
        scene.remove(existingGroup);
        assetsGroupRef.current = null;
        
        // Unlock StableLayoutSystem and reset interaction state
        if (stableLayoutRef.current) {
          stableLayoutRef.current.unlockLayout();
          stableLayoutRef.current.releaseGrab(); // Release any grabbed models
        }
        // Reset interaction guard
        interactionGuardRef.current = { lastInteractionTime: 0, interactionCount: 0, isProcessing: false };
        lastGrabTimeRef.current.clear();
        hoveredObjectRef.current = null;
      }
      
      addDebug('[XRLessonPlayerV3] Loading 3D assets into scene...');
      console.log('[XRLessonPlayerV3] Loading 3D assets into scene...');
    
    // Create a group to hold all assets
    const assetsGroup = new THREE.Group();
    assetsGroup.name = 'assetsGroup';
    assetsGroupRef.current = assetsGroup;
    
    // GLTFLoader supports both .gltf and .glb files natively
    // GLB is just the binary version of GLTF (single file vs JSON + bin)
    const gltfLoader = new GLTFLoader();
    
    // DRACO loader for compressed geometry (optional, but improves performance)
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload(); // Preload decoder for faster loading
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Verify GLB support
    console.log('[XRLessonPlayerV3] GLTFLoader initialized - supports .gltf and .glb files');
    addDebug('GLTFLoader ready (supports .gltf and .glb)');
    
    // Position assets directly in front of user (centered)
    const loadAssets = async () => {
      // CRITICAL: Always log to both console and debug panel
      console.log(`[XRLessonPlayerV3] ========== STARTING ASSET LOADING ==========`);
      console.log(`[XRLessonPlayerV3] Total assets to load: ${meshyAssets.length}`);
      console.log(`[XRLessonPlayerV3] Assets:`, meshyAssets.map(a => ({ 
        id: a.id, 
        name: a.name, 
        url: a.glbUrl?.substring(0, 60),
        fileSize: (a as any).fileSize ? `${((a as any).fileSize / (1024 * 1024)).toFixed(2)}MB` : 'unknown'
      })));
      
      // Force debug panel update
      addDebug(`========== STARTING ASSET LOADING ==========`);
      addDebug(`Total assets: ${meshyAssets.length}`);
      meshyAssets.forEach((asset, idx) => {
        const sizeMB = (asset as any).fileSize ? ((asset as any).fileSize / (1024 * 1024)).toFixed(2) : 'unknown';
        addDebug(`Asset ${idx + 1}: ${asset.name || asset.id} (${sizeMB}MB)`);
      });
      
      // Reset loaded count
      setAssetsLoaded(0);
      
      for (let i = 0; i < meshyAssets.length; i++) {
        const asset = meshyAssets[i];
        
        try {
          console.log(`[XRLessonPlayerV3] Loading asset ${i + 1}/${meshyAssets.length}:`, {
            name: asset.name || asset.id,
            url: asset.glbUrl?.substring(0, 80)
          });
          // Check file type from URL
          const rawUrl = asset.glbUrl || '';
          // Use proxy for Meshy/external URLs to avoid CORS "Failed to fetch" on Meta Quest WebXR
          const needsProxy = rawUrl.includes('meshy.ai') || rawUrl.includes('api.meshy');
          const assetUrl = needsProxy
            ? `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(rawUrl)}`
            : rawUrl;
          const isGLB = rawUrl.toLowerCase().includes('.glb');
          const isGLTF = rawUrl.toLowerCase().includes('.gltf');
          
          console.log(`[XRLessonPlayerV3] Loading asset ${i + 1}/${meshyAssets.length}:`, {
            name: asset.name || asset.id,
            type: isGLB ? 'GLB (binary)' : isGLTF ? 'GLTF (text)' : 'unknown',
            url: assetUrl.substring(0, 80)
          });
          addDebug(`========== LOADING ASSET ${i + 1}/${meshyAssets.length} ==========`);
          addDebug(`Name: ${asset.name || asset.id}`);
          addDebug(`Type: ${isGLB ? 'GLB (binary)' : isGLTF ? 'GLTF (text)' : 'unknown'}`);
          addDebug(`URL: ${assetUrl.substring(0, 60)}...`);
          if ((asset as any).fileSize) {
            addDebug(`Size: ${((asset as any).fileSize / (1024 * 1024)).toFixed(2)}MB`);
          }
          
          if (!assetUrl) {
            throw new Error('No asset URL provided');
          }
          
          if (!isGLB && !isGLTF) {
            console.warn(`[XRLessonPlayerV3] Asset ${i + 1} may not be GLTF/GLB format: ${assetUrl}`);
            addDebug(`⚠️ Warning: Asset may not be GLTF/GLB format`);
          }
          
          // Check file size and adjust timeout accordingly
          const fileSizeMB = (asset as any).fileSize ? (asset as any).fileSize / (1024 * 1024) : 0;
          const timeoutMs = fileSizeMB > 5 ? 120000 : fileSizeMB > 3 ? 60000 : 30000; // 2min for >5MB, 1min for >3MB, 30s for smaller
          
          if (fileSizeMB > 5) {
            console.warn(`[XRLessonPlayerV3] Large asset detected: ${fileSizeMB.toFixed(2)}MB, using extended timeout`);
            addDebug(`⚠️ Large asset: ${fileSizeMB.toFixed(2)}MB, this may take a while...`);
          }
          
          const gltf = await new Promise<any>((resolve, reject) => {
            let lastProgress = 0;
            const startTime = Date.now();
            
            const timeout = setTimeout(() => {
              reject(new Error(`GLB loading timeout after ${timeoutMs / 1000} seconds (file size: ${fileSizeMB.toFixed(2)}MB)`));
            }, timeoutMs);
            
            gltfLoader.load(
              assetUrl,
              (gltf) => {
                clearTimeout(timeout);
                const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[XRLessonPlayerV3] ✅ GLTF loaded for asset ${i + 1} in ${loadTime}s:`, {
                  scene: gltf.scene,
                  animations: gltf.animations?.length || 0,
                  cameras: gltf.cameras?.length || 0,
                  fileSizeMB: fileSizeMB.toFixed(2)
                });
                addDebug(`✅ GLTF loaded in ${loadTime}s (${fileSizeMB.toFixed(2)}MB)`);
                resolve(gltf);
              },
              (progress) => {
                if (progress.total > 0) {
                  const pct = Math.round((progress.loaded / progress.total) * 100);
                  const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(2);
                  const totalMB = (progress.total / (1024 * 1024)).toFixed(2);
                  
                  // Only log every 10% or if it's a large file
                  if (pct - lastProgress >= 10 || fileSizeMB > 3) {
                    console.log(`[XRLessonPlayerV3] Asset ${i + 1} loading: ${pct}% (${loadedMB}MB / ${totalMB}MB)`);
                    addDebug(`Asset ${i + 1} loading: ${pct}% (${loadedMB}MB / ${totalMB}MB)`);
                    lastProgress = pct;
                  }
                } else if (progress.loaded > 0) {
                  // Show progress even if total is unknown
                  const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(2);
                  console.log(`[XRLessonPlayerV3] Asset ${i + 1} loading: ${loadedMB}MB loaded...`);
                  addDebug(`Asset ${i + 1} loading: ${loadedMB}MB loaded...`);
                }
              },
              (error) => {
                clearTimeout(timeout);
                console.error(`[XRLessonPlayerV3] GLB load error for asset ${i + 1}:`, error);
                addDebug(`❌ GLB load error: ${error?.message || error}`);
                reject(error);
              }
            );
          });
          
          console.log(`[XRLessonPlayerV3] ✅ GLTF loaded for asset ${i + 1}, processing...`);
          addDebug(`✅ GLTF loaded successfully`);
          addDebug(`Processing geometry and materials...`);
          
          // ═══════════════════════════════════════════════════════════════════════
          // MODEL ANALYSIS SYSTEM - Analyze model geometry for smart positioning
          // ═══════════════════════════════════════════════════════════════════════
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          
          // Calculate model's bottom position (min Y of bounding box)
          const modelBottom = box.min.y;
          const modelTop = box.max.y;
          const modelHeight = modelTop - modelBottom;
          
          // Analyze model type based on center offset from bottom
          // If center.y is close to bottom, it's a "bottom-origin" model
          // If center.y is in middle, it's a "center-origin" model
          const centerOffset = center.y - modelBottom;
          const centerRatio = modelHeight > 0 ? centerOffset / modelHeight : 0.5;
          const modelType = centerRatio < 0.3 ? 'BOTTOM_ORIGIN' : 
                           centerRatio > 0.7 ? 'TOP_ORIGIN' : 'CENTER_ORIGIN';
          
          addDebug(`═══ MODEL ANALYSIS (Asset ${i + 1}) ═══`);
          addDebug(`Original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
          addDebug(`Model bottom Y: ${modelBottom.toFixed(2)}m`);
          addDebug(`Model center Y: ${center.y.toFixed(2)}m`);
          addDebug(`Model top Y: ${modelTop.toFixed(2)}m`);
          addDebug(`Model height: ${modelHeight.toFixed(2)}m`);
          addDebug(`Center ratio: ${(centerRatio * 100).toFixed(0)}% from bottom`);
          addDebug(`Model type: ${modelType}`);
          
          console.log(`🔍 [MODEL ANALYSIS] Asset ${i + 1}:`, {
            size: `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`,
            modelBottom: modelBottom.toFixed(2),
            modelCenter: center.y.toFixed(2),
            modelTop: modelTop.toFixed(2),
            modelHeight: modelHeight.toFixed(2),
            centerRatio: centerRatio.toFixed(2),
            modelType
          });
          
          // ═══════════════════════════════════════════════════════════════════════
          // NORMALIZED BOUNDING BOX SCALING
          // All assets are scaled to the SAME normalized size for visual consistency
          // This ensures a tiny model and a huge model both appear at ~1.2m
          // Uses the global NORMALIZED_SIZE constant defined at component level
          // ═══════════════════════════════════════════════════════════════════════
          let scale = maxDim > 0 ? NORMALIZED_SIZE / maxDim : 1;
          
          // Ensure minimum scale for very small models (prevent invisible assets)
          const minScale = 0.01;  // Allow very small scaling for huge models
          const maxScale = 100.0; // Allow large scaling for tiny models
          scale = Math.max(minScale, Math.min(maxScale, scale));
          
          console.log(`📏 [NORMALIZED SCALING] Asset ${i + 1}:`, {
            originalMaxDim: `${maxDim.toFixed(2)}m`,
            normalizedSize: `${NORMALIZED_SIZE}m`,
            scaleFactor: scale.toFixed(4),
            fileSizeMB: fileSizeMB.toFixed(2)
          });
          
          addDebug(`═══ NORMALIZED SCALING ═══`);
          addDebug(`Original max dim: ${maxDim.toFixed(2)}m`);
          addDebug(`Normalized to: ${NORMALIZED_SIZE}m`);
          addDebug(`Scale factor: ${scale.toFixed(4)}`);
          
          // ═══════════════════════════════════════════════════════════════════════
          // SMART CENTERING - Position model so its BOTTOM sits at Y=0 initially
          // Instead of centering at origin, we place the bottom at Y=0
          // This makes subsequent positioning predictable
          // ═══════════════════════════════════════════════════════════════════════
          
          // Center horizontally (X, Z) but place BOTTOM at Y=0
          const yOffsetForBottomAtZero = -modelBottom; // This moves bottom to Y=0
          gltf.scene.position.set(-center.x, yOffsetForBottomAtZero, -center.z);
          gltf.scene.scale.setScalar(scale);
          gltf.scene.name = `asset_${asset.id}`;
          
          // Calculate scaled height (needed for positioning)
          const scaledHeight = modelHeight * scale;
          
          addDebug(`Scaled height: ${scaledHeight.toFixed(2)}m`);
          console.log(`🔍 [MODEL ANALYSIS] Scaled height: ${scaledHeight.toFixed(2)}m, bottom now at local Y=0`);
          
          // Ensure the scene is visible and not culled
          gltf.scene.visible = true;
          gltf.scene.frustumCulled = false; // Disable frustum culling for large/complex models
          
          // ═══════════════════════════════════════════════════════════════════════
          // ASSET POSITION - PLACEHOLDER SYSTEM
          // Assets will be positioned using placeholder system after all are loaded
          // For now, set temporary position (will be updated by placeholder system)
          // ═══════════════════════════════════════════════════════════════════════
          console.log(`[ASSET_PLACEHOLDER] Asset ${i + 1}/${meshyAssets.length} loaded, will be positioned by placeholder system`);
          addDebug(`Asset ${i + 1} loaded (placeholder positioning pending)`);
          
          // STATE-OF-ART RENDERING: Enhance materials and lighting
          gltf.scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              // Enable high-quality shadows
              child.castShadow = true;
              child.receiveShadow = true;
              child.userData.isInteractable = true;
              child.userData.originalMaterial = child.material; // Store original
              child.userData.originalScale = new THREE.Vector3().copy(child.scale);
              
              if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat: any) => {
                  // Ensure material is visible and properly configured
                  mat.visible = true;
                  mat.transparent = false; // Ensure not transparent unless explicitly set
                  if (mat.opacity !== undefined) {
                    mat.opacity = 1.0; // Ensure fully opaque
                  }
                  
                  // High-quality texture settings
                  if (mat.map) {
                    mat.map.colorSpace = THREE.SRGBColorSpace;
                    mat.map.generateMipmaps = true;
                    mat.map.minFilter = THREE.LinearMipmapLinearFilter;
                    mat.map.magFilter = THREE.LinearFilter;
                    mat.map.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() || 1;
                  }
                  
                  // Normal maps for better detail
                  if (mat.normalMap) {
                    mat.normalMap.colorSpace = THREE.LinearSRGBColorSpace;
                  }
                  
                  // Environment maps for reflections
                  if (mat.envMap) {
                    mat.envMapIntensity = 1.0;
                  }
                  
                  // Material quality settings
                  if (!mat.colorSpace) {
                    mat.colorSpace = THREE.SRGBColorSpace;
                  }
                  
                  // Ensure proper roughness and metalness for PBR
                  if (mat.roughness !== undefined) {
                    mat.roughness = Math.max(0, Math.min(1, mat.roughness));
                  }
                  if (mat.metalness !== undefined) {
                    mat.metalness = Math.max(0, Math.min(1, mat.metalness));
                  }
                  
                  // Mark as updated
                  mat.needsUpdate = true;
                });
              }
            }
          });
          
          // Wrap in a group for interaction
          const assetGroup = new THREE.Group();
          assetGroup.name = `assetGroup_${asset.id}`;
          assetGroup.add(gltf.scene);
          
          // CRITICAL: Do NOT set temporary position - assets will be placed ONLY on dock
          // Position will be set by SceneLayoutSystem.placeAssetOnDock()
          // Start at origin (0,0,0) - will be moved to dock position by layout system
          assetGroup.position.set(0, 0, 0);
          
          // Mark as asset layer for raycast filtering
          assetGroup.userData.layer = 'asset';
          assetGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.userData.layer = 'asset';
            }
          });
          assetGroup.userData.isInteractable = true;
          assetGroup.userData.originalPosition = new THREE.Vector3().copy(assetGroup.position);
          assetGroup.userData.originalRotation = new THREE.Euler().copy(assetGroup.rotation);
          assetGroup.userData.originalScale = new THREE.Vector3().setScalar(1.0);
          assetGroup.userData.assetIndex = i; // Store index for placeholder assignment
          
          // Make sure the group and all children are visible
          assetGroup.visible = true;
          let meshCount = 0;
          assetGroup.traverse((obj) => {
            obj.visible = true;
            if (obj instanceof THREE.Mesh) {
              meshCount++;
              // Ensure material is visible
              if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((mat: any) => {
                  if (mat) {
                    mat.visible = true;
                    mat.transparent = false;
                    mat.opacity = 1.0;
                  }
                });
              }
            }
          });
          
          // Calculate final bounding box after scaling and positioning
          const finalBox = new THREE.Box3().setFromObject(assetGroup);
          const finalSize = finalBox.getSize(new THREE.Vector3());
          const finalCenter = finalBox.getCenter(new THREE.Vector3());
          const worldPos = new THREE.Vector3();
          assetGroup.getWorldPosition(worldPos);
          
          console.log(`[XRLessonPlayerV3] Asset group created:`, {
            name: assetGroup.name,
            position: assetGroup.position,
            worldPosition: worldPos,
            visible: assetGroup.visible,
            meshCount,
            children: assetGroup.children.length,
            finalSize: finalSize,
            finalCenter: finalCenter,
            scale: scale.toFixed(3)
          });
          
          addDebug(`Final asset size: ${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)}`);
          addDebug(`Final world position: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`);
          
          if (i === 0) {
            primaryAssetRef.current = assetGroup;
            console.log(`[XRLessonPlayerV3] ✅ Primary asset ref set: ${assetGroup.name}`);
            addDebug(`✅ Primary asset ref set: ${assetGroup.name}`);
          }
          
          assetsGroup.add(assetGroup);
          
          // Store asset reference for dock control
          assetRefs.current.set(asset.id, assetGroup);
          
          const newCount = i + 1;
          setAssetsLoaded(newCount);
          
          console.log(`[XRLessonPlayerV3] ✅ Asset ${newCount}/${meshyAssets.length} added to assetsGroup:`, {
            name: asset.name || asset.id,
            position: assetGroup.position,
            visible: assetGroup.visible,
            meshCount,
            fileSizeMB: fileSizeMB.toFixed(2)
          });
          addDebug(`========== ASSET ${newCount} COMPLETE ==========`);
          addDebug(`✅ Added: ${asset.name || asset.id}`);
          addDebug(`Size: ${fileSizeMB.toFixed(2)}MB | Meshes: ${meshCount}`);
          addDebug(`Position: (${assetGroup.position.x.toFixed(2)}, ${assetGroup.position.y.toFixed(2)}, ${assetGroup.position.z.toFixed(2)})`);
          addDebug(`Visible: ${assetGroup.visible}`);
          
        } catch (err: any) {
          console.error(`[XRLessonPlayerV3] Failed to load asset ${asset.id}:`, err);
          addDebug(`❌ ERROR loading asset ${i + 1}: ${err?.message || err}`);
        }
      }
      
      // Add assets group to scene
      if (sceneRef.current) {
        console.log(`[XRLessonPlayerV3] Adding assetsGroup to scene (${assetsGroup.children.length} children)`);
        sceneRef.current.add(assetsGroup);
        
        // Verify it's in the scene
        const foundGroup = sceneRef.current.getObjectByName('assetsGroup');
        if (foundGroup) {
          console.log('[XRLessonPlayerV3] ✅ Assets group added to scene:', {
            children: foundGroup.children.length,
            position: foundGroup.position,
            visible: foundGroup.visible
          });
          addDebug(`✅ Assets group added to scene (${foundGroup.children.length} assets)`);
          addDebug(`Position: (${foundGroup.position.x.toFixed(2)}, ${foundGroup.position.y.toFixed(2)}, ${foundGroup.position.z.toFixed(2)})`);
          addDebug(`Visible: ${foundGroup.visible}`);
          
          // Log all children with detailed info
          let meshTotal = 0;
          foundGroup.traverse((obj) => {
            if (obj instanceof THREE.Group || obj instanceof THREE.Mesh) {
              const worldPos = new THREE.Vector3();
              obj.getWorldPosition(worldPos);
              if (obj instanceof THREE.Mesh) meshTotal++;
              console.log('[XRLessonPlayerV3] Asset child:', {
                name: obj.name || obj.type,
                visible: obj.visible,
                worldPos: worldPos,
                isMesh: obj instanceof THREE.Mesh
              });
            }
          });
          addDebug(`Total meshes in scene: ${meshTotal}`);
          
          // Add a test cube to verify scene rendering works (only if no assets visible)
          if (meshTotal === 0) {
            const testGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const testCube = new THREE.Mesh(testGeometry, testMaterial);
            testCube.position.set(-1.0, 1.5, -1.7);
            testCube.name = 'testCube';
            sceneRef.current.add(testCube);
            addDebug(`🔴 Added RED test cube - no meshes found in assets!`);
          }
        } else {
          console.error('[XRLessonPlayerV3] ❌ Assets group not found after adding!');
          addDebug(`❌ ERROR: Assets group not found in scene after adding!`);
        }
        
        console.log('[XRLessonPlayerV3] ========== ASSET LOADING COMPLETE ==========');
        console.log('[XRLessonPlayerV3] Final scene info:', {
          totalChildren: sceneRef.current.children.length,
          assetChildren: foundGroup?.children.length || 0,
          assetsLoaded: assetsLoaded,
          meshyAssetsCount: meshyAssets.length
        });
        
        // Force debug panel update with all details
        addDebug(`========== ASSET LOADING COMPLETE ==========`);
        addDebug(`✅ Total scene children: ${sceneRef.current.children.length}`);
        addDebug(`✅ Asset groups in scene: ${foundGroup?.children.length || 0}`);
        addDebug(`✅ Assets loaded counter: ${assetsLoaded}/${meshyAssets.length}`);
        
        if (foundGroup && foundGroup.children.length > 0) {
          addDebug(`✅ SUCCESS: ${foundGroup.children.length} asset(s) visible in scene!`);
        } else {
          addDebug(`❌ WARNING: No assets found in scene after loading!`);
        }
        
        // Force a render to ensure visibility
        if (rendererRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
          console.log('[XRLessonPlayerV3] ✅ Forced render after adding assets');
          addDebug(`✅ Forced render complete`);
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // SCENE LAYOUT SYSTEM - Production-grade, scalable asset placement
        // ═══════════════════════════════════════════════════════════════════
        if (cameraRef.current && foundGroup && foundGroup.children.length > 0) {
          const assetCount = foundGroup.children.length;
          console.log(`\n[SCENE_LAYOUT] ═══════════════════════════════════════`);
          console.log(`[SCENE_LAYOUT] Total assets to place: ${assetCount}`);
          console.log(`[SCENE_LAYOUT] Strategy: ${placementStrategy}`);
          
          // Initialize Scene Layout System
          if (!sceneLayoutRef.current) {
            sceneLayoutRef.current = new SceneLayoutSystem({
              assetDock: {
                distance: 0.7,      // Hands distance
                height: 0.9,       // Desk height
                width: 1.8,         // Wider for more assets
                depth: 0.8,
                maxAssetSize: 0.25, // 25cm max
              },
              introDock: {
                distance: 2.5,      // Further away from asset dock
                height: 1.2,        // Eye level
                width: 2.0,
                height_panel: 1.4,
                spacing: 1.5,       // Clear spacing between zones
              },
              ground: {
                size: 20,
                gridDivisions: 20,
                fadeAngle: 30,
              },
            }, placementStrategy);
            addDebug(`✅ Scene Layout System initialized (strategy: ${placementStrategy})`);
          } else {
            // Update strategy if changed
            sceneLayoutRef.current.setStrategy(placementStrategy);
          }
          
          // Create asset dock in scene
          if (sceneRef.current && cameraRef.current) {
            sceneLayoutRef.current.createAssetDock(sceneRef.current, cameraRef.current, GROUND_LEVEL);
            addDebug(`✅ Asset dock created at hands distance`);
          }
          
          // Create ground plane
          if (sceneRef.current) {
            sceneLayoutRef.current.createGroundPlane(sceneRef.current, GROUND_LEVEL);
            addDebug(`✅ Ground plane created`);
          }
          
          // Calculate dynamic N placements for N assets
          // CRITICAL: N assets MUST produce N placements
          const placements = sceneLayoutRef.current.calculatePlacements(
            assetCount,
            cameraRef.current,
            GROUND_LEVEL
          );
          
          // Store placements for reference
          assetPlacementsRef.current = placements;
          
          // ═══════════════════════════════════════════════════════════════
          // CRITICAL VERIFICATION: N assets = N placements
          // ═══════════════════════════════════════════════════════════════
          console.log(`[SCENE_LAYOUT] ═══════════════════════════════════════`);
          console.log(`[SCENE_LAYOUT] ASSET COUNT VERIFICATION:`);
          console.log(`[SCENE_LAYOUT]   Total assets loaded: ${assetCount}`);
          console.log(`[SCENE_LAYOUT]   Placements generated: ${placements.length}`);
          console.log(`[SCENE_LAYOUT]   Match: ${assetCount === placements.length ? '✅ YES' : '❌ NO - BUG!'}`);
          
          if (assetCount !== placements.length) {
            console.error(`[SCENE_LAYOUT] ❌ CRITICAL BUG: Asset count (${assetCount}) != Placement count (${placements.length})`);
            addDebug(`❌ BUG: ${assetCount} assets but only ${placements.length} placements!`);
          }
          
          // Log each asset and its corresponding placement
          console.log(`[SCENE_LAYOUT] Asset → Placement mapping:`);
          foundGroup.children.forEach((asset, idx) => {
            const placement = placements[idx];
            console.log(`[SCENE_LAYOUT]   [${idx}] "${asset.name}" → Slot ${placement?.slotIndex ?? 'NONE'} at (${placement?.position.x.toFixed(2) ?? 'N/A'}, ${placement?.position.y.toFixed(2) ?? 'N/A'}, ${placement?.position.z.toFixed(2) ?? 'N/A'})`);
          });
          
          addDebug(`═══ SCENE LAYOUT SYSTEM ═══`);
          addDebug(`Strategy: ${placementStrategy}`);
          addDebug(`Assets: ${assetCount} | Placements: ${placements.length} ${assetCount === placements.length ? '✅' : '❌'}`);
          addDebug(`Dock surface Y: ${placements[0]?.dockSurfaceY.toFixed(2)}m`);
          
          // Place each asset with fit-to-dock scaling
          // CRITICAL: Pass total asset count for proper per-asset scaling
          const modelsToPlace = foundGroup.children as THREE.Object3D[];
          const totalAssets = modelsToPlace.length;
          
          console.log(`[SCENE_LAYOUT] Placing ${totalAssets} assets with ${placements.length} placements`);
          
          modelsToPlace.forEach((assetGroup, index) => {
            if (index < placements.length) {
              const placement = placements[index];
              
              console.log(`[SCENE_LAYOUT] Placing asset ${index + 1}/${totalAssets} (slot ${placement.slotIndex}):`, {
                assetName: assetGroup.name,
                assetUUID: assetGroup.uuid.substring(0, 8),
                targetPosition: `(${placement.position.x.toFixed(2)}, ${placement.position.y.toFixed(2)}, ${placement.position.z.toFixed(2)})`,
                strategy: placement.strategy,
                strategyScale: placement.scale,
              });
              
              // Place asset with fit-to-dock scaling, passing total count for proper sizing
              sceneLayoutRef.current!.placeAssetOnDock(
                assetGroup,
                placement,
                cameraRef.current!,
                GROUND_LEVEL,
                totalAssets // Pass total count for collision-aware scaling
              );
              
              // Store placement reference
              assetGroup.userData.placementIndex = index;
              assetGroup.userData.slotIndex = placement.slotIndex;
              assetGroup.userData.placementPosition = new THREE.Vector3().copy(placement.position);
              assetGroup.userData.placementRotation = new THREE.Euler().copy(placement.rotation);
              assetGroup.userData.dockSurfaceY = placement.dockSurfaceY;
              
              // Store original position for reset
              assetGroup.userData.originalPosition = new THREE.Vector3().copy(assetGroup.position);
              assetGroup.userData.originalRotation = new THREE.Euler().copy(assetGroup.rotation);
              
              // Verify placement
              const pos = assetGroup.position;
              const heightOnDock = pos.y - placement.dockSurfaceY;
              console.log(`[SCENE_LAYOUT] Asset ${index + 1} placed: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
              addDebug(`[DOCK] Asset ${index + 1} (slot ${placement.slotIndex}): (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
              
              // Ensure asset is resting on dock
              if (Math.abs(heightOnDock) > 0.1) {
                console.warn(`[SCENE_LAYOUT] ⚠️ Asset ${index + 1} height ${heightOnDock.toFixed(2)}m - adjusting to dock surface`);
                const box = new THREE.Box3().setFromObject(assetGroup);
                const size = box.getSize(new THREE.Vector3());
                assetGroup.position.y = placement.dockSurfaceY + size.y / 2;
                assetGroup.updateMatrixWorld(true);
              }
            } else {
              console.warn(`[SCENE_LAYOUT] ⚠️ No placement for asset ${index + 1} (${assetCount} assets, ${placements.length} placements)`);
              addDebug(`⚠️ Asset ${index + 1}: No placement available`);
            }
          });
          
          console.log(`[SCENE_LAYOUT] ═══════════════════════════════════════`);
          
          // CRITICAL: Show VR button only after all calculations are complete
          if (vrButtonRef.current) {
            vrButtonRef.current.style.display = 'block';
            addDebug(`✅ VR button enabled - calculations complete`);
            console.log(`[SCENE_LAYOUT] VR button enabled - all assets placed`);
          }
          
          // Initialize Stable Layout System for interaction handling (not placement)
          if (!stableLayoutRef.current) {
            stableLayoutRef.current = new StableLayoutSystem({
              stageDistance: 2.5,
              stageWidth: 4.0,
              stageDepth: 2.5,
              horizontalOffset: 0.8,
              floorHeight: GROUND_LEVEL,
              modelSpacing: 0.5,
              normalizedSize: 0.8,
              environmentThreshold: 10.0,
            });
          }
          
          // Initialize layout with camera pose (for interaction only)
          if (!stableLayoutRef.current.isReady()) {
            stableLayoutRef.current.initialize(cameraRef.current, GROUND_LEVEL);
          } else if (loadingState === 'in-vr') {
            stableLayoutRef.current.recomputeAnchors(cameraRef.current, GROUND_LEVEL);
          }
          
          // CRITICAL: Stage assets with StableLayoutSystem for interaction
          // This registers them in the interactable cache so they can be grabbed
          if (stableLayoutRef.current.isReady()) {
            const existingStagedModels = stableLayoutRef.current.getStagedModels();
            if (existingStagedModels.size > 0) {
              stableLayoutRef.current.unlockLayout();
              addDebug('Unlocked layout for re-staging');
            }
            
            // Stage all models (for interaction cache, not positioning)
            const modelsToStage = foundGroup.children as THREE.Object3D[];
            const stagedModels = stableLayoutRef.current.stageModels(modelsToStage);
            
            // ═══════════════════════════════════════════════════════════════
            // CRITICAL VERIFICATION: All assets must be staged for interaction
            // ═══════════════════════════════════════════════════════════════
            console.log(`[INTERACTION] ═══════════════════════════════════════`);
            console.log(`[INTERACTION] STAGING VERIFICATION:`);
            console.log(`[INTERACTION]   Models to stage: ${modelsToStage.length}`);
            console.log(`[INTERACTION]   Models staged: ${stagedModels.length}`);
            console.log(`[INTERACTION]   Match: ${modelsToStage.length === stagedModels.length ? '✅ YES' : '❌ NO - BUG!'}`);
            
            if (modelsToStage.length !== stagedModels.length) {
              console.error(`[INTERACTION] ❌ CRITICAL BUG: ${modelsToStage.length - stagedModels.length} models NOT staged!`);
              addDebug(`❌ BUG: ${modelsToStage.length - stagedModels.length} models not staged!`);
            }
            
            // Verify interactables are available
            const interactables = stableLayoutRef.current.getInteractables();
            const allMeshes = stableLayoutRef.current.getAllInteractableMeshes();
            
            console.log(`[INTERACTION]   Interactable root models: ${interactables.length}`);
            console.log(`[INTERACTION]   Total interactable meshes: ${allMeshes.length}`);
            
            // Debug print all staged models
            stableLayoutRef.current.debugPrintStagedModels();
            
            addDebug(`✅ Assets staged: ${stagedModels.length} models`);
            addDebug(`Interactables: ${interactables.length} roots, ${allMeshes.length} meshes`);
            console.log(`[INTERACTION] ═══════════════════════════════════════`);
          }
          
          // Force render after placement
          if (rendererRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        }
      } else {
        console.error('[XRLessonPlayerV3] ❌ Scene ref is null!');
        addDebug(`❌ ERROR: Scene ref is null, cannot add assets!`);
      }
    };
    
    loadAssets().catch((err) => {
      console.error('[XRLessonPlayerV3] Fatal error in loadAssets:', err);
      addDebug(`❌ FATAL: Asset loading failed: ${err?.message || err}`);
    });
    
    return () => {
      try {
        // Release any grabbed models
        if (stableLayoutRef.current?.isGrabbing()) {
          stableLayoutRef.current.releaseGrab();
        }
        
        // Unlock layout
        if (stableLayoutRef.current) {
          stableLayoutRef.current.unlockLayout();
        }
        
        // Remove assets from scene
        if (assetsGroupRef.current && sceneRef.current) {
          sceneRef.current.remove(assetsGroupRef.current);
        }
        
        // Reset interaction state
        interactionGuardRef.current = { lastInteractionTime: 0, interactionCount: 0, isProcessing: false };
        lastGrabTimeRef.current.clear();
        hoveredObjectRef.current = null;
        assetRefs.current.clear();
        
        // Cleanup scene layout system
        if (sceneLayoutRef.current && sceneRef.current) {
          sceneLayoutRef.current.dispose(sceneRef.current);
        }
        sceneLayoutRef.current = null;
        assetPlacementsRef.current = [];
        
      } catch (cleanupErr: any) {
        console.error('[XRLessonPlayerV3] Asset cleanup error:', cleanupErr);
      }
    };
    } catch (assetErr: any) {
      console.error('[XRLessonPlayerV3] Asset loading error:', assetErr);
      addDebug(`❌ Asset loading error: ${assetErr?.message || assetErr}`);
    }
  }, [meshyAssets, loadingState, addDebug, isSceneReady]);
  
  // Force asset loading when meshyAssets becomes available (separate trigger)
  useEffect(() => {
    if (meshyAssets.length > 0) {
      console.log('[XRLessonPlayerV3] MeshyAssets available:', meshyAssets.length, 'assets');
      addDebug(`🔄 MeshyAssets available: ${meshyAssets.length} asset(s)`);
      
      // If scene is ready, try loading immediately
      if (isSceneReady && (loadingState === 'ready' || loadingState === 'in-vr')) {
        console.log('[XRLessonPlayerV3] Scene ready, assets should load now');
        addDebug(`✅ Scene ready with ${meshyAssets.length} assets - loading should trigger`);
      }
    }
  }, [meshyAssets.length, loadingState, isSceneReady, addDebug]);
  
  // ============================================================================
  // TTS Audio Controls with State Machine
  // ============================================================================
  
  // Update audio progress
  useEffect(() => {
    if (!audioRef.current || ttsState !== 'playing') return;
    
    const updateProgress = () => {
      if (audioRef.current) {
        const current = audioRef.current.currentTime;
        const duration = audioRef.current.duration || 0;
        setAudioCurrentTime(current);
        setAudioDuration(duration);
        setAudioProgress(duration > 0 ? current / duration : 0);
      }
    };
    
    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, [ttsState]);
  
  // Get TTS for current phase
  const getTTSForPhase = useCallback((phase: LessonPhase): TTSData | null => {
    if (ttsData.length === 0) {
      console.log('[TTS MATCH] No TTS data available');
      return null;
    }
    
    // Map phase to expected section types
    let targetSections: string[] = ['full'];
    if (phase === 'intro') {
      targetSections = ['intro', 'introduction', 'avatar_intro'];
    } else if (phase === 'content') {
      targetSections = ['explanation', 'content', 'avatar_explanation', 'main'];
    } else if (phase === 'outro') {
      targetSections = ['outro', 'conclusion', 'avatar_outro', 'summary'];
    }
    
    console.log(`[TTS MATCH] Looking for phase=${phase}, targetSections=${targetSections.join(',')}`);
    console.log(`[TTS MATCH] Available TTS:`, ttsData.map(t => ({ id: t.id.substring(0, 40), section: t.section })));
    
    // Find matching TTS entry by section field
    const match = ttsData.find(tts => {
      const ttsSection = (tts.section || '').toLowerCase().trim();
      const isMatch = targetSections.some(target => ttsSection === target || ttsSection.includes(target));
      console.log(`[TTS MATCH] Checking ${tts.id.substring(0, 30)}... section="${ttsSection}" => ${isMatch ? 'MATCH' : 'no match'}`);
      return isMatch;
    });
    
    if (match) {
      console.log(`[TTS MATCH] ✅ Found match for ${phase}: ${match.id}`);
      addDebug(`Found TTS for ${phase}: ${match.section}`);
      return match;
    }
    
    // Fallback: Try to match by ID parsing
    const idMatch = ttsData.find(tts => {
      const idLower = (tts.id || '').toLowerCase();
      if (phase === 'intro' && (idLower.includes('_intro_') || idLower.endsWith('_intro'))) return true;
      if ((phase === 'content' || phase === 'explanation') && (idLower.includes('_explanation_') || idLower.includes('_content_'))) return true;
      if (phase === 'outro' && (idLower.includes('_outro_') || idLower.includes('_conclusion_'))) return true;
      return false;
    });
    
    if (idMatch) {
      console.log(`[TTS MATCH] ✅ Found ID match for ${phase}: ${idMatch.id}`);
      addDebug(`Found TTS for ${phase} (by ID): ${idMatch.id.substring(0, 40)}`);
      return idMatch;
    }
    
    console.log(`[TTS MATCH] ⚠️ No match for ${phase}, using fallback (first TTS)`);
    addDebug(`⚠️ No TTS match for ${phase}, using fallback`);
    return ttsData[0] || null;
  }, [ttsData, addDebug]);
  
  const playTTSForPhase = useCallback((phase: LessonPhase) => {
    const tts = getTTSForPhase(phase);
    if (!tts || !tts.audioUrl) {
      addDebug(`No TTS audio for phase: ${phase}`);
      setTtsState('idle');
      // Auto-advance to next phase if no audio
      if (phase === 'intro') {
        setTimeout(() => setLessonPhase('content'), 1000);
      } else if (phase === 'content') {
        setTimeout(() => setLessonPhase('outro'), 1000);
      } else if (phase === 'outro') {
        if (mcqData.length > 0) {
          setTimeout(() => setLessonPhase('mcq'), 1000);
        } else {
          setTimeout(() => setLessonPhase('complete'), 1000);
        }
      }
      return;
    }
    
    // Comprehensive TTS playback debug logging
    console.log('[TTS PLAYBACK] ========================================');
    console.log('[TTS PLAYBACK] Phase:', phase);
    console.log('[TTS PLAYBACK] TTS ID:', tts.id);
    console.log('[TTS PLAYBACK] Section:', (tts as any).script_type || tts.section);
    console.log('[TTS PLAYBACK] Audio URL:', tts.audioUrl?.substring(0, 80) + '...');
    console.log('[TTS PLAYBACK] Has text:', !!tts.text);
    console.log('[TTS PLAYBACK] ========================================');
    
    debugTTS(`Playing TTS for ${phase}: ${(tts as any).script_type || tts.section}`);
    
    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('timeupdate', () => {});
      audioRef.current = null;
    }
    
    const audio = new Audio(tts.audioUrl);
    audioRef.current = audio;
    
    audio.onplay = () => {
      setIsAudioPlaying(true);
      setTtsState('playing');
      addDebug(`Audio started: ${phase}`);
    };
    
    audio.onpause = () => {
      setIsAudioPlaying(false);
      setTtsState('paused');
    };
    
    audio.onended = () => {
      setIsAudioPlaying(false);
      setTtsState('ended');
      setAudioProgress(0);
      setAudioCurrentTime(0);
      addDebug(`Audio ended: ${phase}`);
      
      // Auto-advance to next phase
      if (phase === 'intro') {
        setLessonPhase('content');
      } else if (phase === 'content') {
        setLessonPhase('outro');
      } else if (phase === 'outro') {
        if (mcqData.length > 0) {
          setLessonPhase('mcq');
        } else {
          setLessonPhase('complete');
        }
      }
    };
    
    audio.onerror = (e) => {
      addDebug(`Audio error for ${phase}: ${e}`);
      setIsAudioPlaying(false);
      setTtsState('idle');
      // Still advance phase even if audio fails
      if (phase === 'intro') {
        setTimeout(() => setLessonPhase('content'), 1000);
      } else if (phase === 'content') {
        setTimeout(() => setLessonPhase('outro'), 1000);
      } else if (phase === 'outro') {
        if (mcqData.length > 0) {
          setTimeout(() => setLessonPhase('mcq'), 1000);
        } else {
          setTimeout(() => setLessonPhase('complete'), 1000);
        }
      }
    };
    
    audio.play().catch(err => {
      addDebug(`Audio autoplay blocked: ${err}`);
      setTtsState('idle');
      console.warn('[XRLessonPlayerV3] Audio autoplay blocked:', err);
    });
  }, [getTTSForPhase, mcqData.length, addDebug]);
  
  const toggleAudio = useCallback(() => {
    if (!audioRef.current) {
      playTTSForPhase(lessonPhase);
      return;
    }
    
    if (audioRef.current.paused) {
      audioRef.current.play();
      setTtsState('playing');
    } else {
      audioRef.current.pause();
      setTtsState('paused');
    }
  }, [lessonPhase, playTTSForPhase]);
  
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
      setTtsState('idle');
      setAudioProgress(0);
      setAudioCurrentTime(0);
    }
  }, []);
  
  const skipNext = useCallback(() => {
    stopAudio();
    if (lessonPhase === 'intro') {
      setLessonPhase('content');
    } else if (lessonPhase === 'content') {
      setLessonPhase('outro');
    } else if (lessonPhase === 'outro') {
      if (mcqData.length > 0) {
        setLessonPhase('mcq');
      } else {
        setLessonPhase('complete');
      }
    }
  }, [lessonPhase, mcqData.length, stopAudio]);
  
  const skipPrev = useCallback(() => {
    stopAudio();
    if (lessonPhase === 'content') {
      setLessonPhase('intro');
    } else if (lessonPhase === 'outro') {
      setLessonPhase('content');
    } else if (lessonPhase === 'mcq') {
      setLessonPhase('outro');
    }
  }, [lessonPhase, stopAudio]);
  
  // Skip directly to Quiz - for users who want to skip all TTS phases
  const skipToQuiz = useCallback(() => {
    stopAudio();
    if (mcqData.length > 0) {
      setLessonPhase('mcq');
      debugQuiz('⏭️ Skipped to Quiz');
    } else {
      setLessonPhase('complete');
      debugQuiz('⏭️ No quiz available - completing lesson');
    }
  }, [mcqData.length, stopAudio, addDebug]);
  
  // ============================================================================
  // Haptic Feedback Helper
  // ============================================================================
  
  const triggerHapticFeedback = useCallback((controller: THREE.Group) => {
    try {
      // Find which controller this is (0 or 1)
      let controllerIndex = -1;
      if (controller === controller1Ref.current) {
        controllerIndex = 0;
      } else if (controller === controller2Ref.current) {
        controllerIndex = 1;
      }
      
      if (controllerIndex >= 0 && inputSourcesRef.current[controllerIndex]) {
        const inputSource = inputSourcesRef.current[controllerIndex];
        const gamepad = inputSource.gamepad;
        
        if (gamepad?.hapticActuators?.[0]) {
          // Trigger haptic pulse: intensity 0.5, duration 50ms
          gamepad.hapticActuators[0].pulse(0.5, 50);
          console.log(`[HAPTIC] Vibration triggered on controller ${controllerIndex}`);
          addDebug(`[HAPTIC] Controller ${controllerIndex} vibrated`);
        } else {
          console.log(`[HAPTIC] No haptic actuators available on controller ${controllerIndex}`);
        }
      } else {
        // Fallback: try to get from XR session
        if (rendererRef.current?.xr?.getSession()) {
          const session = rendererRef.current.xr.getSession();
          if (session.inputSources && session.inputSources.length > 0) {
            const inputSource = session.inputSources[controllerIndex >= 0 ? controllerIndex : 0];
            if (inputSource?.gamepad?.hapticActuators?.[0]) {
              inputSource.gamepad.hapticActuators[0].pulse(0.5, 50);
              console.log(`[HAPTIC] Vibration triggered via session fallback`);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[HAPTIC] Error triggering haptic feedback:', err);
    }
  }, [addDebug]);
  
  // ============================================================================
  // START Button Panel (Gate before lesson begins)
  // ============================================================================
  
  const handleLessonStart = useCallback(() => {
    console.log('[LESSON START] ========================================');
    console.log('[LESSON START] User pressed START button');
    console.log('[LESSON START] Current state before start:', {
      lessonPhase,
      lessonStarted,
      ttsDataCount: ttsData.length,
      mcqDataCount: mcqData.length,
      layoutEngineReady: layoutEngineRef.current?.isReady() || false,
    });
    
    debugXR('Lesson START button pressed');
    addDebug('🚀 Lesson started by user');
    
    // Remove start panel
    if (startPanelRef.current && sceneRef.current) {
      sceneRef.current.remove(startPanelRef.current);
      startPanelRef.current = null;
      debugUI('Start panel removed');
    }
    
    // Strategy rotation: Select a random strategy for this lesson (only 3 remaining strategies)
    const strategies: PlacementStrategy[] = [
      'curved-arc',
      'focus-secondary',
      'carousel'
    ];
    const selectedStrategy = strategies[Math.floor(Math.random() * strategies.length)];
    setPlacementStrategy(selectedStrategy);
    if (sceneLayoutRef.current) {
      sceneLayoutRef.current.setStrategy(selectedStrategy);
      addDebug(`Placement strategy rotated to: ${selectedStrategy}`);
      console.log(`[LESSON START] Placement strategy: ${selectedStrategy}`);
    }
    
    // Mark lesson as started and transition to intro phase
    setLessonStarted(true);
    setLessonPhase('intro');
    
    console.log('[LESSON START] Transitioning to INTRO phase');
    console.log('[LESSON START] TTS data available:', ttsData.map(t => ({ id: t.id, section: t.section })));
    console.log('[LESSON START] MCQ data available:', mcqData.length, 'questions');
    console.log('[LESSON START] ========================================');
    
    // Recompute layout anchor at start
    if (layoutEngineRef.current && cameraRef.current) {
      layoutEngineRef.current.computeAnchor(cameraRef.current);
      debugLayout('Layout anchor recomputed at lesson start');
    }
  }, [addDebug, lessonPhase, lessonStarted, ttsData, mcqData, debugXR, debugUI, debugLayout, loadingState]);
  
  // ============================================================================
  // Change Placement Strategy - MUST be defined BEFORE createStartPanel
  // ============================================================================
  
  // Change placement strategy and reposition assets
  const changePlacementStrategy = useCallback((newStrategy: PlacementStrategy) => {
    if (!sceneLayoutRef.current || !cameraRef.current || !assetsGroupRef.current || !sceneRef.current) {
      console.warn('[STRATEGY] Cannot change strategy: missing refs');
      addDebug(`⚠️ Cannot change strategy: missing refs`);
      return;
    }
    
    console.log(`[STRATEGY] Changing placement strategy to: ${newStrategy}`);
    addDebug(`🔄 Changing strategy to: ${newStrategy}`);
    
    // Update state and system strategy
    setPlacementStrategy(newStrategy);
    sceneLayoutRef.current.setStrategy(newStrategy);
    
    const assetCount = assetsGroupRef.current.children.length;
    
    // Recalculate dynamic N placements with new strategy
    const placements = sceneLayoutRef.current.calculatePlacements(
      assetCount,
      cameraRef.current,
      GROUND_LEVEL
    );
    
    // Store placements
    assetPlacementsRef.current = placements;
    
    console.log(`[STRATEGY] Recalculated ${placements.length} placements for ${assetCount} assets`);
    addDebug(`📐 Placements: ${placements.length} for ${assetCount} assets`);
    
    // CRITICAL: Force immediate repositioning of all assets
    // Reposition all assets with fit-to-dock scaling, passing total count for proper sizing
    const totalAssets = assetsGroupRef.current.children.length;
    
    assetsGroupRef.current.children.forEach((assetGroup, index) => {
      if (index < placements.length) {
        const placement = placements[index];
        const asset = assetGroup as THREE.Object3D;
        
        console.log(`[STRATEGY] Repositioning asset ${index + 1}/${totalAssets} to slot ${placement.slotIndex}:`, {
          oldPosition: `(${asset.position.x.toFixed(2)}, ${asset.position.y.toFixed(2)}, ${asset.position.z.toFixed(2)})`,
          newPosition: `(${placement.position.x.toFixed(2)}, ${placement.position.y.toFixed(2)}, ${placement.position.z.toFixed(2)})`,
        });
        
        // Place asset on dock with fit-to-dock scaling, passing total count
        sceneLayoutRef.current!.placeAssetOnDock(
          asset,
          placement,
          cameraRef.current!,
          GROUND_LEVEL,
          totalAssets
        );
        
        // Update placement reference
        asset.userData.placementIndex = index;
        asset.userData.slotIndex = placement.slotIndex;
        asset.userData.placementPosition = new THREE.Vector3().copy(placement.position);
        asset.userData.placementRotation = new THREE.Euler().copy(placement.rotation);
        asset.userData.dockSurfaceY = placement.dockSurfaceY;
        
        // Store original position
        asset.userData.originalPosition = new THREE.Vector3().copy(asset.position);
        
        // CRITICAL: Force update matrix to ensure position is applied
        asset.updateMatrixWorld(true);
        
        // Verify placement on dock
        const finalPos = asset.position;
        const distanceFromTarget = finalPos.distanceTo(placement.position);
        const heightOnDock = finalPos.y - placement.dockSurfaceY;
        
        console.log(`[STRATEGY] Asset ${index + 1} repositioned:`, {
          finalPosition: `(${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)})`,
          targetPosition: `(${placement.position.x.toFixed(2)}, ${placement.position.y.toFixed(2)}, ${placement.position.z.toFixed(2)})`,
          distanceFromTarget: distanceFromTarget.toFixed(3) + 'm',
          heightOnDock: heightOnDock.toFixed(3) + 'm',
        });
        
        if (distanceFromTarget > 0.1) {
          console.warn(`[STRATEGY] ⚠️ Asset ${index} is ${distanceFromTarget.toFixed(2)}m from target - forcing position`);
          asset.position.copy(placement.position);
          const box = new THREE.Box3().setFromObject(asset);
          const size = box.getSize(new THREE.Vector3());
          asset.position.y = placement.dockSurfaceY + size.y / 2;
          asset.updateMatrixWorld(true);
        }
      } else {
        console.warn(`[STRATEGY] ⚠️ Asset ${index} has no placement (${assetCount} assets, ${placements.length} placements)`);
        addDebug(`⚠️ Asset ${index}: No placement`);
      }
    });
    
    // Force render to show changes immediately
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    
    // Re-stage assets for interaction
    if (stableLayoutRef.current && stableLayoutRef.current.isReady()) {
      stableLayoutRef.current.unlockLayout();
      const modelsToStage = assetsGroupRef.current.children as THREE.Object3D[];
      stableLayoutRef.current.stageModels(modelsToStage);
      addDebug(`✅ Assets re-staged for interaction: ${modelsToStage.length} models`);
    }
    
    addDebug(`✅ Strategy changed to: ${newStrategy} (${placements.length} placements)`);
    console.log(`[STRATEGY] Strategy changed to ${newStrategy}, ${placements.length} placements, assets repositioned`);
  }, [addDebug, loadingState, lessonStarted]);
  
  // ============================================================================
  // START Panel Creation
  // ============================================================================
  
  const createStartPanel = useCallback(() => {
    try {
      if (!sceneRef.current || !cameraRef.current || !layoutEngineRef.current) {
        console.warn('[XRLessonPlayerV3] Cannot create start panel: scene, camera, or layout engine not ready');
        return null;
      }
      
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      
      // Remove existing start panel
      const existing = scene.getObjectByName('startPanel');
      if (existing) {
        scene.remove(existing);
      }
      
      // Create canvas for start screen
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 700;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Glassmorphism background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      gradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.92)');
      gradient.addColorStop(1, 'rgba(51, 65, 85, 0.90)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Cyan glow border
      ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
      ctx.shadowBlur = 40;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 10;
      ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
      
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Title - Lesson Name
      const lessonTitle = lessonData?.topic?.topic_name || 'Lesson';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 56px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(lessonTitle.substring(0, 30), canvas.width / 2, 120);
      
      // Subtitle - Subject
      const subtitle = `${lessonData?.chapter?.subject || ''} • ${lessonData?.chapter?.class_name || ''}`;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '32px Arial';
      ctx.fillText(subtitle, canvas.width / 2, 175);
      
      // Divider line
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 220);
      ctx.lineTo(canvas.width - 100, 220);
      ctx.stroke();
      
      // Content info
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '28px Arial';
      ctx.textAlign = 'left';
      
      const hasIntro = !!(lessonData as any)?.topic?.avatar_intro;
      const hasContent = !!(lessonData as any)?.topic?.avatar_explanation;
      const hasOutro = !!(lessonData as any)?.topic?.avatar_outro;
      const hasMCQ = mcqData.length > 0;
      const hasAssets = meshyAssets.length > 0;
      
      let infoY = 280;
      const infoX = 120;
      
      ctx.fillText(`📖 Sections: ${[hasIntro && 'Intro', hasContent && 'Explanation', hasOutro && 'Conclusion'].filter(Boolean).join(', ') || 'None'}`, infoX, infoY);
      infoY += 45;
      
      if (hasMCQ) {
        ctx.fillText(`❓ Quiz: ${mcqData.length} questions`, infoX, infoY);
        infoY += 45;
      }
      
      if (hasAssets) {
        ctx.fillText(`📦 3D Assets: ${meshyAssets.length} models`, infoX, infoY);
        infoY += 45;
      }
      
      if (ttsData.length > 0) {
        ctx.fillText(`🔊 Audio narration included`, infoX, infoY);
      }
      
      // Initialize buttons array for this panel
      const panelButtons: Array<{ bounds: { x: number; y: number; width: number; height: number }; action: () => void }> = [];
      
      // Placement Strategy Toggle (always visible in panel when assets exist)
      if (hasAssets && meshyAssets.length > 0) {
        infoY += 50;
        ctx.fillStyle = '#a78bfa';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🎯 Asset Layout:', infoX, infoY);
        
        // Strategy buttons
        const strategyNames: Record<PlacementStrategy, string> = {
          'curved-arc': 'Curved Arc',
          'focus-secondary': 'Focus + Secondary',
          'carousel': 'Carousel',
          'grid': 'Grid'
        };
        
        const buttonWidth = 200;
        const buttonHeight = 40;
        const buttonSpacing = 20;
        const startX = infoX;
        let currentX = startX;
        const strategyButtonY = infoY + 15;
        
        // Show all strategies including grid (dynamic N placements)
        const strategies: PlacementStrategy[] = ['curved-arc', 'focus-secondary', 'carousel', 'grid'];
        strategies.forEach((strategy, idx) => {
          const isActive = placementStrategy === strategy;
          
          // Button background
          ctx.fillStyle = isActive ? '#8b5cf6' : 'rgba(51, 65, 85, 0.8)';
          ctx.fillRect(currentX, strategyButtonY, buttonWidth, buttonHeight);
          
          // Button border
          ctx.strokeStyle = isActive ? '#a78bfa' : 'rgba(139, 92, 246, 0.3)';
          ctx.lineWidth = 2;
          ctx.strokeRect(currentX, strategyButtonY, buttonWidth, buttonHeight);
          
          // Button text
          ctx.fillStyle = isActive ? '#ffffff' : '#94a3b8';
          ctx.font = isActive ? 'bold 18px Arial' : '18px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(strategyNames[strategy] || strategy, currentX + buttonWidth / 2, strategyButtonY + 28);
          
          // Store button bounds for click detection
          panelButtons.push({
            bounds: {
              x: currentX,
              y: strategyButtonY,
              width: buttonWidth,
              height: buttonHeight
            },
            action: () => {
              changePlacementStrategy(strategy);
              addDebug(`Strategy changed to: ${strategyNames[strategy] || strategy}`);
            }
          });
          
          currentX += buttonWidth + buttonSpacing;
        });
        
        // Show placement count info
        const placementCount = assetPlacementsRef.current.length;
        const assetCount = meshyAssets.length;
        ctx.fillStyle = '#64748b';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Placements: ${placementCount}/${assetCount}`, infoX, strategyButtonY + buttonHeight + 25);
        
        infoY += 70; // Space for strategy buttons
      }
      
      // START Button
      const buttonWidth = 300;
      const buttonHeight = 90;
      const buttonX = (canvas.width - buttonWidth) / 2;
      const buttonY = canvas.height - 160;
      
      // Button gradient background
      const btnGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
      btnGradient.addColorStop(0, '#06b6d4');
      btnGradient.addColorStop(1, '#0891b2');
      ctx.fillStyle = btnGradient;
      
      // Rounded rectangle
      const radius = 20;
      ctx.beginPath();
      ctx.moveTo(buttonX + radius, buttonY);
      ctx.lineTo(buttonX + buttonWidth - radius, buttonY);
      ctx.quadraticCurveTo(buttonX + buttonWidth, buttonY, buttonX + buttonWidth, buttonY + radius);
      ctx.lineTo(buttonX + buttonWidth, buttonY + buttonHeight - radius);
      ctx.quadraticCurveTo(buttonX + buttonWidth, buttonY + buttonHeight, buttonX + buttonWidth - radius, buttonY + buttonHeight);
      ctx.lineTo(buttonX + radius, buttonY + buttonHeight);
      ctx.quadraticCurveTo(buttonX, buttonY + buttonHeight, buttonX, buttonY + buttonHeight - radius);
      ctx.lineTo(buttonX, buttonY + radius);
      ctx.quadraticCurveTo(buttonX, buttonY, buttonX + radius, buttonY);
      ctx.closePath();
      ctx.fill();
      
      // Button text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('▶ START', canvas.width / 2, buttonY + 58);
      
      // Instruction text
      ctx.fillStyle = '#64748b';
      ctx.font = '24px Arial';
      ctx.fillText('Point and click to begin', canvas.width / 2, canvas.height - 40);
      
      // CRITICAL: Add START button to panelButtons for click detection
      panelButtons.push({
        bounds: {
          x: buttonX,
          y: buttonY,
          width: buttonWidth,
          height: buttonHeight
        },
        action: () => {
          console.log('[START_BUTTON] START button clicked!');
          handleLessonStart();
        }
      });
      
      console.log(`[START_PANEL] Button bounds registered: ${panelButtons.length} buttons total`);
      panelButtons.forEach((btn, idx) => {
        console.log(`  [${idx}] Bounds: x=${btn.bounds.x}, y=${btn.bounds.y}, w=${btn.bounds.width}, h=${btn.bounds.height}`);
      });
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // Create plane mesh
      const geometry = new THREE.PlaneGeometry(2.0, 1.4);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x06b6d4),
        emissiveIntensity: 0.1,
        roughness: 0.2,
        metalness: 0.2,
      });
      
      const panel = new THREE.Mesh(geometry, material);
      panel.name = 'startPanel';
      
      // Get camera position for reference
      const cameraPos = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);
      
      // Get camera forward direction (flattened to horizontal)
      const rawForward = new THREE.Vector3(0, 0, -1);
      rawForward.applyQuaternion(camera.quaternion);
      const flatForward = new THREE.Vector3(rawForward.x, 0, rawForward.z).normalize();
      
      // Position START panel using Scene Layout System (Introduction Dock Zone)
      let panelPosition: THREE.Vector3;
      if (sceneLayoutRef.current) {
        panelPosition = sceneLayoutRef.current.getIntroDockPosition(camera, GROUND_LEVEL);
        // Ensure panel is at eye level
        panelPosition.y = cameraPos.y;
      } else {
        // Fallback: 2.5m in front
        panelPosition = new THREE.Vector3();
        panelPosition.copy(cameraPos);
        panelPosition.add(flatForward.clone().multiplyScalar(2.5));
        panelPosition.y = cameraPos.y;
      }
      
      // CRITICAL FIX: Ensure panel is centered horizontally
      const rightDir = new THREE.Vector3();
      rightDir.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();
      const horizontalOffset = panelPosition.clone().sub(cameraPos).dot(rightDir);
      panelPosition.sub(rightDir.clone().multiplyScalar(horizontalOffset));
      
      // Mark panel as UI layer for raycast filtering
      panel.userData.layer = 'ui';
      
      console.log(`🎯 [START PANEL] ════════════════════════════════════════`);
      console.log(`🎯 [START PANEL] Camera Position: (${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)})`);
      console.log(`🎯 [START PANEL] Forward Direction: (${flatForward.x.toFixed(2)}, ${flatForward.y.toFixed(2)}, ${flatForward.z.toFixed(2)})`);
      console.log(`🎯 [START PANEL] Right Direction: (${rightDir.x.toFixed(2)}, ${rightDir.y.toFixed(2)}, ${rightDir.z.toFixed(2)})`);
      console.log(`🎯 [START PANEL] Horizontal Offset (before fix): ${horizontalOffset.toFixed(3)}`);
      console.log(`🎯 [START PANEL] Panel Position: (${panelPosition.x.toFixed(2)}, ${panelPosition.y.toFixed(2)}, ${panelPosition.z.toFixed(2)})`);
      console.log(`🎯 [START PANEL] ════════════════════════════════════════`);
      
      addDebug(`[START PANEL] Position: (${panelPosition.x.toFixed(2)}, ${panelPosition.y.toFixed(2)}, ${panelPosition.z.toFixed(2)})`);
      addDebug(`[START PANEL] Horizontal offset corrected: ${horizontalOffset.toFixed(3)}`);
      
      panel.position.copy(panelPosition);
      panel.userData.isInteractable = true;
      panel.userData.panelType = 'start';
      panel.userData.hasButtons = true;
      panel.userData.canvasWidth = canvas.width;
      panel.userData.canvasHeight = canvas.height;
      panel.userData.layer = 'ui'; // Mark as UI layer for raycast filtering
      
      // Store all buttons (strategy buttons + START button)
      panel.userData.buttons = panelButtons;
      
      // Make it face camera
      panel.lookAt(cameraPos);
      
      scene.add(panel);
      startPanelRef.current = panel;
      
      console.log(`${DEBUG_CATEGORIES.UI} Start panel created`);
      addDebug('Start panel ready - click START to begin');
      return panel;
    } catch (error: any) {
      console.error('[XRLessonPlayerV3] Error creating start panel:', error);
      addDebug(`ERROR creating start panel: ${error?.message || error}`);
      return null;
    }
  }, [sceneRef, cameraRef, lessonData, mcqData.length, meshyAssets.length, ttsData.length, handleLessonStart, addDebug, placementStrategy, changePlacementStrategy]);
  
  // Auto-play TTS when phase changes (intro/content/outro) - ONLY if lesson has started
  useEffect(() => {
    // Don't auto-play if lesson hasn't started yet
    if (!lessonStarted) return;
    
    if (['intro', 'content', 'outro'].includes(lessonPhase) && ttsData.length > 0) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        playTTSForPhase(lessonPhase);
      }, 500);
      return () => clearTimeout(timer);
    } else if (lessonPhase === 'mcq') {
      // Auto-pause audio when entering quiz
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setTtsState('paused');
      }
      
      // Comprehensive quiz phase transition logging
      console.log('[QUIZ PHASE] ========================================');
      console.log('[QUIZ PHASE] Entered MCQ phase');
      console.log('[QUIZ PHASE] Total questions:', mcqData.length);
      console.log('[QUIZ PHASE] Current question index:', currentMcqIndex);
      console.log('[QUIZ PHASE] Current score:', mcqScore);
      mcqData.forEach((mcq, idx) => {
        console.log(`[QUIZ PHASE] Q${idx + 1}: correctAnswer=${mcq.correctAnswer}, correctText="${mcq.options?.[mcq.correctAnswer]}"`);
      });
      console.log('[QUIZ PHASE] ========================================');
      
      debugQuiz(`Entered quiz phase with ${mcqData.length} questions`);
    }
  }, [lessonPhase, ttsData, playTTSForPhase, lessonStarted, mcqData, currentMcqIndex, mcqScore, debugQuiz]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Auto-start intro when entering VR - ONLY if lesson has been started by user
  useEffect(() => {
    if (loadingState === 'in-vr' && lessonPhase === 'intro' && ttsData.length > 0 && lessonStarted) {
      // Wait a moment for user to orient themselves
      const timer = setTimeout(() => {
        playTTSForPhase('intro');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loadingState, lessonPhase, ttsData, playTTSForPhase, lessonStarted]);
  
  
  // ============================================================================
  // Create VR Script Panel UI (3D Billboard)
  // ============================================================================
  
  // Store last panel update time to prevent spam
  const lastPanelCreateTimeRef = useRef<number>(0);
  
  const createScriptPanel = useCallback((text: string, phase: LessonPhase) => {
    // Throttle panel creation to max once per 500ms
    const now = Date.now();
    if (now - lastPanelCreateTimeRef.current < 500) {
      return scriptPanelRef.current; // Return existing panel if throttled
    }
    lastPanelCreateTimeRef.current = now;
    try {
      if (!sceneRef.current || !cameraRef.current) {
        console.warn('[XRLessonPlayerV3] Cannot create script panel: scene or camera not ready');
        return null;
      }
      
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      
      // Remove existing script panel
      const existing = scene.getObjectByName('scriptPanel');
      if (existing) {
        scene.remove(existing);
      }
      
      // Create canvas for text rendering
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Glassmorphism background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
      gradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.88)');
      gradient.addColorStop(1, 'rgba(51, 65, 85, 0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Cyan glow effect
      ctx.shadowColor = 'rgba(6, 182, 212, 0.4)';
      ctx.shadowBlur = 30;
      
      // Border with glow
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      
      // Inner border for depth
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
      
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Top section: Title + Phase Badge
      const phaseTitles: Record<string, string> = {
        intro: 'Introduction',
        content: 'Explanation',
        explanation: 'Explanation',
        outro: 'Conclusion',
      };
      const phaseColors: Record<string, string> = {
        intro: '#06b6d4',
        content: '#8b5cf6',
        explanation: '#8b5cf6',
        outro: '#10b981',
      };
      
      // Phase badge
      ctx.fillStyle = phaseColors[phase] || '#06b6d4';
      ctx.fillRect(30, 30, 200, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(phaseTitles[phase] || 'Lesson', 50, 65);
      
      // Lesson title
      const lessonTitle = lessonData?.topic?.topic_name || 'Lesson';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(lessonTitle.substring(0, 40), 250, 65);
      
      // Middle section: Script text
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '36px Arial';
      ctx.textAlign = 'left';
      const maxWidth = canvas.width - 100;
      const lineHeight = 45;
      const words = text.split(' ');
      let line = '';
      let textY = 140;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line, 50, textY);
          line = words[i] + ' ';
          textY += lineHeight;
          if (textY > canvas.height - 200) break;
        } else {
          line = testLine;
        }
      }
      if (line && textY < canvas.height - 200) {
        ctx.fillText(line, 50, textY);
      }
      
      // Bottom section: TTS Controls
      const controlsY = canvas.height - 150;
      const buttonSize = 60;
      const buttonSpacing = 80;
      const startX = (canvas.width - (buttonSpacing * 4)) / 2;
      
      // Progress bar background
      ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
      ctx.fillRect(50, controlsY - 40, canvas.width - 100, 8);
      
      // Progress bar fill
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(50, controlsY - 40, (canvas.width - 100) * audioProgress, 8);
      
      // Time display
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      ctx.fillStyle = '#94a3b8';
      ctx.font = '28px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(audioCurrentTime), 50, controlsY - 50);
      ctx.textAlign = 'right';
      ctx.fillText(formatTime(audioDuration), canvas.width - 50, controlsY - 50);
      
      // Control buttons (visual representation)
      const buttons = [
        { icon: '⏮', x: startX, action: skipPrev },
        { icon: ttsState === 'playing' ? '⏸' : '▶', x: startX + buttonSpacing, action: toggleAudio },
        { icon: '⏹', x: startX + buttonSpacing * 2, action: stopAudio },
        { icon: '⏭', x: startX + buttonSpacing * 3, action: skipNext },
      ];
      
      buttons.forEach((btn) => {
        // Button background
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.fillRect(btn.x - buttonSize/2, controlsY, buttonSize, buttonSize);
        
        // Button border
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.strokeRect(btn.x - buttonSize/2, controlsY, buttonSize, buttonSize);
        
        // Button icon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(btn.icon, btn.x, controlsY + 40);
      });
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // Create plane mesh
      const geometry = new THREE.PlaneGeometry(2.8, 1.6);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x06b6d4),
        emissiveIntensity: 0.15,
        roughness: 0.2,
        metalness: 0.2,
      });
      
      const panel = new THREE.Mesh(geometry, material);
      panel.name = 'scriptPanel';
      
      // Position using layout engine (left of forward view)
      let panelX: number, panelY: number, panelZ: number;
      
      if (layoutEngineRef.current && layoutEngineRef.current.isReady()) {
        const panelPos = layoutEngineRef.current.positionUIPanel();
        panelX = panelPos.x;
        panelY = panelPos.y;
        panelZ = panelPos.z;
        console.log(`${DEBUG_CATEGORIES.LAYOUT} Script panel positioned by layout engine`);
      } else {
        // Fallback: Position at 30° to the left (negative angle)
        const angle = -Math.PI / 9; // -20 degrees (left side)
        const distance = 2.0;
        panelX = Math.sin(angle) * distance;
        panelZ = -Math.cos(angle) * distance;
        panelY = 1.6; // Eye level
        console.log(`${DEBUG_CATEGORIES.LAYOUT} Script panel using fallback position`);
      }
      
      panel.position.set(panelX, panelY, panelZ);
      panel.userData.isInteractable = true;
      panel.userData.panelType = 'script';
      panel.userData.hasButtons = true;
      panel.userData.layer = 'ui'; // Mark as UI layer for raycast filtering
      panel.userData.buttons = buttons.map(btn => ({
        bounds: { x: btn.x - buttonSize/2, y: controlsY, width: buttonSize, height: buttonSize },
        action: () => {
          // CRITICAL: Trigger haptic feedback for script panel button clicks
          if (controller1Ref.current) {
            triggerHapticFeedback(controller1Ref.current);
          } else if (controller2Ref.current) {
            triggerHapticFeedback(controller2Ref.current);
          }
          btn.action();
        },
      }));
      
      // Make it face camera (billboard)
      panel.lookAt(camera.position);
      
      scene.add(panel);
      scriptPanelRef.current = panel;
      
      // Only log creation, not every update
      console.log(`[XRLessonPlayerV3] Script panel created for ${phase}`);
      // Don't spam debug panel with every creation
      return panel;
    } catch (error: any) {
      console.error('[XRLessonPlayerV3] Error creating script panel:', error);
      addDebug(`ERROR creating script panel: ${error?.message || error}`);
      return null;
    }
  }, [sceneRef, cameraRef, addDebug, lessonData, audioProgress, audioCurrentTime, audioDuration, ttsState, toggleAudio, stopAudio, skipNext, skipPrev]);
  
  // Update script panel when phase/text changes
  useEffect(() => {
    if (!['intro', 'content', 'outro'].includes(lessonPhase)) {
      // Remove script panel for non-script phases
      if (scriptPanelRef.current && sceneRef.current) {
        sceneRef.current.remove(scriptPanelRef.current);
        scriptPanelRef.current = null;
      }
      return;
    }
    
    // Get script text for current phase
    const scriptText = (() => {
      if (lessonPhase === 'intro') {
        return (lessonData as any)?.topic?.avatar_intro || 'Welcome to this lesson. Let\'s begin!';
      } else if (lessonPhase === 'content') {
        return (lessonData as any)?.topic?.avatar_explanation || 'This is the explanation phase.';
      } else if (lessonPhase === 'outro') {
        return (lessonData as any)?.topic?.avatar_outro || 'Thank you for completing this lesson!';
      }
      return '';
    })();
    
    if (scriptText && sceneRef.current && cameraRef.current) {
      try {
        createScriptPanel(scriptText, lessonPhase);
      } catch (error: any) {
        console.error('[XRLessonPlayerV3] Error updating script panel:', error);
        addDebug(`ERROR updating script panel: ${error?.message || error}`);
      }
    }
  }, [lessonPhase, lessonData, createScriptPanel, sceneRef, cameraRef, addDebug]);
  
  // Update script panel ONLY on phase/state changes (NOT on progress updates)
  // This prevents spam - progress updates happen every 100ms which causes 16+ recreations
  useEffect(() => {
    if (!['intro', 'content', 'outro'].includes(lessonPhase)) {
      return;
    }
    
    const scriptText = (() => {
      if (lessonPhase === 'intro') {
        return (lessonData as any)?.topic?.avatar_intro || 'Welcome to this lesson. Let\'s begin!';
      } else if (lessonPhase === 'content') {
        return (lessonData as any)?.topic?.avatar_explanation || 'This is the explanation phase.';
      } else if (lessonPhase === 'outro') {
        return (lessonData as any)?.topic?.avatar_outro || 'Thank you for completing this lesson!';
      }
      return '';
    })();
    
    if (scriptText && sceneRef.current && cameraRef.current) {
      try {
        createScriptPanel(scriptText, lessonPhase);
      } catch (error: any) {
        console.error('[XRLessonPlayerV3] Error creating script panel:', error);
      }
    }
  }, [lessonPhase, lessonData, createScriptPanel, sceneRef, cameraRef]);
  
  // Separate effect for TTS state changes (paused/ended) - update panel to show correct button state
  useEffect(() => {
    if (!['intro', 'content', 'outro'].includes(lessonPhase) || !scriptPanelRef.current) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastUpdate = now - lastScriptPanelUpdateRef.current;
    
    // Only update on state changes (paused/ended) and throttle to max once per 3 seconds
    if ((ttsState === 'paused' || ttsState === 'ended') && timeSinceLastUpdate > 3000) {
      lastScriptPanelUpdateRef.current = now;
      
      const scriptText = (() => {
        if (lessonPhase === 'intro') {
          return (lessonData as any)?.topic?.avatar_intro || 'Welcome to this lesson. Let\'s begin!';
        } else if (lessonPhase === 'content') {
          return (lessonData as any)?.topic?.avatar_explanation || 'This is the explanation phase.';
        } else if (lessonPhase === 'outro') {
          return (lessonData as any)?.topic?.avatar_outro || 'Thank you for completing this lesson!';
        }
        return '';
      })();
      
      if (scriptText && sceneRef.current && cameraRef.current) {
        try {
          createScriptPanel(scriptText, lessonPhase);
        } catch (error: any) {
          console.error('[XRLessonPlayerV3] Error updating script panel:', error);
        }
      }
    }
  }, [ttsState, lessonPhase, lessonData, createScriptPanel, sceneRef, cameraRef]);
  
  // ============================================================================
  // MCQ Interaction Handlers
  // ============================================================================
  
  const handleMCQOptionSelect = useCallback((optionIndex: number) => {
    if (mcqAnswered || lessonPhase !== 'mcq' || currentMcqIndex >= mcqData.length) {
      console.log('[MCQ INTERACTION] Selection blocked:', { mcqAnswered, lessonPhase, currentMcqIndex, mcqDataLength: mcqData.length });
      return;
    }
    
    const currentMcq = mcqData[currentMcqIndex];
    // correctAnswer is now already 0-based (converted in fetchMCQData)
    const correctIndex = currentMcq.correctAnswer;
    const isCorrect = optionIndex === correctIndex;
    
    // Comprehensive MCQ interaction debug logging
    console.log('[MCQ INTERACTION] ========================================');
    console.log('[MCQ INTERACTION] Question:', currentMcqIndex + 1, '/', mcqData.length);
    console.log('[MCQ INTERACTION] MCQ ID:', currentMcq.id);
    console.log('[MCQ INTERACTION] Question text:', currentMcq.question?.substring(0, 60) + '...');
    console.log('[MCQ INTERACTION] Options:', currentMcq.options);
    console.log('[MCQ INTERACTION] correct_option_index (0-based):', correctIndex);
    console.log('[MCQ INTERACTION] Correct option text:', currentMcq.options?.[correctIndex] || 'N/A');
    console.log('[MCQ INTERACTION] User selected index:', optionIndex);
    console.log('[MCQ INTERACTION] User selected text:', currentMcq.options?.[optionIndex] || 'N/A');
    console.log('[MCQ INTERACTION] Is Correct:', isCorrect);
    console.log('[MCQ INTERACTION] Current Score before:', mcqScore, '/', mcqData.length);
    console.log('[MCQ INTERACTION] ========================================');
    
    setSelectedMcqOption(optionIndex);
    setMcqAnswered(true);
    mcqAnswerHistoryRef.current = [
      ...mcqAnswerHistoryRef.current,
      { questionIndex: currentMcqIndex, correct: isCorrect, selectedOptionIndex: optionIndex },
    ];

    if (isCorrect) {
      setMcqScore(prev => prev + 1);
      debugQuiz(`✅ CORRECT! Selected: ${optionIndex} (${currentMcq.options?.[optionIndex]}), Correct: ${correctIndex} (${currentMcq.options?.[correctIndex]})`);
    } else {
      debugQuiz(`❌ WRONG! Selected: ${optionIndex} (${currentMcq.options?.[optionIndex]}), Correct: ${correctIndex} (${currentMcq.options?.[correctIndex]})`);
    }
  }, [mcqAnswered, lessonPhase, mcqData, currentMcqIndex, mcqScore, debugQuiz]);
  
  const handleMCQNext = useCallback(() => {
    if (!mcqAnswered) return;

    if (currentMcqIndex < mcqData.length - 1) {
      setCurrentMcqIndex(prev => prev + 1);
      setSelectedMcqOption(null);
      setMcqAnswered(false);
      addDebug(`Moving to question ${currentMcqIndex + 2}`);
    } else {
      // Quiz complete: build quiz payload for teacher analytics (ref already has all answers from handleMCQOptionSelect)
      const history = mcqAnswerHistoryRef.current;
      const score = history.filter((a) => a.correct).length;
      const total = mcqData.length;
      if (total > 0) {
        pendingQuizReportRef.current = {
          score,
          total,
          answers: history.map((a) => ({
            question_index: a.questionIndex,
            correct: a.correct,
            selected_option_index: a.selectedOptionIndex,
          })),
        };
      }
      setLessonPhase('complete');
      debugQuiz(`Quiz complete! Score: ${score}/${total}`);
    }
  }, [mcqAnswered, currentMcqIndex, mcqData, addDebug, debugQuiz]);
  
  // ============================================================================
  // Create VR MCQ Quiz Panel UI
  // ============================================================================
  
  const createMCQPanel = useCallback((mcq: MCQData, questionIndex: number, totalQuestions: number) => {
    try {
      if (!sceneRef.current || !cameraRef.current) {
        console.warn('[XRLessonPlayerV3] Cannot create MCQ panel: scene or camera not ready');
        return null;
      }
      
      if (!mcq || !mcq.options || mcq.options.length === 0) {
        console.warn('[XRLessonPlayerV3] Invalid MCQ data:', mcq);
        return null;
      }
      
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      
      // Remove existing MCQ panel
      const existing = scene.getObjectByName('mcqPanel');
      if (existing) {
        scene.remove(existing);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Glassmorphism background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
      gradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.88)');
      gradient.addColorStop(1, 'rgba(51, 65, 85, 0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Purple glow effect
      ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
      ctx.shadowBlur = 30;
      
      // Border with glow
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
      
      // Inner border for depth
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
      
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Title
      ctx.fillStyle = '#8b5cf6';
      ctx.font = 'bold 56px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Quiz', canvas.width / 2, 70);
      
      // Progress indicator
      ctx.fillStyle = '#a78bfa';
      ctx.font = '36px Arial';
      ctx.fillText(`Question ${questionIndex + 1} of ${totalQuestions}`, canvas.width / 2, 120);
      
      // Score display
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 32px Arial';
      ctx.fillText(`Score: ${mcqScore}/${totalQuestions}`, canvas.width / 2, 160);
      
      // Question text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'left';
      const questionY = 220;
      const maxQuestionWidth = canvas.width - 100;
      const questionWords = mcq.question.split(' ');
      let questionLine = '';
      let questionLineY = questionY;
      
      for (let i = 0; i < questionWords.length; i++) {
        const testLine = questionLine + questionWords[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxQuestionWidth && i > 0) {
          ctx.fillText(questionLine, 50, questionLineY);
          questionLine = questionWords[i] + ' ';
          questionLineY += 50;
        } else {
          questionLine = testLine;
        }
      }
      if (questionLine) {
        ctx.fillText(questionLine, 50, questionLineY);
      }
      
      // Options
      const optionStartY = questionLineY + 80;
      const optionSpacing = 90;
      const optionHeight = 70;
      const optionWidth = canvas.width - 200;
      const optionX = 100;
      
      // Store button bounds for raycast interaction
      const buttonBounds: Array<{ bounds: { x: number; y: number; width: number; height: number }; action: () => void }> = [];
      
      // correctAnswer is now already 0-based (converted in fetchMCQData)
      const correctIndex = mcq.correctAnswer;
      
      mcq.options.forEach((option, index) => {
        const optionY = optionStartY + (index * optionSpacing);
        
        // Option background
        let bgColor = 'rgba(30, 41, 59, 0.8)';
        let borderColor = '#475569';
        
        if (selectedMcqOption === index) {
          if (mcqAnswered) {
            if (index === correctIndex) {
              bgColor = 'rgba(34, 197, 94, 0.4)';
              borderColor = '#22c55e';
            } else {
              bgColor = 'rgba(239, 68, 68, 0.4)';
              borderColor = '#ef4444';
            }
          } else {
            bgColor = 'rgba(59, 130, 246, 0.4)';
            borderColor = '#3b82f6';
          }
        }
        
        ctx.fillStyle = bgColor;
        ctx.fillRect(optionX, optionY, optionWidth, optionHeight);
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(optionX, optionY, optionWidth, optionHeight);
        
        // Option label and text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        const label = String.fromCharCode(65 + index); // A, B, C, D
        ctx.fillText(`${label}.`, optionX + 20, optionY + 45);
        
        ctx.font = '32px Arial';
        ctx.fillText(option, optionX + 80, optionY + 45);
        
        // Checkmark or X if answered
        if (mcqAnswered && index === correctIndex) {
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 40px Arial';
          ctx.fillText('✓', optionX + optionWidth - 50, optionY + 45);
        } else if (mcqAnswered && selectedMcqOption === index && index !== correctIndex) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 40px Arial';
          ctx.fillText('✗', optionX + optionWidth - 50, optionY + 45);
        }
        
        // Store button bounds for raycast (only if not answered)
        if (!mcqAnswered) {
          buttonBounds.push({
            bounds: { x: optionX, y: optionY, width: optionWidth, height: optionHeight },
            action: () => {
              // CRITICAL: Trigger haptic feedback for quiz button click
              if (controller1Ref.current) {
                triggerHapticFeedback(controller1Ref.current);
              } else if (controller2Ref.current) {
                triggerHapticFeedback(controller2Ref.current);
              }
              handleMCQOptionSelect(index);
            },
          });
        }
      });
      
      // Explanation (if answered)
      if (mcqAnswered && mcq.explanation) {
        const explanationY = optionStartY + (mcq.options.length * optionSpacing) + 40;
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 36px Arial';
        ctx.fillText('Explanation:', 50, explanationY);
        
        ctx.fillStyle = '#fcd34d';
        ctx.font = '28px Arial';
        const explanationWords = mcq.explanation.split(' ');
        let explanationLine = '';
        let explanationLineY = explanationY + 50;
        
        for (let i = 0; i < explanationWords.length; i++) {
          const testLine = explanationLine + explanationWords[i] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxQuestionWidth && i > 0) {
            ctx.fillText(explanationLine, 50, explanationLineY);
            explanationLine = explanationWords[i] + ' ';
            explanationLineY += 40;
          } else {
            explanationLine = testLine;
          }
        }
        if (explanationLine) {
          ctx.fillText(explanationLine, 50, explanationLineY);
        }
      }
      
      // Next button (if answered)
      if (mcqAnswered) {
        const nextButtonX = canvas.width / 2;
        const nextButtonY = canvas.height - 60;
        const nextButtonWidth = 250;
        const nextButtonHeight = 60;
        
        ctx.fillStyle = 'rgba(139, 92, 246, 0.6)';
        ctx.fillRect(nextButtonX - nextButtonWidth/2, nextButtonY - nextButtonHeight/2, nextButtonWidth, nextButtonHeight);
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 4;
        ctx.strokeRect(nextButtonX - nextButtonWidth/2, nextButtonY - nextButtonHeight/2, nextButtonWidth, nextButtonHeight);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        const nextText = currentMcqIndex < mcqData.length - 1 ? 'Next Question' : 'View Results';
        ctx.fillText(nextText, nextButtonX, nextButtonY + 10);
        
        buttonBounds.push({
          bounds: { x: nextButtonX - nextButtonWidth/2, y: nextButtonY - nextButtonHeight/2, width: nextButtonWidth, height: nextButtonHeight },
          action: () => {
            // CRITICAL: Trigger haptic feedback for Next button click
            if (controller1Ref.current) {
              triggerHapticFeedback(controller1Ref.current);
            } else if (controller2Ref.current) {
              triggerHapticFeedback(controller2Ref.current);
            }
            handleMCQNext();
          },
        });
      }
      
      // Create texture
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // Create plane
      const geometry = new THREE.PlaneGeometry(2.8, 2.0);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x8b5cf6),
        emissiveIntensity: 0.15,
        roughness: 0.2,
        metalness: 0.2,
      });
      
      const panel = new THREE.Mesh(geometry, material);
      panel.name = 'mcqPanel';
      
      // Position using layout engine (left of forward view, same as script panel)
      let panelX: number, panelY: number, panelZ: number;
      
      if (layoutEngineRef.current && layoutEngineRef.current.isReady()) {
        const panelPos = layoutEngineRef.current.positionUIPanel();
        panelX = panelPos.x;
        panelY = panelPos.y;
        panelZ = panelPos.z;
        console.log(`${DEBUG_CATEGORIES.LAYOUT} MCQ panel positioned by layout engine`);
      } else {
        // Fallback: Position at 20° to the left
        const angle = -Math.PI / 9;
        const distance = 2.0;
        panelX = Math.sin(angle) * distance;
        panelZ = -Math.cos(angle) * distance;
        panelY = 1.6;
        console.log(`${DEBUG_CATEGORIES.LAYOUT} MCQ panel using fallback position`);
      }
      
      panel.position.set(panelX, panelY, panelZ);
      panel.lookAt(camera.position);
      panel.userData.isInteractable = true;
      panel.userData.panelType = 'mcq';
      panel.userData.hasButtons = true;
      panel.userData.buttons = buttonBounds;
      panel.userData.layer = 'ui'; // Mark as UI layer for raycast filtering
      
      scene.add(panel);
      mcqPanelRef.current = panel;
      
      debugQuiz(`MCQ panel created: Question ${questionIndex + 1} (${buttonBounds.length} clickable buttons)`);
      return panel;
    } catch (error: any) {
      console.error('[XRLessonPlayerV3] Error creating MCQ panel:', error);
      addDebug(`ERROR creating MCQ panel: ${error?.message || error}`);
      return null;
    }
  }, [sceneRef, cameraRef, selectedMcqOption, mcqAnswered, mcqScore, currentMcqIndex, mcqData, handleMCQOptionSelect, handleMCQNext, addDebug]);
  
  // Update MCQ panel when question/selection changes
  useEffect(() => {
    if (lessonPhase !== 'mcq' || mcqData.length === 0) {
      // Remove MCQ panel for non-quiz phases
      if (mcqPanelRef.current && sceneRef.current) {
        sceneRef.current.remove(mcqPanelRef.current);
        mcqPanelRef.current = null;
        lastMcqPanelStateRef.current = '';
      }
      return;
    }
    
    // Create a state key to detect actual changes and avoid redundant recreation
    const currentStateKey = `${currentMcqIndex}-${selectedMcqOption}-${mcqAnswered}`;
    
    // Skip if state hasn't changed (prevents double recreation)
    if (lastMcqPanelStateRef.current === currentStateKey && mcqPanelRef.current) {
      console.log('[MCQ PANEL] Skipping redundant recreation - state unchanged');
      return;
    }
    
    if (currentMcqIndex < mcqData.length && sceneRef.current && cameraRef.current && mcqData[currentMcqIndex]) {
      try {
        console.log(`[MCQ PANEL] Creating panel for state: ${currentStateKey}`);
        createMCQPanel(mcqData[currentMcqIndex], currentMcqIndex, mcqData.length);
        lastMcqPanelStateRef.current = currentStateKey;
      } catch (error: any) {
        console.error('[XRLessonPlayerV3] Error updating MCQ panel:', error);
        addDebug(`ERROR updating MCQ panel: ${error?.message || error}`);
      }
    }
  }, [lessonPhase, currentMcqIndex, mcqData, selectedMcqOption, mcqAnswered, createMCQPanel, sceneRef, cameraRef, addDebug]);
  
  // ============================================================================
  // 3D Model Reset & Focus Functions
  // ============================================================================
  
  const toggleAssetsVisibility = useCallback(() => {
    const assetsGroup = sceneRef.current?.getObjectByName('assetsGroup');
    if (assetsGroup) {
      const newVisibility = !assetsVisible;
      assetsGroup.traverse((obj) => {
        obj.visible = newVisibility;
      });
      setAssetsVisible(newVisibility);
      addDebug(`Assets ${newVisibility ? 'shown' : 'hidden'}`);
    }
  }, [assetsVisible, addDebug]);
  
  const resetModel = useCallback(() => {
    if (primaryAssetRef.current && primaryAssetRef.current.userData.originalPosition) {
      const asset = primaryAssetRef.current;
      asset.position.copy(asset.userData.originalPosition);
      asset.rotation.copy(asset.userData.originalRotation);
      asset.scale.copy(asset.userData.originalScale);
      addDebug('Model reset to original position');
    }
  }, [addDebug]);
  
  const focusModel = useCallback(() => {
    if (primaryAssetRef.current && cameraRef.current) {
      const asset = primaryAssetRef.current;
      const camera = cameraRef.current;
      
      // Bring model in front of user
      const cameraPos = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);
      
      const newPos = new THREE.Vector3().copy(cameraPos).add(forward.multiplyScalar(2.0));
      newPos.y = 1.2; // Eye level
      
      asset.position.copy(newPos);
      addDebug('Model focused in front of user');
    }
  }, [cameraRef, addDebug]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  // Error state
  if (loadingState === 'error') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card rounded-2xl border border-destructive/30 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Unable to Load VR Lesson</h2>
          <p className="text-slate-400 text-sm mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate('/lessons')}
            className="flex items-center justify-center gap-2 px-6 py-3 mx-auto
                     text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }
  
  // No VR support
  if (isVRSupported === false) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card rounded-2xl border border-border p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <Glasses className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">VR Device Required</h2>
          <p className="text-slate-400 text-sm mb-2">
            This immersive lesson requires a VR headset.
          </p>
          <p className="text-slate-500 text-xs mb-4">
            Please open this page on Meta Quest Browser for the full VR experience.
          </p>
          <button
            onClick={() => navigate('/lessons')}
            className="flex items-center justify-center gap-2 px-6 py-3 mx-auto
                     text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Loading Overlay */}
      {loadingState === 'loading' && (
        <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">{loadingMessage}</p>
            {lessonData && (
              <p className="text-slate-400 text-sm mt-2">
                {lessonData.topic.topic_name}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Ready Overlay (before entering VR) */}
      {loadingState === 'ready' && (
        <div className="absolute top-4 left-4 z-40">
          <button
            onClick={() => navigate('/lessons')}
            className="flex items-center gap-2 px-4 py-2 bg-card/80 hover:bg-card 
                     text-foreground rounded-lg backdrop-blur-sm border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </button>
        </div>
      )}
      
      {/* In VR Indicator (shown on 2D screen while in VR) */}
      {loadingState === 'in-vr' && (
        <div className="absolute inset-0 bg-background flex items-center justify-center z-50">
          <div className="text-center">
            <Glasses className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">In VR Mode</h2>
            <p className="text-slate-400">
              Look around in your headset to explore the lesson
            </p>
          </div>
        </div>
      )}
      
      {/* Lesson Info (top right) */}
      {loadingState === 'ready' && lessonData && (
        <div className="absolute top-4 right-4 z-40 max-w-xs">
          <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-border">
            <p className="text-primary text-xs font-medium mb-1">
              {lessonData.chapter.curriculum} • Class {lessonData.chapter.class_name}
            </p>
            <h3 className="text-white font-semibold text-sm">
              {lessonData.topic.topic_name}
            </h3>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      {loadingState === 'ready' && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-card/80 backdrop-blur-sm rounded-lg px-6 py-3 border border-primary/30">
            <p className="text-cyan-300 text-sm text-center">
              Click "Enter VR" below to start the immersive experience
            </p>
            <p className="text-slate-400 text-xs text-center mt-1">
              In VR, point at the START button to begin the lesson
            </p>
          </div>
        </div>
      )}
      
      {/* Waiting for START indicator in VR */}
      {loadingState === 'in-vr' && lessonPhase === 'waiting' && !lessonStarted && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-cyan-600/90 backdrop-blur-sm rounded-lg px-6 py-3 border border-cyan-400/50 shadow-lg">
            <div className="flex items-center gap-3">
              <Play className="w-5 h-5 text-foreground animate-pulse" />
              <p className="text-foreground font-medium">
                Point at the START button in VR to begin
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Skip to Quiz Button - Show during TTS phases ONLY when lesson has started */}
      {(loadingState === 'ready' || loadingState === 'in-vr') && lessonStarted &&
       ['intro', 'content', 'outro'].includes(lessonPhase) && mcqData.length > 0 && (
        <div className="absolute top-20 right-4 z-40">
          <button
            onClick={skipToQuiz}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 
                     hover:from-amber-500 hover:to-orange-500 text-primary-foreground rounded-lg font-medium 
                     shadow-lg shadow-amber-500/20 border border-amber-500/50 transition-all"
          >
            <SkipForward className="w-4 h-4" />
            Skip to Quiz
          </button>
        </div>
      )}
      
      {/* Lesson Completion Screen */}
      {lessonPhase === 'complete' && (
        <div className="absolute inset-0 bg-background/95 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4 bg-card rounded-2xl 
                        border border-emerald-500/30 p-8 text-center shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 
                          flex items-center justify-center border border-emerald-500/30">
              <Award className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Lesson Complete!</h2>
            <p className="text-slate-400 text-sm mb-6">
              {lessonData?.topic.topic_name}
            </p>
            
            {/* Quiz Score Display */}
            {mcqData.length > 0 && (
              <div className="mb-6 p-4 bg-card/50 rounded-xl inline-block">
                <p className="text-xs text-slate-400 mb-1">Quiz Score</p>
                <p className="text-4xl font-bold text-emerald-400">
                  {mcqScore}/{mcqData.length}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {Math.round((mcqScore / mcqData.length) * 100)}% correct
                </p>
              </div>
            )}
            
            <button
              onClick={() => navigate('/lessons')}
              className="flex items-center justify-center gap-2 px-6 py-3 mx-auto
                       text-primary-foreground bg-primary 
                       hover:from-cyan-500 hover:to-blue-500 rounded-lg font-medium 
                       shadow-lg transition-all"
            >
              <Home className="w-4 h-4" />
              Back to Lessons
            </button>
          </div>
        </div>
      )}
      
      {/* Audio Controls (shown when ready or in VR) - Now in VR panel */}
      {/* Audio controls are now in the 3D VR script panel */}
      
      {/* Model Control Buttons (3D Asset) */}
      {primaryAssetRef.current && (loadingState === 'ready' || loadingState === 'in-vr') && (
        <div className="absolute bottom-4 right-4 z-40">
          <div className="bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border">
            <p className="text-slate-400 text-xs mb-2 font-medium">3D Model:</p>
            <div className="flex gap-2">
              <button
                onClick={resetModel}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs rounded transition-colors"
                title="Reset model to original position"
              >
                Reset
              </button>
              <button
                onClick={focusModel}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors"
                title="Focus model in front of you"
              >
                Focus
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Asset Dock - Similar to panel dock */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setAssetDockExpanded(!assetDockExpanded)}
          className="bg-slate-800/90 hover:bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 flex items-center gap-2"
        >
          <span>3D Assets</span>
          <span className={`text-xs transition-transform ${assetDockExpanded ? 'rotate-180' : ''}`}>▼</span>
        </button>
        
        {assetDockExpanded && (
          <div className="mt-2 bg-slate-900/95 border border-slate-600 rounded-lg p-3 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Asset Controls</span>
              <button
                onClick={toggleAssetsVisibility}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
              >
                {assetsVisible ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="text-xs text-slate-400">
              Loaded: {assetsLoaded}/{meshyAssets.length}
            </div>
            {meshyAssets.map((asset, idx) => (
              <div key={asset.id} className="text-xs text-slate-300 mt-1">
                {idx + 1}. {asset.name || asset.id}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* COMPREHENSIVE DEBUG PANEL */}
      <div className="absolute bottom-4 left-4 z-50 max-w-xl">
        <div className="bg-black/95 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/50 text-xs font-mono">
          {/* Header with toggle and controls */}
          <div className="flex items-center justify-between mb-2">
            <button 
              onClick={() => setDebugExpanded(!debugExpanded)}
              className="text-yellow-400 font-bold hover:text-yellow-300 flex items-center gap-1"
            >
              🐛 Debug Panel {debugExpanded ? '▼' : '▶'}
            </button>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                loadingState === 'in-vr' ? 'bg-purple-600 text-white' :
                loadingState === 'ready' ? 'bg-green-600 text-white' :
                loadingState === 'error' ? 'bg-red-600 text-white' :
                'bg-slate-600 text-white'
              }`}>
                {loadingState}
              </span>
              <button
                onClick={() => logStateSummary()}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                title="Log state summary to console"
              >
                📊 Log State
              </button>
              <button
                onClick={() => {
                  const fullLog = [
                    `=== XRLessonPlayerV3 COMPREHENSIVE Debug Log ===`,
                    `Time: ${new Date().toISOString()}`,
                    ``,
                    `=== CURRENT STATE ===`,
                    `Loading State: ${loadingState}`,
                    `Lesson Phase: ${lessonPhase}`,
                    `Lesson Started: ${lessonStarted}`,
                    `VR Supported: ${isVRSupported}`,
                    `Layout Engine Ready: ${layoutEngineRef.current?.isReady() || false}`,
                    ``,
                    `=== TTS DATA ===`,
                    `Total TTS entries: ${ttsData.length}`,
                    `TTS State: ${ttsState}`,
                    `Audio Playing: ${isAudioPlaying}`,
                    `Audio Progress: ${(audioProgress * 100).toFixed(1)}%`,
                    ...ttsData.map((t, i) => `TTS #${i + 1}: id=${t.id}, section=${t.section}`),
                    ``,
                    `=== MCQ DATA ===`,
                    `Total MCQs: ${mcqData.length}`,
                    `Current Question: ${currentMcqIndex + 1}`,
                    `Score: ${mcqScore}/${mcqData.length}`,
                    `MCQ Answered: ${mcqAnswered}`,
                    `Selected Option: ${selectedMcqOption}`,
                    ...mcqData.map((m, i) => `MCQ #${i + 1}: correctAnswer=${m.correctAnswer} (${m.options?.[m.correctAnswer]})`),
                    ``,
                    `=== 3D ASSETS ===`,
                    `Total Assets: ${meshyAssets.length}`,
                    `Loaded: ${assetsLoaded}`,
                    ``,
                    `=== GROUND PLANE CONFIG ===`,
                    `Ground Level (Y): ${GROUND_LEVEL}m`,
                    `Table Height: ${TABLE_HEIGHT}m`,
                    `Asset Distance: ${ASSET_DISTANCE}m`,
                    `Asset Right Offset: ${ASSET_RIGHT_OFFSET}m`,
                    `Target Asset Y: ${(GROUND_LEVEL + TABLE_HEIGHT).toFixed(2)}m`,
                    `Ground Plane Ref: ${groundPlaneRef.current ? 'EXISTS' : 'NULL'}`,
                    ``,
                    `=== NORMALIZED SCALING ===`,
                    `All assets scaled to: ${NORMALIZED_SIZE}m max dimension`,
                    `This ensures consistent sizing regardless of original model size`,
                    ``,
                    `=== SIMPLE ASSET PLACER SYSTEM ===`,
                    `Placement Strategy: ${placementStrategy}`,
                    `Total Assets: ${meshyAssets.length}`,
                    `Placements Calculated: ${assetPlacementsRef.current.length}`,
                    ...(assetPlacementsRef.current.map((p, i) => 
                      `Placement ${i + 1}: (${p.position.x.toFixed(2)}, ${p.position.y.toFixed(2)}, ${p.position.z.toFixed(2)}) scale ${p.scale.toFixed(2)}`
                    )),
                    ``,
                    `=== DEBUG MESSAGES ===`,
                    ...debugInfo,
                    ``,
                    `=== RAW LESSON DATA ===`,
                    JSON.stringify(lessonData, null, 2)
                  ].join('\n');
                  navigator.clipboard.writeText(fullLog);
                  alert('Comprehensive debug log copied to clipboard!');
                }}
                className="px-2 py-0.5 bg-yellow-600 hover:bg-yellow-500 text-black rounded text-xs"
              >
                📋 Copy All
              </button>
            </div>
          </div>
          
          {debugExpanded && (
            <>
              {/* Status Grid - Always visible */}
              <div className="mb-2 p-2 bg-slate-800/50 rounded grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${skyboxUrl ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                  <span className="text-slate-300">Skybox</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isVRSupported ? 'bg-green-500' : isVRSupported === false ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                  <span className="text-slate-300">VR</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${layoutEngineRef.current?.isReady() ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-slate-300">Layout</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${ttsData.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                  <span className="text-slate-300">TTS: {ttsData.length} {isAudioPlaying ? '▶' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${mcqData.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                  <span className="text-slate-300">MCQ: {mcqData.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${assetsLoaded > 0 ? 'bg-green-500' : meshyAssets.length > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`}></span>
                  <span className="text-slate-300">Assets: {assetsLoaded}/{meshyAssets.length}</span>
                </div>
              </div>
              
              {/* Phase indicator */}
              <div className="mb-2 p-2 bg-slate-800/50 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phase:</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                    lessonPhase === 'waiting' ? 'bg-gray-600 text-gray-200' :
                    lessonPhase === 'intro' ? 'bg-cyan-600 text-white' :
                    lessonPhase === 'content' ? 'bg-purple-600 text-white' :
                    lessonPhase === 'outro' ? 'bg-emerald-600 text-white' :
                    lessonPhase === 'mcq' ? 'bg-amber-600 text-white' :
                    lessonPhase === 'complete' ? 'bg-green-600 text-white' :
                    'bg-slate-600 text-white'
                  }`}>
                    {lessonPhase.toUpperCase()} {lessonStarted ? '✓' : '⏳'}
                  </span>
                </div>
                {lessonPhase === 'mcq' && (
                  <div className="mt-1 text-xs text-amber-300">
                    Quiz: Q{currentMcqIndex + 1}/{mcqData.length} | Score: {mcqScore}/{mcqData.length}
                  </div>
                )}
              </div>
              
              {/* Asset Placement System Controls - IN PANEL (not floating) */}
              <div className="mb-2 p-2 bg-slate-800/50 rounded border border-purple-500/30">
                <div className="text-xs font-bold text-purple-400 mb-2">🎯 Asset Placement Strategy</div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300 text-xs">Current Strategy:</span>
                  <span className="px-2 py-0.5 bg-purple-600/50 text-purple-200 rounded text-xs font-bold">
                    {placementStrategy === 'curved-arc' ? 'Curved Arc' :
                     placementStrategy === 'focus-secondary' ? 'Focus + Secondary' :
                     'Carousel'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => changePlacementStrategy('curved-arc')}
                    className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                      placementStrategy === 'curved-arc' 
                        ? 'bg-purple-600 text-white font-bold' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Curved Arc
                  </button>
                  <button
                    onClick={() => changePlacementStrategy('focus-secondary')}
                    className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                      placementStrategy === 'focus-secondary' 
                        ? 'bg-purple-600 text-white font-bold' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Focus + Secondary
                  </button>
                  <button
                    onClick={() => changePlacementStrategy('carousel')}
                    className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                      placementStrategy === 'carousel' 
                        ? 'bg-purple-600 text-white font-bold' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Carousel
                  </button>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Assets: {assetsLoaded}/{meshyAssets.length} | Placements: {assetPlacementsRef.current.length}
                </div>
              </div>
              
              {/* Log Messages */}
              <div className="max-h-40 overflow-y-auto space-y-0.5 p-2 bg-slate-900/50 rounded">
                {debugInfo.slice(-20).map((msg, i) => (
                  <div key={i} className={`text-xs ${
                    msg.includes('ERROR') || msg.includes('❌') ? 'text-red-400' : 
                    msg.includes('✅') ? 'text-green-400' : 
                    msg.includes('⚠') || msg.includes('⏳') ? 'text-yellow-400' :
                    msg.includes('🥽') ? 'text-purple-400' :
                    msg.includes('🔊') ? 'text-cyan-400' :
                    msg.includes('❓') ? 'text-amber-400' :
                    msg.includes('📐') ? 'text-blue-400' :
                    msg.includes('📦') ? 'text-orange-400' :
                    msg.includes('👆') ? 'text-pink-400' :
                    'text-slate-300'
                  }`}>
                    {msg}
                  </div>
                ))}
                {debugInfo.length === 0 && (
                  <div className="text-slate-500 text-center py-2">Waiting for debug messages...</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Export with Error Boundary
// ============================================================================

const XRLessonPlayerV3WithBoundary: React.FC = () => {
  return (
    <XRPlayerErrorBoundary>
      <XRLessonPlayerV3 />
    </XRPlayerErrorBoundary>
  );
};

export default XRLessonPlayerV3WithBoundary;
