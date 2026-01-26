/**
 * VR Lesson Experience System
 * 
 * World-class VR EdTech lesson layout with:
 * - Fixed side panel (LEFT) + Asset Stage (RIGHT)
 * - Professional multi-asset arrangement
 * - Ambient sound system
 * - Visual ground stage with lighting
 * - Natural Meta Quest controller interaction
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface LessonLayoutConfig {
  // Panel side preference
  panelSide: 'left' | 'right';
  
  // UI Panel configuration
  panel: {
    distance: number;      // Distance from user
    width: number;         // Panel width
    height: number;        // Panel height
    horizontalOffset: number; // Offset from center (left negative, right positive)
    verticalOffset: number;   // Height relative to eye level
    tiltAngle: number;        // Backward tilt for readability (degrees)
  };
  
  // Asset Stage configuration
  assetStage: {
    distance: number;      // Distance from user to stage center
    width: number;         // Stage width
    depth: number;         // Stage depth
    horizontalOffset: number; // Offset from center (opposite of panel)
    floorHeight: number;   // Height of stage floor above ground
  };
  
  // Model sizing
  normalizedSize: number;  // Target size for all models
  modelSpacing: number;    // Minimum spacing between models
}

export interface GrabState {
  isGrabbing: boolean;
  grabbedObject: THREE.Object3D | null;
  grabController: THREE.Group | null;
  grabOffset: THREE.Vector3;
  initialRotation: THREE.Euler;
  controllerRotationStart: THREE.Quaternion;
}

export interface AmbientSoundConfig {
  enabled: boolean;
  volume: number;
  audioUrl: string;
  loop: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_LESSON_CONFIG: LessonLayoutConfig = {
  panelSide: 'left',
  
  panel: {
    distance: 2.0,          // 2m from user
    width: 1.2,             // 1.2m wide
    height: 1.4,            // 1.4m tall
    horizontalOffset: -1.0, // 1m to the left
    verticalOffset: 0.0,    // Eye level
    tiltAngle: -8,          // 8 degrees backward tilt
  },
  
  assetStage: {
    distance: 2.5,          // 2.5m from user
    width: 3.0,             // 3m wide stage
    depth: 2.0,             // 2m deep stage
    horizontalOffset: 0.8,  // 0.8m to the right
    floorHeight: 0.0,       // At ground level
  },
  
  normalizedSize: 0.8,      // 0.8m normalized size for better viewing
  modelSpacing: 0.4,        // 40cm spacing between models
};

// ═══════════════════════════════════════════════════════════════════════════════
// VR LESSON EXPERIENCE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class VRLessonExperience {
  private config: LessonLayoutConfig;
  private scene: THREE.Scene | null = null;
  
  // User pose tracking
  private userPosition: THREE.Vector3 = new THREE.Vector3(0, 1.6, 0);
  private userForward: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private userRight: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private floorY: number = 0;
  
  // Scene elements
  private stageGroup: THREE.Group | null = null;
  private stagePlatform: THREE.Mesh | null = null;
  private stageLight: THREE.SpotLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  
  // Placed models tracking
  private placedModels: THREE.Object3D[] = [];
  private modelOriginalTransforms: Map<THREE.Object3D, {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  }> = new Map();
  
  // Grab state
  private grabState: GrabState = {
    isGrabbing: false,
    grabbedObject: null,
    grabController: null,
    grabOffset: new THREE.Vector3(),
    initialRotation: new THREE.Euler(),
    controllerRotationStart: new THREE.Quaternion(),
  };
  
  // Ambient sound
  private ambientAudio: HTMLAudioElement | null = null;
  private ambientConfig: AmbientSoundConfig = {
    enabled: true,
    volume: 0.3,
    audioUrl: '',
    loop: true,
  };
  
  // Snap-to-stage toggle - DISABLED by default for free movement
  private snapToStageEnabled: boolean = false;

  constructor(config: Partial<LessonLayoutConfig> = {}) {
    this.config = { ...DEFAULT_LESSON_CONFIG, ...config };
    console.log('[VRLessonExperience] Initialized with config:', this.config);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize the lesson experience with a scene
   */
  public initialize(scene: THREE.Scene): void {
    this.scene = scene;
    this.createStagePlatform();
    this.setupLighting();
    console.log('[VRLessonExperience] Scene initialized with stage and lighting');
  }

  /**
   * Update user pose from camera
   */
  public updateUserPose(camera: THREE.Camera, floorY: number = 0): void {
    this.floorY = floorY;
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
    
    // Update stage position relative to user
    this.updateStagePosition();
    
    console.log('[VRLessonExperience] User pose updated:', {
      position: `(${this.userPosition.x.toFixed(2)}, ${this.userPosition.y.toFixed(2)}, ${this.userPosition.z.toFixed(2)})`,
      forward: `(${this.userForward.x.toFixed(3)}, 0, ${this.userForward.z.toFixed(3)})`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE PLATFORM & LIGHTING
  // ═══════════════════════════════════════════════════════════════════════════

  private createStagePlatform(): void {
    if (!this.scene) return;
    
    // Create stage group
    this.stageGroup = new THREE.Group();
    this.stageGroup.name = 'assetStage';
    
    // Create circular stage platform
    const platformGeometry = new THREE.CylinderGeometry(1.5, 1.6, 0.1, 32);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      opacity: 0.8,
    });
    
    this.stagePlatform = new THREE.Mesh(platformGeometry, platformMaterial);
    this.stagePlatform.position.y = 0.05; // Slightly above ground
    this.stagePlatform.receiveShadow = true;
    this.stagePlatform.name = 'stagePlatform';
    
    // Add subtle rim glow
    const rimGeometry = new THREE.TorusGeometry(1.55, 0.02, 8, 64);
    const rimMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.6,
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.11;
    rim.name = 'stageRim';
    
    this.stageGroup.add(this.stagePlatform);
    this.stageGroup.add(rim);
    
    this.scene.add(this.stageGroup);
    
    console.log('[VRLessonExperience] Stage platform created');
  }

  private setupLighting(): void {
    if (!this.scene) return;
    
    // Ambient light for overall illumination
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);
    
    // Spotlight for the stage
    this.stageLight = new THREE.SpotLight(0xffffff, 1.5);
    this.stageLight.angle = Math.PI / 4;
    this.stageLight.penumbra = 0.3;
    this.stageLight.decay = 2;
    this.stageLight.distance = 10;
    this.stageLight.castShadow = true;
    this.stageLight.shadow.mapSize.width = 1024;
    this.stageLight.shadow.mapSize.height = 1024;
    this.stageLight.name = 'stageSpotlight';
    
    // Position will be updated when stage position is set
    this.scene.add(this.stageLight);
    
    // Add hemisphere light for natural sky/ground coloring
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362d26, 0.4);
    hemiLight.name = 'hemisphereLight';
    this.scene.add(hemiLight);
    
    console.log('[VRLessonExperience] Lighting setup complete');
  }

  private updateStagePosition(): void {
    if (!this.stageGroup) return;
    
    const config = this.config.assetStage;
    
    // Calculate stage position (to the RIGHT of user)
    const stagePosition = new THREE.Vector3(
      this.userPosition.x + this.userForward.x * config.distance + this.userRight.x * config.horizontalOffset,
      this.floorY + config.floorHeight,
      this.userPosition.z + this.userForward.z * config.distance + this.userRight.z * config.horizontalOffset
    );
    
    this.stageGroup.position.copy(stagePosition);
    
    // Make stage face the user
    const lookTarget = new THREE.Vector3(this.userPosition.x, stagePosition.y, this.userPosition.z);
    this.stageGroup.lookAt(lookTarget);
    
    // Update spotlight position
    if (this.stageLight) {
      this.stageLight.position.set(
        stagePosition.x,
        stagePosition.y + 4,
        stagePosition.z
      );
      this.stageLight.target.position.copy(stagePosition);
      this.stageLight.target.updateMatrixWorld();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate UI panel position and rotation
   */
  public layoutLessonPanel(): { position: THREE.Vector3; rotation: THREE.Euler } {
    const config = this.config.panel;
    const side = this.config.panelSide;
    
    // Horizontal offset based on side preference
    const horizontalOffset = side === 'left' ? -Math.abs(config.horizontalOffset) : Math.abs(config.horizontalOffset);
    
    const position = new THREE.Vector3(
      this.userPosition.x + this.userForward.x * config.distance + this.userRight.x * horizontalOffset,
      this.userPosition.y + config.verticalOffset,
      this.userPosition.z + this.userForward.z * config.distance + this.userRight.z * horizontalOffset
    );
    
    // Calculate rotation to face user with tilt
    const yRotation = Math.atan2(-this.userForward.x, -this.userForward.z);
    const xTilt = THREE.MathUtils.degToRad(config.tiltAngle);
    const rotation = new THREE.Euler(xTilt, yRotation, 0);
    
    console.log('[VRLessonExperience] Panel layout calculated:', {
      side,
      position: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`,
      tilt: `${config.tiltAngle}°`,
    });
    
    return { position, rotation };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSET STAGE LAYOUT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Layout multiple models on the asset stage
   */
  public layoutAssetStage(models: THREE.Object3D[]): THREE.Object3D[] {
    const count = models.length;
    
    console.log(`[VRLessonExperience] ═══════════════════════════════════════`);
    console.log(`[VRLessonExperience] Laying out ${count} models on Asset Stage`);
    
    // Clear previous models
    this.placedModels = [];
    this.modelOriginalTransforms.clear();
    
    // Choose arrangement mode
    const mode = this.chooseArrangementMode(count);
    console.log(`[VRLessonExperience] Using ${mode} arrangement`);
    
    // Process each model
    models.forEach((model, index) => {
      this.prepareModel(model, index, count, mode);
    });
    
    console.log(`[VRLessonExperience] ${this.placedModels.length} models placed successfully`);
    console.log(`[VRLessonExperience] ═══════════════════════════════════════`);
    
    return this.placedModels;
  }

  private chooseArrangementMode(count: number): 'single' | 'arc' | 'grid' {
    if (count === 1) return 'single';
    if (count <= 4) return 'arc';
    return 'grid';
  }

  private prepareModel(
    model: THREE.Object3D,
    index: number,
    total: number,
    mode: 'single' | 'arc' | 'grid'
  ): void {
    // Step 1: Normalize model transform
    this.normalizeModel(model);
    
    // Step 2: Scale to normalized size
    this.scaleToNormalizedSize(model);
    
    // Step 3: Calculate position based on arrangement
    const position = this.calculateModelPosition(index, total, mode);
    
    // Step 4: Apply position
    model.position.copy(position);
    
    // Step 5: Rotate to face user
    const lookTarget = new THREE.Vector3(
      this.userPosition.x,
      position.y,
      this.userPosition.z
    );
    model.lookAt(lookTarget);
    
    // Step 6: Store original transform
    this.modelOriginalTransforms.set(model, {
      position: position.clone(),
      rotation: model.rotation.clone(),
      scale: model.scale.clone(),
    });
    
    // Step 7: Make interactable
    model.userData.isInteractable = true;
    model.userData.modelIndex = index;
    model.traverse((child) => {
      child.userData.isInteractable = true;
      child.userData.parentModel = model;
    });
    
    this.placedModels.push(model);
    
    console.log(`[VRLessonExperience] Model ${index + 1}/${total} placed at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
  }

  private normalizeModel(model: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const modelBottom = box.min.y;
    
    // Center horizontally, place bottom at Y=0
    model.position.set(-center.x, -modelBottom, -center.z);
  }

  private scaleToNormalizedSize(model: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0) {
      const scale = this.config.normalizedSize / maxDim;
      model.scale.setScalar(scale);
    }
  }

  private calculateModelPosition(
    index: number,
    total: number,
    mode: 'single' | 'arc' | 'grid'
  ): THREE.Vector3 {
    if (!this.stageGroup) {
      return new THREE.Vector3(0, this.config.assetStage.floorHeight + 0.5, 0);
    }
    
    const stageCenter = this.stageGroup.position.clone();
    const stageHeight = this.config.assetStage.floorHeight + 0.15 + (this.config.normalizedSize / 2);
    
    let localX = 0, localZ = 0;
    
    switch (mode) {
      case 'single':
        // Centered on stage
        localX = 0;
        localZ = 0;
        break;
        
      case 'arc':
        // Arc arrangement
        const arcSpread = 80; // Total arc angle in degrees
        const startAngle = -arcSpread / 2;
        const angleStep = total > 1 ? arcSpread / (total - 1) : 0;
        const angle = THREE.MathUtils.degToRad(startAngle + index * angleStep);
        const radius = 0.8; // Arc radius
        
        localX = Math.sin(angle) * radius;
        localZ = -Math.cos(angle) * radius + 0.3; // Offset forward slightly
        break;
        
      case 'grid':
        // Grid arrangement (max 2 rows)
        const cols = Math.ceil(total / 2);
        const row = Math.floor(index / cols);
        const col = index % cols;
        const spacing = this.config.normalizedSize + this.config.modelSpacing;
        
        localX = (col - (cols - 1) / 2) * spacing;
        localZ = row * spacing - 0.2;
        break;
    }
    
    // Transform local position to world position (accounting for stage rotation)
    const worldOffset = new THREE.Vector3(localX, 0, localZ);
    worldOffset.applyQuaternion(this.stageGroup.quaternion);
    
    return new THREE.Vector3(
      stageCenter.x + worldOffset.x,
      stageHeight,
      stageCenter.z + worldOffset.z
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAB INTERACTION (Natural Quest Controls)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start grabbing an object - Natural Quest grab with FREE 3D movement
   */
  public startGrab(object: THREE.Object3D, controller: THREE.Group): boolean {
    // Find the root interactable model (traverse up to find the group)
    let targetModel = object;
    while (targetModel.parent && targetModel.userData.parentModel) {
      targetModel = targetModel.userData.parentModel;
    }
    // Also check if this is a child mesh - find the asset group
    if (!targetModel.userData.isInteractable) {
      let current: THREE.Object3D | null = object;
      while (current && current.parent) {
        if (current.userData.isInteractable && current.name.startsWith('assetGroup_')) {
          targetModel = current;
          break;
        }
        current = current.parent;
      }
    }
    
    if (!targetModel.userData.isInteractable) {
      console.log('[VRLessonExperience] Object not interactable:', object.name);
      return false;
    }
    
    // Get controller world position and rotation
    const controllerPos = new THREE.Vector3();
    controller.getWorldPosition(controllerPos);
    
    const controllerQuat = new THREE.Quaternion();
    controller.getWorldQuaternion(controllerQuat);
    
    // Get object's current world position
    const objectPos = new THREE.Vector3();
    targetModel.getWorldPosition(objectPos);
    
    // Calculate grab offset in world space (NOT relative to controller rotation)
    // This allows natural pulling closer/pushing away
    const grabOffset = objectPos.clone().sub(controllerPos);
    
    this.grabState = {
      isGrabbing: true,
      grabbedObject: targetModel,
      grabController: controller,
      grabOffset: grabOffset,
      initialRotation: targetModel.rotation.clone(),
      controllerRotationStart: controllerQuat.clone(),
    };
    
    // Apply grabbed visual feedback
    this.applyGrabbedVisual(targetModel, true);
    
    // Log grab start with distance info
    const grabDistance = grabOffset.length();
    console.log(`[VRLessonExperience] 🎯 GRAB START:`, {
      object: targetModel.name || 'model',
      controllerPos: `(${controllerPos.x.toFixed(2)}, ${controllerPos.y.toFixed(2)}, ${controllerPos.z.toFixed(2)})`,
      objectPos: `(${objectPos.x.toFixed(2)}, ${objectPos.y.toFixed(2)}, ${objectPos.z.toFixed(2)})`,
      grabDistance: `${grabDistance.toFixed(2)}m`,
      snapToStage: this.snapToStageEnabled ? 'ENABLED' : 'DISABLED',
    });
    
    return true;
  }

  /**
   * Update grabbed object position (call every frame)
   * FREE 3D MOVEMENT - object follows controller directly
   */
  public updateGrab(): void {
    if (!this.grabState.isGrabbing || !this.grabState.grabbedObject || !this.grabState.grabController) {
      return;
    }
    
    const controller = this.grabState.grabController;
    const object = this.grabState.grabbedObject;
    
    // Get controller world position and rotation
    const controllerPos = new THREE.Vector3();
    controller.getWorldPosition(controllerPos);
    
    const controllerQuat = new THREE.Quaternion();
    controller.getWorldQuaternion(controllerQuat);
    
    // ═══════════════════════════════════════════════════════════════════════
    // FREE 3D MOVEMENT - Object follows controller with initial offset
    // The offset is maintained in the controller's LOCAL space, allowing
    // natural pulling closer or pushing away by moving the controller
    // ═══════════════════════════════════════════════════════════════════════
    
    // Transform the initial grab offset by the controller's current rotation
    // This makes the object follow hand movements naturally
    const rotatedOffset = this.grabState.grabOffset.clone();
    
    // Apply controller rotation delta to the offset
    const rotationDelta = controllerQuat.clone().multiply(
      this.grabState.controllerRotationStart.clone().invert()
    );
    rotatedOffset.applyQuaternion(rotationDelta);
    
    // Calculate target position - object follows controller position + rotated offset
    const targetPos = controllerPos.clone().add(rotatedOffset);
    
    // Smooth interpolation for stable movement (higher value = more responsive)
    object.position.lerp(targetPos, 0.3);
    
    // Apply rotation delta to initial object rotation (natural wrist rotation)
    const targetQuat = new THREE.Quaternion().setFromEuler(this.grabState.initialRotation);
    targetQuat.premultiply(rotationDelta);
    
    // Smooth rotation interpolation
    object.quaternion.slerp(targetQuat, 0.25);
    
    // Debug: Log distance from camera periodically (every ~60 frames)
    if (Math.random() < 0.016) {
      const distFromUser = this.userPosition.distanceTo(object.position);
      console.log(`[VRLessonExperience] 📍 Grab update: distance from user = ${distFromUser.toFixed(2)}m`);
    }
  }

  /**
   * Release grabbed object
   */
  public releaseGrab(): void {
    if (!this.grabState.grabbedObject) {
      return;
    }
    
    const object = this.grabState.grabbedObject;
    
    // Remove grabbed visual feedback
    this.applyGrabbedVisual(object, false);
    
    // Snap to stage if enabled
    if (this.snapToStageEnabled) {
      this.snapToStage(object);
    }
    
    console.log(`[VRLessonExperience] Released: ${object.name || 'model'}`);
    
    // Reset grab state
    this.grabState = {
      isGrabbing: false,
      grabbedObject: null,
      grabController: null,
      grabOffset: new THREE.Vector3(),
      initialRotation: new THREE.Euler(),
      controllerRotationStart: new THREE.Quaternion(),
    };
  }

  private applyGrabbedVisual(object: THREE.Object3D, isGrabbed: boolean): void {
    object.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat: any) => {
          if (isGrabbed) {
            // Store original and apply glow
            if (!mat.userData.originalEmissive) {
              mat.userData.originalEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
              mat.userData.originalEmissiveIntensity = mat.emissiveIntensity || 0;
            }
            if (mat.emissive) {
              mat.emissive.setHex(0x00aaff);
              mat.emissiveIntensity = 0.4;
            }
          } else {
            // Restore original
            if (mat.userData.originalEmissive && mat.emissive) {
              mat.emissive.copy(mat.userData.originalEmissive);
              mat.emissiveIntensity = mat.userData.originalEmissiveIntensity || 0;
            }
          }
        });
      }
    });
  }

  private snapToStage(object: THREE.Object3D): void {
    if (!this.stageGroup) return;
    
    const stageCenter = this.stageGroup.position.clone();
    const stageRadius = 1.4;
    
    // Check if object is within stage bounds
    const objectPos = object.position.clone();
    const distanceFromStage = new THREE.Vector2(
      objectPos.x - stageCenter.x,
      objectPos.z - stageCenter.z
    ).length();
    
    if (distanceFromStage > stageRadius) {
      // Object is outside stage - snap it back to nearest position on stage
      const direction = new THREE.Vector2(
        objectPos.x - stageCenter.x,
        objectPos.z - stageCenter.z
      ).normalize();
      
      const snappedPos = new THREE.Vector3(
        stageCenter.x + direction.x * (stageRadius - 0.3),
        this.config.assetStage.floorHeight + 0.15 + (this.config.normalizedSize / 2),
        stageCenter.z + direction.y * (stageRadius - 0.3)
      );
      
      // Animate snap
      this.animateSnap(object, snappedPos);
    }
  }

  private animateSnap(object: THREE.Object3D, targetPos: THREE.Vector3): void {
    const startPos = object.position.clone();
    const duration = 300; // ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // Ease out cubic
      
      object.position.lerpVectors(startPos, targetPos, eased);
      
      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reset a specific model to its original position
   */
  public resetModel(model: THREE.Object3D): void {
    const originalTransform = this.modelOriginalTransforms.get(model);
    if (originalTransform) {
      model.position.copy(originalTransform.position);
      model.rotation.copy(originalTransform.rotation);
      model.scale.copy(originalTransform.scale);
      console.log(`[VRLessonExperience] Reset model: ${model.name || 'unnamed'}`);
    }
  }

  /**
   * Reset all models to their original positions
   */
  public resetAllModels(): void {
    this.placedModels.forEach((model) => this.resetModel(model));
    console.log(`[VRLessonExperience] Reset all ${this.placedModels.length} models`);
  }

  /**
   * Focus on a specific model (bring to front, fade others)
   */
  public focusModel(targetModel: THREE.Object3D): void {
    this.placedModels.forEach((model) => {
      if (model === targetModel) {
        // Bring to focus
        model.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.opacity = 1.0;
              mat.transparent = false;
            });
          }
        });
      } else {
        // Fade out
        model.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.transparent = true;
              mat.opacity = 0.3;
            });
          }
        });
      }
    });
    
    console.log(`[VRLessonExperience] Focused on model: ${targetModel.name || 'unnamed'}`);
  }

  /**
   * Clear focus (restore all models to full opacity)
   */
  public clearFocus(): void {
    this.placedModels.forEach((model) => {
      model.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            mat.opacity = 1.0;
            mat.transparent = false;
          });
        }
      });
    });
    
    console.log('[VRLessonExperience] Focus cleared');
  }

  /**
   * Toggle snap-to-stage behavior
   */
  public setSnapToStage(enabled: boolean): void {
    this.snapToStageEnabled = enabled;
    console.log(`[VRLessonExperience] Snap-to-stage: ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT SOUND
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize ambient sound system
   */
  public initAmbientSound(audioUrl: string): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }
    
    if (!audioUrl) {
      // Use default ambient sound (you can provide a default URL)
      console.log('[VRLessonExperience] No ambient audio URL provided');
      return;
    }
    
    this.ambientAudio = new Audio(audioUrl);
    this.ambientAudio.loop = this.ambientConfig.loop;
    this.ambientAudio.volume = this.ambientConfig.volume;
    
    this.ambientConfig.audioUrl = audioUrl;
    
    console.log('[VRLessonExperience] Ambient sound initialized');
  }

  /**
   * Play ambient sound
   */
  public playAmbientSound(): void {
    if (this.ambientAudio && this.ambientConfig.enabled) {
      this.ambientAudio.play().catch((err) => {
        console.warn('[VRLessonExperience] Could not play ambient sound:', err);
      });
    }
  }

  /**
   * Pause ambient sound
   */
  public pauseAmbientSound(): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  /**
   * Set ambient sound volume
   */
  public setAmbientVolume(volume: number): void {
    this.ambientConfig.volume = Math.max(0, Math.min(1, volume));
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.ambientConfig.volume;
    }
  }

  /**
   * Toggle ambient sound enabled
   */
  public setAmbientEnabled(enabled: boolean): void {
    this.ambientConfig.enabled = enabled;
    if (!enabled && this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  public getPlacedModels(): THREE.Object3D[] {
    return this.placedModels;
  }

  public getGrabState(): GrabState {
    return this.grabState;
  }

  public isGrabbing(): boolean {
    return this.grabState.isGrabbing;
  }

  public getGrabbedObject(): THREE.Object3D | null {
    return this.grabState.grabbedObject;
  }

  public getStageGroup(): THREE.Group | null {
    return this.stageGroup;
  }

  public getConfig(): LessonLayoutConfig {
    return this.config;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  public dispose(): void {
    // Stop ambient sound
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }
    
    // Clear placed models
    this.placedModels = [];
    this.modelOriginalTransforms.clear();
    
    // Reset grab state
    this.grabState = {
      isGrabbing: false,
      grabbedObject: null,
      grabController: null,
      grabOffset: new THREE.Vector3(),
      initialRotation: new THREE.Euler(),
      controllerRotationStart: new THREE.Quaternion(),
    };
    
    console.log('[VRLessonExperience] Disposed');
  }
}

// Export singleton instance for convenience
export const vrLessonExperience = new VRLessonExperience();
