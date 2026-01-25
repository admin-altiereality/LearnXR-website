/**
 * Asset Manager - Multi-asset handling for WebXR
 * 
 * This module manages 3D asset loading, arrangement, selection,
 * and manipulation in the WebXR environment.
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { LayoutEngine, AssetArrangement } from './layoutEngine';

// ============================================================================
// Types
// ============================================================================

export interface AssetData {
  id: string;
  url: string;
  name: string;
  thumbnailUrl?: string;
}

export interface LoadedAsset {
  id: string;
  model: THREE.Group;
  originalPosition: THREE.Vector3;
  originalRotation: THREE.Euler;
  originalScale: THREE.Vector3;
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  isActive: boolean;
  isGrabbed: boolean;
  grabOffset?: THREE.Vector3;
  grabController?: THREE.Group;
}

export interface ManipulationState {
  mode: 'none' | 'grab' | 'rotate' | 'scale';
  activeAssetId: string | null;
  initialDistance?: number;
  initialScale?: THREE.Vector3;
}

export type AssetLoadCallback = (asset: LoadedAsset) => void;
export type AssetErrorCallback = (error: Error, assetId: string) => void;
export type AssetProgressCallback = (progress: number, assetId: string) => void;

// ============================================================================
// Debug Logging
// ============================================================================

const DEBUG = {
  ASSET: '[Asset]',
};

function log(...args: any[]): void {
  console.log(DEBUG.ASSET, ...args);
}

// ============================================================================
// Configuration
// ============================================================================

export interface AssetManagerConfig {
  dracoPath: string;
  defaultScale: number;
  maxScale: number;
  minScale: number;
  animationDuration: number;
  highlightColor: number;
  normalEmissiveIntensity: number;
  highlightEmissiveIntensity: number;
}

const DEFAULT_CONFIG: AssetManagerConfig = {
  dracoPath: 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/',
  defaultScale: 1.0,
  maxScale: 3.0,
  minScale: 0.2,
  animationDuration: 500, // ms
  highlightColor: 0x06b6d4,
  normalEmissiveIntensity: 0,
  highlightEmissiveIntensity: 0.15,
};

// ============================================================================
// Asset Manager Class
// ============================================================================

export class AssetManager {
  private config: AssetManagerConfig;
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private layoutEngine: LayoutEngine | null = null;
  
  // Asset storage
  private assets: Map<string, LoadedAsset> = new Map();
  private assetOrder: string[] = [];
  private activeAssetId: string | null = null;
  
  // Manipulation state
  private manipulationState: ManipulationState = {
    mode: 'none',
    activeAssetId: null,
  };
  
  // Animation
  private pendingAnimations: Map<string, {
    startTime: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    duration: number;
  }> = new Map();
  
  // Callbacks
  private onAssetLoaded: AssetLoadCallback | null = null;
  private onAssetError: AssetErrorCallback | null = null;
  private onAssetProgress: AssetProgressCallback | null = null;
  private onActiveAssetChanged: ((assetId: string | null) => void) | null = null;

  constructor(config: Partial<AssetManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize loaders
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(this.config.dracoPath);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Set layout engine for positioning
   */
  setLayoutEngine(engine: LayoutEngine): void {
    this.layoutEngine = engine;
    log('Layout engine set');
  }

  // ============================================================================
  // Asset Loading
  // ============================================================================

  /**
   * Load a single asset
   */
  async loadAsset(assetData: AssetData): Promise<LoadedAsset> {
    return new Promise((resolve, reject) => {
      log(`Loading asset: ${assetData.name} (${assetData.id})`);

      this.gltfLoader.load(
        assetData.url,
        (gltf: GLTF) => {
          try {
            const model = gltf.scene;
            model.name = assetData.name || assetData.id;
            model.userData.assetId = assetData.id;
            model.userData.isInteractable = true;

            // Calculate bounding box and center
            const boundingBox = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            boundingBox.getCenter(center);
            boundingBox.getSize(size);

            // Normalize scale based on largest dimension
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 0.5; // 0.5 meters
            const scaleFactor = targetSize / maxDim;
            model.scale.setScalar(scaleFactor * this.config.defaultScale);

            // Recalculate after scaling
            boundingBox.setFromObject(model);
            boundingBox.getCenter(center);
            boundingBox.getSize(size);

            // Center the model
            model.position.sub(center);

            const loadedAsset: LoadedAsset = {
              id: assetData.id,
              model,
              originalPosition: new THREE.Vector3(),
              originalRotation: new THREE.Euler(),
              originalScale: model.scale.clone(),
              boundingBox,
              center,
              size,
              isActive: false,
              isGrabbed: false,
            };

            this.assets.set(assetData.id, loadedAsset);
            this.assetOrder.push(assetData.id);

            log(`Asset loaded: ${assetData.name}`, {
              size: `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`,
              scale: scaleFactor.toFixed(3),
            });

            if (this.onAssetLoaded) {
              this.onAssetLoaded(loadedAsset);
            }

            resolve(loadedAsset);
          } catch (error) {
            const err = error as Error;
            log(`Error processing asset ${assetData.id}:`, err.message);
            if (this.onAssetError) {
              this.onAssetError(err, assetData.id);
            }
            reject(err);
          }
        },
        (progress) => {
          const percent = progress.total > 0 
            ? (progress.loaded / progress.total) * 100 
            : 0;
          if (this.onAssetProgress) {
            this.onAssetProgress(percent, assetData.id);
          }
        },
        (error) => {
          const err = new Error(`Failed to load asset: ${error}`);
          log(`Asset load error ${assetData.id}:`, err.message);
          if (this.onAssetError) {
            this.onAssetError(err, assetData.id);
          }
          reject(err);
        }
      );
    });
  }

  /**
   * Load multiple assets
   */
  async loadAssets(assetsData: AssetData[]): Promise<LoadedAsset[]> {
    log(`Loading ${assetsData.length} assets`);
    
    const results: LoadedAsset[] = [];
    
    for (const assetData of assetsData) {
      try {
        const asset = await this.loadAsset(assetData);
        results.push(asset);
      } catch (error) {
        log(`Failed to load asset ${assetData.id}:`, error);
      }
    }

    return results;
  }

  // ============================================================================
  // Asset Arrangement
  // ============================================================================

  /**
   * Arrange assets in the scene
   */
  arrangeAssets(
    scene: THREE.Scene,
    arrangement?: AssetArrangement
  ): void {
    if (!this.layoutEngine) {
      log('Warning: No layout engine set, using default positions');
      this.arrangeAssetsDefault(scene);
      return;
    }

    const assetCount = this.assets.size;
    const selectedArrangement = arrangement || this.layoutEngine.selectArrangement(assetCount);
    const positions = this.layoutEngine.positionAssets(assetCount, selectedArrangement);

    log(`Arranging ${assetCount} assets with ${selectedArrangement} arrangement`);

    let index = 0;
    for (const [id, asset] of this.assets) {
      if (index >= positions.length) break;

      const position = positions[index];
      asset.model.position.copy(position);
      asset.originalPosition.copy(position);
      asset.originalRotation.copy(asset.model.rotation);
      
      // Make first asset active by default
      if (index === 0) {
        this.setActiveAsset(id);
      }

      // Add to scene if not already added
      if (!asset.model.parent) {
        scene.add(asset.model);
      }

      index++;
    }
  }

  /**
   * Default arrangement (fallback)
   */
  private arrangeAssetsDefault(scene: THREE.Scene): void {
    const spacing = 1.2;
    const totalWidth = spacing * (this.assets.size - 1);
    const startX = -totalWidth / 2;

    let index = 0;
    for (const [id, asset] of this.assets) {
      const x = startX + index * spacing;
      const position = new THREE.Vector3(x, 1.4, -2.5);
      
      asset.model.position.copy(position);
      asset.originalPosition.copy(position);
      asset.originalRotation.copy(asset.model.rotation);

      if (index === 0) {
        this.setActiveAsset(id);
      }

      if (!asset.model.parent) {
        scene.add(asset.model);
      }

      index++;
    }
  }

  /**
   * Animate asset to new position
   */
  animateToPosition(
    assetId: string,
    targetPosition: THREE.Vector3,
    duration: number = this.config.animationDuration
  ): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    this.pendingAnimations.set(assetId, {
      startTime: Date.now(),
      startPos: asset.model.position.clone(),
      endPos: targetPosition.clone(),
      duration,
    });

    log(`Animating ${assetId} to new position`);
  }

  // ============================================================================
  // Asset Selection
  // ============================================================================

  /**
   * Set active asset
   */
  setActiveAsset(assetId: string | null): void {
    // Deactivate previous
    if (this.activeAssetId && this.activeAssetId !== assetId) {
      const prevAsset = this.assets.get(this.activeAssetId);
      if (prevAsset) {
        prevAsset.isActive = false;
        this.setAssetHighlight(prevAsset, false);
      }
    }

    // Activate new
    if (assetId) {
      const asset = this.assets.get(assetId);
      if (asset) {
        asset.isActive = true;
        this.setAssetHighlight(asset, true);
      }
    }

    this.activeAssetId = assetId;

    if (this.onActiveAssetChanged) {
      this.onActiveAssetChanged(assetId);
    }

    log(`Active asset: ${assetId || 'none'}`);
  }

  /**
   * Get active asset
   */
  getActiveAsset(): LoadedAsset | null {
    if (!this.activeAssetId) return null;
    return this.assets.get(this.activeAssetId) || null;
  }

  /**
   * Cycle to next asset
   */
  selectNextAsset(): void {
    if (this.assetOrder.length === 0) return;

    const currentIndex = this.activeAssetId 
      ? this.assetOrder.indexOf(this.activeAssetId)
      : -1;
    const nextIndex = (currentIndex + 1) % this.assetOrder.length;
    this.setActiveAsset(this.assetOrder[nextIndex]);
  }

  /**
   * Cycle to previous asset
   */
  selectPrevAsset(): void {
    if (this.assetOrder.length === 0) return;

    const currentIndex = this.activeAssetId 
      ? this.assetOrder.indexOf(this.activeAssetId)
      : 0;
    const prevIndex = (currentIndex - 1 + this.assetOrder.length) % this.assetOrder.length;
    this.setActiveAsset(this.assetOrder[prevIndex]);
  }

  /**
   * Set highlight on asset
   */
  private setAssetHighlight(asset: LoadedAsset, highlight: boolean): void {
    asset.model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.setHex(highlight ? this.config.highlightColor : 0x000000);
            mat.emissiveIntensity = highlight 
              ? this.config.highlightEmissiveIntensity 
              : this.config.normalEmissiveIntensity;
          }
        });
      }
    });
  }

  // ============================================================================
  // Object Manipulation
  // ============================================================================

  /**
   * Start grabbing an asset
   */
  startGrab(assetId: string, controller: THREE.Group): void {
    const asset = this.assets.get(assetId);
    if (!asset || !asset.isActive) return;

    // Calculate offset from controller to object
    const controllerPos = new THREE.Vector3();
    controller.getWorldPosition(controllerPos);
    
    const assetPos = new THREE.Vector3();
    asset.model.getWorldPosition(assetPos);
    
    asset.grabOffset = assetPos.sub(controllerPos);
    asset.isGrabbed = true;
    asset.grabController = controller;

    this.manipulationState = {
      mode: 'grab',
      activeAssetId: assetId,
    };

    log(`Grab started: ${assetId}`);
  }

  /**
   * Start rotating an asset
   */
  startRotate(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (!asset || !asset.isActive) return;

    this.manipulationState = {
      mode: 'rotate',
      activeAssetId: assetId,
    };

    log(`Rotate started: ${assetId}`);
  }

  /**
   * Start scaling an asset (two-hand)
   */
  startScale(assetId: string, initialDistance: number): void {
    const asset = this.assets.get(assetId);
    if (!asset || !asset.isActive) return;

    this.manipulationState = {
      mode: 'scale',
      activeAssetId: assetId,
      initialDistance,
      initialScale: asset.model.scale.clone(),
    };

    log(`Scale started: ${assetId}`);
  }

  /**
   * End manipulation
   */
  endManipulation(): void {
    if (this.manipulationState.activeAssetId) {
      const asset = this.assets.get(this.manipulationState.activeAssetId);
      if (asset) {
        asset.isGrabbed = false;
        asset.grabController = undefined;
        asset.grabOffset = undefined;
      }
    }

    const prevMode = this.manipulationState.mode;
    this.manipulationState = {
      mode: 'none',
      activeAssetId: null,
    };

    if (prevMode !== 'none') {
      log(`Manipulation ended: ${prevMode}`);
    }
  }

  /**
   * Update manipulation state each frame
   */
  update(
    controllers: THREE.Group[],
    twoHandDistance?: number
  ): void {
    // Update animations
    this.updateAnimations();

    // Update grab manipulation
    if (this.manipulationState.mode === 'grab' && this.manipulationState.activeAssetId) {
      const asset = this.assets.get(this.manipulationState.activeAssetId);
      if (asset && asset.isGrabbed && asset.grabController && asset.grabOffset) {
        const controllerPos = new THREE.Vector3();
        asset.grabController.getWorldPosition(controllerPos);
        asset.model.position.copy(controllerPos.add(asset.grabOffset));
      }
    }

    // Update scale manipulation
    if (this.manipulationState.mode === 'scale' && 
        this.manipulationState.activeAssetId &&
        this.manipulationState.initialDistance &&
        this.manipulationState.initialScale &&
        twoHandDistance !== undefined) {
      const asset = this.assets.get(this.manipulationState.activeAssetId);
      if (asset) {
        const scaleRatio = twoHandDistance / this.manipulationState.initialDistance;
        const newScale = this.manipulationState.initialScale.clone().multiplyScalar(scaleRatio);
        
        // Clamp scale
        const clampedScale = Math.max(
          this.config.minScale,
          Math.min(this.config.maxScale, newScale.x)
        );
        asset.model.scale.setScalar(clampedScale);
      }
    }
  }

  /**
   * Update position animations
   */
  private updateAnimations(): void {
    const now = Date.now();
    
    for (const [assetId, animation] of this.pendingAnimations) {
      const elapsed = now - animation.startTime;
      const progress = Math.min(elapsed / animation.duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const asset = this.assets.get(assetId);
      if (asset) {
        asset.model.position.lerpVectors(
          animation.startPos,
          animation.endPos,
          eased
        );
      }

      if (progress >= 1) {
        this.pendingAnimations.delete(assetId);
      }
    }
  }

  /**
   * Rotate active asset by delta rotation
   */
  rotateActiveAsset(deltaRotation: THREE.Euler): void {
    const asset = this.getActiveAsset();
    if (!asset) return;

    asset.model.rotation.x += deltaRotation.x;
    asset.model.rotation.y += deltaRotation.y;
    asset.model.rotation.z += deltaRotation.z;
  }

  // ============================================================================
  // Reset and Focus
  // ============================================================================

  /**
   * Reset asset to original transform
   */
  resetAsset(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    asset.model.position.copy(asset.originalPosition);
    asset.model.rotation.copy(asset.originalRotation);
    asset.model.scale.copy(asset.originalScale);

    log(`Asset reset: ${assetId}`);
  }

  /**
   * Reset all assets
   */
  resetAllAssets(): void {
    for (const [id] of this.assets) {
      this.resetAsset(id);
    }
  }

  /**
   * Focus asset in front of camera
   */
  focusAsset(assetId: string, camera: THREE.Camera): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);

    const focusDistance = 1.5;
    const newPos = cameraPos.clone().add(forward.multiplyScalar(focusDistance));
    newPos.y = cameraPos.y - 0.2; // Slightly below eye level

    this.animateToPosition(assetId, newPos);
    this.setActiveAsset(assetId);

    log(`Asset focused: ${assetId}`);
  }

  /**
   * Focus active asset
   */
  focusActiveAsset(camera: THREE.Camera): void {
    if (this.activeAssetId) {
      this.focusAsset(this.activeAssetId, camera);
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get asset by ID
   */
  getAsset(assetId: string): LoadedAsset | undefined {
    return this.assets.get(assetId);
  }

  /**
   * Get all assets
   */
  getAllAssets(): LoadedAsset[] {
    return Array.from(this.assets.values());
  }

  /**
   * Get asset count
   */
  getAssetCount(): number {
    return this.assets.size;
  }

  /**
   * Get asset order (IDs in order)
   */
  getAssetOrder(): string[] {
    return [...this.assetOrder];
  }

  /**
   * Get manipulation state
   */
  getManipulationState(): ManipulationState {
    return { ...this.manipulationState };
  }

  /**
   * Check if any asset is being manipulated
   */
  isManipulating(): boolean {
    return this.manipulationState.mode !== 'none';
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Set asset loaded callback
   */
  setOnAssetLoaded(callback: AssetLoadCallback | null): void {
    this.onAssetLoaded = callback;
  }

  /**
   * Set asset error callback
   */
  setOnAssetError(callback: AssetErrorCallback | null): void {
    this.onAssetError = callback;
  }

  /**
   * Set asset progress callback
   */
  setOnAssetProgress(callback: AssetProgressCallback | null): void {
    this.onAssetProgress = callback;
  }

  /**
   * Set active asset changed callback
   */
  setOnActiveAssetChanged(callback: ((assetId: string | null) => void) | null): void {
    this.onActiveAssetChanged = callback;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Remove asset from manager
   */
  removeAsset(assetId: string, scene?: THREE.Scene): void {
    const asset = this.assets.get(assetId);
    if (!asset) return;

    // Remove from scene
    if (scene && asset.model.parent === scene) {
      scene.remove(asset.model);
    }

    // Dispose geometry and materials
    asset.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Remove from storage
    this.assets.delete(assetId);
    const orderIndex = this.assetOrder.indexOf(assetId);
    if (orderIndex !== -1) {
      this.assetOrder.splice(orderIndex, 1);
    }

    // Update active asset if needed
    if (this.activeAssetId === assetId) {
      this.activeAssetId = this.assetOrder.length > 0 ? this.assetOrder[0] : null;
    }

    log(`Asset removed: ${assetId}`);
  }

  /**
   * Clear all assets
   */
  clearAllAssets(scene?: THREE.Scene): void {
    for (const [id] of this.assets) {
      this.removeAsset(id, scene);
    }
  }

  /**
   * Dispose all resources
   */
  dispose(scene?: THREE.Scene): void {
    this.clearAllAssets(scene);
    this.dracoLoader.dispose();
    this.layoutEngine = null;
    log('Asset manager disposed');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAssetManager(config?: Partial<AssetManagerConfig>): AssetManager {
  return new AssetManager(config);
}

export default AssetManager;
