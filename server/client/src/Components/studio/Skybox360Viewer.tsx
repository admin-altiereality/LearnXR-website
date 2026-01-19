/**
 * Skybox360Viewer - Fast 360° Equirectangular Skybox Viewer
 * 
 * Optimized for fast loading with:
 * - Image preloading before Three.js render
 * - Lower polygon sphere geometry
 * - Efficient texture handling
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface SkyboxSphereProps {
  texture: THREE.Texture | null;
}

// Optimized sphere component - only renders when texture is ready
function SkyboxSphere({ texture }: SkyboxSphereProps) {
  const geometry = useMemo(() => {
    // Lower segment count for faster rendering (32x16 is plenty for 360°)
    return new THREE.SphereGeometry(500, 32, 16);
  }, []);
  
  const material = useMemo(() => {
    if (!texture) return null;
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      toneMapped: false,
    });
  }, [texture]);
  
  if (!material) return null;
  
  return (
    <mesh geometry={geometry} material={material} scale={[-1, 1, 1]} />
  );
}

interface Skybox360ViewerProps {
  imageUrl: string;
  className?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  initialFov?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export const Skybox360Viewer = ({
  imageUrl,
  className = '',
  autoRotate = true,
  autoRotateSpeed = 0.3,
  enableZoom = true,
  initialFov = 75,
  onLoad,
  onError,
}: Skybox360ViewerProps) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const loaderRef = useRef<THREE.TextureLoader | null>(null);
  const mountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Load texture using native Image + TextureLoader for better control
  useEffect(() => {
    if (!imageUrl) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    setLoadProgress(0);
    setTexture(null);
    
    // First, preload the image using native Image API (faster)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const handleLoad = () => {
      if (!mountedRef.current) return;
      
      setLoadProgress(80);
      
      // Create texture from preloaded image
      const tex = new THREE.Texture(img);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1; // Flip horizontally for correct orientation
      tex.needsUpdate = true;
      
      // Small delay to ensure texture is fully processed
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        setTexture(tex);
        setLoading(false);
        setLoadProgress(100);
        onLoad?.();
      });
    };
    
    const handleError = () => {
      if (!mountedRef.current) return;
      setError('Failed to load image');
      setLoading(false);
      onError?.(new Error('Failed to load skybox image'));
    };
    
    const handleProgress = (e: ProgressEvent) => {
      if (e.lengthComputable && mountedRef.current) {
        const percent = Math.round((e.loaded / e.total) * 70);
        setLoadProgress(percent);
      }
    };
    
    img.onload = handleLoad;
    img.onerror = handleError;
    
    // Start loading - add cache buster if needed
    setLoadProgress(10);
    img.src = imageUrl;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, onLoad, onError]);
  
  if (!imageUrl) {
    return (
      <div className={`bg-slate-900 flex items-center justify-center ${className}`}>
        <p className="text-slate-500">No skybox image</p>
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Loading overlay with progress */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#050810]">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              {/* Background circle */}
              <div className="absolute inset-0 rounded-full border-4 border-slate-700/50" />
              {/* Progress circle */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="url(#loadGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${loadProgress * 1.76} 176`}
                  className="transition-all duration-200"
                />
                <defs>
                  <linearGradient id="loadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Percentage text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-cyan-400">{loadProgress}%</span>
              </div>
            </div>
            <p className="text-sm text-slate-400">Loading 360° environment...</p>
          </div>
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-900/20">
          <div className="text-center p-6 bg-black/60 rounded-2xl border border-red-500/30 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-400 font-medium mb-1">Failed to load skybox</p>
            <p className="text-sm text-red-300/70">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Three.js Canvas - Only mount when texture is ready */}
      {texture && (
        <Canvas
          camera={{
            position: [0, 0, 0.1],
            fov: initialFov,
            near: 0.1,
            far: 1000,
          }}
          gl={{
            antialias: false, // Disable for performance
            powerPreference: 'high-performance',
            toneMapping: THREE.NoToneMapping, // Simpler tone mapping
          }}
          className="!absolute inset-0"
          style={{ background: '#050810' }}
          frameloop="demand" // Only render on demand for performance
        >
          <SkyboxSphere texture={texture} />
          
          <OrbitControls
            enableZoom={enableZoom}
            enablePan={false}
            enableDamping
            dampingFactor={0.1}
            rotateSpeed={-0.4}
            minDistance={0.1}
            maxDistance={100}
            minPolarAngle={Math.PI * 0.05}
            maxPolarAngle={Math.PI * 0.95}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
          />
        </Canvas>
      )}
      
      {/* Interaction hint */}
      {texture && !loading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none opacity-0 animate-fadeIn" style={{ animationDelay: '1s', animationFillMode: 'forwards' }}>
          <div className="px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white/60 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Drag to look around
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Skybox360Viewer;
