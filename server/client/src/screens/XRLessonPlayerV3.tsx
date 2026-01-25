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

import React, { useEffect, useRef, useState, useCallback, Component, ErrorInfo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';
import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Loader2, AlertTriangle, Glasses, SkipForward, Award, Home } from 'lucide-react';

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
type LessonPhase = 'intro' | 'content' | 'outro' | 'mcq' | 'complete';

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
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-lg border border-red-500/50 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
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
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assetsGroupRef = useRef<THREE.Group | null>(null);
  const primaryAssetRef = useRef<THREE.Group | null>(null);
  
  // XR Controller refs
  const controller1Ref = useRef<THREE.Group | null>(null);
  const controller2Ref = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const controllerModelFactoryRef = useRef<XRControllerModelFactory | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const hoveredObjectRef = useRef<THREE.Object3D | null>(null);
  const lastGrabTimeRef = useRef<Map<string, number>>(new Map());
  const controllersSetupRef = useRef<Set<number>>(new Set());
  
  // VR UI refs
  const scriptPanelRef = useRef<THREE.Mesh | null>(null);
  const mcqPanelRef = useRef<THREE.Mesh | null>(null);
  const lastScriptPanelUpdateRef = useRef<number>(0);
  const lastProgressPercentRef = useRef<number>(-1);
  
  // State
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [skyboxUrl, setSkyboxUrl] = useState<string | null>(null);
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(null);
  const [isVRSupported, setIsVRSupported] = useState<boolean | null>(null);
  
  // Lesson content state
  const [ttsData, setTtsData] = useState<TTSData[]>([]);
  const [mcqData, setMcqData] = useState<MCQData[]>([]);
  const [meshyAssets, setMeshyAssets] = useState<MeshyAsset[]>([]);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>('intro');
  const [currentTtsIndex, setCurrentTtsIndex] = useState(0);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(0);
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [mcqAnswered, setMcqAnswered] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);
  
  // TTS State Machine
  type TTSState = 'idle' | 'playing' | 'paused' | 'ended';
  const [ttsState, setTtsState] = useState<TTSState>('idle');
  const [audioProgress, setAudioProgress] = useState(0); // 0-1
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Debug logger
  const addDebug = useCallback((msg: string) => {
    console.log(`[V3 Debug] ${msg}`);
    setDebugInfo(prev => [...prev.slice(-15), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);
  
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
      
      const lessonLanguage = (lessonData as any).language || 'en';
      
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
          const convertedTTS: TTSData[] = languageFilteredTTS.map((tts: any) => ({
            id: tts.id || '',
            section: tts.script_type || tts.section || 'full',
            audioUrl: tts.audio_url || tts.audioUrl || tts.url || '',
            text: tts.text || tts.script_text || '',
          }));
          
          setTtsData(convertedTTS);
          addDebug(`✅ Loaded ${convertedTTS.length} TTS entries from bundle (language: ${lessonLanguage})`, {
            ttsDetails: convertedTTS.map(t => ({ id: t.id, section: t.section, hasAudio: !!t.audioUrl })),
          });
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
              ttsResults.push({
                id: ttsId,
                section: data.section || ttsId.split('_').slice(-3, -2).join('_') || 'content',
                audioUrl: data.audio_url || data.audioUrl,
                text: data.text || data.content || '',
              });
              addDebug(`TTS loaded: ${ttsId.substring(0, 40)}... (${ttsLang})`);
            }
          }
        } catch (err) {
          addDebug(`TTS error for ${ttsId}: ${err}`);
        }
      }
      
      setTtsData(ttsResults);
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
      
      const lessonLanguage = (lessonData as any).language || 'en';
      
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
      if (isVRSupported && containerRef.current && rendererRef.current) {
        try {
          const vrButton = VRButton.createButton(rendererRef.current);
          vrButton.style.position = 'absolute';
          vrButton.style.bottom = '20px';
          vrButton.style.left = '50%';
          vrButton.style.transform = 'translateX(-50%)';
          vrButton.style.zIndex = '100';
          containerRef.current.appendChild(vrButton);
          vrButtonRef.current = vrButton;
          
          // Listen for session start/end
          rendererRef.current.xr.addEventListener('sessionstart', () => {
            console.log('[XRLessonPlayerV3] VR session started');
            setLoadingState('in-vr');
          });
          
          rendererRef.current.xr.addEventListener('sessionend', () => {
            console.log('[XRLessonPlayerV3] VR session ended');
            setLoadingState('ready');
          });
        } catch (vrErr: any) {
          console.error('[XRLessonPlayerV3] VR button creation error:', vrErr);
          addDebug(`VR button error: ${vrErr?.message || vrErr}`);
        }
      }
    
    // Setup lighting
    // High ambient light since skybox uses MeshBasicMaterial (self-illuminating)
    // These lights are mainly for future 3D assets inside the skybox
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);
    
    // Add hemisphere light for natural lighting (sky/ground gradient)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    
    console.log('[XRLessonPlayerV3] Lights added: Ambient, Directional, Hemisphere');
    
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
        
        // Check panels first (for button clicks)
        const panels = [scriptPanelRef.current, mcqPanelRef.current].filter(Boolean) as THREE.Mesh[];
        const panelIntersects = raycaster.intersectObjects(panels, false);
        
        if (panelIntersects.length > 0) {
          const intersect = panelIntersects[0];
          const panel = intersect.object as THREE.Mesh;
          
          if (panel.userData.hasButtons && panel.userData.buttons && intersect.uv) {
            // Convert UV to canvas coordinates
            const uv = intersect.uv;
            const canvasWidth = 1400;
            const canvasHeight = panel.userData.panelType === 'mcq' ? 1000 : 800;
            const pixelX = uv.x * canvasWidth;
            const pixelY = (1 - uv.y) * canvasHeight;
            
            // Find clicked button
            for (const button of panel.userData.buttons) {
              const { bounds, action } = button;
              if (pixelX >= bounds.x && pixelX <= bounds.x + bounds.width &&
                  pixelY >= bounds.y && pixelY <= bounds.y + bounds.height) {
                // Debounce button clicks
                const buttonId = `${panel.name}_${bounds.x}_${bounds.y}`;
                const now = Date.now();
                const lastClick = lastGrabTimeRef.current.get(buttonId) || 0;
                if (now - lastClick < 300) {
                  return;
                }
                lastGrabTimeRef.current.set(buttonId, now);
                
                // Execute button action
                try {
                  if (action && typeof action === 'function') {
                    action();
                    addDebug(`Button clicked on ${panel.name}`);
                  }
                } catch (err: any) {
                  console.error('[XRLessonPlayerV3] Button action error:', err);
                  addDebug(`Button action error: ${err?.message || err}`);
                }
                return;
              }
            }
          }
        }
        
        // Check 3D objects for grabbing
        const interactables: THREE.Object3D[] = [];
        if (sceneRef.current) {
          sceneRef.current.traverse((obj) => {
            if (obj.userData.isInteractable && obj.visible && !obj.userData.hasButtons) {
              interactables.push(obj);
            }
          });
        }
        
        const objectIntersects = raycaster.intersectObjects(interactables, false);
        if (objectIntersects.length > 0) {
          const obj = objectIntersects[0].object;
          const objId = obj.uuid || obj.name || 'unknown';
          const now = Date.now();
          
          // Debounce grabs
          const lastGrab = lastGrabTimeRef.current.get(objId) || 0;
          if (now - lastGrab < 200) {
            return;
          }
          lastGrabTimeRef.current.set(objId, now);
          
          // Start grab (store in userData for animation loop)
          obj.userData.isGrabbed = true;
          obj.userData.grabController = controller;
          const worldPos = new THREE.Vector3();
          controller.getWorldPosition(worldPos);
          obj.getWorldPosition(obj.userData.grabOffset = new THREE.Vector3());
          obj.userData.grabOffset.sub(worldPos);
          
          addDebug(`Grabbed: ${obj.name || 'object'}`);
        }
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] Error in handleControllerSelect:', err);
      }
    };
    
    // Handle controller release
    const handleControllerRelease = (controller: THREE.Group) => {
      try {
        // Find grabbed object
        if (sceneRef.current) {
          sceneRef.current.traverse((obj) => {
            if (obj.userData.isGrabbed && obj.userData.grabController === controller) {
              obj.userData.isGrabbed = false;
              obj.userData.grabController = null;
              addDebug(`Released: ${obj.name || 'object'}`);
            }
          });
        }
      } catch (err: any) {
        console.error('[XRLessonPlayerV3] Error in handleControllerRelease:', err);
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
              
              // Check panels and 3D objects for hover
              const panels = [scriptPanelRef.current, mcqPanelRef.current].filter(Boolean) as THREE.Mesh[];
              const interactables: THREE.Object3D[] = [];
              sceneRef.current.traverse((obj) => {
                if (obj.userData.isInteractable && obj.visible) {
                  interactables.push(obj);
                }
              });
              
              const allObjects = [...panels, ...interactables];
              const intersects = raycaster.intersectObjects(allObjects, false);
              
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
          
          // Update grabbed objects position
          if (sceneRef.current) {
            sceneRef.current.traverse((obj) => {
              if (obj.userData.isGrabbed && obj.userData.grabController) {
                const controller = obj.userData.grabController;
                const worldPos = new THREE.Vector3();
                controller.getWorldPosition(worldPos);
                worldPos.add(obj.userData.grabOffset);
                
                // Smooth interpolation for stable movement
                obj.position.lerp(worldPos, 0.15);
              }
            });
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
        try {
          window.removeEventListener('resize', handleResize);
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
      if (!sceneRef.current) {
        console.warn('[XRLessonPlayerV3] Asset loading skipped: scene ref is null');
        addDebug(`❌ Asset loading skipped: scene ref is null`);
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
        }
      }
      
      // Remove existing group if it exists but is incomplete
      if (existingGroup && existingGroup.children.length !== meshyAssets.length) {
        console.log('[XRLessonPlayerV3] Removing incomplete assets group');
        scene.remove(existingGroup);
        assetsGroupRef.current = null;
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
      
      // Prevent duplicate loading
      if (assetsGroupRef.current && sceneRef.current) {
        const existing = sceneRef.current.getObjectByName('assetsGroup');
        if (existing && existing.children.length > 0) {
          console.warn(`[XRLessonPlayerV3] Assets already loading/loaded, skipping duplicate load`);
          addDebug(`⚠️ Assets already exist (${existing.children.length} children), skipping duplicate load`);
          return;
        }
      }
      
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
          
          // Calculate bounding box BEFORE scaling
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          
          addDebug(`Asset ${i + 1} original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} (max: ${maxDim.toFixed(2)})`);
          addDebug(`Asset ${i + 1} center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
          
          // Scale to reasonable size (target: larger for better visibility)
          // For very large models, use a larger target size to ensure visibility
          // Increased base target size to ensure assets are visible
          const targetSize = maxDim > 10 ? 2.5 : maxDim > 5 ? 2.0 : 1.5;
          let scale = maxDim > 0 ? targetSize / maxDim : 1;
          
          // Ensure minimum scale for very small models (prevent invisible assets)
          const minScale = 0.1; // Minimum scale factor
          const maxScale = 10.0; // Maximum scale factor to prevent huge assets
          scale = Math.max(minScale, Math.min(maxScale, scale));
          
          console.log(`[XRLessonPlayerV3] Asset ${i + 1} scaling:`, {
            originalMaxDim: maxDim.toFixed(2),
            targetSize,
            scale: scale.toFixed(3),
            fileSizeMB: fileSizeMB.toFixed(2)
          });
          addDebug(`Asset ${i + 1} scale factor: ${scale.toFixed(3)} (target: ${targetSize}m, original: ${maxDim.toFixed(2)}m)`);
          
          // Center the model at origin first, then scale
          gltf.scene.position.set(-center.x, -center.y, -center.z);
          gltf.scene.scale.setScalar(scale);
          gltf.scene.name = `asset_${asset.id}`;
          
          // Ensure the scene is visible and not culled
          gltf.scene.visible = true;
          gltf.scene.frustumCulled = false; // Disable frustum culling for large/complex models
          
          // Calculate position: Directly in front of camera (relative to camera position)
          // Get camera's current world position (important for VR where camera might move)
          const cameraPos = new THREE.Vector3();
          let useCameraPosition = false;
          
          if (cameraRef.current) {
            cameraRef.current.getWorldPosition(cameraPos);
            // Only use camera position if it's valid (not NaN and reasonable)
            if (!isNaN(cameraPos.x) && !isNaN(cameraPos.y) && !isNaN(cameraPos.z) &&
                Math.abs(cameraPos.x) < 100 && Math.abs(cameraPos.y) < 100 && Math.abs(cameraPos.z) < 100) {
              useCameraPosition = true;
            }
          }
          
          let x: number, y: number, z: number;
          
          if (useCameraPosition && cameraRef.current) {
            // Calculate forward direction from camera
            const forward = new THREE.Vector3(0, 0, -1); // Default forward in Three.js
            forward.applyQuaternion(cameraRef.current.quaternion);
            
            // Position asset 2 meters in front of camera, at eye level
            const assetDistance = 2.0; // 2 meters in front
            const newPos = new THREE.Vector3().copy(cameraPos);
            newPos.add(forward.multiplyScalar(assetDistance));
            // Keep Y at eye level relative to camera
            newPos.y = cameraPos.y; // Same height as camera
            
            x = newPos.x;
            y = newPos.y;
            z = newPos.z;
            
            addDebug(`Asset ${i + 1} positioned relative to camera`);
          } else {
            // Fallback: Fixed position directly in front (2m forward, eye level)
            x = 0; // Centered horizontally
            z = -2.0; // 2 meters in front (negative Z is forward in Three.js)
            y = 1.6; // Eye level
            addDebug(`Asset ${i + 1} positioned at fixed location (camera position unavailable)`);
          }
          
          addDebug(`Asset ${i + 1} will be positioned at: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
          if (useCameraPosition) {
            addDebug(`Camera position: (${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)})`);
          }
          
          // Make materials work with scene lighting (preserve original materials)
          gltf.scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.userData.isInteractable = true;
              child.userData.originalMaterial = child.material; // Store original
              child.userData.originalScale = new THREE.Vector3().copy(child.scale);
              
              if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat: any) => {
                  // Ensure material is visible
                  mat.visible = true;
                  mat.transparent = false; // Ensure not transparent unless explicitly set
                  if (mat.opacity !== undefined) {
                    mat.opacity = 1.0; // Ensure fully opaque
                  }
                  
                  // Preserve texture settings
                  if (mat.map) {
                    mat.map.colorSpace = THREE.SRGBColorSpace;
                    // Preserve flipY and other texture properties
                    const originalFlipY = mat.map.flipY;
                    mat.map.flipY = originalFlipY; // Don't change
                  }
                  if (!mat.colorSpace) {
                    mat.colorSpace = THREE.SRGBColorSpace;
                  }
                  // Mark as updated once, then don't touch
                  mat.needsUpdate = true;
                });
              }
            }
          });
          
          // Wrap in a group for interaction
          const assetGroup = new THREE.Group();
          assetGroup.name = `assetGroup_${asset.id}`;
          assetGroup.add(gltf.scene);
          assetGroup.position.set(x, y, z);
          assetGroup.userData.isInteractable = true;
          assetGroup.userData.originalPosition = new THREE.Vector3().copy(assetGroup.position);
          assetGroup.userData.originalRotation = new THREE.Euler().copy(assetGroup.rotation);
          assetGroup.userData.originalScale = new THREE.Vector3().setScalar(1.0);
          
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
        if (assetsGroupRef.current && sceneRef.current) {
          sceneRef.current.remove(assetsGroupRef.current);
        }
      } catch (cleanupErr: any) {
        console.error('[XRLessonPlayerV3] Asset cleanup error:', cleanupErr);
      }
    };
    } catch (assetErr: any) {
      console.error('[XRLessonPlayerV3] Asset loading error:', assetErr);
      addDebug(`❌ Asset loading error: ${assetErr?.message || assetErr}`);
    }
  }, [meshyAssets, loadingState, addDebug]);
  
  // Force asset loading when meshyAssets becomes available (separate trigger)
  useEffect(() => {
    if (meshyAssets.length > 0) {
      console.log('[XRLessonPlayerV3] MeshyAssets available:', meshyAssets.length, 'assets');
      addDebug(`🔄 MeshyAssets available: ${meshyAssets.length} asset(s)`);
      
      // If scene is ready, try loading immediately
      if (sceneRef.current && (loadingState === 'ready' || loadingState === 'in-vr')) {
        console.log('[XRLessonPlayerV3] Scene ready, assets should load now');
        addDebug(`✅ Scene ready with ${meshyAssets.length} assets - loading should trigger`);
      }
    }
  }, [meshyAssets.length, loadingState]);
  
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
    if (ttsData.length === 0) return null;
    
    // Map phase to script_type (handle both 'content' and 'explanation' phases)
    let scriptType: string = 'full';
    if (phase === 'intro') scriptType = 'intro';
    else if (phase === 'content' || phase === 'explanation') scriptType = 'explanation';
    else if (phase === 'outro') scriptType = 'outro';
    
    // Find matching TTS entry (check both script_type and section fields)
    const match = ttsData.find(tts => {
      const ttsSection = (tts as any).script_type || (tts as any).section || tts.section;
      return ttsSection === scriptType || ttsSection === 'full';
    });
    
    if (match) {
      addDebug(`Found TTS for ${phase}: ${(match as any).script_type || match.section}`);
      return match;
    }
    
    // Fallback to first available
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
    
    addDebug(`Playing TTS for ${phase}: ${(tts as any).script_type || tts.section}`);
    
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
      addDebug('⏭️ Skipped to Quiz');
    } else {
      setLessonPhase('complete');
      addDebug('⏭️ No quiz available - completing lesson');
    }
  }, [mcqData.length, stopAudio, addDebug]);
  
  // Auto-play TTS when phase changes (intro/content/outro)
  useEffect(() => {
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
    }
  }, [lessonPhase, ttsData, playTTSForPhase]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Auto-start intro when entering VR
  useEffect(() => {
    if (loadingState === 'in-vr' && lessonPhase === 'intro' && ttsData.length > 0) {
      // Wait a moment for user to orient themselves
      const timer = setTimeout(() => {
        playTTSForPhase('intro');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loadingState, lessonPhase, ttsData, playTTSForPhase]);
  
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
      
      // Position at 30° to the right
      const angle = Math.PI / 6; // +30 degrees
      const distance = 2.0;
      const panelX = Math.sin(angle) * distance;
      const panelZ = -Math.cos(angle) * distance;
      const panelY = 1.6; // Eye level
      
      panel.position.set(panelX, panelY, panelZ);
      panel.userData.isInteractable = true;
      panel.userData.panelType = 'script';
      panel.userData.hasButtons = true;
      panel.userData.buttons = buttons.map(btn => ({
        bounds: { x: btn.x - buttonSize/2, y: controlsY, width: buttonSize, height: buttonSize },
        action: btn.action,
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
    if (mcqAnswered || lessonPhase !== 'mcq' || currentMcqIndex >= mcqData.length) return;
    
    setSelectedMcqOption(optionIndex);
    setMcqAnswered(true);
    
    const currentMcq = mcqData[currentMcqIndex];
    // correctAnswer is now already 0-based (converted in fetchMCQData)
    const correctIndex = currentMcq.correctAnswer;
    
    if (optionIndex === correctIndex) {
      setMcqScore(prev => prev + 1);
      addDebug(`✅ Correct answer selected`);
    } else {
      addDebug(`❌ Incorrect answer selected`);
    }
  }, [mcqAnswered, lessonPhase, mcqData, currentMcqIndex, addDebug]);
  
  const handleMCQNext = useCallback(() => {
    if (!mcqAnswered) return;
    
    if (currentMcqIndex < mcqData.length - 1) {
      setCurrentMcqIndex(prev => prev + 1);
      setSelectedMcqOption(null);
      setMcqAnswered(false);
      addDebug(`Moving to question ${currentMcqIndex + 2}`);
    } else {
      // Quiz complete
      setLessonPhase('complete');
      addDebug(`Quiz complete! Score: ${mcqScore}/${mcqData.length}`);
    }
  }, [mcqAnswered, currentMcqIndex, mcqData.length, mcqScore, addDebug]);
  
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
            action: () => handleMCQOptionSelect(index),
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
          action: handleMCQNext,
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
      
      // Position at 30° to the right
      const angle = Math.PI / 6;
      const distance = 2.0;
      const panelX = Math.sin(angle) * distance;
      const panelZ = -Math.cos(angle) * distance;
      const panelY = 1.6;
      
      panel.position.set(panelX, panelY, panelZ);
      panel.lookAt(camera.position);
      panel.userData.isInteractable = true;
      panel.userData.panelType = 'mcq';
      panel.userData.hasButtons = true;
      panel.userData.buttons = buttonBounds;
      
      scene.add(panel);
      mcqPanelRef.current = panel;
      
      addDebug(`MCQ panel created: Question ${questionIndex + 1} (${buttonBounds.length} clickable buttons)`);
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
      }
      return;
    }
    
    if (currentMcqIndex < mcqData.length && sceneRef.current && cameraRef.current && mcqData[currentMcqIndex]) {
      try {
        createMCQPanel(mcqData[currentMcqIndex], currentMcqIndex, mcqData.length);
      } catch (error: any) {
        console.error('[XRLessonPlayerV3] Error updating MCQ panel:', error);
        addDebug(`ERROR updating MCQ panel: ${error?.message || error}`);
      }
    }
  }, [lessonPhase, currentMcqIndex, mcqData, selectedMcqOption, mcqAnswered, createMCQPanel, sceneRef, cameraRef, addDebug]);
  
  // ============================================================================
  // 3D Model Reset & Focus Functions
  // ============================================================================
  
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
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-red-500/30 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load VR Lesson</h2>
          <p className="text-slate-400 text-sm mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate('/lessons')}
            className="flex items-center justify-center gap-2 px-6 py-3 mx-auto
                     text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium"
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
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl border border-purple-500/30 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Glasses className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">VR Device Required</h2>
          <p className="text-slate-400 text-sm mb-2">
            This immersive lesson requires a VR headset.
          </p>
          <p className="text-slate-500 text-xs mb-4">
            Please open this page on Meta Quest Browser for the full VR experience.
          </p>
          <button
            onClick={() => navigate('/lessons')}
            className="flex items-center justify-center gap-2 px-6 py-3 mx-auto
                     text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium"
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
        <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">{loadingMessage}</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 
                     text-white rounded-lg backdrop-blur-sm border border-slate-700/50"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit
          </button>
        </div>
      )}
      
      {/* In VR Indicator (shown on 2D screen while in VR) */}
      {loadingState === 'in-vr' && (
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center z-50">
          <div className="text-center">
            <Glasses className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">In VR Mode</h2>
            <p className="text-slate-400">
              Look around in your headset to explore the lesson
            </p>
          </div>
        </div>
      )}
      
      {/* Lesson Info (top right) */}
      {loadingState === 'ready' && lessonData && (
        <div className="absolute top-4 right-4 z-40 max-w-xs">
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50">
            <p className="text-cyan-400 text-xs font-medium mb-1">
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
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg px-6 py-3 border border-cyan-500/30">
            <p className="text-cyan-300 text-sm text-center">
              Click "Enter VR" below to start the immersive experience
            </p>
          </div>
        </div>
      )}
      
      {/* Skip to Quiz Button - Show during TTS phases */}
      {(loadingState === 'ready' || loadingState === 'in-vr') && 
       ['intro', 'content', 'outro'].includes(lessonPhase) && mcqData.length > 0 && (
        <div className="absolute top-20 right-4 z-40">
          <button
            onClick={skipToQuiz}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 
                     hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-medium 
                     shadow-lg shadow-amber-500/20 border border-amber-500/50 transition-all"
          >
            <SkipForward className="w-4 h-4" />
            Skip to Quiz
          </button>
        </div>
      )}
      
      {/* Lesson Completion Screen */}
      {lessonPhase === 'complete' && (
        <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl 
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
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl inline-block">
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
                       text-white bg-gradient-to-r from-cyan-600 to-blue-600 
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
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50">
            <p className="text-slate-400 text-xs mb-2 font-medium">3D Model:</p>
            <div className="flex gap-2">
              <button
                onClick={resetModel}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
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
      
      {/* DEBUG PANEL - Shows loading progress */}
      <div className="absolute bottom-4 left-4 z-50 max-w-lg">
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-3 border border-yellow-500/50 text-xs font-mono">
          <div className="flex items-center justify-between mb-2">
            <span className="text-yellow-400 font-bold">🐛 Debug Log</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">State: {loadingState}</span>
              <button
                onClick={() => {
                  const fullLog = [
                    `=== XRLessonPlayerV3 Debug Log ===`,
                    `Time: ${new Date().toISOString()}`,
                    `State: ${loadingState}`,
                    `Phase: ${lessonPhase}`,
                    `VR Support: ${isVRSupported}`,
                    `Skybox URL: ${skyboxUrl || 'null'}`,
                    `TTS: ${ttsData.length} entries (playing: ${currentTtsIndex + 1})`,
                    `MCQ: ${mcqData.length} questions`,
                    `3D Assets: ${meshyAssets.length} (loaded: ${assetsLoaded})`,
                    ``,
                    `=== Log Messages ===`,
                    ...debugInfo,
                    ``,
                    `=== Lesson Data ===`,
                    JSON.stringify(lessonData, null, 2)
                  ].join('\n');
                  navigator.clipboard.writeText(fullLog);
                  alert('Debug log copied to clipboard!');
                }}
                className="px-2 py-0.5 bg-yellow-600 hover:bg-yellow-500 text-black rounded text-xs"
              >
                📋 Copy
              </button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {debugInfo.map((msg, i) => (
              <div key={i} className={`text-xs ${
                msg.includes('ERROR') ? 'text-red-400' : 
                msg.includes('✅') ? 'text-green-400' : 
                msg.includes('⚠') ? 'text-yellow-400' :
                'text-slate-300'
              }`}>
                {msg}
              </div>
            ))}
            {debugInfo.length === 0 && (
              <div className="text-slate-500">Waiting for logs...</div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700 grid grid-cols-2 gap-x-4 text-slate-400">
            <div>🌐 Skybox: {skyboxUrl ? '✓' : '...'}</div>
            <div>🥽 VR: {isVRSupported === null ? '...' : isVRSupported ? '✓' : '✗'}</div>
            <div>🔊 TTS: {ttsData.length} {isAudioPlaying ? '▶' : ''}</div>
            <div>❓ MCQ: {mcqData.length}</div>
            <div>📦 3D: {assetsLoaded}/{meshyAssets.length}</div>
            <div>📍 Phase: {lessonPhase}</div>
          </div>
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
