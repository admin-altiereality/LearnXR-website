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
import { getProxyAssetUrl } from '../utils/apiConfig';

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
        color="#ffffff"
        metalness={0.8}
        mirror={0.3}
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
        // Validate that we have a URL
        if (!assetUrl || assetUrl.trim() === '') {
          throw new Error('No asset URL provided. Please check the asset configuration.');
        }
        
        if (!loaderRef.current) {
          const gltfLoader = new GLTFLoader();
          const dracoLoader = new DRACOLoader();
          dracoLoader.setDecoderPath('/draco/');
          gltfLoader.setDRACOLoader(dracoLoader);
          loaderRef.current = { gltfLoader, dracoLoader };
        }

        // Validate URL - check if it looks like a 3D model file
        const urlLower = assetUrl.toLowerCase();
        const hasGlbExtension = urlLower.includes('.glb') || urlLower.includes('.gltf');
        
        // Extract file extension from URL (before query params)
        const urlWithoutParams = assetUrl.split('?')[0].split('#')[0];
        const fileExtension = urlWithoutParams.substring(urlWithoutParams.lastIndexOf('.')).toLowerCase();
        
        console.log('🔍 Validating asset URL:', {
          url: assetUrl.substring(0, 100) + '...',
          extension: fileExtension,
          hasGlbExtension,
          isFirebaseStorage: assetUrl.includes('firebasestorage'),
        });
        
        // Check for image file extensions
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        if (imageExtensions.some(ext => fileExtension === ext || urlLower.includes(ext))) {
          throw new Error(`Invalid file type: URL points to an image file (${fileExtension}), not a 3D model. Please check the asset configuration and ensure the GLB file URL is correct.`);
        }
        
        // Check for other 3D formats that GLTFLoader might not support directly
        if (fileExtension === '.fbx' || fileExtension === '.obj') {
          console.warn('⚠️ URL points to FBX/OBJ file - GLTFLoader may not support this format:', fileExtension);
          // Continue anyway - might work with some loaders
        }
        
        if (!hasGlbExtension && !assetUrl.includes('proxy-asset')) {
          console.warn('⚠️ URL does not contain .glb/.gltf extension:', assetUrl.substring(0, 100));
          // Don't throw error yet - let GLTFLoader try to load it
        }
        
        // Check if this is a Firebase Storage URL - use directly (no proxy needed)
        const isFirebaseStorageUrl = assetUrl.includes('firebasestorage.googleapis.com') || 
                                    assetUrl.includes('firebasestorage.app');
        
        let finalUrl = assetUrl;
        
        if (!isFirebaseStorageUrl) {
          // Only use proxy for external URLs (like Meshy.ai)
          finalUrl = getProxyAssetUrl(assetUrl);
          console.log('🔄 Loading 3D asset via proxy (external URL):', finalUrl);
        } else {
          console.log('✅ Loading 3D asset directly from Firebase Storage:', assetUrl);
          
          // Verify file type by checking Content-Type header (for Firebase Storage URLs)
          try {
            const headResponse = await fetch(assetUrl, { method: 'HEAD' });
            const contentType = headResponse.headers.get('content-type') || '';
            const contentLength = headResponse.headers.get('content-length');
            
            console.log('📋 File verification:', {
              contentType,
              contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'unknown',
              url: assetUrl.substring(0, 100) + '...',
            });
            
            // Check if it's an image (should not be)
            const isImageType = contentType.includes('image/');
            
            if (isImageType) {
              throw new Error(`File type mismatch: URL points to an image file (${contentType}), not a 3D model. The asset may have been incorrectly uploaded. Please re-upload the GLB file.`);
            }
            
            // Check if it's actually a 3D model file
            const is3DModelType = contentType.includes('model/gltf') || 
                                 contentType.includes('model/gltf-binary') ||
                                 contentType.includes('application/octet-stream') ||
                                 contentType.includes('model/');
            
            if (!is3DModelType && !contentType.includes('octet-stream')) {
              console.warn('⚠️ Unexpected Content-Type for 3D model:', contentType);
              // Don't throw error - might still work
            } else {
              console.log('✅ File type verified as 3D model');
            }
            
            // Check file size if available
            if (contentLength) {
              const sizeMB = parseInt(contentLength) / 1024 / 1024;
              if (sizeMB > 50) {
                console.warn(`⚠️ Large file size: ${sizeMB.toFixed(2)} MB - may take time to load`);
              }
            }
          } catch (headError) {
            // If HEAD request fails, continue anyway - might be CORS or other issue
            console.warn('⚠️ Could not verify file type via HEAD request:', headError);
            // Try to get more info from the error
            if (headError instanceof Error && headError.message.includes('image')) {
              throw headError; // Re-throw if it's an image error
            }
          }
        }
        
        // Estimate file size and set appropriate timeout
        let loadTimeout = 120000; // Default 2 minutes
        try {
          const headResponse = await fetch(finalUrl, { method: 'HEAD' });
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength) {
            const sizeMB = parseInt(contentLength) / 1024 / 1024;
            // Increase timeout for larger files: 1 minute per 10MB, minimum 2 minutes, maximum 10 minutes
            loadTimeout = Math.max(120000, Math.min(600000, 60000 + (sizeMB * 10000)));
            console.log(`⏱️ File size: ${sizeMB.toFixed(2)} MB, timeout set to ${(loadTimeout / 1000).toFixed(0)} seconds`);
          }
        } catch (sizeError) {
          console.warn('⚠️ Could not determine file size, using default timeout');
        }
        
        const loadedGltf = await new Promise<any>((resolve, reject) => {
          // Add timeout to prevent hanging (based on file size)
          const timeout = setTimeout(() => {
            reject(new Error(`Model loading timeout after ${(loadTimeout / 1000).toFixed(0)} seconds. The file may be too large, the network connection may be slow, or the URL may be invalid. Please check your internet connection and try again.`));
          }, loadTimeout);
          
          // Track loading progress
          let lastProgress = 0;
          
          loaderRef.current!.gltfLoader.load(
            finalUrl,
            (gltf) => {
              clearTimeout(timeout);
              console.log('✅ 3D model loaded successfully');
              resolve(gltf);
            },
            (progress) => {
              // Update progress
              if (progress.total > 0) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                if (percent !== lastProgress && percent % 10 === 0) {
                  console.log(`📥 Loading progress: ${percent}% (${(progress.loaded / 1024 / 1024).toFixed(2)} MB / ${(progress.total / 1024 / 1024).toFixed(2)} MB)`);
                  lastProgress = percent;
                }
              }
            },
            (error) => {
              clearTimeout(timeout);
              console.error('❌ GLTFLoader error:', error);
              
              // Enhance error message
              let enhancedError = error;
              if (error instanceof Error) {
                const message = error.message || '';
                
                // Check for JSON parsing errors (usually means wrong file type)
                if (message.includes('JSON') || message.includes('Unexpected token') || message.includes('JFIF')) {
                  // Check if URL might be pointing to wrong file type
                  const urlLower = finalUrl.toLowerCase();
                  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || message.includes('JFIF')) {
                    enhancedError = new Error('Invalid file type: The URL points to an image file (JPEG/PNG) instead of a 3D model (GLB/GLTF). This usually means the wrong file was uploaded or the asset configuration is incorrect. Please re-upload the correct GLB file.');
                  } else {
                    enhancedError = new Error(`Invalid file format: The file at this URL is not a valid GLB/GLTF file. The file may be corrupted, the wrong file type, or the URL may be incorrect. Please verify the asset was uploaded correctly.`);
                  }
                } else if (message.includes('404') || message.includes('Not Found')) {
                  enhancedError = new Error(`File not found: The 3D model file could not be located. The file may have been deleted or the URL is incorrect. Please check the asset configuration.`);
                } else if (message.includes('403') || message.includes('Forbidden')) {
                  enhancedError = new Error('Access denied: You do not have permission to access this file. Please check Firebase Storage rules and ensure you are authenticated.');
                } else if (message.includes('timeout') || message.includes('Timeout')) {
                  enhancedError = new Error(`Loading timeout: The file took too long to load (${(loadTimeout / 1000).toFixed(0)} seconds). This may be due to a large file size, slow network connection, or server issues. Please try again or check your internet connection.`);
                } else if (message.includes('network') || message.includes('Network')) {
                  enhancedError = new Error('Network error: Failed to load the 3D model due to a network issue. Please check your internet connection and try again.');
                } else if (message.includes('CORS')) {
                  enhancedError = new Error('CORS error: The file cannot be loaded due to cross-origin restrictions. Please check the Firebase Storage configuration.');
                }
              }
              reject(enhancedError);
            }
          );
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
        let errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        // Check if error is about JSON parsing (suggests wrong file type or error response)
        if (errorMessage.includes('JSON') || errorMessage.includes('Unexpected token')) {
          console.error('⚠️ JSON parsing error - file might not be a valid GLB/GLTF or URL returned wrong content type');
          errorMessage = 'Invalid file format. Expected GLB/GLTF file, but received different content. Please check the file URL.';
        }
        
        // Check if it's a 403 error and the URL is from Meshy
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          if (assetUrl.includes('assets.meshy.ai')) {
            console.log('🔄 Detected 403 error for Meshy URL, attempting to refresh...');
            try {
              const { meshyApiService } = await import('../services/meshyApiService');
              const refreshedUrl = await meshyApiService.refreshMeshyUrl(assetUrl);
              
              if (refreshedUrl) {
                console.log('✅ Got refreshed URL, retrying load...');
                // Retry with refreshed URL - check if it's Firebase Storage or external
                const isFirebaseStorageUrl = refreshedUrl.includes('firebasestorage.googleapis.com') || 
                                            refreshedUrl.includes('firebasestorage.app');
                
                let finalUrl = refreshedUrl;
                if (!isFirebaseStorageUrl) {
                  finalUrl = getProxyAssetUrl(refreshedUrl);
                }
                
                const loadedGltf = await new Promise<any>((resolve, reject) => {
                  loaderRef.current!.gltfLoader.load(finalUrl, resolve, undefined, reject);
                });

                // Optimize the model for immersive rendering
                loadedGltf.scene.traverse((child: THREE.Object3D) => {
                  if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                      child.material.needsUpdate = true;
                      child.material.side = THREE.DoubleSide;
                      
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
                return; // Success, exit early
              }
            } catch (refreshError) {
              console.error('❌ Failed to refresh Meshy URL:', refreshError);
            }
          }
        }
        
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
  const [blendSettings] = useState<BlendSettings>({
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
    <div className={`relative w-full h-full min-h-[400px] ${className} transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]`}>


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
                <meshBasicMaterial color="transparent" side={THREE.BackSide} transparent />
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
