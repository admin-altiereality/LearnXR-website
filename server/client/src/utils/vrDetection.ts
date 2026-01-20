/**
 * VR Detection Utilities
 * 
 * Provides comprehensive WebXR capability detection for Meta Quest and other VR headsets.
 * Includes device-specific checks, session support validation, and fallback handling.
 */

export interface VRCapabilities {
  isVRSupported: boolean;
  isWebXRSupported: boolean;
  isImmersiveVRSupported: boolean;
  isMetaQuest: boolean;
  isOculusBrowser: boolean;
  deviceType: 'quest' | 'quest2' | 'quest3' | 'questPro' | 'other-vr' | 'desktop' | 'mobile' | 'unknown';
  browserInfo: string;
  errorMessage?: string;
}

export interface VRSessionOptions {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
}

// Cache the VR capabilities to avoid repeated async checks
let cachedCapabilities: VRCapabilities | null = null;
let capabilitiesPromise: Promise<VRCapabilities> | null = null;

/**
 * Detect if running on Meta Quest browser
 */
export function isMetaQuestBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes('quest') ||
    ua.includes('oculus') ||
    ua.includes('oculusbrowser') ||
    ua.includes('pacific') // Quest codename
  );
}

/**
 * Detect specific Quest model from user agent
 */
export function detectQuestModel(): 'quest' | 'quest2' | 'quest3' | 'questPro' | 'other-vr' | null {
  if (typeof navigator === 'undefined') return null;
  
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('quest 3') || ua.includes('quest3')) return 'quest3';
  if (ua.includes('quest pro') || ua.includes('questpro')) return 'questPro';
  if (ua.includes('quest 2') || ua.includes('quest2')) return 'quest2';
  if (ua.includes('quest')) return 'quest';
  if (ua.includes('oculus')) return 'other-vr';
  
  return null;
}

/**
 * Check if WebXR API is available
 */
export function hasWebXRAPI(): boolean {
  return typeof navigator !== 'undefined' && 'xr' in navigator;
}

/**
 * Check if immersive-vr sessions are supported
 * This is the main check for VR headset capability
 */
export async function checkImmersiveVRSupport(): Promise<boolean> {
  if (!hasWebXRAPI()) return false;
  
  try {
    const supported = await navigator.xr!.isSessionSupported('immersive-vr');
    return supported;
  } catch (error) {
    console.warn('[VR Detection] Error checking immersive-vr support:', error);
    return false;
  }
}

/**
 * Check if inline XR sessions are supported (for 2D fallback)
 */
export async function checkInlineXRSupport(): Promise<boolean> {
  if (!hasWebXRAPI()) return false;
  
  try {
    const supported = await navigator.xr!.isSessionSupported('inline');
    return supported;
  } catch (error) {
    console.warn('[VR Detection] Error checking inline support:', error);
    return false;
  }
}

/**
 * Detect device type based on user agent
 */
export function detectDeviceType(): 'quest' | 'quest2' | 'quest3' | 'questPro' | 'other-vr' | 'desktop' | 'mobile' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  
  const questModel = detectQuestModel();
  if (questModel) return questModel;
  
  const ua = navigator.userAgent.toLowerCase();
  
  // Check for other VR browsers
  if (ua.includes('vr') || ua.includes('xr')) return 'other-vr';
  
  // Mobile detection
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}

/**
 * Get comprehensive VR capabilities
 * Caches the result to avoid repeated async calls
 */
export async function getVRCapabilities(): Promise<VRCapabilities> {
  // Return cached result if available
  if (cachedCapabilities) return cachedCapabilities;
  
  // Return existing promise if already checking
  if (capabilitiesPromise) return capabilitiesPromise;
  
  capabilitiesPromise = (async () => {
    const isWebXRSupported = hasWebXRAPI();
    const isImmersiveVRSupported = isWebXRSupported ? await checkImmersiveVRSupport() : false;
    const isMetaQuest = isMetaQuestBrowser();
    const deviceType = detectDeviceType();
    
    const capabilities: VRCapabilities = {
      isVRSupported: isImmersiveVRSupported,
      isWebXRSupported,
      isImmersiveVRSupported,
      isMetaQuest,
      isOculusBrowser: isMetaQuest,
      deviceType,
      browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    };
    
    // Add helpful error messages
    if (!isWebXRSupported) {
      capabilities.errorMessage = 'WebXR not supported in this browser. Use Meta Quest Browser or a WebXR-compatible browser.';
    } else if (!isImmersiveVRSupported) {
      capabilities.errorMessage = 'Immersive VR not supported. Please use a VR headset with Meta Quest Browser.';
    }
    
    cachedCapabilities = capabilities;
    return capabilities;
  })();
  
  return capabilitiesPromise;
}

/**
 * Quick synchronous check if VR is likely supported
 * For UI display purposes before full async check
 */
export function isVRLikelySupported(): boolean {
  // If we have cached capabilities, use them
  if (cachedCapabilities) return cachedCapabilities.isVRSupported;
  
  // Quick checks without async
  if (!hasWebXRAPI()) return false;
  if (isMetaQuestBrowser()) return true; // Quest browser very likely supports VR
  
  // Can't be sure without async check
  return false;
}

/**
 * Request an immersive VR session
 */
export async function requestVRSession(
  options: VRSessionOptions = {}
): Promise<XRSession | null> {
  if (!hasWebXRAPI()) {
    console.error('[VR] WebXR API not available');
    return null;
  }
  
  const defaultOptions: XRSessionInit = {
    requiredFeatures: options.requiredFeatures || ['local-floor'],
    optionalFeatures: options.optionalFeatures || ['bounded-floor', 'hand-tracking'],
  };
  
  try {
    console.log('[VR] Requesting immersive-vr session...');
    const session = await navigator.xr!.requestSession('immersive-vr', defaultOptions);
    console.log('[VR] Session started successfully');
    return session;
  } catch (error) {
    console.error('[VR] Failed to start session:', error);
    return null;
  }
}

/**
 * End an XR session safely
 */
export async function endVRSession(session: XRSession | null): Promise<void> {
  if (!session) return;
  
  try {
    await session.end();
    console.log('[VR] Session ended');
  } catch (error) {
    console.warn('[VR] Error ending session:', error);
  }
}

/**
 * Clear cached capabilities (useful for testing)
 */
export function clearVRCapabilitiesCache(): void {
  cachedCapabilities = null;
  capabilitiesPromise = null;
}

/**
 * Get a user-friendly message about VR support
 */
export function getVRSupportMessage(capabilities: VRCapabilities): string {
  if (capabilities.isVRSupported) {
    if (capabilities.isMetaQuest) {
      return `VR Ready - ${capabilities.deviceType.replace('-', ' ').toUpperCase()}`;
    }
    return 'VR Ready';
  }
  
  if (!capabilities.isWebXRSupported) {
    return 'WebXR not supported - Use Meta Quest Browser';
  }
  
  return capabilities.errorMessage || 'VR headset required';
}

/**
 * Get recommended action for non-VR users
 */
export function getVRRecommendation(capabilities: VRCapabilities): {
  message: string;
  canPreview2D: boolean;
  action?: 'get-headset' | 'use-quest-browser' | 'enable-webxr';
} {
  if (capabilities.isVRSupported) {
    return {
      message: 'Your device supports VR!',
      canPreview2D: true,
    };
  }
  
  if (capabilities.deviceType === 'mobile') {
    return {
      message: 'For the full VR experience, use a Meta Quest headset.',
      canPreview2D: true,
      action: 'get-headset',
    };
  }
  
  if (capabilities.deviceType === 'desktop') {
    return {
      message: 'VR mode requires a VR headset (Meta Quest Browser recommended).',
      canPreview2D: true,
      action: 'get-headset',
    };
  }
  
  return {
    message: 'Open this lesson in Meta Quest Browser for VR experience.',
    canPreview2D: true,
    action: 'use-quest-browser',
  };
}

// Export types for WebXR (these may not be in all TypeScript libs)
declare global {
  interface Navigator {
    xr?: XRSystem;
  }
  
  interface XRSystem {
    isSessionSupported(mode: XRSessionMode): Promise<boolean>;
    requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
  }
  
  type XRSessionMode = 'inline' | 'immersive-vr' | 'immersive-ar';
  
  interface XRSessionInit {
    requiredFeatures?: string[];
    optionalFeatures?: string[];
  }
  
  interface XRSession {
    end(): Promise<void>;
    requestReferenceSpace(type: XRReferenceSpaceType): Promise<XRReferenceSpace>;
    requestAnimationFrame(callback: XRFrameRequestCallback): number;
    cancelAnimationFrame(handle: number): void;
    renderState: XRRenderState;
    inputSources: XRInputSourceArray;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    updateRenderState(state: XRRenderStateInit): void;
  }
  
  interface XRRenderState {
    baseLayer?: XRWebGLLayer;
    depthFar: number;
    depthNear: number;
  }
  
  interface XRRenderStateInit {
    baseLayer?: XRWebGLLayer;
    depthFar?: number;
    depthNear?: number;
  }
  
  type XRReferenceSpaceType = 'viewer' | 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';
  
  interface XRReferenceSpace {
    getOffsetReferenceSpace(originOffset: XRRigidTransform): XRReferenceSpace;
  }
  
  interface XRRigidTransform {
    position: DOMPointReadOnly;
    orientation: DOMPointReadOnly;
    matrix: Float32Array;
    inverse: XRRigidTransform;
  }
  
  type XRFrameRequestCallback = (time: DOMHighResTimeStamp, frame: XRFrame) => void;
  
  interface XRFrame {
    session: XRSession;
    getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
    getPose(space: XRSpace, baseSpace: XRSpace): XRPose | null;
  }
  
  interface XRViewerPose {
    transform: XRRigidTransform;
    views: readonly XRView[];
  }
  
  interface XRView {
    eye: 'left' | 'right' | 'none';
    projectionMatrix: Float32Array;
    transform: XRRigidTransform;
  }
  
  interface XRPose {
    transform: XRRigidTransform;
  }
  
  interface XRSpace {}
  
  interface XRInputSourceArray {
    length: number;
    [index: number]: XRInputSource;
  }
  
  interface XRInputSource {
    handedness: 'none' | 'left' | 'right';
    targetRayMode: 'gaze' | 'tracked-pointer' | 'screen';
    targetRaySpace: XRSpace;
    gripSpace?: XRSpace;
    gamepad?: Gamepad;
  }
  
  interface XRWebGLLayerInit {
    antialias?: boolean;
    depth?: boolean;
    stencil?: boolean;
    alpha?: boolean;
    framebufferScaleFactor?: number;
  }
  
  declare class XRWebGLLayer {
    constructor(session: XRSession, context: WebGLRenderingContext | WebGL2RenderingContext, layerInit?: XRWebGLLayerInit);
    readonly framebuffer: WebGLFramebuffer | null;
    readonly framebufferWidth: number;
    readonly framebufferHeight: number;
    getViewport(view: XRView): XRViewport | null;
  }
  
  interface XRViewport {
    x: number;
    y: number;
    width: number;
    height: number;
  }
}

export default {
  isMetaQuestBrowser,
  detectQuestModel,
  hasWebXRAPI,
  checkImmersiveVRSupport,
  checkInlineXRSupport,
  detectDeviceType,
  getVRCapabilities,
  isVRLikelySupported,
  requestVRSession,
  endVRSession,
  getVRSupportMessage,
  getVRRecommendation,
  clearVRCapabilitiesCache,
};
