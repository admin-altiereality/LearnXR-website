/**
 * Gesture Recognition - Hand tracking gesture detection for WebXR
 * 
 * This module provides gesture recognition for hand tracking input,
 * including pinch, grab, point, and other common VR gestures.
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export enum GestureType {
  NONE = 'NONE',
  POINT = 'POINT',
  PINCH = 'PINCH',
  GRAB = 'GRAB',
  OPEN_PALM = 'OPEN_PALM',
  THUMBS_UP = 'THUMBS_UP',
  FIST = 'FIST',
}

export interface PinchState {
  isPinching: boolean;
  strength: number; // 0-1
  position: THREE.Vector3;
}

export interface GrabState {
  isGrabbing: boolean;
  strength: number; // 0-1
}

export interface HandJointData {
  position: THREE.Vector3;
  radius: number;
}

export interface HandState {
  isTracking: boolean;
  joints: Map<string, HandJointData>;
  gesture: GestureType;
  pinchState: PinchState;
  grabState: GrabState;
  ray: THREE.Ray;
}

// Joint names for WebXR Hand Input
export const HAND_JOINTS = {
  WRIST: 'wrist',
  THUMB_METACARPAL: 'thumb-metacarpal',
  THUMB_PHALANX_PROXIMAL: 'thumb-phalanx-proximal',
  THUMB_PHALANX_DISTAL: 'thumb-phalanx-distal',
  THUMB_TIP: 'thumb-tip',
  INDEX_METACARPAL: 'index-finger-metacarpal',
  INDEX_PHALANX_PROXIMAL: 'index-finger-phalanx-proximal',
  INDEX_PHALANX_INTERMEDIATE: 'index-finger-phalanx-intermediate',
  INDEX_PHALANX_DISTAL: 'index-finger-phalanx-distal',
  INDEX_TIP: 'index-finger-tip',
  MIDDLE_METACARPAL: 'middle-finger-metacarpal',
  MIDDLE_PHALANX_PROXIMAL: 'middle-finger-phalanx-proximal',
  MIDDLE_PHALANX_INTERMEDIATE: 'middle-finger-phalanx-intermediate',
  MIDDLE_PHALANX_DISTAL: 'middle-finger-phalanx-distal',
  MIDDLE_TIP: 'middle-finger-tip',
  RING_METACARPAL: 'ring-finger-metacarpal',
  RING_PHALANX_PROXIMAL: 'ring-finger-phalanx-proximal',
  RING_PHALANX_INTERMEDIATE: 'ring-finger-phalanx-intermediate',
  RING_PHALANX_DISTAL: 'ring-finger-phalanx-distal',
  RING_TIP: 'ring-finger-tip',
  PINKY_METACARPAL: 'pinky-finger-metacarpal',
  PINKY_PHALANX_PROXIMAL: 'pinky-finger-phalanx-proximal',
  PINKY_PHALANX_INTERMEDIATE: 'pinky-finger-phalanx-intermediate',
  PINKY_PHALANX_DISTAL: 'pinky-finger-phalanx-distal',
  PINKY_TIP: 'pinky-finger-tip',
};

// ============================================================================
// Debug Logging
// ============================================================================

const DEBUG = {
  INTERACTION: '[Interaction]',
};

function log(...args: any[]): void {
  console.log(DEBUG.INTERACTION, ...args);
}

// ============================================================================
// Configuration
// ============================================================================

export interface GestureConfig {
  pinchThreshold: number;      // Distance in meters to consider pinch
  pinchReleaseThreshold: number;
  grabThreshold: number;       // Finger curl amount for grab
  pointAngleThreshold: number; // Max angle deviation for point gesture
}

const DEFAULT_CONFIG: GestureConfig = {
  pinchThreshold: 0.02,        // 2cm
  pinchReleaseThreshold: 0.04, // 4cm for hysteresis
  grabThreshold: 0.7,          // 70% curl
  pointAngleThreshold: 30,     // degrees
};

// ============================================================================
// Gesture Recognition Class
// ============================================================================

export class GestureRecognition {
  private config: GestureConfig;
  private leftHandState: HandState;
  private rightHandState: HandState;
  private tempVector: THREE.Vector3;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.leftHandState = this.createDefaultHandState();
    this.rightHandState = this.createDefaultHandState();
    this.tempVector = new THREE.Vector3();
  }

  private createDefaultHandState(): HandState {
    return {
      isTracking: false,
      joints: new Map(),
      gesture: GestureType.NONE,
      pinchState: {
        isPinching: false,
        strength: 0,
        position: new THREE.Vector3(),
      },
      grabState: {
        isGrabbing: false,
        strength: 0,
      },
      ray: new THREE.Ray(),
    };
  }

  // ============================================================================
  // Hand State Updates
  // ============================================================================

  /**
   * Update hand state from XRHand data
   */
  updateHandState(
    hand: 'left' | 'right',
    xrHand: XRHand | null,
    xrFrame: XRFrame,
    referenceSpace: XRReferenceSpace
  ): HandState {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;

    if (!xrHand || !xrFrame || !referenceSpace) {
      state.isTracking = false;
      state.gesture = GestureType.NONE;
      return state;
    }

    state.isTracking = true;

    // Update joint positions
    this.updateJointPositions(xrHand, xrFrame, referenceSpace, state);

    // Detect gestures
    state.pinchState = this.detectPinch(state);
    state.grabState = this.detectGrab(state);
    state.gesture = this.classifyGesture(state);
    state.ray = this.calculateHandRay(state);

    return state;
  }

  /**
   * Update joint positions from XRHand
   */
  private updateJointPositions(
    xrHand: XRHand,
    xrFrame: XRFrame,
    referenceSpace: XRReferenceSpace,
    state: HandState
  ): void {
    const jointNames = Object.values(HAND_JOINTS);

    for (const jointName of jointNames) {
      const joint = xrHand.get(jointName as XRHandJoint);
      if (!joint) continue;

      const pose = xrFrame.getJointPose?.(joint, referenceSpace);
      if (pose) {
        const position = new THREE.Vector3(
          pose.transform.position.x,
          pose.transform.position.y,
          pose.transform.position.z
        );
        state.joints.set(jointName, {
          position,
          radius: pose.radius || 0.01,
        });
      }
    }
  }

  // ============================================================================
  // Gesture Detection
  // ============================================================================

  /**
   * Detect pinch gesture between thumb and index finger
   */
  private detectPinch(state: HandState): PinchState {
    const thumbTip = state.joints.get(HAND_JOINTS.THUMB_TIP);
    const indexTip = state.joints.get(HAND_JOINTS.INDEX_TIP);

    const result: PinchState = {
      isPinching: false,
      strength: 0,
      position: new THREE.Vector3(),
    };

    if (!thumbTip || !indexTip) {
      return result;
    }

    const distance = thumbTip.position.distanceTo(indexTip.position);
    
    // Use hysteresis for stable pinch detection
    const threshold = state.pinchState.isPinching
      ? this.config.pinchReleaseThreshold
      : this.config.pinchThreshold;

    result.isPinching = distance < threshold;
    result.strength = 1 - Math.min(distance / this.config.pinchReleaseThreshold, 1);
    result.position.lerpVectors(thumbTip.position, indexTip.position, 0.5);

    return result;
  }

  /**
   * Detect grab gesture (fist)
   */
  private detectGrab(state: HandState): GrabState {
    const result: GrabState = {
      isGrabbing: false,
      strength: 0,
    };

    // Calculate average finger curl
    const fingerCurls = [
      this.calculateFingerCurl(state, 'index-finger'),
      this.calculateFingerCurl(state, 'middle-finger'),
      this.calculateFingerCurl(state, 'ring-finger'),
      this.calculateFingerCurl(state, 'pinky-finger'),
    ];

    const avgCurl = fingerCurls.reduce((a, b) => a + b, 0) / fingerCurls.length;
    
    result.isGrabbing = avgCurl > this.config.grabThreshold;
    result.strength = avgCurl;

    return result;
  }

  /**
   * Calculate curl amount for a finger (0 = straight, 1 = fully curled)
   */
  private calculateFingerCurl(state: HandState, fingerPrefix: string): number {
    const metacarpal = state.joints.get(`${fingerPrefix}-metacarpal`);
    const proximal = state.joints.get(`${fingerPrefix}-phalanx-proximal`);
    const intermediate = state.joints.get(`${fingerPrefix}-phalanx-intermediate`);
    const distal = state.joints.get(`${fingerPrefix}-phalanx-distal`);
    const tip = state.joints.get(`${fingerPrefix}-tip`);

    if (!metacarpal || !proximal || !intermediate || !distal || !tip) {
      return 0;
    }

    // Calculate the ratio of actual distance to extended distance
    const actualDistance = metacarpal.position.distanceTo(tip.position);
    
    // Estimate extended length as sum of bone lengths
    const extendedLength = 
      metacarpal.position.distanceTo(proximal.position) +
      proximal.position.distanceTo(intermediate.position) +
      intermediate.position.distanceTo(distal.position) +
      distal.position.distanceTo(tip.position);

    // Curl is inverse of extension ratio
    const extensionRatio = Math.min(actualDistance / (extendedLength * 0.95), 1);
    return 1 - extensionRatio;
  }

  /**
   * Classify the current hand gesture
   */
  private classifyGesture(state: HandState): GestureType {
    if (state.pinchState.isPinching) {
      return GestureType.PINCH;
    }

    if (state.grabState.isGrabbing) {
      return GestureType.GRAB;
    }

    // Check for pointing gesture
    if (this.isPointing(state)) {
      return GestureType.POINT;
    }

    // Check for open palm
    if (this.isOpenPalm(state)) {
      return GestureType.OPEN_PALM;
    }

    // Check for thumbs up
    if (this.isThumbsUp(state)) {
      return GestureType.THUMBS_UP;
    }

    // Check for fist (closed hand but not grabbing)
    if (this.isFist(state)) {
      return GestureType.FIST;
    }

    return GestureType.NONE;
  }

  /**
   * Check if hand is in pointing gesture
   */
  private isPointing(state: HandState): boolean {
    const indexCurl = this.calculateFingerCurl(state, 'index-finger');
    const middleCurl = this.calculateFingerCurl(state, 'middle-finger');
    const ringCurl = this.calculateFingerCurl(state, 'ring-finger');
    const pinkyCurl = this.calculateFingerCurl(state, 'pinky-finger');

    // Index extended, other fingers curled
    return indexCurl < 0.3 && middleCurl > 0.6 && ringCurl > 0.6 && pinkyCurl > 0.6;
  }

  /**
   * Check if hand is in open palm gesture
   */
  private isOpenPalm(state: HandState): boolean {
    const indexCurl = this.calculateFingerCurl(state, 'index-finger');
    const middleCurl = this.calculateFingerCurl(state, 'middle-finger');
    const ringCurl = this.calculateFingerCurl(state, 'ring-finger');
    const pinkyCurl = this.calculateFingerCurl(state, 'pinky-finger');

    // All fingers extended
    return indexCurl < 0.3 && middleCurl < 0.3 && ringCurl < 0.3 && pinkyCurl < 0.3;
  }

  /**
   * Check if hand is in thumbs up gesture
   */
  private isThumbsUp(state: HandState): boolean {
    const wrist = state.joints.get(HAND_JOINTS.WRIST);
    const thumbTip = state.joints.get(HAND_JOINTS.THUMB_TIP);
    
    if (!wrist || !thumbTip) return false;

    // Thumb should be above wrist
    const thumbAbove = thumbTip.position.y > wrist.position.y + 0.03;
    
    // Other fingers should be curled
    const indexCurl = this.calculateFingerCurl(state, 'index-finger');
    const middleCurl = this.calculateFingerCurl(state, 'middle-finger');
    const othersCurled = indexCurl > 0.6 && middleCurl > 0.6;

    return thumbAbove && othersCurled;
  }

  /**
   * Check if hand is in fist gesture
   */
  private isFist(state: HandState): boolean {
    const indexCurl = this.calculateFingerCurl(state, 'index-finger');
    const middleCurl = this.calculateFingerCurl(state, 'middle-finger');
    const ringCurl = this.calculateFingerCurl(state, 'ring-finger');
    const pinkyCurl = this.calculateFingerCurl(state, 'pinky-finger');

    return indexCurl > 0.7 && middleCurl > 0.7 && ringCurl > 0.7 && pinkyCurl > 0.7;
  }

  // ============================================================================
  // Hand Ray Calculation
  // ============================================================================

  /**
   * Calculate ray from hand for pointing/selection
   */
  private calculateHandRay(state: HandState): THREE.Ray {
    const wrist = state.joints.get(HAND_JOINTS.WRIST);
    const indexProximal = state.joints.get(HAND_JOINTS.INDEX_PHALANX_PROXIMAL);
    const indexTip = state.joints.get(HAND_JOINTS.INDEX_TIP);

    const ray = new THREE.Ray();

    if (!wrist || !indexProximal || !indexTip) {
      return ray;
    }

    // For pointing, use index finger direction
    if (state.gesture === GestureType.POINT || state.gesture === GestureType.PINCH) {
      ray.origin.copy(indexProximal.position);
      ray.direction.subVectors(indexTip.position, indexProximal.position).normalize();
    } else {
      // Default: use wrist to middle of hand
      const middleProximal = state.joints.get(HAND_JOINTS.MIDDLE_PHALANX_PROXIMAL);
      if (middleProximal) {
        ray.origin.copy(wrist.position);
        ray.direction.subVectors(middleProximal.position, wrist.position).normalize();
      }
    }

    return ray;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current pinch state for a hand
   */
  getPinchState(hand: 'left' | 'right'): PinchState {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    return { ...state.pinchState, position: state.pinchState.position.clone() };
  }

  /**
   * Get current grab state for a hand
   */
  getGrabState(hand: 'left' | 'right'): GrabState {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    return { ...state.grabState };
  }

  /**
   * Get current gesture for a hand
   */
  getGesture(hand: 'left' | 'right'): GestureType {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    return state.gesture;
  }

  /**
   * Get hand ray for a hand
   */
  getHandRay(hand: 'left' | 'right'): THREE.Ray {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    return state.ray.clone();
  }

  /**
   * Check if a hand is currently tracking
   */
  isHandTracking(hand: 'left' | 'right'): boolean {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    return state.isTracking;
  }

  /**
   * Get joint position
   */
  getJointPosition(hand: 'left' | 'right', joint: string): THREE.Vector3 | null {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    const jointData = state.joints.get(joint);
    return jointData ? jointData.position.clone() : null;
  }

  /**
   * Get full hand state
   */
  getHandState(hand: 'left' | 'right'): HandState {
    return hand === 'left' ? this.leftHandState : this.rightHandState;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GestureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log('Gesture config updated:', newConfig);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createGestureRecognition(config?: Partial<GestureConfig>): GestureRecognition {
  return new GestureRecognition(config);
}

export default GestureRecognition;
