/**
 * Dock Asset Placer - Assets at hands distance on a physical dock
 * 
 * Places assets on a physical dock/table at arm's reach distance from user.
 * Assets rest on the dock with gravity, all at the same height.
 * Dock is positioned between the user and the introduction panel.
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlacementStrategy = 'curved-arc' | 'focus-secondary' | 'carousel';

export interface DockConfig {
  distance: number;        // Distance from user (hands reach: 0.6-0.8m)
  height: number;          // Height of dock surface (relative to ground)
  width: number;           // Width of dock
  depth: number;           // Depth of dock
  introductionPanelDistance: number; // Introduction panel distance (2.0m)
}

export interface AssetPlacement {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  strategy: PlacementStrategy;
  dockSurfaceY: number;    // Y position on dock surface
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_DOCK_CONFIG: DockConfig = {
  distance: 0.7,              // 0.7m = comfortable arm's reach
  height: 0.9,                // 0.9m above ground (desk height)
  width: 1.5,                 // 1.5m wide
  depth: 0.8,                 // 0.8m deep
  introductionPanelDistance: 2.0, // Panel is at 2.0m
};

const DEFAULT_ASSET_SIZE = 0.15; // 15cm - small enough to fit multiple on dock
const UNIFORM_HEIGHT_OFFSET = 0.0; // All assets at same height (on dock surface)

// ═══════════════════════════════════════════════════════════════════════════════
// DOCK ASSET PLACER
// ═══════════════════════════════════════════════════════════════════════════════

export class DockAssetPlacer {
  private dockConfig: DockConfig;
  private strategy: PlacementStrategy;
  private dockMesh: THREE.Mesh | null = null;

  constructor(dockConfig?: Partial<DockConfig>, strategy: PlacementStrategy = 'curved-arc') {
    this.dockConfig = { ...DEFAULT_DOCK_CONFIG, ...dockConfig };
    this.strategy = strategy;
  }

  /**
   * Set placement strategy
   */
  public setStrategy(strategy: PlacementStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  public getStrategy(): PlacementStrategy {
    return this.strategy;
  }

  /**
   * Create dock mesh in scene
   */
  public createDock(scene: THREE.Scene, camera: THREE.Camera, groundY: number = 0): THREE.Mesh {
    // Remove existing dock if any
    const existing = scene.getObjectByName('assetDock');
    if (existing) {
      scene.remove(existing);
    }

    // Get camera position and forward direction
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    // Calculate dock position (between user and panel)
    const dockPos = new THREE.Vector3();
    dockPos.copy(cameraPos);
    dockPos.add(flatForward.clone().multiplyScalar(this.dockConfig.distance));
    dockPos.y = groundY + this.dockConfig.height;

    // Create dock geometry (flat table surface)
    const geometry = new THREE.BoxGeometry(
      this.dockConfig.width,
      0.05, // Thin surface
      this.dockConfig.depth
    );

    // Dock material - semi-transparent with subtle glow
    const material = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.8,
      emissive: 0x0f172a,
      emissiveIntensity: 0.2,
      roughness: 0.3,
      metalness: 0.1,
    });

    const dock = new THREE.Mesh(geometry, material);
    dock.name = 'assetDock';
    dock.position.copy(dockPos);
    dock.rotation.y = Math.atan2(-flatForward.x, -flatForward.z);
    
    // Add edges for visibility
    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    dock.add(edgeLines);

    scene.add(dock);
    this.dockMesh = dock;

    console.log('[DOCK] Created dock at:', {
      position: `(${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)})`,
      distance: this.dockConfig.distance.toFixed(2) + 'm from user',
      size: `${this.dockConfig.width.toFixed(2)} x ${this.dockConfig.depth.toFixed(2)}m`,
    });

    return dock;
  }

  /**
   * Get dock surface Y position
   */
  public getDockSurfaceY(groundY: number = 0): number {
    return groundY + this.dockConfig.height;
  }

  /**
   * Calculate placements for assets on dock
   */
  public calculatePlacements(
    assetCount: number,
    camera: THREE.Camera,
    groundY: number = 0
  ): AssetPlacement[] {
    if (assetCount === 0) {
      return [];
    }

    // Get camera position and orientation
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    const right = new THREE.Vector3();
    right.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

    // Dock surface Y position (all assets at same height)
    const dockSurfaceY = this.getDockSurfaceY(groundY);

    // Dock center position
    const dockCenter = new THREE.Vector3();
    dockCenter.copy(cameraPos);
    dockCenter.add(flatForward.clone().multiplyScalar(this.dockConfig.distance));
    dockCenter.y = dockSurfaceY;

    // Generate placements based on strategy
    switch (this.strategy) {
      case 'curved-arc':
        return this.createCurvedArcPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
      case 'focus-secondary':
        return this.createFocusSecondaryPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
      case 'carousel':
        return this.createCarouselPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
      default:
        return this.createCurvedArcPlacements(assetCount, dockCenter, flatForward, right, dockSurfaceY);
    }
  }

  /**
   * Curved Arc Layout on Dock
   */
  private createCurvedArcPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];
    const maxWidth = this.dockConfig.width * 0.8; // Use 80% of dock width
    const spacing = assetCount > 1 ? maxWidth / (assetCount - 1) : 0;
    const startOffset = -maxWidth / 2;

    for (let i = 0; i < assetCount; i++) {
      const position = new THREE.Vector3();
      position.copy(dockCenter);
      position.add(right.clone().multiplyScalar(startOffset + i * spacing));
      position.y = dockSurfaceY; // All at same height

      // Rotation to face user
      const directionToUser = new THREE.Vector3(0, 0, 0).sub(position).normalize();
      const rotation = new THREE.Euler(0, Math.atan2(-directionToUser.x, -directionToUser.z), 0);

      placements.push({
        position,
        rotation,
        scale: 1.0,
        strategy: 'curved-arc',
        dockSurfaceY,
      });
    }

    return placements;
  }

  /**
   * Focus + Secondary Layout on Dock
   */
  private createFocusSecondaryPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];

    // Primary asset at center-right
    const primaryPos = new THREE.Vector3();
    primaryPos.copy(dockCenter);
    primaryPos.add(right.clone().multiplyScalar(0.3)); // Slightly right
    primaryPos.y = dockSurfaceY;

    const primaryDirection = new THREE.Vector3(0, 0, 0).sub(primaryPos).normalize();
    placements.push({
      position: primaryPos,
      rotation: new THREE.Euler(0, Math.atan2(-primaryDirection.x, -primaryDirection.z), 0),
      scale: 1.3, // Larger primary
      strategy: 'focus-secondary',
      dockSurfaceY,
    });

    // Secondary assets on left side
    for (let i = 1; i < assetCount; i++) {
      const position = new THREE.Vector3();
      position.copy(dockCenter);
      position.add(right.clone().multiplyScalar(-0.4 - (i - 1) * 0.25)); // Left side
      position.y = dockSurfaceY;

      const direction = new THREE.Vector3(0, 0, 0).sub(position).normalize();
      placements.push({
        position,
        rotation: new THREE.Euler(0, Math.atan2(-direction.x, -direction.z), 0),
        scale: 0.8, // Smaller secondaries
        strategy: 'focus-secondary',
        dockSurfaceY,
      });
    }

    return placements;
  }

  /**
   * Carousel Layout on Dock
   */
  private createCarouselPlacements(
    assetCount: number,
    dockCenter: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    dockSurfaceY: number
  ): AssetPlacement[] {
    // Single asset at dock center
    const position = new THREE.Vector3();
    position.copy(dockCenter);
    position.y = dockSurfaceY;

    const direction = new THREE.Vector3(0, 0, 0).sub(position).normalize();
    return [{
      position,
      rotation: new THREE.Euler(0, Math.atan2(-direction.x, -direction.z), 0),
      scale: 1.0,
      strategy: 'carousel',
      dockSurfaceY,
    }];
  }

  /**
   * Place asset on dock - ensures it rests on dock surface
   */
  public placeAssetOnDock(
    asset: THREE.Object3D,
    placement: AssetPlacement,
    targetSize: number = DEFAULT_ASSET_SIZE
  ): void {
    // Get asset's natural size
    const box = new THREE.Box3().setFromObject(asset);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim <= 0) {
      console.warn('[DockAssetPlacer] Asset has invalid dimensions');
      return;
    }

    // Calculate scale to fit target size
    const scale = (targetSize * placement.scale) / maxDim;

    // Reset and apply scale
    asset.scale.set(1, 1, 1);
    asset.scale.multiplyScalar(scale);

    // Get bounding box after scaling
    asset.updateMatrixWorld(true);
    const boxAfterScale = new THREE.Box3().setFromObject(asset);
    const sizeAfterScale = boxAfterScale.getSize(new THREE.Vector3());
    const centerAfterScale = boxAfterScale.getCenter(new THREE.Vector3());

    // Calculate position: placement position + offset to center asset
    // Then adjust Y so bottom of asset sits on dock surface
    const localCenterOffset = centerAfterScale.clone().multiplyScalar(-1);
    const bottomOffset = sizeAfterScale.y / 2; // Half height to place bottom on surface

    asset.position.copy(placement.position);
    asset.position.add(localCenterOffset);
    asset.position.y = placement.dockSurfaceY + bottomOffset; // Rest on dock surface

    // Set rotation
    asset.rotation.copy(placement.rotation);

    // Mark asset to rest on dock (for gravity simulation)
    asset.userData.restsOnDock = true;
    asset.userData.dockSurfaceY = placement.dockSurfaceY;
    asset.userData.originalDockPosition = new THREE.Vector3().copy(asset.position);

    // Update matrix
    asset.updateMatrixWorld(true);

    console.log('[DockAssetPlacer] Asset placed on dock:', {
      position: `(${asset.position.x.toFixed(2)}, ${asset.position.y.toFixed(2)}, ${asset.position.z.toFixed(2)})`,
      dockSurfaceY: placement.dockSurfaceY.toFixed(2),
      scale: scale.toFixed(3),
      size: `${sizeAfterScale.x.toFixed(3)} x ${sizeAfterScale.y.toFixed(3)} x ${sizeAfterScale.z.toFixed(3)}`,
    });
  }

  /**
   * Get dock mesh
   */
  public getDockMesh(): THREE.Mesh | null {
    return this.dockMesh;
  }

  /**
   * Dispose dock
   */
  public disposeDock(scene: THREE.Scene): void {
    if (this.dockMesh) {
      scene.remove(this.dockMesh);
      this.dockMesh = null;
    }
  }
}
