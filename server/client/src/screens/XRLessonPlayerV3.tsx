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
import { doc, getDoc } from 'firebase/firestore';
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
  };
  topic: {
    topic_id: string;
    topic_name: string;
    skybox_id?: string;
    skybox_remix_id?: string;
    skybox_url?: string;
    skybox_glb_url?: string;
  };
}

type LoadingState = 'loading' | 'ready' | 'error' | 'no-vr' | 'in-vr';

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
  
  // State
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [skyboxUrl, setSkyboxUrl] = useState<string | null>(null);
  const [isVRSupported, setIsVRSupported] = useState<boolean | null>(null);
  
  // ============================================================================
  // Load Lesson Data from SessionStorage
  // ============================================================================
  
  useEffect(() => {
    const loadLessonData = () => {
      try {
        const stored = sessionStorage.getItem('activeLesson');
        if (stored) {
          const data = JSON.parse(stored);
          console.log('[XRLessonPlayerV3] Loaded lesson data:', data);
          setLessonData(data);
        } else {
          setErrorMessage('No lesson data found. Please select a lesson first.');
          setLoadingState('error');
        }
      } catch (err) {
        console.error('[XRLessonPlayerV3] Failed to parse lesson data:', err);
        setErrorMessage('Failed to load lesson data');
        setLoadingState('error');
      }
    };
    
    loadLessonData();
  }, []);
  
  // ============================================================================
  // Fetch Skybox GLB URL from Firestore
  // ============================================================================
  
  useEffect(() => {
    const fetchSkyboxUrl = async () => {
      if (!lessonData?.topic) return;
      
      setLoadingMessage('Fetching skybox...');
      const topic = lessonData.topic;
      
      // Priority 1: Direct skybox_glb_url on topic
      if (topic.skybox_glb_url) {
        console.log('[XRLessonPlayerV3] Using direct skybox_glb_url:', topic.skybox_glb_url);
        setSkyboxUrl(topic.skybox_glb_url);
        return;
      }
      
      // Priority 2: Fetch from skyboxes collection using skybox_id
      const skyboxId = topic.skybox_id || topic.skybox_remix_id;
      if (skyboxId) {
        try {
          console.log('[XRLessonPlayerV3] Fetching skybox from collection, id:', skyboxId);
          const skyboxDoc = await getDoc(doc(db, 'skyboxes', skyboxId));
          
          if (skyboxDoc.exists()) {
            const skyboxData = skyboxDoc.data();
            
            // Use stored_glb_url (Firebase Storage) - this is the GLB file
            if (skyboxData.stored_glb_url) {
              console.log('[XRLessonPlayerV3] Found stored_glb_url:', skyboxData.stored_glb_url);
              setSkyboxUrl(skyboxData.stored_glb_url);
              return;
            }
            
            // Fallback to other URLs
            const fallbackUrl = skyboxData.fileUrl || skyboxData.imageUrl || skyboxData.glb_url;
            if (fallbackUrl) {
              console.log('[XRLessonPlayerV3] Using fallback URL:', fallbackUrl);
              setSkyboxUrl(fallbackUrl);
              return;
            }
          }
        } catch (err) {
          console.error('[XRLessonPlayerV3] Failed to fetch skybox:', err);
        }
      }
      
      // Priority 3: Use skybox_url as final fallback
      if (topic.skybox_url) {
        console.log('[XRLessonPlayerV3] Using fallback skybox_url:', topic.skybox_url);
        setSkyboxUrl(topic.skybox_url);
        return;
      }
      
      setErrorMessage('No skybox found for this lesson');
      setLoadingState('error');
    };
    
    fetchSkyboxUrl();
  }, [lessonData]);
  
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
    if (!containerRef.current || !skyboxUrl || isVRSupported === null) return;
    
    console.log('[XRLessonPlayerV3] Initializing scene...');
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);
    
    // Load skybox
    loadSkybox(scene, skyboxUrl);
    
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
  }, [skyboxUrl, isVRSupported]);
  
  // ============================================================================
  // Load Skybox GLB
  // ============================================================================
  
  const loadSkybox = useCallback(async (scene: THREE.Scene, url: string) => {
    setLoadingMessage('Loading 360° environment...');
    
    // Setup loaders
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Detect if URL is a GLB file
    const isGLB = url.toLowerCase().includes('.glb') || 
                  url.toLowerCase().includes('.gltf') ||
                  url.includes('storage.googleapis.com');
    
    console.log('[XRLessonPlayerV3] Loading skybox:', { url: url.substring(0, 80), isGLB });
    
    try {
      if (isGLB) {
        // Load GLB skybox
        const gltf = await new Promise<any>((resolve, reject) => {
          gltfLoader.load(
            url,
            (gltf) => resolve(gltf),
            (progress) => {
              const percent = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
              setLoadingMessage(`Loading skybox: ${percent}%`);
            },
            (error) => reject(error)
          );
        });
        
        console.log('[XRLessonPlayerV3] GLB loaded successfully');
        
        // Get bounding box
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        console.log('[XRLessonPlayerV3] Skybox bounds:', {
          size: `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`,
          center: `${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`
        });
        
        // Scale to encompass user (target radius ~100m)
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 200; // Diameter
        const scale = maxDim > 0 ? targetSize / maxDim : 1;
        
        gltf.scene.scale.setScalar(scale);
        
        // Center at origin
        gltf.scene.position.set(
          -center.x * scale,
          -center.y * scale,
          -center.z * scale
        );
        
        // Configure materials for inside-out viewing
        gltf.scene.traverse((child: any) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              mat.side = THREE.BackSide; // View from inside
              mat.depthWrite = false;
              if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
              }
            });
          }
        });
        
        gltf.scene.name = 'skybox';
        gltf.scene.renderOrder = -1000;
        scene.add(gltf.scene);
        
        console.log('[XRLessonPlayerV3] ✅ Skybox added to scene');
        setLoadingState('ready');
        
      } else {
        // Load as equirectangular image
        const textureLoader = new THREE.TextureLoader();
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          textureLoader.load(url, resolve, undefined, reject);
        });
        
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Create sphere
        const geometry = new THREE.SphereGeometry(100, 60, 40);
        geometry.scale(-1, 1, 1); // Inside-out
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          depthWrite: false,
        });
        
        const skybox = new THREE.Mesh(geometry, material);
        skybox.name = 'skybox';
        skybox.renderOrder = -1000;
        scene.add(skybox);
        
        console.log('[XRLessonPlayerV3] ✅ Image skybox added to scene');
        setLoadingState('ready');
      }
      
    } catch (error) {
      console.error('[XRLessonPlayerV3] Failed to load skybox:', error);
      setErrorMessage('Failed to load 360° environment');
      setLoadingState('error');
    }
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
    </div>
  );
};

export default XRLessonPlayerV3;
