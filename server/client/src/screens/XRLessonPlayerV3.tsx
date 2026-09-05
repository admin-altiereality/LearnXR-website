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

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { extractMcqOptions, resolveCorrectAnswerIndex } from '../lib/mcq/answerIndex';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { DRACO_DECODER_PATH } from '../lib/three/dracoDecoder';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { ProfessionalLayoutSystem, PlacedAsset } from '../utils/webxr/professionalLayoutSystem';
import { VRLessonExperience } from '../utils/webxr/vrLessonExperience';
import { StableLayoutSystem } from '../utils/webxr/stableLayoutSystem';
import { SceneLayoutSystem, PlacementStrategy, AssetPlacement } from '../utils/webxr/sceneLayoutSystem';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, AlertTriangle, Glasses, Award, Home, Play, Hand } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useEnforcedPlayerRoute } from '../hooks/useEnforcedPlayerRoute';
import { useComfortBreak } from '../hooks/useComfortBreak';
import { type ReportSessionQuizPayload } from '../services/classSessionService';
// Scores have to land in student_scores as well as on the class session: the
// session progress doc is live teaching data and is thrown away with the class,
// while student_scores is the durable record the dashboards and reports read.
import { saveQuizScore } from '../services/lessonTrackingService';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Live-class support. The classroom logic is shared with the krpano player so the
// two cannot drift; this player only supplies its phase vocabulary and camera I/O.
import { useClassroomSession, type ClassroomViewAdapter } from '../hooks/useClassroomSession';
// The lesson panel is drawn by the same renderer the krpano player uses, so the
// two players show an identical UI rather than two hand-maintained versions.
import {
  actionAtUv,
  drawLessonPanel,
  ensureLessonPanelFont,
  parseLessonUiAction,
  EMPTY_LESSON_UI_STATE,
  PANEL_H,
  PANEL_W,
} from '../lib/lessonUi';
import type { ButtonRegion, LessonUiState } from '../lib/lessonUi';
import { createLookControls, type LookControls } from '../lib/three/lookControls';
// A headset draws two eyes on a mobile GPU; the flat view draws one on a desktop
// GPU. Same scene, very different budget — see lib/three/renderBudget.
import {
  applyRenderBudget,
  requestShadowRefresh,
  FLAT_BUDGET,
  IMMERSIVE_BUDGET,
} from '../lib/three/renderBudget';
// In a headset the device owns the camera pose, so a teacher's Direct has to
// move the reference space instead of the camera.
import { faceXrViewerTowards, resetXrReorientation } from '../lib/three/xrReorient';
import { cameraRotationToHV } from '../lib/classroom/viewSync';
import { createNarrationController, type NarrationController } from '../lib/lesson/narration';
// The teacher marker draws real geometry rather than an SVG overlay, so a
// student wearing a headset sees the ink too.
import { createInkLayer, type InkLayer } from '../lib/annotations/inkLayer';
import {
  annotationNow,
  capPoints,
  MAX_INK_STROKES,
  simplifyStroke,
  STROKE_TTL_MS,
} from '../lib/annotations/sphereGeometry';
import { MARKER_COLORS } from '../Components/player/MarkerToolbar';
import { appendStroke, publishAnnotations } from '../services/classSessionService';
import type { AnnotationPoint, AnnotationStroke, SessionLessonPhase } from '../types/lms';
import { LiveClassHostOverlay } from '../Components/classSession/LiveClassHostOverlay';
import { PlayerChrome } from '../Components/player/PlayerChrome';
import { PlayerTopBar } from '../Components/player/PlayerTopBar';
import { PlayerBottomBar } from '../Components/player/PlayerBottomBar';
import { usePlayerViewport } from '../hooks/usePlayerViewport';

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
/**
 * The lesson phase vocabulary is now the SAME one the session, Firestore and
 * the krpano player use. This player used to have its own names (waiting /
 * content / mcq / complete) with an adapter translating on every read and
 * write; that translation layer is gone.
 */
type LessonPhase = Extract<
  SessionLessonPhase,
  'idle' | 'intro' | 'explanation' | 'outro' | 'quiz' | 'completed'
>;

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
  // profile carries the school/class context saveQuizScore attributes on.
  const { user, profile } = useAuth();

  // If the class was launched into the other player, move there rather than
  // splitting the class across two.
  useEnforcedPlayerRoute('xr_v3');

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);
  /**
   * Narration is owned by a controller, not a bare Audio element. See
   * lib/lesson/narration.ts: dropping an element with `pause(); ref = null` did
   * not reliably stop it, which is how intro and explanation ended up playing
   * over each other.
   */
  const narrationRef = useRef<NarrationController | null>(null);
  /** Pending "advance after a silent phase" timer, so it can be cancelled. */
  const phaseAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Read inside advancePhase, which must not re-create itself when quiz data loads. */
  const mcqDataRef = useRef<MCQData[]>([]);
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
  /**
   * The one lesson panel. Replaces the separate script / MCQ / start / class
   * meshes; the shared renderer draws all of those states onto this surface.
   */
  const lessonPanelRef = useRef<{
    mesh: THREE.Mesh;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    texture: THREE.CanvasTexture;
    bornAt: number;
  } | null>(null);
  /** Clickable regions from the last draw, in 2048x1280 canvas space. */
  const lessonPanelRegionsRef = useRef<ButtonRegion[]>([]);
  /** Latest panel state, read by the draw call outside React's render. */
  const lessonUiStateRef = useRef<LessonUiState>(EMPTY_LESSON_UI_STATE);
  const lessonPanelFontRef = useRef<string | undefined>(undefined);
  const lessonPanelHoverRef = useRef<string | null>(null);
  /**
   * Panel click handler, reached through a ref.
   *
   * The two call sites (the canvas pointer handler and the VR controller ray)
   * are created inside the scene-init effect, which runs once when the skybox
   * resolves. Calling the useCallback directly from there captured the FIRST
   * version of it — closed over an empty mcqData — so every quiz tap hit the
   * `currentMcqIndex >= mcqData.length` guard and returned silently. That is
   * why the quiz looked unresponsive rather than hidden.
   */
  const lessonPanelUvRef = useRef<(u: number, v: number) => boolean>(() => false);
  /** When the learner actually began, for the score's time-taken field. */
  const lessonStartTimeRef = useRef<number | null>(null);

  /** Teacher marker: the 3D ink layer, plus the stroke being drawn right now. */
  const inkLayerRef = useRef<InkLayer | null>(null);
  const activeStrokeRef = useRef<AnnotationStroke | null>(null);
  const markerActiveRef = useRef(false);
  const markerColorRef = useRef<string>(MARKER_COLORS[0]);
  const lastProgressPercentRef = useRef<number>(-1);
  
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
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('idle');
  const [lessonStarted, setLessonStarted] = useState(false);
  const [currentTtsIndex, setCurrentTtsIndex] = useState(0);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [, setIsAudioPlaying] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(0);
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [mcqAnswered, setMcqAnswered] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);
  const mcqAnswerHistoryRef = useRef<Array<{ questionIndex: number; correct: boolean; selectedOptionIndex: number }>>([]);
  const pendingQuizReportRef = useRef<ReportSessionQuizPayload | null>(null);

  // TTS State Machine
  type TTSState = 'idle' | 'playing' | 'paused' | 'ended';
  const [ttsState, setTtsState] = useState<TTSState>('idle');
  
  
  // Asset references map for dock control
  const assetRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  
  // Scene Layout System (production-grade, scalable layout)
  const sceneLayoutRef = useRef<SceneLayoutSystem | null>(null);
  /** Drives the scene layout; rotated at lesson start. */
  const [placementStrategy, setPlacementStrategy] = useState<PlacementStrategy>('curved-arc');
  const assetPlacementsRef = useRef<AssetPlacement[]>([]);
  const animationMixersRef = useRef<THREE.AnimationMixer[]>([]);
  const lastAnimationTimeRef = useRef<number>(0);

  // --- Live class -----------------------------------------------------------
  // Drag-to-look for flat screens. The camera used to be immovable outside a
  // headset, which also left view sync with nothing to read or write.
  const lookControlsRef = useRef<LookControls | null>(null);
  /** Subscribers to local view changes (host broadcast, student view reporting). */
  const viewListenersRef = useRef<Set<(h: number, v: number, fov: number) => void>>(new Set());
  /** Set by the classroom hook below so effects defined earlier can reach it. */
  const classroomRef = useRef<{
    blockStudentPhaseControl: (label: string) => boolean;
    markStudentLooking: () => void;
    showImmersiveUiForThisViewer: boolean;
    directClassToCurrentView: () => Promise<boolean>;
    /** Class the lesson is being taught in, for score attribution. */
    classId: string | null;
  }>({
    blockStudentPhaseControl: () => false,
    markStudentLooking: () => {},
    showImmersiveUiForThisViewer: true,
    directClassToCurrentView: async () => false,
    classId: null,
  });
  /**
   * Gates the phase autoplay effect. Under lockstep the teacher owns playback, so
   * a student's audio must not start on its own.
   */
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  /** Last phase the autoplay effect actually played, so it fires once per phase. */
  const lastPlayedPhaseRef = useRef<LessonPhase | null>(null);
  const [hostDrawer, setHostDrawer] = useState<null | 'roster' | 'approvals' | 'preview'>(null);
  /**
   * Comfort break. Students only — a teacher driving the class does not need
   * their own lesson interrupted, and they can see the prompt land for the room.
   */
  const [isPresentingXR, setIsPresentingXR] = useState(false);
  const [markerActive, setMarkerActive] = useState(false);
  const [markerColor, setMarkerColor] = useState<string>(MARKER_COLORS[0]);
  const [endSessionConfirming, setEndSessionConfirming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const playerViewport = usePlayerViewport();
  
  // Debug logger with category support - enhanced with timestamps and structured output
  const addDebug = useCallback((msg: string, category?: keyof typeof DEBUG_CATEGORIES) => {
    const prefix = category ? DEBUG_CATEGORIES[category] : '[V3]';
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const fullMsg = `${prefix} ${msg}`;
    // Console only. This used to also feed an on-screen panel that was
    // rendered unconditionally, so it shipped to every class.
    console.log(`[${timestamp}] ${fullMsg}`);
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


  // Reset quiz answer history when entering MCQ phase
  useEffect(() => {
    if (lessonPhase === 'quiz') mcqAnswerHistoryRef.current = [];
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
            const options = extractMcqOptions(mcq);
            // Resolved in one place (src/lib/mcq/answerIndex.ts) — the index the backend
            // stores is already 0-based, so the -1 this replaces scored B as A.
            return {
              id: mcq.id || '',
              question: mcq.question || '',
              options: options,
              correctAnswer: resolveCorrectAnswerIndex(mcq, options, 'xr-quiz'),
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
              const options = extractMcqOptions(data);
              mcqResults.push({
                id: mcqId,
                question: data.question || data.question_text || '',
                options: options,
                correctAnswer: resolveCorrectAnswerIndex(data, options, 'xr-quiz'),
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
        
        // Convert bundle assets to MeshyAsset format (prefer tokenized render URLs when present)
        const convertedAssets: MeshyAsset[] = bundleAssets.map((asset: any) => ({
          id: asset.id || '',
          glbUrl: asset.animated_render_url || asset.animated_glb_url || asset.render_url || asset.model_urls?.glb || asset.glb_url || asset.stored_glb_url || '',
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
            const glbUrl = data.animated_render_url || data.animated_glb_url || data.render_url || data.model_urls?.glb || data.stored_glb_url || data.glb_url;
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
            setIsPresentingXR(true);
            resetXrReorientation();
            // Cut the render budget for the headset. Without this a lesson with
            // more than one 3D asset drops frames badly: the shadow pass is
            // re-rendered every frame at 2048 across two eyes, and its cost
            // scales with the number of casters.
            if (rendererRef.current && sceneRef.current) {
              applyRenderBudget(rendererRef.current, sceneRef.current, IMMERSIVE_BUDGET);
            }
            
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
                
                // The lesson panel shows the start state itself.
                ensureLessonPanel();
              }
            }, 500);
          });
          
          rendererRef.current.xr.addEventListener('sessionend', () => {
            console.log(`${DEBUG_CATEGORIES.XR} VR session ended`);
            setIsPresentingXR(false);
            resetXrReorientation();
            // Back to full fidelity on the flat screen.
            if (rendererRef.current && sceneRef.current) {
              applyRenderBudget(rendererRef.current, sceneRef.current, FLAT_BUDGET);
            }
            setLoadingState('ready');
            
          });
        } catch (vrErr: any) {
          console.error('[XRLessonPlayerV3] VR button creation error:', vrErr);
          addDebug(`VR button error: ${vrErr?.message || vrErr}`);
        }
      }
    
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      setIsSceneReady(true);

      // Screen input for the lesson panel.
      //
      // This used to be inside `if (!isVRSupported)`, so on a desktop browser
      // that reports immersive-vr support but is not presenting, NO handler was
      // attached at all and the panel was completely unclickable. Whether the
      // device could enter VR has nothing to do with whether a mouse is being
      // used, so it is now always attached — the raycast simply finds nothing
      // while a headset session owns the view.
      try {
        setLoadingState('ready');
        ensureLessonPanel();

        const canvas = rendererRef.current.domElement;
        const handlePointerUp = (event: PointerEvent) => {
          try {
            if (event.button !== 0) return;
            if (rendererRef.current?.xr?.isPresenting) return;
            // A drag is a look-around, not a click. lookControls already applies
            // a 3px threshold, so this is the same gesture distinction the
            // controls use rather than a second, competing one.
            if (lookControlsRef.current?.isDragging()) return;
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !raycasterRef.current) return;

            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycasterRef.current.setFromCamera(mouse, cameraRef.current);

            const panelMesh = lessonPanelRef.current?.mesh;
            if (!panelMesh) return;
            const uv = raycasterRef.current.intersectObject(panelMesh, false)[0]?.uv;
            if (!uv) return;
            // Regions come back from the shared renderer in canvas space, so the
            // UV is all this needs — no per-panel size guessing.
            lessonPanelUvRef.current(uv.x, uv.y);
          } catch (err: any) {
            console.error('[XRLessonPlayerV3] Panel pointer handler error:', err);
          }
        };

        // pointerup, not pointerdown: a click is only a click once we know the
        // gesture did not turn into a drag.
        (rendererRef as any)._panelPointerUp = handlePointerUp;
        canvas.addEventListener('pointerup', handlePointerUp);
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] Panel input init error:', err);
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
        
        // Check the lesson panel first, so a button press is never stolen by an
        // asset behind it.
        const panelMesh = lessonPanelRef.current?.mesh;
        const panelIntersects = panelMesh ? raycaster.intersectObject(panelMesh, false) : [];

        if (panelIntersects.length > 0 && panelIntersects[0].uv) {
          const uv = panelIntersects[0].uv;
          const buttonId = `lessonPanel_${Math.round(uv.x * 100)}_${Math.round(uv.y * 100)}`;
          const now = Date.now();
          const lastClick = lastGrabTimeRef.current.get(buttonId) || 0;
          if (now - lastClick > 100) {
            lastGrabTimeRef.current.set(buttonId, now);
            triggerHapticFeedback(controller);
            lessonPanelUvRef.current(uv.x, uv.y);
          }
          return;
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
          const lessonMesh = lessonPanelRef.current?.mesh;
          if (lessonMesh && lessonMesh.visible) uiPanels.push(lessonMesh);
          
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
        dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
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
    
    // Drag-to-look. Without this the camera is immovable on a flat screen, and
    // view sync has nothing to read from or write to.
    if (rendererRef.current && cameraRef.current) {
      lookControlsRef.current?.dispose();
      lookControlsRef.current = createLookControls({
        camera: cameraRef.current,
        domElement: rendererRef.current.domElement,
        // Stand down entirely in a headset — the device owns the pose there.
        isPresenting: () => rendererRef.current?.xr?.isPresenting === true,
        onChange: (h, v, fov) => {
          // ONLY a real drag suspends teacher-view follow. onChange also fires
          // while the teacher's own view is being applied, and marking that as
          // "the student is looking around" would make follow block itself for
          // the whole grace window on every update.
          if (lookControlsRef.current?.isDragging()) {
            classroomRef.current.markStudentLooking();
          }
          viewListenersRef.current.forEach((listener) => listener(h, v, fov));
        },
      });
    }

    // Animation loop (XR-compatible) - only if renderer exists
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      lastAnimationTimeRef.current = performance.now() / 1000;
      rendererRef.current.setAnimationLoop((time: number) => {
        try {
          const now = time / 1000;
          const delta = lastAnimationTimeRef.current ? Math.min(now - lastAnimationTimeRef.current, 0.1) : 0;
          lastAnimationTimeRef.current = now;
          animationMixersRef.current.forEach((mixer) => mixer.update(delta));
          lookControlsRef.current?.update();
          inkLayerRef.current?.update();

          // Update billboards to face camera
          if (lessonPanelRef.current && cameraRef.current) {
            lessonPanelRef.current.mesh.lookAt(cameraRef.current.position);
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
              const lessonMesh = lessonPanelRef.current?.mesh;
              if (lessonMesh) uiPanels.push(lessonMesh);
              
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
            const panelHandler = (rendererRef as any)?._panelPointerUp;
            if (panelHandler) {
              rendererRef.current?.domElement?.removeEventListener('pointerup', panelHandler);
              (rendererRef as any)._panelPointerUp = null;
            }
          } catch (e) {
            // ignore
          }
          lookControlsRef.current?.dispose();
          lookControlsRef.current = null;
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
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    dracoLoader.preload(); // Preload decoder for faster loading
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Verify GLB support
    console.log('[XRLessonPlayerV3] GLTFLoader initialized - supports .gltf and .glb files');
    addDebug('GLTFLoader ready (supports .gltf and .glb)');
    
    // Position assets directly in front of user (centered)
    animationMixersRef.current = []; // Clear mixers when reloading assets
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
          const assetUrl = asset.glbUrl || '';
          const isGLB = assetUrl.toLowerCase().includes('.glb');
          const isGLTF = assetUrl.toLowerCase().includes('.gltf');
          
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

          // Play GLB animations (e.g. Meshy rigged+animated assets)
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(gltf.scene);
            gltf.animations.forEach((clip: THREE.AnimationClip) => mixer.clipAction(clip).play());
            animationMixersRef.current.push(mixer);
            addDebug(`Animation: ${gltf.animations.length} clip(s) playing`);
          }

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
          // The immersive budget stops redrawing the shadow map every frame, so a
          // newly placed asset needs one explicit refresh to cast at all.
          requestShadowRefresh(rendererRef.current);
          
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
    } else if (phase === 'explanation') {
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
      if (phase === 'explanation' && (idLower.includes('_explanation_') || idLower.includes('_content_'))) return true;
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
  
  /**
   * The ONE place a lesson phase moves forward.
   *
   * This used to be duplicated in three branches of playTTSForPhase (no audio,
   * ended, error), each with its own setTimeout, so a missing or failed clip
   * could queue several advances and skip a phase.
   */
  const advancePhase = useCallback((from: LessonPhase) => {
    setLessonPhase((current) => {
      // Only advance if we are still on the phase this call was made for. A late
      // callback from a superseded clip cannot drag the class forwards.
      if (current !== from) return current;
      if (from === 'intro') return 'explanation';
      if (from === 'explanation') return 'outro';
      if (from === 'outro') return mcqDataRef.current.length > 0 ? 'quiz' : 'completed';
      return current;
    });
  }, []);

  const playTTSForPhase = useCallback((phase: LessonPhase) => {
    const narration = narrationRef.current;
    const tts = getTTSForPhase(phase);

    if (!narration || !tts?.audioUrl) {
      addDebug(`No TTS audio for phase: ${phase}`);
      setTtsState('idle');
      // Give the panel a beat to show the phase before moving on.
      const timer = setTimeout(() => advancePhase(phase), 1000);
      phaseAdvanceTimerRef.current = timer;
      return;
    }

    debugTTS(`Playing TTS for ${phase}: ${(tts as any).script_type || tts.section}`);
    narration.play(tts.audioUrl, {
      onEnded: () => advancePhase(phase),
      onError: (reason) => {
        addDebug(`Audio error for ${phase}: ${reason}`);
        phaseAdvanceTimerRef.current = setTimeout(() => advancePhase(phase), 1000);
      },
    });
  }, [getTTSForPhase, addDebug, debugTTS, advancePhase]);

  const toggleAudio = useCallback(() => {
    if (classroomRef.current.blockStudentPhaseControl('Play/Pause')) return;
    const narration = narrationRef.current;
    if (!narration || !narration.getUrl()) {
      playTTSForPhase(lessonPhase);
      return;
    }
    if (narration.getState() === 'playing') narration.pause();
    else if (!narration.resume()) playTTSForPhase(lessonPhase);
  }, [lessonPhase, playTTSForPhase]);
  
  const stopAudio = useCallback(() => {
    if (phaseAdvanceTimerRef.current) {
      clearTimeout(phaseAdvanceTimerRef.current);
      phaseAdvanceTimerRef.current = null;
    }
    narrationRef.current?.stop();
    setIsAudioPlaying(false);
    setTtsState('idle');
  }, []);
  
  const skipNext = useCallback(() => {
    if (classroomRef.current.blockStudentPhaseControl('Skip')) return;
    stopAudio();
    if (lessonPhase === 'intro') {
      setLessonPhase('explanation');
    } else if (lessonPhase === 'explanation') {
      setLessonPhase('outro');
    } else if (lessonPhase === 'outro') {
      if (mcqData.length > 0) {
        setLessonPhase('quiz');
      } else {
        setLessonPhase('completed');
      }
    }
  }, [lessonPhase, mcqData.length, stopAudio]);
  
  
  // Skip directly to Quiz - for users who want to skip all TTS phases
  const skipToQuiz = useCallback(() => {
    if (classroomRef.current.blockStudentPhaseControl('Skip to quiz')) return;
    stopAudio();
    if (mcqData.length > 0) {
      setLessonPhase('quiz');
      debugQuiz('⏭️ Skipped to Quiz');
    } else {
      setLessonPhase('completed');
      debugQuiz('⏭️ No quiz available - completing lesson');
    }
  }, [mcqData.length, stopAudio, addDebug]);

  // ============================================================================
  // Live class
  //
  // All of the teacher-control behaviour lives in useClassroomSession, shared
  // with the krpano player. This player supplies two things it cannot know:
  // its phase vocabulary, and how to read and write its own camera.
  // ============================================================================

  /** Camera I/O for view sync, backed by the drag-to-look controls. */
  const classroomView = useMemo<ClassroomViewAdapter>(
    () => ({
      read: () => lookControlsRef.current?.read() ?? null,
      apply: (view, { isDirect }) => {
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        if (renderer?.xr?.isPresenting && camera) {
          // Only an explicit Direct realigns a headset. Continuous follow is
          // suppressed in VR on purpose — applying it would fight the student's
          // own head movement, which is instant motion sickness.
          if (!isDirect) return;
          // Read where they are actually looking now, so a student who has
          // turned since the last Direct still ends up facing the teacher.
          const heading = cameraRotationToHV(camera).h;
          faceXrViewerTowards(renderer, heading, view.h);
          return;
        }
        // A Direct snaps; continuous follow eases, so it reads as the teacher
        // moving rather than the camera being seized.
        lookControlsRef.current?.apply(view.h, view.v, view.fov, isDirect);
      },
      subscribe: (listener) => {
        viewListenersRef.current.add(listener);
        return () => viewListenersRef.current.delete(listener);
      },
      isImmersive: () => rendererRef.current?.xr?.isPresenting === true,
    }),
    []
  );

  /**
   * Playback commands from the teacher. Deliberately declarative: it resets the
   * played-phase marker and flips autoplay rather than calling playTTSForPhase
   * directly, so the autoplay effect fires once with the phase that has actually
   * committed. Calling TTS here reads the phase through a stale closure and
   * double-plays the clip.
   */
  const handleClassPlaybackCommand = useCallback(
    (cmd: 'play' | 'pause' | 'replay') => {
      if (cmd === 'pause') {
        setAutoplayEnabled(false);
        narrationRef.current?.pause();
        return;
      }
      stopAudio();
      lastPlayedPhaseRef.current = null;
      setLessonStarted(true);
      setAutoplayEnabled(true);
    },
    [stopAudio]
  );

  const classroom = useClassroomSession({
    playerPhase: lessonPhase,
    setPlayerPhase: setLessonPhase,
    lessonReady: isSceneReady,
    allReady: isSceneReady && loadingState !== 'loading',
    view: classroomView,
    onPlaybackCommand: handleClassPlaybackCommand,
    pendingQuizRef: pendingQuizReportRef,
    dragGraceTarget: rendererRef.current?.domElement ?? null,
    // Always true for this player: unlike the krpano HUD, V3's in-scene panels
    // are the only lesson UI and render the same flat as they do in a headset.
    immersiveUiDeviceCapable: true,
  });

  /**
   * Removed mid-lesson: leave immediately.
   *
   * The dashboard route in ClassSessionContext handles the plain removal case,
   * but a student sitting inside the player should not wait on a route change
   * elsewhere to notice, and a rejoin request must not keep them in the lesson.
   */
  useEffect(() => {
    if (!classroom.isStudentInSession) return;
    if (classroom.isStudentRemoved || !classroom.isAdmitted) {
      toast.info('Your teacher removed you from this class.');
      navigate('/dashboard/student', { replace: true });
    }
  }, [classroom.isStudentInSession, classroom.isStudentRemoved, classroom.isAdmitted, navigate]);

  // ============================================================================
  // Teacher marker
  //
  // Strokes are stored in sphere coordinates, the same format the krpano player
  // publishes, so a lesson drawn in one player renders in the other. Published
  // on pointer-up only: the teacher sees their own stroke locally at full frame
  // rate and the class receives it complete, which is roughly a 50x reduction in
  // writes compared with publishing during the drag.
  // ============================================================================

  useEffect(() => {
    markerActiveRef.current = markerActive;
    markerColorRef.current = markerColor;
    // Dragging must not also swing the camera while the marker is down.
    lookControlsRef.current?.setEnabled(!markerActive);
  }, [markerActive, markerColor]);

  const comfortBreak = useComfortBreak({
    isImmersive: isPresentingXR,
    enabled: !classroom.isClassHost,
  });

  const annotationSessionId = classroom.hostSessionId;

  const publishStroke = useCallback(
    (stroke: AnnotationStroke) => {
      if (!annotationSessionId || !classroom.isClassHost) return;
      const next = appendStroke(
        classroom.activeSession?.teacher_annotations ?? null,
        stroke,
        MAX_INK_STROKES
      );
      void publishAnnotations(annotationSessionId, next);
    },
    [annotationSessionId, classroom.isClassHost, classroom.activeSession?.teacher_annotations]
  );

  // Pointer drawing. Bound to the canvas so it never competes with the bars.
  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas || !markerActive || !classroom.isClassHost) return;

    const toSphere = (event: PointerEvent): AnnotationPoint | null => {
      const camera = cameraRef.current;
      const ink = inkLayerRef.current;
      if (!camera || !ink) return null;
      const rect = canvas.getBoundingClientRect();
      const point = ink.pointerToSphere(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
        camera
      );
      return point ? { a: point.a, v: point.v } : null;
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const point = toSphere(event);
      if (!point) return;
      canvas.setPointerCapture(event.pointerId);
      activeStrokeRef.current = {
        id: `s_${Date.now()}_${Math.round(performance.now() % 1000)}`,
        mode: 'laser',
        color: markerColorRef.current,
        width: 6,
        points: [point],
        created_ms: annotationNow(),
        ttl_ms: STROKE_TTL_MS,
      };
      inkLayerRef.current?.setLocalStroke(activeStrokeRef.current);
    };

    const onMove = (event: PointerEvent) => {
      const stroke = activeStrokeRef.current;
      if (!stroke) return;
      const point = toSphere(event);
      if (!point) return;
      stroke.points = capPoints([...stroke.points, point]);
      inkLayerRef.current?.setLocalStroke({ ...stroke });
    };

    const onUp = (event: PointerEvent) => {
      const stroke = activeStrokeRef.current;
      activeStrokeRef.current = null;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
      if (!stroke || stroke.points.length < 2) {
        inkLayerRef.current?.setLocalStroke(null);
        return;
      }
      const finished: AnnotationStroke = {
        ...stroke,
        points: simplifyStroke(stroke.points),
        created_ms: annotationNow(),
      };
      inkLayerRef.current?.setLocalStroke(null);
      publishStroke(finished);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [markerActive, classroom.isClassHost, isSceneReady, publishStroke]);

  // Everyone renders whatever the session holds — the teacher included, so their
  // own ink is confirmed to have reached the class rather than only drawn locally.
  const liveAnnotations =
    (classroom.isStudentInSession
      ? classroom.joinedSession?.teacher_annotations
      : classroom.activeSession?.teacher_annotations) ?? null;

  useEffect(() => {
    inkLayerRef.current?.setAnnotations(liveAnnotations);
  }, [liveAnnotations]);

  /** Captured so the End-session closure below sees a defined function. */
  const endClassSession = classroom.endSession;

  // Bridge for effects declared above this point (the render loop, the raycast
  // UI handler) which are created before the hook runs.
  classroomRef.current = {
    blockStudentPhaseControl: classroom.blockStudentPhaseControl,
    markStudentLooking: classroom.markStudentLooking,
    showImmersiveUiForThisViewer: classroom.showImmersiveUiForThisViewer,
    directClassToCurrentView: classroom.directClassToCurrentView,
    classId: classroom.joinedSession?.class_id ?? classroom.activeSession?.class_id ?? null,
  };

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
    if (lessonStartTimeRef.current === null) lessonStartTimeRef.current = Date.now();
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
    
    // The panel stays; it simply stops drawing the start state.
    
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
  
  
  
  // Auto-play TTS when phase changes (intro/content/outro) - ONLY if lesson has started
  useEffect(() => {
    // Don't auto-play if lesson hasn't started yet
    if (!lessonStarted) return;
    // Under lockstep the teacher owns playback; their Play command clears
    // lastPlayedPhaseRef and re-enables autoplay.
    if (!autoplayEnabled) return;

    if (['intro', 'explanation', 'outro'].includes(lessonPhase) && ttsData.length > 0) {
      // Fire once per phase. mcqData / currentMcqIndex / mcqScore are in this
      // effect's deps, so without the marker a quiz state change restarts the
      // narration from the top mid-phase.
      if (lastPlayedPhaseRef.current === lessonPhase) return;
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        lastPlayedPhaseRef.current = lessonPhase;
        playTTSForPhase(lessonPhase);
      }, 500);
      return () => clearTimeout(timer);
    } else if (lessonPhase === 'quiz') {
      // Auto-pause audio when entering quiz
      narrationRef.current?.pause();
      
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
  }, [lessonPhase, ttsData, playTTSForPhase, lessonStarted, autoplayEnabled, mcqData, currentMcqIndex, mcqScore, debugQuiz]);
  
  // Mute applies to the narration element, which is recreated per phase.
  useEffect(() => {
    narrationRef.current?.setMuted(isMuted);
  }, [isMuted, ttsState, lessonPhase]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      narrationRef.current?.dispose();
      narrationRef.current = null;
    };
  }, []);
  
  // One narration controller for the life of the player.
  useEffect(() => {
    narrationRef.current = createNarrationController({
      onStateChange: (next) => {
        setTtsState(next);
        setIsAudioPlaying(next === 'playing');
      },
    });
    return () => {
      narrationRef.current?.dispose();
      narrationRef.current = null;
    };
  }, []);

  useEffect(() => {
    mcqDataRef.current = mcqData;
  }, [mcqData]);

  // NOTE: the VR-entry auto-start effect that used to sit here has gone. It
  // raced the main autoplay effect below for the intro phase; both are keyed on
  // lastPlayedPhaseRef, so whichever timer fired second was a no-op at best and
  // a second clip at worst.
  
  
  // ============================================================================
  // Create VR Script Panel UI (3D Billboard)
  // ============================================================================
  
  /** Narration text for a phase, falling back to a friendly default. */
  const getScriptForPhase = useCallback(
    (phase: LessonPhase): string => {
      const topic = (lessonData as any)?.topic;
      if (phase === 'intro') return topic?.avatar_intro || 'Welcome to this lesson. Let us begin!';
      if (phase === 'explanation') return topic?.avatar_explanation || 'This is the explanation phase.';
      if (phase === 'outro') return topic?.avatar_outro || 'Thank you for completing this lesson!';
      return '';
    },
    [lessonData]
  );

  // ============================================================================
  // Lesson panel
  //
  // One 2048x1280 canvas plane rendered by the SHARED renderer in
  // src/lib/lessonUi — the same code that draws the krpano player's immersive
  // panel. This replaces four separate hand-drawn panels (start, script, MCQ,
  // class status) that were much plainer than krpano's and drifted from it.
  //
  // The mesh is built once and only its texture is redrawn, so the throttles
  // the old rebuild-per-change panels needed are gone.
  // ============================================================================

  /** Rebuild the panel texture from the current state and store its hit regions. */
  const redrawLessonPanel = useCallback(() => {
    const panel = lessonPanelRef.current;
    if (!panel) return;
    try {
      lessonPanelRegionsRef.current = drawLessonPanel(panel.ctx, lessonUiStateRef.current, {
        font: lessonPanelFontRef.current,
        animTime: (performance.now() - panel.bornAt) / 1000,
        hoverAction: lessonPanelHoverRef.current,
      });
      panel.texture.needsUpdate = true;
    } catch (err) {
      console.error('[XRLessonPlayerV3] Lesson panel draw failed:', err);
    }
  }, []);

  /** Create the panel mesh once the scene exists. Safe to call repeatedly. */
  const ensureLessonPanel = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return null;
    if (lessonPanelRef.current) return lessonPanelRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = PANEL_W;
    canvas.height = PANEL_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    try {
      const maxAniso = rendererRef.current?.capabilities?.getMaxAnisotropy?.();
      if (maxAniso) texture.anisotropy = maxAniso;
    } catch {
      /* anisotropy is a nicety */
    }

    // 16:10, matching the canvas, so nothing is stretched.
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.5),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    );
    mesh.name = 'lessonPanel';
    mesh.userData.isInteractable = true;
    mesh.userData.layer = 'ui';
    mesh.userData.panelType = 'lesson';

    if (layoutEngineRef.current?.isReady()) {
      const pos = layoutEngineRef.current.positionUIPanel();
      mesh.position.set(pos.x, pos.y, pos.z);
    } else {
      // Slightly left of centre at eye level, as the script panel used to sit.
      const angle = -Math.PI / 9;
      const distance = 2.2;
      mesh.position.set(Math.sin(angle) * distance, 1.6, -Math.cos(angle) * distance);
    }
    mesh.lookAt(camera.position);
    scene.add(mesh);

    lessonPanelRef.current = { mesh, canvas, ctx, texture, bornAt: performance.now() };
    lessonPanelFontRef.current = ensureLessonPanelFont();
    redrawLessonPanel();
    return lessonPanelRef.current;
  }, [redrawLessonPanel]);


  // Ink layer lives as long as the scene does.
  useEffect(() => {
    if (!isSceneReady || !sceneRef.current) return;
    inkLayerRef.current = createInkLayer({
      scene: sceneRef.current,
      getFov: () => cameraRef.current?.fov ?? 90,
    });
    return () => {
      inkLayerRef.current?.dispose();
      inkLayerRef.current = null;
    };
  }, [isSceneReady]);

  // Build the panel as soon as the scene is up, and tear it down with the scene.
  useEffect(() => {
    if (!isSceneReady) return;
    ensureLessonPanel();
    return () => {
      const panel = lessonPanelRef.current;
      if (panel && sceneRef.current) sceneRef.current.remove(panel.mesh);
      panel?.texture.dispose();
      lessonPanelRef.current = null;
      lessonPanelRegionsRef.current = [];
    };
  }, [isSceneReady, ensureLessonPanel]);

  /**
   * Describe the lesson to the shared renderer.
   *
   * The panel speaks the session vocabulary directly now, so there is no
   * translation step. The state stays truthful whatever the class is doing;
   * whether a held student SEES it is a visibility question, handled below.
   */
  const currentMcq = lessonPhase === 'quiz' ? mcqData[currentMcqIndex] : undefined;
  const lessonUiState = useMemo<LessonUiState>(() => {
    return {
      ...EMPTY_LESSON_UI_STATE,
      phase: lessonPhase,
      // Deliberately NOT rewritten for a held student. This used to blank the
      // script and force showQuiz off, which meant the quiz was never drawn at
      // all — there were no regions to press, so it read as "the buttons do not
      // work". krpano keeps this state truthful and hides the panel instead;
      // visibility is handled where the mesh is, below.
      script: getScriptForPhase(lessonPhase),
      ttsStatus: ttsState,
      question: currentMcq?.question ?? '',
      options: currentMcq?.options ?? [],
      showQuiz: lessonPhase === 'quiz' && !!currentMcq,
      showResult: mcqAnswered,
      scoreLabel:
        lessonPhase === 'completed' && mcqData.length > 0
          ? `${mcqScore} / ${mcqData.length} correct`
          : '',
      selectedAnswer: selectedMcqOption ?? -1,
      // In krpano this means "waiting for the user to press Continue", and it
      // drives a pulsing prompt. This player auto-advances when narration ends,
      // so it never waits — mapping it to `!lessonStarted` left a student under
      // teacher control staring at that pulse for the whole lesson.
      waitingForUser: false,
      isPlayingAudio: ttsState === 'playing',
      currentMcqIndex,
      totalMcqs: mcqData.length,
      correctAnswer: mcqAnswered ? currentMcq?.correctAnswer ?? -1 : -1,
      explanation: mcqAnswered ? currentMcq?.explanation ?? '' : '',
      controlStudentsEnabled: classroom.controlStudentsEnabled,
      isStudent: classroom.isStudentInSession,
      isHost: classroom.isClassHost,
    };
  }, [
    lessonPhase,
    lessonStarted,
    ttsState,
    currentMcq,
    currentMcqIndex,
    mcqAnswered,
    mcqScore,
    mcqData.length,
    selectedMcqOption,
    getScriptForPhase,
    classroom.controlStudentsEnabled,
    classroom.isStudentInSession,
    classroom.isClassHost,
    classroom.showImmersiveUiForThisViewer,
  ]);

  useEffect(() => {
    lessonUiStateRef.current = lessonUiState;
    redrawLessonPanel();
  }, [lessonUiState, redrawLessonPanel]);

  /**
   * Panel visibility, matching krpano.
   *
   * There, `__showImmersiveUI` is ANDed with `webvr.isenabled`, so a held
   * student loses the in-headset HUD and nothing else. The equivalent here has
   * to keep the flat panel: it is this player's only lesson UI, and hiding it
   * on a laptop would leave a student looking at an empty room. On a flat
   * screen the DOM waiting card already explains the hold.
   */
  useEffect(() => {
    const mesh = lessonPanelRef.current?.mesh;
    if (!mesh) return;
    mesh.visible = classroom.showImmersiveUiForThisViewer || !isPresentingXR;
  }, [classroom.showImmersiveUiForThisViewer, isPresentingXR, lessonUiState]);

  
  
  
  
  // ============================================================================
  // MCQ Interaction Handlers
  // ============================================================================
  
  /**
   * Record a finished quiz in the durable score collection.
   *
   * This player reported quiz results to the live class session but never wrote
   * them to student_scores, so a student's result vanished when the class ended
   * and never reached the reports. The krpano player has always written both;
   * this brings V3 level with it.
   */
  const persistQuizScore = useCallback(
    async (correct: number, total: number, answers: Record<string, number>) => {
      if (!user || !profile || total <= 0) return;
      const chapter = (lessonData as any)?.chapter;
      const topic = (lessonData as any)?.topic;
      const chapterId = chapter?.chapter_id;
      const topicId = topic?.topic_id;
      if (!chapterId || !topicId) {
        console.warn('[XRLessonPlayerV3] Cannot save quiz score: missing chapter or topic id');
        return;
      }

      try {
        // Attempt number is the count of prior scores for this lesson.
        let attemptNumber = 1;
        try {
          const existing = await getDocs(
            query(
              collection(db, 'student_scores'),
              where('student_uid', '==', user.uid),
              where('chapter_id', '==', chapterId),
              where('topic_id', '==', topicId)
            )
          );
          attemptNumber = existing.size + 1;
        } catch {
          // A failed count must not cost the student their score.
        }

        const durationSeconds = lessonStartTimeRef.current
          ? Math.round((Date.now() - lessonStartTimeRef.current) / 1000)
          : undefined;

        const scoreId = await saveQuizScore(
          profile,
          chapterId,
          topicId,
          chapter?.curriculum || 'CBSE',
          String(chapter?.class_name ?? ''),
          chapter?.subject || '',
          { correct, total, percentage: Math.round((correct / total) * 100) },
          answers,
          attemptNumber,
          durationSeconds,
          undefined,
          topic?.learning_objective,
          'web',
          // Attribute to the class the lesson was actually taught in, not the
          // student's first enrolment.
          classroomRef.current.classId
        );
        if (scoreId) addDebug(`Quiz score saved: ${correct}/${total}`);
      } catch (error) {
        console.error('[XRLessonPlayerV3] Failed to save quiz score:', error);
      }
    },
    [user, profile, lessonData, addDebug]
  );

  const handleMCQOptionSelect = useCallback((optionIndex: number) => {
    if (mcqAnswered || lessonPhase !== 'quiz' || currentMcqIndex >= mcqData.length) {
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
        // Durable record, separate from the live class report above.
        const answersByQuestion: Record<string, number> = {};
        history.forEach((a) => {
          const id = mcqData[a.questionIndex]?.id ?? String(a.questionIndex);
          answersByQuestion[id] = a.selectedOptionIndex;
        });
        void persistQuizScore(score, total, answersByQuestion);
      }
      setLessonPhase('completed');
      debugQuiz(`Quiz complete! Score: ${score}/${total}`);
    }
  }, [mcqAnswered, currentMcqIndex, mcqData, addDebug, debugQuiz, persistQuizScore]);

  /**
   * Handle a click on the panel, given the raycast UV.
   *
   * The action vocabulary is shared with krpano, so both players answer the same
   * button names and neither can quietly grow a control the other lacks.
   */
  const handleLessonPanelUv = useCallback(
    (u: number, v: number): boolean => {
      const raw = actionAtUv(lessonPanelRegionsRef.current, u, v);
      const action = parseLessonUiAction(raw);
      if (!action) return false;

      switch (action.kind) {
        case 'phaseGo': {
          if (classroomRef.current.blockStudentPhaseControl('Jumping ahead')) return true;
          const local = action.phase as LessonPhase;
          if (local) {
            stopAudio();
            lastPlayedPhaseRef.current = null;
            setLessonStarted(true);
            setLessonPhase(local);
          }
          return true;
        }
        case 'ttsPlay':
        case 'ttsPause':
          toggleAudio();
          return true;
        case 'replay':
          if (classroomRef.current.blockStudentPhaseControl('Replay')) return true;
          stopAudio();
          lastPlayedPhaseRef.current = null;
          setLessonStarted(true);
          setAutoplayEnabled(true);
          return true;
        case 'skipToQuiz':
          skipToQuiz();
          return true;
        case 'continue':
          // Before the lesson starts, Continue is the START button.
          if (!lessonStarted) {
            handleLessonStart();
            return true;
          }
          skipNext();
          return true;
        case 'mcqSelect':
          handleMCQOptionSelect(action.index);
          return true;
        case 'mcqSubmit':
        case 'mcqNext':
          handleMCQNext();
          return true;
        case 'directClassView':
          void classroomRef.current.directClassToCurrentView();
          return true;
        case 'model':
        case 'panelGrab':
        case 'panelResize':
          // Model tools and panel manipulation are krpano-only for now; the
          // renderer only draws them when modelPartCount says there is
          // separable geometry, which this player reports as 0.
          return true;
        default:
          return false;
      }
    },
    [
      stopAudio,
      toggleAudio,
      skipToQuiz,
      skipNext,
      lessonStarted,
      handleLessonStart,
      handleMCQOptionSelect,
      handleMCQNext,
    ]
  );

  // Same reason as classroomRef: the canvas pointer handler and the VR
  // controller ray are wired up in the scene-init effect, long before the
  // lesson data arrives. They read this ref so they always call the CURRENT
  // handler rather than the one that existed when they were created.
  lessonPanelUvRef.current = handleLessonPanelUv;
  
  // ============================================================================
  // Create VR MCQ Quiz Panel UI
  // ============================================================================
  


  
  
  // ============================================================================
  // 3D Model Reset & Focus Functions
  // ============================================================================
  
  
  
  
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
  
  // NOTE: there is deliberately no "VR required" dead end here any more.
  //
  // This used to return early whenever immersive-vr was unsupported, which
  // unmounted the canvas container — so containerRef stayed null, the scene
  // never initialised, and the log filled with "Waiting for container ref...".
  // It also made it impossible for a teacher to drive a V3 class from a desktop,
  // which is where teachers actually are. The scene renders perfectly well flat,
  // and drag-to-look now gives a mouse and touch user a real camera, so a
  // headset is an upgrade rather than a requirement. The banner below says so.

  // PlayerChrome reads these from the player ROOT (inline custom properties do
  // not reach siblings). Without them both bars collapse to zero height and
  // every control on them becomes unclickable.
  const hudMetrics = {
    '--hud-top': `calc(${playerViewport.isCompact ? '3.25rem' : '3.5rem'} + env(safe-area-inset-top, 0px))`,
    '--hud-bottom': `calc(${playerViewport.isCompact ? '3.75rem' : '4rem'} + env(safe-area-inset-bottom, 0px))`,
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 bg-black" style={hudMetrics}>
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Comfort break. Dismissible, never blocking: a student can carry on, but
          the prompt is there, which is the point of the published guidance. */}
      {comfortBreak.due && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--hud-top)+1rem)] z-gate flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-amber-300/30 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold">Time for a short break</p>
            <p className="mt-1 text-xs leading-snug text-white/60">
              You have been in the headset for about {comfortBreak.immersedMinutes} minutes.
              Take it off for a moment, look at something far away, then carry on.
            </p>
            <button
              type="button"
              onClick={comfortBreak.acknowledge}
              className="mt-3 w-full rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Flat-mode notice. Informational only: the lesson is fully usable here. */}
      {isVRSupported === false && !classroom.isClassHost && !classroom.isStudentInSession && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/85 px-4 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            <Glasses className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Drag to look around. Open on a Meta Quest headset for the immersive version.</span>
          </div>
        </div>
      )}

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
      
      
      
      {/* Waiting for START indicator in VR */}
      {loadingState === 'in-vr' && lessonPhase === 'idle' && !lessonStarted && (
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
      
      
      {/* Lesson Completion Screen */}
      {lessonPhase === 'completed' && (
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
      
      
      

      {/* ------------------------------------------------------------------
          Live class. Every one of these components is player-agnostic and is
          already used by the krpano player; only the wiring is new here.
          Hidden while presenting in a headset, where DOM overlays cannot be
          seen and the in-scene panels take over.
          ------------------------------------------------------------------ */}
      {classroom.isClassHost && (
        <LiveClassHostOverlay
          session={classroom.activeSession}
          sessionId={classroom.hostSessionId}
          hostUid={user?.uid ?? null}
          progressList={classroom.progressList}
          sessionCode={classroom.hostSessionCode}
          skyboxUrlOverride={skyboxUrl}
          openDrawer={hostDrawer}
          onDrawerChange={setHostDrawer}
        />
      )}

      {/* Waiting room: the scene is loaded and silent until the teacher starts. */}
      {classroom.isStudentInSession &&
        classroom.controlStudentsEnabled &&
        isSceneReady &&
        !classroom.classStarted && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[45] flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-cyan-400/25 bg-slate-950/85 p-4 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
                <p className="text-sm font-semibold">Waiting for your teacher</p>
              </div>
              <p className="mt-1 text-xs leading-snug text-white/55">
                The lesson will begin when your teacher starts the class.
              </p>

              {Array.isArray(classroom.joinedSession?.lobby_roster) &&
                classroom.joinedSession.lobby_roster.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      In the class ({classroom.joinedSession.lobby_roster.length})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {classroom.joinedSession.lobby_roster.slice(0, 12).map((member) => (
                        <span
                          key={member.uid}
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${
                            member.ready
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                              : 'border-white/10 bg-white/[0.05] text-white/50'
                          }`}
                        >
                          {member.name}
                        </span>
                      ))}
                      {classroom.joinedSession.lobby_roster.length > 12 && (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/50">
                          +{classroom.joinedSession.lobby_roster.length - 12} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

              <button
                type="button"
                onClick={classroom.toggleHandRaised}
                className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  classroom.handRaised
                    ? 'border-amber-300/40 bg-amber-400/20 text-amber-100'
                    : 'border-white/12 bg-white/[0.05] text-white/70 hover:bg-white/10'
                }`}
              >
                <Hand className="h-3.5 w-3.5" />
                {classroom.handRaised ? 'Lower hand' : 'Raise hand'}
              </button>
            </div>
          </div>
        )}

      {/* The only chrome. Exit, title, progress, narration controls and the class
          controls all live in these two bars, which is why the seven overlays
          that used to sit on top of them are gone. */}
      {loadingState !== 'in-vr' && (
        <PlayerChrome
          topBar={
            <PlayerTopBar
              onExit={() => navigate('/lessons')}
              title={lessonData?.topic?.topic_name || 'Lesson'}
              subtitle={`${lessonData?.chapter?.subject || ''} · ${lessonPhase}`}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              showChat={false}
              onToggleChat={() => {}}
              chatAvailable={false}
              compact={playerViewport.isCompact}
              isHost={classroom.isClassHost}
              sessionCode={classroom.hostSessionCode}
              liveCount={classroom.rosterCounts.inLesson}
              joinedCount={classroom.rosterCounts.joined}
              classCount={classroom.enrolledCount}
              pendingCount={classroom.pendingJoinCount}
              onCopyCode={async () => {
                if (!classroom.hostSessionCode) return;
                try {
                  await navigator.clipboard.writeText(classroom.hostSessionCode);
                  toast.success('Class code copied');
                } catch {
                  toast.error('Could not copy class code');
                }
              }}
              onOpenApprovals={() =>
                setHostDrawer((d) => (d === 'approvals' ? null : 'approvals'))
              }
              endSessionConfirming={endSessionConfirming}
              onEndSession={
                classroom.isClassHost && endClassSession
                  ? async () => {
                      // Two-step, in-app. window.confirm() returns false outright
                      // in browsers that suppress dialogs, which would make End
                      // silently do nothing.
                      if (!endSessionConfirming) {
                        setEndSessionConfirming(true);
                        window.setTimeout(() => setEndSessionConfirming(false), 4000);
                        return;
                      }
                      setEndSessionConfirming(false);
                      const endedSessionId = classroom.hostSessionId;
                      const ok = await endClassSession(endedSessionId ?? undefined);
                      if (ok) {
                        if (endedSessionId) navigate(`/class-session/${endedSessionId}/results`);
                        else navigate('/lessons');
                      } else {
                        toast.error('Could not end the session, it is still live.');
                      }
                    }
                  : undefined
              }
            />
          }
          bottomBar={
            <PlayerBottomBar
              isHost={classroom.isClassHost}
              compact={playerViewport.isCompact}
              playbackState={classroom.teacherPlayback?.state ?? 'idle'}
              currentPhase={lessonPhase}
              onPlaybackCommand={classroom.handleTeacherPlaybackCommand}
              onLocalPlayToggle={toggleAudio}
              isPlayingAudio={ttsState === 'playing'}
              playbackLocked={classroom.isStudentInSession && classroom.controlStudentsEnabled}
              controlStudentsEnabled={classroom.controlStudentsEnabled}
              onToggleControl={(next) => void classroom.toggleControl(next)}
              classStarted={classroom.classStarted}
              studentUiVisible={classroom.studentUiVisible}
              onToggleStudentUi={(visible) => void classroom.toggleStudentUi(visible)}
              onForceStudentsIn={() => void classroom.forceStudentsIn()}
              canForce={Boolean(
                classroom.activeSession?.launched_lesson || classroom.activeSession?.launched_scene
              )}
              onDirectView={() => void classroom.directClassToCurrentView()}
              liveCount={classroom.rosterCounts.joined}
              onOpenRoster={() => setHostDrawer((d) => (d === 'roster' ? null : 'roster'))}
              raisedHands={classroom.raisedHandCount}
              markerActive={markerActive}
              markerColor={markerColor}
              onToggleMarker={() => setMarkerActive((v) => !v)}
              onMarkerColorChange={setMarkerColor}
            />
          }
        />
      )}
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
