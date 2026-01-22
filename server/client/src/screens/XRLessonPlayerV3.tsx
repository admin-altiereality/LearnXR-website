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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Loader2, AlertTriangle, Glasses } from 'lucide-react';

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
type LessonPhase = 'intro' | 'content' | 'mcq' | 'complete';

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
          // Convert to MCQData format
          const convertedMCQs: MCQData[] = mcqs.map((mcq: any) => ({
            id: mcq.id || '',
            question: mcq.question || '',
            options: Array.isArray(mcq.options) ? mcq.options : [],
            correctAnswer: mcq.correct_option_index ?? 0,
            explanation: mcq.explanation || '',
          }));
          
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
              mcqResults.push({
                id: mcqId,
                question: data.question || data.question_text || '',
                options: data.options || [],
                correctAnswer: data.correct_answer ?? data.correctAnswer ?? 0,
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
      if (!navigator.xr) {
        console.log('[XRLessonPlayerV3] WebXR not available');
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
    };
    
    checkVRSupport();
  }, []);
  
  // ============================================================================
  // Initialize Three.js Scene with WebXR
  // ============================================================================
  
  useEffect(() => {
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
    
    // Create WebGL renderer with XR enabled
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // CRITICAL: Enable XR
    renderer.xr.enabled = true;
    
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);
    
    // Add VR Button if supported
    if (isVRSupported) {
      const vrButton = VRButton.createButton(renderer);
      vrButton.style.position = 'absolute';
      vrButton.style.bottom = '20px';
      vrButton.style.left = '50%';
      vrButton.style.transform = 'translateX(-50%)';
      vrButton.style.zIndex = '100';
      containerRef.current.appendChild(vrButton);
      vrButtonRef.current = vrButton;
      
      // Listen for session start/end
      renderer.xr.addEventListener('sessionstart', () => {
        console.log('[XRLessonPlayerV3] VR session started');
        setLoadingState('in-vr');
      });
      
      renderer.xr.addEventListener('sessionend', () => {
        console.log('[XRLessonPlayerV3] VR session ended');
        setLoadingState('ready');
      });
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
    
    // Add a debug reference cube in front of user (to verify scene is rendering)
    const debugGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const debugMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const debugCube = new THREE.Mesh(debugGeometry, debugMaterial);
    debugCube.position.set(0, 1.2, -2); // In front of user at eye level
    debugCube.name = 'debugCube';
    scene.add(debugCube);
    console.log('[XRLessonPlayerV3] Debug cube added at (0, 1.2, -2)');
    
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
          scene.add(skyboxMesh);
          
          console.log('[XRLessonPlayerV3] ✅ Image skybox added, children:', scene.children.length);
          setLoadingState('ready');
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
            scene.add(gltf.scene);
            
            console.log('[XRLessonPlayerV3] ✅ GLB skybox added');
            setLoadingState('ready');
            
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
    
    // Animation loop (XR-compatible)
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
    
    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      
      if (vrButtonRef.current && containerRef.current) {
        containerRef.current.removeChild(vrButtonRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skyboxUrl, isVRSupported, fallbackImageUrl]);
  
  // ============================================================================
  // Load 3D Assets into Scene
  // ============================================================================
  
  useEffect(() => {
    if (!sceneRef.current || meshyAssets.length === 0 || loadingState !== 'ready') return;
    
    const scene = sceneRef.current;
    console.log('[XRLessonPlayerV3] Loading 3D assets into scene...');
    
    // Create a group to hold all assets
    const assetsGroup = new THREE.Group();
    assetsGroup.name = 'assetsGroup';
    assetsGroupRef.current = assetsGroup;
    
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Position assets in a semi-circle in front of the user
    const loadAssets = async () => {
      const angleSpread = Math.PI * 0.6; // 108 degrees arc
      const startAngle = -angleSpread / 2;
      const assetDistance = 2.5; // meters from user
      
      for (let i = 0; i < meshyAssets.length; i++) {
        const asset = meshyAssets[i];
        const angle = startAngle + (i / Math.max(meshyAssets.length - 1, 1)) * angleSpread;
        
        try {
          console.log(`[XRLessonPlayerV3] Loading asset ${i + 1}/${meshyAssets.length}: ${asset.name}`);
          
          const gltf = await new Promise<any>((resolve, reject) => {
            gltfLoader.load(asset.glbUrl, resolve, undefined, reject);
          });
          
          // Calculate position
          const x = Math.sin(angle) * assetDistance;
          const z = -Math.cos(angle) * assetDistance;
          const y = 1.2; // Eye level
          
          // Scale to reasonable size (max 0.8m)
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 0.6;
          const scale = maxDim > 0 ? targetSize / maxDim : 1;
          
          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.set(x, y, z);
          gltf.scene.lookAt(0, y, 0); // Face the user
          gltf.scene.name = `asset_${asset.id}`;
          
          // Make materials work with scene lighting
          gltf.scene.traverse((child: any) => {
            if (child instanceof THREE.Mesh && child.material) {
              if (child.material.map) {
                child.material.map.colorSpace = THREE.SRGBColorSpace;
              }
              child.material.needsUpdate = true;
            }
          });
          
          assetsGroup.add(gltf.scene);
          setAssetsLoaded(prev => prev + 1);
          console.log(`[XRLessonPlayerV3] ✅ Asset loaded: ${asset.name} at (${x.toFixed(1)}, ${y}, ${z.toFixed(1)})`);
          
        } catch (err: any) {
          console.warn(`[XRLessonPlayerV3] Failed to load asset ${asset.id}:`, err?.message);
        }
      }
      
      scene.add(assetsGroup);
      console.log(`[XRLessonPlayerV3] ✅ All assets loaded. Scene children: ${scene.children.length}`);
    };
    
    loadAssets();
    
    return () => {
      if (assetsGroupRef.current && scene) {
        scene.remove(assetsGroupRef.current);
      }
    };
  }, [meshyAssets, loadingState]);
  
  // ============================================================================
  // Audio Playback Controls
  // ============================================================================
  
  const playTTS = useCallback((index: number) => {
    if (index >= ttsData.length) {
      console.log('[XRLessonPlayerV3] No more TTS to play');
      setLessonPhase('mcq');
      return;
    }
    
    const tts = ttsData[index];
    console.log(`[XRLessonPlayerV3] Playing TTS ${index + 1}/${ttsData.length}: ${tts.section}`);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(tts.audioUrl);
    audioRef.current = audio;
    
    audio.onplay = () => setIsAudioPlaying(true);
    audio.onpause = () => setIsAudioPlaying(false);
    audio.onended = () => {
      setIsAudioPlaying(false);
      setCurrentTtsIndex(index + 1);
      // Auto-play next TTS after a short delay
      setTimeout(() => playTTS(index + 1), 1500);
    };
    audio.onerror = (e) => {
      console.error('[XRLessonPlayerV3] Audio error:', e);
      setCurrentTtsIndex(index + 1);
    };
    
    audio.play().catch(err => {
      console.warn('[XRLessonPlayerV3] Audio autoplay blocked:', err);
    });
  }, [ttsData]);
  
  const toggleAudio = useCallback(() => {
    if (!audioRef.current) {
      playTTS(currentTtsIndex);
      return;
    }
    
    if (audioRef.current.paused) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [currentTtsIndex, playTTS]);
  
  // Auto-start TTS when entering VR
  useEffect(() => {
    if (loadingState === 'in-vr' && ttsData.length > 0 && currentTtsIndex === 0) {
      // Wait a moment for user to orient themselves
      const timer = setTimeout(() => {
        playTTS(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loadingState, ttsData, currentTtsIndex, playTTS]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
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
      
      {/* Audio Controls (shown when ready or in VR) */}
      {(loadingState === 'ready' || loadingState === 'in-vr') && ttsData.length > 0 && (
        <div className="absolute top-20 left-4 z-40">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAudio}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isAudioPlaying ? 'bg-orange-500 hover:bg-orange-400' : 'bg-cyan-500 hover:bg-cyan-400'
                } text-white`}
              >
                {isAudioPlaying ? '⏸' : '▶️'}
              </button>
              <div>
                <p className="text-white text-sm font-medium">
                  {isAudioPlaying ? 'Playing...' : 'Narration'}
                </p>
                <p className="text-slate-400 text-xs">
                  {currentTtsIndex + 1} / {ttsData.length}
                </p>
              </div>
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

export default XRLessonPlayerV3;
