/**
 * XR Manager - WebXR Session Management
 * 
 * Following Meta Project Flowerbed patterns for Quest Browser compatibility.
 * Handles XR session lifecycle, input sources, and controller management.
 * 
 * @see https://github.com/meta-quest/ProjectFlowerbed
 */

import * as THREE from 'three';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface XRCapabilities {
  isVRSupported: boolean;
  isARSupported: boolean;
  deviceType: 'quest' | 'quest2' | 'quest3' | 'questpro' | 'generic-hmd' | 'unknown';
  hasControllers: boolean;
  hasHandTracking: boolean;
}

export interface XRSessionConfig {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  onSessionStart?: (session: XRSession) => void;
  onSessionEnd?: () => void;
  onInputSourcesChange?: (sources: XRInputSource[]) => void;
}

export interface XRInputState {
  controllers: XRControllerState[];
  hands: XRHandState[];
}

export interface XRControllerState {
  index: number;
  handedness: XRHandedness;
  grip: THREE.Group;
  ray: THREE.Group;
  gamepad: Gamepad | null;
  isSelecting: boolean;
  isSqueezing: boolean;
}

export interface XRHandState {
  index: number;
  handedness: XRHandedness;
  joints: Map<string, THREE.Object3D>;
}

// ============================================================================
// XR Manager Class
// ============================================================================

export class XRManager {
  private renderer: THREE.WebGLRenderer | null = null;
  private session: XRSession | null = null;
  private referenceSpace: XRReferenceSpace | null = null;
  private capabilities: XRCapabilities | null = null;
  private inputState: XRInputState = { controllers: [], hands: [] };
  private config: XRSessionConfig = {};
  
  // Controller objects for Three.js
  private controllerGrips: THREE.Group[] = [];
  private controllerRays: THREE.Group[] = [];
  
  // Event callbacks
  private onSessionStartCallbacks: ((session: XRSession) => void)[] = [];
  private onSessionEndCallbacks: (() => void)[] = [];
  private onFrameCallbacks: ((time: number, frame: XRFrame) => void)[] = [];
  
  constructor() {
    this.checkCapabilities();
  }
  
  // ============================================================================
  // Capability Detection (Flowerbed Pattern)
  // ============================================================================
  
  async checkCapabilities(): Promise<XRCapabilities> {
    const capabilities: XRCapabilities = {
      isVRSupported: false,
      isARSupported: false,
      deviceType: 'unknown',
      hasControllers: false,
      hasHandTracking: false,
    };
    
    if (!('xr' in navigator)) {
      this.capabilities = capabilities;
      return capabilities;
    }
    
    try {
      // Check VR support
      capabilities.isVRSupported = await navigator.xr!.isSessionSupported('immersive-vr');
      
      // Check AR support (optional)
      try {
        capabilities.isARSupported = await navigator.xr!.isSessionSupported('immersive-ar');
      } catch {
        capabilities.isARSupported = false;
      }
      
      // Detect device type from user agent
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('quest 3')) {
        capabilities.deviceType = 'quest3';
      } else if (ua.includes('quest pro')) {
        capabilities.deviceType = 'questpro';
      } else if (ua.includes('quest 2')) {
        capabilities.deviceType = 'quest2';
      } else if (ua.includes('quest') || ua.includes('oculus')) {
        capabilities.deviceType = 'quest';
      } else if (capabilities.isVRSupported) {
        capabilities.deviceType = 'generic-hmd';
      }
      
      // Assume controllers and hand tracking on Quest devices
      if (capabilities.deviceType.startsWith('quest')) {
        capabilities.hasControllers = true;
        capabilities.hasHandTracking = true;
      }
      
    } catch (error) {
      console.error('[XRManager] Capability check failed:', error);
    }
    
    this.capabilities = capabilities;
    console.log('[XRManager] Capabilities:', capabilities);
    return capabilities;
  }
  
  getCapabilities(): XRCapabilities | null {
    return this.capabilities;
  }
  
  // ============================================================================
  // Session Management (Flowerbed Pattern)
  // ============================================================================
  
  async initialize(renderer: THREE.WebGLRenderer): Promise<void> {
    this.renderer = renderer;
    
    // Enable XR on the renderer
    renderer.xr.enabled = true;
    
    // Configure for Quest Browser optimization
    renderer.xr.setFramebufferScaleFactor(1.0); // Full resolution
    
    console.log('[XRManager] Initialized with renderer');
  }
  
  async requestSession(config: XRSessionConfig = {}): Promise<XRSession | null> {
    if (!this.renderer) {
      throw new Error('[XRManager] Renderer not initialized. Call initialize() first.');
    }
    
    if (!this.capabilities?.isVRSupported) {
      throw new Error('[XRManager] VR not supported on this device.');
    }
    
    this.config = config;
    
    // Default features for Quest compatibility
    const sessionInit: XRSessionInit = {
      requiredFeatures: config.requiredFeatures || ['local-floor'],
      optionalFeatures: config.optionalFeatures || [
        'bounded-floor',
        'hand-tracking',
        'layers',
      ],
    };
    
    try {
      console.log('[XRManager] Requesting immersive-vr session...');
      const session = await navigator.xr!.requestSession('immersive-vr', sessionInit);
      
      this.session = session;
      
      // Set up the renderer's XR session
      await this.renderer.xr.setSession(session);
      
      // Get reference space
      try {
        this.referenceSpace = await session.requestReferenceSpace('local-floor');
      } catch {
        // Fallback to local if local-floor not available
        this.referenceSpace = await session.requestReferenceSpace('local');
        console.warn('[XRManager] Using local reference space (no floor)');
      }
      
      // Set up controllers
      this.setupControllers();
      
      // Session event handlers
      session.addEventListener('end', this.handleSessionEnd.bind(this));
      session.addEventListener('inputsourceschange', this.handleInputSourcesChange.bind(this));
      
      // Notify callbacks
      this.onSessionStartCallbacks.forEach(cb => cb(session));
      config.onSessionStart?.(session);
      
      console.log('[XRManager] Session started successfully');
      return session;
      
    } catch (error) {
      console.error('[XRManager] Failed to start session:', error);
      throw error;
    }
  }
  
  async endSession(): Promise<void> {
    if (this.session) {
      await this.session.end();
      this.session = null;
      this.referenceSpace = null;
    }
  }
  
  private handleSessionEnd(): void {
    console.log('[XRManager] Session ended');
    this.session = null;
    this.referenceSpace = null;
    this.inputState = { controllers: [], hands: [] };
    
    this.onSessionEndCallbacks.forEach(cb => cb());
    this.config.onSessionEnd?.();
  }
  
  private handleInputSourcesChange(event: XRInputSourceChangeEvent): void {
    console.log('[XRManager] Input sources changed:', event.added.length, 'added,', event.removed.length, 'removed');
    this.config.onInputSourcesChange?.(Array.from(event.session.inputSources));
  }
  
  // ============================================================================
  // Controller Setup (Flowerbed Pattern)
  // ============================================================================
  
  private setupControllers(): void {
    if (!this.renderer) return;
    
    // Create controller groups for both hands
    for (let i = 0; i < 2; i++) {
      // Controller ray (for raycasting UI interactions)
      const ray = this.renderer.xr.getController(i);
      ray.name = `controller-ray-${i}`;
      this.controllerRays.push(ray);
      
      // Controller grip (for holding objects)
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.name = `controller-grip-${i}`;
      this.controllerGrips.push(grip);
      
      // Add visual ray pointer
      const rayGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3),
      ]);
      const rayMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
      });
      const rayLine = new THREE.Line(rayGeometry, rayMaterial);
      rayLine.name = 'ray-line';
      ray.add(rayLine);
      
      // Add ray endpoint sphere
      const sphereGeometry = new THREE.SphereGeometry(0.01, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.z = -3;
      sphere.name = 'ray-endpoint';
      ray.add(sphere);
      
      // Controller events
      ray.addEventListener('selectstart', () => this.handleSelectStart(i));
      ray.addEventListener('selectend', () => this.handleSelectEnd(i));
      ray.addEventListener('squeezestart', () => this.handleSqueezeStart(i));
      ray.addEventListener('squeezeend', () => this.handleSqueezeEnd(i));
    }
    
    console.log('[XRManager] Controllers set up');
  }
  
  getControllers(): { rays: THREE.Group[]; grips: THREE.Group[] } {
    return {
      rays: this.controllerRays,
      grips: this.controllerGrips,
    };
  }
  
  // ============================================================================
  // Input Event Handlers
  // ============================================================================
  
  private handleSelectStart(index: number): void {
    console.log(`[XRManager] Controller ${index} select start`);
    // Dispatch custom event for UI interaction
    window.dispatchEvent(new CustomEvent('xr-select-start', { detail: { index } }));
  }
  
  private handleSelectEnd(index: number): void {
    console.log(`[XRManager] Controller ${index} select end`);
    window.dispatchEvent(new CustomEvent('xr-select-end', { detail: { index } }));
  }
  
  private handleSqueezeStart(index: number): void {
    console.log(`[XRManager] Controller ${index} squeeze start`);
    window.dispatchEvent(new CustomEvent('xr-squeeze-start', { detail: { index } }));
  }
  
  private handleSqueezeEnd(index: number): void {
    console.log(`[XRManager] Controller ${index} squeeze end`);
    window.dispatchEvent(new CustomEvent('xr-squeeze-end', { detail: { index } }));
  }
  
  // ============================================================================
  // Frame & Update Methods
  // ============================================================================
  
  onFrame(callback: (time: number, frame: XRFrame) => void): void {
    this.onFrameCallbacks.push(callback);
  }
  
  onSessionStart(callback: (session: XRSession) => void): void {
    this.onSessionStartCallbacks.push(callback);
  }
  
  onSessionEnd(callback: () => void): void {
    this.onSessionEndCallbacks.push(callback);
  }
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  isInSession(): boolean {
    return this.session !== null;
  }
  
  getSession(): XRSession | null {
    return this.session;
  }
  
  getReferenceSpace(): XRReferenceSpace | null {
    return this.referenceSpace;
  }
  
  getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  dispose(): void {
    this.endSession();
    this.controllerRays.forEach(r => {
      r.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
    });
    this.controllerRays = [];
    this.controllerGrips = [];
    this.onSessionStartCallbacks = [];
    this.onSessionEndCallbacks = [];
    this.onFrameCallbacks = [];
    console.log('[XRManager] Disposed');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let xrManagerInstance: XRManager | null = null;

export function getXRManager(): XRManager {
  if (!xrManagerInstance) {
    xrManagerInstance = new XRManager();
  }
  return xrManagerInstance;
}

export function disposeXRManager(): void {
  if (xrManagerInstance) {
    xrManagerInstance.dispose();
    xrManagerInstance = null;
  }
}
