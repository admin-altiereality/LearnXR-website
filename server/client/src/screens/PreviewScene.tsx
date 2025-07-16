// PreviewScene - 3D Preview Route for Unified Generation Results
// Shows skybox as environment with floating mesh

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  Environment, 
  Float,
  Text,
  Html,
  PerspectiveCamera,
  ContactShadows
} from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, 
  FaDownload, 
  FaCog, 
  FaExpand,
  FaCompress,
  FaPlay,
  FaPause,
  FaRedo,
  FaInfoCircle,
  FaExclamationTriangle
} from 'react-icons/fa';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { useAuth } from '../contexts/AuthContext';
import { unifiedStorageService } from '../services/unifiedStorageService';
import { useGenerate } from '../hooks/useGenerate';
import type { Job, PreviewSceneConfig } from '../types/unifiedGeneration';

interface PreviewSceneProps {
  className?: string;
}

// Get the correct API base URL
const getApiBaseUrl = () => {
  const region = 'us-central1';
  const projectId = 'in3devoneuralai';
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
};

// Enhanced model loading with fallback strategies
class ModelLoader {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/draco/');
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  async loadModel(url: string): Promise<any> {
    const strategies = [
      // Strategy 1: Use proxy URL (primary method to avoid CORS)
      async () => {
        const proxyUrl = `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(url)}`;
        console.log('🔄 Loading via proxy:', proxyUrl);
        return this.loadGLTF(proxyUrl);
      },
      
      // Strategy 2: Direct URL (fallback if proxy fails)
      async () => {
        console.log('🔄 Loading direct URL:', url);
        return this.loadGLTF(url);
      },
      
      // Strategy 3: Local development server proxy
      async () => {
        const localProxy = `http://localhost:5002/proxy-asset?url=${encodeURIComponent(url)}`;
        console.log('🔄 Loading via local proxy:', localProxy);
        return this.loadGLTF(localProxy);
      }
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        console.log('✅ Model loaded successfully');
        return result;
      } catch (error) {
        console.warn('⚠️ Strategy failed:', error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw lastError || new Error('All loading strategies failed');
  }

  private loadGLTF(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        (progress) => {
          console.log('Loading progress:', progress);
        },
        (error) => {
          console.error('GLTF loading error:', error);
          reject(error);
        }
      );
    });
  }

  dispose() {
    this.dracoLoader.dispose();
  }
}

// 3D Model Component with enhanced loading
const FloatingMesh: React.FC<{ 
  meshUrl: string; 
  autoRotate: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}> = ({ meshUrl, autoRotate, onLoad, onError }) => {
  const meshRef = useRef<THREE.Group>(null);
  const [gltf, setGltf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<ModelLoader | null>(null);

  useEffect(() => {
    if (!meshUrl) return;

    const loadModel = async () => {
      setIsLoading(true);
      setError(null);
      setGltf(null);

      try {
        if (!loaderRef.current) {
          loaderRef.current = new ModelLoader();
        }

        const loadedGltf = await loaderRef.current.loadModel(meshUrl);
        setGltf(loadedGltf);
        setIsLoading(false);
        
        // Optimize the model
        loadedGltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
              child.material.needsUpdate = true;
            }
          }
        });

        onLoad?.();
      } catch (error) {
        console.error('Model loading failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        setIsLoading(false);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    };

    loadModel();
  }, [meshUrl, onLoad, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loaderRef.current) {
        loaderRef.current.dispose();
      }
    };
  }, []);

  // Auto-rotation animation
  useFrame((state) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  if (error) {
    return (
      <Html center>
        <div className="bg-red-900/90 text-red-100 p-3 rounded-lg backdrop-blur-sm">
          <FaExclamationTriangle className="w-4 h-4 mr-2 inline" />
          Failed to load 3D model
        </div>
      </Html>
    );
  }

  if (isLoading) {
    return (
      <Html center>
        <div className="bg-gray-900/90 text-gray-100 p-3 rounded-lg backdrop-blur-sm">
          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full inline-block mr-2" />
          Loading 3D model...
        </div>
      </Html>
    );
  }

  if (!gltf) {
    return (
      <Html center>
        <div className="bg-red-900/90 text-red-100 p-3 rounded-lg backdrop-blur-sm">
          <FaExclamationTriangle className="w-4 h-4 mr-2 inline" />
          No model data available
        </div>
      </Html>
    );
  }

  return (
    <Float
      speed={1}
      rotationIntensity={0.1}
      floatIntensity={0.2}
      position={[0, 0, 0]}
    >
      <primitive 
        ref={meshRef} 
        object={gltf.scene} 
        scale={[1, 1, 1]}
        position={[0, 0, 0]}
      />
    </Float>
  );
};

// Skybox Environment Component with CORS handling
const SkyboxEnvironment: React.FC<{ 
  skyboxUrl: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}> = ({ skyboxUrl, onLoad, onError }) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!skyboxUrl) return;

    const loadTexture = async () => {
      try {
        const loader = new THREE.TextureLoader();
        
        // Try different loading strategies for skybox textures
        const strategies = [
          // Strategy 1: Direct loading (skyboxes usually work fine)
          () => skyboxUrl,
          // Strategy 2: Proxy if direct fails
          () => `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(skyboxUrl)}`,
          // Strategy 3: Local proxy
          () => `http://localhost:5002/proxy-asset?url=${encodeURIComponent(skyboxUrl)}`
        ];

        let loadedTexture: THREE.Texture | null = null;
        let lastError: Error | null = null;

        for (const strategy of strategies) {
          try {
            const url = strategy();
            console.log('🔄 Loading skybox texture via:', url);
            
            loadedTexture = await new Promise<THREE.Texture>((resolve, reject) => {
              loader.load(
                url,
                (texture) => {
                  // Configure texture
                  texture.mapping = THREE.EquirectangularReflectionMapping;
                  texture.minFilter = THREE.LinearFilter;
                  texture.magFilter = THREE.LinearFilter;
                  texture.generateMipmaps = false;
                  resolve(texture);
                },
                undefined,
                (error) => reject(error)
              );
            });

            console.log('✅ Skybox texture loaded successfully');
            break;
          } catch (error) {
            console.warn('⚠️ Skybox loading strategy failed:', error);
            lastError = error instanceof Error ? error : new Error('Unknown error');
          }
        }

        if (loadedTexture) {
          setTexture(loadedTexture);
          setIsLoaded(true);
          onLoad?.();
        } else {
          throw lastError || new Error('All skybox loading strategies failed');
        }
      } catch (error) {
        console.error('Failed to load skybox texture:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setLoadError(errorMessage);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    };

    loadTexture();
  }, [skyboxUrl, onLoad, onError]);

  if (loadError) {
    return <Environment preset="sunset" />; // Fallback to default environment
  }

  if (!texture) {
    return <Environment preset="sunset" />; // Default environment while loading
  }

  return <Environment map={texture} />;
};

// Main Preview Scene Component
export const PreviewScene: React.FC<PreviewSceneProps> = ({ className = '' }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { downloadAsset } = useGenerate();

  // State
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meshLoaded, setMeshLoaded] = useState(false);
  const [skyboxLoaded, setSkyboxLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Scene configuration
  const [sceneConfig, setSceneConfig] = useState<PreviewSceneConfig>({
    autoRotate: true,
    enableControls: true,
    cameraPosition: [0, 0, 5],
    backgroundColor: '#000000',
    lighting: 'studio'
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<any>(null);

  // Load job data
  useEffect(() => {
    const loadJob = async () => {
      if (!jobId) {
        setError('Invalid job ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const jobData = await unifiedStorageService.getJob(jobId);
        
        if (!jobData) {
          setError('Job not found');
          return;
        }

        if (jobData.userId !== user?.uid) {
          setError('Access denied');
          return;
        }

        setJob(jobData);
        
        // Update scene config based on job data
        setSceneConfig(prev => ({
          ...prev,
          skyboxUrl: jobData.skyboxUrl,
          meshUrl: jobData.meshUrl,
          meshFormat: jobData.meshResult?.format || 'glb'
        }));
      } catch (err) {
        console.error('Failed to load job:', err);
        setError(err instanceof Error ? err.message : 'Failed to load job');
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId, user?.uid]);

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle downloads
  const handleDownload = async (type: 'skybox' | 'mesh') => {
    if (!job) return;

    try {
      await downloadAsset(job.id, type);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Failed to download ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Reset camera
  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-300">Loading 3D preview...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FaExclamationTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Preview Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // No assets to preview
  if (!job?.skyboxUrl && !job?.meshUrl) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FaInfoCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Assets Available</h2>
          <p className="text-gray-300 mb-4">This job doesn't have any assets to preview.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 relative ${className}`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/30 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <FaArrowLeft className="w-5 h-5 text-gray-300" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">3D Preview</h1>
                <p className="text-sm text-gray-400 truncate max-w-xs">
                  {job?.prompt}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Info Button */}
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Toggle info"
              >
                <FaInfoCircle className="w-5 h-5 text-gray-300" />
              </button>

              {/* Download Buttons */}
              {job?.skyboxUrl && (
                <button
                  onClick={() => handleDownload('skybox')}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                  aria-label="Download skybox"
                >
                  <FaDownload className="w-4 h-4" />
                  <span className="hidden sm:inline">Skybox</span>
                </button>
              )}

              {job?.meshUrl && (
                <button
                  onClick={() => handleDownload('mesh')}
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
                  aria-label="Download 3D mesh"
                >
                  <FaDownload className="w-4 h-4" />
                  <span className="hidden sm:inline">Mesh</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-4 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-4 space-y-3"
          >
            <h3 className="text-sm font-medium text-white">Controls</h3>
            
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">Auto Rotate</span>
              </label>

              <button
                onClick={resetCamera}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
              >
                <FaRedo className="w-3 h-3" />
                <span>Reset Camera</span>
              </button>

              <button
                onClick={toggleFullscreen}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
              >
                {isFullscreen ? <FaCompress className="w-3 h-3" /> : <FaExpand className="w-3 h-3" />}
                <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Panel */}
      <AnimatePresence>
        {showInfo && job && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-4 max-w-sm"
          >
            <h3 className="text-sm font-medium text-white mb-2">Generation Info</h3>
            <div className="space-y-1 text-sm text-gray-300">
              <p><strong>Status:</strong> {job.status}</p>
              <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>
              {job.skyboxResult && (
                <p><strong>Skybox:</strong> {job.skyboxResult.format.toUpperCase()}</p>
              )}
              {job.meshResult && (
                <p><strong>Mesh:</strong> {job.meshResult.format.toUpperCase()}, {job.meshResult.quality}</p>
              )}
              {job.metadata?.totalTime && (
                <p><strong>Generation Time:</strong> {Math.round(job.metadata.totalTime / 1000)}s</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Indicators */}
      {(!meshLoaded || !skyboxLoaded) && (
        <div className="absolute bottom-4 right-4 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-sm text-gray-300">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
            <span>Loading assets...</span>
          </div>
        </div>
      )}

      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-24 right-4 z-10 p-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Toggle controls"
      >
        <FaCog className="w-4 h-4 text-gray-300" />
      </button>

      {/* 3D Canvas */}
      <div className="absolute inset-0 mt-16">
        <Canvas
          ref={canvasRef}
          camera={{ position: sceneConfig.cameraPosition, fov: 75 }}
          aria-label="3D preview scene"
          onCreated={({ gl }) => {
            gl.setClearColor(sceneConfig.backgroundColor || '#000000');
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          {/* Skybox Environment */}
          {job?.skyboxUrl && (
            <SkyboxEnvironment
              skyboxUrl={job.skyboxUrl}
              onLoad={() => setSkyboxLoaded(true)}
              onError={(error) => console.error('Skybox load error:', error)}
            />
          )}

          {/* Floating Mesh */}
          {job?.meshUrl && (
            <FloatingMesh
              meshUrl={job.meshUrl}
              autoRotate={autoRotate}
              onLoad={() => setMeshLoaded(true)}
              onError={(error) => console.error('Mesh load error:', error)}
            />
          )}

          {/* Ground Plane with Shadows */}
          <ContactShadows
            position={[0, -1, 0]}
            opacity={0.3}
            scale={10}
            blur={2}
            far={4}
          />

          {/* Camera Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={sceneConfig.enableControls}
            enableZoom={sceneConfig.enableControls}
            enableRotate={sceneConfig.enableControls}
            autoRotate={false} // We handle rotation manually
            autoRotateSpeed={0.5}
            minDistance={1}
            maxDistance={10}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
          />
        </Canvas>
      </div>
    </div>
  );
}; 