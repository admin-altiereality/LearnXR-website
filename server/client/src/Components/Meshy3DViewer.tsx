import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  Environment, 
  PresentationControls,
  Float,
  Sparkles,
  Stars,
  Text3D,
  Center,
  Html,
  useProgress
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import { getApiBaseUrl } from '../utils/apiConfig';

interface Meshy3DViewerProps {
  modelUrl: string;
  modelFormat?: 'glb' | 'usdz' | 'obj' | 'fbx';
  autoRotate?: boolean;
  showControls?: boolean;
  showEnvironment?: boolean;
  showGrid?: boolean;
  showAxes?: boolean;
  backgroundColor?: string;
  lighting?: 'studio' | 'outdoor' | 'indoor' | 'dramatic';
  cameraPosition?: [number, number, number];
  interactionMode?: 'rotate' | 'zoom' | 'pan';
  enableInteraction?: boolean;
  onLoad?: (model: any) => void;
  onError?: (error: Error) => void;
  className?: string;
}

interface ModelViewerProps {
  modelUrl: string;
  autoRotate: boolean;
  lighting: 'studio' | 'outdoor' | 'indoor' | 'dramatic';
  onLoad?: (model: any) => void;
  onError?: (error: Error) => void;
}

// Loading component
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-white text-sm">Loading 3D Model... {Math.round(progress)}%</div>
      </div>
    </Html>
  );
}

// Error display component
function ErrorDisplay({ error }: { error: string }) {
  return (
    <Html center>
      <div className="flex flex-col items-center space-y-4 p-6 bg-red-900/90 rounded-lg backdrop-blur-sm max-w-md">
        <div className="text-red-400 text-4xl">⚠️</div>
        <div className="text-red-100 text-center">
          <div className="font-semibold mb-2">Failed to load 3D model</div>
          <div className="text-sm opacity-80">{error}</div>
        </div>
      </div>
    </Html>
  );
}

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
    // Check if this is a Firebase Storage URL - use directly (no proxy needed)
    const isFirebaseStorageUrl = url.includes('firebasestorage.googleapis.com') || 
                                url.includes('firebasestorage.app');
    
    let finalUrl = url;
    
    if (!isFirebaseStorageUrl) {
      // Only use proxy for external URLs (like Meshy.ai)
      const proxyUrl = `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(url)}`;
      console.log('🔄 Loading via proxy (external URL):', proxyUrl);
      finalUrl = proxyUrl;
    } else {
      console.log('✅ Loading directly from Firebase Storage:', url);
    }
    
    return this.loadGLTF(finalUrl);

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

// Model component with enhanced loading
function ModelViewer({ modelUrl, autoRotate, lighting, onLoad, onError }: ModelViewerProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [gltf, setGltf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<ModelLoader | null>(null);

  useEffect(() => {
    if (!modelUrl) return;

    const loadModel = async () => {
      setIsLoading(true);
      setError(null);
      setGltf(null);

      try {
        if (!loaderRef.current) {
          loaderRef.current = new ModelLoader();
        }

        const loadedGltf = await loaderRef.current.loadModel(modelUrl);
        setGltf(loadedGltf);
        setIsLoading(false);
        
        // Optimize the model
        loadedGltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
              child.material.needsUpdate = true;
              child.material.side = THREE.DoubleSide;
            }
          }
        });

        onLoad?.(loadedGltf);
      } catch (error) {
        console.error('Model loading failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        setIsLoading(false);
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    };

    loadModel();
  }, [modelUrl, onLoad, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loaderRef.current) {
        loaderRef.current.dispose();
      }
    };
  }, []);

  // Auto-rotation
  useFrame((state) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!gltf) {
    return <ErrorDisplay error="No model data available" />;
  }

  return (
    <>
      {/* Main model */}
      <Float
        speed={1.5}
        rotationIntensity={0.2}
        floatIntensity={0.5}
      >
        <primitive 
          ref={meshRef}
          object={gltf.scene} 
          scale={1}
          position={[0, 0, 0]}
        />
      </Float>

      {/* Lighting based on selected type */}
      {lighting === 'studio' && (
        <>
          <ambientLight intensity={0.3} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={1} 
            castShadow 
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />
        </>
      )}

      {lighting === 'outdoor' && (
        <>
          <ambientLight intensity={0.6} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={1.2} 
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <hemisphereLight intensity={0.3} groundColor="#000000" />
        </>
      )}

      {lighting === 'indoor' && (
        <>
          <ambientLight intensity={0.4} />
          <pointLight position={[0, 5, 0]} intensity={1} castShadow />
          <pointLight position={[5, 5, 5]} intensity={0.5} />
          <pointLight position={[-5, 5, -5]} intensity={0.5} />
        </>
      )}

      {lighting === 'dramatic' && (
        <>
          <ambientLight intensity={0.1} />
          <directionalLight 
            position={[0, 10, 0]} 
            intensity={2} 
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[10, 0, 10]} intensity={1} color="#ff4444" />
          <pointLight position={[-10, 0, -10]} intensity={1} color="#4444ff" />
        </>
      )}

      {/* Particles for dramatic effect */}
      {lighting === 'dramatic' && (
        <>
          <Sparkles count={100} scale={[10, 10, 10]} size={2} speed={0.5} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        </>
      )}
    </>
  );
}

// Main 3D Viewer Component
export const Meshy3DViewer: React.FC<Meshy3DViewerProps> = ({
  modelUrl,
  modelFormat = 'glb',
  autoRotate = true,
  showControls = true,
  showEnvironment = true,
  showGrid = false,
  showAxes = false,
  backgroundColor = '#000000',
  lighting = 'studio',
  cameraPosition = [0, 0, 5],
  interactionMode = 'rotate',
  enableInteraction = true,
  onLoad,
  onError,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoad = (model: any) => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.(model);
  };

  const handleError = (error: Error) => {
    console.error('3D Model loading error:', error);
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(error.message);
    onError?.(error);
  };

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white text-sm">Loading 3D Model...</div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="flex flex-col items-center space-y-4 p-6 bg-gray-800/90 rounded-lg max-w-md">
            <div className="text-red-400 text-4xl">⚠️</div>
            <div className="text-white text-center">
              <div className="font-semibold mb-2">Failed to load 3D model</div>
              <div className="text-sm text-gray-300">{errorMessage}</div>
              <div className="text-xs text-gray-400 mt-2">
                This may be due to CORS restrictions or network issues.
              </div>
            </div>
          </div>
        </div>
      )}

      <Canvas
        camera={{ 
          position: cameraPosition, 
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          preserveDrawingBuffer: true
        }}
        style={{ background: backgroundColor }}
      >
        <Suspense fallback={<Loader />}>
          <ModelViewer
            modelUrl={modelUrl}
            autoRotate={autoRotate}
            lighting={lighting}
            onLoad={handleLoad}
            onError={handleError}
          />
        </Suspense>

        {/* Grid */}
        {showGrid && <gridHelper args={[20, 20]} />}

        {/* Axes */}
        {showAxes && <axesHelper args={[5]} />}

        {/* Enhanced Controls with Interaction Modes */}
        {showControls && enableInteraction && (
          <PresentationControls
            global
            rotation={[0, -Math.PI / 4, 0]}
            polar={[-Math.PI / 4, Math.PI / 4]}
            azimuth={[-Math.PI / 4, Math.PI / 4]}
            config={{ mass: 2, tension: 400 }}
            snap={{ mass: 4, tension: 400 }}
          >
            <OrbitControls
              enablePan={interactionMode === 'pan'}
              enableZoom={interactionMode === 'zoom'}
              enableRotate={interactionMode === 'rotate'}
              minDistance={1}
              maxDistance={20}
              autoRotate={autoRotate}
              autoRotateSpeed={0.5}
              dampingFactor={0.05}
              enableDamping={true}
              mouseButtons={{
                LEFT: interactionMode === 'rotate' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: interactionMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
              }}
            />
          </PresentationControls>
        )}

        {/* Stars background for dramatic lighting */}
        {lighting === 'dramatic' && (
          <Stars 
            radius={100} 
            depth={50} 
            count={5000} 
            factor={4} 
            saturation={0} 
            fade 
            speed={1} 
          />
        )}

        {/* Environment */}
        {showEnvironment && (
          <Environment preset="sunset" />
        )}
      </Canvas>
    </div>
  );
};

export default Meshy3DViewer;

// Asset Card Component for displaying generated models
interface MeshyAssetCardProps {
  asset: {
    id: string;
    prompt: string;
    downloadUrl?: string;
    previewUrl?: string;
    thumbnailUrl?: string;
    format: string;
    status: string;
    createdAt: string;
    metadata?: {
      category: string;
      confidence: number;
      vertices?: number;
      faces?: number;
    };
  };
  onDownload?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  onView?: (assetId: string) => void;
}

export const MeshyAssetCard: React.FC<MeshyAssetCardProps> = ({
  asset,
  onDownload,
  onDelete,
  onView
}) => {
  const [isViewing, setIsViewing] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'processing': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      case 'pending': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'processing': return '⏳';
      case 'failed': return '❌';
      case 'pending': return '⏸️';
      default: return '❓';
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all duration-300">
      {/* 3D Preview */}
      <div className="relative h-48 bg-gray-900/50">
        {asset.status === 'completed' && asset.downloadUrl ? (
          <>
            {isViewing ? (
              <Meshy3DViewer
                modelUrl={asset.downloadUrl}
                modelFormat={asset.format as any}
                autoRotate={true}
                showControls={true}
                lighting="studio"
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={asset.thumbnailUrl || asset.previewUrl || '/placeholder-3d.png'}
                  alt={asset.prompt}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-3d.png';
                  }}
                />
                <button
                  onClick={() => setIsViewing(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <div className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
                    View 3D Model
                  </div>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">{getStatusIcon(asset.status)}</div>
              <div className="text-gray-400 text-sm capitalize">{asset.status}</div>
            </div>
          </div>
        )}
      </div>

      {/* Asset Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-medium text-white line-clamp-2">
            {asset.prompt}
          </h3>
          <span className={`text-xs font-medium ${getStatusColor(asset.status)}`}>
            {getStatusIcon(asset.status)}
          </span>
        </div>

        {/* Metadata */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Format:</span>
            <span className="text-gray-300">{asset.format.toUpperCase()}</span>
          </div>
          {asset.metadata?.category && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Category:</span>
              <span className="text-gray-300 capitalize">{asset.metadata.category}</span>
            </div>
          )}
          {asset.metadata?.vertices && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Vertices:</span>
              <span className="text-gray-300">{asset.metadata.vertices.toLocaleString()}</span>
            </div>
          )}
          {asset.metadata?.faces && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Faces:</span>
              <span className="text-gray-300">{asset.metadata.faces.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {asset.status === 'completed' && asset.downloadUrl && (
            <>
              <button
                onClick={() => onView?.(asset.id)}
                className="flex-1 px-3 py-1 bg-blue-600/50 hover:bg-blue-600/70 text-white text-xs rounded transition-colors"
              >
                View
              </button>
              <button
                onClick={() => onDownload?.(asset.id)}
                className="flex-1 px-3 py-1 bg-green-600/50 hover:bg-green-600/70 text-white text-xs rounded transition-colors"
              >
                Download
              </button>
            </>
          )}
          <button
            onClick={() => onDelete?.(asset.id)}
            className="px-3 py-1 bg-red-600/50 hover:bg-red-600/70 text-white text-xs rounded transition-colors"
          >
            Delete
          </button>
        </div>

        {/* Timestamp */}
        <div className="mt-2 text-xs text-gray-500">
          {new Date(asset.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}; 