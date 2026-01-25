/**
 * Interaction Manager - Controller ray input and hand tracking for WebXR
 * 
 * This module handles all XR input: controller ray casting, hand tracking,
 * hover states, selection, and haptic feedback.
 */

import * as THREE from 'three';
import { GestureRecognition, GestureType, PinchState, GrabState } from './gestureRecognition';

// ============================================================================
// Types
// ============================================================================

export interface HoverTarget {
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  uv?: THREE.Vector2;
}

export interface SelectEvent {
  type: 'select' | 'selectstart' | 'selectend';
  inputSource: 'controller' | 'hand';
  hand?: 'left' | 'right';
  controllerIndex?: number;
  target: HoverTarget | null;
  ray: THREE.Ray;
}

export interface InteractionState {
  isHovering: boolean;
  isSelecting: boolean;
  hoverTarget: HoverTarget | null;
  selectTarget: HoverTarget | null;
}

export type InteractionEventHandler = (event: SelectEvent) => void;

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

export interface InteractionConfig {
  rayLength: number;
  hoverColor: number;
  selectColor: number;
  rayColor: number;
  reticleSize: number;
  hapticIntensity: number;
  hapticDuration: number;
}

const DEFAULT_CONFIG: InteractionConfig = {
  rayLength: 10,
  hoverColor: 0x00ffff,
  selectColor: 0x00ff00,
  rayColor: 0xffffff,
  reticleSize: 0.02,
  hapticIntensity: 0.5,
  hapticDuration: 50,
};

// ============================================================================
// Interaction Manager Class
// ============================================================================

export class InteractionManager {
  private config: InteractionConfig;
  private gestureRecognition: GestureRecognition;
  private raycaster: THREE.Raycaster;
  private tempMatrix: THREE.Matrix4;
  private tempVector: THREE.Vector3;
  
  // Controller state
  private controller1: THREE.Group | null = null;
  private controller2: THREE.Group | null = null;
  private controller1Ray: THREE.Line | null = null;
  private controller2Ray: THREE.Line | null = null;
  private controller1Reticle: THREE.Mesh | null = null;
  private controller2Reticle: THREE.Mesh | null = null;
  
  // Hand tracking state
  private leftHand: XRHand | null = null;
  private rightHand: XRHand | null = null;
  private handTrackingEnabled: boolean = false;
  
  // Interaction state
  private interactableObjects: THREE.Object3D[] = [];
  private controller1State: InteractionState;
  private controller2State: InteractionState;
  private leftHandState: InteractionState;
  private rightHandState: InteractionState;
  
  // Event handlers
  private onSelect: InteractionEventHandler | null = null;
  private onSelectStart: InteractionEventHandler | null = null;
  private onSelectEnd: InteractionEventHandler | null = null;
  private onHoverStart: ((target: HoverTarget) => void) | null = null;
  private onHoverEnd: ((target: HoverTarget) => void) | null = null;

  // Input source references
  private controller1InputSource: XRInputSource | null = null;
  private controller2InputSource: XRInputSource | null = null;

  constructor(config: Partial<InteractionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gestureRecognition = new GestureRecognition();
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.tempVector = new THREE.Vector3();
    
    this.controller1State = this.createDefaultInteractionState();
    this.controller2State = this.createDefaultInteractionState();
    this.leftHandState = this.createDefaultInteractionState();
    this.rightHandState = this.createDefaultInteractionState();
  }

  private createDefaultInteractionState(): InteractionState {
    return {
      isHovering: false,
      isSelecting: false,
      hoverTarget: null,
      selectTarget: null,
    };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize controllers with XR renderer
   */
  initControllers(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ): void {
    // Get controllers
    this.controller1 = renderer.xr.getController(0);
    this.controller2 = renderer.xr.getController(1);

    // Setup ray visualization for controller 1
    this.controller1Ray = this.createRayLine();
    this.controller1.add(this.controller1Ray);
    this.controller1Reticle = this.createReticle();
    scene.add(this.controller1Reticle);

    // Setup ray visualization for controller 2
    this.controller2Ray = this.createRayLine();
    this.controller2.add(this.controller2Ray);
    this.controller2Reticle = this.createReticle();
    scene.add(this.controller2Reticle);

    // Add controllers to scene
    scene.add(this.controller1);
    scene.add(this.controller2);

    // Setup event listeners
    this.setupControllerEvents(this.controller1, 0);
    this.setupControllerEvents(this.controller2, 1);

    log('Controllers initialized');
  }

  /**
   * Initialize hand tracking if available
   */
  async initHandTracking(xrSession: XRSession): Promise<boolean> {
    try {
      // Check if hand tracking is supported
      if (!('hand' in XRInputSource.prototype)) {
        log('Hand tracking not supported');
        return false;
      }

      this.handTrackingEnabled = true;
      log('Hand tracking initialized');
      return true;
    } catch (error) {
      log('Failed to initialize hand tracking:', error);
      return false;
    }
  }

  /**
   * Create ray line for visualization
   */
  private createRayLine(): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: this.config.rayColor,
      transparent: true,
      opacity: 0.6,
    });
    const line = new THREE.Line(geometry, material);
    line.name = 'controllerRay';
    line.scale.z = this.config.rayLength;
    return line;
  }

  /**
   * Create reticle for targeting
   */
  private createReticle(): THREE.Mesh {
    const geometry = new THREE.RingGeometry(
      this.config.reticleSize * 0.8,
      this.config.reticleSize,
      32
    );
    const material = new THREE.MeshBasicMaterial({
      color: this.config.rayColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const reticle = new THREE.Mesh(geometry, material);
    reticle.name = 'reticle';
    reticle.visible = false;
    return reticle;
  }

  /**
   * Setup controller event listeners
   */
  private setupControllerEvents(controller: THREE.Group, index: number): void {
    controller.addEventListener('connected', (event: any) => {
      const inputSource = event.data as XRInputSource;
      if (index === 0) {
        this.controller1InputSource = inputSource;
      } else {
        this.controller2InputSource = inputSource;
      }
      log(`Controller ${index} connected:`, inputSource.handedness);
    });

    controller.addEventListener('disconnected', () => {
      if (index === 0) {
        this.controller1InputSource = null;
      } else {
        this.controller2InputSource = null;
      }
      log(`Controller ${index} disconnected`);
    });

    controller.addEventListener('selectstart', () => {
      this.handleSelectStart(controller, index);
    });

    controller.addEventListener('selectend', () => {
      this.handleSelectEnd(controller, index);
    });
  }

  // ============================================================================
  // Interactable Objects Management
  // ============================================================================

  /**
   * Register an object as interactable
   */
  addInteractable(object: THREE.Object3D): void {
    if (!this.interactableObjects.includes(object)) {
      this.interactableObjects.push(object);
      object.userData.isInteractable = true;
    }
  }

  /**
   * Remove an object from interactables
   */
  removeInteractable(object: THREE.Object3D): void {
    const index = this.interactableObjects.indexOf(object);
    if (index !== -1) {
      this.interactableObjects.splice(index, 1);
      object.userData.isInteractable = false;
    }
  }

  /**
   * Clear all interactables
   */
  clearInteractables(): void {
    this.interactableObjects.forEach(obj => {
      obj.userData.isInteractable = false;
    });
    this.interactableObjects = [];
  }

  /**
   * Set interactable objects (replaces all)
   */
  setInteractables(objects: THREE.Object3D[]): void {
    this.clearInteractables();
    objects.forEach(obj => this.addInteractable(obj));
  }

  // ============================================================================
  // Update Loop
  // ============================================================================

  /**
   * Update interaction state each frame
   */
  update(xrFrame?: XRFrame, referenceSpace?: XRReferenceSpace): void {
    // Update controller raycasts
    if (this.controller1) {
      this.updateControllerRaycast(this.controller1, this.controller1State, this.controller1Ray, this.controller1Reticle);
    }
    if (this.controller2) {
      this.updateControllerRaycast(this.controller2, this.controller2State, this.controller2Ray, this.controller2Reticle);
    }

    // Update hand tracking if available
    if (this.handTrackingEnabled && xrFrame && referenceSpace) {
      this.updateHandTracking(xrFrame, referenceSpace);
    }
  }

  /**
   * Update raycast for a controller
   */
  private updateControllerRaycast(
    controller: THREE.Group,
    state: InteractionState,
    rayLine: THREE.Line | null,
    reticle: THREE.Mesh | null
  ): void {
    // Get ray from controller
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(this.tempMatrix);
    const origin = new THREE.Vector3();
    controller.getWorldPosition(origin);

    this.raycaster.set(origin, direction);

    // Check intersections with interactable objects
    const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
    
    const previousHover = state.hoverTarget;
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      const target: HoverTarget = {
        object: this.findInteractableParent(hit.object) || hit.object,
        point: hit.point.clone(),
        distance: hit.distance,
        uv: hit.uv?.clone(),
      };

      // Update hover state
      if (!state.isHovering || previousHover?.object !== target.object) {
        if (previousHover && this.onHoverEnd) {
          this.onHoverEnd(previousHover);
        }
        if (this.onHoverStart) {
          this.onHoverStart(target);
        }
      }

      state.isHovering = true;
      state.hoverTarget = target;

      // Update reticle position
      if (reticle) {
        reticle.visible = true;
        reticle.position.copy(hit.point);
        reticle.lookAt(origin);
        (reticle.material as THREE.MeshBasicMaterial).color.setHex(
          state.isSelecting ? this.config.selectColor : this.config.hoverColor
        );
      }

      // Update ray color
      if (rayLine) {
        (rayLine.material as THREE.LineBasicMaterial).color.setHex(
          state.isSelecting ? this.config.selectColor : this.config.hoverColor
        );
      }
    } else {
      // No intersection
      if (state.isHovering && previousHover && this.onHoverEnd) {
        this.onHoverEnd(previousHover);
      }
      state.isHovering = false;
      state.hoverTarget = null;

      if (reticle) {
        reticle.visible = false;
      }
      if (rayLine) {
        (rayLine.material as THREE.LineBasicMaterial).color.setHex(this.config.rayColor);
      }
    }
  }

  /**
   * Find the interactable parent of an object
   */
  private findInteractableParent(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.isInteractable) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Update hand tracking state
   */
  private updateHandTracking(xrFrame: XRFrame, referenceSpace: XRReferenceSpace): void {
    const session = xrFrame.session;
    
    for (const inputSource of session.inputSources) {
      if (inputSource.hand) {
        const handedness = inputSource.handedness;
        const xrHand = inputSource.hand;
        
        // Update gesture recognition
        const handState = this.gestureRecognition.updateHandState(
          handedness as 'left' | 'right',
          xrHand,
          xrFrame,
          referenceSpace
        );

        // Update interaction state based on gestures
        const interactionState = handedness === 'left' ? this.leftHandState : this.rightHandState;
        
        // Pinch gesture for selection
        if (handState.pinchState.isPinching && !interactionState.isSelecting) {
          this.handleHandSelectStart(handedness as 'left' | 'right');
        } else if (!handState.pinchState.isPinching && interactionState.isSelecting) {
          this.handleHandSelectEnd(handedness as 'left' | 'right');
        }

        // Update raycast for hand
        this.updateHandRaycast(handedness as 'left' | 'right', handState.ray);
      }
    }
  }

  /**
   * Update raycast for hand tracking
   */
  private updateHandRaycast(hand: 'left' | 'right', ray: THREE.Ray): void {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    
    this.raycaster.set(ray.origin, ray.direction);
    const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const target: HoverTarget = {
        object: this.findInteractableParent(hit.object) || hit.object,
        point: hit.point.clone(),
        distance: hit.distance,
        uv: hit.uv?.clone(),
      };

      state.isHovering = true;
      state.hoverTarget = target;
    } else {
      state.isHovering = false;
      state.hoverTarget = null;
    }
  }

  // ============================================================================
  // Selection Handling
  // ============================================================================

  private handleSelectStart(controller: THREE.Group, index: number): void {
    const state = index === 0 ? this.controller1State : this.controller2State;
    state.isSelecting = true;
    state.selectTarget = state.hoverTarget;

    // Trigger haptic feedback
    this.triggerHaptic(index);

    // Fire event
    if (this.onSelectStart) {
      const event: SelectEvent = {
        type: 'selectstart',
        inputSource: 'controller',
        controllerIndex: index,
        target: state.hoverTarget,
        ray: this.getRayFromController(controller),
      };
      this.onSelectStart(event);
    }

    log(`Controller ${index} select start:`, state.hoverTarget?.object.name || 'none');
  }

  private handleSelectEnd(controller: THREE.Group, index: number): void {
    const state = index === 0 ? this.controller1State : this.controller2State;
    const wasSelecting = state.isSelecting;
    const selectTarget = state.selectTarget;
    
    state.isSelecting = false;
    state.selectTarget = null;

    // Fire select event if target hasn't changed
    if (wasSelecting && selectTarget && state.hoverTarget?.object === selectTarget.object) {
      if (this.onSelect) {
        const event: SelectEvent = {
          type: 'select',
          inputSource: 'controller',
          controllerIndex: index,
          target: selectTarget,
          ray: this.getRayFromController(controller),
        };
        this.onSelect(event);
      }
    }

    // Fire select end event
    if (this.onSelectEnd) {
      const event: SelectEvent = {
        type: 'selectend',
        inputSource: 'controller',
        controllerIndex: index,
        target: selectTarget,
        ray: this.getRayFromController(controller),
      };
      this.onSelectEnd(event);
    }

    log(`Controller ${index} select end:`, selectTarget?.object.name || 'none');
  }

  private handleHandSelectStart(hand: 'left' | 'right'): void {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    state.isSelecting = true;
    state.selectTarget = state.hoverTarget;

    if (this.onSelectStart) {
      const event: SelectEvent = {
        type: 'selectstart',
        inputSource: 'hand',
        hand,
        target: state.hoverTarget,
        ray: this.gestureRecognition.getHandRay(hand),
      };
      this.onSelectStart(event);
    }

    log(`Hand ${hand} select start:`, state.hoverTarget?.object.name || 'none');
  }

  private handleHandSelectEnd(hand: 'left' | 'right'): void {
    const state = hand === 'left' ? this.leftHandState : this.rightHandState;
    const wasSelecting = state.isSelecting;
    const selectTarget = state.selectTarget;
    
    state.isSelecting = false;
    state.selectTarget = null;

    if (wasSelecting && selectTarget && state.hoverTarget?.object === selectTarget.object) {
      if (this.onSelect) {
        const event: SelectEvent = {
          type: 'select',
          inputSource: 'hand',
          hand,
          target: selectTarget,
          ray: this.gestureRecognition.getHandRay(hand),
        };
        this.onSelect(event);
      }
    }

    if (this.onSelectEnd) {
      const event: SelectEvent = {
        type: 'selectend',
        inputSource: 'hand',
        hand,
        target: selectTarget,
        ray: this.gestureRecognition.getHandRay(hand),
      };
      this.onSelectEnd(event);
    }

    log(`Hand ${hand} select end:`, selectTarget?.object.name || 'none');
  }

  // ============================================================================
  // Haptic Feedback
  // ============================================================================

  /**
   * Trigger haptic feedback on a controller
   */
  triggerHaptic(controllerIndex: number, intensity?: number, duration?: number): void {
    const inputSource = controllerIndex === 0 ? this.controller1InputSource : this.controller2InputSource;
    
    if (inputSource?.gamepad?.hapticActuators?.[0]) {
      inputSource.gamepad.hapticActuators[0].pulse(
        intensity ?? this.config.hapticIntensity,
        duration ?? this.config.hapticDuration
      );
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get ray from controller
   */
  private getRayFromController(controller: THREE.Group): THREE.Ray {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(this.tempMatrix);
    const origin = new THREE.Vector3();
    controller.getWorldPosition(origin);
    return new THREE.Ray(origin, direction);
  }

  /**
   * Get interaction state for a controller
   */
  getControllerState(index: number): InteractionState {
    return index === 0 ? { ...this.controller1State } : { ...this.controller2State };
  }

  /**
   * Get interaction state for a hand
   */
  getHandState(hand: 'left' | 'right'): InteractionState {
    return hand === 'left' ? { ...this.leftHandState } : { ...this.rightHandState };
  }

  /**
   * Get pinch state for a hand
   */
  getPinchState(hand: 'left' | 'right'): PinchState {
    return this.gestureRecognition.getPinchState(hand);
  }

  /**
   * Get grab state for a hand
   */
  getGrabState(hand: 'left' | 'right'): GrabState {
    return this.gestureRecognition.getGrabState(hand);
  }

  /**
   * Get current gesture for a hand
   */
  getGesture(hand: 'left' | 'right'): GestureType {
    return this.gestureRecognition.getGesture(hand);
  }

  /**
   * Check if hand tracking is available
   */
  isHandTrackingEnabled(): boolean {
    return this.handTrackingEnabled;
  }

  /**
   * Get controller reference
   */
  getController(index: number): THREE.Group | null {
    return index === 0 ? this.controller1 : this.controller2;
  }

  // ============================================================================
  // Event Handler Registration
  // ============================================================================

  /**
   * Set select event handler
   */
  setOnSelect(handler: InteractionEventHandler | null): void {
    this.onSelect = handler;
  }

  /**
   * Set select start event handler
   */
  setOnSelectStart(handler: InteractionEventHandler | null): void {
    this.onSelectStart = handler;
  }

  /**
   * Set select end event handler
   */
  setOnSelectEnd(handler: InteractionEventHandler | null): void {
    this.onSelectEnd = handler;
  }

  /**
   * Set hover start event handler
   */
  setOnHoverStart(handler: ((target: HoverTarget) => void) | null): void {
    this.onHoverStart = handler;
  }

  /**
   * Set hover end event handler
   */
  setOnHoverEnd(handler: ((target: HoverTarget) => void) | null): void {
    this.onHoverEnd = handler;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InteractionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log('Interaction config updated:', newConfig);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearInteractables();
    this.controller1 = null;
    this.controller2 = null;
    this.controller1Ray = null;
    this.controller2Ray = null;
    this.controller1Reticle = null;
    this.controller2Reticle = null;
    log('Interaction manager disposed');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInteractionManager(config?: Partial<InteractionConfig>): InteractionManager {
  return new InteractionManager(config);
}

export default InteractionManager;
