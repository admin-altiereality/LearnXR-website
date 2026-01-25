/**
 * Layout Engine V2 - Scientific Adaptive Positioning System for WebXR
 * 
 * This module provides intelligent positioning of UI panels and 3D assets
 * based on the user's head pose in VR/AR environments.
 * 
 * POSITIONING STRATEGY:
 * - UI Panel: LEFT side of user's view (-20° from forward)
 * - 3D Assets: RIGHT side of user's view (+20° from forward)
 * - Both at comfortable viewing distance (1.8-2.2m)
 * - Assets positioned at "table height" (~1.0m) for natural viewing
 * 
 * COORDINATE SYSTEM:
 * - Three.js uses RIGHT-HANDED coordinates
 * - +X = Right, +Y = Up, -Z = Forward (into screen)
 * - Angles: Positive rotation around Y = counter-clockwise when viewed from above
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface LayoutAnchor {
  position: THREE.Vector3;       // User's head/camera position
  forwardDirection: THREE.Vector3; // Flattened forward direction (horizontal)
  upDirection: THREE.Vector3;    // World up (0, 1, 0)
  rightDirection: THREE.Vector3; // Right direction (cross of up and forward)
  timestamp: number;
  rawCameraY: number;            // Original camera Y before flattening
}

export interface ComfortZone {
  center: THREE.Vector3;
  horizontalFOV: number;  // degrees
  verticalFOV: number;    // degrees
  nearDistance: number;   // meters
  farDistance: number;    // meters
  optimalDistance: number; // meters
}

export interface LayoutConfig {
  // UI Panel positioning
  uiPanelAngle: number;        // degrees from forward (negative = left)
  uiPanelDistance: number;     // meters
  uiPanelVerticalOffset: number; // meters from eye level
  
  // Asset positioning
  assetAngle: number;          // degrees from forward (positive = right)
  assetDistance: number;       // meters from user
  assetHeight: number;         // meters above floor (absolute)
  secondaryAssetArcAngle: number;  // degrees between multiple assets
  
  // Comfort zone
  minDistance: number;
  maxDistance: number;
  horizontalFOV: number;
  verticalFOV: number;
  
  // Floor reference
  assumedFloorY: number;       // Assumed floor Y coordinate
}

export type AssetArrangement = 
  | 'SINGLE_FOCUS'
  | 'HORIZONTAL_LINE'
  | 'ARC_FORMATION'
  | 'CAROUSEL'
  | 'SHELF_DISPLAY';

// ============================================================================
// Debug Logging - Comprehensive
// ============================================================================

const DEBUG_PREFIX = '🎯 [LayoutEngine]';

function logSection(title: string): void {
  console.log(`\n${DEBUG_PREFIX} ════════════════════════════════════════`);
  console.log(`${DEBUG_PREFIX} ${title}`);
  console.log(`${DEBUG_PREFIX} ════════════════════════════════════════`);
}

function log(...args: any[]): void {
  console.log(DEBUG_PREFIX, ...args);
}

function logVector(name: string, v: THREE.Vector3): void {
  console.log(`${DEBUG_PREFIX}   ${name}: (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`);
}

function logValue(name: string, value: any): void {
  console.log(`${DEBUG_PREFIX}   ${name}: ${value}`);
}

// ============================================================================
// Default Configuration - SCIENTIFIC VALUES
// ============================================================================

const DEFAULT_CONFIG: LayoutConfig = {
  // UI Panel: LEFT side of view
  uiPanelAngle: -20,           // 20° to the LEFT (negative)
  uiPanelDistance: 2.0,        // 2 meters away
  uiPanelVerticalOffset: 0,    // At eye level
  
  // 3D Asset: RIGHT side of view
  assetAngle: 20,              // 20° to the RIGHT (positive)
  assetDistance: 2.0,          // 2 meters away
  assetHeight: 1.0,            // 1 meter above floor (table height)
  secondaryAssetArcAngle: 25,  // 25° between multiple assets
  
  // Comfort zone (Quest 2/3 specs)
  minDistance: 1.5,
  maxDistance: 4.0,
  horizontalFOV: 110,
  verticalFOV: 90,
  
  // Floor reference
  assumedFloorY: 0,            // Floor at Y=0
};

// ============================================================================
// Layout Engine Class - COMPREHENSIVE
// ============================================================================

export class LayoutEngine {
  private anchor: LayoutAnchor | null = null;
  private config: LayoutConfig;
  private comfortZone: ComfortZone;
  private isInitialized: boolean = false;
  private detectedFloorY: number = 0;
  private detectedEyeLevel: number = 1.6;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.comfortZone = this.createDefaultComfortZone();
    log('LayoutEngine created with config:', this.config);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  initialize(xrSession?: XRSession): void {
    logSection('INITIALIZATION');
    
    if (xrSession) {
      this.calculateComfortZone(xrSession);
      log('Initialized with XR session');
    } else {
      log('Initialized without XR session (using defaults)');
    }
    
    this.isInitialized = true;
    log('✅ Layout engine is now initialized');
  }

  private createDefaultComfortZone(): ComfortZone {
    return {
      center: new THREE.Vector3(0, 1.6, 0),
      horizontalFOV: this.config.horizontalFOV,
      verticalFOV: this.config.verticalFOV,
      nearDistance: this.config.minDistance,
      farDistance: this.config.maxDistance,
      optimalDistance: this.config.uiPanelDistance,
    };
  }

  // ============================================================================
  // Anchor Management - THE CRITICAL PART
  // ============================================================================

  /**
   * Compute layout anchor from camera pose
   * This is the foundation for ALL positioning calculations
   */
  computeAnchor(camera: THREE.Camera, xrFrame?: XRFrame): LayoutAnchor {
    logSection('COMPUTING ANCHOR FROM VR CAMERA');
    
    // Get camera world position
    const cameraWorldPos = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPos);
    
    log('📷 CAMERA INFO:');
    logVector('  World Position', cameraWorldPos);
    logValue('  Camera Y (EYE LEVEL)', `${cameraWorldPos.y.toFixed(3)}m`);
    
    // Check if camera seems to be at floor level or elevated
    if (cameraWorldPos.y < 0.5) {
      log('  ⚠️ Camera Y < 0.5m - appears to be at FLOOR LEVEL');
      log('  ⚠️ This might indicate floor-referenced tracking');
    } else if (cameraWorldPos.y > 1.0 && cameraWorldPos.y < 2.0) {
      log('  ✅ Camera Y in normal range (1.0-2.0m) - typical standing height');
    } else if (cameraWorldPos.y >= 2.0) {
      log('  ⚠️ Camera Y >= 2.0m - unusually high');
    }
    
    // Get camera forward direction
    const rawForward = new THREE.Vector3(0, 0, -1);
    rawForward.applyQuaternion(camera.quaternion);
    logVector('  Raw Forward', rawForward);
    
    // CRITICAL: Flatten forward direction to horizontal plane
    const flatForward = new THREE.Vector3(rawForward.x, 0, rawForward.z);
    
    if (flatForward.lengthSq() < 0.001) {
      log('  ⚠️ User looking straight up/down, using default forward');
      flatForward.set(0, 0, -1);
    }
    flatForward.normalize();
    logVector('  Flattened Forward', flatForward);
    
    // Calculate right direction
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rightDir = new THREE.Vector3();
    rightDir.crossVectors(flatForward, worldUp).normalize();
    logVector('  Right Direction', rightDir);
    
    // Store detected values
    this.detectedEyeLevel = cameraWorldPos.y;
    this.detectedFloorY = Math.max(0, cameraWorldPos.y - 1.6);
    
    log('📐 LAYOUT REFERENCE POINTS:');
    logValue('  Eye Level', `${this.detectedEyeLevel.toFixed(3)}m`);
    logValue('  Estimated Floor', `${this.detectedFloorY.toFixed(3)}m`);
    logValue('  Asset will be at', `${(this.detectedEyeLevel - 0.6).toFixed(3)}m (0.6m below eye)`);
    
    const anchor: LayoutAnchor = {
      position: cameraWorldPos.clone(),
      forwardDirection: flatForward.clone(),
      upDirection: worldUp.clone(),
      rightDirection: rightDir.clone(),
      timestamp: Date.now(),
      rawCameraY: cameraWorldPos.y,
    };
    
    this.anchor = anchor;
    this.comfortZone.center.copy(cameraWorldPos);
    
    log('✅ Anchor computed successfully');
    
    return anchor;
  }

  private logAnchorSummary(): void {
    if (!this.anchor) return;
    
    log('ANCHOR SUMMARY:');
    logVector('  Position', this.anchor.position);
    logVector('  Forward', this.anchor.forwardDirection);
    logVector('  Right', this.anchor.rightDirection);
  }

  getStableAnchor(): LayoutAnchor | null {
    return this.anchor;
  }

  shouldRecomputeAnchor(maxAgeMs: number = 60000): boolean {
    if (!this.anchor) return true;
    return Date.now() - this.anchor.timestamp > maxAgeMs;
  }

  // ============================================================================
  // Comfort Zone Calculation
  // ============================================================================

  calculateComfortZone(xrSession: XRSession): ComfortZone {
    this.comfortZone = {
      center: this.anchor?.position.clone() || new THREE.Vector3(0, 1.6, 0),
      horizontalFOV: this.config.horizontalFOV,
      verticalFOV: this.config.verticalFOV,
      nearDistance: this.config.minDistance,
      farDistance: this.config.maxDistance,
      optimalDistance: this.config.uiPanelDistance,
    };

    log('Comfort zone updated:', {
      hFOV: `${this.comfortZone.horizontalFOV}°`,
      vFOV: `${this.comfortZone.verticalFOV}°`,
      distance: `${this.comfortZone.nearDistance}-${this.comfortZone.farDistance}m`,
    });

    return this.comfortZone;
  }

  getComfortZone(): ComfortZone {
    return this.comfortZone;
  }

  // ============================================================================
  // UI Panel Positioning
  // ============================================================================

  /**
   * Position UI panel to the LEFT of user's view
   */
  positionUIPanel(panelSize?: { w: number; h: number }): THREE.Vector3 {
    logSection('POSITIONING UI PANEL');
    
    if (!this.anchor) {
      log('⚠️ No anchor, using fallback position');
      const fallback = new THREE.Vector3(-0.7, 1.6, -1.8);
      logVector('Fallback Position', fallback);
      return fallback;
    }

    const anchor = this.anchor;
    
    // Convert angle to radians (negative = rotate left)
    const angleRad = THREE.MathUtils.degToRad(this.config.uiPanelAngle);
    logValue('UI Panel Angle', `${this.config.uiPanelAngle}° = ${angleRad.toFixed(4)} rad`);
    
    // Rotate forward direction by angle around Y axis
    const rotatedForward = anchor.forwardDirection.clone();
    rotatedForward.applyAxisAngle(anchor.upDirection, angleRad);
    logVector('Rotated Forward', rotatedForward);
    
    // Calculate position: anchor + rotatedForward * distance
    const position = anchor.position.clone()
      .add(rotatedForward.multiplyScalar(this.config.uiPanelDistance));
    
    // Set Y to eye level + offset
    position.y = anchor.position.y + this.config.uiPanelVerticalOffset;
    
    logVector('Final UI Panel Position', position);
    log(`Distance from user: ${this.config.uiPanelDistance}m`);
    
    return position;
  }

  getUIPanelRotation(): THREE.Euler {
    if (!this.anchor) {
      return new THREE.Euler(0, 0, 0);
    }

    const panelPos = this.positionUIPanel();
    const toUser = this.anchor.position.clone().sub(panelPos).normalize();
    const yRotation = Math.atan2(toUser.x, toUser.z);

    return new THREE.Euler(0, yRotation, 0);
  }

  // ============================================================================
  // 3D Asset Positioning - THE KEY FIX
  // ============================================================================

  selectArrangement(count: number): AssetArrangement {
    if (count <= 1) return 'SINGLE_FOCUS';
    if (count === 2) return 'HORIZONTAL_LINE';
    if (count <= 4) return 'ARC_FORMATION';
    if (count <= 6) return 'CAROUSEL';
    return 'SHELF_DISPLAY';
  }

  /**
   * Calculate positions for assets
   * Main entry point for asset positioning
   */
  positionAssets(count: number, arrangement?: AssetArrangement): THREE.Vector3[] {
    logSection(`POSITIONING ${count} ASSET(S)`);
    
    if (!this.anchor) {
      log('⚠️ No anchor set, using fallback positions');
      return this.getDefaultAssetPositions(count);
    }

    const strategy = arrangement || this.selectArrangement(count);
    logValue('Strategy', strategy);

    let positions: THREE.Vector3[];
    
    switch (strategy) {
      case 'SINGLE_FOCUS':
        positions = [this.calculateAssetPosition(0, 1)];
        break;
      case 'HORIZONTAL_LINE':
        positions = this.calculateHorizontalPositions(count);
        break;
      case 'ARC_FORMATION':
        positions = this.calculateArcPositions(count);
        break;
      default:
        positions = this.calculateArcPositions(count);
    }

    // Log all positions
    positions.forEach((pos, i) => {
      logVector(`Asset ${i + 1} Position`, pos);
    });

    return positions;
  }

  /**
   * Calculate position for a single asset
   * SCIENTIFIC APPROACH:
   * 1. Start from anchor position (user's head)
   * 2. Rotate forward direction by assetAngle (to the RIGHT)
   * 3. Move along rotated direction by assetDistance
   * 4. Set Y RELATIVE TO USER'S VIEW - below eye level for comfortable viewing
   */
  private calculateAssetPosition(index: number, total: number, angleOffset: number = 0): THREE.Vector3 {
    if (!this.anchor) {
      return new THREE.Vector3(0.8, 1.0, -2.0);
    }

    const anchor = this.anchor;
    
    // Calculate angle: base angle + offset for multiple assets
    const baseAngle = this.config.assetAngle; // 20° to the right
    const totalAngle = baseAngle + angleOffset;
    const angleRad = THREE.MathUtils.degToRad(totalAngle);
    
    log(`  Asset ${index + 1}/${total}: angle=${totalAngle}°`);
    
    // Rotate forward direction by angle
    // In Three.js: positive rotation around Y is COUNTER-CLOCKWISE when viewed from above
    // So to go RIGHT, we need NEGATIVE rotation
    const rotatedForward = anchor.forwardDirection.clone();
    rotatedForward.applyAxisAngle(anchor.upDirection, -angleRad);
    
    // Calculate horizontal position
    const position = new THREE.Vector3();
    position.copy(anchor.position);
    position.add(rotatedForward.clone().multiplyScalar(this.config.assetDistance));
    
    // CRITICAL FIX: Set Y RELATIVE TO USER'S EYE LEVEL
    // Position asset 0.5-0.7m BELOW eye level for comfortable "looking down at table" viewing
    // This works regardless of whether camera Y is at floor level or elevated
    const eyeLevel = anchor.position.y;
    const verticalOffset = -0.6; // 0.6m below eye level
    position.y = eyeLevel + verticalOffset;
    
    log(`  Calculated position:`);
    log(`    Eye level: ${eyeLevel.toFixed(3)}m`);
    log(`    Vertical offset: ${verticalOffset}m (below eye)`);
    log(`    Final Y: ${position.y.toFixed(3)}m`);
    log(`    Final position: (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
    
    return position;
  }

  /**
   * Position multiple assets in a horizontal line to the RIGHT of view
   */
  private calculateHorizontalPositions(count: number): THREE.Vector3[] {
    if (!this.anchor) return this.getDefaultAssetPositions(count);

    const positions: THREE.Vector3[] = [];
    const spacing = 0.8; // meters between assets
    
    // Center the line on the base asset angle
    const totalWidth = spacing * (count - 1);
    
    for (let i = 0; i < count; i++) {
      // Offset each asset along the right direction
      const lateralOffset = (i - (count - 1) / 2) * spacing;
      
      // Calculate base position at asset angle
      const basePos = this.calculateAssetPosition(i, count);
      
      // Add lateral offset
      basePos.add(this.anchor.rightDirection.clone().multiplyScalar(lateralOffset));
      
      positions.push(basePos);
    }

    return positions;
  }

  /**
   * Position multiple assets in an arc to the RIGHT of view
   */
  private calculateArcPositions(count: number): THREE.Vector3[] {
    if (!this.anchor) return this.getDefaultAssetPositions(count);

    const positions: THREE.Vector3[] = [];
    const arcSpan = this.config.secondaryAssetArcAngle * (count - 1);
    const startAngle = -arcSpan / 2;

    for (let i = 0; i < count; i++) {
      const angleOffset = startAngle + i * this.config.secondaryAssetArcAngle;
      positions.push(this.calculateAssetPosition(i, count, angleOffset));
    }

    return positions;
  }

  /**
   * Fallback positions when no anchor is available
   */
  private getDefaultAssetPositions(count: number): THREE.Vector3[] {
    logSection('USING DEFAULT ASSET POSITIONS');
    
    const positions: THREE.Vector3[] = [];
    const spacing = 0.8;
    const baseX = 0.7; // Offset to the right
    const baseY = 1.0; // Table height
    const baseZ = -2.0; // 2m in front

    for (let i = 0; i < count; i++) {
      const x = baseX + (i - (count - 1) / 2) * spacing;
      const pos = new THREE.Vector3(x, baseY, baseZ);
      positions.push(pos);
      logVector(`Default Position ${i + 1}`, pos);
    }

    return positions;
  }

  // ============================================================================
  // Public Interface for Direct Asset Positioning
  // ============================================================================

  /**
   * Get a single optimal position for one asset (RIGHT side of view)
   * This is the main method to call for placing a single 3D asset
   */
  getOptimalAssetPosition(): THREE.Vector3 {
    logSection('GET OPTIMAL ASSET POSITION');
    
    if (!this.anchor) {
      const fallback = new THREE.Vector3(0.8, 1.0, -2.0);
      log('⚠️ No anchor, using fallback');
      logVector('Fallback Position', fallback);
      return fallback;
    }

    const position = this.calculateAssetPosition(0, 1);
    
    log('POSITION CALCULATION DETAILS:');
    logValue('  Anchor Y (eye level)', `${this.anchor.position.y.toFixed(3)}m`);
    logValue('  Detected Floor Y', `${this.detectedFloorY.toFixed(3)}m`);
    logValue('  Asset Config Height', `${this.config.assetHeight}m`);
    logValue('  Asset Angle', `${this.config.assetAngle}° (to the right)`);
    logValue('  Asset Distance', `${this.config.assetDistance}m`);
    logVector('  Final Position', position);
    
    // Verify the position makes sense
    const distanceFromUser = position.distanceTo(this.anchor.position);
    const heightAboveFloor = position.y - this.detectedFloorY;
    
    log('VERIFICATION:');
    logValue('  Distance from user', `${distanceFromUser.toFixed(2)}m`);
    logValue('  Height above floor', `${heightAboveFloor.toFixed(2)}m`);
    
    return position;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  updateConfig(newConfig: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log('Config updated:', newConfig);
  }

  getConfig(): LayoutConfig {
    return { ...this.config };
  }

  isInComfortZone(position: THREE.Vector3): boolean {
    if (!this.anchor) return true;

    const toPosition = position.clone().sub(this.anchor.position);
    const distance = toPosition.length();

    if (distance < this.comfortZone.nearDistance || distance > this.comfortZone.farDistance) {
      return false;
    }

    const flatToPosition = toPosition.clone();
    flatToPosition.y = 0;
    flatToPosition.normalize();

    const flatForward = this.anchor.forwardDirection.clone();
    flatForward.y = 0;
    flatForward.normalize();

    const horizontalAngle = Math.acos(flatToPosition.dot(flatForward)) * (180 / Math.PI);
    return horizontalAngle <= this.comfortZone.horizontalFOV / 2;
  }

  clampToComfortZone(position: THREE.Vector3): THREE.Vector3 {
    if (!this.anchor) return position.clone();

    const toPosition = position.clone().sub(this.anchor.position);
    const distance = toPosition.length();

    const clampedDistance = THREE.MathUtils.clamp(
      distance,
      this.comfortZone.nearDistance,
      this.comfortZone.farDistance
    );

    if (Math.abs(distance - clampedDistance) > 0.001) {
      toPosition.normalize().multiplyScalar(clampedDistance);
    }

    return this.anchor.position.clone().add(toPosition);
  }

  getEyeLevel(): number {
    return this.detectedEyeLevel;
  }

  getFloorY(): number {
    return this.detectedFloorY;
  }

  isReady(): boolean {
    const ready = this.isInitialized && this.anchor !== null;
    return ready;
  }

  /**
   * Debug: Get comprehensive state dump
   */
  getDebugState(): object {
    return {
      isInitialized: this.isInitialized,
      hasAnchor: this.anchor !== null,
      isReady: this.isReady(),
      detectedEyeLevel: this.detectedEyeLevel,
      detectedFloorY: this.detectedFloorY,
      config: this.config,
      anchor: this.anchor ? {
        position: {
          x: this.anchor.position.x,
          y: this.anchor.position.y,
          z: this.anchor.position.z,
        },
        forward: {
          x: this.anchor.forwardDirection.x,
          y: this.anchor.forwardDirection.y,
          z: this.anchor.forwardDirection.z,
        },
        right: {
          x: this.anchor.rightDirection.x,
          y: this.anchor.rightDirection.y,
          z: this.anchor.rightDirection.z,
        },
        timestamp: this.anchor.timestamp,
      } : null,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLayoutEngine(config?: Partial<LayoutConfig>): LayoutEngine {
  return new LayoutEngine(config);
}

export default LayoutEngine;
