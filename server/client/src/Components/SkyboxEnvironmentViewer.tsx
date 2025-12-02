import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  useProgress,
  TransformControls,
  GizmoHelper,
  GizmoViewport,
  ContactShadows,
  Grid,
  useTexture,
  Sphere
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ============================================
// Types
// ============================================
interface Asset3D {
  id: string;
  prompt?: string;
  downloadUrl?: string;
  modelUrl?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  format?: string;
  status?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

interface SkyboxEnvironmentViewerProps {
  skyboxImageUrl: string;
  assets: Asset3D[];
  onAssetSelect?: (assetId: string | null) => void;
  onAssetTransform?: (assetId: string, position: [number, number, number], rotation: [number, number, number], scale: number) => void;
  className?: string;
  showGrid?: boolean;
  showGizmo?: boolean;
  enableInteraction?: boolean;
}

// ============================================
// Loading Component
// ============================================
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center space-y-4 p-6 bg-black/80 rounded-xl backdrop-blur-md">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-white text-sm font-medium">Loading Environment... {Math.round(progress)}%</div>
      </div>
    </Html>
  );
}

// ============================================
// Skybox Sphere (uses the generated skybox image)
// ============================================
function SkyboxSphere({ imageUrl }: { imageUrl: string }) {
  const texture = useTexture(imageUrl);
  
  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }, [texture]);

  return (
    <Sphere args={[500, 64, 64]} scale={[-1, 1, 1]}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </Sphere>
  );
}

// ============================================
// Individual 3D Asset with interaction
// ============================================
interface InteractiveAssetProps {
  asset: Asset3D;
  isSelected: boolean;
  onSelect: () => void;
  transformMode: 'translate' | 'rotate' | 'scale';
  onTransformEnd?: (position: [number, number, number], rotation: [number, number, number], scale: number) => void;
}

function InteractiveAsset({ asset, isSelected, onSelect, transformMode, onTransformEnd }: InteractiveAssetProps) {
  const meshRef = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  const [gltf, setGltf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const modelUrl = asset.downloadUrl || asset.modelUrl;

  // Load the 3D model
  useEffect(() => {
    if (!modelUrl) {
      setError('No model URL provided');
      setIsLoading(false);
      return;
    }

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    setIsLoading(true);
    setError(null);

    // Try loading strategies
    const tryLoad = async () => {
      const strategies = [
        modelUrl,
        `https://us-central1-in3devoneuralai.cloudfunctions.net/api/proxy-asset?url=${encodeURIComponent(modelUrl)}`,
      ];

      for (const url of strategies) {
        try {
          const result = await new Promise<any>((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          });
          
          // Optimize model
          result.scene.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.needsUpdate = true;
              }
            }
          });

          // Auto-scale and center
          const box = new THREE.Box3().setFromObject(result.scene);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim; // Normalize to ~2 units
          result.scene.scale.setScalar(scale);

          const center = box.getCenter(new THREE.Vector3());
          result.scene.position.sub(center.multiplyScalar(scale));

          setGltf(result);
          setIsLoading(false);
          return;
        } catch (err) {
          console.warn('Load strategy failed:', url, err);
        }
      }

      setError('Failed to load 3D model');
      setIsLoading(false);
    };

    tryLoad();

    return () => {
      dracoLoader.dispose();
    };
  }, [modelUrl]);

  // Handle transform end
  const handleTransformEnd = useCallback(() => {
    if (meshRef.current && onTransformEnd) {
      const pos = meshRef.current.position.toArray() as [number, number, number];
      const rot = meshRef.current.rotation.toArray().slice(0, 3) as [number, number, number];
      const scl = meshRef.current.scale.x;
      onTransformEnd(pos, rot, scl);
    }
  }, [onTransformEnd]);

  // Click handler
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect();
    }
  };

  // Set initial position
  useEffect(() => {
    if (meshRef.current && asset.position) {
      meshRef.current.position.set(...asset.position);
    }
    if (meshRef.current && asset.rotation) {
      meshRef.current.rotation.set(...asset.rotation);
    }
    if (meshRef.current && asset.scale) {
      meshRef.current.scale.setScalar(asset.scale);
    }
  }, [asset.position, asset.rotation, asset.scale, gltf]);

  if (isLoading) {
    return (
      <Html position={asset.position || [0, 0, 0]}>
        <div className="bg-black/70 px-3 py-2 rounded-lg text-white text-xs flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          Loading asset...
        </div>
      </Html>
    );
  }

  if (error || !gltf) {
    return (
      <Html position={asset.position || [0, 0, 0]}>
        <div className="bg-red-900/80 px-3 py-2 rounded-lg text-red-200 text-xs">
          ⚠️ {error || 'No model'}
        </div>
      </Html>
    );
  }

  return (
    <>
      <group
        ref={meshRef}
        position={asset.position || [0, 0, 0]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <primitive object={gltf.scene.clone()} />
        
        {/* Selection highlight */}
        {(hovered || isSelected) && (
          <mesh scale={[1.1, 1.1, 1.1]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshBasicMaterial 
              color={isSelected ? '#10b981' : '#3b82f6'} 
              wireframe 
              transparent 
              opacity={0.5} 
            />
          </mesh>
        )}
      </group>

      {/* Transform controls when selected */}
      {isSelected && meshRef.current && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current}
          mode={transformMode}
          onMouseUp={handleTransformEnd}
          size={0.8}
        />
      )}
    </>
  );
}

// ============================================
// Scene content
// ============================================
interface SceneContentProps {
  skyboxImageUrl: string;
  assets: Asset3D[];
  selectedAssetId: string | null;
  onAssetSelect: (id: string | null) => void;
  transformMode: 'translate' | 'rotate' | 'scale';
  onAssetTransform?: (assetId: string, position: [number, number, number], rotation: [number, number, number], scale: number) => void;
  showGrid: boolean;
}

function SceneContent({
  skyboxImageUrl,
  assets,
  selectedAssetId,
  onAssetSelect,
  transformMode,
  onAssetTransform,
  showGrid
}: SceneContentProps) {
  // Click on empty space to deselect
  const handleBackgroundClick = () => {
    onAssetSelect(null);
  };

  return (
    <>
      {/* Skybox background */}
      <Suspense fallback={null}>
        <SkyboxSphere imageUrl={skyboxImageUrl} />
      </Suspense>

      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, 5, -10]} intensity={0.5} />
      <hemisphereLight intensity={0.3} groundColor="#080820" />

      {/* Ground plane for click detection */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onClick={handleBackgroundClick}
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>

      {/* Optional grid */}
      {showGrid && (
        <Grid
          position={[0, 0, 0]}
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#1e3a5f"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#2563eb"
          fadeDistance={50}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      {/* Contact shadows */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={20}
        blur={2}
        far={10}
      />

      {/* 3D Assets */}
      {assets.map((asset, index) => {
        // Assign default positions if not set
        const defaultPosition: [number, number, number] = [
          (index - Math.floor(assets.length / 2)) * 3,
          0,
          0
        ];

        return (
          <InteractiveAsset
            key={asset.id}
            asset={{ ...asset, position: asset.position || defaultPosition }}
            isSelected={selectedAssetId === asset.id}
            onSelect={() => onAssetSelect(asset.id)}
            transformMode={transformMode}
            onTransformEnd={(pos, rot, scale) => {
              onAssetTransform?.(asset.id, pos, rot, scale);
            }}
          />
        );
      })}
    </>
  );
}

// ============================================
// Main Component
// ============================================
export const SkyboxEnvironmentViewer: React.FC<SkyboxEnvironmentViewerProps> = ({
  skyboxImageUrl,
  assets,
  onAssetSelect,
  onAssetTransform,
  className = '',
  showGrid = false,
  showGizmo = true,
  enableInteraction = true
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAssetSelect = (id: string | null) => {
    setSelectedAssetId(id);
    onAssetSelect?.(id);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') setTransformMode('translate');
      if (e.key === 'r' || e.key === 'R') setTransformMode('rotate');
      if (e.key === 's' || e.key === 'S') setTransformMode('scale');
      if (e.key === 'Escape') setSelectedAssetId(null);
      if (e.key === 'f' || e.key === 'F') setIsFullscreen(!isFullscreen);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!skyboxImageUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-xl ${className}`}>
        <div className="text-gray-400 text-sm">No skybox generated yet</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-xl overflow-hidden ${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
    >
      {/* Control toolbar - only show when there are assets */}
      {assets.length > 0 && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="bg-black/80 backdrop-blur-md rounded-lg px-3 py-2 flezx items-center gap-2 border border-gray-700/50">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wide font-medium">Transform:</span>
            <button
              onClick={() => setTransformMode('translate')}
              className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-wide transition-all ${
                transformMode === 'translate'
                  ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Move (G)
            </button>
            <button
              onClick={() => setTransformMode('rotate')}
              className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-wide transition-all ${
                transformMode === 'rotate'
                  ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Rotate (R)
            </button>
            <button
              onClick={() => setTransformMode('scale')}
              className={`px-2.5 py-1.5 rounded text-[10px] uppercase tracking-wide transition-all ${
                transformMode === 'scale'
                  ? 'bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Scale (S)
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-gray-300 hover:text-white hover:bg-black/90 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isFullscreen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          )}
        </svg>
      </button>

      {/* Asset count & selection info */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide">
          {assets.length} 3D Asset{assets.length !== 1 ? 's' : ''} in Scene
          {selectedAssetId && (
            <span className="text-emerald-400 ml-2">• 1 Selected</span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-[9px] text-gray-400">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-emerald-400">🖱️ Left drag</span> Orbit view
        </div>
        <div className="flex items-center gap-1 mb-1">
          <span className="text-emerald-400">🖱️ Right drag</span> Pan
        </div>
        <div className="flex items-center gap-1 mb-1">
          <span className="text-emerald-400">🖱️ Scroll</span> Zoom in/out
        </div>
        <div className="flex items-center gap-1">
          <span className="text-emerald-400">Click 3D asset</span> Select & transform
        </div>
      </div>

      {/* Canvas */}
      <Canvas
        camera={{
          position: [0, 3, 8],
          fov: 55,
          near: 0.1,
          far: 2000
        }}
        shadows
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
      >
        <Suspense fallback={<Loader />}>
          <SceneContent
            skyboxImageUrl={skyboxImageUrl}
            assets={assets}
            selectedAssetId={selectedAssetId}
            onAssetSelect={handleAssetSelect}
            transformMode={transformMode}
            onAssetTransform={onAssetTransform}
            showGrid={showGrid}
          />
        </Suspense>

        {/* Orbit controls - smooth zoom and drag */}
        {enableInteraction && (
          <OrbitControls
            makeDefault
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1}
            maxDistance={200}
            maxPolarAngle={Math.PI * 0.85}
            minPolarAngle={0.1}
            dampingFactor={0.08}
            enableDamping
            zoomSpeed={1.2}
            panSpeed={0.8}
            rotateSpeed={0.6}
          />
        )}

        {/* Gizmo helper */}
        {showGizmo && (
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#ff4444', '#44ff44', '#4444ff']} labelColor="white" />
          </GizmoHelper>
        )}
      </Canvas>
    </div>
  );
};

export default SkyboxEnvironmentViewer;

