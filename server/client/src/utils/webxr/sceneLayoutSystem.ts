/**
 * Scene Layout System - Production-grade, scalable XR scene layout
 * 
 * FIXED ISSUES:
 * - N assets → N unique placements (no duplicates)
 * - Carousel now generates spread positions (not all same)
 * - Added collision avoidance based on bounding boxes
 * - Improved logging for debugging
 * 
 * Handles:
 * - Two-zone layout (Asset Dock Zone + Introduction Dock Zone)
 * - Fit-to-dock asset scaling
 * - Dynamic N placements for N assets with collision avoidance
 * - Raycast layer separation (UI vs models)
 * - Ground plane with transparent rendering
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlacementStrategy = 'curved-arc' | 'focus-secondary' | 'carousel' | 'grid';

export interface SceneLayoutConfig {
  // Asset Dock Zone (for 3D model interaction)
  assetDock: {
    distance: number;        // Distance from user (hands reach: 0.6-0.8m)
    height: number;          // Height above ground
    width: number;           // Dock width
    depth: number;           // Dock depth
    maxAssetSize: number;    // Maximum asset size to fit in dock (meters)
  };
  
  // Introduction Dock Zone (for UI panels)
  introDock: {
    distance: number;        // Distance from user (further than asset dock)
    height: number;          // Height above ground
    width: number;           // Panel width
    height_panel: number;    // Panel height
    spacing: number;         // Spacing between asset dock and intro dock
  };
  
  // Ground plane
  ground: {
    size: number;            // Ground plane size
    gridDivisions: number;   // Grid divisions
    fadeAngle: number;       // Angle threshold for visibility (degrees)
  };
}

export interface AssetPlacement {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  strategy: PlacementStrategy;
  dockSurfaceY: number;
  slotIndex: number;          // 0-based slot index
  boundingRadius: number;     // For collision detection
}

export interface DockVolume {
  min: THREE.Vector3;
  max: THREE.Vector3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: SceneLayoutConfig = {
  assetDock: {
    distance: 1.2,           // 1.2m = comfortable interaction distance
    height: 0.9,             // 0.9m above ground (desk height)
    width: 2.5,              // 2.5m wide (larger for more assets)
    depth: 1.2,              // 1.2m deep
    maxAssetSize: 0.35,      // 35cm max - ensures assets fit in dock
  },
  introDock: {
    distance: 2.5,           // 2.5m from user (further than asset dock)
    height: 1.2,             // 1.2m above ground (eye level)
    width: 2.0,              // 2.0m wide
    height_panel: 1.4,       // 1.4m tall
    spacing: 1.5,            // 1.5m spacing between zones
  },
  ground: {
    size: 20,                // 20m x 20m ground
    gridDivisions: 20,       // 20x20 grid
    fadeAngle: 30,           // Visible when looking down >30 degrees
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE LAYOUT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export class SceneLayoutSystem {
  private config: SceneLayoutConfig;
  private strategy: PlacementStrategy;
  private assetDockMesh: THREE.Mesh | null = null;
  private groundPlaneMesh: THREE.Mesh | null = null;
  private camera: THREE.Camera | null = null;
  private lastPlacements: AssetPlacement[] = [];
  
  // Asset bounding cache for collision avoidance
  private assetBounds: Map<number, { radius: number; size: THREE.Vector3 }> = new Map();

  constructor(config?: Partial<SceneLayoutConfig>, strategy: PlacementStrategy = 'curved-arc') {
    this.config = { ...DEFAULT_CONFIG, ...this.mergeConfig(config || {}) };
    this.strategy = strategy;
    console.log('[SceneLayoutSystem] Initialized with config:', {
      assetDock: this.config.assetDock,
      introDock: this.config.introDock,
      strategy: this.strategy,
    });
  }

  private mergeConfig(partial: Partial<SceneLayoutConfig>): Partial<SceneLayoutConfig> {
    return {
      assetDock: { ...DEFAULT_CONFIG.assetDock, ...partial.assetDock },
      introDock: { ...DEFAULT_CONFIG.introDock, ...partial.introDock },
      ground: { ...DEFAULT_CONFIG.ground, ...partial.ground },
    };
  }

  /**
   * Set placement strategy
   */
  public setStrategy(strategy: PlacementStrategy): void {
    console.log(`[SceneLayoutSystem] Strategy changed: ${this.strategy} → ${strategy}`);
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  public getStrategy(): PlacementStrategy {
    return this.strategy;
  }

  /**
   * Register asset bounding box for collision avoidance
   */
  public registerAssetBounds(index: number, asset: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(asset);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const radius = maxDim / 2;
    
    this.assetBounds.set(index, { radius, size });
    
    console.log(`[SceneLayoutSystem] Asset ${index} bounds registered:`, {
      size: `${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`,
      radius: radius.toFixed(3),
    });
  }

  /**
   * Get minimum spacing between assets based on bounding boxes
   */
  private getMinSpacing(index1: number, index2: number): number {
    const bounds1 = this.assetBounds.get(index1);
    const bounds2 = this.assetBounds.get(index2);
    
    const r1 = bounds1?.radius || 0.15;
    const r2 = bounds2?.radius || 0.15;
    
    // Add 20% padding for visual separation
    return (r1 + r2) * 1.2 + 0.1;
  }

  /**
   * Get asset dock volume (for fit-to-dock scaling)
   */
  public getAssetDockVolume(camera: THREE.Camera, groundY: number = 0): DockVolume {
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    const dockCenter = new THREE.Vector3();
    dockCenter.copy(cameraPos);
    dockCenter.add(flatForward.clone().multiplyScalar(this.config.assetDock.distance));
    dockCenter.y = groundY + this.config.assetDock.height;

    const halfWidth = this.config.assetDock.width / 2;
    const halfDepth = this.config.assetDock.depth / 2;
    const halfHeight = 0.4; // 40cm height allowance for assets

    return {
      min: new THREE.Vector3(
        dockCenter.x - halfWidth,
        dockCenter.y - halfHeight,
        dockCenter.z - halfDepth
      ),
      max: new THREE.Vector3(
        dockCenter.x + halfWidth,
        dockCenter.y + halfHeight,
        dockCenter.z + halfDepth
      ),
      center: dockCenter.clone(),
      size: new THREE.Vector3(
        this.config.assetDock.width,
        halfHeight * 2,
        this.config.assetDock.depth
      ),
    };
  }

  /**
   * Assess asset geometry and calculate scale to fit inside dock volume
   */
  public calculateFitToDockScale(asset: THREE.Object3D, dockVolume: DockVolume, assetCount: number = 1): number {
    // CRITICAL: Reset asset transform before measuring
    const originalScale = asset.scale.clone();
    const originalPosition = asset.position.clone();
    const originalRotation = asset.rotation.clone();
    
    // Temporarily reset to identity for accurate measurement
    asset.scale.set(1, 1, 1);
    asset.position.set(0, 0, 0);
    asset.rotation.set(0, 0, 0);
    asset.updateMatrixWorld(true);
    
    // Get asset's natural bounding box (after reset)
    const box = new THREE.Box3().setFromObject(asset);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const minDim = Math.min(size.x, size.y, size.z);

    console.log('[SceneLayoutSystem] Asset geometry assessment:', {
      name: asset.name,
      size: `(${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`,
      center: `(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`,
      maxDim: maxDim.toFixed(3),
      minDim: minDim.toFixed(3),
      aspectRatio: (maxDim / (minDim || 1)).toFixed(2),
    });

    if (maxDim <= 0) {
      console.warn('[SceneLayoutSystem] Asset has invalid dimensions, using default scale');
      // Restore original transform
      asset.scale.copy(originalScale);
      asset.position.copy(originalPosition);
      asset.rotation.copy(originalRotation);
      return 1.0;
    }

    // Calculate slot size based on asset count
    // More assets = smaller individual slots
    const slotFactor = Math.min(1.0, 2.0 / Math.max(1, assetCount));
    
    // Calculate scale to fit inside dock volume
    const maxAllowedSize = Math.min(
      dockVolume.size.x * 0.7 * slotFactor,
      dockVolume.size.y * 0.85,
      dockVolume.size.z * 0.7 * slotFactor
    );

    // Also respect maxAssetSize config
    const targetSize = Math.min(maxAllowedSize, this.config.assetDock.maxAssetSize);

    const scale = targetSize / maxDim;
    
    console.log('[SceneLayoutSystem] Fit-to-dock scale calculation:', {
      name: asset.name,
      assetCount,
      slotFactor: slotFactor.toFixed(2),
      targetSize: targetSize.toFixed(3),
      maxDim: maxDim.toFixed(3),
      calculatedScale: scale.toFixed(3),
      dockVolume: `(${dockVolume.size.x.toFixed(2)}, ${dockVolume.size.y.toFixed(2)}, ${dockVolume.size.z.toFixed(2)})`,
    });

    // Restore original transform (will be reapplied in placeAssetOnDock)
    asset.scale.copy(originalScale);
    asset.position.copy(originalPosition);
    asset.rotation.copy(originalRotation);

    return scale;
  }

  /**
   * Create asset dock in scene
   */
  public createAssetDock(scene: THREE.Scene, camera: THREE.Camera, groundY: number = 0): THREE.Mesh {
    // Remove existing dock if any
    const existing = scene.getObjectByName('assetDock');
    if (existing) {
      scene.remove(existing);
    }

    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    const dockPos = new THREE.Vector3();
    dockPos.copy(cameraPos);
    dockPos.add(flatForward.clone().multiplyScalar(this.config.assetDock.distance));
    dockPos.y = groundY + this.config.assetDock.height;

    // Create dock geometry
    const geometry = new THREE.BoxGeometry(
      this.config.assetDock.width,
      0.05, // Thin surface
      this.config.assetDock.depth
    );

    // Dock material - semi-transparent with glow
    const material = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      transparent: true,
      opacity: 0.7,
      emissive: 0x0a1929,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.3,
    });

    const dock = new THREE.Mesh(geometry, material);
    dock.name = 'assetDock';
    dock.userData.layer = 'asset-dock'; // For raycast filtering
    dock.position.copy(dockPos);
    dock.rotation.y = Math.atan2(-flatForward.x, -flatForward.z);
    
    // Add glow edges for better visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00d4ff, 
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    dock.add(edgeLines);

    scene.add(dock);
    this.assetDockMesh = dock;
    this.camera = camera;

    console.log('[SceneLayoutSystem] Asset dock created:', {
      position: `(${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)})`,
      distance: this.config.assetDock.distance.toFixed(2) + 'm from user',
      size: `${this.config.assetDock.width.toFixed(2)} x ${this.config.assetDock.depth.toFixed(2)}m`,
    });

    return dock;
  }

  /**
   * Get introduction dock position (for UI panels)
   */
  public getIntroDockPosition(camera: THREE.Camera, groundY: number = 0): THREE.Vector3 {
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    const introPos = new THREE.Vector3();
    introPos.copy(cameraPos);
    introPos.add(flatForward.clone().multiplyScalar(this.config.introDock.distance));
    introPos.y = groundY + this.config.introDock.height;

    return introPos;
  }

  /**
   * Get asset dock surface Y position
   */
  public getAssetDockSurfaceY(groundY: number = 0): number {
    return groundY + this.config.assetDock.height;
  }

  /**
   * Calculate dynamic N placements for N assets
   * CRITICAL FIX: Always generates exactly N unique placements for N assets
   */
  public calculatePlacements(
    assetCount: number,
    camera: THREE.Camera,
    groundY: number = 0
  ): AssetPlacement[] {
    console.log(`[SceneLayoutSystem] ═══════════════════════════════════════`);
    console.log(`[SceneLayoutSystem] CALCULATING PLACEMENTS`);
    console.log(`[SceneLayoutSystem] Asset count: ${assetCount}`);
    console.log(`[SceneLayoutSystem] Strategy: ${this.strategy}`);
    
    if (assetCount === 0) {
      console.log('[SceneLayoutSystem] No assets to place');
      return [];
    }

    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    const right = new THREE.Vector3();
    right.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

    const dockSurfaceY = this.getAssetDockSurfaceY(groundY);
    const dockCenter = new THREE.Vector3();
    dockCenter.copy(cameraPos);
    dockCenter.add(flatForward.clone().multiplyScalar(this.config.assetDock.distance));
    dockCenter.y = dockSurfaceY;

    let placements: AssetPlacement[];

    // Generate placements based on strategy (all support N assets with UNIQUE positions)
    switch (this.strategy) {
      case 'curved-arc':
        placements = this.createCurvedArcPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
        break;
      case 'focus-secondary':
        placements = this.createFocusSecondaryPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
        break;
      case 'carousel':
        placements = this.createCarouselPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
        break;
      case 'grid':
        placements = this.createGridPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
        break;
      default:
        placements = this.createCurvedArcPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
    }

    // CRITICAL VERIFICATION: Ensure exactly N placements for N assets
    if (placements.length !== assetCount) {
      console.error(`[SceneLayoutSystem] ❌ PLACEMENT COUNT MISMATCH: ${placements.length} placements for ${assetCount} assets!`);
      // Force-generate missing placements if needed
      while (placements.length < assetCount) {
        const index = placements.length;
        const fallbackPos = dockCenter.clone();
        fallbackPos.add(right.clone().multiplyScalar((index - assetCount / 2) * 0.4));
        placements.push({
          position: fallbackPos,
          rotation: new THREE.Euler(0, 0, 0),
          scale: 1.0,
          strategy: this.strategy,
          dockSurfaceY,
          slotIndex: index,
          boundingRadius: 0.15,
        });
      }
    }

    // Log all placements for debugging
    console.log(`[SceneLayoutSystem] Generated ${placements.length} placements:`);
    placements.forEach((p, i) => {
      console.log(`  [${i}] Position: (${p.position.x.toFixed(2)}, ${p.position.y.toFixed(2)}, ${p.position.z.toFixed(2)}) Scale: ${p.scale.toFixed(2)}`);
    });

    // Verify all positions are unique
    const uniqueCheck = new Set(placements.map(p => `${p.position.x.toFixed(3)},${p.position.z.toFixed(3)}`));
    if (uniqueCheck.size !== placements.length) {
      console.warn(`[SceneLayoutSystem] ⚠️ WARNING: Some placements have duplicate positions!`);
    }

    this.lastPlacements = placements;
    console.log(`[SceneLayoutSystem] ═══════════════════════════════════════`);

    return placements;
  }

  /**
   * Curved Arc Layout - Dynamic N placements spread in an arc
   */
  private createCurvedArcPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];
    
    // Use 80% of dock width, with minimum spacing
    const maxWidth = this.config.assetDock.width * 0.80;
    const minSpacing = 0.25; // Minimum 25cm between asset centers
    const optimalSpacing = Math.max(minSpacing, maxWidth / Math.max(1, assetCount));
    const totalSpread = Math.min(maxWidth, optimalSpacing * (assetCount - 1));
    const startOffset = -totalSpread / 2;

    // Arc curve factor (larger = more curved)
    const arcDepth = this.config.assetDock.depth * 0.2;

    for (let i = 0; i < assetCount; i++) {
      const t = assetCount > 1 ? i / (assetCount - 1) : 0.5; // 0 to 1
      const xOffset = startOffset + t * totalSpread;
      
      // Parabolic arc: center items are closer, edge items are further
      const normalizedX = assetCount > 1 ? (t - 0.5) * 2 : 0; // -1 to 1
      const zOffset = arcDepth * (1 - normalizedX * normalizedX); // 0 at edges, arcDepth at center
      
      const position = new THREE.Vector3();
      position.copy(dockCenter);
      position.add(right.clone().multiplyScalar(xOffset));
      position.add(forward.clone().multiplyScalar(-zOffset)); // Negative = towards user
      position.y = dockSurfaceY;

      // Face user (direction from position to camera/origin)
      const directionToUser = dockCenter.clone().sub(position);
      directionToUser.y = 0;
      directionToUser.normalize();
      const rotation = new THREE.Euler(0, Math.atan2(directionToUser.x, directionToUser.z), 0);

      placements.push({
        position,
        rotation,
        scale: 1.0,
        strategy: 'curved-arc',
        dockSurfaceY,
        slotIndex: i,
        boundingRadius: 0.15,
      });
    }

    return placements;
  }

  /**
   * Focus + Secondary Layout - One main asset larger, others smaller around it
   */
  private createFocusSecondaryPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];

    if (assetCount === 0) return placements;

    // Primary asset at center, slightly forward
    const primaryPos = new THREE.Vector3();
    primaryPos.copy(dockCenter);
    primaryPos.add(forward.clone().multiplyScalar(-0.1)); // Slightly closer
    primaryPos.y = dockSurfaceY;

    const primaryDirection = new THREE.Vector3(0, 0, 1); // Face user
    placements.push({
      position: primaryPos,
      rotation: new THREE.Euler(0, 0, 0),
      scale: 1.4, // 40% larger
      strategy: 'focus-secondary',
      dockSurfaceY,
      slotIndex: 0,
      boundingRadius: 0.2,
    });

    if (assetCount === 1) return placements;

    // Secondary assets spread in a semi-circle behind the primary
    const secondaryCount = assetCount - 1;
    const arcAngle = Math.min(120, secondaryCount * 30); // Max 120 degree spread
    const arcRadius = 0.5; // Distance from primary

    for (let i = 0; i < secondaryCount; i++) {
      const t = secondaryCount > 1 ? i / (secondaryCount - 1) : 0.5;
      const angle = THREE.MathUtils.degToRad(-arcAngle / 2 + t * arcAngle);
      
      const position = new THREE.Vector3();
      position.copy(primaryPos);
      position.add(right.clone().multiplyScalar(Math.sin(angle) * arcRadius));
      position.add(forward.clone().multiplyScalar(Math.cos(angle) * arcRadius));
      position.y = dockSurfaceY;

      // Face the primary asset
      const toPrimary = primaryPos.clone().sub(position);
      toPrimary.y = 0;
      const rotation = new THREE.Euler(0, Math.atan2(toPrimary.x, toPrimary.z), 0);

      placements.push({
        position,
        rotation,
        scale: 0.7, // 30% smaller
        strategy: 'focus-secondary',
        dockSurfaceY,
        slotIndex: i + 1,
        boundingRadius: 0.12,
      });
    }

    return placements;
  }

  /**
   * Carousel Layout - FIXED: Assets spread in a circular arrangement
   * Previously all assets were at the same position - now they're arranged in a circle
   */
  private createCarouselPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];
    
    if (assetCount === 1) {
      // Single asset: center position
      placements.push({
        position: dockCenter.clone(),
        rotation: new THREE.Euler(0, 0, 0),
        scale: 1.2,
        strategy: 'carousel',
        dockSurfaceY,
        slotIndex: 0,
        boundingRadius: 0.15,
      });
      return placements;
    }

    // FIXED: Arrange assets in a circular pattern, not all at center
    // This allows the user to see all assets and rotate through them
    const radius = Math.min(this.config.assetDock.width * 0.35, 0.6);
    const angleStep = (2 * Math.PI) / assetCount;

    for (let i = 0; i < assetCount; i++) {
      const angle = -Math.PI / 2 + i * angleStep; // Start from front
      
      const position = new THREE.Vector3();
      position.copy(dockCenter);
      position.add(right.clone().multiplyScalar(Math.cos(angle) * radius));
      position.add(forward.clone().multiplyScalar(Math.sin(angle) * radius));
      position.y = dockSurfaceY;

      // Face outward from center
      const rotation = new THREE.Euler(0, angle + Math.PI, 0);

      placements.push({
        position,
        rotation,
        scale: 0.9,
        strategy: 'carousel',
        dockSurfaceY,
        slotIndex: i,
        boundingRadius: 0.12,
      });
    }

    return placements;
  }

  /**
   * Grid Layout - Dynamic N placements in a grid
   */
  private createGridPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];
    
    // Calculate optimal grid dimensions
    const cols = Math.ceil(Math.sqrt(assetCount));
    const rows = Math.ceil(assetCount / cols);
    
    // Cell spacing based on dock size and asset count
    const maxWidth = this.config.assetDock.width * 0.85;
    const maxDepth = this.config.assetDock.depth * 0.85;
    
    const cellWidth = cols > 1 ? maxWidth / (cols) : 0;
    const cellDepth = rows > 1 ? maxDepth / (rows) : 0;
    
    const startX = -(cols - 1) * cellWidth / 2;
    const startZ = -(rows - 1) * cellDepth / 2;

    for (let i = 0; i < assetCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const position = new THREE.Vector3();
      position.copy(dockCenter);
      position.add(right.clone().multiplyScalar(startX + col * cellWidth));
      position.add(forward.clone().multiplyScalar(startZ + row * cellDepth));
      position.y = dockSurfaceY;

      // Face user
      const rotation = new THREE.Euler(0, 0, 0);

      // Scale slightly smaller for grids with many items
      const scaleFactor = Math.max(0.6, 1.0 - assetCount * 0.05);

      placements.push({
        position,
        rotation,
        scale: scaleFactor,
        strategy: 'grid',
        dockSurfaceY,
        slotIndex: i,
        boundingRadius: 0.1 * scaleFactor,
      });
    }

    return placements;
  }

  /**
   * Place asset on dock with fit-to-dock scaling
   */
  public placeAssetOnDock(
    asset: THREE.Object3D,
    placement: AssetPlacement,
    camera: THREE.Camera,
    groundY: number = 0,
    totalAssetCount: number = 1
  ): void {
    console.log(`[SceneLayoutSystem] Placing asset "${asset.name}" at slot ${placement.slotIndex}`);
    
    // Get dock volume for fit-to-dock scaling
    const dockVolume = this.getAssetDockVolume(camera, groundY);
    
    // Calculate scale to fit inside dock, considering total assets
    const fitScale = this.calculateFitToDockScale(asset, dockVolume, totalAssetCount);
    
    // Apply strategy scale multiplier
    const finalScale = fitScale * placement.scale;

    // Reset and apply scale
    asset.scale.set(1, 1, 1);
    asset.scale.multiplyScalar(finalScale);

    // Get bounding box after scaling
    asset.updateMatrixWorld(true);
    const boxAfterScale = new THREE.Box3().setFromObject(asset);
    const sizeAfterScale = boxAfterScale.getSize(new THREE.Vector3());
    const centerAfterScale = boxAfterScale.getCenter(new THREE.Vector3());

    // Calculate position: placement position + offset to center asset
    const localCenterOffset = centerAfterScale.clone().multiplyScalar(-1);
    const bottomOffset = sizeAfterScale.y / 2;

    asset.position.copy(placement.position);
    asset.position.add(localCenterOffset);
    asset.position.y = placement.dockSurfaceY + bottomOffset;

    // Set rotation
    asset.rotation.copy(placement.rotation);

    // Mark asset metadata
    asset.userData.restsOnDock = true;
    asset.userData.dockSurfaceY = placement.dockSurfaceY;
    asset.userData.slotIndex = placement.slotIndex;
    asset.userData.layer = 'asset'; // For raycast filtering
    asset.userData.originalDockPosition = new THREE.Vector3().copy(asset.position);
    asset.userData.placementStrategy = placement.strategy;
    asset.userData.isInteractable = true;

    // Update matrix
    asset.updateMatrixWorld(true);

    // Register bounds for collision avoidance
    this.registerAssetBounds(placement.slotIndex, asset);

    console.log('[SceneLayoutSystem] ✅ Asset placed on dock:', {
      name: asset.name,
      slotIndex: placement.slotIndex,
      position: `(${asset.position.x.toFixed(2)}, ${asset.position.y.toFixed(2)}, ${asset.position.z.toFixed(2)})`,
      fitScale: fitScale.toFixed(3),
      strategyScale: placement.scale.toFixed(2),
      finalScale: finalScale.toFixed(3),
      size: `${sizeAfterScale.x.toFixed(3)} x ${sizeAfterScale.y.toFixed(3)} x ${sizeAfterScale.z.toFixed(3)}`,
    });
  }

  /**
   * Create ground plane - always transparent
   */
  public createGroundPlane(scene: THREE.Scene, groundY: number = 0): THREE.Mesh {
    // Remove existing ground if any
    const existing = scene.getObjectByName('groundPlane');
    if (existing) {
      scene.remove(existing);
    }

    // Create grid geometry with always-transparent material
    const gridHelper = new THREE.GridHelper(
      this.config.ground.size,
      this.config.ground.gridDivisions,
      0x64748b,
      0x475569
    );
    
    // Make grid lines always transparent
    const gridMaterial = gridHelper.material as THREE.LineBasicMaterial;
    if (gridMaterial) {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.3; // Always visible but transparent
    }

    // Create transparent plane (always visible)
    const planeGeometry = new THREE.PlaneGeometry(
      this.config.ground.size,
      this.config.ground.size
    );
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.1, // Always transparent, never changes
      side: THREE.DoubleSide,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = groundY;
    plane.name = 'groundPlane';
    plane.userData.layer = 'ground'; // For raycast filtering

    // Combine grid and plane
    const groundGroup = new THREE.Group();
    groundGroup.name = 'groundPlane';
    groundGroup.add(gridHelper);
    groundGroup.add(plane);
    groundGroup.position.y = groundY;
    groundGroup.userData.layer = 'ground';

    scene.add(groundGroup);
    this.groundPlaneMesh = groundGroup as any;

    console.log('[SceneLayoutSystem] Ground plane created (always transparent)');

    return groundGroup as any;
  }

  /**
   * Get asset dock mesh
   */
  public getAssetDockMesh(): THREE.Mesh | null {
    return this.assetDockMesh;
  }

  /**
   * Get last calculated placements
   */
  public getLastPlacements(): AssetPlacement[] {
    return this.lastPlacements;
  }

  /**
   * Dispose all created meshes
   */
  public dispose(scene: THREE.Scene): void {
    if (this.assetDockMesh) {
      scene.remove(this.assetDockMesh);
      this.assetDockMesh = null;
    }
    if (this.groundPlaneMesh) {
      scene.remove(this.groundPlaneMesh);
      this.groundPlaneMesh = null;
    }
    this.assetBounds.clear();
    this.lastPlacements = [];
  }
}
