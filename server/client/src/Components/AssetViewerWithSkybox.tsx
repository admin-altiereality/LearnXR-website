import React, { Suspense, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  useTexture, 
  Html, 
  useProgress, 
  Sphere,
  ContactShadows,
  Float,
  Sparkles,
  MeshReflectorMaterial
} from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { getApiBaseUrl } from '../utils/apiConfig';

interface AssetViewerWithSkyboxProps {
  assetUrl: string;
  skyboxImageUrl?: string;
  assetFormat?: 'glb' | 'usdz' | 'obj' | 'fbx';
  className?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  onLoad?: (model: any) => void;
  onError?: (error: Error) => void;
}

interface BlendSettings {
  reflectionStrength: number;
  environmentIntensity: number;
  fogEnabled: boolean;
  fogDensity: number;
  groundReflection: boolean;
  groundOpacity: number;
  floatEnabled: boolean;
  particlesEnabled: boolean;
  groundFade: boolean;
  depthParallax: boolean;
  parallaxIntensity: number;
  wireframeEnabled: boolean;
  wireframeMode: 'overlay' | 'full';
  wireframeColor: string;
  wireframeOpacity: number;
  wireframeLineWidth: number;
  skyboxWireframeEnabled: boolean;
  skyboxMeshDensity: 'low' | 'medium' | 'high' | 'epic';
  skyboxWireframeColor: string;
  skyboxWireframeOpacity: number;
  worldMeshEnabled: boolean;
  worldMeshQuality: 'low' | 'medium' | 'high' | 'epic';
  worldMeshDepthScale: number;
  worldMeshSmoothness: number;
}

// Loading component with enhanced visuals
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center space-y-4 p-8 bg-black/90 rounded-2xl backdrop-blur-xl border border-white/10">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-emerald-500/30 rounded-full" />
          <div className="w-20 h-20 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-emerald-400 text-lg font-bold">{Math.round(progress)}%</span>
          </div>
        </div>
        <div className="text-white text-sm font-medium tracking-wide">Loading Immersive Scene...</div>
        <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Html>
  );
}

// Mesh density presets for skybox wireframe (higher values = smaller triangles)
const MESH_DENSITY_PRESETS = {
  low: [64, 64],
  medium: [128, 128],
  high: [256, 256],
  epic: [512, 512]
};

// World Mesh quality presets (for depth-based mesh generation)
const WORLD_MESH_QUALITY_PRESETS = {
  low: { segments: 64, depthSamples: 32 },
  medium: { segments: 128, depthSamples: 64 },
  high: { segments: 256, depthSamples: 128 },
  epic: { segments: 512, depthSamples: 256 }
};

// World Mesh component - creates 3D mesh from skybox using depth information
function WorldMesh({ 
  skyboxImageUrl, 
  skyboxTexture, 
  enabled, 
  quality, 
  depthScale, 
  smoothness 
}: { 
  skyboxImageUrl?: string;
  skyboxTexture: THREE.Texture | null;
  enabled: boolean;
  quality: 'low' | 'medium' | 'high' | 'epic';
  depthScale: number;
  smoothness: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.SphereGeometry | null>(null);
  const [depthMap, setDepthMap] = useState<Float32Array | null>(null);
  const [depthMapSize, setDepthMapSize] = useState({ width: 0, height: 0 });
  
  const { segments, depthSamples } = WORLD_MESH_QUALITY_PRESETS[quality];
  
  // Generate depth map from skybox image (simulated depth estimation)
  useEffect(() => {
    if (!enabled || !skyboxImageUrl) {
      setDepthMap(null);
      return;
    }
    
    const generateDepthMap = async () => {
      try {
        // Create a canvas to process the skybox image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Load skybox image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = skyboxImageUrl;
        });
        
        const width = depthSamples;
        const height = Math.floor(depthSamples / 2); // Equirectangular aspect ratio
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and process image
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Generate depth map from luminance (simulated depth estimation)
        const depthData = new Float32Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Use luminance as depth proxy (darker = closer, brighter = farther)
          const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          // Invert so darker areas are closer, apply smoothing
          const depth = Math.pow(1 - luminance, smoothness);
          depthData[i / 4] = depth;
        }
        
        setDepthMap(depthData);
        setDepthMapSize({ width, height });
      } catch (error) {
        console.warn('Failed to generate depth map:', error);
        setDepthMap(null);
      }
    };
    
    generateDepthMap();
  }, [enabled, skyboxImageUrl, depthSamples, smoothness]);
  
  // Create geometry with depth displacement
  useEffect(() => {
    if (!enabled || !meshRef.current) return;
    
    // Dispose old geometry
    if (geometryRef.current) {
      geometryRef.current.dispose();
    }
    
    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(500, segments, segments);
    geometry.scale(-1, 1, 1);
    
    // Apply depth displacement if depth map is available
    if (depthMap && depthMapSize.width > 0 && geometry.attributes.position) {
      const positions = geometry.attributes.position;
      const positionArray = positions.array as Float32Array;
      
      for (let i = 0; i < positionArray.length; i += 3) {
        const x = positionArray[i];
        const y = positionArray[i + 1];
        const z = positionArray[i + 2];
        
        // Convert 3D position to UV coordinates (spherical to equirectangular)
        const phi = Math.acos(-y / 500);
        const theta = Math.atan2(-z, x) + Math.PI;
        
        const u = theta / (2 * Math.PI);
        const v = phi / Math.PI;
        
        // Sample depth map
        const depthX = Math.floor(u * depthMapSize.width);
        const depthY = Math.floor(v * depthMapSize.height);
        const depthIndex = depthY * depthMapSize.width + depthX;
        
        if (depthIndex >= 0 && depthIndex < depthMap.length) {
          const depth = depthMap[depthIndex];
          
          // Apply depth displacement
          const displacement = (depth - 0.5) * depthScale * 50; // Scale displacement
          const normal = new THREE.Vector3(x, y, z).normalize();
          
          positionArray[i] += normal.x * displacement;
          positionArray[i + 1] += normal.y * displacement;
          positionArray[i + 2] += normal.z * displacement;
        }
      }
      
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    }
    
    geometryRef.current = geometry;
    
    if (meshRef.current) {
      meshRef.current.geometry = geometry;
    }
    
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
    };
  }, [enabled, depthMap, depthMapSize, segments, depthScale]);
  
  if (!enabled || !skyboxTexture) return null;
  
  return (
    <mesh ref={meshRef} geometry={geometryRef.current || undefined}>
      <meshStandardMaterial
        map={skyboxTexture}
        side={THREE.BackSide}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

// Skybox wireframe overlay component
function SkyboxWireframe({ 
  enabled, 
  meshDensity, 
  color, 
  opacity 
}: { 
  enabled: boolean; 
  meshDensity: 'low' | 'medium' | 'high' | 'epic';
  color: string;
  opacity: number;
}) {
  const [segments] = MESH_DENSITY_PRESETS[meshDensity];
  
  if (!enabled) return null;
  
  return (
    <Sphere args={[500, segments, segments]} scale={[-1, 1, 1]}>
      <meshBasicMaterial
        wireframe
        color={new THREE.Color(color)}
        transparent
        opacity={opacity}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </Sphere>
  );
}

// Enhanced Skybox sphere with environment mapping support
function SkyboxSphere({ 
  imageUrl, 
  onTextureLoad,
  wireframeEnabled = false,
  meshDensity = 'medium',
  wireframeColor = '#00ff88',
  wireframeOpacity = 0.6
}: { 
  imageUrl: string; 
  onTextureLoad?: (texture: THREE.Texture) => void;
  wireframeEnabled?: boolean;
  meshDensity?: 'low' | 'medium' | 'high' | 'epic';
  wireframeColor?: string;
  wireframeOpacity?: number;
}) {
  const [loadError, setLoadError] = useState(false);
  
  const isValidImageUrl = useMemo(() => {
    if (!imageUrl) return false;
    const urlLower = imageUrl.toLowerCase();
    const modelExtensions = ['.glb', '.gltf', '.fbx', '.obj', '.usdz'];
    const isModelFile = modelExtensions.some(ext => urlLower.includes(ext));
    if (isModelFile) {
      console.warn('⚠️ SkyboxSphere: URL appears to be a 3D model, not an image:', imageUrl);
      return false;
    }
    return true;
  }, [imageUrl]);

  const [segments] = MESH_DENSITY_PRESETS[meshDensity];

  if (!isValidImageUrl || loadError) {
    return (
      <>
        <Sphere args={[500, segments, segments]} scale={[-1, 1, 1]}>
          <meshBasicMaterial color="#0a0a0a" side={THREE.BackSide} />
        </Sphere>
        {wireframeEnabled && (
          <SkyboxWireframe
            enabled={wireframeEnabled}
            meshDensity={meshDensity}
            color={wireframeColor}
            opacity={wireframeOpacity}
          />
        )}
      </>
    );
  }
  
  return (
    <>
      <SkyboxSphereInner 
        imageUrl={imageUrl} 
        onError={() => setLoadError(true)} 
        onTextureLoad={onTextureLoad}
        segments={segments}
      />
      {wireframeEnabled && (
        <SkyboxWireframe
          enabled={wireframeEnabled}
          meshDensity={meshDensity}
          color={wireframeColor}
          opacity={wireframeOpacity}
        />
      )}
    </>
  );
}

// Inner component that loads texture and passes it up for environment mapping
function SkyboxSphereInner({ 
  imageUrl, 
  onError,
  onTextureLoad,
  segments = 64
}: { 
  imageUrl: string; 
  onError: () => void;
  onTextureLoad?: (texture: THREE.Texture) => void;
  segments?: number;
}) {
  // useTexture handles errors via Suspense, but we keep onError for API compatibility
  const texture = useTexture(imageUrl);
  
  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      onTextureLoad?.(texture);
    }
  }, [texture, onTextureLoad]);
  
  // Suppress unused warning - onError is kept for API compatibility
  void onError;

  return (
    <Sphere args={[500, segments, segments]} scale={[-1, 1, 1]}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </Sphere>
  );
}

// Atmospheric fog component for depth blending
function AtmosphericFog({ 
  enabled, 
  density, 
  color = '#0a0a0a' 
}: { 
  enabled: boolean; 
  density: number;
  color?: string;
}) {
  const { scene } = useThree();
  
  useEffect(() => {
    if (enabled) {
      scene.fog = new THREE.FogExp2(color, density);
    } else {
      scene.fog = null;
    }
    return () => {
      scene.fog = null;
    };
  }, [enabled, density, color, scene]);
  
  return null;
}

// Reflective ground plane that blends with the environment
function ReflectiveGround({ 
  enabled, 
  opacity, 
  envMap,
  fade = true 
}: { 
  enabled: boolean; 
  opacity: number;
  envMap: THREE.Texture | null;
  fade?: boolean;
}) {
  if (!enabled) return null;
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <circleGeometry args={[50, 64]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={fade ? 80 : 40}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#050505"
        metalness={0.5}
        mirror={0}
        envMap={envMap}
        envMapIntensity={opacity}
      />
    </mesh>
  );
}

// Wireframe overlay component for merging assets with skybox
function WireframeOverlay({ 
  gltf, 
  enabled, 
  color, 
  opacity
}: { 
  gltf: any; 
  enabled: boolean; 
  color: string; 
  opacity: number;
}) {
  const wireframeGroupRef = useRef<THREE.Group>(null);
  const wireframeMeshesRef = useRef<THREE.Mesh[]>([]);
  
  useEffect(() => {
    if (!gltf || !enabled || !wireframeGroupRef.current) {
      // Cleanup if disabled
      if (wireframeMeshesRef.current.length > 0) {
        wireframeMeshesRef.current.forEach(mesh => {
          mesh.geometry.dispose();
          if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose();
          }
        });
        wireframeMeshesRef.current = [];
      }
      return;
    }
    
    // Clear existing wireframe meshes
    wireframeMeshesRef.current.forEach(mesh => {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      wireframeGroupRef.current?.remove(mesh);
    });
    wireframeMeshesRef.current = [];
    
    // Create wireframe meshes from the model
    gltf.scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        try {
          const wireframeGeometry = child.geometry.clone();
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            wireframe: true,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          
          const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
          
          // Get world matrix from original mesh
          child.updateMatrixWorld();
          wireframeMesh.matrixWorld.copy(child.matrixWorld);
          wireframeMesh.matrix.copy(child.matrix);
          
          wireframeGroupRef.current?.add(wireframeMesh);
          wireframeMeshesRef.current.push(wireframeMesh);
        } catch (error) {
          console.warn('Failed to create wireframe mesh:', error);
        }
      }
    });
    
    return () => {
      // Cleanup on unmount or when dependencies change
      wireframeMeshesRef.current.forEach(mesh => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
      wireframeMeshesRef.current = [];
    };
  }, [gltf, enabled, color, opacity]);
  
  // Update wireframe properties when they change
  useEffect(() => {
    if (wireframeMeshesRef.current.length > 0) {
      wireframeMeshesRef.current.forEach(mesh => {
        if (mesh.material instanceof THREE.MeshBasicMaterial) {
          mesh.material.color.set(color);
          mesh.material.opacity = opacity;
        }
      });
    }
  }, [color, opacity]);
  
  if (!enabled || !gltf) return null;
  
  return <group ref={wireframeGroupRef} />;
}

// Enhanced 3D Asset component with environment reflection and wireframe support
function AssetModel({ 
  assetUrl, 
  autoRotate = false, 
  autoRotateSpeed = 1,
  envMap,
  reflectionStrength = 0.5,
  environmentIntensity = 1,
  floatEnabled = false,
  wireframeEnabled = false,
  wireframeMode = 'overlay',
  wireframeColor = '#00ff88',
  wireframeOpacity = 0.6,
  wireframeLineWidth = 1, // Reserved for future use (WebGL line width limitations)
  onLoad,
  onError 
}: { 
  assetUrl: string; 
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  envMap?: THREE.Texture | null;
  reflectionStrength?: number;
  environmentIntensity?: number;
  floatEnabled?: boolean;
  wireframeEnabled?: boolean;
  wireframeMode?: 'overlay' | 'full';
  wireframeColor?: string;
  wireframeOpacity?: number;
  wireframeLineWidth?: number;
  onLoad?: (model: any) => void; 
  onError?: (error: Error) => void;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const [gltf, setGltf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<{ gltfLoader: GLTFLoader; dracoLoader: DRACOLoader } | null>(null);
  
  // Suppress unused warning - wireframeLineWidth reserved for future use
  void wireframeLineWidth;

  // Auto-rotation animation with smooth easing
  useFrame((_state, delta) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y += delta * autoRotateSpeed * 0.5;
    }
  });

  // Apply environment map to materials when envMap or model changes
  useEffect(() => {
    if (gltf && envMap) {
      gltf.scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material: THREE.Material) => {
            if (material instanceof THREE.MeshStandardMaterial || 
                material instanceof THREE.MeshPhysicalMaterial) {
              material.envMap = envMap;
              material.envMapIntensity = environmentIntensity;
              material.metalness = Math.max(material.metalness, reflectionStrength * 0.5);
              material.roughness = Math.min(material.roughness, 1 - reflectionStrength * 0.3);
              material.needsUpdate = true;
            }
          });
        }
      });
    }
  }, [gltf, envMap, reflectionStrength, environmentIntensity]);

  // Apply wireframe to materials when wireframe mode is 'full'
  useEffect(() => {
    if (gltf && wireframeEnabled && wireframeMode === 'full') {
      gltf.scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material: THREE.Material) => {
            if (material instanceof THREE.MeshStandardMaterial || 
                material instanceof THREE.MeshPhysicalMaterial ||
                material instanceof THREE.MeshBasicMaterial) {
              material.wireframe = true;
              material.color = new THREE.Color(wireframeColor);
              material.transparent = true;
              material.opacity = wireframeOpacity;
              material.needsUpdate = true;
            }
          });
        }
      });
    } else if (gltf && (!wireframeEnabled || wireframeMode === 'overlay')) {
      // Restore original materials when wireframe is disabled or in overlay mode
      gltf.scene.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material: THREE.Material) => {
            if (material instanceof THREE.MeshStandardMaterial || 
                material instanceof THREE.MeshPhysicalMaterial ||
                material instanceof THREE.MeshBasicMaterial) {
              material.wireframe = false;
              if (material.transparent) {
                material.opacity = 1;
              }
              material.needsUpdate = true;
            }
          });
        }
      });
    }
  }, [gltf, wireframeEnabled, wireframeMode, wireframeColor, wireframeOpacity]);

  useEffect(() => {
    if (!assetUrl) return;

    const urlLower = assetUrl.toLowerCase();
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const isVideo = videoExtensions.some(ext => urlLower.includes(ext)) || 
                    urlLower.includes('/output/output.mp4') ||
                    urlLower.includes('/output.mp4') ||
                    urlLower.includes('output.mp4') ||
                    urlLower.includes('video');
    
    if (isVideo) {
      console.error('❌ AssetViewerWithSkybox: URL is a video file, not a 3D model:', assetUrl);
      setError('Invalid asset URL: video files cannot be loaded as 3D models');
      setIsLoading(false);
      onError?.(new Error('URL is a video file, not a 3D model'));
      return;
    }

    const loadModel = async () => {
      setIsLoading(true);
      setError(null);
      setGltf(null);

      try {
        if (!loaderRef.current) {
          const gltfLoader = new GLTFLoader();
          const dracoLoader = new DRACOLoader();
          dracoLoader.setDecoderPath('/draco/');
          gltfLoader.setDRACOLoader(dracoLoader);
          loaderRef.current = { gltfLoader, dracoLoader };
        }

        const apiBaseUrl = getApiBaseUrl();
        const proxyUrl = `${apiBaseUrl}/proxy-asset?url=${encodeURIComponent(assetUrl)}`;
        console.log('🔄 Loading 3D asset via proxy:', proxyUrl);
        
        const loadedGltf = await new Promise<any>((resolve, reject) => {
          loaderRef.current!.gltfLoader.load(proxyUrl, resolve, undefined, reject);
        });

        // Optimize the model for immersive rendering
        loadedGltf.scene.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.needsUpdate = true;
              child.material.side = THREE.DoubleSide;
              
              // Enhance material for better environment integration
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.envMapIntensity = environmentIntensity;
              }
            }
          }
        });

        // Auto-scale and center
        const box = new THREE.Box3().setFromObject(loadedGltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        loadedGltf.scene.scale.setScalar(scale);

        const center = box.getCenter(new THREE.Vector3());
        loadedGltf.scene.position.sub(center.multiplyScalar(scale));

        setGltf(loadedGltf);
        setIsLoading(false);
        onLoad?.(loadedGltf);
      } catch (err) {
        console.error('Model loading failed:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsLoading(false);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    };

    loadModel();
  }, [assetUrl, onLoad, onError, environmentIntensity]);

  useEffect(() => {
    return () => {
      if (loaderRef.current?.dracoLoader) {
        loaderRef.current.dracoLoader.dispose();
      }
    };
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (error || !gltf) {
    return (
      <Html center>
        <div className="bg-red-900/90 px-6 py-4 rounded-xl text-red-200 text-sm max-w-md backdrop-blur-lg border border-red-500/30">
          <div className="font-bold mb-2 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            Failed to load 3D model
          </div>
          <div className="text-xs mb-2 opacity-80">{error || 'Unknown error'}</div>
          <div className="text-xs opacity-60 break-all">
            URL: {assetUrl?.substring(0, 100)}...
          </div>
        </div>
      </Html>
    );
  }

  const modelContent = (
    <>
      <primitive 
        ref={meshRef}
        object={gltf.scene} 
        scale={1}
        position={[0, 0, 0]}
      />
      {/* Wireframe overlay for coherence with skybox */}
      {wireframeEnabled && wireframeMode === 'overlay' && (
        <WireframeOverlay
          gltf={gltf}
          enabled={wireframeEnabled}
          color={wireframeColor}
          opacity={wireframeOpacity}
        />
      )}
    </>
  );

  // Wrap in Float component if enabled
  if (floatEnabled) {
    return (
      <Float
        speed={1.5}
        rotationIntensity={0.2}
        floatIntensity={0.3}
        floatingRange={[-0.1, 0.1]}
      >
        {modelContent}
      </Float>
    );
  }

  return modelContent;
}

// Enhanced lighting that integrates with environment
function ImmersiveLighting({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <ambientLight intensity={0.3 * intensity} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={1.5 * intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0001}
      />
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.4 * intensity}
        color="#87ceeb"
      />
      <pointLight position={[-10, 5, -10]} intensity={0.3 * intensity} color="#ffa07a" />
      <pointLight position={[10, 5, 10]} intensity={0.2 * intensity} color="#add8e6" />
      <hemisphereLight 
        intensity={0.4 * intensity} 
        groundColor="#080820" 
        color="#ffffff"
      />
    </>
  );
}

// Ambient particles for atmosphere
function AmbientParticles({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  
  return (
    <Sparkles
      count={100}
      scale={15}
      size={2}
      speed={0.3}
      opacity={0.4}
      color="#ffffff"
    />
  );
}

// Parallax camera effect for depth (Blockade Labs-style)
function ParallaxCamera({ 
  enabled, 
  intensity,
  parallaxRef 
}: { 
  enabled: boolean;
  intensity: number;
  parallaxRef: React.MutableRefObject<{ mouseX: number; mouseY: number }>;
}) {
  const { camera } = useThree();
  const initialPosition = useRef<THREE.Vector3 | null>(null);
  
  useEffect(() => {
    if (camera && !initialPosition.current) {
      initialPosition.current = camera.position.clone();
    }
  }, [camera]);
  
  useFrame(() => {
    if (!enabled || !initialPosition.current || !camera) return;
    
    const { mouseX, mouseY } = parallaxRef.current;
    const parallaxAmount = 0.5 * intensity;
    
    // Subtle camera movement for depth parallax
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      initialPosition.current.x + mouseX * parallaxAmount,
      0.1
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      initialPosition.current.y + mouseY * parallaxAmount,
      0.1
    );
  });
  
  return null;
}

// Error fallback component
function ViewerErrorFallback({ error, assetUrl }: { error: string; assetUrl: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-gray-900 to-black rounded-lg">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-white font-bold text-xl mb-3">Failed to load 3D viewer</h3>
        <p className="text-gray-400 text-sm mb-6">{error}</p>
        <button
          onClick={() => window.open(assetUrl, '_blank')}
          className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
        >
          Open Model URL
        </button>
      </div>
    </div>
  );
}

// Blend settings control panel
function BlendControlPanel({ 
  settings, 
  onSettingsChange,
  isVisible,
  onToggle
}: { 
  settings: BlendSettings; 
  onSettingsChange: (settings: BlendSettings) => void;
  isVisible: boolean;
  onToggle: () => void;
}) {
  const handleChange = useCallback((key: keyof BlendSettings, value: number | boolean | string) => {
    onSettingsChange({ ...settings, [key]: value });
  }, [settings, onSettingsChange]);

  return (
    <>
      {/* Settings panel - Fixed right side panel */}
      {isVisible && (
        <div className={`fixed top-0 right-0 h-full z-[10001] bg-[#0a0a0a]/98 backdrop-blur-xl border-l border-[#1a1a1a]/30 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-[280px] sm:w-[300px] md:w-[320px]`}>
          <div className="h-full overflow-y-auto p-4 space-y-4">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm tracking-wide">🎨 Blend Settings</h3>
            <button 
              onClick={onToggle}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
          {/* Environment Reflection */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs text-gray-300">
              <span>🔮 Reflection Strength</span>
              <span className="text-emerald-400">{(settings.reflectionStrength * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.reflectionStrength}
              onChange={(e) => handleChange('reflectionStrength', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Environment Intensity */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs text-gray-300">
              <span>☀️ Environment Light</span>
              <span className="text-emerald-400">{(settings.environmentIntensity * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.environmentIntensity}
              onChange={(e) => handleChange('environmentIntensity', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Ground Reflection Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">🪞 Ground Reflection</span>
            <button
              onClick={() => handleChange('groundReflection', !settings.groundReflection)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.groundReflection ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.groundReflection ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Ground Opacity */}
          {settings.groundReflection && (
            <div className="space-y-2 pl-4 border-l-2 border-emerald-500/30">
              <label className="flex items-center justify-between text-xs text-gray-400">
                <span>Reflection Opacity</span>
                <span className="text-emerald-400">{(settings.groundOpacity * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.groundOpacity}
                onChange={(e) => handleChange('groundOpacity', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          )}

          {/* Fog Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">🌫️ Atmospheric Fog</span>
            <button
              onClick={() => handleChange('fogEnabled', !settings.fogEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.fogEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.fogEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Fog Density */}
          {settings.fogEnabled && (
            <div className="space-y-2 pl-4 border-l-2 border-emerald-500/30">
              <label className="flex items-center justify-between text-xs text-gray-400">
                <span>Fog Density</span>
                <span className="text-emerald-400">{(settings.fogDensity * 1000).toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                value={settings.fogDensity}
                onChange={(e) => handleChange('fogDensity', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          )}

          {/* Float Animation Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">🎈 Float Animation</span>
            <button
              onClick={() => handleChange('floatEnabled', !settings.floatEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.floatEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.floatEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Particles Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">✨ Ambient Particles</span>
            <button
              onClick={() => handleChange('particlesEnabled', !settings.particlesEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.particlesEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.particlesEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Depth Parallax Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">🌊 Depth Parallax</span>
            <button
              onClick={() => handleChange('depthParallax', !settings.depthParallax)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.depthParallax ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.depthParallax ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Parallax Intensity */}
          {settings.depthParallax && (
            <div className="space-y-2 pl-4 border-l-2 border-emerald-500/30">
              <label className="flex items-center justify-between text-xs text-gray-400">
                <span>Parallax Intensity</span>
                <span className="text-emerald-400">{(settings.parallaxIntensity * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.parallaxIntensity}
                onChange={(e) => handleChange('parallaxIntensity', parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          )}

          {/* Wireframe Toggle */}
          <div className="flex items-center justify-between border-t border-gray-700 pt-3 mt-2">
            <span className="text-xs text-gray-300">🔲 Wireframe</span>
            <button
              onClick={() => handleChange('wireframeEnabled', !settings.wireframeEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.wireframeEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.wireframeEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Wireframe Settings */}
          {settings.wireframeEnabled && (
            <div className="space-y-3 pl-4 border-l-2 border-emerald-500/30">
              {/* Wireframe Mode */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleChange('wireframeMode', 'overlay')}
                    className={`flex-1 py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.wireframeMode === 'overlay'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Overlay
                  </button>
                  <button
                    onClick={() => handleChange('wireframeMode', 'full')}
                    className={`flex-1 py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.wireframeMode === 'full'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Full
                  </button>
                </div>
              </div>

              {/* Wireframe Color */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Color</span>
                  <input
                    type="color"
                    value={settings.wireframeColor}
                    onChange={(e) => handleChange('wireframeColor', e.target.value)}
                    className="w-8 h-6 rounded border border-gray-700 cursor-pointer"
                  />
                </label>
              </div>

              {/* Wireframe Opacity */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Opacity</span>
                  <span className="text-emerald-400">{(settings.wireframeOpacity * 100).toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.wireframeOpacity}
                  onChange={(e) => handleChange('wireframeOpacity', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Wireframe Line Width */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Line Width</span>
                  <span className="text-emerald-400">{settings.wireframeLineWidth.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={settings.wireframeLineWidth}
                  onChange={(e) => handleChange('wireframeLineWidth', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          )}

          {/* Skybox Wireframe Toggle */}
          <div className="flex items-center justify-between border-t border-gray-700 pt-3 mt-2">
            <span className="text-xs text-gray-300">🌐 Skybox Wireframe</span>
            <button
              onClick={() => handleChange('skyboxWireframeEnabled', !settings.skyboxWireframeEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.skyboxWireframeEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.skyboxWireframeEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Skybox Wireframe Settings */}
          {settings.skyboxWireframeEnabled && (
            <div className="space-y-3 pl-4 border-l-2 border-emerald-500/30">
              {/* Mesh Density */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Mesh Density</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleChange('skyboxMeshDensity', 'low')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.skyboxMeshDensity === 'low'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Low
                  </button>
                  <button
                    onClick={() => handleChange('skyboxMeshDensity', 'medium')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.skyboxMeshDensity === 'medium'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => handleChange('skyboxMeshDensity', 'high')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.skyboxMeshDensity === 'high'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    High
                  </button>
                  <button
                    onClick={() => handleChange('skyboxMeshDensity', 'epic')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.skyboxMeshDensity === 'epic'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Epic
                  </button>
                </div>
              </div>

              {/* Skybox Wireframe Color */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Color</span>
                  <input
                    type="color"
                    value={settings.skyboxWireframeColor}
                    onChange={(e) => handleChange('skyboxWireframeColor', e.target.value)}
                    className="w-8 h-6 rounded border border-gray-700 cursor-pointer"
                  />
                </label>
              </div>

              {/* Skybox Wireframe Opacity */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Opacity</span>
                  <span className="text-emerald-400">{(settings.skyboxWireframeOpacity * 100).toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.skyboxWireframeOpacity}
                  onChange={(e) => handleChange('skyboxWireframeOpacity', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          )}

          {/* World Mesh Toggle */}
          <div className="flex items-center justify-between border-t border-gray-700 pt-3 mt-2">
            <span className="text-xs text-gray-300">🌍 World Mesh</span>
            <button
              onClick={() => handleChange('worldMeshEnabled', !settings.worldMeshEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                settings.worldMeshEnabled ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                settings.worldMeshEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* World Mesh Settings */}
          {settings.worldMeshEnabled && (
            <div className="space-y-3 pl-4 border-l-2 border-emerald-500/30">
              <div className="text-[10px] text-gray-500 italic mb-2">
                Creates a 3D mesh from your 360° environment using depth information
              </div>
              
              {/* World Mesh Quality */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleChange('worldMeshQuality', 'low')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.worldMeshQuality === 'low'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Low
                  </button>
                  <button
                    onClick={() => handleChange('worldMeshQuality', 'medium')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.worldMeshQuality === 'medium'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => handleChange('worldMeshQuality', 'high')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.worldMeshQuality === 'high'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    High
                  </button>
                  <button
                    onClick={() => handleChange('worldMeshQuality', 'epic')}
                    className={`py-1.5 px-2 text-xs rounded transition-colors ${
                      settings.worldMeshQuality === 'epic'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    Epic
                  </button>
                </div>
              </div>

              {/* Depth Scale */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Depth Scale</span>
                  <span className="text-emerald-400">{settings.worldMeshDepthScale.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={settings.worldMeshDepthScale}
                  onChange={(e) => handleChange('worldMeshDepthScale', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Smoothness */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Smoothness</span>
                  <span className="text-emerald-400">{settings.worldMeshSmoothness.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={settings.worldMeshSmoothness}
                  onChange={(e) => handleChange('worldMeshSmoothness', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={() => onSettingsChange({
              reflectionStrength: 0.6,
              environmentIntensity: 1.2,
              fogEnabled: false,
              fogDensity: 0.008,
              groundReflection: false,
              groundOpacity: 0.4,
              floatEnabled: false,
              particlesEnabled: false,
              groundFade: true,
              depthParallax: false,
              parallaxIntensity: 0.3,
              wireframeEnabled: false,
              wireframeMode: 'overlay',
              wireframeColor: '#00ff88',
              wireframeOpacity: 0.6,
              wireframeLineWidth: 1,
              skyboxWireframeEnabled: false,
              skyboxMeshDensity: 'medium',
              skyboxWireframeColor: '#00ff88',
              skyboxWireframeOpacity: 0.6,
              worldMeshEnabled: false,
              worldMeshQuality: 'medium',
              worldMeshDepthScale: 1.0,
              worldMeshSmoothness: 1.0
            })}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors border border-gray-700"
          >
            Reset to Defaults
          </button>
          </div>
          </div>
        </div>
      )}
      
      {/* Toggle button - Always visible, positioned on the right side */}
      <button
        onClick={onToggle}
        className={`fixed top-4 z-[10002] px-3 py-2 bg-black/80 hover:bg-black/90 text-white rounded-lg sm:rounded-lg text-xs font-semibold border border-white/20 flex items-center gap-1.5 sm:gap-2 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible 
            ? 'right-[280px] sm:right-[300px] md:right-[320px]' 
            : 'right-4'
        }`}
        title="Toggle blend settings"
      >
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span className="hidden sm:inline">Blend Settings</span>
      </button>
    </>
  );
}

// Main component
export const AssetViewerWithSkybox: React.FC<AssetViewerWithSkyboxProps> = ({
  assetUrl,
  skyboxImageUrl,
  assetFormat = 'glb',
  className = '',
  autoRotate = false,
  autoRotateSpeed = 1,
  onLoad,
  onError
}) => {
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [envTexture, setEnvTexture] = useState<THREE.Texture | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [blendSettings, setBlendSettings] = useState<BlendSettings>({
    reflectionStrength: 0.6,
    environmentIntensity: 1.2,
    fogEnabled: false,
    fogDensity: 0.008,
    groundReflection: false,
    groundOpacity: 0.4,
    floatEnabled: false,
    particlesEnabled: false,
    groundFade: true,
    depthParallax: false,
    parallaxIntensity: 0.3,
    wireframeEnabled: false,
    wireframeMode: 'overlay',
    wireframeColor: '#00ff88',
    wireframeOpacity: 0.6,
    wireframeLineWidth: 1,
    skyboxWireframeEnabled: false,
    skyboxMeshDensity: 'medium',
    skyboxWireframeColor: '#00ff88',
    skyboxWireframeOpacity: 0.6,
    worldMeshEnabled: false,
    worldMeshQuality: 'medium',
    worldMeshDepthScale: 1.0,
    worldMeshSmoothness: 1.0
  });
  
  // Parallax effect for depth (Blockade Labs-style)
  const parallaxRef = useRef<{ mouseX: number; mouseY: number }>({ mouseX: 0, mouseY: 0 });
  
  // Track mouse movement for parallax
  useEffect(() => {
    if (!blendSettings.depthParallax) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = (e.clientY / window.innerHeight) * 2 - 1;
      parallaxRef.current.mouseX = normalizedX * blendSettings.parallaxIntensity;
      parallaxRef.current.mouseY = normalizedY * blendSettings.parallaxIntensity;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [blendSettings.depthParallax, blendSettings.parallaxIntensity]);
  
  // Suppress unused warning
  void assetFormat;
  
  const handleViewerError = useCallback((error: Error) => {
    console.error('❌ Viewer error:', error);
    setViewerError(error.message);
    onError?.(error);
  }, [onError]);

  const handleTextureLoad = useCallback((texture: THREE.Texture) => {
    setEnvTexture(texture);
  }, []);
  
  if (viewerError) {
    return (
      <div className={`relative w-full h-full min-h-[400px] ${className}`}>
        <ViewerErrorFallback error={viewerError} assetUrl={assetUrl} />
      </div>
    );
  }
  
  return (
    <div className={`relative w-full h-full min-h-[400px] ${className} ${showSettings ? 'pr-[280px] sm:pr-[300px] md:pr-[320px]' : ''} transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]`}>
      {/* Blend settings control panel */}
      <BlendControlPanel
        settings={blendSettings}
        onSettingsChange={setBlendSettings}
        isVisible={showSettings}
        onToggle={() => setShowSettings(!showSettings)}
      />


      <Canvas
        camera={{ 
          position: [0, 1, 6], 
          fov: 50,
          near: 0.1,
          far: 2000
        }}
        shadows
        gl={{ 
          antialias: true, 
          alpha: false,
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={<Loader />}>
          {/* World Mesh - 3D mesh from skybox using depth information */}
          {blendSettings.worldMeshEnabled && skyboxImageUrl && (
            <WorldMesh
              skyboxImageUrl={skyboxImageUrl}
              skyboxTexture={envTexture}
              enabled={blendSettings.worldMeshEnabled}
              quality={blendSettings.worldMeshQuality}
              depthScale={blendSettings.worldMeshDepthScale}
              smoothness={blendSettings.worldMeshSmoothness}
            />
          )}
          
          {/* Skybox background with environment texture callback and wireframe */}
          {!blendSettings.worldMeshEnabled && skyboxImageUrl ? (
            <SkyboxSphere 
              imageUrl={skyboxImageUrl} 
              onTextureLoad={handleTextureLoad}
              wireframeEnabled={blendSettings.skyboxWireframeEnabled}
              meshDensity={blendSettings.skyboxMeshDensity}
              wireframeColor={blendSettings.skyboxWireframeColor}
              wireframeOpacity={blendSettings.skyboxWireframeOpacity}
            />
          ) : !blendSettings.worldMeshEnabled ? (
            <>
              <mesh>
                <sphereGeometry args={[500, MESH_DENSITY_PRESETS[blendSettings.skyboxMeshDensity][0], MESH_DENSITY_PRESETS[blendSettings.skyboxMeshDensity][0]]} />
                <meshBasicMaterial color="#050505" side={THREE.BackSide} />
              </mesh>
              {blendSettings.skyboxWireframeEnabled && (
                <SkyboxWireframe
                  enabled={blendSettings.skyboxWireframeEnabled}
                  meshDensity={blendSettings.skyboxMeshDensity}
                  color={blendSettings.skyboxWireframeColor}
                  opacity={blendSettings.skyboxWireframeOpacity}
                />
              )}
            </>
          ) : null}

          {/* Atmospheric effects */}
          <AtmosphericFog 
            enabled={blendSettings.fogEnabled} 
            density={blendSettings.fogDensity}
          />

          {/* Enhanced immersive lighting */}
          <ImmersiveLighting intensity={blendSettings.environmentIntensity} />

          {/* 3D Asset with environment mapping and wireframe */}
          {assetUrl && (
            <AssetModel 
              assetUrl={assetUrl} 
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              envMap={envTexture}
              reflectionStrength={blendSettings.reflectionStrength}
              environmentIntensity={blendSettings.environmentIntensity}
              floatEnabled={blendSettings.floatEnabled}
              wireframeEnabled={blendSettings.wireframeEnabled}
              wireframeMode={blendSettings.wireframeMode}
              wireframeColor={blendSettings.wireframeColor}
              wireframeOpacity={blendSettings.wireframeOpacity}
              wireframeLineWidth={blendSettings.wireframeLineWidth}
              onLoad={onLoad} 
              onError={handleViewerError} 
            />
          )}

          {/* Reflective ground plane */}
          <ReflectiveGround 
            enabled={blendSettings.groundReflection}
            opacity={blendSettings.groundOpacity}
            envMap={envTexture}
            fade={blendSettings.groundFade}
          />

          {/* Contact shadows for grounding */}
          <ContactShadows
            position={[0, -1.99, 0]}
            opacity={0.5}
            scale={20}
            blur={2.5}
            far={10}
            resolution={1024}
            color="#000000"
          />

          {/* Ambient particles */}
          <AmbientParticles enabled={blendSettings.particlesEnabled} />
          
          {/* Parallax camera effect for depth */}
          <ParallaxCamera 
            enabled={blendSettings.depthParallax}
            intensity={blendSettings.parallaxIntensity}
            parallaxRef={parallaxRef}
          />
        </Suspense>

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={30}
          maxPolarAngle={Math.PI * 0.85}
          minPolarAngle={0.1}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed * 0.3}
          dampingFactor={0.05}
          enableDamping={true}
          zoomSpeed={0.8}
          panSpeed={0.5}
          rotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};

export default AssetViewerWithSkybox;
