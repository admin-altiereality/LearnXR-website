/**
 * VR Scene Manager - Three.js Scene Lifecycle Management
 * 
 * Following Meta Project Flowerbed patterns for:
 * - Scene setup and lighting
 * - GLB skybox loading (as environment sphere)
 * - Asset loading and placement
 * - Performance optimization for Quest
 * 
 * SCENE LAYOUT:
 * - Skybox: Large sphere (radius ~100m) centered at origin
 * - Camera: At origin (0, 1.6, 0) - eye height inside skybox
 * - Ground plane: Flat circle at y=0, inside skybox
 * - 3D Assets: Floating in front of user at eye level (1.0-2.0m height)
 * - UI Panels: Positioned around user within comfortable viewing distance
 * 
 * @see https://github.com/meta-quest/ProjectFlowerbed
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { XRManager } from './xrManager';
import { getApiBaseUrl } from '../utils/apiConfig';

// ============================================================================
// SCENE CONSTANTS - All objects positioned relative to camera at origin
// ============================================================================

const SCENE_CONSTANTS = {
  // Camera position (user's eye height)
  CAMERA_HEIGHT: 1.6,  // meters
  
  // Skybox configuration
  SKYBOX_RADIUS: 100,  // meters - large enough to encompass everything
  
  // Ground plane
  GROUND_RADIUS: 15,   // meters - circular ground plane
  GROUND_Y: 0,         // At floor level
  
  // 3D Assets placement (inside skybox, in front of user)
  ASSET_DISTANCE: 2.5,     // meters from camera
  ASSET_HEIGHT_MIN: 1.0,   // minimum height
  ASSET_HEIGHT_MAX: 1.8,   // maximum height  
  ASSET_TARGET_SIZE: 0.5,  // target max dimension in meters
  ASSET_SPREAD_ANGLE: 0.5, // radians between assets
  
  // UI Panel distances (comfortable reading distance)
  UI_DISTANCE: 2.0,  // meters from camera
};

// ============================================================================
// URL Proxy Helper (for CORS-blocked assets like meshy.ai)
// ============================================================================

/**
 * Get a proxied URL for CORS-blocked assets
 * Uses the Firebase Functions proxy endpoint
 */
function getProxiedUrl(url: string): string {
  // Check if URL needs proxying (meshy.ai assets don't have CORS headers)
  if (url.includes('assets.meshy.ai') || url.includes('meshy.ai')) {
    const apiBaseUrl = getApiBaseUrl();
    const proxiedUrl = `${apiBaseUrl}/proxy-asset?url=${encodeURIComponent(url)}`;
    console.log('[VRSceneManager] Using proxy for URL:', url.substring(0, 60) + '...');
    return proxiedUrl;
  }
  return url;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface LessonContent {
  chapter: {
    chapter_id: string;
    chapter_name: string;
    chapter_number: number;
    curriculum: string;
    class_name: string;
    subject: string;
  };
  topic: {
    topic_id: string;
    topic_name: string;
    learning_objective: string;
    skybox_url?: string;
    skybox_glb_url?: string;
    asset_urls?: string[];
    avatar_intro?: string;
    avatar_explanation?: string;
    avatar_outro?: string;
    tts_audio_url?: string;
  };
  image3dasset?: {
    imagemodel_glb?: string;
    imageasset_url?: string;
  };
}

export interface LoadingProgress {
  stage: 'initializing' | 'skybox' | 'assets' | 'ui' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export interface SceneConfig {
  enableShadows?: boolean;
  ambientLightIntensity?: number;
  directionalLightIntensity?: number;
  backgroundColor?: number;
  groundPlane?: boolean;
}

// ============================================================================
// VR Scene Manager Class
// ============================================================================

export class VRSceneManager {
  // Core Three.js objects
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  
  // Loaders
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private audioLoader: THREE.AudioLoader;
  
  // Scene objects
  private skyboxMesh: THREE.Mesh | THREE.Group | null = null;
  private loadedAssets: Map<string, THREE.Object3D> = new Map();
  private groundPlane: THREE.Mesh | null = null;
  private lights: THREE.Light[] = [];
  
  // State
  private isInitialized = false;
  private loadingProgress: LoadingProgress = {
    stage: 'initializing',
    progress: 0,
    message: 'Initializing...',
  };
  
  // Callbacks
  private onProgressCallbacks: ((progress: LoadingProgress) => void)[] = [];
  
  // Config
  private config: SceneConfig = {
    enableShadows: false, // Disabled for Quest performance
    ambientLightIntensity: 0.7,
    directionalLightIntensity: 0.8,
    backgroundColor: 0x1a1a2e,
    groundPlane: true,
  };
  
  constructor(config?: Partial<SceneConfig>) {
    // Merge config
    this.config = { ...this.config, ...config };
    
    // Create scene - no background color, skybox will provide the environment
    this.scene = new THREE.Scene();
    this.scene.background = null; // Will be filled by skybox
    
    // Create camera at CENTER of skybox sphere (eye height above ground)
    // All content (ground, assets, UI) is placed INSIDE the skybox sphere
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, SCENE_CONSTANTS.SKYBOX_RADIUS * 2);
    this.camera.position.set(0, SCENE_CONSTANTS.CAMERA_HEIGHT, 0);
    
    console.log(`[VRSceneManager] Camera at center: (0, ${SCENE_CONSTANTS.CAMERA_HEIGHT}, 0)`);
    
    // Setup loaders
    this.gltfLoader = new GLTFLoader();
    
    // Setup DRACO decoder for compressed GLB files
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
    
    this.textureLoader = new THREE.TextureLoader();
    this.audioLoader = new THREE.AudioLoader();
    
    console.log('[VRSceneManager] Created - Scene layout:');
    console.log(`  - Skybox radius: ${SCENE_CONSTANTS.SKYBOX_RADIUS}m`);
    console.log(`  - Ground radius: ${SCENE_CONSTANTS.GROUND_RADIUS}m at y=${SCENE_CONSTANTS.GROUND_Y}`);
    console.log(`  - Assets at ${SCENE_CONSTANTS.ASSET_DISTANCE}m distance, height ${SCENE_CONSTANTS.ASSET_HEIGHT_MIN}-${SCENE_CONSTANTS.ASSET_HEIGHT_MAX}m`);
  }
  
  // ============================================================================
  // Initialization
  // ============================================================================
  
  initialize(container: HTMLElement): THREE.WebGLRenderer {
    if (this.isInitialized && this.renderer) {
      return this.renderer;
    }
    
    // Create WebGL renderer with Quest-optimized settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false, // Disable for performance
    });
    
    // Quest-optimized settings
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Enable XR
    this.renderer.xr.enabled = true;
    
    // Shadows (disabled for performance)
    if (this.config.enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    // Append to container
    container.appendChild(this.renderer.domElement);
    
    // Setup lighting
    this.setupLighting();
    
    // Setup ground plane
    if (this.config.groundPlane) {
      this.setupGroundPlane();
    }
    
    // Handle resize
    const handleResize = () => {
      if (!this.renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);
    
    this.isInitialized = true;
    console.log('[VRSceneManager] Initialized');
    
    return this.renderer;
  }
  
  // ============================================================================
  // Lighting Setup (Flowerbed Pattern)
  // ============================================================================
  
  private setupLighting(): void {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, this.config.ambientLightIntensity);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);
    
    // Main directional light (sun-like)
    const directionalLight = new THREE.DirectionalLight(0xffffff, this.config.directionalLightIntensity);
    directionalLight.position.set(5, 10, 5);
    
    if (this.config.enableShadows) {
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
    }
    
    this.scene.add(directionalLight);
    this.lights.push(directionalLight);
    
    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
    this.lights.push(fillLight);
    
    // Hemisphere light for natural sky-ground gradient
    const hemiLight = new THREE.HemisphereLight(0xffeeb1, 0x080820, 0.4);
    this.scene.add(hemiLight);
    this.lights.push(hemiLight);
    
    console.log('[VRSceneManager] Lighting setup complete');
  }
  
  // ============================================================================
  // Ground Plane
  // ============================================================================
  
  private setupGroundPlane(): void {
    // Ground plane is INSIDE the skybox sphere, at floor level
    const geometry = new THREE.CircleGeometry(SCENE_CONSTANTS.GROUND_RADIUS, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2a2a4a,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.3, // Semi-transparent so skybox shows through a bit
    });
    
    this.groundPlane = new THREE.Mesh(geometry, material);
    this.groundPlane.rotation.x = -Math.PI / 2; // Lay flat
    this.groundPlane.position.y = SCENE_CONSTANTS.GROUND_Y; // At floor level inside skybox
    this.groundPlane.receiveShadow = true;
    this.groundPlane.name = 'ground-plane';
    this.groundPlane.renderOrder = 1; // Render after skybox
    
    this.scene.add(this.groundPlane);
    console.log(`[VRSceneManager] Ground plane added: radius=${SCENE_CONSTANTS.GROUND_RADIUS}m at y=${SCENE_CONSTANTS.GROUND_Y}`);
  }
  
  // ============================================================================
  // Skybox Loading (GLB as Environment Sphere)
  // ============================================================================
  
  async loadSkybox(url: string): Promise<void> {
    this.updateProgress('skybox', 20, 'Loading 360° environment...');
    
    if (!url) {
      console.warn('[VRSceneManager] No skybox URL provided, using fallback');
      this.createFallbackSkybox();
      return;
    }
    
    // Detect if URL is a GLB/GLTF file
    // Check for:
    // 1. Explicit .glb/.gltf extension
    // 2. Meshy.ai URLs (which serve GLB files but without extension in URL)
    // 3. Firebase Storage URLs with .glb
    // 4. Content-type hint in URL (rare but possible)
    const urlLower = url.toLowerCase();
    const isExplicitGLB = urlLower.includes('.glb') || urlLower.includes('.gltf');
    const isMeshyUrl = url.includes('meshy.ai') || url.includes('assets.meshy');
    const isFirebaseStorageGLB = url.includes('firebasestorage') && urlLower.includes('.glb');
    const isGoogleStorageGLB = url.includes('storage.googleapis.com') && urlLower.includes('.glb');
    const isImageUrl = urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
                       urlLower.includes('.png') || urlLower.includes('.webp') ||
                       urlLower.includes('.hdr') || urlLower.includes('.exr');
    
    // GLB detection: explicit extension, or Meshy URLs without image extension, or Firebase/Google Storage GLB
    const isGLB = isExplicitGLB || isFirebaseStorageGLB || isGoogleStorageGLB || (isMeshyUrl && !isImageUrl);
    
    console.log('[VRSceneManager] Skybox URL analysis:', {
      url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
      isExplicitGLB,
      isMeshyUrl,
      isFirebaseStorageGLB,
      isGoogleStorageGLB,
      isImageUrl,
      treatingAsGLB: isGLB
    });
    
    try {
      if (isGLB) {
        // Load GLB skybox (e.g., from Blockade Labs)
        console.log('[VRSceneManager] Loading as GLB skybox...');
        const gltf = await this.loadGLTF(url);
        
        // Log what we received
        console.log('[VRSceneManager] GLB loaded, analyzing structure...');
        let meshCount = 0;
        let materialCount = 0;
        
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materialCount += materials.length;
            console.log(`[VRSceneManager] Mesh found: ${child.name || 'unnamed'}, geometry vertices: ${child.geometry?.attributes?.position?.count || 0}`);
          }
        });
        console.log(`[VRSceneManager] GLB contains ${meshCount} meshes, ${materialCount} materials`);
        
        // Get the bounding box to determine appropriate scale
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        console.log(`[VRSceneManager] GLB original bounds - size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}), center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        
        // Scale skybox to our target radius (diameter = radius * 2)
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetDiameter = SCENE_CONSTANTS.SKYBOX_RADIUS * 2;
        const scaleFactor = maxDim > 0 ? targetDiameter / maxDim : 1;
        
        console.log(`[VRSceneManager] Scaling skybox: ${maxDim.toFixed(2)}m -> ${targetDiameter}m (factor: ${scaleFactor.toFixed(2)})`);
        gltf.scene.scale.setScalar(scaleFactor);
        
        // CENTER the skybox at origin (0, 0, 0)
        // Camera is at (0, CAMERA_HEIGHT, 0) which is INSIDE the sphere
        // The skybox center should be at world origin so camera is at center
        gltf.scene.position.set(
          -center.x * scaleFactor,
          -center.y * scaleFactor,
          -center.z * scaleFactor
        );
        
        console.log(`[VRSceneManager] Skybox centered at origin, camera at (0, ${SCENE_CONSTANTS.CAMERA_HEIGHT}, 0) is INSIDE`);
        
        // For skybox GLBs, we view from INSIDE - need BackSide rendering
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
                mat.side = THREE.BackSide; // View inside of sphere
                mat.depthWrite = false;    // Don't occlude other objects
                if (mat.map) {
                  mat.map.colorSpace = THREE.SRGBColorSpace;
                  console.log('[VRSceneManager] Skybox material has texture map');
                }
              }
            });
          }
        });
        
        gltf.scene.name = 'skybox-glb';
        gltf.scene.renderOrder = -1000; // Render FIRST (far behind everything)
        
        this.skyboxMesh = gltf.scene;
        this.scene.add(gltf.scene);
        
        console.log(`[VRSceneManager] ✅ GLB skybox loaded - radius: ${SCENE_CONSTANTS.SKYBOX_RADIUS}m, centered at origin`);
        
      } else {
        // Load equirectangular image as skybox sphere
        console.log('[VRSceneManager] Loading as equirectangular image skybox...');
        const texture = await this.loadTexture(url);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        
        console.log(`[VRSceneManager] Texture loaded: ${texture.image?.width || 0}x${texture.image?.height || 0}`);
        
        // Create sphere centered at origin with target radius
        const geometry = new THREE.SphereGeometry(SCENE_CONSTANTS.SKYBOX_RADIUS, 60, 40);
        geometry.scale(-1, 1, 1); // Invert so texture is visible from inside
        
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          depthWrite: false,
        });
        
        this.skyboxMesh = new THREE.Mesh(geometry, material);
        this.skyboxMesh.position.set(0, 0, 0); // Centered at origin
        this.skyboxMesh.name = 'skybox-equirect';
        this.skyboxMesh.renderOrder = -1000; // Render FIRST
        
        this.scene.add(this.skyboxMesh);
        
        console.log(`[VRSceneManager] ✅ Equirectangular skybox loaded - radius: ${SCENE_CONSTANTS.SKYBOX_RADIUS}m, centered at origin`);
      }
      
      this.updateProgress('skybox', 40, 'Environment loaded');
      
    } catch (error) {
      console.error('[VRSceneManager] Skybox load error:', error);
      console.log('[VRSceneManager] Using fallback skybox');
      this.createFallbackSkybox();
    }
  }
  
  private createFallbackSkybox(): void {
    // Create gradient sphere as fallback - centered at origin
    const geometry = new THREE.SphereGeometry(SCENE_CONSTANTS.SKYBOX_RADIUS, 32, 32);
    geometry.scale(-1, 1, 1); // Invert for inside view
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x0a0a1e,
      side: THREE.BackSide,
      depthWrite: false,
    });
    
    this.skyboxMesh = new THREE.Mesh(geometry, material);
    this.skyboxMesh.position.set(0, 0, 0); // Centered at origin
    this.skyboxMesh.name = 'skybox-fallback';
    this.skyboxMesh.renderOrder = -1000;
    
    this.scene.add(this.skyboxMesh);
    
    console.log(`[VRSceneManager] Fallback skybox created - radius: ${SCENE_CONSTANTS.SKYBOX_RADIUS}m`);
  }
  
  // ============================================================================
  // 3D Asset Loading
  // ============================================================================
  
  /**
   * Check if a URL is likely a 3D model (GLB/GLTF)
   */
  private is3DModelUrl(url: string): boolean {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    
    // Explicit extensions
    if (urlLower.includes('.glb') || urlLower.includes('.gltf')) return true;
    
    // Meshy.ai URLs are GLB files
    if (url.includes('meshy.ai') || url.includes('assets.meshy')) return true;
    
    // Proxy URLs that contain meshy
    if (url.includes('proxy-asset') && url.includes('meshy')) return true;
    
    // Firebase storage GLB files
    if ((url.includes('firebasestorage') || url.includes('storage.googleapis')) && urlLower.includes('.glb')) return true;
    
    return false;
  }
  
  async loadAssets(assetUrls: string[], image3d?: { imagemodel_glb?: string; imageasset_url?: string }): Promise<void> {
    this.updateProgress('assets', 50, 'Loading 3D models...');
    
    const allUrls: { url: string; id: string }[] = [];
    
    console.log('[VRSceneManager] Asset loading input:', {
      assetUrls: assetUrls?.length || 0,
      image3d: image3d ? Object.keys(image3d) : null,
    });
    
    // Add topic asset URLs - be more permissive with URL validation
    assetUrls.forEach((url, index) => {
      if (url && this.is3DModelUrl(url)) {
        console.log(`[VRSceneManager] Adding asset URL [${index}]:`, url.substring(0, 80) + '...');
        allUrls.push({ url, id: `asset-${index}` });
      } else if (url) {
        // Try to load anyway - might be a valid GLB URL without extension
        console.log(`[VRSceneManager] Attempting to load non-standard URL [${index}]:`, url.substring(0, 80) + '...');
        allUrls.push({ url, id: `asset-${index}` });
      }
    });
    
    // Add image3d asset
    if (image3d?.imagemodel_glb) {
      console.log('[VRSceneManager] Adding image3d GLB:', image3d.imagemodel_glb.substring(0, 80) + '...');
      allUrls.push({ url: image3d.imagemodel_glb, id: 'image3d-model' });
    } else if (image3d?.imageasset_url) {
      console.log('[VRSceneManager] Adding image3d asset:', image3d.imageasset_url.substring(0, 80) + '...');
      allUrls.push({ url: image3d.imageasset_url, id: 'image3d-asset' });
    }
    
    if (allUrls.length === 0) {
      console.log('[VRSceneManager] No 3D assets to load');
      this.updateProgress('ui', 80, 'Setting up interface...');
      return;
    }
    
    console.log(`[VRSceneManager] Loading ${allUrls.length} 3D assets...`);
    
    // Load assets in parallel with progress tracking
    let loadedCount = 0;
    let failedCount = 0;
    
    await Promise.all(allUrls.map(async ({ url, id }, index) => {
      try {
        console.log(`[VRSceneManager] Loading asset ${id}...`);
        const gltf = await this.loadGLTF(url);
        
        // ========================================================================
        // POSITION: Assets float in front of user, INSIDE the skybox sphere
        // User/camera is at (0, CAMERA_HEIGHT, 0)
        // Assets arranged in a semi-circle in front (negative Z direction)
        // ========================================================================
        
        const totalAssets = allUrls.length;
        
        // Calculate angle spread - more assets = wider arc
        const spreadAngle = Math.min(SCENE_CONSTANTS.ASSET_SPREAD_ANGLE * totalAssets, Math.PI * 0.6);
        const angleStep = totalAssets > 1 ? spreadAngle / (totalAssets - 1) : 0;
        const startAngle = -spreadAngle / 2;
        const angle = startAngle + (index * angleStep);
        
        // Position in front of user at specified distance
        const distance = SCENE_CONSTANTS.ASSET_DISTANCE;
        const x = Math.sin(angle) * distance;
        const z = -Math.cos(angle) * distance; // Negative Z = in front of user
        
        // Alternate heights for visual interest
        const heightRange = SCENE_CONSTANTS.ASSET_HEIGHT_MAX - SCENE_CONSTANTS.ASSET_HEIGHT_MIN;
        const y = SCENE_CONSTANTS.ASSET_HEIGHT_MIN + (index % 3) * (heightRange / 2);
        
        // ========================================================================
        // SCALE: Auto-scale to comfortable viewing size
        // ========================================================================
        
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const center = box.getCenter(new THREE.Vector3());
        
        console.log(`[VRSceneManager] Asset ${id} - original size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);
        
        let scale = 1;
        if (maxDim > 0) {
          scale = SCENE_CONSTANTS.ASSET_TARGET_SIZE / maxDim;
        }
        
        gltf.scene.scale.setScalar(scale);
        
        // Position with center offset so object's center is at the target position
        gltf.scene.position.set(
          x - center.x * scale,
          y - center.y * scale + (SCENE_CONSTANTS.ASSET_TARGET_SIZE / 2), // Lift slightly
          z - center.z * scale
        );
        
        // Make asset face the user (rotate to look at camera position)
        gltf.scene.lookAt(0, y, 0);
        
        gltf.scene.name = id;
        gltf.scene.renderOrder = 10; // Render after skybox and ground
        this.scene.add(gltf.scene);
        this.loadedAssets.set(id, gltf.scene);
        
        loadedCount++;
        const progress = 50 + (loadedCount / allUrls.length) * 30;
        this.updateProgress('assets', progress, `Loaded ${loadedCount}/${allUrls.length} models`);
        
        console.log(`[VRSceneManager] ✅ Asset ${id} loaded at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}), scale: ${scale.toFixed(3)}, inside skybox`);
        
      } catch (error) {
        console.error(`[VRSceneManager] ❌ Failed to load asset ${id}:`, error);
        failedCount++;
      }
    }));
    
    console.log(`[VRSceneManager] Asset loading complete: ${loadedCount} loaded, ${failedCount} failed`);
    this.updateProgress('ui', 80, 'Setting up interface...');
  }
  
  // ============================================================================
  // Loader Utilities
  // ============================================================================
  
  private loadGLTF(url: string): Promise<GLTF> {
    // Use proxied URL for CORS-blocked assets
    const loadUrl = getProxiedUrl(url);
    
    return new Promise((resolve, reject) => {
      console.log('[VRSceneManager] Loading GLTF from:', loadUrl.substring(0, 80) + '...');
      this.gltfLoader.load(
        loadUrl,
        (gltf) => {
          console.log('[VRSceneManager] GLTF loaded successfully');
          resolve(gltf);
        },
        (progress) => {
          // Optional: track individual file progress
        },
        (error) => {
          console.error('[VRSceneManager] GLTF load error:', error);
          reject(error);
        }
      );
    });
  }
  
  private loadTexture(url: string): Promise<THREE.Texture> {
    // Use proxied URL for CORS-blocked assets
    const loadUrl = getProxiedUrl(url);
    
    return new Promise((resolve, reject) => {
      console.log('[VRSceneManager] Loading texture from:', loadUrl.substring(0, 80) + '...');
      this.textureLoader.load(
        loadUrl,
        (texture) => {
          console.log('[VRSceneManager] Texture loaded successfully');
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error('[VRSceneManager] Texture load error:', error);
          reject(error);
        }
      );
    });
  }
  
  // ============================================================================
  // Progress Tracking
  // ============================================================================
  
  private updateProgress(stage: LoadingProgress['stage'], progress: number, message: string): void {
    this.loadingProgress = { stage, progress, message };
    this.onProgressCallbacks.forEach(cb => cb(this.loadingProgress));
  }
  
  onProgress(callback: (progress: LoadingProgress) => void): void {
    this.onProgressCallbacks.push(callback);
  }
  
  getProgress(): LoadingProgress {
    return this.loadingProgress;
  }
  
  setComplete(): void {
    this.updateProgress('complete', 100, 'Ready!');
  }
  
  setError(error: string): void {
    this.loadingProgress = {
      stage: 'error',
      progress: 0,
      message: 'Error loading scene',
      error,
    };
    this.onProgressCallbacks.forEach(cb => cb(this.loadingProgress));
  }
  
  // ============================================================================
  // Scene Access
  // ============================================================================
  
  getScene(): THREE.Scene {
    return this.scene;
  }
  
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  
  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }
  
  getLoadedAssets(): Map<string, THREE.Object3D> {
    return this.loadedAssets;
  }
  
  // ============================================================================
  // Add Objects to Scene
  // ============================================================================
  
  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }
  
  remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }
  
  // ============================================================================
  // Render Loop
  // ============================================================================
  
  startRenderLoop(xrManager?: XRManager): void {
    if (!this.renderer) {
      console.error('[VRSceneManager] Renderer not initialized');
      return;
    }
    
    // Use setAnimationLoop for XR compatibility
    this.renderer.setAnimationLoop((time, frame) => {
      // Render the scene
      this.renderer!.render(this.scene, this.camera);
    });
    
    console.log('[VRSceneManager] Render loop started');
  }
  
  stopRenderLoop(): void {
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
    }
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  dispose(): void {
    console.log('[VRSceneManager] Disposing...');
    
    // Stop render loop
    this.stopRenderLoop();
    
    // Dispose loaded assets
    this.loadedAssets.forEach((obj) => {
      this.disposeObject(obj);
    });
    this.loadedAssets.clear();
    
    // Dispose skybox
    if (this.skyboxMesh) {
      this.disposeObject(this.skyboxMesh);
      this.skyboxMesh = null;
    }
    
    // Dispose ground plane
    if (this.groundPlane) {
      this.disposeObject(this.groundPlane);
      this.groundPlane = null;
    }
    
    // Dispose lights
    this.lights.forEach(light => {
      this.scene.remove(light);
      light.dispose?.();
    });
    this.lights = [];
    
    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    
    // Clear callbacks
    this.onProgressCallbacks = [];
    
    this.isInitialized = false;
    console.log('[VRSceneManager] Disposed');
  }
  
  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.Material) {
            // Dispose textures
            Object.keys(mat).forEach((key) => {
              const value = (mat as any)[key];
              if (value instanceof THREE.Texture) {
                value.dispose();
              }
            });
            mat.dispose();
          }
        });
      }
    });
    this.scene.remove(obj);
  }
}
