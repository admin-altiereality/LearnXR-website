/**
 * StudentScreen360Preview – Renders the exact 360° view a student is seeing.
 * Uses Three.js (sphere + camera at hlookat/vlookat/fov) so the teacher sees
 * the same perspective as the student, not a flat crop.
 */

import { useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface StudentViewAngle {
  hlookat: number;
  vlookat: number;
  fov?: number;
}

function SphereWithTexture({ texture }: { texture: THREE.Texture | null }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(500, 32, 16), []);
  const material = useMemo(() => {
    if (!texture) return null;
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      toneMapped: false,
    });
  }, [texture]);
  if (!material) return null;
  return <mesh geometry={geometry} material={material} scale={[-1, 1, 1]} />;
}

function CameraController({
  hlookat,
  vlookat,
  fov,
}: {
  hlookat: number;
  vlookat: number;
  fov: number;
}) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());

  useFrame(() => {
    // Student drag → Krpano view.hlookat / view.vlookat → we show same direction for teacher.
    // Orbit (applyTeacherViewToCamera): pos=(cx,cy,cz) from theta=h*π/180, phi=v*π/180; view dir = -pos.
    // Use view dir (-cx,-cy,-cz). Phi negated so Krpano vlookat+ (look up) = preview up.
    const theta = (hlookat * Math.PI) / 180;
    const phi = (vlookat * Math.PI) / 180;
    const cx = Math.cos(phi) * Math.sin(theta);
    const cy = Math.sin(phi);
    const cz = Math.cos(phi) * Math.cos(theta);
    lookAt.current.set(cx, cy, cz);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(0, 0, 0);
    cam.lookAt(lookAt.current);
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

function Scene({
  texture,
  hlookat,
  vlookat,
  fov,
}: {
  texture: THREE.Texture | null;
  hlookat: number;
  vlookat: number;
  fov: number;
}) {
  return (
    <>
      <SphereWithTexture texture={texture} />
      <CameraController hlookat={hlookat} vlookat={vlookat} fov={fov} />
    </>
  );
}

export interface StudentScreen360PreviewProps {
  skyboxUrl: string;
  view: StudentViewAngle;
  studentName: string;
  phaseLabel: string;
  getApiBaseUrl: () => string;
  className?: string;
}

export function StudentScreen360Preview({
  skyboxUrl,
  view,
  studentName,
  phaseLabel,
  getApiBaseUrl,
  className = '',
}: StudentScreen360PreviewProps) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const h = view.hlookat ?? 0;
  const v = view.vlookat ?? 0;
  const fov = view.fov ?? 90;

  const imgSrc = useMemo(() => {
    const isFirebase =
      skyboxUrl.includes('firebasestorage.googleapis.com') ||
      skyboxUrl.includes('firebasestorage.app');
    return isFirebase
      ? skyboxUrl
      : `${getApiBaseUrl().replace(/\/$/, '')}/proxy-asset?url=${encodeURIComponent(skyboxUrl)}`;
  }, [skyboxUrl, getApiBaseUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!imgSrc) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setTexture(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!mountedRef.current) return;
      const tex = new THREE.Texture(img);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1;
      tex.needsUpdate = true;
      setTexture(tex);
      setLoading(false);
    };
    img.onerror = () => {
      if (mountedRef.current) setLoading(false);
    };
    img.src = imgSrc;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imgSrc]);

  useEffect(() => {
    return () => {
      if (texture) texture.dispose();
    };
  }, [texture]);

  return (
    <div
      className={`rounded-xl overflow-hidden border border-border bg-muted/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all ${className}`}
      title={`${studentName} — ${phaseLabel}`}
    >
      <div className="relative w-full aspect-video bg-muted/50">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-xs">Loading view…</div>
          </div>
          
        ) : (
          <Canvas
            camera={{ position: [0, 0, 0], fov: 90, near: 0.1, far: 1000 }}
            gl={{ antialias: true, alpha: false }}
            frameloop="always"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <Suspense fallback={null}>
              <Scene texture={texture} hlookat={h} vlookat={v} fov={fov} />
            </Suspense>
          </Canvas>
        )}
      </div>
      <div className="px-3 py-2 bg-card/80 border-t border-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{studentName}</p>
          <p className="text-xs text-muted-foreground truncate">{phaseLabel}</p>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
          h {Math.round(h)}° v {Math.round(v)}°
        </span>
      </div>
    </div>
  );
}
