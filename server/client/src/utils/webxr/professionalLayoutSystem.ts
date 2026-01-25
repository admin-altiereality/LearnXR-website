/**
 * Professional XR Layout System
 * 
 * Implements a controlled lesson layout with:
 * - Three distinct zones (UI, Asset, Interaction)
 * - Bounding box collision detection
 * - Multi-asset arrangement (arc/grid layouts)
 * - Collision-aware placement
 * - Physics-like rigid body behavior
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ZoneConfig {
  // UI Zone - where the lesson panel lives
  uiZone: {
    distance: number;      // Distance from user (meters)
    height: number;        // Height relative to eye level
    width: number;         // Panel width for collision
    depth: number;         // Panel depth for collision (thin)
  };
  // Asset Zone - where 3D models are placed
  assetZone: {
    minDistance: number;   // Minimum distance from user
    maxDistance: number;   // Maximum distance from user
    horizontalSpread: number; // Total horizontal angle (degrees)
    verticalOffset: number;   // Height offset from floor
  };
  // Interaction Zone - safe area for grabbing/moving
  interactionZone: {
    minDistance: number;
    maxDistance: number;
    floorY: number;
    ceilingY: number;
  };
}

export interface PlacedAsset {
  object: THREE.Object3D;
  boundingBox: THREE.Box3;
  collider: CollisionBox;
  originalPosition: THREE.Vector3;
  originalRotation: THREE.Euler;
  originalScale: THREE.Vector3;
  index: number;
  isGrabbed: boolean;
}

export interface CollisionBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

export interface LayoutResult {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  success: boolean;
  attempts: number;
  collisionResolved: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_ZONE_CONFIG: ZoneConfig = {
  uiZone: {
    distance: 2.0,       // 2m in front of user
    height: 0.0,         // Eye level
    width: 1.2,          // 1.2m wide panel
    depth: 0.1,          // 10cm deep collision volume
  },
  assetZone: {
    minDistance: 1.8,    // Assets start at 1.8m
    maxDistance: 3.5,    // Assets end at 3.5m
    horizontalSpread: 120, // 120° total spread (60° each side)
    verticalOffset: 1.0,   // 1m above floor (table height)
  },
  interactionZone: {
    minDistance: 0.5,    // Can grab as close as 0.5m
    maxDistance: 4.0,    // Can reach up to 4m
    floorY: 0.0,         // Floor level
    ceilingY: 3.0,       // 3m ceiling
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT SYSTEM CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ProfessionalLayoutSystem {
  private config: ZoneConfig;
  private placedAssets: PlacedAsset[] = [];
  private uiCollider: CollisionBox | null = null;
  private userPosition: THREE.Vector3 = new THREE.Vector3(0, 1.6, 0);
  private userForward: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private userRight: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private floorY: number = 0;
  private normalizedSize: number = 1.0;
  private assetSpacing: number = 0.3; // 30cm minimum spacing between assets

  constructor(config: Partial<ZoneConfig> = {}) {
    this.config = { ...DEFAULT_ZONE_CONFIG, ...config };
    console.log('[LayoutSystem] Initialized with config:', this.config);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update user pose (call this on each frame or when entering VR)
   */
  public updateUserPose(camera: THREE.Camera, floorY: number = 0): void {
    this.floorY = floorY;
    
    // Get camera world position
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
    
    console.log('[LayoutSystem] User pose updated:', {
      position: `(${this.userPosition.x.toFixed(2)}, ${this.userPosition.y.toFixed(2)}, ${this.userPosition.z.toFixed(2)})`,
      forward: `(${this.userForward.x.toFixed(3)}, 0, ${this.userForward.z.toFixed(3)})`,
      floorY: this.floorY,
    });
  }

  /**
   * Set the normalized size for assets
   */
  public setNormalizedSize(size: number): void {
    this.normalizedSize = size;
  }

  /**
   * Compute the lesson anchor pose (center of the learning area)
   */
  public computeLessonAnchorPose(): { position: THREE.Vector3; rotation: THREE.Euler } {
    const anchorDistance = (this.config.assetZone.minDistance + this.config.assetZone.maxDistance) / 2;
    
    const position = new THREE.Vector3(
      this.userPosition.x + this.userForward.x * anchorDistance,
      this.floorY + this.config.assetZone.verticalOffset,
      this.userPosition.z + this.userForward.z * anchorDistance
    );
    
    // Rotation to face the user
    const rotation = new THREE.Euler(0, Math.atan2(-this.userForward.x, -this.userForward.z), 0);
    
    return { position, rotation };
  }

  /**
   * Compute UI panel anchor position and create its collision box
   */
  public layoutUIAnchor(): { position: THREE.Vector3; rotation: THREE.Euler; collider: CollisionBox } {
    const config = this.config.uiZone;
    
    // Position UI panel to the LEFT of center (assets go RIGHT)
    const leftOffset = -0.8; // 0.8m to the left
    
    const position = new THREE.Vector3(
      this.userPosition.x + this.userForward.x * config.distance + this.userRight.x * leftOffset,
      this.userPosition.y + config.height,
      this.userPosition.z + this.userForward.z * config.distance + this.userRight.z * leftOffset
    );
    
    // Slight tilt for readability (5 degrees backward)
    const tiltAngle = THREE.MathUtils.degToRad(-5);
    const yRotation = Math.atan2(-this.userForward.x, -this.userForward.z);
    const rotation = new THREE.Euler(tiltAngle, yRotation, 0);
    
    // Create collision box for UI panel
    const halfWidth = config.width / 2;
    const halfHeight = 0.8; // Assume 1.6m tall panel
    const halfDepth = config.depth / 2;
    
    this.uiCollider = {
      min: new THREE.Vector3(
        position.x - halfWidth,
        position.y - halfHeight,
        position.z - halfDepth
      ),
      max: new THREE.Vector3(
        position.x + halfWidth,
        position.y + halfHeight,
        position.z + halfDepth
      ),
      center: position.clone(),
      size: new THREE.Vector3(config.width, 1.6, config.depth),
    };
    
    console.log('[LayoutSystem] UI Anchor computed:', {
      position: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`,
      colliderSize: `${config.width} x 1.6 x ${config.depth}`,
    });
    
    return { position, rotation, collider: this.uiCollider };
  }

  /**
   * Layout multiple assets with collision-aware placement
   */
  public layoutAssets(models: THREE.Object3D[], scene: THREE.Scene): PlacedAsset[] {
    console.log(`[LayoutSystem] ═══════════════════════════════════════`);
    console.log(`[LayoutSystem] Laying out ${models.length} assets`);
    
    // Clear previous placements
    this.placedAssets = [];
    
    // Choose layout strategy based on count
    const layoutStrategy = this.chooseLayoutStrategy(models.length);
    console.log(`[LayoutSystem] Using ${layoutStrategy} layout strategy`);
    
    // Process each model
    models.forEach((model, index) => {
      const result = this.placeAsset(model, index, models.length, layoutStrategy);
      if (result) {
        this.placedAssets.push(result);
      }
    });
    
    console.log(`[LayoutSystem] Successfully placed ${this.placedAssets.length}/${models.length} assets`);
    console.log(`[LayoutSystem] ═══════════════════════════════════════`);
    
    return this.placedAssets;
  }

  /**
   * Check if a position collides with any existing object
   */
  public checkCollision(box: CollisionBox): { collides: boolean; collidingWith: string[] } {
    const collidingWith: string[] = [];
    
    // Check against UI panel
    if (this.uiCollider && this.boxesIntersect(box, this.uiCollider)) {
      collidingWith.push('UI_PANEL');
    }
    
    // Check against other placed assets
    this.placedAssets.forEach((asset, index) => {
      if (this.boxesIntersect(box, asset.collider)) {
        collidingWith.push(`ASSET_${index}`);
      }
    });
    
    return {
      collides: collidingWith.length > 0,
      collidingWith,
    };
  }

  /**
   * Apply collision constraints to a moving object
   */
  public constrainMovement(
    object: THREE.Object3D,
    proposedPosition: THREE.Vector3
  ): THREE.Vector3 {
    // Get the object's bounding box at proposed position
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const offset = proposedPosition.clone().sub(object.position);
    
    const proposedBox: CollisionBox = {
      min: box.min.clone().add(offset),
      max: box.max.clone().add(offset),
      center: proposedPosition.clone(),
      size: size,
    };
    
    // Check for collisions
    const collision = this.checkCollision(proposedBox);
    
    if (!collision.collides) {
      return proposedPosition;
    }
    
    // Collision detected - try to resolve
    console.log(`[LayoutSystem] Collision detected with: ${collision.collidingWith.join(', ')}`);
    
    // Simple resolution: push back to original position
    // In a full physics engine, we'd compute the penetration vector and push out
    return object.position.clone();
  }

  /**
   * Get all placed assets
   */
  public getPlacedAssets(): PlacedAsset[] {
    return this.placedAssets;
  }

  /**
   * Reset an asset to its original position
   */
  public resetAsset(index: number): void {
    const asset = this.placedAssets[index];
    if (asset) {
      asset.object.position.copy(asset.originalPosition);
      asset.object.rotation.copy(asset.originalRotation);
      asset.object.scale.copy(asset.originalScale);
      this.updateAssetCollider(asset);
      console.log(`[LayoutSystem] Reset asset ${index} to original position`);
    }
  }

  /**
   * Reset all assets to original positions
   */
  public resetAllAssets(): void {
    this.placedAssets.forEach((_, index) => this.resetAsset(index));
    console.log(`[LayoutSystem] Reset all ${this.placedAssets.length} assets`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private chooseLayoutStrategy(count: number): 'single' | 'arc' | 'grid' {
    if (count === 1) return 'single';
    if (count <= 4) return 'arc';
    return 'grid';
  }

  private placeAsset(
    model: THREE.Object3D,
    index: number,
    total: number,
    strategy: 'single' | 'arc' | 'grid'
  ): PlacedAsset | null {
    console.log(`\n[LayoutSystem] Processing Asset ${index + 1}/${total}`);
    
    // Step 1: Normalize the model transform
    this.normalizeModelTransform(model);
    
    // Step 2: Fit to target size
    this.fitModelToTargetSize(model, this.normalizedSize);
    
    // Step 3: Compute bounding box after normalization
    const boundingBox = new THREE.Box3().setFromObject(model);
    const size = boundingBox.getSize(new THREE.Vector3());
    
    console.log(`[LayoutSystem] Asset ${index + 1} normalized size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
    
    // Step 4: Calculate target position based on strategy
    let targetPosition: THREE.Vector3;
    
    switch (strategy) {
      case 'single':
        targetPosition = this.calculateSinglePosition();
        break;
      case 'arc':
        targetPosition = this.calculateArcPosition(index, total);
        break;
      case 'grid':
        targetPosition = this.calculateGridPosition(index, total);
        break;
    }
    
    // Step 5: Find collision-free position
    const finalPosition = this.findCollisionFreePosition(targetPosition, size, index);
    
    // Step 6: Apply position and rotation
    model.position.copy(finalPosition);
    
    // Rotate to face user
    const lookAtTarget = new THREE.Vector3(
      this.userPosition.x,
      finalPosition.y,
      this.userPosition.z
    );
    model.lookAt(lookAtTarget);
    
    // Step 7: Create collider
    const updatedBox = new THREE.Box3().setFromObject(model);
    const collider: CollisionBox = {
      min: updatedBox.min.clone(),
      max: updatedBox.max.clone(),
      center: finalPosition.clone(),
      size: size.clone(),
    };
    
    // Step 8: Create PlacedAsset record
    const placedAsset: PlacedAsset = {
      object: model,
      boundingBox: updatedBox,
      collider,
      originalPosition: finalPosition.clone(),
      originalRotation: model.rotation.clone(),
      originalScale: model.scale.clone(),
      index,
      isGrabbed: false,
    };
    
    console.log(`[LayoutSystem] Asset ${index + 1} placed at: (${finalPosition.x.toFixed(2)}, ${finalPosition.y.toFixed(2)}, ${finalPosition.z.toFixed(2)})`);
    
    return placedAsset;
  }

  private normalizeModelTransform(model: THREE.Object3D): void {
    // Compute bounding box
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Find the bottom of the model
    const modelBottom = box.min.y;
    
    // Create wrapper group if model is a direct scene
    if (model.children.length > 0) {
      // Move children so model's bottom is at Y=0 and centered on X/Z
      model.children.forEach((child) => {
        child.position.x -= center.x;
        child.position.y -= modelBottom; // Bottom at Y=0
        child.position.z -= center.z;
      });
    } else {
      // Move the model itself
      model.position.set(-center.x, -modelBottom, -center.z);
    }
    
    console.log(`[LayoutSystem] Model normalized - bottom at Y=0, centered on X/Z`);
  }

  private fitModelToTargetSize(model: THREE.Object3D, targetSize: number): void {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0) {
      const scale = targetSize / maxDim;
      model.scale.multiplyScalar(scale);
      console.log(`[LayoutSystem] Scaled model by ${scale.toFixed(4)} to fit ${targetSize}m`);
    }
  }

  private calculateSinglePosition(): THREE.Vector3 {
    // Single asset: center-right of view
    const distance = this.config.assetZone.minDistance + 0.5;
    const rightOffset = 0.8; // Slightly to the right
    
    return new THREE.Vector3(
      this.userPosition.x + this.userForward.x * distance + this.userRight.x * rightOffset,
      this.floorY + this.config.assetZone.verticalOffset,
      this.userPosition.z + this.userForward.z * distance + this.userRight.z * rightOffset
    );
  }

  private calculateArcPosition(index: number, total: number): THREE.Vector3 {
    // Arc layout: spread assets in a semicircle to the RIGHT of center
    const spreadAngle = Math.min(this.config.assetZone.horizontalSpread, 90); // Max 90° for arc
    const startAngle = -spreadAngle / 2; // Start from right-center
    const angleStep = total > 1 ? spreadAngle / (total - 1) : 0;
    const angle = THREE.MathUtils.degToRad(startAngle + index * angleStep);
    
    const distance = this.config.assetZone.minDistance + 0.3 + (index * 0.2); // Stagger depth
    
    // Rotate the forward vector by the angle
    const rotatedForward = new THREE.Vector3(
      this.userForward.x * Math.cos(angle) - this.userForward.z * Math.sin(angle),
      0,
      this.userForward.x * Math.sin(angle) + this.userForward.z * Math.cos(angle)
    ).normalize();
    
    // Apply right offset to move arc to the right side
    const rightOffset = 0.6;
    
    return new THREE.Vector3(
      this.userPosition.x + rotatedForward.x * distance + this.userRight.x * rightOffset,
      this.floorY + this.config.assetZone.verticalOffset,
      this.userPosition.z + rotatedForward.z * distance + this.userRight.z * rightOffset
    );
  }

  private calculateGridPosition(index: number, total: number): THREE.Vector3 {
    // Grid layout: 2 rows max
    const cols = Math.ceil(total / 2);
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    const spacing = this.normalizedSize + this.assetSpacing;
    const startX = -((cols - 1) * spacing) / 2;
    
    const xOffset = startX + col * spacing;
    const zOffset = row * spacing;
    
    const distance = this.config.assetZone.minDistance + 0.5 + zOffset;
    const rightOffset = 0.5 + xOffset;
    
    return new THREE.Vector3(
      this.userPosition.x + this.userForward.x * distance + this.userRight.x * rightOffset,
      this.floorY + this.config.assetZone.verticalOffset,
      this.userPosition.z + this.userForward.z * distance + this.userRight.z * rightOffset
    );
  }

  private findCollisionFreePosition(
    targetPosition: THREE.Vector3,
    size: THREE.Vector3,
    assetIndex: number
  ): THREE.Vector3 {
    const halfSize = size.clone().multiplyScalar(0.5);
    const padding = this.assetSpacing / 2;
    
    let position = targetPosition.clone();
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      // Create collision box at current position
      const collider: CollisionBox = {
        min: new THREE.Vector3(
          position.x - halfSize.x - padding,
          position.y,
          position.z - halfSize.z - padding
        ),
        max: new THREE.Vector3(
          position.x + halfSize.x + padding,
          position.y + size.y + padding,
          position.z + halfSize.z + padding
        ),
        center: position.clone(),
        size: size.clone(),
      };
      
      const collision = this.checkCollision(collider);
      
      if (!collision.collides) {
        if (attempts > 0) {
          console.log(`[LayoutSystem] Found collision-free position after ${attempts} attempts`);
        }
        return position;
      }
      
      // Collision detected - try to resolve
      console.log(`[LayoutSystem] Collision at attempt ${attempts + 1}: ${collision.collidingWith.join(', ')}`);
      
      // Move position based on what we collided with
      if (collision.collidingWith.includes('UI_PANEL')) {
        // Move to the right (away from UI)
        position.x += this.userRight.x * 0.3;
        position.z += this.userRight.z * 0.3;
      } else {
        // Move further from user and slightly right
        position.x += this.userForward.x * 0.2 + this.userRight.x * 0.15;
        position.z += this.userForward.z * 0.2 + this.userRight.z * 0.15;
      }
      
      attempts++;
    }
    
    console.warn(`[LayoutSystem] Could not find collision-free position after ${maxAttempts} attempts`);
    return position;
  }

  private updateAssetCollider(asset: PlacedAsset): void {
    const box = new THREE.Box3().setFromObject(asset.object);
    asset.boundingBox = box;
    asset.collider = {
      min: box.min.clone(),
      max: box.max.clone(),
      center: box.getCenter(new THREE.Vector3()),
      size: box.getSize(new THREE.Vector3()),
    };
  }

  private boxesIntersect(a: CollisionBox, b: CollisionBox): boolean {
    return (
      a.min.x <= b.max.x && a.max.x >= b.min.x &&
      a.min.y <= b.max.y && a.max.y >= b.min.y &&
      a.min.z <= b.max.z && a.max.z >= b.min.z
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Standalone)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a model's transform (center horizontally, bottom at Y=0)
 */
export function normalizeModelTransform(model: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const modelBottom = box.min.y;
  
  // Offset to center X/Z and put bottom at Y=0
  model.position.set(-center.x, -modelBottom, -center.z);
  
  return new THREE.Box3().setFromObject(model);
}

/**
 * Fit a model to a target size (preserving aspect ratio)
 */
export function fitModelToTargetSize(model: THREE.Object3D, targetMeters: number): number {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  
  if (maxDim > 0) {
    const scale = targetMeters / maxDim;
    model.scale.setScalar(scale);
    return scale;
  }
  return 1;
}

/**
 * Create a collision box from a Three.js object
 */
export function createCollisionBox(object: THREE.Object3D): CollisionBox {
  const box = new THREE.Box3().setFromObject(object);
  return {
    min: box.min.clone(),
    max: box.max.clone(),
    center: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3()),
  };
}

/**
 * Check if two collision boxes intersect
 */
export function checkBoxCollision(a: CollisionBox, b: CollisionBox): boolean {
  return (
    a.min.x <= b.max.x && a.max.x >= b.min.x &&
    a.min.y <= b.max.y && a.max.y >= b.min.y &&
    a.min.z <= b.max.z && a.max.z >= b.min.z
  );
}

/**
 * Compute minimum separation distance between two boxes
 */
export function computeSeparation(a: CollisionBox, b: CollisionBox): THREE.Vector3 {
  const separation = new THREE.Vector3();
  
  // X axis
  if (a.max.x < b.min.x) {
    separation.x = b.min.x - a.max.x;
  } else if (b.max.x < a.min.x) {
    separation.x = a.min.x - b.max.x;
  }
  
  // Y axis
  if (a.max.y < b.min.y) {
    separation.y = b.min.y - a.max.y;
  } else if (b.max.y < a.min.y) {
    separation.y = a.min.y - b.max.y;
  }
  
  // Z axis
  if (a.max.z < b.min.z) {
    separation.z = b.min.z - a.max.z;
  } else if (b.max.z < a.min.z) {
    separation.z = a.min.z - b.max.z;
  }
  
  return separation;
}

// Export default instance for convenience
export const layoutSystem = new ProfessionalLayoutSystem();
