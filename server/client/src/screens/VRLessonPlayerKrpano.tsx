/**
 * VR Lesson Player (krpano) - Full immersive lesson experience using krpano
 *
 * Features:
 * - 360° equirectangular skybox via krpano sphere
 * - Optional depthmap and WebVR for advanced VR/parallax
 * - Same lesson flow: TTS, avatar, MCQs, chat, tracking
 * - Student/teacher/school dashboard behaviour unchanged
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy, Component, ReactNode, ErrorInfo, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Asset3DLoadingOverlay, Asset3DLoadingCard } from '../Components/Asset3DLoadingOverlay';
import { LessonLoadProgress } from '../Components/LessonLoadProgress';
import {
  buildKrpanoXml,
  krpanoAssetHotspotName,
  selectKrpano3dEntries,
  type LookatByPhase,
  type KrpanoHotspotOption,
} from '../lib/krpano/buildKrpanoXml';
import { loadKrpanoScript, embedKrpano, removeKrpano } from '../lib/krpano/embedKrpano';
import { ensureRenderAssetBridgeReady, toRenderAssetBridgeUrl } from '../lib/krpano/renderAssetBridge';
import { normalizeAssetHotspot, revealAssetHotspot } from '../lib/krpano/normalizeAssetHotspot';
import { ASSET_ANGULAR_SIZE_DEG, angularSizeForCount } from '../lib/krpano/assetLayout';
import { applyTeacherViewToImmersiveKrpano, applyTeacherViewToKrpano, readKrpanoLookat } from '../lib/krpano/applyTeacherView';
import { useAuth } from '../contexts/AuthContext';
import { useEnforcedPlayerRoute } from '../hooks/useEnforcedPlayerRoute';
import { useLesson, LessonPhase } from '../contexts/LessonContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import { reportSessionProgress, updateTeacherView, reportStudentView, launchLesson as launchLessonToSession, reportAttendance } from '../services/classSessionService';
import { LiveClassHostOverlay } from '../Components/classSession/LiveClassHostOverlay';
import { PlayerChrome } from '../Components/player/PlayerChrome';
import { PlayerTopBar } from '../Components/player/PlayerTopBar';
import { PlayerBottomBar } from '../Components/player/PlayerBottomBar';
import { AnnotationOverlay } from '../Components/player/AnnotationOverlay';
import { MARKER_COLORS } from '../Components/player/MarkerToolbar';
import { usePlayerViewport } from '../hooks/usePlayerViewport';
import { useMarkerDrawing, screenToSphere, LASER_TTL_MS, type MarkerMode } from '../hooks/useMarkerDrawing';
import { extractMcqOptions, resolveCorrectAnswerIndex } from '../lib/mcq/answerIndex';
import { installViewChangeBus, onViewChange as onKrpanoViewChange } from '../lib/krpano/viewChangeBus';
// The immersive panel is drawn by a shared renderer so this player and
// XRLessonPlayerV3 show the same UI; immersive_ui.xml calls it through window.
import { EMPTY_LESSON_UI_STATE, installLessonPanelRenderer } from '../lib/lessonUi';
import type { LessonUiState } from '../lib/lessonUi';
import { resetUserControl, reconcileUserControl } from '../lib/krpano/userControl';
import {
  MAX_INK_STROKES,
  strokeCentroid,
  isStrokeExpired,
  setAnnotationClockOffset,
  getAnnotationClockOffset,
} from '../lib/annotations/sphereGeometry';
import { publishAnnotations, clearAnnotations, appendStroke } from '../services/classSessionService';
import type { SessionLessonPhase, SessionQuizAnswer, TeacherContentState } from '../types/lms';
import { auth, db } from '../config/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { trackLessonLaunch, saveQuizScore, updateLessonLaunch } from '../services/lessonTrackingService';
import { isGuestUser } from '../utils/rbac';
import { getApiBaseUrl, getProxyAssetUrl, getProxyAssetUrlForThreejs } from '../utils/apiConfig';
import api from '../config/axios';
import { getChapterTTS, getMeshyAssets, getChapterMCQs } from '../lib/firestore/queries';
import { getLessonBundle } from '../services/firestore/getLessonBundle';
import { getVRCapabilities, isMetaQuestBrowser } from '../utils/vrDetection';
import { resolveStudentDisplayName } from '../utils/displayName';
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
  Move,
  AlertTriangle,
  RefreshCcw,
  SkipForward,
  Target,
  Box,
  Mic,
  Glasses,
  Clock,
  Hand,
} from 'lucide-react';
import { Progress } from '../Components/ui/progress';
import { Button } from '../Components/ui/button';

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
        <div className="fixed inset-0 bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card rounded-2xl border border-destructive/30 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-4">
              The VR Lesson Player encountered an error.
            </p>
            
            <div className="mb-4 p-3 bg-muted/50 rounded-lg text-left overflow-auto max-h-40 text-foreground">
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
                         text-foreground bg-muted hover:bg-muted/80 rounded-lg border border-border"
              >
                <RefreshCcw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/studio/content'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                         text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg"
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

/**
 * The panel state this player pushes into the immersive UI. Now just the shared
 * shape, so XRLessonPlayerV3 renders from exactly the same contract.
 */
type KrpanoUiStatePayload = LessonUiState;

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

/** Element ID for krpano container; embedpano expects an id string, not an HTMLElement. */
const KRPANO_CONTAINER_ID = 'krpano-viewer-container';

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
  const renderableGlb = pickBestGlbUrl(asset);
  if (renderableGlb) return renderableGlb;
  
  switch (platform) {
    case 'android':
      // Android/Quest: FBX first, then GLB
      return !isLegacyMeshyCdnUrl(asset.fbx_url || asset.glb_url || '')
        ? (asset.fbx_url || asset.glb_url || null)
        : null;
    case 'ios':
      // iOS: USDZ first, then GLB
      return !isLegacyMeshyCdnUrl(asset.usdz_url || asset.glb_url || '')
        ? (asset.usdz_url || asset.glb_url || null)
        : null;
    case 'web':
    default:
      // Web: GLB is best supported
      return asset.glb_url || null;
  }
};

/** Web player only supports GLB/GLTF (GLTFLoader). */
const isGlbOrGltfUrl = (url: string): boolean =>
  /\.(glb|gltf)([?#]|$)/i.test(url) || /\.glb\b/i.test(url.split('?')[0] ?? '');

const isFirebaseStorageAssetUrl = (url: string): boolean =>
  url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app') || url.includes('appspot.com');

const isRenderAssetUrl = (url: string): boolean =>
  url.includes('/render-asset/') && /\.(glb|gltf)$/i.test((url.split(/[?#]/)[0] ?? url).replace(/\/$/, ''));

const isLegacyMeshyCdnUrl = (url: string): boolean =>
  /\/\/(?:assets|storage)\.meshy\.ai\//i.test(url) || /\/\/api\.meshy\.ai\//i.test(url);

const isRetiredMeshyAsset = (asset: any): boolean =>
  Boolean(
    asset?.active === false ||
    asset?.status === 'replaced' ||
    asset?.replaced_by_meshy_asset_id ||
    (asset?.asset_repair_status === 'regenerated' && asset?.replaced_by_meshy_asset_id)
  );

const isSafeLessonGlbUrl = (url: string): boolean =>
  Boolean(url && isGlbOrGltfUrl(url) && !isLegacyMeshyCdnUrl(url));

const toKrpanoThreeJsAssetUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('/assets/') || url.startsWith('blob:') || isRenderAssetUrl(url)) return url;
  return getProxyAssetUrlForThreejs(url);
};


function pickBestGlbUrl(asset: any): string {
  if (isRetiredMeshyAsset(asset)) return '';
  const candidates = [
    asset?.animated_render_url,
    asset?.render_url,
    asset?.model_urls?.glb,
    asset?.glb_url,
    asset?.stored_glb_url,
    asset?.animated_glb_url,
  ];
  const url = candidates.find((candidate) => isSafeLessonGlbUrl(String(candidate || '')));
  return url ? String(url) : '';
}

const firstGlbOrGltfUrl = (urls: string[]): string | null => {
  for (const u of urls) {
    if (u && isSafeLessonGlbUrl(u)) return u;
  }
  return null;
};

const collectBundleAssetUrls = (assets: any[]): { urls: string[]; ids: string[] } => {
  const urls: string[] = [];
  const ids: string[] = [];
  for (const asset of assets) {
    const glb = pickBestGlbUrl(asset);
    if (glb && !urls.includes(glb)) {
      urls.push(glb);
      ids.push(asset?.id || `asset_${urls.length}`);
    }
  }
  return { urls, ids };
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
// Integrated 3D environment (skybox + lesson model in same scene - model part of environment)
// ============================================================================

function SkyboxSphereIntegrated({ imageUrl, onLoad, onError }: { imageUrl: string; onLoad?: () => void; onError?: (err: any) => void }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState(false);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      imageUrl,
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;
        textureRef.current = tex;
        setTexture(tex);
        onLoad?.();
      },
      undefined,
      (err) => {
        setLoadError(true);
        console.warn('[VRLessonKrpano] Skybox texture failed to load:', imageUrl?.substring(0, 80), err);
        onError?.(err);
      }
    );
    return () => {
      const tex = textureRef.current;
      if (tex) {
        tex.dispose();
        textureRef.current = null;
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

function AssetModelInScene({
  url,
  position = [0, 0, -5],
  scale = 1.5,
  onLoad,
  onError,
}: {
  url: string;
  position?: [number, number, number];
  scale?: number;
  onLoad?: () => void;
  onError?: (err: any) => void;
}) {
  const modelRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const [loadPhase, setLoadPhase] = useState<'downloading' | 'processing'>('downloading');
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!url || !isGlbOrGltfUrl(url)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadPhase('downloading');
    setDownloadProgress({ loaded: 0, total: 0 });
    let loadUrl = url;
    const isExternal =
      typeof window !== 'undefined' &&
      /^https?:\/\//i.test(url) &&
      !url.startsWith(window.location.origin);
    if (url.includes('assets.meshy.ai') || isExternal) {
      loadUrl = getProxyAssetUrl(url);
    }
    const loader = new GLTFLoader();
    loader.load(
      loadUrl,
      (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const modelScale = maxDim > 0 ? 2 / maxDim : 1;
        gltf.scene.position.set(-center.x * modelScale, -center.y * modelScale, -center.z * modelScale);
        gltf.scene.scale.setScalar(modelScale * scale);
        setModel(gltf.scene);
        setLoading(false);
        onLoadRef.current?.();
      },
      (progress) => {
        setDownloadProgress({ loaded: progress.loaded, total: progress.total });
        if (progress.total > 0 && progress.loaded >= progress.total) {
          setLoadPhase('processing');
        }
      },
      (err) => {
        setLoading(false);
        onErrorRef.current?.(err);
      }
    );
  }, [url, scale]);

  useFrame((_, delta) => {
    if (modelRef.current) modelRef.current.rotation.y += delta * 0.3;
  });

  if (loading) {
    return (
      <Asset3DLoadingOverlay
        loaded={downloadProgress.loaded}
        total={downloadProgress.total}
        phase={loadPhase}
      />
    );
  }
  if (!model) return null;
  return (
    <group ref={modelRef} position={position}>
      <primitive object={model} />
    </group>
  );
}

/** Convert camera position (orbit around origin) to hlookat/vlookat degrees for sync */
function cameraToHlookatVlookat(position: THREE.Vector3): { h: number; v: number } {
  const x = position.x, y = position.y, z = position.z;
  const theta = Math.atan2(x, z) * (180 / Math.PI);
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  const phi = Math.asin(Math.max(-1, Math.min(1, y / r))) * (180 / Math.PI);
  return { h: theta, v: phi };
}

/** Apply teacher view (hlookat, vlookat) to camera position at given radius */
function applyTeacherViewToCamera(camera: THREE.PerspectiveCamera, h: number, v: number, radius: number): void {
  const theta = (h * Math.PI) / 180;
  const phi = (v * Math.PI) / 180;
  const x = radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.sin(phi);
  const z = radius * Math.cos(phi) * Math.cos(theta);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function LessonSceneIntegrated({
  skyboxUrl,
  assetUrl,
  onSkyboxLoad,
  onSkyboxError,
  onAssetLoad,
  onAssetError,
  onViewChange,
  teacherView,
  skyboxOptional = false,
}: {
  skyboxUrl: string;
  assetUrl: string | null;
  onSkyboxLoad?: () => void;
  onSkyboxError?: (err: any) => void;
  onAssetLoad?: () => void;
  onAssetError?: (err: any) => void;
  onViewChange?: (h: number, v: number, fov: number) => void;
  teacherView?: { hlookat: number; vlookat: number; fov?: number; sync_id?: number } | null;
  skyboxOptional?: boolean;
}) {
  const { camera } = useThree();
  const lastSentRef = useRef(0);
  const lastAppliedRef = useRef<{ h: number; v: number; fov: number; syncId: number | null } | null>(null);
  const lastLogRef = useRef(0);

  useFrame(() => {
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.fov === undefined) return; // orthographic or unsupported
    if (onViewChange) {
      const now = Date.now();
      if (now - lastSentRef.current < 100) return;
      lastSentRef.current = now;
      const { h, v } = cameraToHlookatVlookat(camera.position);
      const fov = persp.fov ?? 75;
      onViewChange(h, v, fov);
    }
    if (teacherView) {
      const h = Number(teacherView.hlookat);
      const v = Number(teacherView.vlookat);
      const fov = Number(teacherView.fov ?? 75);
      const syncId =
        typeof teacherView.sync_id === 'number' && Number.isFinite(teacherView.sync_id)
          ? teacherView.sync_id
          : null;
      if (Number.isNaN(h) || Number.isNaN(v)) return;
      const prev = lastAppliedRef.current;
      if (prev && prev.h === h && prev.v === v && prev.fov === fov && prev.syncId === syncId) return;
      lastAppliedRef.current = { h, v, fov, syncId };
      const radius = Math.max(0.1, camera.position.length());
      applyTeacherViewToCamera(persp, h, v, radius);
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development' && Date.now() - lastLogRef.current > 2000) {
        lastLogRef.current = Date.now();
        console.debug('[ViewSync] Student applying teacher view', { h, v, fov, radius });
      }
      if (persp.fov !== fov) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
    }
  }, 1);

  return (
    <>
      {skyboxUrl ? (
        <SkyboxSphereIntegrated imageUrl={skyboxUrl} onLoad={onSkyboxLoad} onError={onSkyboxError} />
      ) : skyboxOptional ? (
        <mesh>
          <sphereGeometry args={[500, 16, 16]} />
          <meshBasicMaterial color="#0a1628" side={THREE.BackSide} />
        </mesh>
      ) : null}
      {assetUrl && (
        <AssetModelInScene url={assetUrl} onLoad={onAssetLoad} onError={onAssetError} />
      )}
      <OrbitControls
        enabled={!teacherView}
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
  let location: ReturnType<typeof useLocation>;
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch (e) {
    throw new Error('Failed to initialize navigation');
  }

  const locationState = location?.state as { chapter?: any; topic?: any; selectedLanguage?: string } | undefined;
  const prepChapter = locationState?.chapter;
  const prepTopic = locationState?.topic;
  const prepLang = locationState?.selectedLanguage || 'en';
  
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

  // Class session (teacher view sync + student progress reporting)
  let classSession: ReturnType<typeof useClassSession> | null = null;
  try {
    classSession = useClassSession();
  } catch (e) {
    // Not inside ClassSessionProvider
  }
  const joinedSessionId = classSession?.joinedSessionId ?? null;
  const activeSessionId = classSession?.activeSessionId ?? null;
  const activeSession = classSession?.activeSession ?? null;
  const joinedSession = classSession?.joinedSession ?? null;
  const bindActiveSession = classSession?.bindActiveSession;
  const endSession = classSession?.endSession;
  const broadcastTeacherPhase = classSession?.broadcastTeacherPhase;
  const updateTeacherContentState = classSession?.updateTeacherContentState;
  const setSessionControl = classSession?.setSessionControl;
  const setStudentUiVisible = classSession?.setStudentUiVisible;
  const setTeacherPlayback = classSession?.setTeacherPlayback;
  const publishLobbyRoster = classSession?.publishLobbyRoster;
  const reportSignal = classSession?.reportSignal;
  const forceStudentsToLesson = classSession?.forceStudentsToLesson;
  const progressList = classSession?.progressList ?? [];

  // If the class was launched into the other player, move there rather than
  // splitting the class across two.
  useEnforcedPlayerRoute('krpano');

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

  // Preparation screen (when navigated from Lessons with state)
  const [preparationDone, setPreparationDone] = useState(false);
  const [prepLessonData, setPrepLessonData] = useState<any>(null);
  const [prepCountdown, setPrepCountdown] = useState(10);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const prepCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [prepVRCapabilities, setPrepVRCapabilities] = useState<any>(null);

  /** Set to true to show the teacher avatar panel in the scene (hidden for now to avoid console output). */
  const SHOW_TEACHER_AVATAR = false;

  // Load extra lesson data from sessionStorage or URL params (deep link from app)
  useEffect(() => {
    const initializeData = async () => {
      setInitPhase('loading-storage');
      
      try {
        // If opened from mobile WebView with idToken in hash, sign in so Firestore/asset loads work
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashMatch = window.location.hash.match(/[#&]idToken=([^&]+)/);
          const idToken = hashMatch ? decodeURIComponent(hashMatch[1]) : null;
          if (idToken) {
            try {
              const base = getApiBaseUrl().replace(/\/$/, '');
              const res = await fetch(`${base}/auth/custom-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
              });
              if (res.ok) {
                const { customToken } = await res.json();
                if (customToken) {
                  await signInWithCustomToken(auth, customToken);
                  const cleanUrl = window.location.pathname + window.location.search;
                  window.history.replaceState(null, '', cleanUrl);
                }
              }
            } catch (e) {
              console.warn('WebView idToken sign-in failed:', e);
            }
          }
        }

        // Give a small delay for context to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check sessionStorage first
        let stored = sessionStorage.getItem('activeLesson');
        
        // If no stored lesson, check URL params (e.g. from Flutter app deep link)
        if (!stored && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const sessionId = params.get('sessionId');
          let chapterId = params.get('chapterId');
          let topicId = params.get('topicId');
          const lang = params.get('lang') || 'en';
          let lessonSource = 'curriculum';
          if (sessionId) {
            // Hosts use active key; students need joined key for teacher_view follow.
            sessionStorage.setItem('learnxr_class_session_id', sessionId);
            if (!sessionStorage.getItem('learnxr_joined_session_id')) {
              sessionStorage.setItem('learnxr_joined_session_id', sessionId);
            }
          }
          if (sessionId && (!chapterId || !topicId)) {
            try {
              const sessionSnap = await getDoc(doc(db, 'class_sessions', sessionId));
              const sessionData = sessionSnap.data();
              const launched = sessionData?.launched_lesson;
              if (launched) {
                chapterId = chapterId || launched.chapter_id;
                topicId = topicId || launched.topic_id;
                if (launched.lesson_type === 'user_generated') lessonSource = 'user_generated';
              }
            } catch (e) {
              console.warn('Could not load session for URL sessionId:', e);
            }
          }
          if (chapterId && topicId) {
            try {
              const bundle = await getLessonBundle({ chapterId, topicId, lang, source: lessonSource });
              const fullData = bundle.chapter;
              const topic = fullData.topics?.find((t: any) => t.topic_id === topicId) || fullData.topics?.[0];
              if (!topic) { setInitPhase('ready'); setDataInitialized(true); return; }
              const scripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
              const bundleAssetInfo = collectBundleAssetUrls(Array.isArray(bundle.assets3d) ? bundle.assets3d : []);
              const assetUrls = bundleAssetInfo.urls;
              const assetIds = bundleAssetInfo.ids.length > 0
                ? bundleAssetInfo.ids
                : (Array.isArray(topic.asset_ids) ? [...topic.asset_ids] : []);
              const safeMcqs = Array.isArray(bundle.mcqs) ? bundle.mcqs : [];
              const mcqs = safeMcqs.map((m: any) => ({
                id: m.id || `mcq_${Math.random()}`,
                question: m.question || m.question_text || '',
                options: Array.isArray(m.options) ? m.options : [],
                correct_option_index: m.correct_option_index ?? 0,
                explanation: m.explanation || '',
              }));
              const safeTts = Array.isArray(bundle.tts) ? bundle.tts : [];
              const ttsAudio = safeTts
                .map((tts: any) => ({
                  id: tts.id || '',
                  script_type: tts.script_type || tts.section || 'full',
                  audio_url: tts.audio_url || tts.audioUrl || tts.url || '',
                  language: tts.language || tts.lang || lang,
                }))
                .filter((tts: any) => (tts.language || 'en').toLowerCase() === lang.toLowerCase());
              const skyboxUrl = bundle.skybox?.imageUrl || bundle.skybox?.file_url || topic.skybox_url || '';
              const skyboxGlb = bundle.skybox?.stored_glb_url || bundle.skybox?.glb_url || topic.skybox_glb_url || '';
              const fullLessonData = {
                chapter: {
                  chapter_id: String(chapterId),
                  chapter_name: fullData.chapter_name || 'Untitled Chapter',
                  chapter_number: Number(fullData.chapter_number) || 1,
                  curriculum: String(fullData.curriculum || ''),
                  class_name: String(fullData.class_name ?? ''),
                  subject: String(fullData.subject ?? ''),
                },
                topic: {
                  topic_id: String(topicId),
                  topic_name: topic.topic_name || 'Untitled Topic',
                  topic_priority: Number(topic.topic_priority) || 1,
                  learning_objective: topic.learning_objective || '',
                  skybox_id: bundle.skybox?.id ?? topic.skybox_id ?? null,
                  skybox_url: skyboxUrl,
                  skybox_glb_url: skyboxGlb,
                  avatar_intro: scripts.intro || '',
                  avatar_explanation: scripts.explanation || '',
                  avatar_outro: scripts.outro || '',
                  asset_urls: assetUrls,
                  asset_ids: assetIds,
                  mcq_ids: topic.mcq_ids || [],
                  mcqs,
                  tts_ids: topic.tts_ids || [],
                  ttsAudio,
                  language: lang,
                },
                image3dasset: fullData.image3dasset ?? null,
                assets3d: Array.isArray(bundle.assets3d) ? bundle.assets3d : [],
                startedAt: new Date().toISOString(),
                language: lang,
                ttsAudio,
              };
              sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
              stored = sessionStorage.getItem('activeLesson');
            } catch (urlErr) {
              console.warn('URL params lesson load failed:', urlErr);
            }
          }
        }
        
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

  // Preparation: fetch bundle and run 10s countdown when we have state from Lessons
  useEffect(() => {
    if (!prepChapter?.id || !prepTopic?.topic_id) return;

    setPrepLoading(true);
    setPrepError(null);
    setPrepLessonData(null);
    setPrepCountdown(10);

    (async () => {
      try {
        const [bundle, vrCap] = await Promise.all([
          getLessonBundle({
            chapterId: prepChapter.id,
            lang: prepLang,
            topicId: prepTopic.topic_id,
            ...(profile?.role === 'associate' && user?.uid ? { userId: user.uid, userRole: 'associate' } : {}),
          }),
          getVRCapabilities().catch(() => null),
        ]);
        setPrepVRCapabilities(vrCap);

        const fullData = bundle.chapter;
        const topic = fullData.topics?.find((t: any) => t.topic_id === prepTopic.topic_id) || prepTopic;
        const scripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
        const skyboxUrl = topic.skybox_url || topic.skybox_glb_url || bundle.skybox?.url || '';
        const learningObjective = typeof topic.learning_objective === 'string' ? topic.learning_objective : (topic.learning_objective?.en || topic.learning_objective?.hi || '');
        const safeAssets3d = Array.isArray(bundle.assets3d) ? bundle.assets3d : [];
        const bundleAssetInfo = collectBundleAssetUrls(safeAssets3d);
        let assetUrls = bundleAssetInfo.urls;
        const assetIds = bundleAssetInfo.ids.length > 0
          ? bundleAssetInfo.ids
          : (Array.isArray(topic.asset_ids) ? [...topic.asset_ids] : []);
        if (fullData.image3dasset?.imageasset_url || fullData.image3dasset?.imagemodel_glb) {
          const url = fullData.image3dasset.imagemodel_glb || fullData.image3dasset.imageasset_url;
          if (url && isSafeLessonGlbUrl(url)) assetUrls = [url, ...assetUrls];
        }
        const safeTts = Array.isArray(bundle.tts) ? bundle.tts : [];
        const ttsAudio = safeTts.map((tts: any) => ({
          id: tts.id || '',
          script_type: tts.script_type || 'full',
          audio_url: tts.audio_url || tts.audioUrl || tts.url || '',
          language: tts.language || tts.lang || prepLang,
          text: tts.script_text || tts.text || '',
        }));
        const safeMcqs = Array.isArray(bundle.mcqs) ? bundle.mcqs : [];
        const mcqs = safeMcqs.map((m: any) => ({
          id: m.id || `mcq_${Math.random()}`,
          question: m.question || m.question_text || '',
          options: Array.isArray(m.options) ? m.options : [],
          correct_option_index: m.correct_option_index ?? 0,
          explanation: m.explanation || '',
        }));

        const topicName = typeof topic.topic_name === 'string' ? topic.topic_name : (topic.topic_name?.en || topic.topic_name?.hi || 'Lesson');
        const chapterName = typeof fullData.chapter_name === 'string' ? fullData.chapter_name : (fullData.chapter_name?.en || fullData.chapter_name?.hi || 'Chapter');

        setPrepLessonData({
          chapter: {
            chapter_id: prepChapter.id,
            chapter_name: chapterName,
            chapter_number: fullData.chapter_number ?? prepChapter.chapter_number,
            curriculum: fullData.curriculum ?? prepChapter.curriculum,
            class_name: `Class ${fullData.class ?? prepChapter.class}`,
            subject: fullData.subject ?? prepChapter.subject,
          },
          topic: {
            topic_id: topic.topic_id,
            topic_name: topicName,
            topic_priority: topic.topic_priority ?? 1,
            learning_objective: learningObjective,
            in3d_prompt: topic.in3d_prompt || '',
            scene_type: topic.scene_type || 'narrative',
            skybox_id: bundle.skybox?.id ?? topic.skybox_id ?? null,
            skybox_url: skyboxUrl,
            avatar_intro: scripts.intro || '',
            avatar_explanation: scripts.explanation || '',
            avatar_outro: scripts.outro || '',
            asset_list: topic.asset_list || [],
            asset_urls: assetUrls,
            asset_ids: assetIds,
            mcqs,
          },
          image3dasset: fullData.image3dasset ?? null,
          ttsAudio,
          startedAt: new Date().toISOString(),
          _meta: {
            hasSkybox: !!skyboxUrl,
            hasScript: !!(scripts.intro || scripts.explanation || scripts.outro),
            hasAssets: assetUrls.length > 0 || !!fullData.image3dasset,
            hasMcqs: mcqs.length > 0,
            scriptSections: [scripts.intro, scripts.explanation, scripts.outro].filter(Boolean).length,
            assets3d: safeAssets3d,
          },
        });
      } catch (e) {
        console.error('Prep fetch error:', e);
        setPrepError(e instanceof Error ? e.message : 'Failed to load lesson');
      } finally {
        setPrepLoading(false);
      }
    })();

    prepCountdownRef.current = setInterval(() => {
      setPrepCountdown((prev) => {
        if (prev <= 1) {
          if (prepCountdownRef.current) {
            clearInterval(prepCountdownRef.current);
            prepCountdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (prepCountdownRef.current) {
        clearInterval(prepCountdownRef.current);
        prepCountdownRef.current = null;
      }
    };
  }, [prepChapter?.id, prepTopic?.topic_id, prepLang, profile?.role, user?.uid]);

  // Compute if lesson data is valid
  const isLessonDataValid = useMemo(() => {
    const fromContext = !!(activeLesson?.chapter?.chapter_id && activeLesson?.topic?.topic_id);
    const fromStorage = !!(extraLessonData?.chapter?.chapter_id && extraLessonData?.topic?.topic_id);
    return fromContext || fromStorage;
  }, [activeLesson, extraLessonData]);
  
  // Prefer extraLessonData when it has a newer tour stop / topic (loadTourStop updates extra, not always LessonContext)
  const effectiveLesson = useMemo(() => {
    const fromExtra =
      extraLessonData?.chapter && extraLessonData?.topic
        ? {
            chapter: extraLessonData.chapter,
            topic: extraLessonData.topic,
            startedAt: extraLessonData.startedAt || new Date().toISOString(),
          }
        : null;
    const fromContext =
      activeLesson?.chapter?.chapter_id && activeLesson?.topic?.topic_id ? activeLesson : null;

    if (fromExtra && fromContext) {
      const extraTopicId = String(fromExtra.topic?.topic_id || '');
      const ctxTopicId = String(fromContext.topic?.topic_id || '');
      if (extraTopicId && extraTopicId !== ctxTopicId) return fromExtra;
      if (fromExtra.topic?.isTourStop === true) {
        return {
          ...fromContext,
          chapter: fromExtra.chapter || fromContext.chapter,
          topic: { ...fromContext.topic, ...fromExtra.topic },
        };
      }
    }
    if (fromContext) return fromContext;
    return fromExtra;
  }, [activeLesson, extraLessonData]);

  // Refs
  const avatarRef = useRef<{ sendMessage: (text: string) => Promise<void> } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const krpanoContainerRef = useRef<HTMLDivElement>(null);
  type KrpanoViewer = {
    call?: (action: string) => void;
    get?: (name: string) => unknown;
    playsound_at_hotspot?: (name: string, url: string, hotspot: string, loop: boolean, volume: number, oncomplete?: () => void) => unknown;
    destroysound?: (name: string) => void;
  };
  const krpanoViewerRef = useRef<KrpanoViewer | null>(null);
  const krpanoFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const krpanoAssetLoadFailsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hotspotClickRef = useRef<((name: string) => void) | null>(null);
  const licensedAssetIndexRef = useRef<Map<string, number>>(new Map());
  const licensedModelActionRef = useRef<((assetId: string, transform?: number[]) => void) | null>(null);
  /** When true, current TTS session was started via krpano soundinterface (so pause/stop/cleanup must call destroysound) */
  const ttsPlayedViaKrpanoRef = useRef(false);
  /** In-flight TTS HEAD probe, cancelled when the phase changes. */
  const ttsProbeAbortRef = useRef<AbortController | null>(null);
  /** Bumped on every new playback so a late probe result can be discarded. */
  const ttsGenerationRef = useRef(0);
  /** Set when we embed krpano with avatar (so we use krpano for TTS when available) */
  const useKrpanoTTSRef = useRef(false);
  const ttsCompleteRef = useRef<() => void>(() => {});
  const ttsStatusRef = useRef<string>('idle');
  const showMcqResultRef = useRef(false);
  const pendingQuizReportRef = useRef<{ score: number; total: number; answers: SessionQuizAnswer[] } | null>(null);
  const immersiveUiActionRef = useRef<(action: string) => void>(() => {});
  // Spread the shared blank state so a new field added to LessonUiState cannot
  // leave this initialiser silently incomplete.
  const immersiveUiStateRef = useRef<KrpanoUiStatePayload>({ ...EMPTY_LESSON_UI_STATE });
  const classControlRef = useRef<{
    isHost: boolean;
    controlEnabled: boolean;
    isStudent: boolean;
    currentPhase: string;
    broadcastPhase?: (phase: string, controlEnabled: boolean) => Promise<boolean>;
  }>({
    isHost: false,
    controlEnabled: false,
    isStudent: false,
    currentPhase: 'intro',
  });
  const viewSyncSendRef = useRef<(h: number, v: number, fov: number) => void>(() => {});
  const [hostLookat, setHostLookat] = useState<{ hlookat: number; vlookat: number; fov: number } | null>(null);
  const [krpanoContainerMounted, setKrpanoContainerMounted] = useState(false);
  const [isQuestDevice, setIsQuestDevice] = useState(false);
  const [lastHotspotClicked, setLastHotspotClicked] = useState<string | null>(null);
  /** When true, enter VR as soon as krpano is ready (used when launching from prep with "Start in VR"). */
  const enterVRWhenReadyRef = useRef(false);
  /** When true, first TTS auto-play in VR should use 5s delay (cleared after use). */
  const vrEntryTtsDelayRef = useRef(false);

  // Skybox State
  const [skyboxData, setSkyboxData] = useState<SkyboxData | null>(null);
  const [skyboxLoading, setSkyboxLoading] = useState(true);
  const [skyboxError, setSkyboxError] = useState<string | null>(null);

  // Asset State - Platform-aware
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetDiscoveryComplete, setAssetDiscoveryComplete] = useState(false);
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
  // Starts false so a lesson LANDS IDLE: the scene renders, the avatar is silent,
  // and narration only begins when someone presses Play (the student when solo,
  // the teacher when in a live class session).
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [userPaused, setUserPaused] = useState(false); // Track if user manually paused
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // Prevent echo/double play
  const [lessonStage, setLessonStage] = useState<'intro' | 'explanation' | 'outro' | 'quiz' | 'completed'>('intro');
  const [waitingForUser, setWaitingForUser] = useState(false); // Wait for user to click "Continue"

  ttsStatusRef.current = ttsStatus;

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
  showMcqResultRef.current = showMcqResult;

  // UI State
  const [showDragHint, setShowDragHint] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  /** When true, krpano threejs 3D assets have had time to load (or there are none). Used so Start Lesson waits for 3D on Quest/Web. */
  const [krpano3dAssetsReady, setKrpano3dAssetsReady] = useState(true);
  /** How many of the krpano-native threejs 3D asset hotspots have fired onloaded, out of the total expected. */
  const [krpanoAssetLoadCount, setKrpanoAssetLoadCount] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
  const krpanoAssetLoadTotalRef = useRef(0);
  const krpanoLoadedAssetNamesRef = useRef<Set<string>>(new Set());

  // LMS Tracking State
  const [currentLaunchId, setCurrentLaunchId] = useState<string | null>(null);
  const [lessonStartTime, setLessonStartTime] = useState<number | null>(null);

  // Derived State - use effectiveLesson so dashboard-open (sessionStorage only) works
  const lessonId = effectiveLesson ? `${effectiveLesson.chapter?.chapter_id || 'unknown'}_${effectiveLesson.topic?.topic_id || 'unknown'}` : '';
  const scripts = effectiveLesson?.topic
    ? [
        effectiveLesson.topic.avatar_intro,
        effectiveLesson.topic.avatar_explanation,
        effectiveLesson.topic.avatar_outro,
      ].filter(Boolean) as string[]
    : [];
  const currentScript = scripts[currentScriptIndex] || '';
  
  // Use fetched MCQs, fallback to embedded MCQs from lesson data
  const mcqs = useMemo(() => {
    if (fetchedMCQs.length > 0) {
      // Convert ChapterMCQ to the format expected by the MCQ UI
      // Handle various field formats that might exist in Firestore
      return fetchedMCQs.map(mcq => {
        const options = extractMcqOptions(mcq as unknown as Record<string, unknown>);
        // The correct option comes from the backend, resolved in ONE place. This block
        // used to re-derive it and subtracted 1 to "convert 1-based DB to 0-based
        // frontend" — but every writer in this repo stores it 0-based, so that shift
        // scored B as A, C as B and D as C.
        const correctIndex = resolveCorrectAnswerIndex(
          mcq as unknown as Record<string, unknown>,
          options,
          'krpano-quiz'
        );

        return {
          id: mcq.id || `mcq_${Math.random().toString(36).substr(2, 9)}`,
          question: mcq.question || (mcq as any).question_text || '',
          options: options,
          correctAnswer: correctIndex, // 0-based, or -1 when the document does not say
          explanation: mcq.explanation || (mcq as any).explanation_text || '',
        };
      }).filter(mcq => mcq.question && mcq.options.length > 0); // Only include valid MCQs
    }
    // Fallback to embedded MCQs — same single resolver, no local index maths.
    const embeddedMcqs = activeLesson?.topic?.mcqs || [];
    return embeddedMcqs
      .filter((mcq: any) => mcq.question && mcq.options?.length > 0)
      .map((mcq: any) => {
        const options = extractMcqOptions(mcq);
        return {
          ...mcq,
          options,
          correctAnswer: resolveCorrectAnswerIndex(mcq, options, 'krpano-quiz'),
        };
      });
  }, [fetchedMCQs, activeLesson]);
  
  const currentMcq = mcqs[currentMcqIndex];

  /** Hide empty Intro/Learn/Summary + audio chrome unless lesson has real voiceover/script or quiz. */
  const hasLessonNarrationOrQuiz = useMemo(() => {
    const topic = effectiveLesson?.topic as Record<string, unknown> | undefined;
    const ttsAudio = Array.isArray(topic?.ttsAudio) ? (topic!.ttsAudio as Array<{ audio_url?: string; audioUrl?: string }>) : [];
    const hasStopVoiceover = ttsAudio.some((t) => Boolean(String(t?.audio_url || t?.audioUrl || '').trim()));
    const hasScripts = scripts.some((s) => typeof s === 'string' && s.trim().length > 0);
    const hasTtsAudio = ttsData.some((t) => Boolean(String(t.audioUrl || '').trim()));
    const hasQuiz = mcqs.length > 0;
    return hasScripts || hasStopVoiceover || hasTtsAudio || hasQuiz;
  }, [scripts, ttsData, effectiveLesson?.topic, mcqs.length]);

  // All content ready: skybox, 3D assets (in krpano), TTS, and script data must be loaded before Start Lesson (Quest + Web).
  // Broken out per stage (rather than folded straight into a boolean) so the loading bar can
  // report which stage is outstanding from the same source of truth that gates the button —
  // otherwise the two drift and the bar shows 100% next to a disabled Start Lesson.
  const loadStages = useMemo(() => {
    const skyboxUrl = skyboxData?.imageUrl || skyboxData?.file_url;
    const skyboxReady = skyboxUrl ? sceneReady : !skyboxLoading;
    const hasGlbAsset = !!(assetUrl && isGlbOrGltfUrl(assetUrl));
    const assetReady = hasGlbAsset ? (!assetLoading || !!skyboxUrl) : true;
    const narrationReady =
      ttsStatus !== 'loading' &&
      (ttsStatus === 'ready' || ttsStatus === 'playing' || ttsStatus === 'paused' || ttsData.length === 0);
    const lessonDataReady = !effectiveLesson || !!effectiveLesson.topic;
    return {
      lessonDataReady,
      assetReady,
      skyboxReady,
      narrationReady,
      modelsReady: krpano3dAssetsReady,
      modelsLoaded: krpanoAssetLoadCount.loaded,
      modelsTotal: krpanoAssetLoadCount.total,
    };
  }, [
    skyboxData,
    skyboxLoading,
    sceneReady,
    ttsStatus,
    ttsData.length,
    assetUrl,
    assetLoading,
    effectiveLesson,
    krpano3dAssetsReady,
    krpanoAssetLoadCount.loaded,
    krpanoAssetLoadCount.total,
  ]);

  const allReady = useMemo(
    () =>
      loadStages.lessonDataReady &&
      loadStages.assetReady &&
      loadStages.skyboxReady &&
      loadStages.narrationReady &&
      loadStages.modelsReady,
    [loadStages]
  );
  
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
        // The chat thread is optional — the lesson plays fully without it. A 503 means the
        // assistant provider is refusing us (quota/rate limit/key), which is an operational
        // state rather than an application fault, so report it as a warning with the reason
        // the server now sends back instead of a red console error on every lesson load.
        const status = error?.response?.status;
        const reason = error?.response?.data?.reason;
        if (status === 503) {
          console.warn(
            `[VRPlayer] Assistant chat unavailable (${reason || 'upstream error'}) — continuing without chat.`
          );
        } else {
          console.error('Failed to initialize chat thread:', error);
        }
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
      // Use effectiveLesson so we get topic from sessionStorage when activeLesson is null (e.g. on refresh)
      const topic = effectiveLesson?.topic;
      if (!topic && !extraLessonData) {
        setSkyboxLoading(false);
        return;
      }
      
      setSkyboxLoading(true);
      setSkyboxError(null);
      // Prefer extraLessonData skybox when tour stop navigation has advanced past LessonContext
      const skyboxUrl =
        (extraLessonData as any)?.topic?.skybox_url ||
        (extraLessonData as any)?.skybox_url ||
        topic?.skybox_url ||
        topic?.sharedAssets?.skybox_url ||
        '';
      const skyboxId =
        (extraLessonData as any)?.topic?.skybox_id ||
        topic?.skybox_id ||
        topic?.sharedAssets?.skybox_id ||
        (extraLessonData as any)?.skybox_id ||
        '';
      const hasSkybox = !!(skyboxUrl || skyboxId);
      if (hasSkybox) {
        setSceneReady(false);
      }
      if (!topic && !skyboxUrl && !skyboxId) {
        setSkyboxLoading(false);
        return;
      }
      
      if (skyboxUrl) {
        setSkyboxData({
          id: skyboxId || 'direct_url',
          imageUrl: skyboxUrl,
          file_url: skyboxUrl,
          status: 'complete',
        });
        setSkyboxLoading(false);
        return;
      }
      
      if (skyboxId) {
        const data = await fetchSkyboxFromFirestore(skyboxId);
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
  }, [effectiveLesson, extraLessonData]);

  // When there is no skybox to load, mark scene ready so we don't block Start Lesson
  useEffect(() => {
    const skyboxUrl = skyboxData?.imageUrl || skyboxData?.file_url;
    if (!skyboxLoading && !skyboxUrl) {
      setSceneReady(true);
    }
  }, [skyboxLoading, skyboxData]);

  // Detect Meta Quest / mobile. This decides whether the device COULD show the in-headset
  // panel at all; whether it actually does is decided below, from class control state.
  const [immersiveUiDeviceCapable, setImmersiveUiDeviceCapable] = useState(false);
  useEffect(() => {
    const quest = isMetaQuestBrowser();
    setIsQuestDevice(quest);

    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    setImmersiveUiDeviceCapable(quest || isMobile);
  }, []);

  // Embed krpano when we have skybox and container is mounted (with or without 3D assets; 3D via threejs plugin)
  useEffect(() => {
    const skyboxUrl = skyboxData?.imageUrl || skyboxData?.file_url;
    if (!skyboxUrl || !krpanoContainerRef.current || !krpanoContainerMounted) return;
    if (!assetDiscoveryComplete) {
      setSceneReady(false);
      setKrpano3dAssetsReady(false);
      log('...', 'Waiting for 3D asset discovery before embedding krpano');
      return;
    }

    let cancelled = false;
    // immersive_ui.xml draws through this; without it the panel stays blank.
    const uninstallLessonPanelRenderer = installLessonPanelRenderer();
    const immersiveUiBridge = (action: string) => immersiveUiActionRef.current(action);
    const hotspotBridge = (name: string) => hotspotClickRef.current?.(name);
    const licensedModelBridge = (assetId: string) => licensedModelActionRef.current?.(String(assetId || ''));
    const licensedModelTransformBridge = (assetId: string, ...transform: number[]) =>
      licensedModelActionRef.current?.(String(assetId || ''), transform.map(Number));
    const ttsCompleteBridge = () => ttsCompleteRef.current?.();
    const assetLoadedBridge = (name: string) => {
      if (!name || krpanoLoadedAssetNamesRef.current.has(name)) return;
      krpanoLoadedAssetNamesRef.current.add(name);
      const loaded = krpanoLoadedAssetNamesRef.current.size;
      const total = krpanoAssetLoadTotalRef.current;
      console.log('[VRPlayer] krpano threejs hotspot onloaded fired:', name, `${loaded}/${total}`);
      setKrpanoAssetLoadCount({ loaded, total });
      if (total > 0 && loaded >= total) {
        setKrpano3dAssetsReady(true);
        if (krpanoAssetLoadFailsafeTimerRef.current) {
          clearTimeout(krpanoAssetLoadFailsafeTimerRef.current);
          krpanoAssetLoadFailsafeTimerRef.current = null;
        }
      }
    };
    const immersiveUiUpdateBridge = (state: KrpanoUiStatePayload) => {
      (window as unknown as Record<string, unknown>).__krpanoUIState = {
        initialized: true,
        phase: state.phase ?? 'intro',
        script: state.script ?? '',
        ttsStatus: state.ttsStatus ?? 'idle',
        question: state.question ?? '',
        options: state.options.join('||'),
        showQuiz: state.showQuiz === true,
        showResult: state.showResult === true,
        scoreLabel: state.scoreLabel ?? '',
        selectedAnswer: state.selectedAnswer ?? -1,
        waitingForUser: state.waitingForUser === true,
        isPlayingAudio: state.isPlayingAudio === true,
        modelPartCount: state.modelPartCount ?? 0,
        currentMcqIndex: state.currentMcqIndex ?? 0,
        totalMcqs: state.totalMcqs ?? 0,
        correctAnswer: state.correctAnswer ?? -1,
        explanation: state.explanation ?? '',
        controlStudentsEnabled: state.controlStudentsEnabled === true,
        isStudent: state.isStudent === true,
        isHost: state.isHost === true,
      };
      const viewer = krpanoViewerRef.current;
      if (!viewer?.call) return;
      try {
        viewer.call('immersive_ui_update()');
      } catch (err) {
        console.warn('[KrpanoUI] Failed to update canvas UI fallback:', err);
      }
      try {
        viewer.call('native_vr_lesson_ui_update()');
      } catch (err) {
        console.warn('[KrpanoUI] Failed to update native VR lesson UI:', err);
      }
    };
    krpanoViewerRef.current = null;
    (window as unknown as { __krpanoUIAction?: (action: string) => void }).__krpanoUIAction = immersiveUiBridge;
    (window as unknown as { __krpanoUIUpdate?: (state: KrpanoUiStatePayload) => void }).__krpanoUIUpdate = immersiveUiUpdateBridge;
    (window as unknown as { __krpanoOnHotspotClick?: (name: string) => void }).__krpanoOnHotspotClick = hotspotBridge;
    (window as unknown as { __krpanoOnAssetLoaded?: (name: string) => void }).__krpanoOnAssetLoaded = assetLoadedBridge;
    (window as unknown as { __krpanoLicensedModelAction?: (assetId: string) => void }).__krpanoLicensedModelAction = licensedModelBridge;
    (window as unknown as { __krpanoLicensedModelTransform?: (assetId: string, ...transform: number[]) => void }).__krpanoLicensedModelTransform = licensedModelTransformBridge;
    (window as unknown as { __krpanoOnTTSComplete?: () => void }).__krpanoOnTTSComplete = ttsCompleteBridge;
    immersiveUiUpdateBridge(immersiveUiStateRef.current);
    if (krpanoFallbackTimerRef.current) {
      clearTimeout(krpanoFallbackTimerRef.current);
      krpanoFallbackTimerRef.current = null;
    }
    if (krpanoAssetLoadFailsafeTimerRef.current) {
      clearTimeout(krpanoAssetLoadFailsafeTimerRef.current);
      krpanoAssetLoadFailsafeTimerRef.current = null;
    }
    // Guided lookto & hotspots from lesson topic (optional)
    const lookatByPhase: LookatByPhase | undefined = extraLessonData?.topic?.lookatByPhase;
    let hotspots: KrpanoHotspotOption[] = Array.isArray(extraLessonData?.topic?.hotspots)
      ? extraLessonData.topic.hotspots
      : [];

    // Test mode: add demo hotspots when URL has ?krpanoTest=1 so you can verify clicks without bundle data
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (searchParams?.get('krpanoTest') === '1' && hotspots.length === 0) {
      hotspots = [
        { name: 'test_left', ath: 45, atv: 5, label: 'Test hotspot (left)' },
        { name: 'test_right', ath: -60, atv: -10, label: 'Test hotspot (right)' },
        { name: 'test_center', ath: 0, atv: 0, label: 'Center point' },
      ];
      log('🧪', 'Test mode: added 3 demo hotspots (use ?krpanoTest=1 in URL)');
    }

    // Use proxy for external skybox URLs to avoid CORS (krpano loads image cross-origin)
    const sphereUrlForKrpano = isFirebaseStorageAssetUrl(skyboxUrl)
      ? skyboxUrl
      : getProxyAssetUrl(skyboxUrl);

    // Street View Tour: author-specified floating-asset placements (ath/atv/depth), keyed by
    // meshy_assets doc id — set on the active stop's synthetic topic (see getLessonBundle.ts).
    const stopAssetPlacements: Array<{ assetId?: string; url?: string; ath?: number; atv?: number; depth?: number; scale?: number; rotationY?: number }> =
      Array.isArray(extraLessonData?.topic?.assetPlacements) ? extraLessonData.topic.assetPlacements : [];
    const placementByAssetId = new Map(stopAssetPlacements.filter((p) => p.assetId).map((p) => [p.assetId, p]));
    const placementByUrl = new Map(stopAssetPlacements.filter((p) => p.url).map((p) => [p.url, p]));

    // Collect GLB/GLTF URLs for threejs plugin (proxy non-Firebase for CORS), paired with any
    // author-specified placement. Include all sources so student view gets same 3D assets as teacher.
    const rawAssetEntries: Array<{ id: string; url: string; placement?: { ath?: number; atv?: number; depth?: number; scale?: number; rotationY?: number } }> = [];
    if (assetUrl && isSafeLessonGlbUrl(assetUrl)) rawAssetEntries.push({ id: 'primary_asset', url: assetUrl });
    const hasBundle3dAssets = extraLessonData?.assets3d && Array.isArray(extraLessonData.assets3d) && extraLessonData.assets3d.length > 0;
    if (hasBundle3dAssets) {
      for (const a of extraLessonData.assets3d) {
        const glb = pickBestGlbUrl(a);
        if (glb && isGlbOrGltfUrl(glb) && !rawAssetEntries.some((e) => e.url === glb)) {
          rawAssetEntries.push({ id: String(a.id || `bundle_asset_${rawAssetEntries.length}`), url: glb, placement: placementByAssetId.get(a.id) || placementByUrl.get(glb) });
        }
      }
    }
    if (meshyAssets.length > 0) {
      for (const a of meshyAssets) {
        const glb = pickBestGlbUrl(a);
        if (glb && isGlbOrGltfUrl(glb) && !rawAssetEntries.some((e) => e.url === glb)) {
          rawAssetEntries.push({ id: String(a.id || `meshy_asset_${rawAssetEntries.length}`), url: glb, placement: placementByAssetId.get(a.id) || placementByUrl.get(glb) });
        }
      }
    }
    if (rawAssetEntries.length > 0) {
      setKrpano3dAssetsReady(false);
    }
    krpanoLoadedAssetNamesRef.current = new Set();
    krpanoAssetLoadTotalRef.current = 0;
    setKrpanoAssetLoadCount({ loaded: 0, total: 0 });

    loadKrpanoScript()
      .then(async () => {
        if (cancelled) return;
        const hasRenderAssetUrls = rawAssetEntries.some((e) => isRenderAssetUrl(e.url));
        const renderAssetBridgeReady = hasRenderAssetUrls ? await ensureRenderAssetBridgeReady() : false;
        if (cancelled) return;

        const preparedEntries: Array<{ id: string; url: string; placement?: { ath?: number; atv?: number; depth?: number; scale?: number; rotationY?: number } }> = [];

        for (const entry of rawAssetEntries) {
          if (isRenderAssetUrl(entry.url)) {
            if (renderAssetBridgeReady) {
              preparedEntries.push({ id: entry.id, url: toRenderAssetBridgeUrl(entry.url), placement: entry.placement });
            } else {
              console.warn('[VRPlayer] Skipping Firebase render asset because the render bridge is not ready:', entry.url);
            }
          } else {
            preparedEntries.push({ id: entry.id, url: toKrpanoThreeJsAssetUrl(entry.url), placement: entry.placement });
          }
        }

        // Address hotspots by the index the XML builder will actually use. It applies its own
        // GLB filter, so deriving indices from a differently-filtered list meant a later
        // scale correction could land on the wrong model.
        const validEntries = selectKrpano3dEntries(preparedEntries.filter((e) => !!e.url));
        const threeJsAssetUrls = validEntries.map((e) => e.url);
        // No scale is computed here any more.
        //
        // Predicting one before the model existed is what produced the "assets render huge"
        // bug: the prediction divided a centimetre target by a metre dimension, so every
        // measured asset came out 100x too large, and an unmeasured one fell back to scale=1
        // (raw glTF units — a 23,380-unit asset became a ~23 km object).
        //
        // Instead each hotspot is measured from the geometry krpano actually loaded and fitted
        // in that same space, by normalizeAssetHotspot in the load poll below — which is what
        // XRLessonPlayerV3 and AssetViewerWithSkybox have always done. An author-specified
        // scale still wins and is passed straight through.
        //
        // Assets sharing the default arc shrink once the arc gets crowded, so they are fitted
        // to that adjusted angle. Author-placed assets sit off the arc and get the full size.
        const arcAngularSize = angularSizeForCount(
          validEntries.filter((e) => e.placement?.ath === undefined && e.placement?.atv === undefined).length
        );
        const angularSizeForEntry = (entry: { placement?: { ath?: number; atv?: number } }) =>
          entry.placement?.ath === undefined && entry.placement?.atv === undefined
            ? arcAngularSize
            : ASSET_ANGULAR_SIZE_DEG;
        const assetPlacements = validEntries.map((e) => e.placement);
        const assetInteractionIds = validEntries.map((e) => e.id);
        licensedAssetIndexRef.current = new Map(assetInteractionIds.map((id, index) => [id, index]));
        krpanoAssetLoadTotalRef.current = threeJsAssetUrls.length;
        setKrpanoAssetLoadCount({ loaded: 0, total: threeJsAssetUrls.length });
        if (threeJsAssetUrls.length === 0) {
          setKrpano3dAssetsReady(true);
        }
        console.log('[VRPlayer] Prepared krpano 3D asset URLs:', threeJsAssetUrls);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const avatarModelUrl = origin + '/models/avatar3.glb';
        useKrpanoTTSRef.current = true;
        const xml = buildKrpanoXml({
          sphereUrl: sphereUrlForKrpano,
          basePath: '/krpano/',
          origin,
          webvr: true,
          lookatByPhase,
          hotspots,
          threeJsAssetUrls: threeJsAssetUrls.length > 0 ? threeJsAssetUrls : undefined,
          assetInteractionIds: threeJsAssetUrls.length > 0 ? assetInteractionIds : undefined,
          assetPlacements: threeJsAssetUrls.length > 0 ? assetPlacements : undefined,
          avatarModelUrl,
        });
        // #region agent log
        console.warn('[DBG-5a606f] XML built, immersiveUI hotspots present:', xml.includes('iu_panel_3d'), 'threejs plugin present:', xml.includes('threejs_krpanoplugin'), 'webvr include:', xml.includes('webvr.xml'), 'native UI include:', xml.includes('native_vr_lesson_ui.xml'));
        // #endregion
        embedKrpano({
          xml,
          target: KRPANO_CONTAINER_ID,
          id: 'krpanoLessonViewer',
          basepath: '/krpano/',
          onready: (krpano: unknown) => {
            if (!cancelled) {
              krpanoViewerRef.current = krpano as KrpanoViewer;
              (window as unknown as { __krpanoLessonViewer?: KrpanoViewer }).__krpanoLessonViewer = krpano as KrpanoViewer;
              // A fresh viewer starts unlocked. Without this, a suspend left behind by a
              // destroyed viewer (holders is module-scoped) silently disables panning here.
              resetUserControl(krpano as KrpanoViewer);
              try {
                // controls3d.xml links control.dragscale to view.oz, which evaluates to 0
                // at the default oz and is the only global drag override in the stack.
                (krpano as KrpanoViewer).call?.('set(control.dragscale, 1.0);');
              } catch { /* non-fatal */ }
              setSceneReady(true);
              // onready fired, so the "viewer never initialised" fallback below has done its
              // job and must be cancelled. Leaving it armed was the cause of 3D assets
              // appearing long after the progress bar hit 100%: the fallback unconditionally
              // called setKrpano3dAssetsReady(true) at 12s, unblocking Enter Lesson while the
              // GLB was still downloading, so the model popped in whenever it eventually
              // finished. The viewer being ready says nothing about whether models have loaded.
              if (krpanoFallbackTimerRef.current) {
                clearTimeout(krpanoFallbackTimerRef.current);
                krpanoFallbackTimerRef.current = null;
              }
              // Sizing happens in the load poll below, once the model exists and can be
              // measured. Nothing to pre-correct here any more.
              if (threeJsAssetUrls.length > 0) {
                // Confirmed via diagnostic instrumentation: this plugin's `onloaded` XML
                // attribute does not fire for real-GLB type="threejs" hotspots (only
                // verified working on url="custom" hotspots like iu_panel_3d). So real
                // completion is detected by polling hotspot[name].loaded directly via
                // krpano's get() API instead — confirmed reliable by that same diagnostic.
                // assetLoadedBridge/__krpanoOnAssetLoaded stays wired as a harmless
                // no-cost fallback in case a future plugin build does fire it.
                const nameToEntryIndex = new Map(
                  validEntries.map((_, i) => [krpanoAssetHotspotName(i), i] as const)
                );
                const pendingHotspotNames = new Set(nameToEntryIndex.keys());
                const pollStart = Date.now();
                // How many polls to keep waiting for threejsobject to appear before giving up
                // on an asset. At 1.5s a tick this is ~9s after the hotspot reports loaded.
                const MAX_NORMALIZE_ATTEMPTS = 6;
                const normalizeAttempts = new Map<string, number>();
                const pollLoadedHotspots = () => {
                  if (cancelled || pendingHotspotNames.size === 0) return;
                  const viewer = krpanoViewerRef.current;
                  if (viewer?.get) {
                    for (const name of Array.from(pendingHotspotNames)) {
                      let loaded: unknown;
                      try {
                        loaded = viewer.get(`hotspot[${name}].loaded`);
                      } catch {
                        loaded = undefined;
                      }
                      if (loaded === true || loaded === 'true') {
                        // Size and centre it from the geometry that just loaded, then reveal.
                        // The hotspot was emitted hidden precisely so this happens first and
                        // an unnormalised model is never on screen. Author-scaled assets skip
                        // sizing but must still be revealed.
                        const entryIndex = nameToEntryIndex.get(name);
                        const entry = entryIndex !== undefined ? validEntries[entryIndex] : undefined;
                        if (entry && entry.placement?.scale === undefined) {
                          try {
                            const result = normalizeAssetHotspot(
                              viewer as never,
                              name,
                              angularSizeForEntry(entry)
                            );
                            if (result) {
                              console.log('[VRPlayer] Normalized 3D asset', name, result);
                            } else {
                              // threejsobject is not exposed yet. Try again on the next tick
                              // rather than revealing something unsized — but do not wait
                              // forever, or one unmeasurable asset holds the lesson gate shut.
                              const attempts = (normalizeAttempts.get(name) ?? 0) + 1;
                              normalizeAttempts.set(name, attempts);
                              if (attempts < MAX_NORMALIZE_ATTEMPTS) continue;

                              // Give up: leave it hidden and let the lesson proceed. A missing
                              // asset is a far better outcome than one rendered at native glTF
                              // units, which is what filled the scene before.
                              console.warn(
                                '[VRPlayer] Could not measure 3D asset after',
                                attempts,
                                'attempts; leaving it hidden:',
                                name
                              );
                              pendingHotspotNames.delete(name);
                              assetLoadedBridge(name);
                              continue;
                            }
                          } catch (err) {
                            console.warn('[VRPlayer] Failed to normalize 3D asset:', name, err);
                          }
                        }
                        try {
                          revealAssetHotspot(viewer as never, name);
                        } catch (err) {
                          console.warn('[VRPlayer] Failed to reveal 3D asset:', name, err);
                        }

                        pendingHotspotNames.delete(name);
                        console.log('[VRPlayer] krpano hotspot confirmed loaded (polled):', name);
                        assetLoadedBridge(name);
                      }
                    }
                  }
                  if (pendingHotspotNames.size > 0 && Date.now() - pollStart < 90000) {
                    setTimeout(pollLoadedHotspots, 1500);
                  }
                };
                setTimeout(pollLoadedHotspots, 1500);

                // Failsafe only, in case polling never detects completion (e.g. .loaded
                // isn't a real property on this hotspot type either) — long enough not
                // to cut off a legitimately large/slow asset.
                krpanoAssetLoadFailsafeTimerRef.current = setTimeout(() => {
                  if (!cancelled) setKrpano3dAssetsReady(true);
                  krpanoAssetLoadFailsafeTimerRef.current = null;
                }, 90000);
              } else {
                setKrpano3dAssetsReady(true);
              }
            }
          },
          onerror: (msg) => {
            if (!cancelled) {
              setSkyboxError(msg || 'Failed to load 360° viewer');
              setSceneReady(true);
              setKrpano3dAssetsReady(true);
            }
          },
        });

        // Fallback for the viewer itself never initialising (e.g. plugin load hang). Cancelled
        // as soon as onready fires — see above. It deliberately does NOT touch
        // krpano3dAssetsReady when models are still outstanding: model loading has its own
        // completion tracking (polling + onloaded) and its own 90s failsafe, and short-circuiting
        // it here is what made "Enter Lesson" appear before the 3D asset was actually in the scene.
        krpanoFallbackTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setSceneReady((prev) => (prev ? prev : true));
            if (krpanoAssetLoadTotalRef.current === 0) {
              setKrpano3dAssetsReady(true);
            }
          }
          krpanoFallbackTimerRef.current = null;
        }, 12000);
      })
      .catch((err) => {
        if (!cancelled) {
          setSkyboxError(err?.message || 'Failed to load 360° viewer');
          setSceneReady(true);
          setKrpano3dAssetsReady(true);
        }
      });

    return () => {
      cancelled = true;
      setKrpano3dAssetsReady(true);
      useKrpanoTTSRef.current = false;
      if (krpanoFallbackTimerRef.current) {
        clearTimeout(krpanoFallbackTimerRef.current);
        krpanoFallbackTimerRef.current = null;
      }
      if (krpanoAssetLoadFailsafeTimerRef.current) {
        clearTimeout(krpanoAssetLoadFailsafeTimerRef.current);
        krpanoAssetLoadFailsafeTimerRef.current = null;
      }
      const viewer = krpanoViewerRef.current ?? (document.getElementById('krpanoLessonViewer') as unknown as KrpanoViewer | null);
      try {
        viewer?.call('xr_input_cleanup()');
      } catch (err) {
        console.warn('[KrpanoUI] Failed to clean up XR input:', err);
      }
      try {
        viewer?.call('immersive_ui_cleanup()');
      } catch (err) {
        console.warn('[KrpanoUI] Failed to clean up immersive lesson UI:', err);
      }
      try {
        viewer?.call('native_vr_lesson_ui_cleanup()');
      } catch (err) {
        console.warn('[KrpanoUI] Failed to clean up native VR lesson UI:', err);
      }
      try { resetUserControl(krpanoViewerRef.current); } catch { /* ignore */ }
      krpanoViewerRef.current = null;
      licensedAssetIndexRef.current = new Map();
      (window as unknown as { __krpanoLessonViewer?: unknown }).__krpanoLessonViewer = undefined;
      if ((window as unknown as { __krpanoOnHotspotClick?: unknown }).__krpanoOnHotspotClick === hotspotBridge) {
        (window as unknown as { __krpanoOnHotspotClick?: unknown }).__krpanoOnHotspotClick = undefined;
      }
      if ((window as unknown as { __krpanoOnAssetLoaded?: unknown }).__krpanoOnAssetLoaded === assetLoadedBridge) {
        (window as unknown as { __krpanoOnAssetLoaded?: unknown }).__krpanoOnAssetLoaded = undefined;
      }
      if ((window as unknown as { __krpanoOnTTSComplete?: unknown }).__krpanoOnTTSComplete === ttsCompleteBridge) {
        (window as unknown as { __krpanoOnTTSComplete?: unknown }).__krpanoOnTTSComplete = undefined;
      }
      if ((window as unknown as { __krpanoLicensedModelAction?: unknown }).__krpanoLicensedModelAction === licensedModelBridge) {
        (window as unknown as { __krpanoLicensedModelAction?: unknown }).__krpanoLicensedModelAction = undefined;
      }
      if ((window as unknown as { __krpanoLicensedModelTransform?: unknown }).__krpanoLicensedModelTransform === licensedModelTransformBridge) {
        (window as unknown as { __krpanoLicensedModelTransform?: unknown }).__krpanoLicensedModelTransform = undefined;
      }
      if ((window as unknown as { __krpanoUIAction?: unknown }).__krpanoUIAction === immersiveUiBridge) {
        (window as unknown as { __krpanoUIAction?: unknown }).__krpanoUIAction = undefined;
      }
      if ((window as unknown as { __krpanoUIUpdate?: unknown }).__krpanoUIUpdate === immersiveUiUpdateBridge) {
        (window as unknown as { __krpanoUIUpdate?: unknown }).__krpanoUIUpdate = undefined;
        (window as unknown as { __krpanoUIState?: unknown }).__krpanoUIState = undefined;
      }
      (window as unknown as { __krpanoNativeVrUiControllerButton?: unknown }).__krpanoNativeVrUiControllerButton = undefined;
      (window as unknown as { native_vr_lesson_ui_click?: unknown }).native_vr_lesson_ui_click = undefined;
      (window as unknown as { native_vr_lesson_ui_hover?: unknown }).native_vr_lesson_ui_hover = undefined;
      uninstallLessonPanelRenderer();
      removeKrpano(KRPANO_CONTAINER_ID);
    };
  }, [skyboxData?.imageUrl, skyboxData?.file_url, krpanoContainerMounted, assetDiscoveryComplete, assetUrl, meshyAssets, extraLessonData, effectiveLesson]);

  // Hotspot click handler: keep ref updated so krpano callback can trigger React state
  useEffect(() => {
    hotspotClickRef.current = (name: string) => {
      setLastHotspotClicked(name);
      log('📍', 'Hotspot clicked', name);
    };
    return () => {
      hotspotClickRef.current = null;
    };
  }, []);

  // Clear hotspot-click message after a short delay
  useEffect(() => {
    if (!lastHotspotClicked) return;
    const t = setTimeout(() => setLastHotspotClicked(null), 3000);
    return () => clearTimeout(t);
  }, [lastHotspotClicked]);

  const isTeacherInSession = Boolean(activeSessionId && activeSession && user?.uid && activeSession.teacher_uid === user.uid);


  const partnerSessionMeta = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('learnxr_partner_demo_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { code?: string; id?: string };
      if (!parsed?.id && !parsed?.code) return null;
      return {
        id: typeof parsed.id === 'string' ? parsed.id : null,
        code: typeof parsed.code === 'string' ? parsed.code : null,
      };
    } catch {
      return null;
    }
  }, [activeSessionId, activeSession?.session_code, profile?.role]);

  const hostSessionCode = useMemo(() => {
    if (activeSession?.session_code) return activeSession.session_code;
    return partnerSessionMeta?.code || null;
  }, [activeSession?.session_code, partnerSessionMeta?.code]);

  const isClassHost = Boolean(
    isTeacherInSession ||
      (profile?.role === 'partner' && (partnerSessionMeta?.id || partnerSessionMeta?.code || activeSession?.hosted_by_partner)) ||
      (activeSessionId &&
        activeSession &&
        user?.uid &&
        (activeSession.teacher_uid === user.uid ||
          (profile?.role === 'partner' && activeSession.hosted_by_partner === true)))
  );

  /**
   * Which 3D scene is this, stably?
   *
   * Model state used to be keyed on `licensedContent.id`, which is set only by
   * buildNativeLicensedLesson() — i.e. Immersive-STEM lessons. Both the writer and the
   * student applier required it, so on an ordinary Meshy/bundle GLB lesson NOTHING a
   * teacher did to a model was ever broadcast; the drag stayed in their own browser with no
   * error anywhere. `launch_id` exists for every launched lesson, so key on that and keep
   * the licensed id as a fallback for sessions already in flight.
   */
  const hostSceneKey =
    activeSession?.launched_lesson?.launch_id || extraLessonData?.licensedContent?.id || null;
  const studentSceneKey =
    joinedSession?.launched_lesson?.launch_id || extraLessonData?.licensedContent?.id || null;

  useEffect(() => {
    licensedModelActionRef.current = (assetId: string, transform?: number[]) => {
      if (!assetId) return;
      setLastHotspotClicked(assetId);
      // isClassHost, not isTeacherInSession: the latter matches teacher_uid only and so
      // silently excluded partner hosts — the same gate that stopped them ending a session.
      if (!isClassHost || !hostSceneKey || !updateTeacherContentState) return;
      const prevState = activeSession?.teacher_content_state ?? null;
      const prevKey = prevState?.scene_key || prevState?.licensed_content_id || null;
      const previous = prevKey === hostSceneKey ? prevState : null;
      const hasTransform = Array.isArray(transform) && transform.length >= 7 && transform.every(Number.isFinite);
      void updateTeacherContentState({
        scene_key: hostSceneKey,
        // Still written so a student on an older build keeps working.
        licensed_content_id: extraLessonData?.licensedContent?.id || hostSceneKey,
        revision: extraLessonData?.licensedContent?.revision,
        selected_part_id: assetId,
        selected_part_name: previous?.selected_part_name ?? null,
        visible_layer_ids: previous?.visible_layer_ids || [],
        exploded: previous?.exploded ?? 0,
        isolated: previous?.isolated ?? false,
        clip: previous?.clip ?? null,
        animation_clip: previous?.animation_clip || null,
        animation_time: previous?.animation_time || 0,
        animation_playing: previous?.animation_playing || false,
        ...(hasTransform ? {
          model_transform: {
            position: [transform[0], transform[1], transform[2]],
            rotation: [transform[3], transform[4], transform[5]],
            scale: [transform[6], transform[6], transform[6]],
          },
        } : previous?.model_transform ? { model_transform: previous.model_transform } : {}),
        locked: activeSession?.control_students_enabled === true,
        sync_id: Date.now(),
      });
    };
    return () => { licensedModelActionRef.current = null; };
  }, [activeSession?.control_students_enabled, activeSession?.teacher_content_state, extraLessonData?.licensedContent, hostSceneKey, isClassHost, updateTeacherContentState]);

  useEffect(() => {
    const state = joinedSession?.teacher_content_state;
    const viewer = krpanoViewerRef.current;
    if (!viewer?.call) return;
    // Control off = students explore: their own model is theirs to handle.
    if (!joinedSession?.control_students_enabled) {
      licensedAssetIndexRef.current.forEach((index) => viewer.call?.(`set(hotspot[asset_${index}].enabled,true);`));
      return;
    }
    const stateKey = state?.scene_key || state?.licensed_content_id || null;
    if (!stateKey || !studentSceneKey || stateKey !== studentSceneKey) return;

    const selectedIndex = state?.selected_part_id
      ? licensedAssetIndexRef.current.get(state.selected_part_id)
      : undefined;

    licensedAssetIndexRef.current.forEach((index) => {
      viewer.call?.(`set(hotspot[asset_${index}].enabled,${state?.locked === false ? 'true' : 'false'});`);
    });

    // Explode / isolate / clip are whole-scene states, applied whether or not one asset is
    // selected. Wrapped because the plugin may not have loaded yet on a slow connection.
    try {
      (window as unknown as Record<string, unknown>).__krpanoModelState = state;
      viewer.call('model_apply_state();');
    } catch { /* plugin not ready; it reads the global on load */ }

    if (selectedIndex === undefined) return;
    const transform = state?.model_transform;
    const position = transform?.position;
    const rotation = transform?.rotation;
    const scale = transform?.scale?.[0];
    if (position?.every(Number.isFinite)) {
      viewer.call(`set(hotspot[asset_${selectedIndex}].tx,${position[0]});set(hotspot[asset_${selectedIndex}].ty,${position[1]});set(hotspot[asset_${selectedIndex}].tz,${position[2]});`);
    }
    if (rotation?.every(Number.isFinite)) {
      viewer.call(`set(hotspot[asset_${selectedIndex}].rx,${rotation[0]});set(hotspot[asset_${selectedIndex}].ry,${rotation[1]});set(hotspot[asset_${selectedIndex}].rz,${rotation[2]});`);
    }
    // The teacher's ACTUAL scale. This used to be overwritten with scale * 1.08 as a
    // selection highlight — and every other asset tweened back to 1 — which discarded the
    // authored placement scale and made a synced scale impossible to express. Selection is
    // now shown by an emissive tint instead (model_highlight), leaving scale to mean scale.
    if (Number.isFinite(scale)) {
      viewer.call(`tween(hotspot[asset_${selectedIndex}].scale,${Number(scale)},0.2);`);
    }
  }, [studentSceneKey, joinedSession?.control_students_enabled, joinedSession?.teacher_content_state?.sync_id]);

  // --- Teacher 3D model controls -------------------------------------------------------
  const [modelExplode, setModelExplode] = useState(0);
  const [modelIsolated, setModelIsolated] = useState(false);
  const [modelClip, setModelClip] = useState<{ axis: 'x' | 'y' | 'z'; offset: number } | null>(null);
  const [modelSelectedPartName, setModelSelectedPartName] = useState<string | null>(null);
  const [modelPartCount, setModelPartCount] = useState(0);

  /**
   * Count the separable meshes once the scene is up, so the toolbar can disable Explode on a
   * single-piece GLB rather than offering a slider that visibly does nothing.
   */
  useEffect(() => {
    if (!sceneReady || !isClassHost) return;
    const viewer = krpanoViewerRef.current;
    if (!viewer?.call) return;
    let cancelled = false;
    // The models stream in after sceneReady, so re-count for a few seconds rather than once.
    const tick = () => {
      if (cancelled) return;
      try {
        viewer.call?.('model_report_parts();');
        const parts = (window as unknown as { __krpanoModelParts?: { assets?: Array<{ partCount: number }> } })
          .__krpanoModelParts;
        const total = (parts?.assets ?? []).reduce((n, a) => n + (Number(a.partCount) || 0), 0);
        setModelPartCount(total);
      } catch { /* plugin not loaded yet */ }
    };
    tick();
    const id = window.setInterval(tick, 1500);
    const stop = window.setTimeout(() => window.clearInterval(id), 12000);
    return () => { cancelled = true; window.clearInterval(id); window.clearTimeout(stop); };
  }, [sceneReady, isClassHost]);

  /**
   * Publish model state, throttled.
   *
   * Same shape as the teacher_view throttle: coalesce while a control is being dragged, and
   * always land a final write so the class does not end up on an intermediate value.
   */
  const modelPublishTimerRef = useRef<number | null>(null);
  const modelPendingRef = useRef<Partial<TeacherContentState> | null>(null);
  const publishModelState = useCallback(
    (patch: Partial<TeacherContentState>, immediate = false) => {
      if (!isClassHost || !hostSceneKey || !updateTeacherContentState) return;
      modelPendingRef.current = { ...(modelPendingRef.current ?? {}), ...patch };

      const flush = () => {
        modelPublishTimerRef.current = null;
        const pending = modelPendingRef.current;
        modelPendingRef.current = null;
        if (!pending) return;
        const prev = activeSession?.teacher_content_state ?? null;
        const prevKey = prev?.scene_key || prev?.licensed_content_id || null;
        const base = prevKey === hostSceneKey ? prev : null;
        void updateTeacherContentState({
          ...(base ?? {}),
          scene_key: hostSceneKey,
          licensed_content_id: extraLessonData?.licensedContent?.id || hostSceneKey,
          locked: activeSession?.control_students_enabled === true,
          ...pending,
          sync_id: Date.now(),
        } as TeacherContentState);
      };

      if (immediate) {
        if (modelPublishTimerRef.current !== null) window.clearTimeout(modelPublishTimerRef.current);
        flush();
        return;
      }
      if (modelPublishTimerRef.current !== null) return;
      modelPublishTimerRef.current = window.setTimeout(flush, 200);
    },
    [isClassHost, hostSceneKey, updateTeacherContentState, activeSession?.teacher_content_state,
     activeSession?.control_students_enabled, extraLessonData?.licensedContent?.id]
  );

  /** Apply the teacher's own model state locally, so they see exactly what the class sees. */
  const applyModelStateLocally = useCallback(
    (state: Partial<TeacherContentState>) => {
      const viewer = krpanoViewerRef.current;
      if (!viewer?.call) return;
      try {
        (window as unknown as Record<string, unknown>).__krpanoModelState = state;
        viewer.call('model_apply_state();');
      } catch { /* plugin not ready */ }
    },
    []
  );

  const modelStateForApply = useCallback(
    (over: Partial<TeacherContentState> = {}): Partial<TeacherContentState> => ({
      exploded: modelExplode,
      isolated: modelIsolated,
      clip: modelClip,
      selected_part_name: modelSelectedPartName,
      selected_part_id: lastHotspotClicked || null,
      ...over,
    }),
    [modelExplode, modelIsolated, modelClip, modelSelectedPartName, lastHotspotClicked]
  );

  // The immersive action router is installed once and lives for the whole session, so it
  // must reach the CURRENT handlers rather than close over the first render's copies.
  const handleModelExplodeRef = useRef<((t: number) => void) | null>(null);
  const handleToggleModelIsolateRef = useRef<(() => void) | null>(null);
  const handleModelSectionToggleRef = useRef<(() => void) | null>(null);
  const handleModelResetRef = useRef<(() => void) | null>(null);

  const handleModelExplode = useCallback((t: number) => {
    setModelExplode(t);
    applyModelStateLocally(modelStateForApply({ exploded: t }));
    publishModelState({ exploded: t }, t === 0 || t === 1);
  }, [applyModelStateLocally, modelStateForApply, publishModelState]);

  const handleToggleModelIsolate = useCallback(() => {
    const next = !modelIsolated;
    setModelIsolated(next);
    applyModelStateLocally(modelStateForApply({ isolated: next }));
    publishModelState({ isolated: next, selected_part_name: modelSelectedPartName }, true);
  }, [modelIsolated, modelSelectedPartName, applyModelStateLocally, modelStateForApply, publishModelState]);

  const handleModelClipChange = useCallback((clip: { axis: 'x' | 'y' | 'z'; offset: number } | null) => {
    setModelClip(clip);
    applyModelStateLocally(modelStateForApply({ clip }));
    publishModelState({ clip }, clip === null);
  }, [applyModelStateLocally, modelStateForApply, publishModelState]);

  const handleModelReset = useCallback(() => {
    setModelExplode(0);
    setModelIsolated(false);
    setModelClip(null);
    const cleared: Partial<TeacherContentState> = {
      exploded: 0, isolated: false, clip: null, selected_part_name: null,
    };
    const viewer = krpanoViewerRef.current;
    try { viewer?.call?.('model_reset();'); } catch { /* plugin not ready */ }
    applyModelStateLocally(cleared);
    publishModelState(cleared, true);
  }, [applyModelStateLocally, publishModelState]);

  const handleModelSectionToggle = useCallback(() => {
    handleModelClipChange(modelClip ? null : { axis: 'x', offset: 0 });
  }, [modelClip, handleModelClipChange]);

  useEffect(() => {
    handleModelExplodeRef.current = handleModelExplode;
    handleToggleModelIsolateRef.current = handleToggleModelIsolate;
    handleModelSectionToggleRef.current = handleModelSectionToggle;
    handleModelResetRef.current = handleModelReset;
  }, [handleModelExplode, handleToggleModelIsolate, handleModelSectionToggle, handleModelReset]);

  const teacherView = joinedSession?.teacher_view;
  const isStudentInSession = Boolean(joinedSessionId && joinedSession && user?.uid && joinedSession.teacher_uid !== user.uid);
  const isStudentRemoved = useMemo(() => {
    if (!isStudentInSession || !user?.uid || !joinedSession) return false;
    const removedList = Array.isArray(joinedSession.removed_student_uids) ? joinedSession.removed_student_uids : [];
    return removedList.includes(user.uid);
  }, [isStudentInSession, user?.uid, joinedSession?.removed_student_uids]);

  // Derive control state from whichever session is active (teacher reads activeSession, student reads joinedSession)
  const sessionForControl = isStudentInSession ? joinedSession : activeSession;
  const controlStudentsEnabled = sessionForControl?.control_students_enabled ?? false;
  const teacherControlledPhase = sessionForControl?.teacher_controlled_phase ?? null;
  /**
   * Has the class actually STARTED? This is the gate for the student panel, rather than
   * "has the teacher taken control": students should be free to explore the scene from the
   * moment they arrive, and the lesson UI should appear when the lesson begins.
   * teacher_playback is absent or 'idle' until the teacher presses Start class.
   */
  const classStarted = Boolean(
    sessionForControl?.teacher_playback && sessionForControl.teacher_playback.state !== 'idle'
  );
  /** Teacher's explicit override. Defaults to shown, so starting the class just works. */
  const studentUiVisible = sessionForControl?.student_ui_visible ?? true;
  const currentStudentDisplayName = resolveStudentDisplayName(profile as any, {
    uid: user?.uid,
    displayName: user?.displayName,
    email: user?.email,
  });
  /**
   * Who sees the in-headset panel.
   *
   * This used to be a bare device flag (`quest || isMobile`) written once on mount, with no
   * relation to the class at all. Now it follows the LESSON: students explore the scene with
   * a clean view until the teacher presses Start class, and the teacher can hide the panel
   * again with the toggle without ever losing their own.
   *
   * The krpano side re-reads `__showImmersiveUI` on an 800ms poll and ANDs it with
   * `webvr.isenabled`, so writing the global is enough — no XML change needed.
   */
  const showImmersiveUiForThisViewer =
    immersiveUiDeviceCapable &&
    (isClassHost || !isStudentInSession || (classStarted && studentUiVisible));
  useEffect(() => {
    try {
      (window as unknown as Record<string, unknown>).__showImmersiveUI = showImmersiveUiForThisViewer;
    } catch {
      /* window unavailable */
    }
  }, [showImmersiveUiForThisViewer]);

  // If the ink write is ever rejected, say so. updateDoc is latency-compensated, so the
  // teacher's own strokes render from the optimistic local snapshot either way — a denied
  // write is invisible to the person drawing and total for everyone else.
  useEffect(() => {
    if (!isClassHost) return;
    const w = window as unknown as Record<string, unknown>;
    w.__onAnnotationWriteDenied = () => {
      toast.error('Your marker is not reaching students — the class session write was denied.');
    };
    return () => { delete w.__onAnnotationWriteDenied; };
  }, [isClassHost]);

  /**
   * Removed mid-lesson: leave immediately, whether or not a rejoin request is
   * pending. Without this a removed student who asked to rejoin stayed in the
   * lesson while they waited.
   */
  useEffect(() => {
    if (!isStudentInSession) return;
    const admitted = classSession?.isAdmitted ?? false;
    if (isStudentRemoved || !admitted) {
      toast.info('Your teacher removed you from this class.');
      navigate('/dashboard/student', { replace: true });
    }
  }, [isStudentInSession, isStudentRemoved, classSession?.isAdmitted, navigate]);

  const blockStudentPhaseControl = useCallback((actionLabel: string): boolean => {
    if (!isStudentInSession || !controlStudentsEnabled) return false;
    toast.info(`Teacher is controlling the lesson. ${actionLabel} is locked for now.`);
    return true;
  }, [isStudentInSession, controlStudentsEnabled]);

  classControlRef.current = {
    isHost: isClassHost,
    controlEnabled: controlStudentsEnabled,
    isStudent: isStudentInSession,
    currentPhase: String(lessonPhase || 'intro'),
    broadcastPhase: broadcastTeacherPhase,
  };

  const currentImmersiveMcq =
    lessonPhase === 'quiz' && mcqs.length > 0 && currentMcqIndex >= 0 && currentMcqIndex < mcqs.length
      ? mcqs[currentMcqIndex]
      : null;
  const immersiveScoreCorrect =
    lessonPhase === 'completed' && mcqs.length > 0
      ? mcqs.filter((mcq) => mcqAnswers[mcq.id] === mcq.correctAnswer).length
      : 0;
  immersiveUiStateRef.current = {
    modelPartCount,
    phase: lessonPhase as string,
    script: currentScript || '',
    ttsStatus,
    question: currentImmersiveMcq?.question || '',
    options: currentImmersiveMcq?.options || [],
    showQuiz: lessonPhase === 'quiz' && !!currentImmersiveMcq,
    showResult: showMcqResult,
    scoreLabel: lessonPhase === 'completed' && mcqs.length > 0
      ? `${immersiveScoreCorrect} / ${mcqs.length} correct`
      : '',
    selectedAnswer: selectedAnswer ?? -1,
    waitingForUser,
    isPlayingAudio,
    currentMcqIndex,
    totalMcqs: mcqs.length,
    correctAnswer: showMcqResult ? currentImmersiveMcq?.correctAnswer ?? -1 : -1,
    explanation: showMcqResult ? currentImmersiveMcq?.explanation || '' : '',
    controlStudentsEnabled,
    isStudent: isStudentInSession,
    isHost: isClassHost,
  };

  // Report phase to class session for teacher dashboard (when student joined from class)
  // Only students write progress documents. Hosts may have an active session ID
  // for view broadcast, but Firestore correctly reserves progress writes for students.
  const sessionIdForReport = joinedSessionId ?? null;
  // Report initial progress as soon as student is in lesson with a session (so teacher sees them in "Student views")
  useEffect(() => {
    if (!sessionIdForReport || !user?.uid) return;
    reportSessionProgress(
      sessionIdForReport,
      user.uid,
      currentStudentDisplayName,
      'loading',
      undefined,
      undefined,
      (profile as any)?.email ?? user?.email ?? undefined
    ).catch(() => {});
  }, [sessionIdForReport, user?.uid, currentStudentDisplayName, user?.email, profile]);
  useEffect(() => {
    if (!sessionIdForReport || !user?.uid) return;
    const phaseMap: Record<string, SessionLessonPhase> = {
      intro: 'intro',
      explanation: 'explanation',
      outro: 'outro',
      quiz: 'quiz',
      completed: 'completed',
      idle: 'idle',
      loading: 'loading',
    };
    const phase = phaseMap[lessonPhase as string] ?? 'idle';
    if (phase === 'completed' && pendingQuizReportRef.current) {
      const quiz = pendingQuizReportRef.current;
      pendingQuizReportRef.current = null;
      reportSessionProgress(
        sessionIdForReport,
        user.uid,
        currentStudentDisplayName,
        'completed',
        undefined,
        { score: quiz.score, total: quiz.total, answers: quiz.answers },
        (profile as any)?.email ?? user?.email ?? undefined
      ).catch(() => {});
    } else {
      reportSessionProgress(
        sessionIdForReport,
        user.uid,
        currentStudentDisplayName,
        phase,
        undefined,
        undefined,
        (profile as any)?.email ?? user?.email ?? undefined
      ).catch(() => {});
    }
  }, [lessonPhase, sessionIdForReport, user?.uid, user?.email, profile, currentStudentDisplayName]);

  // Guided lookto: smooth view transition when lesson phase changes (intro / explanation / outro)
  // Krpano is the active view whenever we have a skybox (skybox-only or skybox+GLB); sync uses this.
  // Known quirk: Console may show "Unknown action: 90" from the cursor3d plugin's lookto(h, v, 90, ...) call
  // (90 is FOV in degrees). This is a krpano internal interpretation and does not affect behavior.
  const useKrpanoView = !!(skyboxData?.imageUrl || skyboxData?.file_url);
  // Track whether krpano WebVR is currently enabled so we can hide HTML overlays in true VR mode
  const [isInKrpanoVR, setIsInKrpanoVR] = useState(false);

  // Poll light-weight webvr state from krpano when viewer is ready
  useEffect(() => {
    if (!useKrpanoView) return;
    let cancelled = false;

    const poll = () => {
      if (cancelled) return;
      const viewer = krpanoViewerRef.current;
      if (viewer?.get) {
        try {
          const flag = viewer.get('webvr.isenabled');
          const enabled = flag === true || flag === 'true' || flag === '1';
          setIsInKrpanoVR((prev) => {
            if (prev === enabled) return prev;
            if (enabled) vrEntryTtsDelayRef.current = true;
            return enabled;
          });
        } catch {
          // Ignore get() errors; will retry on next tick
        }
      }
      if (!cancelled) {
        setTimeout(poll, 1000);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [useKrpanoView]);

  // When user chose "Start in VR" from prep overlay, enter VR as soon as krpano is ready
  useEffect(() => {
    if (!enterVRWhenReadyRef.current || !lessonReady || !useKrpanoView) return;
    let cancelled = false;
    const tryEnterVR = () => {
      if (cancelled || !enterVRWhenReadyRef.current) return;
      const viewer = krpanoViewerRef.current;
      if (viewer?.call) {
        try {
          viewer.call('webvr.enterVR');
        } catch (e) {
          console.warn('[Krpano] webvr.enterVR failed:', e);
        }
        enterVRWhenReadyRef.current = false;
        return;
      }
      setTimeout(tryEnterVR, 300);
    };
    tryEnterVR();
    return () => { cancelled = true; };
  }, [lessonReady, useKrpanoView]);

  // Push lesson UI state into krpano immersive UI whenever key state changes
  useEffect(() => {
    if (!useKrpanoView || typeof window === 'undefined') return;
    const uiUpdate = (window as unknown as { __krpanoUIUpdate?: (state: KrpanoUiStatePayload) => void }).__krpanoUIUpdate;
    if (!uiUpdate) return;

    uiUpdate(immersiveUiStateRef.current);
  }, [useKrpanoView, sceneReady, lessonPhase, currentScript, ttsStatus, mcqs, currentMcqIndex, mcqAnswers, showMcqResult, selectedAnswer, waitingForUser, isPlayingAudio, controlStudentsEnabled, isStudentInSession, isClassHost, modelPartCount]);
  useEffect(() => {
    if (!useKrpanoView || !krpanoViewerRef.current?.call) return;
    // krpanoViewerRef is set on embed, but the viewer's internal view object only
    // exists once the pano has actually loaded. Calling lookto before then throws
    // "Cannot read properties of null (reading 'viewoffset')" from inside krpano
    // and takes the whole player down via the error boundary.
    if (!sceneReady) return;
    // Never fight live class Direct / teacher follow with phase lookto on students.
    if (joinedSessionId && joinedSession?.teacher_view && user?.uid && joinedSession.teacher_uid !== user.uid) {
      return;
    }
    const phase = lessonPhase as string;
    if (phase !== 'intro' && phase !== 'explanation' && phase !== 'outro') return;

    const lookatByPhase = extraLessonData?.topic?.lookatByPhase as LookatByPhase | undefined;
    const target = lookatByPhase?.[phase];
    const h = target?.h ?? 0;
    const v = target?.v ?? (phase === 'intro' ? -5 : phase === 'explanation' ? -3 : -5);
    const fov = target?.fov ?? 90;
    const time = 1.5;

    // Proving the view object exists is the only reliable readiness signal:
    // krpanoViewerRef is set at embed time, but krpano's internal view is null
    // until the pano finishes loading, and lookto() then throws from inside
    // krpano ("Cannot read properties of null (reading 'viewoffset')") which
    // takes the whole player down through the error boundary.
    const probe = Number(krpanoViewerRef.current.get?.('view.hlookat'));
    if (!Number.isFinite(probe)) return;

    const action = `lookto(${h},${v},${fov},tween(easeInOutQuad,${time}));`;
    try {
      krpanoViewerRef.current.call(action);
      log('👁️', `Guided lookto [${phase}]`, { h, v, fov });
    } catch (err) {
      console.warn('[VRPlayer] guided lookto failed:', err);
    }
  }, [
    lessonPhase,
    useKrpanoView,
    sceneReady,
    extraLessonData?.topic?.lookatByPhase,
    joinedSessionId,
    joinedSession?.teacher_view,
    joinedSession?.teacher_uid,
    user?.uid,
  ]);



  // Restore host session from storage (partner demo or generic class session id).
  useEffect(() => {
    if (!bindActiveSession || activeSessionId) return;
    const storedClass = typeof window !== 'undefined' ? sessionStorage.getItem('learnxr_class_session_id') : null;
    const id = partnerSessionMeta?.id || storedClass;
    if (!id) return;
    if (profile?.role === 'partner' || profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'superadmin') {
      bindActiveSession(id);
    }
  }, [bindActiveSession, activeSessionId, partnerSessionMeta?.id, profile?.role]);

  // Show the host overlay: always show if class host. When in immersive VR, overlay still needed for Control Students / phase controls.
  const showLiveClassHostOverlay = Boolean(isClassHost);

  const useIntegratedSceneEarly = !!((skyboxData?.imageUrl ?? skyboxData?.file_url) && assetUrl && isGlbOrGltfUrl(assetUrl));
  const useModelOnlySceneEarly = !!(assetUrl && isGlbOrGltfUrl(assetUrl) && !(skyboxData?.imageUrl ?? skyboxData?.file_url));
  const useThreeScene = useIntegratedSceneEarly || useModelOnlySceneEarly;
  // Host (teacher or partner): broadcast view to students. Krpano: onviewchange only (no polling).
  const hostSessionIdForSync = activeSessionId || partnerSessionMeta?.id || null;
  useEffect(() => {
    if (!isClassHost || (!useKrpanoView && !useThreeScene) || !hostSessionIdForSync || !user?.uid) return;
    let lastSent = 0;
    let lastView: { h: number; v: number; fov: number } | null = null;
    // 100ms meant ~10 writes/sec for the whole lesson. Students tween each update over
    // 0.28s, so a 200ms cadence is indistinguishable in motion and halves the writes —
    // and the fan-out, since every student reads every one of them.
    const throttleMs = 200;
    /** Below this, the movement is not worth a document write to the whole class. */
    const MIN_DELTA_DEG = 0.5;
    const sendView = (h: number, v: number, fov: number) => {
      // Continuous follow is applied by students ONLY under lockstep, so outside it every
      // one of these writes was read by everyone and then discarded.
      if (!classControlRef.current.controlEnabled) return;
      const now = Date.now();
      if (now - lastSent < throttleMs) return;
      if (
        lastView &&
        Math.abs(lastView.h - h) < MIN_DELTA_DEG &&
        Math.abs(lastView.v - v) < MIN_DELTA_DEG &&
        Math.abs(lastView.fov - fov) < MIN_DELTA_DEG
      ) {
        return;
      }
      lastSent = now;
      lastView = { h, v, fov };
      setHostLookat({ hlookat: h, vlookat: v, fov });
      // Continuous drag sync — no force/sync_id (that is reserved for “Direct class to my view”).
      updateTeacherView(hostSessionIdForSync, user!.uid, { hlookat: h, vlookat: v, fov }).catch((err) => {
        console.warn('[ViewSync] Host updateTeacherView failed:', err);
      });
    };
    viewSyncSendRef.current = sendView;
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development' && useThreeScene && !useKrpanoView) {
      console.debug('[ViewSync] Host Three.js scene callback registered; drag will send view to students.');
    }
    if (useKrpanoView) {
      // Subscribe rather than own the global: the annotation overlay needs the
      // same ticks, and previously whichever effect mounted last silently won.
      const unsubscribeHostView = onKrpanoViewChange(sendView);
      const viewer = krpanoViewerRef.current;
      if (viewer?.call) viewer.call('sync_view_to_js');
      const t = setTimeout(() => {
        krpanoViewerRef.current?.call?.('sync_view_to_js');
        const live = readKrpanoLookat(krpanoViewerRef.current);
        if (live) setHostLookat(live);
      }, 500);
      return () => {
        clearTimeout(t);
        unsubscribeHostView();
        viewSyncSendRef.current = () => {};
      };
    }
    return () => { viewSyncSendRef.current = () => {}; };
  }, [isClassHost, useKrpanoView, useThreeScene, hostSessionIdForSync, user?.uid]);

  const directClassToCurrentView = useCallback(async (): Promise<boolean> => {
    if (!isClassHost || !hostSessionIdForSync || !user?.uid) return false;
    const view = readKrpanoLookat(krpanoViewerRef.current) || hostLookat || activeSession?.teacher_view || null;
    if (!view || !Number.isFinite(Number(view.hlookat)) || !Number.isFinite(Number(view.vlookat))) {
      return false;
    }

    const normalizedView = {
      hlookat: Number(view.hlookat),
      vlookat: Number(view.vlookat),
      fov: Number(view.fov) || 90,
    };
    setHostLookat(normalizedView);
    return updateTeacherView(hostSessionIdForSync, user.uid, {
      ...normalizedView,
      force: true,
      sync_id: Date.now(),
    });
  }, [activeSession?.teacher_view, hostLookat, hostSessionIdForSync, isClassHost, user?.uid]);



  // Teacher: mirror local phase changes to the class — but ONLY after the teacher has
  // explicitly started the class with Play or a phase button.
  //
  // Without this gate the hold is impossible: the teacher pressing "Start Lesson"
  // sets their own phase to 'intro', which this effect broadcasts, which releases
  // every student instantly. teacherPlaybackStartedRef flips only in a deliberate
  // playback command (see handleTeacherPlaybackCommand).
  const lastBroadcastPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isClassHost || !controlStudentsEnabled || !broadcastTeacherPhase) return;
    if (!teacherPlaybackStartedRef.current) return;
    if (lessonPhase === lastBroadcastPhaseRef.current) return;
    if (!lessonPhase || lessonPhase === 'idle' || lessonPhase === 'loading') return;
    lastBroadcastPhaseRef.current = lessonPhase;
    void broadcastTeacherPhase(lessonPhase, true);
  }, [isClassHost, controlStudentsEnabled, lessonPhase, broadcastTeacherPhase]);

  // Student: lock lesson phase to what teacher broadcasts (overrides local auto-progression)
  const lastAppliedTeacherPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isStudentInSession || !controlStudentsEnabled || !teacherControlledPhase) return;
    if (teacherControlledPhase === lastAppliedTeacherPhaseRef.current) return;
    lastAppliedTeacherPhaseRef.current = teacherControlledPhase;
    log('🎓', 'Teacher controlled phase override:', teacherControlledPhase);
    setPhase(teacherControlledPhase as Parameters<typeof setPhase>[0]);
  }, [isStudentInSession, controlStudentsEnabled, teacherControlledPhase, setPhase]);

  const lastTeacherViewRef = useRef<{ h: number; v: number; fov: number; syncId: number | null } | null>(null);
  /**
   * A student is "actively looking" for a short window after their own pointer input.
   * The host writes teacher_view every ~100ms while dragging, and each write applies a
   * 0.28s tween — so without this, a student who drags is yanked back before the drag
   * finishes and panning appears completely dead.
   */
  const studentDragUntilRef = useRef(0);
  useEffect(() => {
    if (!isStudentInSession) return;
    const el = document.getElementById(KRPANO_CONTAINER_ID);
    if (!el) return;
    const mark = () => { studentDragUntilRef.current = Date.now() + 1500; };
    el.addEventListener('pointerdown', mark);
    el.addEventListener('pointermove', mark);
    el.addEventListener('wheel', mark, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', mark);
      el.removeEventListener('pointermove', mark);
      el.removeEventListener('wheel', mark);
    };
  }, [isStudentInSession, sceneReady]);

  useEffect(() => {
    if (!isStudentInSession || !useKrpanoView || !teacherView || !krpanoViewerRef.current?.call) return;
    const h = Number(teacherView.hlookat);
    const v = Number(teacherView.vlookat);
    const fov = Number(teacherView.fov) || 90;
    const syncId =
      typeof teacherView.sync_id === 'number' && Number.isFinite(teacherView.sync_id)
        ? teacherView.sync_id
        : null;
    if (Number.isNaN(h) || Number.isNaN(v)) return;
    const prev = lastTeacherViewRef.current;
    const isNewDirect = syncId != null && syncId !== prev?.syncId;

    // In VR or on Quest with gyroscope: only apply EXPLICIT Direct commands, never continuous drag.
    // This prevents the camera fighting the user's physical head movements.
    if ((isInKrpanoVR || isQuestDevice) && !isNewDirect) {
      return;
    }

    if (prev && prev.h === h && prev.v === v && prev.fov === fov && !isNewDirect) {
      return;
    }

    // Continuous "follow my drag" only applies under lockstep. Outside it, students
    // explore freely — the phase follower already gates on controlStudentsEnabled and
    // this one never did, so the host's ~10/sec teacher_view writes pinned every
    // student's camera permanently.
    if (!isNewDirect && !controlStudentsEnabled) return;

    // Even under lockstep, don't fight a student who is actively looking around;
    // an explicit Direct still wins immediately.
    if (!isNewDirect && Date.now() < studentDragUntilRef.current) return;

    lastTeacherViewRef.current = { h, v, fov, syncId };

    const viewerVrFlag = krpanoViewerRef.current.get?.('webvr.isenabled');
    const immersiveVrActive = isInKrpanoVR || viewerVrFlag === true || viewerVrFlag === 'true' || viewerVrFlag === '1';
    if (immersiveVrActive && isNewDirect) {
      const ok = applyTeacherViewToImmersiveKrpano(krpanoViewerRef.current, {
        hlookat: h,
        vlookat: v,
        fov,
        sync_id: syncId ?? undefined,
      });
      log('👁️', 'Direct view aligned in WebVR', { h, v, syncId, ok });
      return;
    }

    if (isNewDirect) {
      try {
        krpanoViewerRef.current?.call?.(`resetsensor(${h}, ${v})`);
      } catch {}
    }

    const ok = applyTeacherViewToKrpano(
      krpanoViewerRef.current,
      { hlookat: h, vlookat: v, fov, sync_id: syncId ?? undefined },
      { force: isNewDirect }
    );
    log('👁️', 'Following teacher view', { h, v, fov, syncId, isNewDirect, ok, isInKrpanoVR });
  }, [isStudentInSession, useKrpanoView, controlStudentsEnabled, teacherView?.hlookat, teacherView?.vlookat, teacherView?.fov, teacherView?.sync_id, sceneReady, isInKrpanoVR, isQuestDevice]);


  // Student: report view on onviewchange (throttled) so teacher preview matches student drag; was: report to session so teacher can see “what they see” (throttled)
  useEffect(() => {
    if (!isStudentInSession || !joinedSessionId || !user?.uid || !useKrpanoView) return;
    let lastReported = 0;
    const reportThrottleMs = 220;
    const onViewChange = (h: number, v: number, fov: number) => {
      const now = Date.now();
      if (now - lastReported < reportThrottleMs) return;
      lastReported = now;
      reportStudentView(joinedSessionId, user.uid, { hlookat: h, vlookat: v, fov }).catch(() => {});
    };
    const unsubscribeStudentView = onKrpanoViewChange(onViewChange);
    krpanoViewerRef.current?.call?.('sync_view_to_js');
    const t = setTimeout(() => krpanoViewerRef.current?.call?.('sync_view_to_js'), 400);
    return () => {
      clearTimeout(t);
      unsubscribeStudentView();
    };
  }, [isStudentInSession, joinedSessionId, user?.uid, useKrpanoView, sceneReady]);

  // ============================================================================
  // Street View Tour: teacher-controlled Next/Previous Stop navigation.
  // A tour is a chapter with one synthetic topic per stop (see getLessonBundle.ts /
  // userGeneratedLessons.ts). Advancing the stop reuses the existing `launched_lesson`
  // broadcast (teacher writes a new topic_id, students already listen for it via
  // ClassSessionContext) — no new Firestore fields/rules needed.
  // ============================================================================
  const isTourStop = extraLessonData?.topic?.isTourStop === true;
  const tourLessonSource: 'user_generated' | 'curriculum' =
    activeSession?.launched_lesson?.lesson_type === 'user_generated' || joinedSession?.launched_lesson?.lesson_type === 'user_generated'
      ? 'user_generated'
      : 'curriculum';
  const [tourStopTopics, setTourStopTopics] = useState<Array<{ topicId: string; label: string }>>([]);
  const tourChapterIdRef = useRef<string | null>(null);
  const classAutoStartRef = useRef(false);
  // Single source of truth for layout breakpoints (retires isPhoneViewport,
  // useIsMobileViewport and the CSS sm: switch, which disagreed at 640-767px).
  const playerViewport = usePlayerViewport();
  // One global dispatcher; host sync, student reporting and the annotation
  // overlay all subscribe to it.
  useEffect(() => installViewChangeBus(), []);
  const [handRaised, setHandRaised] = useState(false);
  const [hostDrawer, setHostDrawer] = useState<null | 'roster' | 'approvals' | 'preview'>(null);

  // --- Teacher marker -------------------------------------------------------
  const [markerActive, setMarkerActive] = useState(false);
  /** First End click arms the confirmation; the second actually ends the class. */
  const [endSessionConfirming, setEndSessionConfirming] = useState(false);
  // One marker, no modes — every stroke is temporary now.
  const markerMode: MarkerMode = 'laser';
  const [markerColor, setMarkerColor] = useState<string>(MARKER_COLORS[0]);
  /** Flips true only when the teacher issues a deliberate Play / phase command. */
  const teacherPlaybackStartedRef = useRef(false);
  /** Last {phase, token} the student applied from teacher_playback. */
  const appliedPlaybackRef = useRef<{ phase: string | null; token: number } | null>(null);
  const [isPhoneViewport, setIsPhoneViewport] = useState(false);
  /** Phone: lesson chrome (mute/chat/stop/panel) collapsed until user expands. */

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const ua = navigator.userAgent || '';
      const uaMobile = /Android|iPhone|iPad|iPod/i.test(ua);
      const phone = uaMobile || window.innerWidth < 768;
      setIsPhoneViewport(phone);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useEffect(() => {
    const chapterId = extraLessonData?.chapter?.chapter_id;
    if (!isTourStop || !chapterId || tourChapterIdRef.current === chapterId) return;
    tourChapterIdRef.current = chapterId;

    (async () => {
      try {
        if (tourLessonSource === 'user_generated') {
          const snap = await getDoc(doc(db, 'user_generated_lessons', chapterId));
          const stops = Array.isArray(snap.data()?.streetViewTour?.stops) ? snap.data()!.streetViewTour.stops : [];
          const ordered = [...stops].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
          setTourStopTopics(ordered.map((s: any) => ({ topicId: `${chapterId}__stop_${s.id}`, label: s.label || 'Stop' })));
        } else {
          const snap = await getDoc(doc(db, 'curriculum_chapters', chapterId));
          const topics = Array.isArray(snap.data()?.topics) ? snap.data()!.topics : [];
          const ordered = [...topics]
            .filter((t: any) => t.isTourStop)
            .sort((a: any, b: any) => (a.isTourStopIndex ?? 0) - (b.isTourStopIndex ?? 0));
          setTourStopTopics(ordered.map((t: any) => ({ topicId: t.topic_id, label: t.topic_name || 'Stop' })));
        }
      } catch (err) {
        console.warn('[StreetViewTour] Failed to load sibling stops:', err);
      }
    })();
  }, [isTourStop, tourLessonSource, extraLessonData?.chapter?.chapter_id]);

  const currentStopIndex = useMemo(() => {
    const tid = String(extraLessonData?.topic?.topic_id || '');
    const byId = tourStopTopics.findIndex((t) => t.topicId === tid);
    if (byId >= 0) return byId;
    const byLaunch = tourStopTopics.findIndex(
      (t) => t.topicId === String(activeSession?.launched_lesson?.topic_id || joinedSession?.launched_lesson?.topic_id || '')
    );
    if (byLaunch >= 0) return byLaunch;
    const stopIdx = extraLessonData?.topic?.isTourStopIndex;
    if (typeof stopIdx === 'number' && stopIdx >= 0 && stopIdx < tourStopTopics.length) return stopIdx;
    return -1;
  }, [
    tourStopTopics,
    extraLessonData?.topic?.topic_id,
    extraLessonData?.topic?.isTourStopIndex,
    activeSession?.launched_lesson?.topic_id,
    joinedSession?.launched_lesson?.topic_id,
  ]);

  /** Fetches the given stop's topic and swaps the active lesson data in place (skybox/assets/voiceover). */
  const loadTourStop = useCallback(
    async (topicId: string) => {
      const chapterId = extraLessonData?.chapter?.chapter_id;
      if (!chapterId) return;
      try {
        const lang = extraLessonData?.topic?.language || 'en';
        const bundle = await getLessonBundle({ chapterId, topicId, lang, source: tourLessonSource });
        const topic = bundle.chapter.topics?.find((t: any) => t.topic_id === topicId) || bundle.chapter.topics?.[0];
        if (!topic) return;
        const skyboxUrl = bundle.skybox?.imageUrl || bundle.skybox?.file_url || topic.skybox_url || '';
        const nextData = {
          ...extraLessonData,
          topic: {
            ...extraLessonData?.topic,
            ...topic,
            topic_id: topic.topic_id || topicId,
            topic_name: topic.topic_name,
            skybox_url: skyboxUrl,
            skybox_glb_url: bundle.skybox?.stored_glb_url || bundle.skybox?.glb_url || topic.skybox_glb_url || skyboxUrl,
            asset_urls: Array.isArray(topic.asset_urls) ? topic.asset_urls : [],
            asset_ids: Array.isArray(topic.asset_ids) ? topic.asset_ids : [],
            assetPlacements: Array.isArray(topic.assetPlacements) ? topic.assetPlacements : [],
            avatar_intro: topic.avatar_intro || '',
            streetViewStop: topic.streetViewStop || extraLessonData?.topic?.streetViewStop,
            isTourStop: true,
            isTourStopIndex: topic.isTourStopIndex,
            ttsAudio: Array.isArray(bundle.tts) && bundle.tts.length > 0
              ? bundle.tts.map((t: any) => ({ id: t.id, script_type: t.script_type || 'intro', audio_url: t.audio_url, language: t.language || lang }))
              : (Array.isArray(topic.ttsAudio) ? topic.ttsAudio : []),
            language: lang,
          },
          assets3d: Array.isArray(bundle.assets3d) ? bundle.assets3d : [],
        };
        setExtraLessonData(nextData);
        sessionStorage.setItem('activeLesson', JSON.stringify(nextData));
        // Keep the live lesson running — only refresh panorama/content for the new stop
        setShowWelcomeScreen(false);
        setLessonReady(true);
        setPhase('intro');
      } catch (err) {
        console.warn('[StreetViewTour] Failed to load stop:', err);
        toast.error('Failed to load the next stop.');
      }
    },
    [extraLessonData, tourLessonSource, setPhase]
  );

  const goToTourStop = useCallback(
    async (targetIndex: number) => {
      const target = tourStopTopics[targetIndex];
      if (!target) return;
      await loadTourStop(target.topicId);
      const sessionId = activeSessionId || partnerSessionMeta?.id;
      const launched = activeSession?.launched_lesson;
      if (!isClassHost || !sessionId || !user?.uid || !launched) return;

      // Partners: Admin API keeps quota/rules consistent; teachers use client session update.
      if (profile?.role === 'partner' || activeSession?.hosted_by_partner) {
        try {
          const { launchPartnerDemoLesson } = await import('../services/partnerService');
          await launchPartnerDemoLesson(sessionId, {
            chapterId: launched.chapter_id,
            topicId: target.topicId,
            title: target.label,
            lessonType: launched.lesson_type === 'user_generated' ? 'user_generated' : 'curriculum',
            // This route rebuilds launched_lesson field by field, so the class's
            // player has to be restated or advancing a stop would reset it.
            player: launched.player,
          });
        } catch (err) {
          console.warn('[StreetViewTour] Partner broadcast failed, falling back to session write:', err);
          launchLessonToSession(sessionId, user.uid, { ...launched, topic_id: target.topicId }).catch((e) => {
            console.warn('[StreetViewTour] Failed to broadcast stop change:', e);
          });
        }
      } else {
        launchLessonToSession(sessionId, user.uid, { ...launched, topic_id: target.topicId }).catch((err) => {
          console.warn('[StreetViewTour] Failed to broadcast stop change:', err);
        });
      }
    },
    [
      tourStopTopics,
      loadTourStop,
      isClassHost,
      activeSessionId,
      partnerSessionMeta?.id,
      user?.uid,
      activeSession?.launched_lesson,
      activeSession?.hosted_by_partner,
      profile?.role,
    ]
  );

  // Student: follow the teacher's active stop while already inside the player
  // (StudentDashboard's launched_lesson listener only fires before entering the player).
  const lastFollowedTopicIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isStudentInSession || !isTourStop) return;
    const targetTopicId = joinedSession?.launched_lesson?.topic_id;
    const currentTopicId = extraLessonData?.topic?.topic_id;
    if (!targetTopicId || targetTopicId === currentTopicId) return;
    if (lastFollowedTopicIdRef.current === targetTopicId) return;
    lastFollowedTopicIdRef.current = targetTopicId;
    loadTourStop(targetTopicId);
  }, [isStudentInSession, isTourStop, joinedSession?.launched_lesson?.topic_id, extraLessonData?.topic?.topic_id, loadTourStop]);

  // ============================================================================
  // Fetch 3D Asset (Platform-aware: FBX for Android, USDZ for iOS, GLB for Web)
  // ============================================================================

  useEffect(() => {
    // Unified asset discovery is handled by the effect below. Keeping two
    // independent fetchers caused krpano to embed once before Firestore assets
    // arrived, leaving the live viewer with zero 3D hotspots.
    return;

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
          // Web: only GLB/GLTF
          selectedUrl = img3d.imagemodel_glb || (isSafeLessonGlbUrl(img3d.imageasset_url || '') ? img3d.imageasset_url : null) || null;
        }
        
        if (selectedUrl && (platform === 'web' ? isSafeLessonGlbUrl(selectedUrl) : !isLegacyMeshyCdnUrl(selectedUrl))) {
          log('✅', `Selected ${platform} asset from image3dasset:`, selectedUrl.substring(0, 80));
          setAssetUrl(selectedUrl);
          setAssetLoading(true);
          return;
        }
      }
      
      // Legacy topic.asset_urls can contain deleted render IDs; use meshy_assets records instead.
      const assetUrls = activeLesson.topic?.asset_urls;
      if (false && assetUrls && assetUrls.length > 0) {
        selectedUrl = platform === 'web'
          ? firstGlbOrGltfUrl(assetUrls)
          : (assetUrls.find((url: string) => !isLegacyMeshyCdnUrl(url)) || null);
        if (selectedUrl) {
          log('📦', '3D Asset URL from topic.asset_urls:', selectedUrl.substring(0, 80));
          setAssetUrl(selectedUrl);
          setAssetLoading(true);
          return;
        }
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
                selectedUrl = pickBestGlbUrl(asset) || asset.fbx_url || asset.glb_url;
              } else if (platform === 'ios') {
                selectedUrl = pickBestGlbUrl(asset) || asset.usdz_url || asset.glb_url;
              } else {
                selectedUrl = pickBestGlbUrl(asset);
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

  // Cleanup function to properly dispose of audio (and krpano TTS if active)
  const cleanupAudio = useCallback(() => {
    if (ttsPlayedViaKrpanoRef.current && krpanoViewerRef.current?.destroysound) {
      try {
        krpanoViewerRef.current.destroysound('tts');
      } catch (_) {}
      ttsPlayedViaKrpanoRef.current = false;
    }
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

  // Krpano TTS oncomplete: same state updates as HTML audio onended (for __krpanoOnTTSComplete)
  const onTTSComplete = useCallback(() => {
    log('✅', `TTS ${lessonPhase} completed (krpano)`);
    setTtsStatus('ready');
    setAudioCurrentTime(0);
    setCurrentAudioUrl(null);
    setCurrentVisemes([]);
    setIsPlayingAudio(false);
    setWaitingForUser(true);
  }, [lessonPhase]);
  useEffect(() => {
    ttsCompleteRef.current = onTTSComplete;
    return () => {
      ttsCompleteRef.current = () => {};
    };
  }, [onTTSComplete]);

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

    // Track lesson launch for LMS (only for students with school_id)
    if (
      profile?.role === 'student' &&
      profile?.school_id &&
      effectiveLesson?.chapter &&
      effectiveLesson?.topic
    ) {
      const launchId = await trackLessonLaunch(
        profile,
        effectiveLesson.chapter.chapter_id || '',
        effectiveLesson.topic.topic_id || '',
        effectiveLesson.chapter.curriculum || 'CBSE',
        effectiveLesson.chapter.class_name?.toString() || '',
        effectiveLesson.chapter.subject || '',
        'web',
        // Same class the score is attributed to, so the two dashboard queries agree.
        joinedSession?.class_id ?? activeSession?.class_id ?? null
      );
      if (launchId) {
        setCurrentLaunchId(launchId);
        log('✅', 'Lesson launch tracked:', launchId);
      }
    }
  }, [setPhase, profile, effectiveLesson]);

  // Live class students: enter the lesson scene as soon as content is ready.
  // Under lockstep this only puts them IN the scene — narration stays silent
  // until teacher_playback says 'playing', which the follower effect applies.
  useEffect(() => {
    if (!isStudentInSession || !showWelcomeScreen || !allReady || classAutoStartRef.current) return;
    classAutoStartRef.current = true;
    void handleStartLesson();
  }, [isStudentInSession, showWelcomeScreen, allReady, handleStartLesson]);

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
    setAutoplayEnabled(false); // back to idle: next entry must be played explicitly
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
          const convertedTTS: TTSData[] = languageFilteredTTS
            .map((tts: any) => ({
              id: tts.id || '',
              section: tts.script_type || tts.section || 'full',
              audioUrl: tts.audio_url || tts.audioUrl || tts.url || '',
              text: tts.text || tts.script_text || '',
            }))
            .filter((tts) => Boolean(String(tts.audioUrl || '').trim()));

          if (convertedTTS.length > 0) {
            setTtsData(convertedTTS);
            setTtsStatus('ready');
            log('✅', `Loaded ${convertedTTS.length} TTS entries from bundle (language: ${lessonLanguage})`, {
              ttsDetails: convertedTTS.map(t => ({ id: t.id, section: t.section, hasAudio: !!t.audioUrl })),
            });
            return;
          }
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
        setTtsData([]);
        setTtsStatus('ready');
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

  // `activeLesson` and `extraLessonData` are object references that get rebuilt on unrelated
  // renders, so depending on them directly re-ran this whole discovery pass — the console showed
  // every Firestore read (chapter resource IDs, batch asset query) happening twice per load, and
  // each rerun resets assetDiscoveryComplete, which in turn delays the krpano embed. Key off the
  // values actually read instead; the effect body still closes over the live objects.
  const assetDiscoveryKey = useMemo(() => {
    const chapterId = activeLesson?.chapter?.chapter_id || '';
    const topicId = activeLesson?.topic?.topic_id || '';
    const bundle = Array.isArray(extraLessonData?.assets3d)
      ? (extraLessonData!.assets3d as Array<{ id?: string }>).map((a) => a?.id || '').join(',')
      : '';
    return `${chapterId}|${topicId}|${platform}|${bundle}`;
  }, [activeLesson, extraLessonData, platform]);
  const lastAssetDiscoveryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastAssetDiscoveryKeyRef.current === assetDiscoveryKey) return;
    lastAssetDiscoveryKeyRef.current = assetDiscoveryKey;

    const fetchAssets = async () => {
      setAssetDiscoveryComplete(false);
      setAssetUrl(null);
      setMeshyAssets([]);

      // Priority 1: Check sessionStorage for 3D assets from bundle
      if (extraLessonData?.assets3d && Array.isArray(extraLessonData.assets3d) && extraLessonData.assets3d.length > 0) {
        const bundleAssets = extraLessonData.assets3d;
        log('📦', `Using ${bundleAssets.length} 3D assets from bundle`);
        
        // Convert bundle assets to MeshyAsset format
        const convertedAssets: MeshyAsset[] = bundleAssets.map((asset: any) => ({
          id: asset.id || '',
          chapter_id: activeLesson?.chapter?.chapter_id || '',
          topic_id: activeLesson?.topic?.topic_id || '',
          name: asset.name || asset.prompt || 'Asset',
          render_url: asset.render_url,
          animated_render_url: asset.animated_render_url,
          animated_glb_url: asset.animated_render_url || asset.animated_glb_url,
          storage_path: asset.storage_path,
          storage_paths: asset.storage_paths,
          model_urls: asset.model_urls,
          glb_url: pickBestGlbUrl(asset),
          thumbnail_url: asset.thumbnail_url || asset.thumbnailUrl || '',
          fbx_url: asset.fbx_url || asset.model_urls?.fbx,
          usdz_url: asset.usdz_url || asset.model_urls?.usdz,
          status: 'complete',
        })).filter((a: MeshyAsset) => a.glb_url);
        
        if (convertedAssets.length > 0) {
          setMeshyAssets(convertedAssets);
          const firstAssetUrl = selectPlatformAssetUrl(convertedAssets[0], platform);
          setAssetUrl(firstAssetUrl);
          setAssetLoading(true); // wait for 3D model to load; onAssetLoad will set false
          log('✅', `Loaded ${convertedAssets.length} 3D assets from bundle, selected format for ${platform}`);
          return;
        }
      }
      
      // Priority 2: Check topic asset_urls from sessionStorage (on web use first GLB/GLTF only)
      const effectiveTopic = extraLessonData?.topic || activeLesson?.topic;
      if (false && effectiveTopic?.asset_urls && Array.isArray(effectiveTopic.asset_urls) && effectiveTopic.asset_urls.length > 0) {
        const urlForPlatform = platform === 'web'
          ? firstGlbOrGltfUrl(effectiveTopic.asset_urls)
          : (effectiveTopic.asset_urls.find((url: string) => !isLegacyMeshyCdnUrl(url)) || null);
        if (urlForPlatform) {
          log('📦', `Using ${effectiveTopic.asset_urls.length} asset URLs from topic`);
          setAssetUrl(urlForPlatform);
          setAssetLoading(true);
          return;
        }
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
          selectedUrl = img3d.imagemodel_glb || (isSafeLessonGlbUrl(img3d.imageasset_url || '') ? img3d.imageasset_url : null) || null;
        }
        
        if (selectedUrl && (platform === 'web' ? isSafeLessonGlbUrl(selectedUrl) : !isLegacyMeshyCdnUrl(selectedUrl))) {
          log('✅', `Using image3dasset for ${platform}:`, selectedUrl.substring(0, 60));
          setAssetUrl(selectedUrl);
          setAssetLoading(true);
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
          setAssetLoading(true); // wait for 3D model to load; onAssetLoad will set false
          log('✅', `Loaded ${assets.length} 3D assets from Firestore, selected format for ${platform}`);
        } else {
          log('⚠️', 'No 3D assets found in Firestore');
          setAssetLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch 3D assets:', error);
        log('❌', 'Error fetching 3D assets from Firestore');
        setAssetLoading(false);
      }
    };
    
    fetchAssets()
      .catch((error) => {
        console.error('Failed to discover 3D assets:', error);
        setAssetLoading(false);
      })
      .finally(() => {
        setAssetDiscoveryComplete(true);
      });
  }, [assetDiscoveryKey, activeLesson, extraLessonData, platform]);

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

    const startHtmlAudio = (fallbackReason?: unknown) => {
      if (fallbackReason) {
        console.warn('Using HTML audio fallback for TTS:', fallbackReason);
      }

      // HTML Audio fallback (no krpano or no avatar/soundinterface)
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
    };

    const krpano = krpanoViewerRef.current;
    const startKrpanoAudio = () => {
      try {
        krpano?.playsound_at_hotspot?.(
          'tts',
          ttsEntry.audioUrl,
          'teacher_avatar',
          false,
          1.0,
          () => {
            (window as unknown as { __krpanoOnTTSComplete?: () => void }).__krpanoOnTTSComplete?.();
          }
        );
        ttsPlayedViaKrpanoRef.current = true;
        setTtsStatus('playing');
        setCurrentAudioUrl(ttsEntry.audioUrl || null);
        setUserPaused(false);
      } catch (err) {
        startHtmlAudio(err);
      }
    };

    const useKrpanoTTS = useKrpanoTTSRef.current && krpano?.playsound_at_hotspot;
    if (useKrpanoTTS) {
      const controller = new AbortController();
      // Track this probe so a phase change can cancel it. Without this, cleanupAudio is a
      // no-op (ttsPlayedViaKrpanoRef is only set once the probe resolves) and the stale
      // clip still starts — on top of the correct one.
      ttsProbeAbortRef.current?.abort();
      ttsProbeAbortRef.current = controller;
      const probeGeneration = ++ttsGenerationRef.current;
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      void fetch(ttsEntry.audioUrl, { method: 'HEAD', signal: controller.signal })
        .then((response) => {
          window.clearTimeout(timeout);
          // A newer phase started while we were probing — drop this result.
          if (probeGeneration !== ttsGenerationRef.current) return;
          const contentType = response.headers.get('content-type') || '';
          if (!response.ok) {
            throw new Error(`TTS HEAD ${response.status}`);
          }
          if (contentType && !contentType.toLowerCase().includes('audio')) {
            throw new Error(`TTS URL returned non-audio content-type: ${contentType}`);
          }
          startKrpanoAudio();
        })
        .catch((err) => {
          window.clearTimeout(timeout);
          if (probeGeneration !== ttsGenerationRef.current) return;
          startHtmlAudio(err);
        });
      return;
    }

    startHtmlAudio();
  }, [isMuted, getTTSForCurrentPhase, isPlayingAudio, lessonPhase, cleanupAudio]);

  const pauseTTS = useCallback(() => {
    if (ttsPlayedViaKrpanoRef.current && krpanoViewerRef.current?.destroysound) {
      try {
        krpanoViewerRef.current.destroysound('tts');
      } catch (_) {}
      ttsPlayedViaKrpanoRef.current = false;
      setTtsStatus('paused');
      setUserPaused(true);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setUserPaused(true);
    }
  }, []);

  const stopTTS = useCallback(() => {
    ttsGenerationRef.current += 1;
    ttsProbeAbortRef.current?.abort();
    ttsProbeAbortRef.current = null;
    cleanupAudio();
    setTtsStatus('ready');
    setAudioCurrentTime(0);
    setCurrentAudioUrl(null);
    setCurrentVisemes([]);
    setUserPaused(false);
  }, [cleanupAudio]);

  const resumeTTS = useCallback(() => {
    if (ttsStatus !== 'paused') return;
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.error('Failed to resume audio:', err);
      });
      setUserPaused(false);
    } else {
      // Was paused via krpano (sound destroyed); restart TTS from beginning
      playTTS();
      setUserPaused(false);
    }
  }, [ttsStatus, playTTS]);

  /**
   * Begin (or resume) narration. The lesson lands idle, so this is what actually
   * starts it. Students in a lockstep session cannot call this — the teacher does,
   * and the playback follower applies it on their behalf.
   */
  const handlePlayNarration = useCallback(() => {
    if (blockStudentPhaseControl('Play')) return;
    setAutoplayEnabled(true);
    setUserPaused(false);
    if (ttsStatus === 'paused') {
      resumeTTS();
      return;
    }
    // Same reason as handleTeacherPlaybackCommand: let the autoplay effect own playback,
    // so it stamps lastPlayedPhaseRef and the phase cannot replay itself when audio ends.
    lastPlayedPhaseRef.current = null;
  }, [blockStudentPhaseControl, ttsStatus, resumeTTS]);

  const handlePauseNarration = useCallback(() => {
    if (blockStudentPhaseControl('Pause')) return;
    setAutoplayEnabled(false);
    pauseTTS();
  }, [blockStudentPhaseControl, pauseTTS]);

  // Attendance: mark arrival once, then flag ready when the scene has loaded.
  useEffect(() => {
    if (!isStudentInSession || !joinedSessionId || !user?.uid) return;
    void reportAttendance(joinedSessionId, user.uid, { lessonReady: allReady });
  }, [isStudentInSession, joinedSessionId, user?.uid, allReady]);

  // Attendance: stamp departure + duration when leaving the player.
  useEffect(() => {
    if (!isStudentInSession || !joinedSessionId || !user?.uid) return;
    const startedAt = Date.now();
    const sid = joinedSessionId;
    const uid = user.uid;
    return () => {
      void reportAttendance(sid, uid, {
        left: true,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    };
  }, [isStudentInSession, joinedSessionId, user?.uid]);

  // Host: mirror the roster onto the session doc so students can see who joined.
  // Students may only read their OWN progress doc, so the lobby needs this relay.
  // Names only — never scores.
  const lobbyRosterKey = progressList
    .map((p) => `${p.student_uid}:${p.lesson_ready ? 1 : 0}`)
    .sort()
    .join(',');
  useEffect(() => {
    if (!isClassHost || !activeSessionId || !publishLobbyRoster) return;
    const roster = progressList
      .filter((p) => p?.student_uid && !p.removed)
      .map((p) => ({
        uid: p.student_uid,
        name: resolveStudentDisplayName(null, null, {
          uid: p.student_uid,
          displayName: p.display_name,
          email: p.email,
        }),
        ready: p.lesson_ready === true,
      }));
    void publishLobbyRoster(roster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClassHost, activeSessionId, lobbyRosterKey, publishLobbyRoster]);

  /**
   * Direct the class to an explicit point, rather than to wherever the teacher
   * happens to be looking. `directClassToCurrentView` takes no arguments, so
   * double-tap needs this variant.
   */
  const directClassToView = useCallback(
    async (view: { hlookat: number; vlookat: number; fov?: number }) => {
      const sid = hostSessionIdForSync;
      if (!sid || !user?.uid) return false;
      return updateTeacherView(sid, user.uid, {
        hlookat: view.hlookat,
        vlookat: view.vlookat,
        fov: view.fov ?? 90,
        force: true,
        sync_id: Date.now(),
      });
    },
    [hostSessionIdForSync, user?.uid]
  );

  /**
   * Double-tap the panorama to send the class to that spot.
   * Armed only while the teacher holds control, and never while the marker is
   * active (a double-tap there is drawing, not directing).
   */
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!isClassHost || !controlStudentsEnabled || markerActive || isInKrpanoVR) return;
    const el = document.getElementById(KRPANO_CONTAINER_ID);
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      const now = Date.now();
      const prev = lastTapRef.current;
      lastTapRef.current = { t: now, x: e.offsetX, y: e.offsetY };
      if (!prev) return;
      const quick = now - prev.t < 300;
      const close = Math.hypot(e.offsetX - prev.x, e.offsetY - prev.y) < 20;
      if (!quick || !close) return;

      lastTapRef.current = null;
      const point = screenToSphere(krpanoViewerRef.current as never, e.offsetX, e.offsetY);
      if (!point) return;
      const fov = Number(krpanoViewerRef.current?.get?.('view.fov')) || 90;
      void directClassToView({ hlookat: point.a, vlookat: point.v, fov });
      // Move the teacher there too, so their view matches what the class now sees.
      try {
        krpanoViewerRef.current?.call?.(
          `lookto(${point.a},${point.v},${fov},tween(easeInOutQuad,0.55),true,true)`
        );
      } catch { /* ignore */ }
      toast.info('Class directed to that spot.');
    };

    el.addEventListener('pointerdown', onPointerDown);
    return () => el.removeEventListener('pointerdown', onPointerDown);
  }, [isClassHost, controlStudentsEnabled, markerActive, isInKrpanoVR, directClassToView]);

  // --- Immersive mode requested by the teacher -----------------------------
  // Real WebXR entry needs a user gesture, and students auto-enter the lesson with
  // zero taps — so a silent force is only possible for the PRESENTATION. Headset
  // entry is attempted silently on Quest (where it has a chance) and prompted with a
  // single tap everywhere else; firing it blind elsewhere makes krpano show every
  // student a red "Entering VR mode was denied!" toast.
  const immersiveRequest = joinedSession?.teacher_immersive_request ?? null;
  const teacherWantsImmersive = Boolean(immersiveRequest?.requested) && isStudentInSession;
  const [immersivePromptOpen, setImmersivePromptOpen] = useState(false);
  const appliedImmersiveTokenRef = useRef<number | null>(null);

  /** True when the 2D chrome should collapse: really in VR, or asked to present as if. */
  const immersivePresentation = isInKrpanoVR || teacherWantsImmersive;

  const enterImmersive = useCallback(() => {
    setImmersivePromptOpen(false);
    try {
      krpanoViewerRef.current?.call?.('webvr.enterVR');
    } catch (err) {
      console.warn('[VRPlayer] enterVR failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!teacherWantsImmersive || !immersiveRequest) return;
    if (appliedImmersiveTokenRef.current === immersiveRequest.token) return;
    appliedImmersiveTokenRef.current = immersiveRequest.token;
    if (isInKrpanoVR) return;
    if (isQuestDevice) {
      // Headset: a silent attempt can succeed, and a denial here is not disruptive.
      enterImmersive();
    } else {
      setImmersivePromptOpen(true);
    }
  }, [teacherWantsImmersive, immersiveRequest, isInKrpanoVR, isQuestDevice, enterImmersive]);

  // Clear the prompt once the request is withdrawn or entry succeeded.
  useEffect(() => {
    if (!teacherWantsImmersive || isInKrpanoVR) setImmersivePromptOpen(false);
  }, [teacherWantsImmersive, isInKrpanoVR]);

  // Remember where each person put the in-headset lesson panel. Per-user UI state, so
  // localStorage — the session doc is whitelisted to launch keys and cannot hold it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    w.__krpanoOnPanelTransform = (t: { tx: number; ty: number; tz: number; scale: number }) => {
      try {
        localStorage.setItem('learnxr_vr_panel_transform', JSON.stringify(t));
      } catch { /* storage may be unavailable */ }
    };
    return () => { delete w.__krpanoOnPanelTransform; };
  }, []);

  // Restore it once the scene is up.
  useEffect(() => {
    if (!sceneReady || !krpanoViewerRef.current?.call) return;
    try {
      const raw = localStorage.getItem('learnxr_vr_panel_transform');
      if (!raw) return;
      (window as unknown as Record<string, unknown>).__krpanoPanelTransform = JSON.parse(raw);
      krpanoViewerRef.current.call('immersive_ui_apply_panel_transform()');
    } catch { /* ignore malformed prefs */ }
  }, [sceneReady]);

  // Watchdog: krpano's usercontrol flag was observed stranded at "off" in production
  // with no marker active, which kills panning silently. holders is the source of
  // truth, so repair any drift rather than trusting every code path to unwind cleanly.
  useEffect(() => {
    if (!sceneReady) return;
    const id = window.setInterval(() => {
      reconcileUserControl(krpanoViewerRef.current);
    }, 2000);
    return () => window.clearInterval(id);
  }, [sceneReady]);

  // Annotations the class is currently showing (host reads its own, student reads the teacher's).
  const liveAnnotations =
    (isClassHost ? activeSession?.teacher_annotations : joinedSession?.teacher_annotations) ?? null;
  // Matches hostSessionIdForSync's resolution order. This omitted partnerSessionMeta?.id,
  // so a partner-hosted session that never populated activeSessionId published no ink at all.
  const annotationSessionId = activeSessionId || partnerSessionMeta?.id || joinedSessionId || null;

  // Host: sweep expired strokes out of Firestore, and wipe ink when the lesson changes.
  // Expiry is otherwise render-only, so a late joiner would fetch stale ink forever.
  const launchIdForInk = activeSession?.launched_lesson?.launch_id ?? null;
  const lastInkLaunchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isClassHost || !annotationSessionId) return;
    if (lastInkLaunchRef.current === launchIdForInk) return;
    lastInkLaunchRef.current = launchIdForInk;
    if (liveAnnotations?.strokes?.length || liveAnnotations?.laser) {
      void clearAnnotations(annotationSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClassHost, annotationSessionId, launchIdForInk]);

  useEffect(() => {
    if (!isClassHost || !annotationSessionId) return;
    const hasAny =
      Boolean(liveAnnotations?.laser) ||
      (liveAnnotations?.strokes?.length ?? 0) > 0 ||
      (liveAnnotations?.model_marks?.length ?? 0) > 0;
    if (!hasAny) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const current = activeSession?.teacher_annotations;
      if (!current) return;
      const survivors = (current.strokes ?? []).filter((st) => !isStrokeExpired(st, now));
      const laserAlive = current.laser && !isStrokeExpired(current.laser, now);
      // Pins expire too. Sweeping them matters for the same reason strokes do: expiry is
      // render-side only, so a late joiner would fetch pins that everyone else has
      // already watched fade away.
      const marks = current.model_marks ?? [];
      const liveMarks = marks.filter((m) => now - m.created_ms < (m.ttl_ms ?? LASER_TTL_MS));
      if (
        survivors.length === (current.strokes ?? []).length &&
        Boolean(laserAlive) === Boolean(current.laser) &&
        liveMarks.length === marks.length
      ) return;
      void publishAnnotations(annotationSessionId, {
        ...current,
        strokes: survivors,
        laser: laserAlive ? current.laser : null,
        model_marks: liveMarks,
        sync_id: Date.now(),
      });
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isClassHost,
    annotationSessionId,
    liveAnnotations?.laser,
    liveAnnotations?.strokes?.length,
    liveAnnotations?.model_marks?.length,
  ]);

  /**
   * Roster counts. progressList holds one doc per student who has EVER joined this
   * session, so it must be split three ways rather than reported as a single number:
   * it previously over-reported (students who left still counted) and under-reported
   * (nobody appeared until they opened the player).
   */
  const rosterCounts = useMemo(() => {
    const active = progressList.filter((p) => p?.student_uid && !p.removed);
    const inLesson = active.filter((p) => !p.left_at && p.phase && p.phase !== 'idle');
    return { inLesson: inLesson.length, joined: active.length };
  }, [progressList]);

  // Enrolled total for the class — the denominator was hardcoded off.
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  useEffect(() => {
    const classId = activeSession?.class_id;
    if (!isClassHost || !classId) {
      setEnrolledCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'classes', classId));
        if (cancelled || !snap.exists()) return;
        const ids = snap.data()?.student_ids;
        setEnrolledCount(Array.isArray(ids) ? ids.length : null);
      } catch {
        if (!cancelled) setEnrolledCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isClassHost, activeSession?.class_id]);

  const handleStrokeComplete = useCallback(
    (stroke: import('../types/lms').AnnotationStroke) => {
      if (!annotationSessionId || !isClassHost) return;
      const next = appendStroke(activeSession?.teacher_annotations ?? null, stroke, MAX_INK_STROKES);
      void publishAnnotations(annotationSessionId, next);

      // Point the class at what was just drawn. Gated on lockstep for the same reason
      // double-tap-to-direct is: outside it, students are exploring on their own.
      if (controlStudentsEnabled) {
        const centre = strokeCentroid(stroke.points);
        if (centre) {
          const fov = Number(krpanoViewerRef.current?.get?.('view.fov')) || 90;
          void directClassToView({ hlookat: centre.a, vlookat: centre.v, fov });
        }
      }
    },
    [annotationSessionId, isClassHost, activeSession?.teacher_annotations, controlStudentsEnabled, directClassToView]
  );

  const handleModelMark = useCallback(
    (pick: { asset_id: string; x: number; y: number; z: number; part_name?: string | null }) => {
      if (!annotationSessionId || !isClassHost) return;
      // The tap also selects the part it landed on — that is what Isolate acts on, and it
      // is the only way a sub-mesh name ever enters the session state.
      if (pick.part_name) setModelSelectedPartName(pick.part_name);
      const current = activeSession?.teacher_annotations ?? null;
      const mark = {
        id: `m_${Date.now()}_${Math.round(performance.now() % 1000)}`,
        asset_id: pick.asset_id,
        x: pick.x,
        y: pick.y,
        z: pick.z,
        color: markerColor,
        created_ms: Date.now(),
        ttl_ms: LASER_TTL_MS,
      };
      const existing = (current?.model_marks ?? []).filter(
        (m) => Date.now() - m.created_ms < (m.ttl_ms ?? LASER_TTL_MS)
      );
      void publishAnnotations(annotationSessionId, {
        strokes: current?.strokes ?? [],
        laser: current?.laser ?? null,
        model_marks: [...existing, mark].slice(-20),
        sync_id: Date.now(),
        cleared_at: current?.cleared_at ?? 0,
      });
    },
    [annotationSessionId, isClassHost, activeSession?.teacher_annotations, markerColor]
  );

  const { handlers: markerHandlers, liveStroke, spaceHeld: markerSpaceHeld, captureRef: markerCaptureRef } = useMarkerDrawing({
    viewer: krpanoViewerRef.current as never,
    active: markerActive && isClassHost,
    mode: markerMode,
    color: markerColor,
    width: 4,
    onStrokeComplete: handleStrokeComplete,
    onModelMark: handleModelMark,
  });

  // While the marker is active, models must not be draggable: asset_N hotspots carry
  // ondown="drag3d()", so a draw gesture over a model would drag the model instead.
  useEffect(() => {
    const viewer = krpanoViewerRef.current;
    if (!viewer?.call) return;
    // Walk the existing hotspot array — addressing hotspot[asset_N] by name makes
    // krpano CREATE that hotspot, which is how switching the marker on once left
    // phantom hotspots capturing every pointer event and killed panorama dragging.
    const enabled = markerActive && isClassHost ? 'false' : 'true';
    try {
      const count = Number(viewer.get?.('hotspot.count')) || 0;
      for (let i = 0; i < count; i += 1) {
        const name = String(viewer.get?.(`hotspot[${i}].name`) ?? '');
        if (!name.startsWith('asset_')) continue;
        viewer.call(`set(hotspot[${i}].hittest, ${enabled}); set(hotspot[${i}].capture, ${enabled});`);
      }
    } catch { /* non-fatal */ }
  }, [markerActive, isClassHost, sceneReady]);


  // Push strokes into the in-headset Three.js layer. Same idiom as __krpanoUIState:
  // set a global, then call the plugin action to repaint its equirect canvas.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Reconcile clocks BEFORE anything reads an expiry. created_ms is on the teacher's
    // clock; sync_id is the teacher's Date.now() at the moment of this write, so it gives
    // the offset directly. Without this a student whose clock runs fast expires every
    // stroke on arrival and sees nothing, with no error anywhere.
    setAnnotationClockOffset(liveAnnotations?.sync_id);
    (window as unknown as Record<string, unknown>).__krpanoAnnotations = liveAnnotations ?? {
      strokes: [],
      laser: null,
    };
    // The in-headset layer does its own expiry maths in JS, so it needs the same offset.
    (window as unknown as Record<string, unknown>).__krpanoAnnotationClockOffset =
      getAnnotationClockOffset();
    try {
      krpanoViewerRef.current?.call?.('annotation_layer_update()');
      krpanoViewerRef.current?.call?.('annotation_marks_update()');
    } catch {
      /* layer may not be built yet; it reads the global on load */
    }
  }, [liveAnnotations]);

  // Annotations expire on a timer, so keep the VR layer repainting while any are live.
  useEffect(() => {
    // Every KIND of annotation needs this pump, not just strokes. It was gated on
    // laser-only (so ink never faded), then on laser-or-strokes (so a 3D PIN placed with
    // nothing else on screen never faded and was never removed — annotation_marks_update
    // is what both fades a pin and deletes its sprite once expired, and with no interval
    // it ran exactly once, at full opacity, forever).
    const hasAny =
      Boolean(liveAnnotations?.laser) ||
      (liveAnnotations?.strokes?.length ?? 0) > 0 ||
      (liveAnnotations?.model_marks?.length ?? 0) > 0;
    if (!hasAny) return;
    const id = window.setInterval(() => {
      try {
        krpanoViewerRef.current?.call?.('annotation_layer_update()');
        krpanoViewerRef.current?.call?.('annotation_marks_update()');
      } catch { /* ignore */ }
    }, 120);
    return () => window.clearInterval(id);
  }, [
    liveAnnotations?.laser,
    liveAnnotations?.strokes?.length,
    liveAnnotations?.model_marks?.length,
  ]);

  /**
   * Teacher playback commands. This is the ONLY thing that releases a held class:
   * it flips teacherPlaybackStartedRef and writes teacher_playback, which every
   * student's follower effect applies.
   */
  const playbackTokenRef = useRef(0);
  const handleTeacherPlaybackCommand = useCallback(
    (cmd: 'play' | 'pause' | 'replay', phaseOverride?: string) => {
      if (!isClassHost || !setTeacherPlayback) return;
      teacherPlaybackStartedRef.current = true;
      const phase = (phaseOverride || lessonPhase || 'intro') as SessionLessonPhase;

      if (cmd === 'pause') {
        void setTeacherPlayback({ state: 'paused', phase, play_token: playbackTokenRef.current });
        handlePauseNarration();
        return;
      }

      // play / replay both advance the token so students re-fire even on the same phase
      playbackTokenRef.current += 1;
      void setTeacherPlayback({ state: 'playing', phase, play_token: playbackTokenRef.current });

      // PURELY DECLARATIVE — do not call playTTS() here.
      //
      // Calling it directly caused both reported faults:
      //  * wrong clip ("Learn plays the intro"): lessonPhase is state, so playTTS
      //    resolved its clip through a closure holding the OLD phase.
      //  * double play: playTTS immediately sets isPlayingAudio/ttsStatus, which makes
      //    the autoplay effect skip — and that effect is the only thing that ever stamps
      //    lastPlayedPhaseRef. When audio ended the ref was still null, so the same
      //    phase was scheduled again.
      //
      // Resetting the ref and enabling autoplay lets the effect fire exactly once, with
      // the phase that has actually committed.
      if (phaseOverride && phaseOverride !== lessonPhase) {
        setPhase(phaseOverride as Parameters<typeof setPhase>[0]);
      }
      stopTTS();
      lastPlayedPhaseRef.current = null;
      setAutoplayEnabled(true);
      setUserPaused(false);
    },
    [isClassHost, setTeacherPlayback, lessonPhase, setPhase, handlePauseNarration, stopTTS]
  );

  /**
   * Student follower: mirror the teacher's playback gate.
   * Because this is driven purely by the current value of teacher_playback, a late
   * joiner or a mid-lesson reload lands on the class's CURRENT point with no extra code.
   */
  const teacherPlayback = joinedSession?.teacher_playback ?? null;
  useEffect(() => {
    if (!isStudentInSession || !controlStudentsEnabled || !allReady) return;

    // No gate yet, or explicitly held: stay silent.
    if (!teacherPlayback || teacherPlayback.state === 'idle') {
      setAutoplayEnabled(false);
      return;
    }

    if (teacherPlayback.state === 'paused') {
      setAutoplayEnabled(false);
      pauseTTS();
      return;
    }

    const applied = appliedPlaybackRef.current;
    const isSame =
      applied &&
      applied.phase === teacherPlayback.phase &&
      applied.token === teacherPlayback.play_token;
    if (isSame) return;

    appliedPlaybackRef.current = {
      phase: teacherPlayback.phase ?? null,
      token: teacherPlayback.play_token,
    };
    if (teacherPlayback.phase && teacherPlayback.phase !== lessonPhase) {
      setPhase(teacherPlayback.phase as Parameters<typeof setPhase>[0]);
    }
    lastPlayedPhaseRef.current = null;
    setUserPaused(false);
    setAutoplayEnabled(true);
  }, [
    isStudentInSession,
    controlStudentsEnabled,
    allReady,
    teacherPlayback,
    lessonPhase,
    setPhase,
    pauseTTS,
  ]);

  // Stop current audio and prepare for new phase when lessonPhase changes
  useEffect(() => {
    stopTTS();
    setWaitingForUser(false);
  }, [lessonPhase, stopTTS]);

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

      // In VR, wait 5s on first play after entering VR; otherwise 800ms
      const useVrDelay = isInKrpanoVR && vrEntryTtsDelayRef.current;
      if (useVrDelay) vrEntryTtsDelayRef.current = false;
      const delayMs = useVrDelay ? 5000 : 800;

      const timer = setTimeout(() => {
        playTTS();
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [lessonReady, lessonPhase, ttsData, ttsStatus, autoplayEnabled, userPaused, isMuted, isPlayingAudio, isInKrpanoVR, playTTS]);

  // Reset lastPlayedPhase when changing lessons
  useEffect(() => {
    lastPlayedPhaseRef.current = null;
  }, [activeLesson]);

  const handleReplay = useCallback(() => {
    if (blockStudentPhaseControl('Replay')) return;
    lastPlayedPhaseRef.current = null; // Allow replay
    stopTTS();
    setWaitingForUser(false);
    setTimeout(() => playTTS(), 200);
  }, [blockStudentPhaseControl, stopTTS, playTTS]);

  // Save lesson completion without quiz (when lesson ends without MCQs)
  // IMPORTANT: This must be defined BEFORE handleContinue which uses it
  const saveLessonCompletionToFirestore = useCallback(async () => {
    if (!user || !activeLesson || !profile) return;
    if (isGuestUser(profile)) return; // Guest: read-only, no Firebase writes

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
      const progressRef = doc(db, 'user_lesson_progress', `${user.uid}_${chapterId}_${topicId}`);
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
    if (blockStudentPhaseControl('Continue')) return;
    // Continue is a deliberate teacher advance, so it may release the class hold and
    // must be broadcast — the started-ref gate would otherwise drop it silently.
    if (isClassHost) teacherPlaybackStartedRef.current = true;
    // Stop current audio and clean up
    cleanupAudio();
    setTtsStatus('ready');
    setWaitingForUser(false);
    lastPlayedPhaseRef.current = null; // Reset so next phase can auto-play
    
    // Determine next stage based on current lesson phase
    // setPhase now owns the script index, so advanceScript() must NOT also run here:
    // it uses a functional update, so it would increment on top of the phase's index
    // and skip a script (Continue from intro landed on the outro text).
    if (lessonPhase === 'intro') {
      log('➡️', 'Moving from intro to explanation');
      setPhase('explanation');
    } else if (lessonPhase === 'explanation') {
      log('➡️', 'Moving from explanation to outro');
      setPhase('outro');
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
  }, [blockStudentPhaseControl, lessonPhase, mcqs, setPhase, advanceScript, lessonId, cleanupAudio, saveLessonCompletionToFirestore]);

  // Legacy handler for backward compatibility
  const handleNext = handleContinue;

  // Skip to Quiz - allows user to skip intro/explanation/outro and go directly to quiz
  const handleSkipToQuiz = useCallback(() => {
    if (blockStudentPhaseControl('Skip to Quiz')) return;
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
  }, [blockStudentPhaseControl, mcqs, setPhase, lessonId, cleanupAudio, saveLessonCompletionToFirestore]);

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
        currentLaunchId || undefined,
        activeLesson.topic?.learning_objective,
        'web',
        // Attribute the score to the class this lesson was actually taught in.
        joinedSession?.class_id ?? activeSession?.class_id ?? null
      );

      if (scoreId) {
        log('✅', 'Quiz score saved to student_scores:', scoreId);
      }

      // 2 & 3. Legacy writes: skip for guest (read-only)
      if (!isGuestUser(profile)) {
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

        const progressRef = doc(db, 'user_lesson_progress', `${user.uid}_${chapterId}_${topicId}`);
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
      }
      
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
      // Calculate final score and build answers for session progress
      let correct = 0;
      const finalAnswers = { ...mcqAnswers };
      const sessionAnswers: SessionQuizAnswer[] = [];

      mcqs.forEach((mcq, idx) => {
        const answer = idx === currentMcqIndex ? selectedAnswer : mcqAnswers[mcq.id];
        if (idx === currentMcqIndex && selectedAnswer !== null) {
          finalAnswers[mcq.id] = selectedAnswer;
        }
        const selectedIdx = idx === currentMcqIndex ? selectedAnswer : mcqAnswers[mcq.id];
        if (selectedIdx !== undefined && selectedIdx !== null) {
          sessionAnswers.push({
            question_index: idx,
            correct: selectedIdx === mcq.correctAnswer,
            selected_option_index: selectedIdx,
          });
        }
        if (answer === mcq.correctAnswer) correct++;
      });

      pendingQuizReportRef.current = { score: correct, total: mcqs.length, answers: sessionAnswers };

      // Submit results
      submitQuizResults(correct, mcqs.length);

      // Save to local storage
      saveProgress(lessonId, {
        completedAt: new Date().toISOString(),
        score: { correct, total: mcqs.length },
      });

      // Save to Firestore
      saveQuizResultsToFirestore(correct, mcqs.length, finalAnswers);

      setPhase('completed');
    }
  };

  immersiveUiActionRef.current = (action: string) => {
    try {
      const classControl = classControlRef.current;
      const phases = ['intro', 'explanation', 'outro', 'quiz'];
      const teacherPhaseGo = (phaseKey: string) => {
        setPhase(phaseKey as Parameters<typeof setPhase>[0]);
        if (classControl.controlEnabled && classControl.broadcastPhase) {
          void classControl.broadcastPhase(phaseKey, true);
        }
      };

      if (classControl.isStudent && classControl.controlEnabled) {
        const phaseAction = ['continue', 'replay', 'skipToQuiz'].includes(action) || action.startsWith('phaseGo:');
        if (phaseAction) {
          toast.info('Teacher is controlling the lesson. Phase controls are locked for now.');
          return;
        }
        // Audio transport is part of lockstep: without this a student can simply
        // press play and run ahead of the class. Local mute stays allowed (a11y).
        if (['ttsPlay', 'ttsPause', 'ttsToggle'].includes(action)) {
          toast.info('Teacher is controlling the lesson. Playback is locked for now.');
          return;
        }
      }

      if (action === 'continue') {
        if (classControl.isHost) {
          const currentIndex = phases.indexOf(classControl.currentPhase || 'intro');
          teacherPhaseGo(phases[Math.min(Math.max(currentIndex, 0) + 1, phases.length - 1)]);
        } else {
          handleContinue();
        }
      } else if (action === 'replay') {
        if (classControl.isHost && classControl.controlEnabled && classControl.broadcastPhase) {
          void classControl.broadcastPhase(classControl.currentPhase || 'intro', true);
        }
        handleReplay();
      } else if (action === 'skipToQuiz') {
        if (classControl.isHost && classControl.controlEnabled && classControl.broadcastPhase) {
          void classControl.broadcastPhase('quiz', true);
        }
        handleSkipToQuiz();
      } else if (action === 'mcqSubmit') {
        handleMcqSubmit();
      } else if (action === 'mcqNext') {
        handleMcqNext();
      } else if (action === 'mcqSubmitOrNext') {
        if (showMcqResultRef.current) handleMcqNext();
        else handleMcqSubmit();
      } else if (action.startsWith('mcqSelect:')) {
        const optionIndex = Number(action.split(':')[1] ?? '-1');
        if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < 4) {
          handleMcqSelect(optionIndex);
        }
      } else if (action === 'ttsPlay') {
        if (ttsStatusRef.current === 'paused') resumeTTS();
        else playTTS();
      } else if (action === 'ttsPause') {
        pauseTTS();
      } else if (action === 'ttsToggle') {
        if (ttsStatusRef.current === 'playing') pauseTTS();
        else if (ttsStatusRef.current === 'paused') resumeTTS();
        else playTTS();
      } else if (action === 'toggleMute') {
        setIsMuted((previous) => !previous);
      } else if (action.startsWith('model:')) {
        // In-headset mirrors of the bottom-bar model controls. They route through the SAME
        // handlers via refs, so the in-VR path cannot drift from the 2D one.
        if (!classControl.isHost) return;
        const verb = action.slice('model:'.length);
        if (verb === 'explodeUp') handleModelExplodeRef.current?.(1);
        else if (verb === 'explodeDown') handleModelExplodeRef.current?.(0);
        else if (verb === 'isolate') handleToggleModelIsolateRef.current?.();
        else if (verb === 'section') handleModelSectionToggleRef.current?.();
        else if (verb === 'reset') handleModelResetRef.current?.();
      } else if (action === 'directClassView') {
        if (!classControl.isHost) return;
        void directClassToCurrentView().then((ok) => {
          if (ok) toast.success('Class view updated to match yours');
          else toast.error('Could not update class view');
        });
      } else if (action === 'openChat') {
        setShowChat(true);
      } else if (action.startsWith('phaseGo:')) {
        const phaseKey = action.split(':')[1];
        if (phaseKey && phases.includes(phaseKey)) {
          if (classControl.isHost) teacherPhaseGo(phaseKey);
          else setPhase(phaseKey as Parameters<typeof setPhase>[0]);
        }
      }
    } catch (error) {
      console.warn('[KrpanoUI] Failed to handle action from immersive UI:', action, error);
    }
  };

  // ============================================================================
  // Handle Exit
  // ============================================================================

  const handleExit = () => {
    log('👋', 'Exiting lesson player');
    cleanupAudio();
    endLesson();
    navigate('/lessons');
  };

  const handleAvatarReady = useCallback(() => {
    log('✅', 'Avatar is ready');
    setAvatarReady(true);
  }, []);

  // ============================================================================
  // Preparation Screen (when navigated from Lessons with state)
  // ============================================================================

  const handleLaunchFromPrep = useCallback(() => {
    if (!prepLessonData || !lessonContext?.startLesson) return;
    const d = prepLessonData;
    const cleanChapter = {
      chapter_id: String(d.chapter?.chapter_id ?? ''),
      chapter_name: String(d.chapter?.chapter_name ?? 'Untitled Chapter'),
      chapter_number: Number(d.chapter?.chapter_number) || 1,
      curriculum: String(d.chapter?.curriculum ?? 'Unknown'),
      class_name: String(d.chapter?.class_name ?? 'Unknown'),
      subject: String(d.chapter?.subject ?? 'Unknown'),
    };
    const cleanTopic = {
      topic_id: String(d.topic?.topic_id ?? ''),
      topic_name: String(d.topic?.topic_name ?? 'Untitled Topic'),
      topic_priority: Number(d.topic?.topic_priority) || 1,
      learning_objective: String(d.topic?.learning_objective ?? ''),
      in3d_prompt: String(d.topic?.in3d_prompt ?? ''),
      skybox_id: d.topic?.skybox_id ?? null,
      skybox_url: String(d.topic?.skybox_url ?? ''),
      avatar_intro: String(d.topic?.avatar_intro ?? ''),
      avatar_explanation: String(d.topic?.avatar_explanation ?? ''),
      avatar_outro: String(d.topic?.avatar_outro ?? ''),
      asset_list: Array.isArray(d.topic?.asset_list) ? [...d.topic.asset_list] : [],
      asset_urls: Array.isArray(d.topic?.asset_urls) ? [...d.topic.asset_urls] : [],
      asset_ids: Array.isArray(d.topic?.asset_ids) ? [...d.topic.asset_ids] : [],
      mcq_ids: Array.isArray(d.topic?.mcq_ids) ? [...d.topic.mcq_ids] : [],
      tts_ids: Array.isArray(d.topic?.tts_ids) ? [...d.topic.tts_ids] : [],
      mcqs: Array.isArray(d.topic?.mcqs) ? [...d.topic.mcqs] : [],
      language: prepLang,
      ttsAudio: Array.isArray(d.ttsAudio) ? [...d.ttsAudio] : [],
    };
    const fullLessonData = {
      chapter: cleanChapter,
      topic: cleanTopic,
      image3dasset: d.image3dasset ?? null,
      startedAt: d.startedAt ?? new Date().toISOString(),
      launchedAt: new Date().toISOString(),
      _meta: d._meta ?? null,
      // VR player expects these at top level for TTS/assets loading
      ttsAudio: Array.isArray(d.ttsAudio) ? [...d.ttsAudio] : [],
      assets3d: d._meta?.assets3d ?? null,
    };
    try {
      lessonContext.startLesson(cleanChapter, cleanTopic);
      sessionStorage.setItem('activeLesson', JSON.stringify(fullLessonData));
      setExtraLessonData(fullLessonData);
      setPreparationDone(true);
    } catch (e) {
      console.error('Launch from prep failed:', e);
    }
  }, [prepLessonData, prepLang, lessonContext]);

  if (prepChapter && prepTopic && !preparationDone) {
    const meta = prepLessonData?._meta;
    const isVRAvailable = !!prepVRCapabilities;
    const canLaunch = prepCountdown === 0 && prepLessonData && !prepError && !prepLoading;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm overflow-y-auto">
        <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card rounded-2xl border shadow-2xl overflow-hidden border-border my-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/lessons')}
            className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-background/90 text-foreground hover:bg-muted shadow-sm"
          >
            <X className="w-4 h-4" />
          </Button>

          <div className="relative h-36 sm:h-44 flex-shrink-0 overflow-hidden bg-muted">
            <div className="w-full h-full flex items-center justify-center">
              <GraduationCap className="w-14 h-14 text-muted-foreground" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute top-3 left-4 flex flex-wrap gap-2">
              <span className="px-2.5 py-1 text-[11px] text-white font-semibold rounded-full bg-primary/25 border border-primary/40 backdrop-blur-sm">
                {prepChapter.curriculum}
              </span>
              <span className="px-2.5 py-1 text-[11px] text-white font-semibold rounded-full bg-primary/25 border border-primary/40 backdrop-blur-sm">
                Class {prepChapter.class}
              </span>
              <span className="px-2.5 py-1 text-[11px] text-white font-medium rounded-full bg-background/60 border border-white/20 backdrop-blur-sm">
                Ch. {prepChapter.chapter_number}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">
                {prepChapter.subject}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight drop-shadow-sm">
                {prepTopic.topic_name || 'Lesson'}
              </h2>
            </div>
          </div>

          <div className="px-5 sm:px-6 pt-4 pb-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
            {prepLessonData?.topic?.learning_objective && (
              <div className="flex gap-3 p-4 rounded-xl bg-muted/40 border border-border">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Learning objective</p>
                  <p className="text-sm text-foreground leading-snug">{prepLessonData.topic.learning_objective}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">Content</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { key: 'skybox', has: meta?.hasSkybox, Icon: Sparkles, label: '360° View' },
                  { key: 'script', has: meta?.hasScript, Icon: Mic, label: 'Narration', sub: meta?.scriptSections ? `${meta.scriptSections} sections` : null },
                  { key: 'assets', has: meta?.hasAssets, Icon: Box, label: '3D Assets' },
                  { key: 'mcqs', has: meta?.hasMcqs, Icon: HelpCircle, label: 'Quiz' },
                ].map(({ key, has, Icon, label, sub }) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${has ? 'bg-primary/5 border-primary/25' : 'bg-muted/30 border-border'}`}
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${has ? 'bg-primary/15' : 'bg-muted'}`}>
                      <Icon className={`w-4 h-4 ${has ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{label}</p>
                      <p className={`text-[11px] font-semibold truncate ${has ? 'text-primary' : 'text-muted-foreground'}`}>{sub || (has ? 'Available' : '—')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {prepError && (
              <div className="flex gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/25">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Unable to load lesson</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{prepError}</p>
                </div>
              </div>
            )}

            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border ${isVRAvailable ? 'bg-primary/5 border-primary/25' : 'bg-muted/30 border-border'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVRAvailable ? 'bg-primary/15' : 'bg-muted'}`}>
                  <Glasses className={`w-5 h-5 ${isVRAvailable ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isVRAvailable ? 'text-primary' : 'text-foreground'}`}>
                    {isVRAvailable ? 'VR ready' : 'No VR detected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isVRAvailable ? (prepVRCapabilities?.deviceType?.replace('-', ' ') || 'VR') : 'Connect a headset for immersive mode'}
                  </p>
                </div>
              </div>
            </div>

            {prepCountdown > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/25">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Preparing lesson</span>
                  <span className="text-sm font-bold tabular-nums text-primary">{prepCountdown}s</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${((10 - prepCountdown) / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Skybox, assets & content</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-1">
              {canLaunch ? (
                isVRAvailable ? (
                  <div className="space-y-3">
                    <Button
                      className="w-full h-11 gap-2 font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-0"
                      onClick={() => {
                        handleLaunchFromPrep();
                        enterVRWhenReadyRef.current = true;
                        setTimeout(() => handleStartLesson(), 0);
                      }}
                    >
                      <Play className="w-4 h-4" />
                      Start lesson in VR
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11 border-border"
                      onClick={() => {
                        handleLaunchFromPrep();
                        setTimeout(() => handleStartLesson(), 0);
                      }}
                    >
                      Or continue in 2D
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full h-11 gap-2 font-semibold"
                    onClick={() => {
                      handleLaunchFromPrep();
                      setTimeout(() => handleStartLesson(), 0);
                    }}
                  >
                    <Play className="w-4 h-4" />
                    Start lesson
                  </Button>
                )
              ) : null}
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button variant="outline" className="sm:flex-1 border-border h-11" onClick={() => navigate('/lessons')}>
                  Cancel
                </Button>
                {!canLaunch && (
                  <Button
                    className="sm:flex-1 h-11 gap-2 font-semibold"
                    onClick={handleLaunchFromPrep}
                    disabled={!canLaunch}
                  >
                    {prepCountdown > 0 ? (
                      <>
                        <Clock className="w-4 h-4" />
                        Ready in {prepCountdown}s…
                      </>
                    ) : prepLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing…
                      </>
                    ) : prepError ? (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        {prepError.length > 30 ? 'Unavailable' : prepError}
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Finalizing…
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {prepLoading && !prepCountdown && (
              <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Fetching content…
              </p>
            )}
            {prepLessonData && !prepError && !prepLoading && prepCountdown === 0 && (
              <p className="text-center text-xs text-primary font-medium flex items-center justify-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Lesson ready to launch
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Initialization / Loading State
  // ============================================================================

  // Show loading while data initializes
  if (!dataInitialized) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Loading Lesson...</h1>
          <p className="text-muted-foreground mb-2">Please wait while we prepare your lesson.</p>
          <p className="text-xs text-muted-foreground font-mono">
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
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Failed to Load Lesson</h1>
          <p className="text-muted-foreground mb-4">{initError}</p>
          <p className="text-xs text-muted-foreground mb-6 font-mono">Phase: {initPhase}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                console.log('🔄 Retrying lesson load...');
                window.location.reload();
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted 
                       text-foreground font-semibold rounded-xl"
            >
              Retry
            </button>
            <button
              onClick={() => {
                console.log('🚪 Navigating back to lessons...');
                sessionStorage.removeItem('activeLesson');
                navigate('/lessons');
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary 
                       text-primary-foreground font-semibold rounded-xl shadow-lg"
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
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">No Lesson Selected</h1>
          <p className="text-muted-foreground mb-4">
            Please select a lesson from the library to start learning.
          </p>
          <button
            onClick={() => navigate('/lessons')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary 
                     text-primary-foreground font-semibold rounded-xl shadow-lg"
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
  // Use krpano for all skybox (with or without 3D assets; 3D via krpano threejs plugin). R3F only for GLB-only (no skybox).
  const useIntegratedScene = false;
  // Always proxy skybox for integrated scene to avoid CORS with TextureLoader (used only when useIntegratedScene is re-enabled)
  const resolvedSkyboxUrlForScene = skyboxImageUrl
    ? getProxyAssetUrl(skyboxImageUrl)
    : '';
  const useModelOnlyScene = !!(assetUrl && isGlbOrGltfUrl(assetUrl) && !skyboxImageUrl);

  // ============================================================================
  // Render
  // ============================================================================

  if (isStudentRemoved) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950/95 text-white p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 ring-4 ring-amber-500/5 animate-pulse">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Waiting for Teacher Approval</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            You have been removed from the class session. A request to rejoin has been sent to the teacher. Please wait in this lobby.
          </p>
          <div className="pt-2">
            <button
              onClick={handleExit}
              className="px-6 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Exit Class
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bar heights live on the ROOT so every layer can offset against them.
  // They used to be set inline on PlayerChrome, which meant its siblings — including
  // the lesson panel — silently fell back to hard-coded values.
  const hudMetrics = {
    '--hud-top': `calc(${playerViewport.isCompact ? '3.25rem' : '3.5rem'} + env(safe-area-inset-top, 0px))`,
    '--hud-bottom': `calc(${playerViewport.isCompact ? '3.75rem' : '4rem'} + env(safe-area-inset-bottom, 0px))`,
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden" style={hudMetrics}>
      {/* Main 3D view: integrated (skybox+model), or model-only when GLB but no skybox, else krpano */}
      <div className="absolute inset-0 z-0">
        {useIntegratedScene && resolvedSkyboxUrlForScene ? (
          <Canvas
            camera={{ position: [0, 0, 0.1], fov: 75, near: 0.1, far: 1000 }}
            gl={{ antialias: true }}
            style={{ background: '#050810' }}
          >
            <Suspense fallback={null}>
              <LessonSceneIntegrated
                skyboxUrl={resolvedSkyboxUrlForScene}
                assetUrl={assetUrl}
                onSkyboxLoad={() => setSceneReady(true)}
                onSkyboxError={() => {
                  setSkyboxError('Failed to load skybox');
                  setSceneReady(true);
                }}
                onAssetLoad={() => setAssetLoading(false)}
                onAssetError={() => setAssetLoading(false)}
                onViewChange={isClassHost && useIntegratedScene ? (h, v, fov) => viewSyncSendRef.current?.(h, v, fov) : undefined}
                teacherView={isStudentInSession && useIntegratedScene ? teacherView : undefined}
              />
            </Suspense>
          </Canvas>
        ) : useModelOnlyScene && assetUrl ? (
          <Canvas
            camera={{ position: [0, 0, 0.1], fov: 75, near: 0.1, far: 1000 }}
            gl={{ antialias: true }}
            style={{ background: '#050810' }}
          >
            <Suspense fallback={null}>
              <LessonSceneIntegrated
                skyboxUrl=""
                assetUrl={assetUrl}
                onSkyboxLoad={() => {}}
                onSkyboxError={() => {}}
                onAssetLoad={() => {
                  setAssetLoading(false);
                  setSceneReady(true);
                }}
                onAssetError={() => setAssetLoading(false)}
                onViewChange={isClassHost && useModelOnlyScene ? (h, v, fov) => viewSyncSendRef.current?.(h, v, fov) : undefined}
                teacherView={isStudentInSession && useModelOnlyScene ? teacherView : undefined}
                skyboxOptional
              />
            </Suspense>
          </Canvas>
        ) : (
          <div
            id="krpano-viewer-container"
            ref={(el) => {
              (krpanoContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              if (el) setKrpanoContainerMounted(true);
            }}
            className="absolute inset-0 w-full h-full"
            style={{ background: '#050810' }}
          />
        )}

        {/* Loading overlay: skybox and, when integrated (skybox+3D), 3D asset must be ready.
            The krpano-native path (skybox + 3D together, the common case) loads its GLBs
            through krpano's own threejs plugin outside React — krpano3dAssetsReady/krpanoAssetLoadCount
            are fed by the onloaded hotspot callback wired in buildKrpanoXml.ts, so we can still show
            an accurate "N of M objects ready" readout instead of a bare spinner. */}
        {(() => {
          const isKrpanoNativePath = !useIntegratedScene && !useModelOnlyScene;
          const krpanoAssetsPending = isKrpanoNativePath && !krpano3dAssetsReady && krpanoAssetLoadCount.total > 0;
          const show =
            skyboxLoading ||
            (skyboxImageUrl && !sceneReady) ||
            (useIntegratedScene && assetLoading) ||
            (useModelOnlyScene && assetLoading) ||
            krpanoAssetsPending;
          // The welcome screen is itself a modal that already carries the same progress bar and
          // the Enter Lesson button. Showing this veil on top of it meant two competing popups:
          // the loader card sat over the welcome card, then vanished to reveal the button, which
          // read as a jarring hand-off. Suppressed here so progress fills and the button unlocks
          // inside one continuous panel.
          if (!show || showWelcomeScreen) return null;
          return (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/80 z-veil">
              {isKrpanoNativePath ? (
                // krpano-native path (skybox + 3D together, the common case): every stage is
                // observable, so show real progress rather than an indeterminate spinner.
                <div className="w-full max-w-sm px-8 py-7 mx-4 bg-black/90 rounded-2xl backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50">
                  <LessonLoadProgress allReady={allReady} {...loadStages} />
                </div>
              ) : (
                // Model-only / integrated React paths report byte-level progress instead.
                <Asset3DLoadingCard
                  countMode
                  loadedCount={krpanoAssetLoadCount.loaded}
                  totalCount={krpanoAssetLoadCount.total}
                  label={skyboxLoading || (skyboxImageUrl && !sceneReady) ? 'Loading lesson environment…' : undefined}
                />
              )}
            </div>
          );
        })()}

        {/* No skybox warning */}
        {!skyboxLoading && !skyboxImageUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 z-veil">
            <div className="text-center max-w-sm mx-auto px-4 opacity-50">
              <AlertTriangle className="w-8 h-8 text-amber-400/50 mx-auto mb-2" />
              <p className="text-amber-400/50 text-sm">No skybox available</p>
            </div>
          </div>
        )}

      </div>

      {/* Live class host controls — class code, roster, student view, redirect */}
      {/* Waiting-room lobby: the class is held until the teacher presses Start.
          Students see the loaded scene behind this, silent. */}
      {isStudentInSession && controlStudentsEnabled && lessonReady &&
        (!joinedSession?.teacher_playback || joinedSession.teacher_playback.state === 'idle') && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[45] flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-cyan-400/25 bg-slate-950/85 p-4 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
              <p className="text-sm font-semibold">Waiting for your teacher</p>
            </div>
            <p className="mt-1 text-xs leading-snug text-white/55">
              You're in the lesson. It will begin when your teacher starts the class.
            </p>

            {Array.isArray(joinedSession?.lobby_roster) && joinedSession.lobby_roster.length > 0 && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  In the class ({joinedSession.lobby_roster.length})
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {joinedSession.lobby_roster.slice(0, 12).map((member) => (
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
                  {joinedSession.lobby_roster.length > 12 && (
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/50">
                      +{joinedSession.lobby_roster.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const next = !handRaised;
                setHandRaised(next);
                void reportSignal?.({ handRaised: next });
                toast.info(next ? 'Hand raised — your teacher can see it.' : 'Hand lowered.');
              }}
              className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                handRaised
                  ? 'border-amber-300/40 bg-amber-400/20 text-amber-100'
                  : 'border-white/12 bg-white/[0.05] text-white/70 hover:bg-white/10'
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
              {handRaised ? 'Lower hand' : 'Raise hand'}
            </button>
          </div>
        </div>
      )}

      {/* Teacher marker strokes, projected from sphere coords onto the screen.
          Gated on ACTUALLY being in VR, not on `immersivePresentation`.
          `immersivePresentation` includes `teacherWantsImmersive`, which is
          `requested && isStudentInSession` — student-exclusive. Taking control raises
          teacher_immersive_request for the whole class, so gating here unmounted this
          overlay for every student the instant the teacher took control, including
          students still on a flat screen who never entered VR. Their only fallback is the
          krpano 3D layer, which needs krpano.webvr.isenabled — false on a desktop. Net
          effect: the teacher saw their own ink and no student saw any, in either mode. */}
      {!isInKrpanoVR && (
        <AnnotationOverlay
          annotations={liveAnnotations}
          viewer={krpanoViewerRef.current as never}
          localStrokes={liveStroke ? [liveStroke] : []}
        />
      )}

      {/* Draw-capture layer. Only mounted while marker mode is on, so it never
          steals pointer events from the panorama at other times. */}
      {markerActive && isClassHost && !immersivePresentation && (
        <div
          ref={markerCaptureRef}
          // touch-none is required: it stops the browser claiming the gesture as a scroll,
          // which is what guarantees pointer events for both the one-finger draw and the
          // two-finger pan. The cursor flips to a grab hand while Space is held so the pan
          // mode is visible rather than something the teacher has to remember.
          className={`pointer-events-auto absolute inset-0 z-annot touch-none ${
            markerSpaceHeld ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          }`}
          {...markerHandlers}
        />
      )}

      {/* Immersive prompt. Rendered at the ROOT, not inside PlayerChrome: the chrome
          unmounts the moment immersive presentation engages, which would take the
          prompt with it before the student could tap. */}
      {immersivePromptOpen && !isInKrpanoVR && (
        <div className="pointer-events-auto absolute inset-0 z-gate flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-6 text-center text-white shadow-2xl">
            <Glasses className="mx-auto mb-3 h-8 w-8 text-cyan-400" />
            <p className="text-base font-semibold">Your teacher started immersive mode</p>
            <p className="mt-1 text-sm leading-snug text-white/60">
              Tap to enter. Your browser needs this tap — it won't let the lesson start
              immersive on its own.
            </p>
            <button
              type="button"
              onClick={enterImmersive}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:from-cyan-400 hover:to-blue-500"
            >
              Enter immersive
            </button>
            <button
              type="button"
              onClick={() => setImmersivePromptOpen(false)}
              className="mt-2 w-full px-4 py-2 text-xs text-white/45 transition hover:text-white/70"
            >
              Stay in 2D
            </button>
          </div>
        </div>
      )}

      {showLiveClassHostOverlay && (
        <LiveClassHostOverlay
          session={activeSession}
          sessionId={activeSessionId || partnerSessionMeta?.id || null}
          hostUid={user?.uid ?? null}
          progressList={progressList}
          sessionCode={hostSessionCode}
          skyboxUrlOverride={skyboxImageUrl || null}
          openDrawer={hostDrawer}
          onDrawerChange={setHostDrawer}
        />
      )}


      {/* Drag Hint (student or when not in class session) */}
      <AnimatePresence>
        {showDragHint && sceneReady && (skyboxImageUrl || useModelOnlyScene) && !(isTeacherInSession && (useKrpanoView || useIntegratedScene || useModelOnlyScene)) && !(isPhoneViewport && isStudentInSession) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-card/90 backdrop-blur-sm rounded-full text-foreground/90 text-sm border border-border">
              <Move className="w-4 h-4" />
              Drag to look around
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------
          Player chrome. Replaces the Exit button, the floating title bar, the
          phone controls chip and the top-right control row — all of which used
          to be independent absolutely-positioned layers that the host overlay
          then covered. Bars are bands; the stage between them is bounded, so
          content can no longer be buried.
          ------------------------------------------------------------------ */}
      {!immersivePresentation && !showWelcomeScreen && (
        <PlayerChrome
          topBar={
            <PlayerTopBar
              onExit={handleExit}
              title={effectiveLesson?.topic?.topic_name || 'Lesson'}
              subtitle={`${effectiveLesson?.chapter?.subject || ''} · ${getPhaseLabel()}`}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              showChat={showChat}
              onToggleChat={() => setShowChat(!showChat)}
              chatAvailable={!(playerViewport.isCompact && isStudentInSession && !isQuestDevice)}
              compact={playerViewport.isCompact}
              isHost={isClassHost}
              sessionCode={hostSessionCode}
              liveCount={rosterCounts.inLesson}
              joinedCount={rosterCounts.joined}
              classCount={enrolledCount}
              pendingCount={Array.isArray(activeSession?.join_requests) ? activeSession.join_requests.length : 0}
              onCopyCode={async () => {
                if (!hostSessionCode) return;
                try {
                  await navigator.clipboard.writeText(hostSessionCode);
                  toast.success('Class code copied');
                } catch {
                  toast.error('Could not copy class code');
                }
              }}
              onOpenApprovals={() => setHostDrawer((d) => (d === 'approvals' ? null : 'approvals'))}
              progress={lessonReady ? getPhaseProgress() : null}
              onStopLesson={
                // Phone students must not be able to end their own lesson by accident.
                lessonReady && !(playerViewport.isCompact && isStudentInSession && !isQuestDevice)
                  ? handleStopLesson
                  : undefined
              }
              onEnterVR={
                isQuestDevice && useKrpanoView && !isInKrpanoVR
                  ? () => {
                      try {
                        krpanoViewerRef.current?.call?.('webvr.enterVR');
                      } catch (e) {
                        console.warn('[Krpano] webvr.enterVR failed:', e);
                      }
                    }
                  : undefined
              }
              tour={
                isTourStop && tourStopTopics.length > 1 && sceneReady && !showWelcomeScreen
                  ? {
                      index: currentStopIndex,
                      total: tourStopTopics.length,
                      onPrev: isClassHost && currentStopIndex > 0
                        ? () => goToTourStop(currentStopIndex - 1)
                        : undefined,
                      onNext: isClassHost && currentStopIndex < tourStopTopics.length - 1
                        ? () => goToTourStop(currentStopIndex + 1)
                        : undefined,
                    }
                  : null
              }
              endSessionConfirming={endSessionConfirming}
              onEndSession={
                isClassHost && endSession
                  ? async () => {
                      // Two-step, in-app. This gated on window.confirm(), which returns
                      // false outright in any browser that has suppressed dialogs — so the
                      // handler returned before writing anything: no request, no toast, no
                      // console output. Pressing End simply did nothing.
                      if (!endSessionConfirming) {
                        setEndSessionConfirming(true);
                        window.setTimeout(() => setEndSessionConfirming(false), 4000);
                        return;
                      }
                      setEndSessionConfirming(false);
                      // Resolve the id the way every other host-sync path here does. The
                      // context resolves activeSessionId ONLY, so a partner-hosted session
                      // returned false without attempting a write — and the old code
                      // discarded that false silently.
                      const endedSessionId = activeSessionId || partnerSessionMeta?.id || null;
                      const ok = await endSession(endedSessionId ?? undefined);
                      if (ok) {
                        if (endedSessionId) navigate(`/class-session/${endedSessionId}/results`);
                        else handleExit();
                      } else {
                        toast.error('Could not end the session — it is still live. See the console for why.');
                      }
                    }
                  : undefined
              }
            />
          }
          bottomBar={
            <PlayerBottomBar
              isHost={isClassHost}
              compact={playerViewport.isCompact}
              playbackState={activeSession?.teacher_playback?.state ?? 'idle'}
              currentPhase={lessonPhase}
              onPlaybackCommand={handleTeacherPlaybackCommand}
              onLocalPlayToggle={() => (isPlayingAudio ? handlePauseNarration() : handlePlayNarration())}
              isPlayingAudio={isPlayingAudio}
              playbackLocked={isStudentInSession && controlStudentsEnabled}
              controlStudentsEnabled={controlStudentsEnabled}
              onToggleControl={(enabled) => {
                if (!enabled) teacherPlaybackStartedRef.current = false;
                // Taking control also asks the class into immersive mode.
                void (async () => {
                  const ok = await setSessionControl?.(enabled, enabled);
                  // Snap the whole class onto the teacher's view the moment control is
                  // taken, rather than leaving them scattered until the teacher next
                  // happens to move. Awaited so students already have
                  // control_students_enabled true when the forced Direct lands.
                  if (ok && enabled) await directClassToCurrentView();
                })();
              }}
              classStarted={classStarted}
              studentUiVisible={studentUiVisible}
              onToggleStudentUi={(visible) => {
                void setStudentUiVisible?.(visible);
              }}
              onForceStudentsIn={async () => {
                const ok = await forceStudentsToLesson?.();
                toast[ok ? 'success' : 'error'](
                  ok ? 'Bringing everyone into the lesson…' : 'Could not reach the class.'
                );
              }}
              canForce={Boolean(activeSession?.launched_lesson || activeSession?.launched_scene)}
              onDirectView={() => void directClassToCurrentView()}
              liveCount={rosterCounts.joined}
              onOpenRoster={() => setHostDrawer((d) => (d === 'roster' ? null : 'roster'))}
              raisedHands={progressList.filter((s) => s.hand_raised).length}
              modelPartCount={modelPartCount}
              modelExplode={modelExplode}
              onModelExplodeChange={handleModelExplode}
              modelIsolated={modelIsolated}
              modelSelectedPartName={modelSelectedPartName}
              onToggleModelIsolate={handleToggleModelIsolate}
              modelClip={modelClip}
              onModelClipChange={handleModelClipChange}
              onModelReset={handleModelReset}
              markerActive={markerActive}
              markerColor={markerColor}
              onToggleMarker={() => setMarkerActive((v) => !v)}
              onMarkerColorChange={setMarkerColor}
            />
          }
        />
      )}

      {/* Avatar Panel - hidden for now; set SHOW_TEACHER_AVATAR true to re-enable */}
      {SHOW_TEACHER_AVATAR && (
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
                curriculum={effectiveLesson?.chapter?.curriculum}
                class={effectiveLesson?.chapter?.class_name}
                subject={effectiveLesson?.chapter?.subject}
                useAvatarKey={true}
                externalThreadId={threadId}
                onReady={handleAvatarReady}
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
      )}

      {/* Welcome Screen - Before Lesson Starts */}
      <AnimatePresence>
        {showWelcomeScreen && (
          <motion.div
            key="welcome-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: 'auto' }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            className="absolute inset-0 z-gate flex items-center justify-center bg-black/60 backdrop-blur-sm"
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

              {/* Lesson Info - use effectiveLesson so dashboard-open works */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {effectiveLesson?.chapter?.curriculum}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {effectiveLesson?.chapter?.class_name}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {effectiveLesson?.topic?.topic_name || 'Lesson'}
                </h2>
                <p className="text-sm text-slate-400">
                  {effectiveLesson?.chapter?.subject} • Chapter {effectiveLesson?.chapter?.chapter_number}
                </p>
              </div>

              {/* Lesson Preview */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 text-left">
                <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  What you'll learn
                </h3>
                <p className="text-xs text-slate-400 line-clamp-3">
                  {effectiveLesson?.topic?.learning_objective ||
                   effectiveLesson?.topic?.avatar_intro?.substring(0, 150) + '...' ||
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

              {/* Load progress — the buttons below are gated on `allReady`, so show what is
                  still outstanding instead of leaving the user with a disabled button and no
                  explanation. Disappears once everything is ready. */}
              {/* Kept mounted once ready rather than unmounted, so the card doesn't jump height
                  at the exact moment the button becomes clickable — the bar simply settles at
                  100% / "Ready to begin" directly above it. */}
              <div className="mb-6 rounded-xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-sm">
                <LessonLoadProgress allReady={allReady} {...loadStages} />
              </div>

              {/* Start Buttons - enabled only when skybox, 3D assets, and TTS are ready */}
              {isQuestDevice ? (
                <div className="space-y-3">
                  <motion.button
                    onClick={() => {
                      if (!allReady) return;
                      const k = krpanoViewerRef.current;
                      if (k?.call) {
                        try {
                          k.call('webvr.enterVR');
                        } catch (e) {
                          console.warn('[Krpano] webvr.enterVR failed:', e);
                        }
                      }
                      handleStartLesson();
                    }}
                    disabled={!allReady}
                    whileHover={allReady ? { scale: 1.02 } : undefined}
                    whileTap={allReady ? { scale: 0.98 } : undefined}
                    className={`w-full flex items-center justify-center gap-3 px-8 py-4 
                             text-lg font-bold rounded-xl transition-all duration-300
                             ${allReady
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 cursor-pointer'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                  >
                    {allReady ? (
                      <>
                        <Play className="w-6 h-6" />
                        Start Lesson in VR
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Preparing VR experience...
                      </>
                    )}
                  </motion.button>

                  <button
                    disabled={!allReady}
                    onClick={() => {
                      if (!allReady) return;
                      handleStartLesson();
                    }}
                    className={`w-full px-4 py-2 text-sm rounded-lg border transition-colors
                      ${allReady
                        ? 'border-slate-600 text-slate-200 hover:bg-slate-800/80'
                        : 'border-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >
                    Or continue in 2D
                  </button>
                </div>
              ) : (
                <motion.button
                  onClick={handleStartLesson}
                  disabled={!allReady}
                  whileHover={allReady ? { scale: 1.02 } : undefined}
                  whileTap={allReady ? { scale: 0.98 } : undefined}
                  className={`w-full flex items-center justify-center gap-3 px-8 py-4
                           text-lg font-bold rounded-xl transition-all duration-300
                           ${allReady
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 cursor-pointer'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                >
                  {allReady ? (
                    <>
                      <Play className="w-6 h-6" />
                      Enter Lesson
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Loading...
                    </>
                  )}
                </motion.button>
              )}

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

      {/* Lesson content — narration, stage card and quiz. BOTTOM-LEFT.
          It must be CONTENT-SIZED, never a full-height flex child: when this was a
          centred, stretched box it covered the middle of the panorama (94% of the
          width on a phone) and swallowed the mousedown krpano needs to pan, which
          also killed Direct-view and double-tap. Height is capped so it clears the
          bottom bar. */}
      {!immersivePresentation && hasLessonNarrationOrQuiz && !(playerViewport.isCompact && isStudentInSession && !isQuestDevice) && (
      <div
        className={`absolute z-stage max-w-md w-[min(28rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain ${
          playerViewport.isCompact
            ? 'left-[max(0.75rem,env(safe-area-inset-left))] bottom-[calc(var(--hud-bottom)+0.5rem)] max-h-[min(52vh,26rem)] pr-1'
            : 'left-4 bottom-[calc(var(--hud-bottom)+0.75rem)] max-h-[calc(100vh-var(--hud-top)-var(--hud-bottom)-1.5rem)]'
        }`}
      >
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

              {/* Hotspot clicked feedback */}
              <AnimatePresence>
                {lastHotspotClicked && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/40 flex items-center gap-2"
                  >
                    <Target className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-foreground">
                      {Array.isArray(extraLessonData?.topic?.hotspots)
                        ? (extraLessonData.topic.hotspots as KrpanoHotspotOption[]).find((h) => h.name === lastHotspotClicked)?.label ?? lastHotspotClicked
                        : lastHotspotClicked}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

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

          {/* MCQ Display - Compact (hidden in krpano VR; handled by immersive UI there) */}
          {!immersivePresentation && lessonPhase === 'quiz' && currentMcq && (
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
      )}

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

const VRLessonPlayerKrpano = () => {
  return (
    <VRPlayerErrorBoundary onReset={() => {
      sessionStorage.removeItem('activeLesson');
      window.location.href = '/lessons';
    }}>
      <SafeVRLessonPlayer />
    </VRPlayerErrorBoundary>
  );
};

export default VRLessonPlayerKrpano;
