/**
 * Asset Placeholder Manager
 * 
 * Manages invisible cuboidal placeholder containers for consistent 3D asset spawning.
 * Supports multiple placement strategies with auto-centering and scaling.
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlacementStrategy =
  | 'curved-arc'        // Assets in arc around user (avoids center UI panel)
  | 'focus-secondary'   // Primary + supporting assets (avoids center UI panel)
  | 'carousel';         // One visible at a time, cycle through

export interface PlaceholderConfig {
  id: string;
  width: number;
  height: number;
  depth: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  strategy: PlacementStrategy;
  showDebug: boolean;
}

export interface PlaceholderManagerConfig {
  defaultDistance?: number;      // Distance from user (default: 2.5m)
  defaultSize?: number;          // Default placeholder size (default: 1.5m)
  showDebug?: boolean;            // Show debug visualization (default: false)
  strategy?: PlacementStrategy;    // Default strategy (default: 'front-center')
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Required<PlaceholderManagerConfig> = {
  defaultDistance: 2.5,
  defaultSize: 1.5,
  showDebug: false,
  strategy: 'curved-arc',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET PLACEHOLDER MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class AssetPlaceholderManager {
  private config: Required<PlaceholderManagerConfig>;
  private placeholders: Map<string, PlaceholderConfig> = new Map();
  private debugHelpers: Map<string, THREE.BoxHelper> = new Map();
  private strategy: PlacementStrategy;
  private scene: THREE.Scene | null = null;

  constructor(config: PlaceholderManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.strategy = this.config.strategy;
    console.log('[ASSET_PLACEHOLDER] Manager created with strategy:', this.strategy);
  }

  /**
   * Set the scene for debug visualization
   */
  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
    this.updateDebugVisualization();
  }

  /**
   * Get current strategy
   */
  public getStrategy(): PlacementStrategy {
    return this.strategy;
  }

  /**
   * Set strategy (with rotation support)
   */
  public setStrategy(strategy: PlacementStrategy): void {
    this.strategy = strategy;
    console.log('[ASSET_PLACEHOLDER] Strategy changed to:', strategy);
    this.updateDebugVisualization();
  }

  /**
   * Toggle debug visualization
   */
  public toggleDebug(show: boolean): void {
    this.config.showDebug = show;
    this.updateDebugVisualization();
  }

  /**
   * Create placeholders based on strategy
   * Accounts for UI panels: Introduction panel at 2.0m forward (center), Asset dock is UI overlay
   */
  public createPlaceholders(
    assetCount: number,
    camera: THREE.Camera,
    floorY: number = 0,
    uiPanelDistance: number = 2.0,  // Introduction panel distance to avoid
    dockConfig?: { distance: number; rightOffset: number; verticalOffset: number }  // Dock position config
  ): PlaceholderConfig[] {
    console.log('[ASSET_PLACEHOLDER] ═══════════════════════════════════════');
    console.log(`[ASSET_PLACEHOLDER] Creating placeholders: strategy=${this.strategy}, count=${assetCount}`);

    // Clear existing placeholders
    this.placeholders.clear();
    this.clearDebugHelpers();

    if (assetCount === 0) {
      console.log('[ASSET_PLACEHOLDER] No assets, no placeholders created');
      return [];
    }

    // Get camera position and forward direction
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z);
    if (flatForward.lengthSq() < 0.001) flatForward.set(0, 0, -1);
    flatForward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(flatForward, new THREE.Vector3(0, 1, 0)).normalize();

    const up = new THREE.Vector3(0, 1, 0);

    // Create placeholders based on strategy
    let placeholders: PlaceholderConfig[] = [];

    switch (this.strategy) {
      case 'curved-arc':
        placeholders = this.createCurvedArcPlaceholders(
          assetCount,
          cameraPos,
          flatForward,
          right,
          up,
          floorY,
          uiPanelDistance,
          dockConfig
        );
        break;
      case 'focus-secondary':
        placeholders = this.createFocusSecondaryPlaceholders(
          assetCount,
          cameraPos,
          flatForward,
          right,
          up,
          floorY,
          uiPanelDistance,
          dockConfig
        );
        break;
      case 'carousel':
        placeholders = this.createCarouselPlaceholders(
          assetCount,
          cameraPos,
          flatForward,
          right,
          up,
          floorY,
          uiPanelDistance,
          dockConfig
        );
        break;
      default:
        // Fallback to curved-arc
        placeholders = this.createCurvedArcPlaceholders(
          assetCount,
          cameraPos,
          flatForward,
          right,
          up,
          floorY,
          uiPanelDistance,
          dockConfig
        );
        break;
    }

    // Store placeholders
    placeholders.forEach((placeholder) => {
      this.placeholders.set(placeholder.id, placeholder);
    });

    // Create debug visualization
    this.updateDebugVisualization();

    console.log(`[ASSET_PLACEHOLDER] Created ${placeholders.length} placeholders`);
    placeholders.forEach((p, i) => {
      console.log(`[ASSET_PLACEHOLDER] Placeholder ${i + 1}:`, {
        id: p.id,
        position: `(${p.position.x.toFixed(2)}, ${p.position.y.toFixed(2)}, ${p.position.z.toFixed(2)})`,
        size: `${p.width.toFixed(2)} x ${p.height.toFixed(2)} x ${p.depth.toFixed(2)}`,
      });
    });
    console.log('[ASSET_PLACEHOLDER] ═══════════════════════════════════════');

    return placeholders;
  }

  /**
   * Curved Arc Layout
   * Assets arranged in arc to avoid center UI panel (introduction panel at 2.0m forward)
   * and dock (bottom-right UI overlay)
   */
  private createCurvedArcPlaceholders(
    assetCount: number,
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
    floorY: number,
    uiPanelDistance: number,
    dockConfig?: { distance: number; rightOffset: number; verticalOffset: number }
  ): PlaceholderConfig[] {
    // Use distance further than UI panel to avoid overlap
    // UI panel is at 2.0m forward (center), dock is at bottom-right
    const distance = Math.max(this.config.defaultDistance, uiPanelDistance + 0.5);
    const size = this.config.defaultSize;
    const height = floorY + 1.0;
    
    // Dock position (if provided): typically bottom-right, e.g., 1.5m forward, 1.5m right, -0.5m down
    const dockPos = dockConfig ? (() => {
      const pos = new THREE.Vector3();
      pos.copy(cameraPos);
      pos.add(forward.clone().multiplyScalar(dockConfig.distance));
      pos.add(right.clone().multiplyScalar(dockConfig.rightOffset));
      pos.y = cameraPos.y + dockConfig.verticalOffset;
      return pos;
    })() : null;
    
    // Wider arc (90°) to avoid center where UI panel is, and avoid dock area
    const arcSpread = 90; // Degrees (wider to avoid center)
    const anglePerAsset = assetCount > 1 ? arcSpread / (assetCount - 1) : 0;
    const startAngle = -arcSpread / 2;

    const placeholders: PlaceholderConfig[] = [];
    const minDistanceFromDock = 0.8; // Minimum distance from dock to avoid overlap

    for (let i = 0; i < assetCount; i++) {
      const angle = startAngle + i * anglePerAsset;
      const angleRad = THREE.MathUtils.degToRad(angle);

      // Rotate forward direction by angle
      const rotatedForward = forward.clone();
      rotatedForward.applyAxisAngle(up, angleRad);

      let position = new THREE.Vector3();
      position.copy(cameraPos);
      position.add(rotatedForward.multiplyScalar(distance));
      position.y = height;

      // Avoid dock area if dock is configured
      if (dockPos) {
        const distanceToDock = position.distanceTo(dockPos);
        if (distanceToDock < minDistanceFromDock) {
          // Adjust position to avoid dock - move further out or adjust angle
          const adjustedDistance = distance + 0.3; // Move further
          position.copy(cameraPos);
          position.add(rotatedForward.multiplyScalar(adjustedDistance));
          position.y = height;
          console.log(`[ASSET_PLACEHOLDER] Adjusted placeholder ${i} to avoid dock (was ${distanceToDock.toFixed(2)}m, now ${position.distanceTo(dockPos).toFixed(2)}m)`);
        }
      }

      placeholders.push({
        id: `curved-arc-${i}`,
        width: size,
        height: size,
        depth: size,
        position,
        rotation: new THREE.Euler(0, Math.atan2(-rotatedForward.x, -rotatedForward.z), 0),
        strategy: 'curved-arc',
        showDebug: this.config.showDebug,
      });
    }

    console.log(`[ASSET_PLACEHOLDER] Curved Arc: ${assetCount} assets, ${arcSpread}° spread, ${distance.toFixed(2)}m distance`);
    console.log(`[ASSET_PLACEHOLDER] UI panel at ${uiPanelDistance}m forward (center), Dock ${dockPos ? `at (${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)})` : 'not configured'}`);
    return placeholders;
  }

  /**
   * Focus + Secondary Assets
   * Primary asset offset to avoid UI panel and dock, secondaries at angles
   */
  private createFocusSecondaryPlaceholders(
    assetCount: number,
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
    floorY: number,
    uiPanelDistance: number,
    dockConfig?: { distance: number; rightOffset: number; verticalOffset: number }
  ): PlaceholderConfig[] {
    // Primary offset to the right to avoid center UI panel and dock
    const primaryDistance = Math.max(this.config.defaultDistance, uiPanelDistance + 0.5);
    let primaryRightOffset = 1.2; // Offset right to avoid center panel
    const secondaryDistance = 2.0;
    const primarySize = 2.0;
    const secondarySize = 1.0;
    const height = floorY + 1.0;

    // Dock position (if provided)
    const dockPos = dockConfig ? (() => {
      const pos = new THREE.Vector3();
      pos.copy(cameraPos);
      pos.add(forward.clone().multiplyScalar(dockConfig.distance));
      pos.add(right.clone().multiplyScalar(dockConfig.rightOffset));
      pos.y = cameraPos.y + dockConfig.verticalOffset;
      return pos;
    })() : null;

    const placeholders: PlaceholderConfig[] = [];

    // Primary placeholder (offset right to avoid UI panel and dock)
    const primaryPos = new THREE.Vector3();
    primaryPos.copy(cameraPos);
    primaryPos.add(forward.clone().multiplyScalar(primaryDistance));
    primaryPos.add(right.clone().multiplyScalar(primaryRightOffset)); // Offset right
    primaryPos.y = height;

    // Adjust if too close to dock
    if (dockPos) {
      const distanceToDock = primaryPos.distanceTo(dockPos);
      if (distanceToDock < 1.0) {
        // Move further right or further forward
        primaryRightOffset += 0.5;
        primaryPos.copy(cameraPos);
        primaryPos.add(forward.clone().multiplyScalar(primaryDistance));
        primaryPos.add(right.clone().multiplyScalar(primaryRightOffset));
        primaryPos.y = height;
        console.log(`[ASSET_PLACEHOLDER] Adjusted primary position to avoid dock`);
      }
    }

    placeholders.push({
      id: 'focus-primary',
      width: primarySize,
      height: primarySize,
      depth: primarySize,
      position: primaryPos,
      rotation: new THREE.Euler(0, Math.atan2(-forward.x, -forward.z), 0),
      strategy: 'focus-secondary',
      showDebug: this.config.showDebug,
    });

    // Secondary placeholders (left/right at angles to avoid center)
    for (let i = 1; i < assetCount; i++) {
      const side = i % 2 === 1 ? -1 : 1; // Alternate left/right
      const angle = side * 60; // 60 degrees left or right (wider to avoid center)
      const angleRad = THREE.MathUtils.degToRad(angle);

      const rotatedForward = forward.clone();
      rotatedForward.applyAxisAngle(up, angleRad);

      const position = new THREE.Vector3();
      position.copy(cameraPos);
      position.add(rotatedForward.multiplyScalar(secondaryDistance));
      position.y = height;

      placeholders.push({
        id: `focus-secondary-${i}`,
        width: secondarySize,
        height: secondarySize,
        depth: secondarySize,
        position,
        rotation: new THREE.Euler(0, Math.atan2(-rotatedForward.x, -rotatedForward.z), 0),
        strategy: 'focus-secondary',
        showDebug: this.config.showDebug,
      });
    }

    console.log(`[ASSET_PLACEHOLDER] Focus + Secondary: Primary offset right ${primaryRightOffset.toFixed(2)}m, secondaries at ±60°`);
    console.log(`[ASSET_PLACEHOLDER] UI panel at ${uiPanelDistance}m forward (center), Dock ${dockPos ? `at (${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)})` : 'not configured'}`);
    return placeholders;
  }

  /**
   * Carousel Rotation Mode
   * Single placeholder offset to avoid UI panel and dock
   */
  private createCarouselPlaceholders(
    assetCount: number,
    cameraPos: THREE.Vector3,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
    floorY: number,
    uiPanelDistance: number,
    dockConfig?: { distance: number; rightOffset: number; verticalOffset: number }
  ): PlaceholderConfig[] {
    // Place carousel placeholder to the right to avoid center UI panel and dock
    const distance = Math.max(this.config.defaultDistance, uiPanelDistance + 0.5);
    let rightOffset = 1.2; // Offset right to avoid center panel
    const size = this.config.defaultSize;
    const height = floorY + 1.0;

    // Dock position (if provided)
    const dockPos = dockConfig ? (() => {
      const pos = new THREE.Vector3();
      pos.copy(cameraPos);
      pos.add(forward.clone().multiplyScalar(dockConfig.distance));
      pos.add(right.clone().multiplyScalar(dockConfig.rightOffset));
      pos.y = cameraPos.y + dockConfig.verticalOffset;
      return pos;
    })() : null;

    const position = new THREE.Vector3();
    position.copy(cameraPos);
    position.add(forward.clone().multiplyScalar(distance));
    position.add(right.clone().multiplyScalar(rightOffset)); // Offset right
    position.y = height;

    // Adjust if too close to dock
    if (dockPos) {
      const distanceToDock = position.distanceTo(dockPos);
      if (distanceToDock < 1.0) {
        // Move further right or further forward
        rightOffset += 0.5;
        position.copy(cameraPos);
        position.add(forward.clone().multiplyScalar(distance));
        position.add(right.clone().multiplyScalar(rightOffset));
        position.y = height;
        console.log(`[ASSET_PLACEHOLDER] Adjusted carousel position to avoid dock`);
      }
    }

    console.log(`[ASSET_PLACEHOLDER] Carousel: Single placeholder offset right ${rightOffset.toFixed(2)}m`);
    console.log(`[ASSET_PLACEHOLDER] UI panel at ${uiPanelDistance}m forward (center), Dock ${dockPos ? `at (${dockPos.x.toFixed(2)}, ${dockPos.y.toFixed(2)}, ${dockPos.z.toFixed(2)})` : 'not configured'}`);
    return [{
      id: 'carousel-0',
      width: size,
      height: size,
      depth: size,
      position,
      rotation: new THREE.Euler(0, Math.atan2(-forward.x, -forward.z), 0),
      strategy: 'carousel',
      showDebug: this.config.showDebug,
    }];
  }

  /**
   * Place asset inside placeholder - STRICT placement at exact placeholder position
   */
  public placeAssetInPlaceholder(
    asset: THREE.Object3D,
    placeholder: PlaceholderConfig
  ): void {
    console.log('[ASSET_PLACEHOLDER] Placing asset in placeholder:', placeholder.id);

    // Get asset bounding box (before any transformations)
    const box = new THREE.Box3().setFromObject(asset);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim <= 0) {
      console.warn('[ASSET_PLACEHOLDER] Asset has invalid dimensions, skipping placement');
      return;
    }

    // Calculate scale to fit within placeholder (use 85% to ensure it fits)
    const placeholderMaxDim = Math.max(placeholder.width, placeholder.height, placeholder.depth);
    const scale = (placeholderMaxDim * 0.85) / maxDim;

    // Reset scale first to avoid compounding
    asset.scale.set(1, 1, 1);
    asset.updateMatrixWorld(true);

    // Recalculate bounding box after reset
    const boxAfterReset = new THREE.Box3().setFromObject(asset);
    const sizeAfterReset = boxAfterReset.getSize(new THREE.Vector3());
    const centerAfterReset = boxAfterReset.getCenter(new THREE.Vector3());
    const maxDimAfterReset = Math.max(sizeAfterReset.x, sizeAfterReset.y, sizeAfterReset.z);

    // Calculate final scale
    const finalScale = (placeholderMaxDim * 0.85) / maxDimAfterReset;

    // Apply scale
    asset.scale.set(finalScale, finalScale, finalScale);
    asset.updateMatrixWorld(true);

    // Calculate offset: we need to move the asset so its center aligns with placeholder center
    // The center is in local space, so we need to account for the scale
    const localCenterOffset = centerAfterReset.clone().multiplyScalar(-finalScale);

    // STRICT placement: Set position to exact placeholder position, then adjust for local center
    asset.position.copy(placeholder.position);
    asset.position.add(localCenterOffset);

    // Set rotation to match placeholder rotation exactly
    asset.rotation.copy(placeholder.rotation);

    // Force update matrix
    asset.updateMatrixWorld(true);

    // Verify final position
    const finalBox = new THREE.Box3().setFromObject(asset);
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    const distanceFromPlaceholder = finalCenter.distanceTo(placeholder.position);

    console.log('[ASSET_PLACEHOLDER] Asset placed STRICTLY:', {
      placeholderId: placeholder.id,
      placeholderPosition: `(${placeholder.position.x.toFixed(2)}, ${placeholder.position.y.toFixed(2)}, ${placeholder.position.z.toFixed(2)})`,
      assetPosition: `(${asset.position.x.toFixed(2)}, ${asset.position.y.toFixed(2)}, ${asset.position.z.toFixed(2)})`,
      assetCenter: `(${finalCenter.x.toFixed(2)}, ${finalCenter.y.toFixed(2)}, ${finalCenter.z.toFixed(2)})`,
      distanceFromPlaceholder: distanceFromPlaceholder.toFixed(3) + 'm',
      scale: finalScale.toFixed(3),
      placeholderSize: `${placeholder.width.toFixed(2)} x ${placeholder.height.toFixed(2)} x ${placeholder.depth.toFixed(2)}`,
    });

    if (distanceFromPlaceholder > 0.5) {
      console.warn(`[ASSET_PLACEHOLDER] ⚠️ Asset center is ${distanceFromPlaceholder.toFixed(2)}m from placeholder center - may need adjustment`);
    }
  }

  /**
   * Get all placeholders
   */
  public getPlaceholders(): PlaceholderConfig[] {
    return Array.from(this.placeholders.values());
  }

  /**
   * Get placeholder by ID
   */
  public getPlaceholder(id: string): PlaceholderConfig | undefined {
    return this.placeholders.get(id);
  }

  /**
   * Update debug visualization
   */
  private updateDebugVisualization(): void {
    if (!this.scene) return;

    // Clear existing helpers
    this.clearDebugHelpers();

    if (!this.config.showDebug) return;

    // Create box helpers for each placeholder
    this.placeholders.forEach((placeholder) => {
      const geometry = new THREE.BoxGeometry(
        placeholder.width,
        placeholder.height,
        placeholder.depth
      );
      const edges = new THREE.EdgesGeometry(geometry);
      const helper = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 })
      );

      helper.position.copy(placeholder.position);
      helper.rotation.copy(placeholder.rotation);
      helper.name = `placeholder-debug-${placeholder.id}`;

      this.scene!.add(helper);
      this.debugHelpers.set(placeholder.id, helper as any);
    });

    console.log(`[ASSET_PLACEHOLDER] Debug visualization ${this.config.showDebug ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear debug helpers
   */
  private clearDebugHelpers(): void {
    if (!this.scene) return;

    this.debugHelpers.forEach((helper) => {
      this.scene!.remove(helper);
    });
    this.debugHelpers.clear();
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.clearDebugHelpers();
    this.placeholders.clear();
    this.scene = null;
  }
}
