/**
 * Live, freely-explorable Street View panorama viewer used by the Street View
 * Tour authoring screen. Renders the stitched equirectangular skybox on a
 * sphere and lets the author look around with mouse/touch drag, keyboard
 * arrows, or a gamepad, and "walk" to a linked neighboring panorama by
 * clicking a directional arrow — mirroring the interaction patterns in
 * StreetVision (Apple Vision Pro) and OculusStreetView (Oculus Rift).
 *
 * This authoring-time viewer intentionally uses plain three.js (not krpano):
 * the classroom playback experience continues to use the existing krpano
 * player (`VRLessonPlayerKrpano.tsx`) for its proven WebVR/gyro support.
 */

import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { Loader2, Navigation } from 'lucide-react';

export interface PanoramaLink {
  panoId: string;
  heading: number;
  text?: string;
}

export interface PanoAssetPreview {
  id: string;
  ath: number;
  atv: number;
  depth?: number;
}

export interface StreetViewPanoramaViewerProps {
  skyboxUrl: string | null;
  links: PanoramaLink[];
  loading?: boolean;
  /** Assets already placed on the current stop; rendered as simple markers for visual feedback. */
  assets?: PanoAssetPreview[];
  /** Fired when the author clicks a directional arrow to walk to a linked panorama. */
  onWalk: (panoId: string) => void;
  /** Fired (throttled) whenever the current look-at direction changes; used for "place here" actions. */
  onViewChange?: (heading: number, pitch: number) => void;
  className?: string;
}

/** Converts a compass heading (0-360, clockwise from North) + pitch into a unit direction vector.
 * Assumes the stitched equirectangular image is north-up (standard Street View convention):
 * heading 0 faces -Z, heading 90 faces +X. */
function headingToDirection(headingDeg: number, pitchDeg: number): THREE.Vector3 {
  const h = THREE.MathUtils.degToRad(headingDeg);
  const p = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(Math.sin(h) * Math.cos(p), Math.sin(p), -Math.cos(h) * Math.cos(p));
}

function normalizeHeading(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function StreetViewPanoramaViewer({
  skyboxUrl,
  links,
  loading,
  assets = [],
  onWalk,
  onViewChange,
  className = '',
}: StreetViewPanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const assetGroupRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const linksRef = useRef<PanoramaLink[]>(links);
  const onWalkRef = useRef(onWalk);
  const onViewChangeRef = useRef(onViewChange);
  const [vrSupported, setVrSupported] = useState(false);

  linksRef.current = links;
  onWalkRef.current = onWalk;
  onViewChangeRef.current = onViewChange;

  // One-time scene/renderer/animation-loop setup.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.xr.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    if (typeof navigator !== 'undefined' && (navigator as any).xr) {
      (navigator as any).xr
        .isSessionSupported('immersive-vr')
        .then((supported: boolean) => {
          setVrSupported(supported);
          if (supported) {
            const vrButton = VRButton.createButton(renderer);
            vrButton.style.position = 'absolute';
            vrButton.style.bottom = '16px';
            vrButton.style.right = '16px';
            container.appendChild(vrButton);
          }
        })
        .catch(() => setVrSupported(false));
    }

    const arrowGroup = new THREE.Group();
    scene.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;

    const assetGroup = new THREE.Group();
    scene.add(assetGroup);
    assetGroupRef.current = assetGroup;

    let raf = 0;
    const clock = new THREE.Clock();
    const gamepadCooldownRef = { current: 0 };

    const applyLookAt = () => {
      const dir = headingToDirection(yawRef.current, pitchRef.current);
      camera.lookAt(camera.position.clone().add(dir));
      // Keep arrows/asset markers upright and facing the camera roughly.
    };

    const findClosestLink = (): PanoramaLink | null => {
      const current = linksRef.current;
      if (!current.length) return null;
      let best: PanoramaLink | null = null;
      let bestDelta = Infinity;
      for (const link of current) {
        let delta = Math.abs(normalizeHeading(link.heading) - normalizeHeading(yawRef.current));
        if (delta > 180) delta = 360 - delta;
        if (delta < bestDelta) {
          bestDelta = delta;
          best = link;
        }
      }
      return bestDelta < 60 ? best : null;
    };

    const pollGamepad = (dt: number) => {
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads && pads[0];
      if (!pad) return;
      const axisX = pad.axes[0] || 0;
      const axisY = pad.axes[1] || 0;
      const deadzone = 0.15;
      if (Math.abs(axisX) > deadzone) yawRef.current += axisX * 90 * dt;
      if (Math.abs(axisY) > deadzone) pitchRef.current = THREE.MathUtils.clamp(pitchRef.current + axisY * 60 * dt, -85, 85);
      const now = performance.now();
      if (pad.buttons[0]?.pressed && now - gamepadCooldownRef.current > 800) {
        gamepadCooldownRef.current = now;
        const link = findClosestLink();
        if (link) onWalkRef.current(link.panoId);
      }
    };

    const animate = () => {
      const dt = Math.min(0.1, clock.getDelta());
      pollGamepad(dt);
      applyLookAt();
      onViewChangeRef.current?.(normalizeHeading(yawRef.current), pitchRef.current);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Drag-to-look (mouse + touch): grab-the-world metaphor, matching the krpano classroom player.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const DRAG_SENS = 0.15;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yawRef.current -= dx * DRAG_SENS;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current + dy * DRAG_SENS, -85, 85);
    };
    const onPointerUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Keyboard arrows, matching OculusStreetView's keyboard look-around.
    const KEY_STEP = 4;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') yawRef.current -= KEY_STEP;
      else if (e.key === 'ArrowRight') yawRef.current += KEY_STEP;
      else if (e.key === 'ArrowUp') pitchRef.current = THREE.MathUtils.clamp(pitchRef.current + KEY_STEP, -85, 85);
      else if (e.key === 'ArrowDown') pitchRef.current = THREE.MathUtils.clamp(pitchRef.current - KEY_STEP, -85, 85);
      else if (e.key === 'Enter') {
        const link = findClosestLink();
        if (link) onWalkRef.current(link.panoId);
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load/replace the skybox texture whenever the URL changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !skyboxUrl) return;

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    let disposed = false;
    loader.load(skyboxUrl, (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.SphereGeometry(50, 64, 40);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const sphere = new THREE.Mesh(geometry, material);
      if (sphereRef.current) {
        scene.remove(sphereRef.current);
        sphereRef.current.geometry.dispose();
        (sphereRef.current.material as THREE.Material).dispose();
      }
      scene.add(sphere);
      sphereRef.current = sphere;
    });

    return () => {
      disposed = true;
    };
  }, [skyboxUrl]);

  // Rebuild directional "walk" arrow hotspots whenever the link set changes.
  useEffect(() => {
    const group = arrowGroupRef.current;
    if (!group) return;
    group.clear();
    const arrowGeometry = new THREE.ConeGeometry(1.2, 2.4, 12);
    for (const link of links) {
      const material = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const arrow = new THREE.Mesh(arrowGeometry, material);
      const dir = headingToDirection(link.heading, -10);
      arrow.position.copy(dir.clone().multiplyScalar(15));
      arrow.lookAt(dir.clone().multiplyScalar(30));
      arrow.rotateX(Math.PI / 2);
      arrow.userData.panoId = link.panoId;
      group.add(arrow);
    }
  }, [links]);

  // Preview markers for already-placed floating assets on the current stop.
  useEffect(() => {
    const group = assetGroupRef.current;
    if (!group) return;
    group.clear();
    const markerGeometry = new THREE.IcosahedronGeometry(0.8, 0);
    for (const asset of assets) {
      const material = new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true });
      const marker = new THREE.Mesh(markerGeometry, material);
      const dir = headingToDirection(asset.ath, asset.atv);
      marker.position.copy(dir.clone().multiplyScalar((asset.depth ?? 500) / 100));
      group.add(marker);
    }
  }, [assets]);

  // Click handling for arrow hotspots (raycast).
  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const group = arrowGroupRef.current;
    if (!renderer || !camera || !group) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(group.children, false);
    if (hits.length > 0) {
      const panoId = hits[0].object.userData.panoId;
      if (panoId) onWalk(panoId);
    }
  }, [onWalk]);

  return (
    <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" onClick={handleClick} />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}
      {!loading && links.length > 0 && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 text-xs text-white/80 bg-black/40 rounded-full px-3 py-1">
          <Navigation className="w-3 h-3" />
          {links.length} walkable direction{links.length > 1 ? 's' : ''} — click an arrow, or press Enter
        </div>
      )}
      {vrSupported && (
        <div className="absolute top-3 right-3 text-xs text-white/70 bg-black/40 rounded-full px-3 py-1">VR headset ready</div>
      )}
    </div>
  );
}
