/**
 * VR Lesson Player - Full immersive lesson experience
 * 
 * Features:
 * - Interactive 360° skybox background
 * - 3D asset display with Meshy proxy support
 * - Avatar with TTS narration
 * - Assistant chat for Q&A
 * - MCQ flow after lesson
 * - Comprehensive error handling
 * - TTS Progress indicators
 */

import { useState, useEffect, useRef, useCallback, Suspense, lazy, Component, ReactNode, ErrorInfo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useAuth } from '../contexts/AuthContext';
import { useLesson, LessonPhase } from '../contexts/LessonContext';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getApiBaseUrl } from '../utils/apiConfig';
import api from '../config/axios';
import {
  Play,
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
  Mic,
  Radio,
  User,
  Users,
  ChevronDown,
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
// TTS Progress Component
// ============================================================================

const TTSProgressBar = ({ 
  status, 
  progress = 0 
}: { 
  status: 'idle' | 'generating' | 'playing' | 'error'; 
  progress?: number;
}) => {
  if (status === 'idle') return null;
  
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-xl border border-white/10">
      {status === 'generating' && (
        <>
          <div className="relative w-6 h-6">
            <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            <span className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-cyan-300 font-medium">Generating audio...</p>
            <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </>
      )}
      
      {status === 'playing' && (
        <>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="w-1 bg-emerald-400 rounded-full"
                animate={{ 
                  height: [8, 16, 8],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
          <p className="text-xs text-emerald-300 font-medium">Speaking...</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <p className="text-xs text-amber-300 font-medium">Audio unavailable - showing text</p>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const VRLessonPlayerInner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const lessonContext = useLesson();

  // Extract from context with safety
  const activeLesson = lessonContext?.activeLesson;
  const lessonPhase = lessonContext?.lessonPhase || 'idle';
  const currentScriptIndex = lessonContext?.currentScriptIndex || 0;
  const setPhase = lessonContext?.setPhase || (() => {});
  const advanceScript = lessonContext?.advanceScript || (() => {});
  const hasNextScript = lessonContext?.hasNextScript || (() => false);
  const endLesson = lessonContext?.endLesson || (() => {});
  const submitQuizResults = lessonContext?.submitQuizResults || (() => {});

  // Refs
  const avatarRef = useRef<{ sendMessage: (text: string) => Promise<void> } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Skybox State
  const [skyboxData, setSkyboxData] = useState<SkyboxData | null>(null);
  const [skyboxLoading, setSkyboxLoading] = useState(true);
  const [skyboxError, setSkyboxError] = useState<string | null>(null);

  // Asset State
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);

  // Avatar Gender Selection
  const [avatarGender, setAvatarGender] = useState<'male' | 'female'>('male');
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  
  // TTS State
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'generating' | 'playing' | 'error'>('idle');
  const [ttsProgress, setTtsProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [avatarReady, setAvatarReady] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentVisemes, setCurrentVisemes] = useState<any[]>([]);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // MCQ State
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [showMcqResult, setShowMcqResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // UI State
  const [showDragHint, setShowDragHint] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);

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
  const mcqs = activeLesson?.topic?.mcqs || [];
  const currentMcq = mcqs[currentMcqIndex];

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
  // Fetch 3D Asset
  // ============================================================================

  useEffect(() => {
    if (activeLesson?.topic?.asset_urls?.[0]) {
      const url = activeLesson.topic.asset_urls[0];
      log('📦', '3D Asset URL from topic:', url.substring(0, 80));
      setAssetUrl(url);
      setAssetLoading(true);
    }
  }, [activeLesson]);

  // Hide drag hint
  useEffect(() => {
    if (showDragHint && sceneReady) {
      const timer = setTimeout(() => setShowDragHint(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showDragHint, sceneReady]);

  // Close gender dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.gender-dropdown-container')) {
        setShowGenderDropdown(false);
      }
    };
    
    if (showGenderDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGenderDropdown]);

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
  // Auto-start Lesson
  // ============================================================================

  useEffect(() => {
    if (lessonPhase === 'loading' && activeLesson) {
      const timer = setTimeout(() => {
        setPhase('intro');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [lessonPhase, activeLesson, setPhase]);

  // ============================================================================
  // TTS Generation and Playback with Lip Sync
  // ============================================================================

  const generateAndPlayTTS = useCallback(async (text: string) => {
    if (isMuted || !text) {
      log('🔇', 'TTS skipped (muted or empty text)');
      return;
    }

    try {
      setTtsStatus('generating');
      setTtsProgress(20);
      
      // Select voice based on gender
      const voice = avatarGender === 'male' ? 'onyx' : 'nova'; // onyx = male, nova = female
      log('🎤', `Generating TTS (${avatarGender}, voice: ${voice}) for:`, text.substring(0, 50));
      
      // Call TTS endpoint
      const response = await api.post('/assistant/tts/generate', {
        text: text,
        voice: voice,
      });
      
      setTtsProgress(60);
      
      // Generate visemes for lip sync
      let visemes: any[] = [];
      try {
        log('👄', 'Generating visemes for lip sync...');
        const visemeResponse = await api.post('/assistant/lipsync/generate', {
          text: text,
        });
        visemes = visemeResponse.data?.visemes || [];
        log('✅', `Generated ${visemes.length} viseme frames`);
      } catch (visemeError) {
        console.warn('Viseme generation failed, continuing without lip sync:', visemeError);
      }
      
      setTtsProgress(80);
      
      if (response.data?.audioUrl) {
        log('✅', 'TTS audio URL received:', response.data.audioUrl.substring(0, 50));
        setTtsProgress(100);
        
        // Set audio URL and visemes for TeacherAvatar component
        setCurrentAudioUrl(response.data.audioUrl);
        setCurrentVisemes(visemes);
        
        // Play the audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        const audio = new Audio(response.data.audioUrl);
        audioRef.current = audio;
        
        audio.onplay = () => {
          setTtsStatus('playing');
        };
        
        audio.onended = () => {
          setTtsStatus('idle');
          setTtsProgress(0);
          setCurrentAudioUrl(null);
          setCurrentVisemes([]);
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setTtsStatus('error');
          setCurrentAudioUrl(null);
          setCurrentVisemes([]);
        };
        
        await audio.play();
      } else {
        throw new Error('No audio URL in response');
      }
    } catch (error: any) {
      console.error('TTS generation failed:', error);
      log('❌', 'TTS error:', error.message);
      setTtsStatus('error');
      setCurrentAudioUrl(null);
      setCurrentVisemes([]);
      
      // Show text even if TTS fails
      setTimeout(() => {
        setTtsStatus('idle');
      }, 3000);
    }
  }, [isMuted, avatarGender]);

  // Play script when phase changes
  useEffect(() => {
    if (['intro', 'explanation', 'outro'].includes(lessonPhase) && currentScript && scripts.length > 0) {
      // Generate and play TTS
      generateAndPlayTTS(currentScript);
    }
  }, [lessonPhase, currentScriptIndex, currentScript, scripts.length, generateAndPlayTTS]);

  const handleReplay = useCallback(() => {
    if (currentScript) {
      generateAndPlayTTS(currentScript);
    }
  }, [currentScript, generateAndPlayTTS]);

  const handleNext = useCallback(() => {
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTtsStatus('idle');

    if (hasNextScript()) {
      advanceScript();
      const nextIndex = currentScriptIndex + 1;
      if (nextIndex === 0) setPhase('intro');
      else if (nextIndex === 1) setPhase('explanation');
      else if (nextIndex === 2) setPhase('outro');
    } else {
      if (mcqs.length > 0) {
        setPhase('quiz');
      } else {
        setPhase('completed');
        saveProgress(lessonId, { completedAt: new Date().toISOString() });
      }
    }
  }, [hasNextScript, advanceScript, currentScriptIndex, mcqs, setPhase, lessonId]);

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

        // Optionally play TTS for chat response (if not muted)
        if (!isMuted && assistantResponse.length < 500) {
          // Use gender-based voice for chat responses too
          generateAndPlayTTS(assistantResponse);
        }
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
  }, [chatInput, chatLoading, activeLesson, threadId, isMuted, generateAndPlayTTS]);

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

  const handleMcqNext = () => {
    setShowMcqResult(false);
    setSelectedAnswer(null);

    if (currentMcqIndex < mcqs.length - 1) {
      setCurrentMcqIndex(prev => prev + 1);
    } else {
      let correct = 0;
      mcqs.forEach((mcq, idx) => {
        const answer = idx === currentMcqIndex ? selectedAnswer : mcqAnswers[mcq.id];
        if (answer === mcq.correct_option_index) correct++;
      });
      submitQuizResults(correct, mcqs.length);
      saveProgress(lessonId, {
        completedAt: new Date().toISOString(),
        score: { correct, total: mcqs.length },
      });
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
  // No Lesson State
  // ============================================================================

  if (!activeLesson) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">No Lesson Selected</h1>
          <p className="text-slate-400 mb-6">
            Please select a lesson to start learning.
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
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2.5 rounded-xl transition-colors ${
            isMuted ? 'bg-red-500/20 text-red-400' : 'bg-black/60 text-white hover:bg-black/80'
          } border border-white/10`}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        
        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-2.5 rounded-xl transition-colors ${
            showChat ? 'bg-cyan-500/20 text-cyan-400' : 'bg-black/60 text-white hover:bg-black/80'
          } border border-white/10`}
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar Panel - Transparent Background with Gender Selection */}
      <div className="absolute right-4 bottom-4 z-20 w-[180px] h-[270px] md:w-[220px] md:h-[330px]">
        {/* Gender Selection Dropdown */}
        <div className="absolute -top-12 right-0 z-30 gender-dropdown-container">
          <div className="relative">
            <button
              onClick={() => setShowGenderDropdown(!showGenderDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm 
                       text-white rounded-lg border border-white/20 hover:border-cyan-500/50 
                       transition-all text-xs font-medium"
            >
              {avatarGender === 'male' ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              <span className="capitalize">{avatarGender} Teacher</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showGenderDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showGenderDropdown && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-black/90 backdrop-blur-xl rounded-lg 
                            border border-white/20 shadow-xl overflow-hidden z-40">
                <button
                  onClick={() => {
                    setAvatarGender('male');
                    setShowGenderDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                    avatarGender === 'male' 
                      ? 'bg-cyan-500/20 text-cyan-300' 
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Male Teacher
                </button>
                <button
                  onClick={() => {
                    setAvatarGender('female');
                    setShowGenderDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                    avatarGender === 'female' 
                      ? 'bg-cyan-500/20 text-cyan-300' 
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Female Teacher
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-full h-full rounded-2xl overflow-hidden" style={{ background: 'transparent' }}>
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-black/20">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          }>
            <TeacherAvatar
              ref={avatarRef}
              className="w-full h-full"
              avatarModelUrl={avatarGender === 'male' ? '/models/avatar3.glb' : '/models/avatar3.glb'}
              curriculum={activeLesson.chapter?.curriculum}
              class={activeLesson.chapter?.class_name}
              subject={activeLesson.chapter?.subject}
              useAvatarKey={true}
              externalThreadId={threadId}
              onReady={handleAvatarReady}
              audioUrl={currentAudioUrl}
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

      {/* Main Content Panel - Minimal & Compact */}
      <div className="absolute left-4 bottom-4 right-[220px] md:right-[260px] z-20 max-w-md">
        {/* TTS Progress Indicator - Compact */}
        {ttsStatus !== 'idle' && (
          <div className="mb-2">
            <TTSProgressBar status={ttsStatus} progress={ttsProgress} />
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {/* Script Display - Minimal Size */}
          {['intro', 'explanation', 'outro', 'loading'].includes(lessonPhase) && (
            <motion.div
              key="script"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 p-3"
            >
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    lessonPhase === 'intro' ? 'bg-emerald-500/20 text-emerald-400' :
                    lessonPhase === 'explanation' ? 'bg-cyan-500/20 text-cyan-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {lessonPhase === 'intro' && <Play className="w-3 h-3" />}
                    {lessonPhase === 'explanation' && <Sparkles className="w-3 h-3" />}
                    {lessonPhase === 'outro' && <CheckCircle className="w-3 h-3" />}
                    {lessonPhase === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                  <h2 className="text-xs font-semibold text-white">{getPhaseLabel()}</h2>
                  <span className="text-[10px] text-slate-500">
                    {scripts.length > 0 ? `${currentScriptIndex + 1}/${scripts.length}` : ''}
                  </span>
                </div>
              </div>

              {/* Compact Text - 2 lines max */}
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-2 min-h-[2.5rem]">
                {currentScript || 'No script available for this section.'}
              </p>

              {/* Compact Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleReplay}
                  disabled={ttsStatus === 'generating' || !currentScript}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium
                           text-slate-300 bg-slate-800/50 hover:bg-slate-700/50
                           rounded-md border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  Replay
                </button>

                <button
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1 text-[10px] font-semibold
                           text-white bg-gradient-to-r from-emerald-500 to-teal-600
                           hover:from-emerald-400 hover:to-teal-500
                           rounded-md shadow-lg transition-all"
                >
                  {hasNextScript() ? 'Continue' : mcqs.length > 0 ? 'Quiz' : 'Done'}
                  <ChevronRight className="w-3 h-3" />
                </button>
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
                  const isCorrect = idx === currentMcq.correct_option_index;
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
                    {Object.values(mcqAnswers).filter((ans, idx) => 
                      ans === mcqs[idx]?.correct_option_index
                    ).length}/{mcqs.length}
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
// Wrapper with Error Boundary
// ============================================================================

const VRLessonPlayer = () => {
  return (
    <VRPlayerErrorBoundary onReset={() => window.location.reload()}>
      <VRLessonPlayerInner />
    </VRPlayerErrorBoundary>
  );
};

export default VRLessonPlayer;
