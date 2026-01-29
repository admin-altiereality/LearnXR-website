/**
 * VR Lesson Player - Full immersive lesson experience
 * 
 * Features:
 * - Interactive 360° skybox background
 * - 3D asset display with platform-aware loading (Android: FBX/GLB, iOS: USDZ)
 * - Avatar with pre-generated TTS narration from Firestore
 * - NO runtime TTS generation - uses stored audio URLs only
 * - Assistant chat for Q&A
 * - MCQ flow after lesson
 * - Comprehensive error handling
 * - Simple voiceover player UI (Play/Pause/Stop)
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy, Component, ReactNode, ErrorInfo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAuth } from '../contexts/AuthContext';
import { useLesson, LessonPhase } from '../contexts/LessonContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { trackLessonLaunch, saveQuizScore, updateLessonLaunch } from '../services/lessonTrackingService';
import { getApiBaseUrl } from '../utils/apiConfig';
import api from '../config/axios';
import { getChapterTTS, getMeshyAssets, getChapterMCQs } from '../lib/firestore/queries';
import type { ChapterTTS, MeshyAsset, ChapterMCQ } from '../types/curriculum';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  MessageSquare,
  X,
  Send,
  BookOpen,
  CheckCircle,
  XCircle,
  Award,
  ArrowRight,
  RefreshCw,
  Loader2,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Home,
  HelpCircle,
  Lightbulb,
  LogOut,
  Move,
  AlertTriangle,
  RefreshCcw,
  SkipForward,
} from 'lucide-react';

// ============================================================================
// Error Boundary Component
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class VRPlayerErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔴 VR Player Error Boundary caught error:', error);
    console.error('🔴 Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-red-500/30 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-4">
              The VR Lesson Player encountered an error.
            </p>
            
            <div className="mb-4 p-3 bg-slate-800/50 rounded-lg text-left overflow-auto max-h-40">
              <p className="text-xs text-red-400 font-mono break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  this.props.onReset?.();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                         text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700"
              >
                <RefreshCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/studio/content'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                         text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg"
              >
                <Home className="w-4 h-4" />
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load TeacherAvatar
const TeacherAvatar = lazy(() => 
  import('../Components/TeacherAvatar')
    .then(m => ({ default: m.TeacherAvatar }))
    .catch(err => {
      console.error('Failed to load TeacherAvatar:', err);
      return { default: () => <div className="text-red-400 text-xs p-2">Avatar failed to load</div> };
    })
);

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SkyboxData {
  id: string;
  imageUrl: string;
  file_url?: string;
  promptUsed?: string;
  status?: string;
}

interface LessonProgress {
  lessonId: string;
  currentPhase: LessonPhase;
  scriptIndex: number;
  mcqAnswers: Record<string, number>;
  completedAt?: string;
  score?: { correct: number; total: number };
}

interface TTSData {
  id: string;
  section: string;
  audioUrl: string;
  text?: string;
}

// ============================================================================
// Debug Logger
// ============================================================================

const DEBUG = true;

const log = (emoji: string, message: string, data?: any) => {
  if (DEBUG) {
    if (data !== undefined) {
      console.log(`${emoji} [VRPlayer] ${message}`, data);
    } else {
      console.log(`${emoji} [VRPlayer] ${message}`);
    }
  }
};

// ============================================================================
// Platform Detection - For 3D Asset Format Selection
// ============================================================================

type Platform = 'android' | 'ios' | 'web' | 'unknown';

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent.toLowerCase();
  
  // Check for Meta Quest / Android
  if (ua.includes('oculus') || ua.includes('quest') || ua.includes('android')) {
    return 'android';
  }
  
  // Check for iOS
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || 
      (ua.includes('macintosh') && 'ontouchend' in document)) {
    return 'ios';
  }
  
  return 'web';
};

/**
 * Select the best 3D asset URL based on platform
 * Android/Quest: Prefer FBX, fallback to GLB
 * iOS: Prefer USDZ, fallback to GLB
 * Web: Use GLB
 */
const selectPlatformAssetUrl = (asset: MeshyAsset | null, platform: Platform): string | null => {
  if (!asset) return null;
  
  switch (platform) {
    case 'android':
      // Android/Quest: FBX first, then GLB
      return asset.fbx_url || asset.glb_url || null;
    case 'ios':
      // iOS: USDZ first, then GLB
      return asset.usdz_url || asset.glb_url || null;
    case 'web':
    default:
      // Web: GLB is best supported
      return asset.glb_url || null;
  }
};

// ============================================================================
// TTS Audio Cache - Prevents redundant fetches
// ============================================================================

const ttsCache = new Map<string, ChapterTTS[]>();

const getCachedTTS = async (chapterId: string, topicId: string): Promise<ChapterTTS[]> => {
  const cacheKey = `${chapterId}_${topicId}`;
  
  if (ttsCache.has(cacheKey)) {
    log('📦', 'Using cached TTS data');
    return ttsCache.get(cacheKey)!;
  }
  
  log('🔍', 'Fetching TTS from Firestore...');
  const ttsData = await getChapterTTS(chapterId, topicId);
  ttsCache.set(cacheKey, ttsData);
  log('✅', `Cached ${ttsData.length} TTS entries`);
  
  return ttsData;
};

// ============================================================================
// Progress Storage Helper
// ============================================================================

const PROGRESS_KEY = 'vr_lesson_progress';

const saveProgress = (lessonId: string, progress: Partial<LessonProgress>) => {
  try {
    const existing = localStorage.getItem(PROGRESS_KEY);
    const allProgress = existing ? JSON.parse(existing) : {};
    allProgress[lessonId] = { ...allProgress[lessonId], ...progress, lessonId };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
  } catch (e) {
    console.warn('Could not save progress:', e);
  }
};

const loadProgress = (lessonId: string): LessonProgress | null => {
  try {
    const existing = localStorage.getItem(PROGRESS_KEY);
    if (existing) {
      const allProgress = JSON.parse(existing);
      return allProgress[lessonId] || null;
    }
  } catch (e) {
    console.warn('Could not load progress:', e);
  }
  return null;
};

// ============================================================================
// Skybox Fetching from Firestore
// ============================================================================

const fetchSkyboxFromFirestore = async (skyboxId: string): Promise<SkyboxData | null> => {
  try {
    log('🔍', 'Fetching skybox from Firestore:', skyboxId);
    const skyboxRef = doc(db, 'skyboxes', skyboxId);
    const skyboxSnap = await getDoc(skyboxRef);
    
    if (skyboxSnap.exists()) {
      const data = skyboxSnap.data();
      const imageUrl = data.file_url || data.image_jpg || data.image || '';
      log('✅', 'Skybox found:', { id: skyboxId, hasUrl: !!imageUrl });
      return {
        id: skyboxId,
        imageUrl,
        file_url: data.file_url,
        promptUsed: data.prompt || data.title || '',
        status: data.status || 'complete',
      };
    }
    log('❌', 'Skybox not found:', skyboxId);
    return null;
  } catch (error) {
    console.error('Error fetching skybox:', error);
    return null;
  }
};

// ============================================================================
// 360° Skybox Sphere Component
// ============================================================================

function SkyboxSphere({ imageUrl, onLoad, onError }: { imageUrl: string; onLoad?: () => void; onError?: (err: any) => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      log('⚠️', 'No skybox URL provided');
      return;
    }

    log('🖼️', 'Loading skybox texture:', imageUrl.substring(0, 80));
    
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    
    loader.load(
      imageUrl,
      (tex) => {
        log('✅', 'Skybox texture loaded successfully');
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;
        setTexture(tex);
        onLoad?.();
      },
      undefined,
      (error) => {
        console.error('Failed to load skybox texture:', error);
        setLoadError(true);
        onError?.(error);
      }
    );

    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [imageUrl]);

  if (loadError || !texture) return null;

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

// ============================================================================
// 3D Asset Model Component
// ============================================================================

function AssetModel({ 
  url, 
  position = [0, 0, -5], 
  scale = 1.5,
  onLoad,
  onError 
}: { 
  url: string; 
  position?: [number, number, number]; 
  scale?: number;
  onLoad?: () => void;
  onError?: (error: any) => void;
}) {
  const modelRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!url) {
      log('⚠️', 'No 3D asset URL provided');
      setLoading(false);
      return;
    }

    let loadUrl = url;
    if (url.includes('assets.meshy.ai')) {
      const apiBaseUrl = getApiBaseUrl();
      loadUrl = `${apiBaseUrl}/proxy-asset?url=${encodeURIComponent(url)}`;
      log('🔄', 'Using proxy for Meshy asset');
    }

    log('📦', 'Loading 3D model:', loadUrl.substring(0, 80));

    const loader = new GLTFLoader();
    loader.load(
      loadUrl,
      (gltf) => {
        log('✅', '3D model loaded successfully');
        
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const modelScale = maxDim > 0 ? 2 / maxDim : 1;
        
        gltf.scene.position.set(-center.x * modelScale, -center.y * modelScale, -center.z * modelScale);
        gltf.scene.scale.setScalar(modelScale * scale);
        
        setModel(gltf.scene);
        setLoading(false);
        onLoad?.();
      },
      undefined,
      (error) => {
        console.error('Failed to load 3D model:', error);
        setLoading(false);
        onError?.(error);
      }
    );
  }, [url, scale, onLoad, onError]);

  useFrame((_, delta) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += delta * 0.3;
    }
  });

  if (loading) {
    return (
      <Html center>
        <div className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading 3D Asset...
        </div>
      </Html>
    );
  }

  if (!model) return null;

  return (
    <group ref={modelRef} position={position}>
      <primitive object={model} />
    </group>
  );
}

// ============================================================================
// 3D Scene Component
// ============================================================================

function LessonScene({ 
  skyboxUrl, 
  assetUrl,
  onSkyboxLoad,
  onSkyboxError,
  onAssetLoad,
  onAssetError,
}: { 
  skyboxUrl?: string; 
  assetUrl?: string;
  onSkyboxLoad?: () => void;
  onSkyboxError?: (err: any) => void;
  onAssetLoad?: () => void;
  onAssetError?: (error: any) => void;
}) {
  return (
    <>
      {skyboxUrl && (
        <SkyboxSphere imageUrl={skyboxUrl} onLoad={onSkyboxLoad} onError={onSkyboxError} />
      )}

      {assetUrl && (
        <AssetModel 
          url={assetUrl} 
          onLoad={onAssetLoad}
          onError={onAssetError}
        />
      )}

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={-0.5}
        minDistance={0.1}
        maxDistance={100}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.9}
      />

      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} />
    </>
  );
}

// ============================================================================
// Voiceover Player Component - Simple UI for TTS Playback
// ============================================================================

interface VoiceoverPlayerProps {
  audioUrl: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
}

const VoiceoverPlayer = ({
  audioUrl,
  isPlaying,
  isPaused,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  disabled,
  status,
}: VoiceoverPlayerProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-xl border border-white/10">
      {/* Play/Pause Button */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        disabled={disabled || !audioUrl || status === 'loading'}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${disabled || !audioUrl 
                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' 
                    : isPlaying 
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
      >
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
      
      {/* Stop Button */}
      <button
        onClick={onStop}
        disabled={disabled || status === 'idle'}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                  ${disabled || status === 'idle'
                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  }`}
      >
        <Square className="w-3.5 h-3.5" />
      </button>
      
      {/* Progress Bar */}
      <div className="flex-1 mx-2">
        <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>
      
      {/* Time Display */}
      <div className="text-[10px] text-slate-400 font-mono min-w-[60px] text-right">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
      
      {/* Status Indicator */}
      {status === 'error' && (
        <div className="flex items-center gap-1 text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      )}
      
      {!audioUrl && status !== 'loading' && (
        <div className="flex items-center gap-1 text-slate-500">
          <VolumeX className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TTS Status Indicator Component
// ============================================================================

const TTSStatusIndicator = ({ 
  status,
  scriptType,
}: { 
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  scriptType?: string;
}) => {
  if (status === 'idle') return null;
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-lg border border-white/10">
      {status === 'loading' && (
        <>
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <p className="text-[10px] text-cyan-300 font-medium">Loading audio...</p>
        </>
      )}
      
      {status === 'playing' && (
        <>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-emerald-400 rounded-full"
                animate={{ height: [6, 12, 6] }}
                transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.08 }}
              />
            ))}
          </div>
          <p className="text-[10px] text-emerald-300 font-medium">
            {scriptType ? `Playing ${scriptType}` : 'Playing...'}
          </p>
        </>
      )}
      
      {status === 'paused' && (
        <>
          <Pause className="w-4 h-4 text-amber-400" />
          <p className="text-[10px] text-amber-300 font-medium">Paused</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-[10px] text-red-300 font-medium">TTS not available</p>
        </>
      )}
      
      {status === 'ready' && (
        <>
          <Volume2 className="w-4 h-4 text-slate-400" />
          <p className="text-[10px] text-slate-400 font-medium">Audio ready</p>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const VRLessonPlayerInner = () => {
  
  // Initialize React Router hooks
  let navigate: ReturnType<typeof useNavigate>;
  try {
    navigate = useNavigate();
  } catch (e) {
    throw new Error('Failed to initialize navigation');
  }
  
  // Initialize Auth context
  let user: any = null;
  let profile: any = null;
  try {
    const authContext = useAuth();
    user = authContext?.user ?? null;
    profile = authContext?.profile ?? null;
  } catch (e) {
    // Continue without user - some features won't work
  }
  
  // Initialize Lesson context with defensive access
  let lessonContext: ReturnType<typeof useLesson> | null = null;
  try {
    lessonContext = useLesson();
  } catch (e) {
    // Will use sessionStorage fallback
  }

  // Extract from context with safety - use stable defaults
  const activeLesson = lessonContext?.activeLesson ?? null;
  const lessonPhase = lessonContext?.lessonPhase ?? 'idle';
  const currentScriptIndex = lessonContext?.currentScriptIndex ?? 0;
  const setPhase = lessonContext?.setPhase ?? (() => {});
  const advanceScript = lessonContext?.advanceScript ?? (() => {});
  const hasNextScript = lessonContext?.hasNextScript ?? (() => false);
  const endLesson = lessonContext?.endLesson ?? (() => {});
  const submitQuizResults = lessonContext?.submitQuizResults ?? (() => {});

  // Initialize all state hooks BEFORE any conditional logic
  const [extraLessonData, setExtraLessonData] = useState<any>(null);
  const [dataInitialized, setDataInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initPhase, setInitPhase] = useState<'starting' | 'loading-storage' | 'validating' | 'ready' | 'error'>('starting');

  // Load extra lesson data from sessionStorage on mount
  useEffect(() => {
    const initializeData = async () => {
      setInitPhase('loading-storage');
      
      try {
        // Give a small delay for context to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check sessionStorage
        const stored = sessionStorage.getItem('activeLesson');
        
        if (stored) {
          setInitPhase('validating');
          
          try {
            const parsed = JSON.parse(stored);
            
            // Validate the parsed data
            if (parsed && typeof parsed === 'object') {
              const hasChapter = !!(parsed.chapter && parsed.chapter.chapter_id);
              const hasTopic = !!(parsed.topic && parsed.topic.topic_id);
              
              if (hasChapter && hasTopic) {
                setExtraLessonData(parsed);
              }
            }
          } catch (parseErr) {
            console.error('JSON parse error:', parseErr);
          }
        }
        
        setInitPhase('ready');
        setDataInitialized(true);
        
      } catch (e) {
        console.error('Data init error:', e);
        setInitError('Failed to load lesson data');
        setInitPhase('error');
        setDataInitialized(true);
      }
    };
    
    initializeData();
  }, []); // Empty dependency - run once on mount
  
  // Compute if lesson data is valid
  const isLessonDataValid = useMemo(() => {
    const fromContext = !!(activeLesson?.chapter?.chapter_id && activeLesson?.topic?.topic_id);
    const fromStorage = !!(extraLessonData?.chapter?.chapter_id && extraLessonData?.topic?.topic_id);
    return fromContext || fromStorage;
  }, [activeLesson, extraLessonData]);
  
  // Get the best available lesson data (context takes priority)
  const effectiveLesson = useMemo(() => {
    if (activeLesson?.chapter?.chapter_id && activeLesson?.topic?.topic_id) {
      return activeLesson;
    }
    if (extraLessonData?.chapter && extraLessonData?.topic) {
      return {
        chapter: extraLessonData.chapter,
        topic: extraLessonData.topic,
        startedAt: extraLessonData.startedAt || new Date().toISOString(),
      };
    }
    return null;
  }, [activeLesson, extraLessonData]);

  // Refs
  const avatarRef = useRef<{ sendMessage: (text: string) => Promise<void> } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Skybox State
  const [skyboxData, setSkyboxData] = useState<SkyboxData | null>(null);
  const [skyboxLoading, setSkyboxLoading] = useState(true);
  const [skyboxError, setSkyboxError] = useState<string | null>(null);

  // Asset State - Platform-aware
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [meshyAssets, setMeshyAssets] = useState<MeshyAsset[]>([]);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const platform = useMemo(() => detectPlatform(), []);

  // Lesson Ready State - Wait for user to click Start (NO auto-play)
  const [lessonReady, setLessonReady] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  
  // TTS State - Pre-generated audio from Firestore (NO runtime generation)
  const [ttsData, setTtsData] = useState<TTSData[]>([]);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentVisemes, setCurrentVisemes] = useState<any[]>([]);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [userPaused, setUserPaused] = useState(false); // Track if user manually paused
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // Prevent echo/double play
  const [lessonStage, setLessonStage] = useState<'intro' | 'explanation' | 'outro' | 'quiz' | 'completed'>('intro');
  const [waitingForUser, setWaitingForUser] = useState(false); // Wait for user to click "Continue"

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // MCQ State - Fetched from chapter_mcqs collection
  const [fetchedMCQs, setFetchedMCQs] = useState<ChapterMCQ[]>([]);
  const [mcqsLoading, setMcqsLoading] = useState(false);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [showMcqResult, setShowMcqResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // UI State
  const [showDragHint, setShowDragHint] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);

  // LMS Tracking State
  const [currentLaunchId, setCurrentLaunchId] = useState<string | null>(null);
  const [lessonStartTime, setLessonStartTime] = useState<number | null>(null);

  // Derived State
  const lessonId = activeLesson ? `${activeLesson.chapter?.chapter_id || 'unknown'}_${activeLesson.topic?.topic_id || 'unknown'}` : '';
  const scripts = activeLesson?.topic
    ? [
        activeLesson.topic.avatar_intro,
        activeLesson.topic.avatar_explanation,
        activeLesson.topic.avatar_outro,
      ].filter(Boolean) as string[]
    : [];
  const currentScript = scripts[currentScriptIndex] || '';
  
  // Use fetched MCQs, fallback to embedded MCQs from lesson data
  const mcqs = useMemo(() => {
    if (fetchedMCQs.length > 0) {
      // Convert ChapterMCQ to the format expected by the MCQ UI
      // Handle various field formats that might exist in Firestore
      return fetchedMCQs.map(mcq => {
        // Handle different possible formats for options
        let options: string[] = [];
        if (Array.isArray(mcq.options) && mcq.options.length > 0) {
          options = mcq.options;
        } else if ((mcq as any).choices && Array.isArray((mcq as any).choices)) {
          // Some MCQs might use "choices" instead of "options"
          options = (mcq as any).choices;
        } else if ((mcq as any).answers && Array.isArray((mcq as any).answers)) {
          // Some MCQs might use "answers"
          options = (mcq as any).answers;
        } else {
          // Try to extract options from individual fields (option_a, option_b, etc.)
          const extractedOptions: string[] = [];
          const mcqAny = mcq as any;
          ['option_a', 'option_b', 'option_c', 'option_d', 'option1', 'option2', 'option3', 'option4'].forEach(key => {
            if (mcqAny[key]) extractedOptions.push(mcqAny[key]);
          });
          if (extractedOptions.length > 0) {
            options = extractedOptions;
          }
        }
        
        // Handle correct answer index
        let rawIndex = mcq.correct_option_index ?? 0;
        if (typeof rawIndex !== 'number') {
          rawIndex = parseInt(String(rawIndex), 10) || 0;
        }
        // Handle if correct answer is stored with alternate field name
        if ((mcq as any).correct_answer_index !== undefined) {
          rawIndex = (mcq as any).correct_answer_index;
        }
        // Handle if correct answer is stored as letter (A, B, C, D)
        const correctLetter = (mcq as any).correct_answer || (mcq as any).correct_option;
        if (typeof correctLetter === 'string' && correctLetter.length === 1) {
          const letterIndex = correctLetter.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
          if (letterIndex >= 0 && letterIndex < options.length) {
            rawIndex = letterIndex; // Already 0-based from letter conversion
          }
        } else {
          // CRITICAL FIX: Convert 1-based DB index to 0-based frontend index
          // DB stores: 1=A, 2=B, 3=C, 4=D; Frontend expects: 0=A, 1=B, 2=C, 3=D
          if (rawIndex >= 1 && rawIndex <= options.length) {
            rawIndex = rawIndex - 1;
          }
        }
        
        // Validate bounds
        const correctIndex = Math.max(0, Math.min(rawIndex, options.length - 1));

        return {
          id: mcq.id || `mcq_${Math.random().toString(36).substr(2, 9)}`,
          question: mcq.question || (mcq as any).question_text || '',
          options: options,
          correctAnswer: correctIndex, // 0-based index for frontend
          explanation: mcq.explanation || (mcq as any).explanation_text || '',
        };
      }).filter(mcq => mcq.question && mcq.options.length > 0); // Only include valid MCQs
    }
    // Fallback to embedded MCQs - apply same conversion
    const embeddedMcqs = activeLesson?.topic?.mcqs || [];
    return embeddedMcqs
      .filter((mcq: any) => mcq.question && mcq.options?.length > 0)
      .map((mcq: any) => {
        const options = mcq.options || [];
        let rawIdx = mcq.correct_option_index ?? 0;
        if (typeof rawIdx !== 'number') rawIdx = parseInt(String(rawIdx), 10) || 0;
        // Convert 1-based to 0-based if needed
        if (rawIdx >= 1 && rawIdx <= options.length) {
          rawIdx = rawIdx - 1;
        }
        return {
          ...mcq,
          correctAnswer: Math.max(0, Math.min(rawIdx, options.length - 1)),
        };
      });
  }, [fetchedMCQs, activeLesson]);
  
  const currentMcq = mcqs[currentMcqIndex];
  
  // Debug log for MCQs
  useEffect(() => {
    if (mcqs.length > 0) {
      log('📝', `Loaded ${mcqs.length} MCQs`, mcqs.map(m => ({ 
        id: m.id, 
        question: m.question?.substring(0, 50),
        optionsCount: m.options?.length 
      })));
    }
  }, [mcqs]);

  // ============================================================================
  // Initialize Thread for Chat
  // ============================================================================

  useEffect(() => {
    const initThread = async () => {
      if (!activeLesson || threadId) return;
      
      try {
        log('🔗', 'Creating chat thread...');
        const res = await api.post('/assistant/create-thread', {
          curriculum: activeLesson.chapter?.curriculum,
          class: activeLesson.chapter?.class_name,
          subject: activeLesson.chapter?.subject,
          useAvatarKey: true,
        });
        setThreadId(res.data.threadId);
        log('✅', 'Chat thread initialized:', res.data.threadId);
      } catch (error: any) {
        console.error('Failed to initialize chat thread:', error);
        log('❌', 'Thread creation failed:', error.message);
      }
    };
    
    initThread();
  }, [activeLesson, threadId]);

  // ============================================================================
  // Fetch MCQs from Firestore (chapter_mcqs collection)
  // ============================================================================

  useEffect(() => {
    const fetchMCQs = async () => {
      // Check topic level (new) first, then root level (old), then context
      const lessonLanguage = extraLessonData?.topic?.language || extraLessonData?.language || activeLesson?.topic?.language || 'en';
      
      // Priority 1: Check sessionStorage for embedded MCQs (from bundle)
      if (extraLessonData?.topic?.mcqs && Array.isArray(extraLessonData.topic.mcqs)) {
        const mcqs = extraLessonData.topic.mcqs;
        if (mcqs.length > 0) {
          // Convert to ChapterMCQ format
          const convertedMCQs: ChapterMCQ[] = mcqs.map((mcq: any) => ({
            id: mcq.id || '',
            question: mcq.question || '',
            options: Array.isArray(mcq.options) ? mcq.options : [],
            correct_option_index: mcq.correct_option_index ?? 0,
            explanation: mcq.explanation || '',
            language: lessonLanguage,
          }));
          
          log('✅', `Using ${convertedMCQs.length} embedded MCQs from sessionStorage (language: ${lessonLanguage})`);
          setFetchedMCQs(convertedMCQs);
          setMcqsLoading(false);
          return;
        }
      }
      
      // Priority 2: Check activeLesson context for embedded MCQs
      if (activeLesson?.topic?.mcqs && Array.isArray(activeLesson.topic.mcqs) && activeLesson.topic.mcqs.length > 0) {
        const convertedMCQs: ChapterMCQ[] = activeLesson.topic.mcqs.map((mcq: any) => ({
          id: mcq.id || '',
          question: mcq.question || '',
          options: Array.isArray(mcq.options) ? mcq.options : [],
          correct_option_index: mcq.correct_option_index ?? 0,
          explanation: mcq.explanation || '',
          language: lessonLanguage,
        }));
        
        log('✅', `Using ${convertedMCQs.length} embedded MCQs from context (language: ${lessonLanguage})`);
        setFetchedMCQs(convertedMCQs);
        setMcqsLoading(false);
        return;
      }
      
      // Priority 3: Fetch from Firestore
      if (!activeLesson?.chapter?.chapter_id || !activeLesson?.topic?.topic_id) {
        log('⚠️', 'Cannot fetch MCQs: missing chapter or topic ID');
        setMcqsLoading(false);
        return;
      }
      
      setMcqsLoading(true);
      
      try {
        const chapterId = activeLesson.chapter.chapter_id;
        const topicId = activeLesson.topic.topic_id;
        
        log('📝', 'Fetching MCQs from Firestore...', { chapterId, topicId, language: lessonLanguage });
        
        const mcqData = await getChapterMCQs(chapterId, topicId);
        
        // Filter by language if language field exists
        const filteredMCQs = mcqData.filter((mcq: any) => {
          const mcqLang = mcq.language || 'en';
          return mcqLang === lessonLanguage;
        });
        
        if (filteredMCQs.length > 0) {
          log('✅', `Loaded ${filteredMCQs.length} MCQs from chapter_mcqs collection (language: ${lessonLanguage})`);
          setFetchedMCQs(filteredMCQs);
        } else {
          log('⚠️', `No MCQs found in Firestore for language: ${lessonLanguage}`);
          setFetchedMCQs([]);
        }
      } catch (error) {
        console.error('Failed to fetch MCQs:', error);
        log('❌', 'MCQ fetch error:', error);
        setFetchedMCQs([]);
      } finally {
        setMcqsLoading(false);
      }
    };
    
    fetchMCQs();
  }, [activeLesson, extraLessonData]);

  // ============================================================================
  // Fetch Skybox
  // ============================================================================

  useEffect(() => {
    const loadSkybox = async () => {
      if (!activeLesson?.topic) {
        setSkyboxLoading(false);
        return;
      }
      
      setSkyboxLoading(true);
      setSkyboxError(null);
      
      const topic = activeLesson.topic;
      
      if (topic.skybox_url) {
        setSkyboxData({
          id: topic.skybox_id || 'direct_url',
          imageUrl: topic.skybox_url,
          file_url: topic.skybox_url,
          status: 'complete',
        });
        setSkyboxLoading(false);
        return;
      }
      
      if (topic.skybox_id) {
        const data = await fetchSkyboxFromFirestore(topic.skybox_id);
        if (data) {
          setSkyboxData(data);
        } else {
          setSkyboxError('Skybox not found');
        }
        setSkyboxLoading(false);
        return;
      }
      
      setSkyboxLoading(false);
    };
    
    loadSkybox();
  }, [activeLesson]);

  // ============================================================================
  // Fetch 3D Asset (Platform-aware: FBX for Android, USDZ for iOS, GLB for Web)
  // ============================================================================

  useEffect(() => {
    const loadAsset = () => {
      if (!activeLesson) return;
      
      let selectedUrl: string | null = null;
      
      // Priority 1: Check image3dasset from extraLessonData (image-to-3D converted models with multiple formats)
      const img3d = extraLessonData?.image3dasset;
      if (img3d) {
        log('📦', '3D Asset: Found image3dasset, selecting by platform:', platform);
        
        if (platform === 'android') {
          // Android/Meta Quest: prefer FBX, fallback to GLB
          selectedUrl = img3d.imagemodel_fbx || img3d.imagemodel_glb || img3d.imageasset_url;
        } else if (platform === 'ios') {
          // iOS: prefer USDZ, fallback to GLB
          selectedUrl = img3d.imagemodel_usdz || img3d.imagemodel_glb || img3d.imageasset_url;
        } else {
          // Web: use GLB
          selectedUrl = img3d.imagemodel_glb || img3d.imageasset_url;
        }
        
        if (selectedUrl) {
          log('✅', `Selected ${platform} asset from image3dasset:`, selectedUrl.substring(0, 80));
          setAssetUrl(selectedUrl);
          setAssetLoading(true);
          return;
        }
      }
      
      // Priority 2: Check topic asset_urls
      if (activeLesson.topic?.asset_urls?.[0]) {
        selectedUrl = activeLesson.topic.asset_urls[0];
        log('📦', '3D Asset URL from topic.asset_urls:', selectedUrl.substring(0, 80));
        setAssetUrl(selectedUrl);
        setAssetLoading(true);
        return;
      }
      
      // Priority 3: Fetch from Meshy assets collection
      if (activeLesson.chapter?.chapter_id && activeLesson.topic?.topic_id) {
        log('🔍', 'Fetching 3D assets from meshy_assets collection...');
        getMeshyAssets(activeLesson.chapter.chapter_id, activeLesson.topic.topic_id)
          .then((assets) => {
            if (assets.length > 0) {
              const asset = assets[0];
              // Select platform-appropriate URL
              if (platform === 'android') {
                selectedUrl = asset.fbx_url || asset.glb_url;
              } else if (platform === 'ios') {
                selectedUrl = asset.usdz_url || asset.glb_url;
              } else {
                selectedUrl = asset.glb_url;
              }
              
              if (selectedUrl) {
                log('✅', `Selected ${platform} asset from meshy_assets:`, selectedUrl.substring(0, 80));
                setAssetUrl(selectedUrl);
                setAssetLoading(true);
                setMeshyAssets(assets);
              }
            } else {
              log('ℹ️', 'No 3D assets found for this lesson');
            }
          })
          .catch((err) => {
            console.error('Failed to fetch meshy assets:', err);
          });
      }
    };
    
    loadAsset();
  }, [activeLesson, platform, extraLessonData]);

  // Hide drag hint
  useEffect(() => {
    if (showDragHint && sceneReady) {
      const timer = setTimeout(() => setShowDragHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showDragHint, sceneReady]);


  // ============================================================================
  // Load Progress
  // ============================================================================

  useEffect(() => {
    if (lessonId && lessonId !== 'unknown_unknown') {
      const savedProgress = loadProgress(lessonId);
      if (savedProgress) {
        setMcqAnswers(savedProgress.mcqAnswers || {});
        log('📚', 'Restored progress:', savedProgress);
      }
    }
  }, [lessonId]);

  // ============================================================================
  // Audio Cleanup (defined early for use in other hooks)
  // ============================================================================

  // Cleanup function to properly dispose of audio
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onplay = null;
      audioRef.current.onpause = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
  }, []);

  // ============================================================================
  // NO Auto-start - Wait for user to click "Start Lesson"
  // ============================================================================

  // Track last played phase ref (declared early for use in handlers)
  const lastPlayedPhaseRef = useRef<string | null>(null);

  // Lesson only starts when user explicitly clicks the Start button
  const handleStartLesson = useCallback(async () => {
    log('▶️', 'User clicked Start Lesson');
    setShowWelcomeScreen(false);
    setLessonReady(true);
    setPhase('intro');
    setLessonStartTime(Date.now());
    // Reset the last played phase so TTS can play
    lastPlayedPhaseRef.current = null;

    // Track lesson launch for LMS
    if (profile && effectiveLesson?.chapter && effectiveLesson?.topic) {
      const launchId = await trackLessonLaunch(
        profile,
        effectiveLesson.chapter.chapter_id || '',
        effectiveLesson.topic.topic_id || '',
        effectiveLesson.chapter.curriculum || 'CBSE',
        effectiveLesson.chapter.class_name?.toString() || '',
        effectiveLesson.chapter.subject || ''
      );
      if (launchId) {
        setCurrentLaunchId(launchId);
        log('✅', 'Lesson launch tracked:', launchId);
      }
    }
  }, [setPhase, profile, effectiveLesson]);

  // Stop lesson and return to welcome screen
  const handleStopLesson = useCallback(() => {
    log('⏹️', 'User clicked Stop Lesson');
    cleanupAudio();
    setTtsStatus('ready');
    setWaitingForUser(false);
    setLessonReady(false);
    setShowWelcomeScreen(true);
    setPhase('loading');
    setCurrentMcqIndex(0);
    setMcqAnswers({});
    setShowMcqResult(false);
    setSelectedAnswer(null);
    lastPlayedPhaseRef.current = null;
  }, [cleanupAudio, setPhase]);

  // ============================================================================
  // Fetch TTS Data from Firestore (Pre-generated - NO runtime generation)
  // ============================================================================

  useEffect(() => {
    const fetchTTSData = async () => {
      if (!extraLessonData) return;
      
      // Get language from topic (primary) or root level (fallback)
      const lessonLanguage = extraLessonData?.topic?.language || extraLessonData?.language || 'en';
      
      // Get TTS audio from topic (primary) or root level (fallback)
      const ttsAudioFromStorage = extraLessonData?.topic?.ttsAudio || extraLessonData?.ttsAudio;
      if (ttsAudioFromStorage && Array.isArray(ttsAudioFromStorage)) {
        // Filter by language (strict match)
        const languageFilteredTTS = ttsAudioFromStorage.filter((tts: any) => {
          const ttsLang = (tts.language || 'en').toLowerCase().trim();
          const targetLang = lessonLanguage.toLowerCase().trim();
          return ttsLang === targetLang;
        });
        
        if (languageFilteredTTS.length > 0) {
          const convertedTTS: TTSData[] = languageFilteredTTS.map((tts: any) => ({
            id: tts.id || '',
            section: tts.script_type || tts.section || 'full',
            audioUrl: tts.audio_url || tts.audioUrl || tts.url || '',
            text: tts.text || tts.script_text || '',
          }));
          
          setTtsData(convertedTTS);
          setTtsStatus('ready');
          log('✅', `Loaded ${convertedTTS.length} TTS entries from bundle (language: ${lessonLanguage})`, {
            ttsDetails: convertedTTS.map(t => ({ id: t.id, section: t.section, hasAudio: !!t.audioUrl })),
          });
          return;
        } else {
          log('⚠️', `No TTS found in bundle for language ${lessonLanguage}`, {
            totalTTS: ttsAudioFromStorage.length,
            sampleLanguages: ttsAudioFromStorage.slice(0, 3).map((t: any) => t.language || 'none'),
          });
        }
      }
      
      // Priority 2: Fetch from Firestore using IDs
      const ttsIds = extraLessonData?.topic?.tts_ids || extraLessonData?.chapter?.tts_ids || [];
      if (ttsIds.length === 0) {
        log('⚠️', 'No TTS IDs found');
        return;
      }
      
      log('🔍', `Fetching ${ttsIds.length} TTS entries for language: ${lessonLanguage}...`);
      const ttsResults: TTSData[] = [];
      
      // Filter IDs by language (check if ID contains language indicator)
      const languageTtsIds = ttsIds.filter((id: string) => {
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
              ttsResults.push({
                id: ttsId,
                section: data.section || ttsId.split('_').slice(-3, -2).join('_') || 'content',
                audioUrl: data.audio_url || data.audioUrl,
                text: data.text || data.content || '',
              });
              log('✅', `TTS loaded: ${ttsId.substring(0, 40)}... (${ttsLang})`);
            }
          }
        } catch (err) {
          log('❌', `TTS error for ${ttsId}: ${err}`);
        }
      }
      
      setTtsData(ttsResults);
      setTtsStatus(ttsResults.length > 0 ? 'ready' : 'error');
      log('✅', `Loaded ${ttsResults.length} TTS entries (language: ${lessonLanguage})`);
    };
    
    fetchTTSData();
  }, [extraLessonData]);

  // ============================================================================
  // Fetch 3D Assets from Firestore (Platform-aware)
  // ============================================================================

  useEffect(() => {
    const fetchAssets = async () => {
      // Priority 1: Check sessionStorage for 3D assets from bundle
      if (extraLessonData?.assets3d && Array.isArray(extraLessonData.assets3d) && extraLessonData.assets3d.length > 0) {
        const bundleAssets = extraLessonData.assets3d;
        log('📦', `Using ${bundleAssets.length} 3D assets from bundle`);
        
        // Convert bundle assets to MeshyAsset format
        const convertedAssets: MeshyAsset[] = bundleAssets.map((asset: any) => ({
          id: asset.id || '',
          glbUrl: asset.glb_url || asset.stored_glb_url || asset.model_urls?.glb || '',
          name: asset.name || asset.prompt || 'Asset',
          thumbnailUrl: asset.thumbnail_url || asset.thumbnailUrl || '',
          fbx_url: asset.fbx_url || asset.model_urls?.fbx,
          usdz_url: asset.usdz_url || asset.model_urls?.usdz,
        })).filter((asset: MeshyAsset) => asset.glbUrl); // Only include assets with URLs
        
        if (convertedAssets.length > 0) {
          setMeshyAssets(convertedAssets);
          const firstAssetUrl = selectPlatformAssetUrl(convertedAssets[0], platform);
          setAssetUrl(firstAssetUrl);
          log('✅', `Loaded ${convertedAssets.length} 3D assets from bundle, selected format for ${platform}`);
          setAssetLoading(false);
          return;
        }
      }
      
      // Priority 2: Check topic asset_urls from sessionStorage
      const effectiveTopic = extraLessonData?.topic || activeLesson?.topic;
      if (effectiveTopic?.asset_urls && Array.isArray(effectiveTopic.asset_urls) && effectiveTopic.asset_urls.length > 0) {
        log('📦', `Using ${effectiveTopic.asset_urls.length} asset URLs from topic`);
        setAssetUrl(effectiveTopic.asset_urls[0]);
        setAssetLoading(false);
        return;
      }
      
      // Priority 3: Check image3dasset from sessionStorage
      if (extraLessonData?.image3dasset) {
        const img3d = extraLessonData.image3dasset;
        let selectedUrl: string | null = null;
        
        if (platform === 'android') {
          selectedUrl = img3d.imagemodel_fbx || img3d.imagemodel_glb || img3d.imageasset_url;
        } else if (platform === 'ios') {
          selectedUrl = img3d.imagemodel_usdz || img3d.imagemodel_glb || img3d.imageasset_url;
        } else {
          selectedUrl = img3d.imagemodel_glb || img3d.imageasset_url;
        }
        
        if (selectedUrl) {
          log('✅', `Using image3dasset for ${platform}:`, selectedUrl.substring(0, 60));
          setAssetUrl(selectedUrl);
          setAssetLoading(false);
          return;
        }
      }
      
      // Priority 4: Fallback to Firestore fetch
      if (!activeLesson?.topic?.topic_id || !activeLesson?.chapter?.chapter_id) {
        setAssetLoading(false);
        return;
      }
      
      setAssetLoading(true);
      
      try {
        const chapterId = activeLesson.chapter.chapter_id;
        const topicId = activeLesson.topic.topic_id;
        
        log('📦', 'Fetching 3D assets from Firestore for platform:', platform);
        const assets = await getMeshyAssets(chapterId, topicId);
        
        if (assets.length > 0) {
          setMeshyAssets(assets);
          const firstAssetUrl = selectPlatformAssetUrl(assets[0], platform);
          setAssetUrl(firstAssetUrl);
          log('✅', `Loaded ${assets.length} 3D assets from Firestore, selected format for ${platform}`);
        } else {
          log('⚠️', 'No 3D assets found in Firestore');
        }
      } catch (error) {
        console.error('Failed to fetch 3D assets:', error);
        log('❌', 'Error fetching 3D assets from Firestore');
      } finally {
        setAssetLoading(false);
      }
    };
    
    fetchAssets();
  }, [activeLesson, extraLessonData, platform]);

  // ============================================================================
  // Get TTS Audio URL for Current Script Type
  // ============================================================================

  const getTTSForCurrentPhase = useCallback((): TTSData | null => {
    if (ttsData.length === 0) return null;
    
    // Map lesson phase to section (handle both 'content' and 'explanation' phases)
    let targetSection: string = 'full';
    if (lessonPhase === 'intro') targetSection = 'intro';
    else if (lessonPhase === 'explanation' || lessonPhase === 'content') targetSection = 'explanation';
    else if (lessonPhase === 'outro') targetSection = 'outro';
    
    // Find matching TTS entry (check section field)
    const match = ttsData.find(tts => {
      const ttsSection = tts.section;
      return ttsSection === targetSection;
    });
    
    if (match) {
      log('✅', `Found TTS for ${lessonPhase}: ${match.section}`);
      return match;
    }
    
    // Fallback: try 'full' type if specific not found
    const fullMatch = ttsData.find(tts => tts.section === 'full');
    if (fullMatch) return fullMatch;
    
    // Return first available
    return ttsData[0] || null;
  }, [ttsData, lessonPhase]);

  // ============================================================================
  // Audio Playback Controls (Pre-generated TTS) - SINGLE SOURCE, NO ECHO
  // ============================================================================

  const playTTS = useCallback(() => {
    // Prevent echo: don't play if already playing
    if (isPlayingAudio) {
      log('⚠️', 'Audio already playing, skipping duplicate play');
      return;
    }

    if (isMuted) {
      log('🔇', 'TTS skipped (muted)');
      // Even if muted, wait then show continue
      setWaitingForUser(true);
      return;
    }
    
    const ttsEntry = getTTSForCurrentPhase();
    if (!ttsEntry?.audioUrl) {
      log('⚠️', 'No audio URL available for current phase');
      setTtsStatus('error');
      // Still allow progression even without audio
      setWaitingForUser(true);
      return;
    }
    
    log('🎵', `Playing TTS for ${lessonPhase}:`, ttsEntry.audioUrl.substring(0, 60));
    
    // Clean up any existing audio first
    cleanupAudio();
    
    // Mark that we're starting playback
    setIsPlayingAudio(true);
    setTtsStatus('loading');
    
    const audio = new Audio();
    audioRef.current = audio;
    
    // IMPORTANT: Prevent looping
    audio.loop = false;
    
    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration);
      log('📊', `Audio duration: ${audio.duration}s`);
    };
    
    audio.ontimeupdate = () => {
      setAudioCurrentTime(audio.currentTime);
    };
    
    audio.oncanplay = () => {
      setTtsStatus('ready');
    };
    
    audio.onplay = () => {
      log('▶️', 'Audio started playing');
      setTtsStatus('playing');
      setCurrentAudioUrl(ttsEntry.audioUrl || null);
      setUserPaused(false);
    };
    
    audio.onpause = () => {
      if (!audio.ended) {
        setTtsStatus('paused');
      }
    };
    
    // CRITICAL: Handle audio end - trigger lesson progression
    audio.onended = () => {
      log('✅', `TTS ${lessonPhase} completed`);
      setTtsStatus('ready');
      setAudioCurrentTime(0);
      setCurrentAudioUrl(null);
      setCurrentVisemes([]);
      setIsPlayingAudio(false);
      
      // Wait for user to click "Continue" before progressing
      setWaitingForUser(true);
    };
    
    audio.onerror = (e) => {
      console.error('Audio playback error:', e);
      log('❌', 'Audio error, allowing progression');
      setTtsStatus('error');
      setCurrentAudioUrl(null);
      setIsPlayingAudio(false);
      // Still allow user to continue even on error
      setWaitingForUser(true);
    };
    
    // Set source and play
    audio.src = ttsEntry.audioUrl;
    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      setTtsStatus('error');
      setIsPlayingAudio(false);
      setWaitingForUser(true);
    });
  }, [isMuted, getTTSForCurrentPhase, isPlayingAudio, lessonPhase, cleanupAudio]);

  const pauseTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setUserPaused(true);
    }
  }, []);

  const stopTTS = useCallback(() => {
    cleanupAudio();
    setTtsStatus('ready');
    setAudioCurrentTime(0);
    setCurrentAudioUrl(null);
    setCurrentVisemes([]);
    setUserPaused(false);
  }, [cleanupAudio]);

  const resumeTTS = useCallback(() => {
    if (audioRef.current && ttsStatus === 'paused') {
      audioRef.current.play().catch(err => {
        console.error('Failed to resume audio:', err);
      });
      setUserPaused(false);
    }
  }, [ttsStatus]);

  // ============================================================================
  // Lesson Flow Control - Auto-play on phase change (only once per phase)
  // ============================================================================

  useEffect(() => {
    // Only auto-play if:
    // 1. Lesson has been started by user (lessonReady)
    // 2. We're in a TTS phase
    // 3. TTS data is ready
    // 4. Auto-play is enabled
    // 5. User hasn't paused
    // 6. Not muted
    // 7. We haven't already played this phase
    // 8. Not currently playing
    if (
      lessonReady &&
      ['intro', 'explanation', 'outro'].includes(lessonPhase) && 
      ttsData.length > 0 &&
      ttsStatus === 'ready' && 
      autoplayEnabled && 
      !userPaused &&
      !isMuted &&
      !isPlayingAudio &&
      lastPlayedPhaseRef.current !== lessonPhase
    ) {
      lastPlayedPhaseRef.current = lessonPhase;
      setWaitingForUser(false);
      
      // Delay to ensure UI is ready
      const timer = setTimeout(() => {
        playTTS();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [lessonReady, lessonPhase, ttsData, ttsStatus, autoplayEnabled, userPaused, isMuted, isPlayingAudio, playTTS]);

  // Reset lastPlayedPhase when changing lessons
  useEffect(() => {
    lastPlayedPhaseRef.current = null;
  }, [activeLesson]);

  const handleReplay = useCallback(() => {
    lastPlayedPhaseRef.current = null; // Allow replay
    stopTTS();
    setWaitingForUser(false);
    setTimeout(() => playTTS(), 200);
  }, [stopTTS, playTTS]);

  // Save lesson completion without quiz (when lesson ends without MCQs)
  // IMPORTANT: This must be defined BEFORE handleContinue which uses it
  const saveLessonCompletionToFirestore = useCallback(async () => {
    if (!user || !activeLesson || !profile) return;
    
    const chapterId = activeLesson.chapter?.chapter_id;
    const topicId = activeLesson.topic?.topic_id;
    
    if (!chapterId || !topicId) return;

    try {
      // Update lesson launch completion status
      if (currentLaunchId) {
        const durationSeconds = lessonStartTime ? Math.round((Date.now() - lessonStartTime) / 1000) : undefined;
        await updateLessonLaunch(currentLaunchId, 'completed', durationSeconds);
        log('✅', 'Lesson launch marked as completed');
      }

      // Legacy: Save/Update lesson progress in user_lesson_progress collection
      const progressRef = doc(db, 'user_lesson_progress', `${user.uid}_${chapterId}`);
      await setDoc(progressRef, {
        userId: user.uid,
        chapterId,
        topicId,
        curriculum: activeLesson.chapter?.curriculum,
        className: activeLesson.chapter?.class_name,
        subject: activeLesson.chapter?.subject,
        chapterName: activeLesson.chapter?.chapter_name,
        chapterNumber: activeLesson.chapter?.chapter_number,
        topicName: activeLesson.topic?.topic_name,
        completed: true,
        quizCompleted: false,
        quizScore: null,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      log('✅', 'Lesson completion saved (no quiz)');
    } catch (error) {
      console.error('Failed to save lesson completion:', error);
    }
  }, [user, profile, activeLesson, currentLaunchId, lessonStartTime]);

  // ============================================================================
  // Lesson Navigation - Progress through stages in order
  // ============================================================================

  const handleContinue = useCallback(() => {
    // Stop current audio and clean up
    cleanupAudio();
    setTtsStatus('ready');
    setWaitingForUser(false);
    lastPlayedPhaseRef.current = null; // Reset so next phase can auto-play
    
    // Determine next stage based on current lesson phase
    if (lessonPhase === 'intro') {
      log('➡️', 'Moving from intro to explanation');
      setPhase('explanation');
      advanceScript();
    } else if (lessonPhase === 'explanation') {
      log('➡️', 'Moving from explanation to outro');
      setPhase('outro');
      advanceScript();
    } else if (lessonPhase === 'outro') {
      // After outro, show MCQs if available
      if (mcqs.length > 0) {
        log('📝', 'Outro complete - showing MCQs');
        setPhase('quiz');
      } else {
        log('🎉', 'Lesson complete (no MCQs)');
        setPhase('completed');
        saveProgress(lessonId, { completedAt: new Date().toISOString() });
        // Save to Firestore for tracking completed lessons
        saveLessonCompletionToFirestore();
      }
    } else if (lessonPhase === 'quiz') {
      // This is handled by MCQ navigation
    }
  }, [lessonPhase, mcqs, setPhase, advanceScript, lessonId, cleanupAudio, saveLessonCompletionToFirestore]);

  // Legacy handler for backward compatibility
  const handleNext = handleContinue;

  // Skip to Quiz - allows user to skip intro/explanation/outro and go directly to quiz
  const handleSkipToQuiz = useCallback(() => {
    cleanupAudio();
    setTtsStatus('ready');
    setWaitingForUser(false);
    lastPlayedPhaseRef.current = null;
    
    if (mcqs.length > 0) {
      setPhase('quiz');
    } else {
      setPhase('completed');
      saveProgress(lessonId, { completedAt: new Date().toISOString() });
      saveLessonCompletionToFirestore();
    }
  }, [mcqs, setPhase, lessonId, cleanupAudio, saveLessonCompletionToFirestore]);

  // ============================================================================
  // Chat Functions with TTS
  // ============================================================================

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      if (threadId) {
        log('💬', 'Sending chat message...');
        
        const res = await api.post('/assistant/message', {
          threadId,
          message: userMessage.content,
          curriculum: activeLesson?.chapter?.curriculum,
          class: activeLesson?.chapter?.class_name,
          subject: activeLesson?.chapter?.subject,
          useAvatarKey: true,
        });

        const assistantResponse = res.data.response;
        log('✅', 'Chat response received:', assistantResponse.substring(0, 50));

        setChatMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date(),
        }]);

        // Note: Chat responses use text-only (no runtime TTS generation)
        // TTS is only available for pre-generated lesson content from Firestore
      } else {
        throw new Error('Chat thread not initialized');
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      log('❌', 'Chat error:', error.message);
      
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      if (error.response?.status === 429) {
        errorMessage = 'Rate limit reached. Please wait a moment.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication error. Please refresh the page.';
      }
      
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, activeLesson, threadId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // ============================================================================
  // MCQ Functions
  // ============================================================================

  const handleMcqSelect = (optionIndex: number) => {
    if (showMcqResult) return;
    setSelectedAnswer(optionIndex);
  };

  const handleMcqSubmit = () => {
    if (selectedAnswer === null || !currentMcq) return;
    const newAnswers = { ...mcqAnswers, [currentMcq.id]: selectedAnswer };
    setMcqAnswers(newAnswers);
    setShowMcqResult(true);
    saveProgress(lessonId, { mcqAnswers: newAnswers });
  };

  // Save quiz results and lesson completion to Firestore
  const saveQuizResultsToFirestore = useCallback(async (correct: number, total: number, answers: Record<string, number>) => {
    if (!user || !activeLesson || !profile) return;
    
    const chapterId = activeLesson.chapter?.chapter_id;
    const topicId = activeLesson.topic?.topic_id;
    
    if (!chapterId || !topicId) {
      console.warn('Cannot save quiz results: missing chapterId or topicId');
      return;
    }

    try {
      // Calculate duration if we have start time
      const durationSeconds = lessonStartTime ? Math.round((Date.now() - lessonStartTime) / 1000) : undefined;

      // 1. Save to new student_scores collection (LMS)
      const score = {
        correct,
        total,
        percentage: Math.round((correct / total) * 100),
      };

      // Get attempt number (check existing scores for this lesson)
      let attemptNumber = 1;
      try {
        const existingScoresQuery = query(
          collection(db, 'student_scores'),
          where('student_id', '==', user.uid),
          where('chapter_id', '==', chapterId),
          where('topic_id', '==', topicId)
        );
        const existingScores = await getDocs(existingScoresQuery);
        attemptNumber = existingScores.size + 1;
      } catch (e) {
        console.warn('Could not determine attempt number, using 1');
      }

      const scoreId = await saveQuizScore(
        profile,
        chapterId,
        topicId,
        activeLesson.chapter?.curriculum || 'CBSE',
        activeLesson.chapter?.class_name?.toString() || '',
        activeLesson.chapter?.subject || '',
        score,
        answers,
        attemptNumber,
        durationSeconds,
        currentLaunchId || undefined
      );

      if (scoreId) {
        log('✅', 'Quiz score saved to student_scores:', scoreId);
      }

      // 2. Also save to legacy user_quiz_results for backward compatibility
      const resultsRef = doc(db, 'user_quiz_results', `${user.uid}_${lessonId}`);
      await setDoc(resultsRef, {
        userId: user.uid,
        lessonId,
        chapterId,
        topicId,
        curriculum: activeLesson.chapter?.curriculum,
        className: activeLesson.chapter?.class_name,
        subject: activeLesson.chapter?.subject,
        topicName: activeLesson.topic?.topic_name,
        score,
        answers,
        attempt_number: attemptNumber,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      log('✅', 'Quiz results saved to user_quiz_results (legacy)');
      
      // 3. Save/Update lesson progress in user_lesson_progress collection (legacy)
      const progressRef = doc(db, 'user_lesson_progress', `${user.uid}_${chapterId}`);
      await setDoc(progressRef, {
        userId: user.uid,
        chapterId,
        topicId,
        curriculum: activeLesson.chapter?.curriculum,
        className: activeLesson.chapter?.class_name,
        subject: activeLesson.chapter?.subject,
        chapterName: activeLesson.chapter?.chapter_name,
        chapterNumber: activeLesson.chapter?.chapter_number,
        topicName: activeLesson.topic?.topic_name,
        completed: true,
        quizCompleted: total > 0,
        quizScore: total > 0 ? score : null,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      log('✅', 'Lesson progress saved to user_lesson_progress (legacy)');
      
    } catch (error) {
      console.error('Failed to save quiz results/progress to Firestore:', error);
      log('❌', 'Failed to save results:', error);
    }
  }, [user, profile, activeLesson, lessonId, lessonStartTime, currentLaunchId]);

  const handleMcqNext = () => {
    setShowMcqResult(false);
    setSelectedAnswer(null);

    if (currentMcqIndex < mcqs.length - 1) {
      setCurrentMcqIndex(prev => prev + 1);
    } else {
      // Calculate final score
      let correct = 0;
      const finalAnswers = { ...mcqAnswers };
      
      mcqs.forEach((mcq, idx) => {
        const answer = idx === currentMcqIndex ? selectedAnswer : mcqAnswers[mcq.id];
        if (idx === currentMcqIndex && selectedAnswer !== null) {
          finalAnswers[mcq.id] = selectedAnswer;
        }
        if (answer === mcq.correctAnswer) correct++;
      });
      
      // Submit results
      submitQuizResults(correct, mcqs.length);
      
      // Save to local storage
      saveProgress(lessonId, {
        completedAt: new Date().toISOString(),
        score: { correct, total: mcqs.length },
      });
      
      // Save to Firestore
      saveQuizResultsToFirestore(correct, mcqs.length, finalAnswers);
    }
  };

  // ============================================================================
  // Handle Exit
  // ============================================================================

  const handleExit = () => {
    log('👋', 'Exiting lesson player');
    if (audioRef.current) {
      audioRef.current.pause();
    }
    endLesson();
    navigate('/lessons');
  };

  const handleAvatarReady = useCallback(() => {
    log('✅', 'Avatar is ready');
    setAvatarReady(true);
  }, []);

  // ============================================================================
  // Initialization / Loading State
  // ============================================================================

  // Show loading while data initializes
  if (!dataInitialized) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Loading Lesson...</h1>
          <p className="text-slate-400 mb-2">Please wait while we prepare your lesson.</p>
          <p className="text-xs text-slate-500 font-mono">
            {initPhase === 'starting' && 'Initializing...'}
            {initPhase === 'loading-storage' && 'Loading saved data...'}
            {initPhase === 'validating' && 'Validating content...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if initialization failed
  if (initError) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-600/20 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Failed to Load Lesson</h1>
          <p className="text-slate-400 mb-4">{initError}</p>
          <p className="text-xs text-slate-500 mb-6 font-mono">Phase: {initPhase}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                console.log('🔄 Retrying lesson load...');
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 
                       text-white font-semibold rounded-xl"
            >
              Retry
            </button>
            <button
              onClick={() => {
                console.log('🚪 Navigating back to lessons...');
                sessionStorage.removeItem('activeLesson');
                navigate('/lessons');
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 
                       text-white font-semibold rounded-xl shadow-lg"
            >
              <BookOpen className="w-5 h-5" />
              Back to Lessons
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show no lesson state if data is invalid
  if (!isLessonDataValid || !effectiveLesson) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">No Lesson Selected</h1>
          <p className="text-slate-400 mb-4">
            Please select a lesson from the library to start learning.
          </p>
          <button
            onClick={() => navigate('/lessons')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 
                     text-white font-semibold rounded-xl shadow-lg"
          >
            <BookOpen className="w-5 h-5" />
            Browse Lessons
          </button>
        </div>
      </div>
    );
  }
  
  // Use effective lesson for all subsequent operations
  const currentLesson = effectiveLesson;

  const getPhaseLabel = () => {
    switch (lessonPhase) {
      case 'loading': return 'Loading...';
      case 'intro': return 'Introduction';
      case 'explanation': return 'Explanation';
      case 'outro': return 'Summary';
      case 'quiz': return 'Quiz';
      case 'completed': return 'Completed';
      default: return lessonPhase || 'Unknown';
    }
  };

  const getPhaseProgress = () => {
    const totalSteps = scripts.length + (mcqs.length > 0 ? 1 : 0);
    let currentStep = currentScriptIndex + 1;
    if (lessonPhase === 'quiz') currentStep = scripts.length + 1;
    if (lessonPhase === 'completed') currentStep = totalSteps;
    return Math.min((currentStep / Math.max(totalSteps, 1)) * 100, 100);
  };

  const getPlatformLabel = () => {
    switch (platform) {
      case 'android': return 'Quest/Android';
      case 'ios': return 'iOS';
      case 'web': return 'Web';
      default: return 'Unknown';
    }
  };

  const skyboxImageUrl = skyboxData?.imageUrl || skyboxData?.file_url;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 0.1], fov: 75, near: 0.1, far: 1000 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          style={{ background: '#050810' }}
        >
          <Suspense fallback={null}>
            <LessonScene 
              skyboxUrl={skyboxImageUrl} 
              assetUrl={assetUrl || undefined}
              onSkyboxLoad={() => setSceneReady(true)}
              onSkyboxError={() => {
                setSkyboxError('Failed to load skybox');
                setSceneReady(true);
              }}
              onAssetLoad={() => setAssetLoading(false)}
              onAssetError={() => setAssetLoading(false)}
            />
          </Suspense>
        </Canvas>
        
        {/* Loading overlay */}
        {(skyboxLoading || (skyboxImageUrl && !sceneReady)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400">Loading environment...</p>
            </div>
          </div>
        )}

        {/* No skybox warning */}
        {!skyboxLoading && !skyboxImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 z-5">
            <div className="text-center max-w-sm mx-auto px-4 opacity-50">
              <AlertTriangle className="w-8 h-8 text-amber-400/50 mx-auto mb-2" />
              <p className="text-amber-400/50 text-sm">No skybox available</p>
            </div>
          </div>
        )}
      </div>

      {/* Drag Hint */}
      <AnimatePresence>
        {showDragHint && sceneReady && skyboxImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-white/80 text-sm">
              <Move className="w-4 h-4" />
              Drag to look around
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Button */}
      <button
        onClick={handleExit}
        className="absolute top-4 left-4 z-40 flex items-center gap-2 px-4 py-2.5 
                 bg-black/60 hover:bg-red-600/80 backdrop-blur-sm 
                 text-white rounded-xl border border-white/10 transition-all"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium">Exit</span>
      </button>

      {/* Top Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-4 px-6 py-3 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            <div>
              <h1 className="text-sm font-semibold text-white truncate max-w-[200px]">
                {activeLesson.topic?.topic_name || 'Unknown Topic'}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{activeLesson.chapter?.subject || 'Unknown'}</span>
                <span className="text-xs text-cyan-400">• {getPhaseLabel()}</span>
              </div>
            </div>
          </div>
          
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${getPhaseProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Stop Lesson Button - Only show when lesson is running */}
        {lessonReady && !showWelcomeScreen && (
          <button
            onClick={handleStopLesson}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors 
                     bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
            title="Stop lesson and return to start"
          >
            <Square className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Stop</span>
          </button>
        )}
        
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2.5 rounded-xl transition-colors ${
            isMuted ? 'bg-red-500/20 text-red-400' : 'bg-black/60 text-white hover:bg-black/80'
          } border border-white/10`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        
        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-2.5 rounded-xl transition-colors ${
            showChat ? 'bg-cyan-500/20 text-cyan-400' : 'bg-black/60 text-white hover:bg-black/80'
          } border border-white/10`}
          title="Ask questions"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar Panel - Transparent Background (No Gender Selection) */}
      <div className="absolute right-4 bottom-4 z-20 w-[180px] h-[270px] md:w-[220px] md:h-[330px]">
        <div className="w-full h-full rounded-2xl overflow-hidden" style={{ background: 'transparent' }}>
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-black/20">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          }>
            <TeacherAvatar
              ref={avatarRef}
              className="w-full h-full"
              avatarModelUrl="/models/avatar3.glb"
              curriculum={activeLesson.chapter?.curriculum}
              class={activeLesson.chapter?.class_name}
              subject={activeLesson.chapter?.subject}
              useAvatarKey={true}
              externalThreadId={threadId}
              onReady={handleAvatarReady}
              // Pass audio URL for lip sync - TeacherAvatar will animate lips
              audioUrl={ttsStatus === 'playing' ? currentAudioUrl : null}
              visemes={currentVisemes}
            />
          </Suspense>
        </div>
        
        {avatarReady && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Ready
          </div>
        )}
      </div>

      {/* Welcome Screen - Before Lesson Starts */}
      <AnimatePresence>
        {showWelcomeScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl 
                       rounded-3xl border border-white/10 p-8 max-w-md mx-4 text-center
                       shadow-2xl shadow-black/50"
            >
              {/* Lesson Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 
                            border border-cyan-500/30 flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-cyan-400" />
              </div>

              {/* Lesson Info */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {activeLesson.chapter?.curriculum}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {activeLesson.chapter?.class_name}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {activeLesson.topic?.topic_name || 'Lesson'}
                </h2>
                <p className="text-sm text-slate-400">
                  {activeLesson.chapter?.subject} • Chapter {activeLesson.chapter?.chapter_number}
                </p>
              </div>

              {/* Lesson Preview */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 text-left">
                <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  What you'll learn
                </h3>
                <p className="text-xs text-slate-400 line-clamp-3">
                  {activeLesson.topic?.learning_objective || 
                   activeLesson.topic?.avatar_intro?.substring(0, 150) + '...' ||
                   'Explore this interactive VR lesson with your AI teacher.'}
                </p>
              </div>

              {/* Content Indicators */}
              <div className="flex items-center justify-center gap-4 mb-6">
                {scripts.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>{scripts.length} sections</span>
                  </div>
                )}
                {mcqs.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <span>{mcqs.length} questions</span>
                  </div>
                )}
                {skyboxData && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>360° view</span>
                  </div>
                )}
              </div>

              {/* Start Button */}
              <motion.button
                onClick={handleStartLesson}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 
                         bg-gradient-to-r from-cyan-500 to-blue-600 
                         hover:from-cyan-400 hover:to-blue-500
                         text-white text-lg font-bold rounded-xl
                         shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50
                         transition-all duration-300"
              >
                <Play className="w-6 h-6" />
                Start Lesson
              </motion.button>

              {/* Back button */}
              <button
                onClick={handleExit}
                className="mt-4 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← Back to lessons
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Panel - Minimal & Compact */}
      <div className="absolute left-4 bottom-4 right-[220px] md:right-[260px] z-20 max-w-md">
        {/* Voiceover Player - Simple Controls */}
        <div className="mb-2">
          <VoiceoverPlayer
            audioUrl={currentAudioUrl}
            isPlaying={ttsStatus === 'playing'}
            isPaused={ttsStatus === 'paused'}
            currentTime={audioCurrentTime}
            duration={audioDuration}
            onPlay={ttsStatus === 'paused' ? resumeTTS : playTTS}
            onPause={pauseTTS}
            onStop={stopTTS}
            disabled={isMuted}
            status={ttsStatus}
          />
        </div>
        
        {/* TTS Status Indicator */}
        {ttsStatus === 'error' && (
          <div className="mb-2">
            <TTSStatusIndicator status={ttsStatus} />
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {/* Lesson Stage Display - Interactive Experience */}
          {['intro', 'explanation', 'outro', 'loading'].includes(lessonPhase) && (
            <motion.div
              key="script"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-4"
            >
              {/* Lesson Progress Indicator */}
              <div className="flex items-center justify-center gap-1 mb-3">
                {/* Step 1: Intro */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all ${
                  lessonPhase === 'intro' 
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' 
                    : lessonPhase === 'explanation' || lessonPhase === 'outro'
                      ? 'bg-emerald-500/10 text-emerald-400/60'
                      : 'bg-slate-700/30 text-slate-500'
                }`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${
                    lessonPhase === 'intro' ? 'bg-emerald-500 text-white' : 
                    lessonPhase === 'explanation' || lessonPhase === 'outro' ? 'bg-emerald-500/50 text-white' : 'bg-slate-600'
                  }`}>1</span>
                  Intro
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                
                {/* Step 2: Explanation */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all ${
                  lessonPhase === 'explanation' 
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' 
                    : lessonPhase === 'outro'
                      ? 'bg-cyan-500/10 text-cyan-400/60'
                      : 'bg-slate-700/30 text-slate-500'
                }`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${
                    lessonPhase === 'explanation' ? 'bg-cyan-500 text-white' :
                    lessonPhase === 'outro' ? 'bg-cyan-500/50 text-white' : 'bg-slate-600'
                  }`}>2</span>
                  Learn
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                
                {/* Step 3: Outro */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all ${
                  lessonPhase === 'outro' 
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' 
                    : 'bg-slate-700/30 text-slate-500'
                }`}>
                  <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${
                    lessonPhase === 'outro' ? 'bg-purple-500 text-white' : 'bg-slate-600'
                  }`}>3</span>
                  Summary
                </div>
                
                {/* Step 4: Quiz (if available) */}
                {mcqs.length > 0 && (
                  <>
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-700/30 text-slate-500">
                      <span className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] bg-slate-600">4</span>
                      Quiz
                    </div>
                  </>
                )}
              </div>

              {/* Stage Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  lessonPhase === 'intro' ? 'bg-emerald-500/20 text-emerald-400' :
                  lessonPhase === 'explanation' ? 'bg-cyan-500/20 text-cyan-400' :
                  lessonPhase === 'outro' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {lessonPhase === 'intro' && <Play className="w-3.5 h-3.5" />}
                  {lessonPhase === 'explanation' && <Sparkles className="w-3.5 h-3.5" />}
                  {lessonPhase === 'outro' && <CheckCircle className="w-3.5 h-3.5" />}
                  {lessonPhase === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{getPhaseLabel()}</h2>
                  <p className="text-[10px] text-slate-500">
                    {lessonPhase === 'intro' && 'Welcome to the lesson'}
                    {lessonPhase === 'explanation' && 'Main learning content'}
                    {lessonPhase === 'outro' && 'Recap and key points'}
                  </p>
                </div>
                
                {/* Audio status indicator */}
                {ttsStatus === 'playing' && (
                  <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 bg-emerald-400 rounded-full"
                          animate={{ height: [4, 10, 4] }}
                          transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                    <span className="text-[9px] text-emerald-300 font-medium">Speaking</span>
                  </div>
                )}
              </div>

              {/* Script Text - Larger and more readable */}
              <div className="mb-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
                <p className="text-xs text-slate-200 leading-relaxed line-clamp-4">
                  {currentScript || 'No script available for this section.'}
                </p>
              </div>

              {/* Controls - Show "Continue" prominently when TTS ends */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReplay}
                  disabled={isPlayingAudio || !currentScript}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium
                           text-slate-300 bg-slate-800/50 hover:bg-slate-700/50
                           rounded-lg border border-slate-700 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className="w-3 h-3" />
                  Replay
                </button>

                {/* Skip to Quiz Button - Show during TTS phases when MCQs available */}
                {['intro', 'explanation', 'outro'].includes(lessonPhase) && mcqs.length > 0 && (
                  <motion.button
                    onClick={handleSkipToQuiz}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold
                             text-amber-200 bg-gradient-to-r from-amber-600/80 to-orange-600/80 
                             hover:from-amber-500 hover:to-orange-500 
                             rounded-lg border border-amber-500/50 shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip to Quiz
                  </motion.button>
                )}

                {/* Main Continue Button - Highlighted when waiting for user */}
                <motion.button
                  onClick={handleContinue}
                  disabled={isPlayingAudio && !waitingForUser}
                  animate={waitingForUser ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 1.5, repeat: waitingForUser ? Infinity : 0 }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold
                           rounded-lg shadow-lg transition-all ${
                    waitingForUser 
                      ? 'text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 ring-2 ring-emerald-400/50'
                      : isPlayingAudio
                        ? 'text-slate-400 bg-slate-700/50 cursor-not-allowed'
                        : 'text-white bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600'
                  }`}
                >
                  {waitingForUser ? (
                    <>
                      {lessonPhase === 'outro' && mcqs.length > 0 ? 'Start Quiz' : 
                       lessonPhase === 'outro' ? 'Complete Lesson' : 'Continue'}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : isPlayingAudio ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Listening...
                    </>
                  ) : (
                    <>
                      {lessonPhase === 'outro' && mcqs.length > 0 ? 'Quiz' : 
                       lessonPhase === 'outro' ? 'Done' : 'Continue'}
                      <ChevronRight className="w-3 h-3" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* MCQ Display - Compact */}
          {lessonPhase === 'quiz' && currentMcq && (
            <motion.div
              key="mcq"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-semibold text-white">
                  Q{currentMcqIndex + 1}/{mcqs.length}
                </h2>
              </div>

              <p className="text-xs text-white font-medium mb-2 line-clamp-2">{currentMcq.question}</p>

              <div className="space-y-1.5 mb-2">
                {currentMcq.options.map((option, idx) => {
                  const isSelected = selectedAnswer === idx;
                  const isCorrect = idx === currentMcq.correctAnswer;
                  const showCorrect = showMcqResult && isCorrect;
                  const showWrong = showMcqResult && isSelected && !isCorrect;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleMcqSelect(idx)}
                      disabled={showMcqResult}
                      className={`w-full text-left px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                        showCorrect ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
                        showWrong ? 'bg-red-500/20 border-red-500/50 text-red-300' :
                        isSelected ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' :
                        'bg-slate-800/30 border-slate-700/30 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                          showCorrect ? 'bg-emerald-500/30' :
                          showWrong ? 'bg-red-500/30' :
                          isSelected ? 'bg-cyan-500/30' : 'bg-slate-700/50'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 line-clamp-1">{option}</span>
                        {showCorrect && <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                        {showWrong && <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showMcqResult && currentMcq.explanation && (
                <div className="mb-2 p-2 bg-slate-800/50 rounded-md border border-slate-700/50">
                  <p className="text-[10px] text-slate-300 line-clamp-2">
                    <span className="font-semibold text-cyan-400">💡 </span>
                    {currentMcq.explanation}
                  </p>
                </div>
              )}

              <div className="flex gap-1.5">
                {!showMcqResult ? (
                  <button
                    onClick={handleMcqSubmit}
                    disabled={selectedAnswer === null}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-semibold
                             text-white bg-gradient-to-r from-amber-500 to-orange-600
                             rounded-md shadow-lg disabled:opacity-50"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Submit
                  </button>
                ) : (
                  <button
                    onClick={handleMcqNext}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-semibold
                             text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-md shadow-lg"
                  >
                    {currentMcqIndex < mcqs.length - 1 ? 'Next' : 'Results'}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Completed */}
          {lessonPhase === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center"
            >
              <Award className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-white mb-2">Lesson Complete!</h2>
              
              {mcqs.length > 0 && (
                <div className="mb-4 p-4 bg-slate-800/50 rounded-xl inline-block">
                  <p className="text-xs text-slate-400 mb-1">Score</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    {mcqs.filter((mcq) => mcqAnswers[mcq.id] === mcq.correctAnswer).length}/{mcqs.length}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/lessons')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium
                           text-slate-300 bg-slate-800/50 rounded-lg border border-slate-700"
                >
                  <Home className="w-4 h-4" />
                  More Lessons
                </button>
                <button
                  onClick={handleExit}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold
                           text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed top-0 right-0 w-full max-w-sm h-full bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold text-white">Ask Questions</h3>
                {!threadId && (
                  <span className="text-xs text-amber-400">(Connecting...)</span>
                )}
              </div>
              <button onClick={() => setShowChat(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Ask questions about this lesson!</p>
                  <p className="text-xs text-slate-500 mt-2">The AI assistant is here to help.</p>
                </div>
              )}

              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user' ? 'bg-cyan-500/20 text-cyan-100' : 'bg-slate-800/50 text-slate-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/50 px-3 py-2 rounded-xl">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder={threadId ? "Ask a question..." : "Connecting..."}
                  disabled={!threadId}
                  className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg
                           text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50
                           disabled:opacity-50"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatLoading || !threadId}
                  className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Safe Initialization Check
// ============================================================================

const SafeVRLessonPlayer = () => {
  // Check if we're in a valid render context
  const [isReady, setIsReady] = React.useState(false);
  const [mountError, setMountError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    // Small delay to ensure all providers are ready
    const checkMount = async () => {
      try {
        // Check if sessionStorage is available
        if (typeof sessionStorage === 'undefined') {
          throw new Error('SessionStorage not available');
        }
        
        // Give context providers time to initialize
        await new Promise(resolve => setTimeout(resolve, 150));
        
        setIsReady(true);
      } catch (err) {
        console.error('Mount check failed:', err);
        setMountError(err instanceof Error ? err.message : 'Unknown error');
      }
    };
    
    checkMount();
  }, []);
  
  if (mountError) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-600/20 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Initialization Error</h1>
          <p className="text-slate-400 mb-4">{mountError}</p>
          <button
            onClick={() => window.location.href = '/lessons'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 
                     text-white font-semibold rounded-xl shadow-lg"
          >
            <BookOpen className="w-5 h-5" />
            Back to Lessons
          </button>
        </div>
      </div>
    );
  }
  
  if (!isReady) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Preparing VR Experience...</h1>
          <p className="text-slate-400">Initializing components...</p>
        </div>
      </div>
    );
  }
  
  return <VRLessonPlayerInner />;
};

// ============================================================================
// Wrapper with Error Boundary
// ============================================================================

const VRLessonPlayer = () => {
  return (
    <VRPlayerErrorBoundary onReset={() => {
      sessionStorage.removeItem('activeLesson');
      window.location.href = '/lessons';
    }}>
      <SafeVRLessonPlayer />
    </VRPlayerErrorBoundary>
  );
};

export default VRLessonPlayer;
