/**
 * Simple Asset Placer - Rebuilt from scratch
 * 
 * A clean, simple system for placing 3D assets in VR space.
 * Accounts for UI panels (introduction panel and dock) and provides
 * reliable, predictable asset positioning.
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlacementStrategy = 'curved-arc' | 'focus-secondary' | 'carousel';

export interface UIPanelConfig {
  introductionPanel: {
    distance: number;      // Distance from camera (default: 2.0m)
    position: 'center';     // Always center
  };
  dock: {
    distance: number;      // Distance from camera (default: 1.5m)
    rightOffset: number;   // Right offset (default: 1.5m)
    verticalOffset: number; // Vertical offset from eye level (default: -0.5m)
  };
}

export interface AssetPlacement {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  strategy: PlacementStrategy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_UI_CONFIG: UIPanelConfig = {
  introductionPanel: {
    distance: 2.0,
    position: 'center',
  },
  dock: {
    distance: 1.5,
    rightOffset: 1.5,
    verticalOffset: -0.5,
  },
};

const DEFAULT_ASSET_DISTANCE = 2.5; // Distance from camera
const DEFAULT_ASSET_HEIGHT = 1.0;  // Height above ground
const DEFAULT_ASSET_SIZE = 1.0;    // Target size for assets

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE ASSET PLACER
// ═══════════════════════════════════════════════════════════════════════════════

export class SimpleAssetPlacer {
  private uiConfig: UIPanelConfig;
  private strategy: PlacementStrategy;

  constructor(uiConfig?: Partial<UIPanelConfig>, strategy: PlacementStrategy = 'curved-arc') {
    this.uiConfig = { ...DEFAULT_UI_CONFIG, ...uiConfig };
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
   * Calculate placements for assets
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

    // Calculate UI panel positions
    const introPanelPos = this.calculateIntroductionPanelPosition(cameraPos, flatForward);
    const dockPos = this.calculateDockPosition(cameraPos, flatForward, right);

    // Generate placements based on strategy
    switch (this.strategy) {
      case 'curved-arc':
        return this.createCurvedArcPlacements(assetCount, cameraPos, flatForward, right, groundY, introPanelPos, dockPos);
      case 'focus-secondary':
        return this.createFocusSecondaryPlacements(assetCount, cameraPos, flatForward, right, groundY, introPanelPos, dockPos);
      case 'carousel':
        return this.createCarouselPlacements(assetCount, cameraPos, flatForward, right, groundY, introPanelPos, dockPos);
      default:
        return this.createCurvedArcPlacements(assetCount, cameraPos, flatForward, right, groundY, introPanelPos, dockPos);
    }
  }

  /**
   * Calculate introduction panel position
   */
  private calculateIntroductionPanelPosition(
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3
  ): THREE.Vector3 {
    const pos = new THREE.Vector3();
    pos.copy(cameraPos);
    pos.add(forward.clone().multiplyScalar(this.uiConfig.introductionPanel.distance));
    return pos;
  }

  /**
   * Calculate dock position
   */
  private calculateDockPosition(
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3
  ): THREE.Vector3 {
    const pos = new THREE.Vector3();
    pos.copy(cameraPos);
    pos.add(forward.clone().multiplyScalar(this.uiConfig.dock.distance));
    pos.add(right.clone().multiplyScalar(this.uiConfig.dock.rightOffset));
    pos.y = cameraPos.y + this.uiConfig.dock.verticalOffset;
    return pos;
  }

  /**
   * Check if position conflicts with UI panels
   */
  private conflictsWithUI(
    position: THREE.Vector3,
    introPanelPos: THREE.Vector3,
    dockPos: THREE.Vector3,
    minDistance: number = 0.8
  ): boolean {
    const distToIntro = position.distanceTo(introPanelPos);
    const distToDock = position.distanceTo(dockPos);
    return distToIntro < minDistance || distToDock < minDistance;
  }

  /**
   * Curved Arc Layout
   */
  private createCurvedArcPlacements(
    assetCount: number,
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    groundY: number,
    introPanelPos: THREE.Vector3,
    dockPos: THREE.Vector3
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];
    const distance = DEFAULT_ASSET_DISTANCE;
    const height = groundY + DEFAULT_ASSET_HEIGHT;
    const arcSpread = 90; // Degrees
    const angleStep = assetCount > 1 ? arcSpread / (assetCount - 1) : 0;
    const startAngle = -arcSpread / 2;

    for (let i = 0; i < assetCount; i++) {
      const angle = startAngle + i * angleStep;
      const angleRad = THREE.MathUtils.degToRad(angle);

      // Rotate forward direction
      const rotatedForward = forward.clone();
      rotatedForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);

      // Calculate position
      let position = new THREE.Vector3();
      position.copy(cameraPos);
      position.add(rotatedForward.multiplyScalar(distance));
      position.y = height;

      // Avoid UI panels
      let attempts = 0;
      while (this.conflictsWithUI(position, introPanelPos, dockPos) && attempts < 5) {
        // Move further out
        const adjustedDistance = distance + 0.3 * (attempts + 1);
        position.copy(cameraPos);
        position.add(rotatedForward.multiplyScalar(adjustedDistance));
        position.y = height;
        attempts++;
      }

      // Calculate rotation to face camera
      const directionToCamera = cameraPos.clone().sub(position).normalize();
      const rotation = new THREE.Euler(0, Math.atan2(-directionToCamera.x, -directionToCamera.z), 0);

      placements.push({
        position,
        rotation,
        scale: 1.0,
        strategy: 'curved-arc',
      });
    }

    return placements;
  }

  /**
   * Focus + Secondary Layout
   */
  private createFocusSecondaryPlacements(
    assetCount: number,
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    groundY: number,
    introPanelPos: THREE.Vector3,
    dockPos: THREE.Vector3
  ): AssetPlacement[] {
    const placements: AssetPlacement[] = [];
    const height = groundY + DEFAULT_ASSET_HEIGHT;

    // Primary asset - offset right to avoid center panel
    let primaryPos = new THREE.Vector3();
    primaryPos.copy(cameraPos);
    primaryPos.add(forward.clone().multiplyScalar(DEFAULT_ASSET_DISTANCE));
    primaryPos.add(right.clone().multiplyScalar(1.5)); // Right offset
    primaryPos.y = height;

    // Adjust if conflicts with dock
    if (this.conflictsWithUI(primaryPos, introPanelPos, dockPos)) {
      primaryPos.add(right.clone().multiplyScalar(0.5)); // Move further right
    }

    const primaryDirection = cameraPos.clone().sub(primaryPos).normalize();
    placements.push({
      position: primaryPos,
      rotation: new THREE.Euler(0, Math.atan2(-primaryDirection.x, -primaryDirection.z), 0),
      scale: 1.2, // Larger primary
      strategy: 'focus-secondary',
    });

    // Secondary assets
    for (let i = 1; i < assetCount; i++) {
      const side = i % 2 === 1 ? -1 : 1; // Alternate left/right
      const angle = side * 60; // 60 degrees
      const angleRad = THREE.MathUtils.degToRad(angle);

      const rotatedForward = forward.clone();
      rotatedForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);

      let position = new THREE.Vector3();
      position.copy(cameraPos);
      position.add(rotatedForward.multiplyScalar(2.0));
      position.y = height;

      // Avoid UI panels
      if (this.conflictsWithUI(position, introPanelPos, dockPos)) {
        position.add(rotatedForward.multiplyScalar(0.5)); // Move further
      }

      const direction = cameraPos.clone().sub(position).normalize();
      placements.push({
        position,
        rotation: new THREE.Euler(0, Math.atan2(-direction.x, -direction.z), 0),
        scale: 0.8, // Smaller secondaries
        strategy: 'focus-secondary',
      });
    }

    return placements;
  }

  /**
   * Carousel Layout
   */
  private createCarouselPlacements(
    assetCount: number,
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    groundY: number,
    introPanelPos: THREE.Vector3,
    dockPos: THREE.Vector3
  ): AssetPlacement[] {
    const height = groundY + DEFAULT_ASSET_HEIGHT;

    // Single placeholder offset right
    let position = new THREE.Vector3();
    position.copy(cameraPos);
    position.add(forward.clone().multiplyScalar(DEFAULT_ASSET_DISTANCE));
    position.add(right.clone().multiplyScalar(1.5));
    position.y = height;

    // Adjust if conflicts
    if (this.conflictsWithUI(position, introPanelPos, dockPos)) {
      position.add(right.clone().multiplyScalar(0.5));
    }

    const direction = cameraPos.clone().sub(position).normalize();
    return [{
      position,
      rotation: new THREE.Euler(0, Math.atan2(-direction.x, -direction.z), 0),
      scale: 1.0,
      strategy: 'carousel',
    }];
  }

  /**
   * Place asset at calculated position - SIMPLE and DIRECT
   */
  public placeAsset(
    asset: THREE.Object3D,
    placement: AssetPlacement,
    targetSize: number = DEFAULT_ASSET_SIZE
  ): void {
    // Get asset's natural size
    const box = new THREE.Box3().setFromObject(asset);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim <= 0) {
      console.warn('[SimpleAssetPlacer] Asset has invalid dimensions');
      return;
    }

    // Calculate scale to fit target size
    const scale = (targetSize * placement.scale) / maxDim;

    // Reset and apply scale
    asset.scale.set(1, 1, 1);
    asset.scale.multiplyScalar(scale);

    // Get center offset (in local space)
    const center = box.getCenter(new THREE.Vector3());
    const localOffset = center.clone().multiplyScalar(-1);

    // Set position: placement position + local offset to center the asset
    asset.position.copy(placement.position);
    asset.position.add(localOffset);

    // Set rotation
    asset.rotation.copy(placement.rotation);

    // Update matrix
    asset.updateMatrixWorld(true);

    console.log('[SimpleAssetPlacer] Asset placed:', {
      position: `(${asset.position.x.toFixed(2)}, ${asset.position.y.toFixed(2)}, ${asset.position.z.toFixed(2)})`,
      targetPosition: `(${placement.position.x.toFixed(2)}, ${placement.position.y.toFixed(2)}, ${placement.position.z.toFixed(2)})`,
      scale: scale.toFixed(3),
      originalSize: maxDim.toFixed(3),
      finalSize: (maxDim * scale).toFixed(3),
    });
  }
}
