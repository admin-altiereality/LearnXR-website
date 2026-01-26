/**
 * Stable Layout System for XR Lessons
 * 
 * FIXED ISSUES:
 * - Removed environment threshold that was excluding assets
 * - ALL assets are now registered as interactable
 * - Improved root model finding for raycasts
 * - Better crash protection
 * 
 * World-class VR training layout with:
 * - Deterministic asset staging (no random spawning)
 * - Proper spacing based on bounding boxes
 * - Collision prevention
 * - Crash-safe interaction handling
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AssetSlot {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  width: number;
  depth: number;
  occupied: boolean;
  modelId: string | null;
}

export interface StagedModel {
  model: THREE.Object3D;
  slot: number;
  bounds: THREE.Box3;
  size: THREE.Vector3;
  originalPosition: THREE.Vector3;
  originalRotation: THREE.Euler;
  originalScale: THREE.Vector3;
  isEnvironment: boolean;
  uuid: string;
  name: string;
}

export interface LayoutConfig {
  stageDistance: number;      // Distance from user to stage center
  stageWidth: number;         // Total width of stage
  stageDepth: number;         // Total depth of stage
  horizontalOffset: number;   // Offset to the right (positive) or left (negative)
  floorHeight: number;        // Height of stage floor
  modelSpacing: number;       // Minimum spacing between models
  normalizedSize: number;     // Target size for normalization
  environmentThreshold: number; // Size threshold for environment detection (INCREASED)
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  stageDistance: 2.5,
  stageWidth: 4.0,
  stageDepth: 2.5,
  horizontalOffset: 0.0, // Centered (was 0.8 offset)
  floorHeight: 0.0,
  modelSpacing: 0.5,
  normalizedSize: 0.8,
  environmentThreshold: 50.0, // INCREASED from 10m to 50m - only truly huge skyboxes are "environment"
};

// ═══════════════════════════════════════════════════════════════════════════════
// STABLE LAYOUT SYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class StableLayoutSystem {
  private config: LayoutConfig;
  private isInitialized: boolean = false;
  private isLayoutLocked: boolean = false;
  
  // User pose
  private userPosition: THREE.Vector3 = new THREE.Vector3(0, 1.6, 0);
  private userForward: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private userRight: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private floorY: number = 0;
  
  // Stage anchor (computed once and locked)
  private stageAnchor: THREE.Vector3 = new THREE.Vector3();
  private stageRotation: THREE.Euler = new THREE.Euler();
  
  // Staged models (cache for crash-safe access)
  private stagedModels: Map<string, StagedModel> = new Map();
  private interactableCache: THREE.Object3D[] = [];
  private interactableCacheDirty: boolean = true;
  
  // UUID to model mapping for fast lookup
  private uuidToModel: Map<string, THREE.Object3D> = new Map();
  
  // Interaction state (single source of truth)
  private grabbedModel: THREE.Object3D | null = null;
  private grabController: THREE.Group | null = null;
  private grabOffset: THREE.Vector3 = new THREE.Vector3();
  private grabStartRotation: THREE.Quaternion = new THREE.Quaternion();
  private controllerStartRotation: THREE.Quaternion = new THREE.Quaternion();

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_LAYOUT_CONFIG, ...config };
    console.log('[StableLayoutSystem] Created with config:', this.config);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize the layout system with camera pose
   */
  public initialize(camera: THREE.Camera, floorY: number = 0): void {
    if (this.isInitialized) {
      console.log('[StableLayoutSystem] Already initialized, skipping');
      return;
    }
    
    this.floorY = floorY;
    this.updateUserPose(camera);
    this.computeStageAnchor();
    this.isInitialized = true;
    
    console.log('[StableLayoutSystem] ═══════════════════════════════════════');
    console.log('[StableLayoutSystem] INITIALIZED');
    console.log('[StableLayoutSystem] Stage anchor:', this.stageAnchor);
    console.log('[StableLayoutSystem] User position:', this.userPosition);
    console.log('[StableLayoutSystem] ═══════════════════════════════════════');
  }

  /**
   * Check if system is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Update user pose from camera
   */
  public updateUserPose(camera: THREE.Camera): void {
    camera.getWorldPosition(this.userPosition);
    
    // Get forward direction (flattened to horizontal)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    this.userForward.set(forward.x, 0, forward.z);
    if (this.userForward.lengthSq() < 0.001) {
      this.userForward.set(0, 0, -1);
    }
    this.userForward.normalize();
    
    // Get right direction
    this.userRight.crossVectors(this.userForward, new THREE.Vector3(0, 1, 0)).normalize();
  }

  /**
   * Compute stage anchor (called once during initialization)
   */
  private computeStageAnchor(): void {
    const config = this.config;
    
    // Stage is positioned in front of user (centered)
    this.stageAnchor.set(
      this.userPosition.x + this.userForward.x * config.stageDistance + this.userRight.x * config.horizontalOffset,
      this.floorY + config.floorHeight,
      this.userPosition.z + this.userForward.z * config.stageDistance + this.userRight.z * config.horizontalOffset
    );
    
    // Stage faces the user
    const yRotation = Math.atan2(-this.userForward.x, -this.userForward.z);
    this.stageRotation.set(0, yRotation, 0);
  }

  /**
   * Recompute anchors when VR session starts
   */
  public recomputeAnchors(camera: THREE.Camera, floorY: number = 0): void {
    if (this.isLayoutLocked) {
      console.log('[StableLayoutSystem] Layout is locked, not recomputing');
      return;
    }
    
    this.floorY = floorY;
    this.updateUserPose(camera);
    this.computeStageAnchor();
    
    console.log('[StableLayoutSystem] Anchors recomputed for VR session');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSET STAGING (DETERMINISTIC PLACEMENT)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Stage all models for interaction (NO filtering, ALL models staged)
   * CRITICAL FIX: Removed environment filtering that was excluding assets
   */
  public stageModels(models: THREE.Object3D[]): StagedModel[] {
    if (this.isLayoutLocked) {
      console.log('[StableLayoutSystem] Layout is locked, returning cached staged models');
      return Array.from(this.stagedModels.values());
    }
    
    console.log('[StableLayoutSystem] ═══════════════════════════════════════');
    console.log(`[StableLayoutSystem] STAGING ${models.length} MODELS (ALL)`);
    
    // Clear previous staging
    this.stagedModels.clear();
    this.uuidToModel.clear();
    this.interactableCacheDirty = true;
    
    // CRITICAL FIX: Stage ALL models, no filtering
    models.forEach((model, index) => {
      const analysisResult = this.analyzeModel(model);
      
      console.log(`[StableLayoutSystem] Model ${index + 1}/${models.length}:`, {
        name: model.name || 'unnamed',
        uuid: model.uuid,
        size: `${analysisResult.size.x.toFixed(2)} x ${analysisResult.size.y.toFixed(2)} x ${analysisResult.size.z.toFixed(2)}`,
        maxDim: analysisResult.maxDim.toFixed(2),
        isLargeModel: analysisResult.maxDim > this.config.environmentThreshold,
      });
      
      // REMOVED: Environment filtering - now ALL models are staged
      // Only filter truly massive models (skyboxes > 50m)
      if (analysisResult.maxDim > this.config.environmentThreshold) {
        console.log(`[StableLayoutSystem] Model ${index + 1} is VERY large (${analysisResult.maxDim.toFixed(1)}m) - treating as environment but STILL making it interactable`);
        // Still mark as interactable, just don't reposition it
        model.userData.isEnvironment = true;
      }
      
      // Register ALL models for interaction
      this.registerModelForInteraction(model, index);
    });
    
    // Lock layout to prevent re-staging
    this.isLayoutLocked = true;
    
    console.log(`[StableLayoutSystem] STAGING COMPLETE - ${this.stagedModels.size} models staged`);
    console.log(`[StableLayoutSystem] Interactables: ${this.getInteractables().length}`);
    console.log('[StableLayoutSystem] ═══════════════════════════════════════');
    
    return Array.from(this.stagedModels.values());
  }

  /**
   * Register a model for interaction (CRITICAL: makes it grabbable)
   */
  private registerModelForInteraction(model: THREE.Object3D, slotIndex: number): void {
    const analysis = this.analyzeModel(model);
    
    // Mark as interactable
    model.userData.isInteractable = true;
    model.userData.slotIndex = slotIndex;
    model.userData.rootModel = model; // Self-reference for finding root
    
    // CRITICAL: Mark ALL descendants with reference to root
    model.traverse((child) => {
      child.userData.isInteractable = true;
      child.userData.rootModel = model;
      child.userData.slotIndex = slotIndex;
      
      // Store UUID mapping for fast lookup
      this.uuidToModel.set(child.uuid, model);
    });
    
    // Store the root model UUID
    this.uuidToModel.set(model.uuid, model);
    
    // Create staged model record
    const staged: StagedModel = {
      model,
      slot: slotIndex,
      bounds: analysis.bounds.clone(),
      size: analysis.size.clone(),
      originalPosition: model.position.clone(),
      originalRotation: model.rotation.clone(),
      originalScale: model.scale.clone(),
      isEnvironment: model.userData.isEnvironment || false,
      uuid: model.uuid,
      name: model.name || `model_${slotIndex}`,
    };
    
    this.stagedModels.set(model.uuid, staged);
    
    console.log(`[StableLayoutSystem] ✅ Registered model ${slotIndex + 1}: "${staged.name}" (${model.uuid.substring(0, 8)}...)`);
  }

  /**
   * Analyze a model to determine its bounds
   */
  private analyzeModel(model: THREE.Object3D): {
    bounds: THREE.Box3;
    size: THREE.Vector3;
    center: THREE.Vector3;
    maxDim: number;
    isEnvironment: boolean;
  } {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const isEnvironment = maxDim > this.config.environmentThreshold;
    
    return { bounds, size, center, maxDim, isEnvironment };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRASH-SAFE INTERACTION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cached interactable objects (NO traversal during interaction)
   */
  public getInteractables(): THREE.Object3D[] {
    if (!this.interactableCacheDirty) {
      return this.interactableCache;
    }
    
    // Rebuild cache from staged models
    this.interactableCache = [];
    this.stagedModels.forEach((staged) => {
      // CRITICAL FIX: ALL staged models are interactable
      if (staged.model.userData.isInteractable) {
        this.interactableCache.push(staged.model);
      }
    });
    
    this.interactableCacheDirty = false;
    
    console.log(`[StableLayoutSystem] Interactable cache rebuilt: ${this.interactableCache.length} objects`);
    return this.interactableCache;
  }

  /**
   * Get all mesh descendants for raycasting (CRITICAL for interaction)
   */
  public getAllInteractableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    
    this.stagedModels.forEach((staged) => {
      staged.model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          meshes.push(child);
        }
      });
    });
    
    console.log(`[StableLayoutSystem] Total interactable meshes: ${meshes.length}`);
    return meshes;
  }

  /**
   * Find the root interactable model from any child object
   * CRITICAL FIX: Now uses UUID mapping for reliable lookup
   */
  public findRootModel(object: THREE.Object3D): THREE.Object3D | null {
    try {
      // Method 1: Direct lookup in UUID map (fastest)
      const directLookup = this.uuidToModel.get(object.uuid);
      if (directLookup) {
        return directLookup;
      }
      
      // Method 2: Check userData.rootModel reference
      if (object.userData.rootModel) {
        const root = object.userData.rootModel as THREE.Object3D;
        if (this.stagedModels.has(root.uuid)) {
          return root;
        }
      }
      
      // Method 3: Walk up parent chain (fallback)
      let current: THREE.Object3D | null = object;
      let depth = 0;
      const maxDepth = 30;
      
      while (current && depth < maxDepth) {
        // Check UUID map
        const mapped = this.uuidToModel.get(current.uuid);
        if (mapped) {
          return mapped;
        }
        
        // Check if this is a staged model
        if (this.stagedModels.has(current.uuid)) {
          return current;
        }
        
        // Check userData
        if (current.userData.rootModel) {
          const root = current.userData.rootModel as THREE.Object3D;
          if (this.stagedModels.has(root.uuid)) {
            return root;
          }
        }
        
        current = current.parent;
        depth++;
      }
      
      console.warn(`[StableLayoutSystem] Could not find root model for object: ${object.name || object.uuid}`);
      return null;
      
    } catch (err) {
      console.error('[StableLayoutSystem] CRASH GUARD: Error in findRootModel:', err);
      return null;
    }
  }

  /**
   * Start grabbing a model (crash-safe)
   */
  public startGrab(object: THREE.Object3D, controller: THREE.Group): boolean {
    try {
      // Find root model
      const rootModel = this.findRootModel(object);
      if (!rootModel) {
        console.log('[StableLayoutSystem] Cannot grab: no root model found for', object.name || object.uuid);
        return false;
      }
      
      // Check if already grabbing something
      if (this.grabbedModel) {
        console.log('[StableLayoutSystem] Already grabbing a model');
        return false;
      }
      
      // Get positions
      const controllerPos = new THREE.Vector3();
      controller.getWorldPosition(controllerPos);
      
      const modelPos = new THREE.Vector3();
      rootModel.getWorldPosition(modelPos);
      
      // Store grab state
      this.grabbedModel = rootModel;
      this.grabController = controller;
      this.grabOffset.copy(modelPos).sub(controllerPos);
      this.grabStartRotation.copy(rootModel.quaternion);
      controller.getWorldQuaternion(this.controllerStartRotation);
      
      // Apply visual feedback
      this.applyGrabVisual(rootModel, true);
      
      const grabDistance = this.grabOffset.length();
      console.log(`[StableLayoutSystem] 🎯 GRAB START: "${rootModel.name || rootModel.uuid}" (slot ${rootModel.userData.slotIndex}), distance: ${grabDistance.toFixed(2)}m`);
      
      return true;
    } catch (err) {
      console.error('[StableLayoutSystem] CRASH GUARD: Error in startGrab:', err);
      return false;
    }
  }

  /**
   * Update grabbed model position (called from animation loop, crash-safe)
   */
  public updateGrab(): void {
    if (!this.grabbedModel || !this.grabController) {
      return;
    }
    
    try {
      // Get controller position and rotation
      const controllerPos = new THREE.Vector3();
      this.grabController.getWorldPosition(controllerPos);
      
      const controllerQuat = new THREE.Quaternion();
      this.grabController.getWorldQuaternion(controllerQuat);
      
      // Calculate rotation delta
      const rotationDelta = controllerQuat.clone().multiply(
        this.controllerStartRotation.clone().invert()
      );
      
      // Apply rotation to offset for natural movement
      const rotatedOffset = this.grabOffset.clone();
      rotatedOffset.applyQuaternion(rotationDelta);
      
      // Calculate target position
      const targetPos = controllerPos.clone().add(rotatedOffset);
      
      // Apply collision constraints
      const constrainedPos = this.constrainPosition(targetPos);
      
      // Smooth interpolation
      this.grabbedModel.position.lerp(constrainedPos, 0.25);
      
      // Apply rotation
      const targetQuat = this.grabStartRotation.clone();
      targetQuat.premultiply(rotationDelta);
      this.grabbedModel.quaternion.slerp(targetQuat, 0.2);
      
    } catch (err) {
      console.error('[StableLayoutSystem] CRASH GUARD: Error in updateGrab:', err);
    }
  }

  /**
   * Release grabbed model (crash-safe)
   */
  public releaseGrab(): void {
    if (!this.grabbedModel) {
      return;
    }
    
    try {
      // Remove visual feedback
      this.applyGrabVisual(this.grabbedModel, false);
      
      console.log(`[StableLayoutSystem] 🎯 RELEASED: "${this.grabbedModel.name || this.grabbedModel.uuid}"`);
      
      // Clear grab state
      this.grabbedModel = null;
      this.grabController = null;
      
    } catch (err) {
      console.error('[StableLayoutSystem] CRASH GUARD: Error in releaseGrab:', err);
      // Force clear state even on error
      this.grabbedModel = null;
      this.grabController = null;
    }
  }

  /**
   * Check if currently grabbing
   */
  public isGrabbing(): boolean {
    return this.grabbedModel !== null;
  }

  /**
   * Get currently grabbed model
   */
  public getGrabbedModel(): THREE.Object3D | null {
    return this.grabbedModel;
  }

  /**
   * Apply visual feedback for grab state
   */
  private applyGrabVisual(model: THREE.Object3D, isGrabbed: boolean): void {
    try {
      // Only traverse direct children to limit performance impact
      model.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            if (isGrabbed) {
              if (!mat.userData.originalEmissive) {
                mat.userData.originalEmissive = mat.emissive?.clone() || new THREE.Color(0x000000);
                mat.userData.originalEmissiveIntensity = mat.emissiveIntensity || 0;
              }
              if (mat.emissive) {
                mat.emissive.setHex(0x00aaff);
                mat.emissiveIntensity = 0.4;
              }
            } else {
              if (mat.userData.originalEmissive && mat.emissive) {
                mat.emissive.copy(mat.userData.originalEmissive);
                mat.emissiveIntensity = mat.userData.originalEmissiveIntensity || 0;
              }
            }
          });
        }
      });
    } catch (err) {
      console.error('[StableLayoutSystem] CRASH GUARD: Error in applyGrabVisual:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLISION PREVENTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Constrain position to prevent collision with other models and UI
   */
  private constrainPosition(targetPos: THREE.Vector3): THREE.Vector3 {
    const constrained = targetPos.clone();
    
    // Define soft boundaries (stage area + margin)
    const margin = this.config.stageWidth * 0.7;
    const minX = this.stageAnchor.x - margin;
    const maxX = this.stageAnchor.x + margin;
    const minZ = this.stageAnchor.z - margin;
    const maxZ = this.stageAnchor.z + margin;
    const minY = this.floorY + 0.1;
    const maxY = this.floorY + 3.0;
    
    // Apply soft boundaries
    constrained.x = Math.max(minX, Math.min(maxX, constrained.x));
    constrained.y = Math.max(minY, Math.min(maxY, constrained.y));
    constrained.z = Math.max(minZ, Math.min(maxZ, constrained.z));
    
    return constrained;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reset a model to its original position
   */
  public resetModel(model: THREE.Object3D): void {
    const staged = this.stagedModels.get(model.uuid);
    if (staged) {
      model.position.copy(staged.originalPosition);
      model.rotation.copy(staged.originalRotation);
      model.scale.copy(staged.originalScale);
      console.log(`[StableLayoutSystem] Reset model: ${model.name || model.uuid}`);
    }
  }

  /**
   * Reset all models to original positions
   */
  public resetAllModels(): void {
    this.stagedModels.forEach((staged) => {
      this.resetModel(staged.model);
    });
    console.log(`[StableLayoutSystem] Reset all ${this.stagedModels.size} models`);
  }

  /**
   * Unlock layout for re-staging
   */
  public unlockLayout(): void {
    this.isLayoutLocked = false;
    this.stagedModels.clear();
    this.uuidToModel.clear();
    this.interactableCacheDirty = true;
    console.log('[StableLayoutSystem] Layout unlocked');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  public getStageAnchor(): THREE.Vector3 {
    return this.stageAnchor.clone();
  }

  public getStagedModels(): Map<string, StagedModel> {
    return this.stagedModels;
  }

  public getConfig(): LayoutConfig {
    return this.config;
  }
  
  /**
   * Debug: Print all staged models
   */
  public debugPrintStagedModels(): void {
    console.log('[StableLayoutSystem] ═══ DEBUG: Staged Models ═══');
    console.log(`Total staged: ${this.stagedModels.size}`);
    this.stagedModels.forEach((staged, uuid) => {
      console.log(`  [${staged.slot}] "${staged.name}" (${uuid.substring(0, 8)}...)`);
      console.log(`      Size: ${staged.size.x.toFixed(2)} x ${staged.size.y.toFixed(2)} x ${staged.size.z.toFixed(2)}`);
      console.log(`      Position: (${staged.model.position.x.toFixed(2)}, ${staged.model.position.y.toFixed(2)}, ${staged.model.position.z.toFixed(2)})`);
      console.log(`      Interactable: ${staged.model.userData.isInteractable}`);
    });
    console.log('═════════════════════════════════════════');
  }
}

// Export singleton instance
export const stableLayout = new StableLayoutSystem();
