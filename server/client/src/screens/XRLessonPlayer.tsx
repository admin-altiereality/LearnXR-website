/**
 * XRLessonPlayer - WebXR-enabled VR Lesson Player
 * 
 * Features:
 * - Full WebXR immersive-vr support for Meta Quest
 * - Staged loading pipeline (Skybox → TTS → Assets)
 * - 2D fallback rendering for non-VR devices
 * - Progress tracking and error handling
 * 
 * Test Checklist:
 * - [ ] Meta Quest Browser: Enter VR works, skybox loads, TTS plays, assets load
 * - [ ] Desktop Chrome: Shows VR not supported message, 2D preview option works
 * - [ ] Mobile Safari: Shows appropriate fallback message
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesson } from '../contexts/LessonContext';
import {
  getVRCapabilities,
  requestVRSession,
  endVRSession,
  getVRSupportMessage,
  getVRRecommendation,
  VRCapabilities,
} from '../utils/vrDetection';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Glasses,
  Monitor,
  ArrowLeft,
  RefreshCw,
  Maximize2,
  SkipForward,
} from 'lucide-react';

// Loading stage definitions
type LoadingStage = 'initializing' | 'skybox' | 'tts' | 'assets' | 'complete' | 'error';

interface StageStatus {
  stage: LoadingStage;
  message: string;
  progress: number; // 0-100
  error?: string;
}

interface LessonAsset {
  id: string;
  url: string;
  type: 'glb' | 'gltf' | 'image' | 'audio';
  name: string;
  loaded: boolean;
  error?: string;
}

interface TTSAudio {
  section: 'intro' | 'explanation' | 'outro';
  url: string;
  text: string;
  loaded: boolean;
}

// Stage component for progress display
const StageIndicator = ({ 
  stage, 
  label, 
  status 
}: { 
  stage: LoadingStage; 
  label: string; 
  status: 'pending' | 'loading' | 'complete' | 'error';
}) => {
  const getIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'loading':
        return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-slate-500" />;
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${
      status === 'loading' ? 'text-cyan-300' :
      status === 'complete' ? 'text-emerald-300' :
      status === 'error' ? 'text-red-300' : 'text-slate-500'
    }`}>
      {getIcon()}
      <span>{label}</span>
    </div>
  );
};

// TTS Controller component
const TTSController = ({
  audioRef,
  isPlaying,
  currentSection,
  duration,
  currentTime,
  onPlay,
  onPause,
  onStop,
  onSkip,
  sections,
}: {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentSection: string;
  duration: number;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkip: () => void;
  sections: string[];
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Volume2 className="w-5 h-5 text-emerald-400" />
        <span className="text-sm font-medium text-white">Voice Narration</span>
        <span className="ml-auto text-xs text-slate-400 capitalize">{currentSection || 'Ready'}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onStop}
          className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
        >
          <Square className="w-4 h-4" />
        </button>
        
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg transition-all"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        
        <button
          onClick={onSkip}
          className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
          disabled={sections.length <= 1}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Format time helper
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Main component
const XRLessonPlayer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { activeLesson } = useLesson();

  // Core state
  const [vrCapabilities, setVRCapabilities] = useState<VRCapabilities | null>(null);
  const [isInVR, setIsInVR] = useState(false);
  const [xrSession, setXRSession] = useState<XRSession | null>(null);
  
  // Loading state
  const [stageStatus, setStageStatus] = useState<StageStatus>({
    stage: 'initializing',
    message: 'Preparing lesson...',
    progress: 0,
  });
  const [stages, setStages] = useState<Record<LoadingStage, 'pending' | 'loading' | 'complete' | 'error'>>({
    initializing: 'loading',
    skybox: 'pending',
    tts: 'pending',
    assets: 'pending',
    complete: 'pending',
    error: 'pending',
  });

  // Lesson data
  const [lessonData, setLessonData] = useState<any>(null);
  const [ttsAudios, setTtsAudios] = useState<TTSAudio[]>([]);
  const [assets, setAssets] = useState<LessonAsset[]>([]);
  const [skyboxUrl, setSkyboxUrl] = useState<string>('');

  // TTS state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Three.js refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Get lesson identifiers from URL or context
  const lessonId = searchParams.get('lessonId') || activeLesson?.chapter?.chapter_id;
  const chapterId = searchParams.get('chapterId') || lessonId;
  const topicId = searchParams.get('topicId') || activeLesson?.topic?.topic_id;

  // Check VR capabilities on mount
  useEffect(() => {
    const checkVR = async () => {
      const capabilities = await getVRCapabilities();
      setVRCapabilities(capabilities);
      console.log('[XRLessonPlayer] VR Capabilities:', capabilities);
    };
    checkVR();
  }, []);

  // Load lesson data
  useEffect(() => {
    const loadLessonData = async () => {
      if (!chapterId) {
        // Try to get from sessionStorage
        const stored = sessionStorage.getItem('activeLesson');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setLessonData(parsed);
            console.log('[XRLessonPlayer] Loaded from sessionStorage:', parsed);
            return;
          } catch (e) {
            console.error('[XRLessonPlayer] Failed to parse sessionStorage:', e);
          }
        }
        
        setStageStatus({
          stage: 'error',
          message: 'No lesson selected',
          progress: 0,
          error: 'Please select a lesson from the Lessons page.',
        });
        setStages(prev => ({ ...prev, initializing: 'error' }));
        return;
      }

      try {
        // If we have activeLesson from context, use it
        if (activeLesson?.chapter?.chapter_id === chapterId) {
          setLessonData(activeLesson);
          console.log('[XRLessonPlayer] Using lesson from context');
        } else {
          // Fetch from Firestore
          console.log('[XRLessonPlayer] Fetching lesson:', chapterId);
          const chapterRef = doc(db, 'curriculum_chapters', chapterId);
          const chapterSnap = await getDoc(chapterRef);
          
          if (!chapterSnap.exists()) {
            throw new Error('Lesson not found');
          }
          
          const data = chapterSnap.data();
          const topic = topicId 
            ? data.topics?.find((t: any) => t.topic_id === topicId) 
            : data.topics?.[0];
          
          setLessonData({
            chapter: {
              chapter_id: chapterId,
              chapter_name: data.chapter_name,
              ...data,
            },
            topic: topic || {},
            image3dasset: data.image3dasset,
          });
        }
        
        setStages(prev => ({ ...prev, initializing: 'complete' }));
        setStageStatus({
          stage: 'skybox',
          message: 'Loading 360° environment...',
          progress: 20,
        });
        
      } catch (error: any) {
        console.error('[XRLessonPlayer] Failed to load lesson:', error);
        setStageStatus({
          stage: 'error',
          message: 'Failed to load lesson',
          progress: 0,
          error: error.message,
        });
        setStages(prev => ({ ...prev, initializing: 'error' }));
      }
    };

    loadLessonData();
  }, [chapterId, topicId, activeLesson]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !lessonData) return;

    console.log('[XRLessonPlayer] Initializing Three.js scene');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 0); // Eye height
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls (for 2D mode)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.rotateSpeed = -0.5;
    controls.target.set(0, 1.6, -0.1);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (!isInVR) {
        controls.update();
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, [lessonData, isInVR]);

  // Stage A: Load Skybox
  useEffect(() => {
    if (!lessonData || stageStatus.stage !== 'skybox' || !sceneRef.current) return;

    const loadSkybox = async () => {
      setStages(prev => ({ ...prev, skybox: 'loading' }));
      
      const skyboxUrlFromData = lessonData.topic?.skybox_url || 
                                 lessonData.topic?.skybox_glb_url ||
                                 lessonData.chapter?.topics?.[0]?.skybox_url;
      
      if (!skyboxUrlFromData) {
        console.log('[XRLessonPlayer] No skybox URL, using fallback');
        // Create a fallback gradient sphere
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Invert for inside view
        
        const material = new THREE.MeshBasicMaterial({
          color: 0x1a1a2e,
          side: THREE.BackSide,
        });
        
        const skybox = new THREE.Mesh(geometry, material);
        sceneRef.current?.add(skybox);
        
        setStages(prev => ({ ...prev, skybox: 'complete' }));
        setStageStatus({
          stage: 'tts',
          message: 'Loading voice narration...',
          progress: 40,
        });
        return;
      }

      try {
        setSkyboxUrl(skyboxUrlFromData);
        
        // Check if it's a GLB or image
        const isGLB = skyboxUrlFromData.toLowerCase().includes('.glb') || 
                      skyboxUrlFromData.toLowerCase().includes('.gltf');
        
        if (isGLB) {
          // Load GLB skybox
          const loader = new GLTFLoader();
          loader.load(
            skyboxUrlFromData,
            (gltf) => {
              console.log('[XRLessonPlayer] Skybox GLB loaded');
              gltf.scene.scale.set(100, 100, 100);
              sceneRef.current?.add(gltf.scene);
              
              setStages(prev => ({ ...prev, skybox: 'complete' }));
              setStageStatus({
                stage: 'tts',
                message: 'Loading voice narration...',
                progress: 40,
              });
            },
            (progress) => {
              const percent = (progress.loaded / progress.total) * 100;
              setStageStatus(prev => ({
                ...prev,
                progress: 20 + (percent * 0.2),
              }));
            },
            (error) => {
              console.error('[XRLessonPlayer] Skybox GLB load error:', error);
              setStages(prev => ({ ...prev, skybox: 'error' }));
              // Continue anyway
              setStageStatus({
                stage: 'tts',
                message: 'Loading voice narration...',
                progress: 40,
              });
            }
          );
        } else {
          // Load equirectangular image as skybox
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            skyboxUrlFromData,
            (texture) => {
              console.log('[XRLessonPlayer] Skybox texture loaded');
              texture.mapping = THREE.EquirectangularReflectionMapping;
              
              const geometry = new THREE.SphereGeometry(500, 60, 40);
              geometry.scale(-1, 1, 1);
              
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
              });
              
              const skybox = new THREE.Mesh(geometry, material);
              sceneRef.current?.add(skybox);
              
              setStages(prev => ({ ...prev, skybox: 'complete' }));
              setStageStatus({
                stage: 'tts',
                message: 'Loading voice narration...',
                progress: 40,
              });
            },
            undefined,
            (error) => {
              console.error('[XRLessonPlayer] Skybox texture error:', error);
              setStages(prev => ({ ...prev, skybox: 'error' }));
              setStageStatus({
                stage: 'tts',
                message: 'Loading voice narration...',
                progress: 40,
              });
            }
          );
        }
      } catch (error: any) {
        console.error('[XRLessonPlayer] Skybox load error:', error);
        setStages(prev => ({ ...prev, skybox: 'error' }));
        setStageStatus({
          stage: 'tts',
          message: 'Loading voice narration...',
          progress: 40,
        });
      }
    };

    loadSkybox();
  }, [lessonData, stageStatus.stage]);

  // Stage B: Load TTS Audio
  useEffect(() => {
    if (!lessonData || stageStatus.stage !== 'tts') return;

    const loadTTSAudio = async () => {
      setStages(prev => ({ ...prev, tts: 'loading' }));
      
      const chapterId = lessonData.chapter?.chapter_id;
      if (!chapterId) {
        console.log('[XRLessonPlayer] No chapter ID for TTS');
        setStages(prev => ({ ...prev, tts: 'complete' }));
        setStageStatus({
          stage: 'assets',
          message: 'Loading 3D assets...',
          progress: 60,
        });
        return;
      }

      try {
        // Fetch TTS data from Firestore
        const ttsRef = collection(db, 'chapter_tts');
        const q = query(ttsRef, where('chapter_id', '==', chapterId));
        const snapshot = await getDocs(q);
        
        const audios: TTSAudio[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.audio_url) {
            audios.push({
              section: data.section || 'explanation',
              url: data.audio_url,
              text: data.text || '',
              loaded: false,
            });
          }
        });

        // Also check for TTS in topic data
        const topicTTS = lessonData.topic?.tts_audio_url;
        if (topicTTS && !audios.find(a => a.url === topicTTS)) {
          audios.push({
            section: 'explanation',
            url: topicTTS,
            text: lessonData.topic?.avatar_explanation || '',
            loaded: false,
          });
        }

        console.log('[XRLessonPlayer] Found TTS audios:', audios.length);
        setTtsAudios(audios);
        
        // Preload first audio
        if (audios.length > 0 && audioRef.current) {
          audioRef.current.src = audios[0].url;
          audioRef.current.load();
          setCurrentSection(audios[0].section);
        }
        
        setStages(prev => ({ ...prev, tts: audios.length > 0 ? 'complete' : 'complete' }));
        setStageStatus({
          stage: 'assets',
          message: 'Loading 3D assets...',
          progress: 60,
        });
        
      } catch (error: any) {
        console.error('[XRLessonPlayer] TTS load error:', error);
        setStages(prev => ({ ...prev, tts: 'error' }));
        setStageStatus({
          stage: 'assets',
          message: 'Loading 3D assets...',
          progress: 60,
        });
      }
    };

    loadTTSAudio();
  }, [lessonData, stageStatus.stage]);

  // Stage C: Load 3D Assets
  useEffect(() => {
    if (!lessonData || stageStatus.stage !== 'assets' || !sceneRef.current) return;

    const load3DAssets = async () => {
      setStages(prev => ({ ...prev, assets: 'loading' }));
      
      const assetUrls = lessonData.topic?.asset_urls || [];
      const image3d = lessonData.image3dasset;
      
      // Collect all asset URLs
      const allAssets: LessonAsset[] = [];
      
      assetUrls.forEach((url: string, index: number) => {
        allAssets.push({
          id: `asset_${index}`,
          url,
          type: url.toLowerCase().includes('.glb') ? 'glb' : 'gltf',
          name: `Asset ${index + 1}`,
          loaded: false,
        });
      });
      
      if (image3d?.imagemodel_glb || image3d?.imageasset_url) {
        allAssets.push({
          id: 'image3d',
          url: image3d.imagemodel_glb || image3d.imageasset_url,
          type: 'glb',
          name: 'Primary Asset',
          loaded: false,
        });
      }

      if (allAssets.length === 0) {
        console.log('[XRLessonPlayer] No 3D assets to load');
        setStages(prev => ({ ...prev, assets: 'complete', complete: 'complete' }));
        setStageStatus({
          stage: 'complete',
          message: 'Lesson ready!',
          progress: 100,
        });
        return;
      }

      console.log('[XRLessonPlayer] Loading assets:', allAssets.length);
      setAssets(allAssets);

      const loader = new GLTFLoader();
      let loadedCount = 0;

      for (const asset of allAssets) {
        try {
          await new Promise<void>((resolve, reject) => {
            loader.load(
              asset.url,
              (gltf) => {
                console.log(`[XRLessonPlayer] Asset loaded: ${asset.name}`);
                
                // Position the asset in front of user
                const positionOffset = loadedCount * 2 - (allAssets.length - 1);
                gltf.scene.position.set(positionOffset, 0, -3);
                
                // Scale to reasonable size
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 2) {
                  const scale = 2 / maxDim;
                  gltf.scene.scale.set(scale, scale, scale);
                }
                
                sceneRef.current?.add(gltf.scene);
                
                asset.loaded = true;
                loadedCount++;
                
                const progress = 60 + ((loadedCount / allAssets.length) * 40);
                setStageStatus(prev => ({
                  ...prev,
                  progress,
                  message: `Loading assets (${loadedCount}/${allAssets.length})...`,
                }));
                
                resolve();
              },
              undefined,
              (error) => {
                console.error(`[XRLessonPlayer] Asset error: ${asset.name}`, error);
                asset.error = 'Failed to load';
                loadedCount++;
                resolve(); // Continue despite error
              }
            );
          });
        } catch (e) {
          console.error('[XRLessonPlayer] Asset load exception:', e);
          asset.error = 'Exception';
          loadedCount++;
        }
      }

      setAssets([...allAssets]);
      setStages(prev => ({ ...prev, assets: 'complete', complete: 'complete' }));
      setStageStatus({
        stage: 'complete',
        message: 'Lesson ready!',
        progress: 100,
      });
    };

    load3DAssets();
  }, [lessonData, stageStatus.stage]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setAudioCurrentTime(audio.currentTime);
    const handleDurationChange = () => setAudioDuration(audio.duration);
    const handlePlay = () => setIsAudioPlaying(true);
    const handlePause = () => setIsAudioPlaying(false);
    const handleEnded = () => {
      setIsAudioPlaying(false);
      // Auto-play next section if available
      const currentIndex = ttsAudios.findIndex(a => a.section === currentSection);
      if (currentIndex < ttsAudios.length - 1) {
        const next = ttsAudios[currentIndex + 1];
        audio.src = next.url;
        setCurrentSection(next.section);
        audio.play();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [ttsAudios, currentSection]);

  // TTS controls
  const playAudio = useCallback(() => {
    audioRef.current?.play();
  }, []);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const skipToNextSection = useCallback(() => {
    const currentIndex = ttsAudios.findIndex(a => a.section === currentSection);
    if (currentIndex < ttsAudios.length - 1) {
      const next = ttsAudios[currentIndex + 1];
      if (audioRef.current) {
        audioRef.current.src = next.url;
        setCurrentSection(next.section);
        audioRef.current.play();
      }
    }
  }, [ttsAudios, currentSection]);

  // Enter VR
  const enterVR = useCallback(async () => {
    if (!vrCapabilities?.isVRSupported || !rendererRef.current) {
      console.warn('[XRLessonPlayer] VR not supported');
      return;
    }

    try {
      const session = await requestVRSession({
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor'],
      });
      
      if (session) {
        await rendererRef.current.xr.setSession(session);
        setXRSession(session);
        setIsInVR(true);
        
        // Disable orbit controls in VR
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }

        session.addEventListener('end', () => {
          setIsInVR(false);
          setXRSession(null);
          if (controlsRef.current) {
            controlsRef.current.enabled = true;
          }
        });

        console.log('[XRLessonPlayer] Entered VR');
      }
    } catch (error) {
      console.error('[XRLessonPlayer] Failed to enter VR:', error);
    }
  }, [vrCapabilities]);

  // Exit VR
  const exitVR = useCallback(async () => {
    if (xrSession) {
      await endVRSession(xrSession);
      setIsInVR(false);
      setXRSession(null);
    }
  }, [xrSession]);

  // Navigate back
  const goBack = useCallback(() => {
    if (isInVR) {
      exitVR();
    }
    navigate('/lessons');
  }, [navigate, isInVR, exitVR]);

  // Render loading UI
  const renderLoadingOverlay = () => {
    if (stageStatus.stage === 'complete') return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
      >
        <div className="max-w-md w-full mx-4 p-6 bg-slate-900/90 rounded-2xl border border-slate-700/50">
          <h2 className="text-xl font-bold text-white mb-4">
            {stageStatus.stage === 'error' ? 'Loading Error' : 'Preparing VR Lesson'}
          </h2>

          {/* Progress bar */}
          <div className="h-2 bg-slate-800 rounded-full mb-4 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                stageStatus.stage === 'error' 
                  ? 'bg-red-500' 
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${stageStatus.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Stage indicators */}
          <div className="space-y-2 mb-4">
            <StageIndicator stage="initializing" label="Initialize lesson data" status={stages.initializing} />
            <StageIndicator stage="skybox" label="Load 360° environment" status={stages.skybox} />
            <StageIndicator stage="tts" label="Load voice narration" status={stages.tts} />
            <StageIndicator stage="assets" label="Load 3D assets" status={stages.assets} />
          </div>

          {/* Current status */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {stageStatus.stage !== 'error' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>{stageStatus.message}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-300">{stageStatus.error}</span>
              </>
            )}
          </div>

          {/* Error actions */}
          {stageStatus.stage === 'error' && (
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

  // Render VR controls
  const renderVRControls = () => {
    if (!vrCapabilities) return null;

    const recommendation = getVRRecommendation(vrCapabilities);

    return (
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        {vrCapabilities.isVRSupported ? (
          <button
            onClick={isInVR ? exitVR : enterVR}
            disabled={stageStatus.stage !== 'complete'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all ${
              isInVR
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : stageStatus.stage === 'complete'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Glasses className="w-5 h-5" />
            {isInVR ? 'Exit VR' : 'Enter VR'}
          </button>
        ) : (
          <div className="px-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700/50 text-sm text-slate-300 max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-4 h-4 text-amber-400" />
              <span className="font-medium">2D Preview Mode</span>
            </div>
            <p className="text-xs text-slate-400">{recommendation.message}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" />

      {/* Three.js container */}
      <div ref={containerRef} className="absolute inset-0 z-10" />

      {/* Loading overlay */}
      <AnimatePresence>
        {renderLoadingOverlay()}
      </AnimatePresence>

      {/* VR/Exit controls */}
      {renderVRControls()}

      {/* Back button */}
      <button
        onClick={goBack}
        className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/90 text-white/80 hover:text-white hover:bg-slate-700 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Exit</span>
      </button>

      {/* Lesson info */}
      {lessonData && stageStatus.stage === 'complete' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-800/90 border border-slate-700/50 text-center">
          <p className="text-xs text-cyan-400 uppercase tracking-wide">
            {lessonData.chapter?.curriculum} • Class {lessonData.chapter?.class}
          </p>
          <h2 className="text-sm font-semibold text-white">
            {lessonData.topic?.topic_name || lessonData.chapter?.chapter_name}
          </h2>
        </div>
      )}

      {/* TTS Controller (bottom center) */}
      {stageStatus.stage === 'complete' && ttsAudios.length > 0 && !isInVR && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4">
          <TTSController
            audioRef={audioRef}
            isPlaying={isAudioPlaying}
            currentSection={currentSection}
            duration={audioDuration}
            currentTime={audioCurrentTime}
            onPlay={playAudio}
            onPause={pauseAudio}
            onStop={stopAudio}
            onSkip={skipToNextSection}
            sections={ttsAudios.map(a => a.section)}
          />
        </div>
      )}

      {/* VR TTS indicator */}
      {stageStatus.stage === 'complete' && ttsAudios.length > 0 && isInVR && (
        <div className="absolute bottom-4 right-4 z-30">
          <button
            onClick={isAudioPlaying ? pauseAudio : playAudio}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
          >
            {isAudioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            <span className="text-sm">Narration</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default XRLessonPlayer;
