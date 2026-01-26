/**
 * WebXR Utilities - Barrel Export
 * 
 * Export all WebXR utility modules for easy importing.
 */

// Layout Engine
export {
  LayoutEngine,
  createLayoutEngine,
  type LayoutAnchor,
  type ComfortZone,
  type LayoutConfig,
  type AssetArrangement,
} from './layoutEngine';

// Gesture Recognition
export {
  GestureRecognition,
  createGestureRecognition,
  GestureType,
  type PinchState,
  type GrabState,
  type HandState,
  type HandJointData,
  type GestureConfig,
  HAND_JOINTS,
} from './gestureRecognition';

// Interaction Manager
export {
  InteractionManager,
  createInteractionManager,
  type HoverTarget,
  type SelectEvent,
  type InteractionState,
  type InteractionEventHandler,
  type InteractionConfig,
} from './interactionManager';

// UI Panel System
export {
  UIPanelSystem,
  createUIPanelSystem,
  DEFAULT_THEME,
  type UITheme,
  type LessonPhase,
  type TTSControlState,
  type QuizState,
  type MCQData,
  type ButtonConfig,
} from './uiPanelSystem';

// Asset Manager
export {
  AssetManager,
  createAssetManager,
  type AssetData,
  type LoadedAsset,
  type ManipulationState,
  type AssetManagerConfig,
  type AssetLoadCallback,
  type AssetErrorCallback,
  type AssetProgressCallback,
} from './assetManager';

// ============================================================================
// Debug Categories
// ============================================================================

export const DEBUG_CATEGORIES = {
  XR: '[XR]',
  LAYOUT: '[Layout]',
  UI: '[UI]',
  ASSET: '[Asset]',
  INTERACTION: '[Interaction]',
  TTS: '[TTS]',
  QUIZ: '[Quiz]',
};

// ============================================================================
// Convenience Factory
// ============================================================================

import { LayoutEngine, LayoutConfig } from './layoutEngine';
import { GestureRecognition, GestureConfig } from './gestureRecognition';
import { InteractionManager, InteractionConfig } from './interactionManager';
import { UIPanelSystem, UITheme } from './uiPanelSystem';
import { AssetManager, AssetManagerConfig } from './assetManager';

export interface WebXRSystemsConfig {
  layout?: Partial<LayoutConfig>;
  gesture?: Partial<GestureConfig>;
  interaction?: Partial<InteractionConfig>;
  ui?: Partial<UITheme>;
  asset?: Partial<AssetManagerConfig>;
}

export interface WebXRSystems {
  layoutEngine: LayoutEngine;
  gestureRecognition: GestureRecognition;
  interactionManager: InteractionManager;
  uiPanelSystem: UIPanelSystem;
  assetManager: AssetManager;
}

/**
 * Create all WebXR systems at once
 */
export function createWebXRSystems(config: WebXRSystemsConfig = {}): WebXRSystems {
  const layoutEngine = new LayoutEngine(config.layout);
  const gestureRecognition = new GestureRecognition(config.gesture);
  const interactionManager = new InteractionManager(config.interaction);
  const uiPanelSystem = new UIPanelSystem(config.ui);
  const assetManager = new AssetManager(config.asset);

  // Connect systems
  assetManager.setLayoutEngine(layoutEngine);

  return {
    layoutEngine,
    gestureRecognition,
    interactionManager,
    uiPanelSystem,
    assetManager,
  };
}

/**
 * Dispose all WebXR systems
 */
export function disposeWebXRSystems(systems: WebXRSystems, scene?: THREE.Scene): void {
  systems.interactionManager.dispose();
  systems.uiPanelSystem.dispose();
  systems.assetManager.dispose(scene);
}

// Import THREE at the end to avoid circular dependency issues
import * as THREE from 'three';

// Default export
export default {
  createWebXRSystems,
  disposeWebXRSystems,
  DEBUG_CATEGORIES,
};
