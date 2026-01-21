/**
 * XR Module - WebXR Experience System
 * 
 * Following Meta Project Flowerbed patterns for Quest Browser compatibility.
 * 
 * @see https://github.com/meta-quest/ProjectFlowerbed
 */

export { XRManager, getXRManager, disposeXRManager } from './xrManager';
export type { XRCapabilities, XRSessionConfig, XRInputState } from './xrManager';

export { VRSceneManager } from './vrSceneManager';
export type { LessonContent, LoadingProgress, SceneConfig } from './vrSceneManager';

export { VRUISystem } from './vrUISystem';
export type { MCQQuestion, MCQOption, TTSSection, VRUIConfig } from './vrUISystem';
