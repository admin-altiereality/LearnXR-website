/**
 * VR UI System - three-mesh-ui Based VR Interface
 * 
 * Following Meta Project Flowerbed patterns for:
 * - World-space UI panels
 * - Raycast interactions with controllers
 * - TTS playback controls
 * - MCQ question display and answer selection
 * - Explanation text panels
 * 
 * @see https://github.com/meta-quest/ProjectFlowerbed
 * @see https://github.com/felixmariotto/three-mesh-ui
 */

import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MCQOption {
  index: number;
  text: string;
  isCorrect: boolean;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
  correctIndex: number;
}

export interface TTSSection {
  id: string;
  section: 'intro' | 'explanation' | 'outro';
  text: string;
  audioUrl: string;
}

export interface VRUIConfig {
  fontFamily: string;
  fontTexture: string;
  primaryColor: number;
  secondaryColor: number;
  backgroundColor: number;
  panelOpacity: number;
}

// ============================================================================
// Default Font URLs (Roboto MSDF)
// ============================================================================

// Using locally hosted MSDF fonts to avoid CORS issues
const DEFAULT_FONT_FAMILY = '/fonts/Roboto-msdf.json';
const DEFAULT_FONT_TEXTURE = '/fonts/Roboto-msdf.png';

// ============================================================================
// VR UI System Class
// ============================================================================

export class VRUISystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private uiContainer: THREE.Group;
  
  // Raycaster for interactions
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private interactiveElements: Set<ThreeMeshUI.Block> = new Set();
  
  // UI Panels
  private mainPanel: ThreeMeshUI.Block | null = null;
  private ttsPanel: ThreeMeshUI.Block | null = null;
  private mcqPanel: ThreeMeshUI.Block | null = null;
  private infoPanel: ThreeMeshUI.Block | null = null;
  
  // State
  private isInitialized = false;
  private currentHovered: ThreeMeshUI.Block | null = null;
  
  // Callbacks
  private onTTSPlay: (() => void) | null = null;
  private onTTSPause: (() => void) | null = null;
  private onMCQAnswer: ((questionId: string, answerIndex: number) => void) | null = null;
  private onExit: (() => void) | null = null;
  
  // Config
  private config: VRUIConfig = {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontTexture: DEFAULT_FONT_TEXTURE,
    primaryColor: 0x00ccff,
    secondaryColor: 0xff00ff,
    backgroundColor: 0x1a1a2e,
    panelOpacity: 0.9,
  };
  
  // Audio
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, config?: Partial<VRUIConfig>) {
    this.scene = scene;
    this.camera = camera;
    this.config = { ...this.config, ...config };
    
    // Create UI container
    this.uiContainer = new THREE.Group();
    this.uiContainer.name = 'vr-ui-container';
    this.scene.add(this.uiContainer);
    
    // Setup raycaster
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    
    // Create audio element for TTS
    this.audioElement = document.createElement('audio');
    this.audioElement.preload = 'metadata';
    
    console.log('[VRUISystem] Created');
  }
  
  // ============================================================================
  // Initialization
  // ============================================================================
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[VRUISystem] Initializing with font:', this.config.fontFamily);
    
    // Preload fonts before creating any UI - this is CRITICAL for three-mesh-ui
    try {
      await this.preloadFonts();
      console.log('[VRUISystem] Fonts preloaded successfully');
    } catch (error) {
      console.error('[VRUISystem] Font preload failed, using fallback:', error);
      // Continue anyway - three-mesh-ui may still work with default fonts
    }
    
    this.isInitialized = true;
    console.log('[VRUISystem] Initialized');
  }
  
  /**
   * Preload MSDF fonts to prevent "Cannot read properties of undefined (reading 'x')" errors
   * This ensures the font JSON and texture are fully loaded before creating UI elements
   */
  private async preloadFonts(): Promise<void> {
    const fontJsonUrl = this.config.fontFamily;
    const fontTextureUrl = this.config.fontTexture;
    
    console.log('[VRUISystem] Preloading font JSON:', fontJsonUrl);
    console.log('[VRUISystem] Preloading font texture:', fontTextureUrl);
    
    // Load font JSON
    const fontJsonResponse = await fetch(fontJsonUrl);
    if (!fontJsonResponse.ok) {
      throw new Error(`Failed to load font JSON: ${fontJsonResponse.status}`);
    }
    const fontJson = await fontJsonResponse.json();
    console.log('[VRUISystem] Font JSON loaded, chars:', fontJson.chars?.length || 0);
    
    // Preload font texture as image
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log('[VRUISystem] Font texture loaded:', img.width, 'x', img.height);
        resolve();
      };
      img.onerror = (err) => {
        console.error('[VRUISystem] Font texture load error:', err);
        reject(err);
      };
      img.src = fontTextureUrl;
    });
  }
  
  // ============================================================================
  // Main Lesson Info Panel
  // ============================================================================
  
  createInfoPanel(lessonInfo: {
    curriculum: string;
    className: string;
    subject: string;
    chapterName: string;
    topicName: string;
    learningObjective: string;
  }): void {
    // Remove existing panel
    if (this.infoPanel) {
      this.uiContainer.remove(this.infoPanel);
    }
    
    // Create main container
    this.infoPanel = new ThreeMeshUI.Block({
      width: 1.4,
      height: 0.8,
      padding: 0.05,
      borderRadius: 0.03,
      fontFamily: this.config.fontFamily,
      fontTexture: this.config.fontTexture,
      backgroundColor: new THREE.Color(this.config.backgroundColor),
      backgroundOpacity: this.config.panelOpacity,
    });
    
    // Title
    const titleBlock = new ThreeMeshUI.Block({
      width: 1.3,
      height: 0.12,
      backgroundColor: new THREE.Color(this.config.primaryColor),
      backgroundOpacity: 0.3,
      borderRadius: 0.02,
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    titleBlock.add(new ThreeMeshUI.Text({
      content: `${lessonInfo.curriculum} • Class ${lessonInfo.className} • ${lessonInfo.subject}`,
      fontSize: 0.04,
      fontColor: new THREE.Color(0x00ccff),
    }));
    
    // Topic name
    const topicBlock = new ThreeMeshUI.Block({
      width: 1.3,
      height: 0.15,
      margin: 0.02,
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    topicBlock.add(new ThreeMeshUI.Text({
      content: lessonInfo.topicName || lessonInfo.chapterName,
      fontSize: 0.06,
      fontColor: new THREE.Color(0xffffff),
    }));
    
    // Learning objective
    const objectiveBlock = new ThreeMeshUI.Block({
      width: 1.3,
      height: 0.35,
      padding: 0.03,
      backgroundColor: new THREE.Color(0x2a2a4a),
      backgroundOpacity: 0.5,
      borderRadius: 0.02,
    });
    
    objectiveBlock.add(new ThreeMeshUI.Text({
      content: lessonInfo.learningObjective || 'Explore and learn about this topic in immersive VR.',
      fontSize: 0.035,
      fontColor: new THREE.Color(0xcccccc),
    }));
    
    this.infoPanel.add(titleBlock, topicBlock, objectiveBlock);
    
    // Position above user's view
    this.infoPanel.position.set(0, 2.2, -2);
    this.infoPanel.rotation.x = -0.1; // Slight tilt toward user
    
    this.uiContainer.add(this.infoPanel);
    console.log('[VRUISystem] Info panel created');
  }
  
  // ============================================================================
  // TTS Control Panel
  // ============================================================================
  
  createTTSPanel(audioUrl: string, sectionName: string): void {
    // Remove existing panel
    if (this.ttsPanel) {
      this.uiContainer.remove(this.ttsPanel);
    }
    
    // Set audio source
    if (this.audioElement && audioUrl) {
      this.audioElement.src = audioUrl;
      this.audioElement.load();
    }
    
    // Create TTS panel
    this.ttsPanel = new ThreeMeshUI.Block({
      width: 0.8,
      height: 0.25,
      padding: 0.03,
      borderRadius: 0.02,
      fontFamily: this.config.fontFamily,
      fontTexture: this.config.fontTexture,
      backgroundColor: new THREE.Color(0x1a3a2e),
      backgroundOpacity: 0.9,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    // Section label
    const labelBlock = new ThreeMeshUI.Block({
      width: 0.74,
      height: 0.06,
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    labelBlock.add(new ThreeMeshUI.Text({
      content: `🔊 Voice Narration: ${sectionName}`,
      fontSize: 0.03,
      fontColor: new THREE.Color(0x88ffaa),
    }));
    
    // Button container
    const buttonContainer = new ThreeMeshUI.Block({
      width: 0.74,
      height: 0.12,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      margin: 0.01,
    });
    
    // Play button
    const playButton = this.createButton('▶ Play', 0.25, () => {
      this.playTTS();
    });
    
    // Pause button
    const pauseButton = this.createButton('⏸ Pause', 0.25, () => {
      this.pauseTTS();
    });
    
    buttonContainer.add(playButton, pauseButton);
    
    this.ttsPanel.add(labelBlock, buttonContainer);
    
    // Position to the left of user
    this.ttsPanel.position.set(-0.8, 1.2, -1.5);
    this.ttsPanel.rotation.y = 0.3;
    
    this.uiContainer.add(this.ttsPanel);
    console.log('[VRUISystem] TTS panel created');
  }
  
  // ============================================================================
  // MCQ Panel
  // ============================================================================
  
  createMCQPanel(question: MCQQuestion): void {
    // Remove existing panel
    if (this.mcqPanel) {
      this.uiContainer.remove(this.mcqPanel);
    }
    
    // Create MCQ panel
    this.mcqPanel = new ThreeMeshUI.Block({
      width: 1.2,
      height: 0.9,
      padding: 0.04,
      borderRadius: 0.03,
      fontFamily: this.config.fontFamily,
      fontTexture: this.config.fontTexture,
      backgroundColor: new THREE.Color(0x1a1a3e),
      backgroundOpacity: 0.95,
      flexDirection: 'column',
      justifyContent: 'start',
      alignItems: 'center',
    });
    
    // Question header
    const questionHeader = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.08,
      backgroundColor: new THREE.Color(0x3a3a6e),
      backgroundOpacity: 0.5,
      borderRadius: 0.02,
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    questionHeader.add(new ThreeMeshUI.Text({
      content: '📝 Quiz Question',
      fontSize: 0.04,
      fontColor: new THREE.Color(0xffcc00),
    }));
    
    // Question text
    const questionBlock = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.2,
      padding: 0.02,
      margin: 0.02,
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    questionBlock.add(new ThreeMeshUI.Text({
      content: question.question,
      fontSize: 0.04,
      fontColor: new THREE.Color(0xffffff),
    }));
    
    this.mcqPanel.add(questionHeader, questionBlock);
    
    // Options
    question.options.forEach((option, index) => {
      const optionButton = this.createMCQOption(
        `${String.fromCharCode(65 + index)}. ${option.text}`,
        () => {
          this.handleMCQAnswer(question.id, index, option.isCorrect);
        }
      );
      this.mcqPanel!.add(optionButton);
    });
    
    // Position to the right of user
    this.mcqPanel.position.set(0.8, 1.4, -1.5);
    this.mcqPanel.rotation.y = -0.3;
    
    this.uiContainer.add(this.mcqPanel);
    console.log('[VRUISystem] MCQ panel created');
  }
  
  private createMCQOption(text: string, onClick: () => void): ThreeMeshUI.Block {
    const optionBlock = new ThreeMeshUI.Block({
      width: 1.1,
      height: 0.1,
      margin: 0.01,
      padding: 0.02,
      borderRadius: 0.02,
      backgroundColor: new THREE.Color(0x2a2a5a),
      backgroundOpacity: 0.8,
      justifyContent: 'center',
      alignItems: 'start',
    });
    
    optionBlock.add(new ThreeMeshUI.Text({
      content: text.length > 60 ? text.substring(0, 57) + '...' : text,
      fontSize: 0.035,
      fontColor: new THREE.Color(0xdddddd),
    }));
    
    // Setup states for interaction
    optionBlock.setupState({
      state: 'idle',
      attributes: {
        backgroundColor: new THREE.Color(0x2a2a5a),
        backgroundOpacity: 0.8,
      },
    });
    
    optionBlock.setupState({
      state: 'hovered',
      attributes: {
        backgroundColor: new THREE.Color(0x4a4a8a),
        backgroundOpacity: 1,
      },
    });
    
    optionBlock.setupState({
      state: 'selected',
      attributes: {
        backgroundColor: new THREE.Color(0x00cc66),
        backgroundOpacity: 1,
      },
      onSet: onClick,
    });
    
    this.interactiveElements.add(optionBlock);
    
    return optionBlock;
  }
  
  // ============================================================================
  // Exit Panel
  // ============================================================================
  
  createExitButton(): void {
    const exitButton = this.createButton('✕ Exit VR', 0.3, () => {
      this.onExit?.();
    });
    
    exitButton.position.set(0, 0.5, -2);
    this.uiContainer.add(exitButton);
  }
  
  // ============================================================================
  // Button Factory
  // ============================================================================
  
  private createButton(label: string, width: number, onClick: () => void): ThreeMeshUI.Block {
    const button = new ThreeMeshUI.Block({
      width: width,
      height: 0.08,
      margin: 0.01,
      padding: 0.02,
      borderRadius: 0.02,
      fontFamily: this.config.fontFamily,
      fontTexture: this.config.fontTexture,
      backgroundColor: new THREE.Color(this.config.primaryColor),
      backgroundOpacity: 0.8,
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    button.add(new ThreeMeshUI.Text({
      content: label,
      fontSize: 0.035,
      fontColor: new THREE.Color(0xffffff),
    }));
    
    // Setup interaction states
    button.setupState({
      state: 'idle',
      attributes: {
        backgroundColor: new THREE.Color(this.config.primaryColor),
        backgroundOpacity: 0.8,
      },
    });
    
    button.setupState({
      state: 'hovered',
      attributes: {
        backgroundColor: new THREE.Color(0x00eeff),
        backgroundOpacity: 1,
      },
    });
    
    button.setupState({
      state: 'selected',
      attributes: {
        backgroundColor: new THREE.Color(0xffffff),
        backgroundOpacity: 1,
      },
      onSet: onClick,
    });
    
    this.interactiveElements.add(button);
    
    return button;
  }
  
  // ============================================================================
  // TTS Audio Control
  // ============================================================================
  
  playTTS(): void {
    if (this.audioElement) {
      this.audioElement.play().catch(err => {
        console.warn('[VRUISystem] TTS play failed (needs user gesture):', err);
      });
      this.isPlaying = true;
      this.onTTSPlay?.();
    }
  }
  
  pauseTTS(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.isPlaying = false;
      this.onTTSPause?.();
    }
  }
  
  setTTSSource(url: string): void {
    if (this.audioElement) {
      this.audioElement.src = url;
      this.audioElement.load();
    }
  }
  
  // ============================================================================
  // MCQ Handling
  // ============================================================================
  
  private handleMCQAnswer(questionId: string, answerIndex: number, isCorrect: boolean): void {
    console.log(`[VRUISystem] MCQ Answer: Q=${questionId}, A=${answerIndex}, Correct=${isCorrect}`);
    this.onMCQAnswer?.(questionId, answerIndex);
    
    // Visual feedback - flash the panel
    if (this.mcqPanel) {
      // Could add animation here
    }
  }
  
  showMCQResult(isCorrect: boolean, correctAnswer: string): void {
    // Remove MCQ panel and show result
    if (this.mcqPanel) {
      this.uiContainer.remove(this.mcqPanel);
    }
    
    const resultPanel = new ThreeMeshUI.Block({
      width: 0.8,
      height: 0.3,
      padding: 0.04,
      borderRadius: 0.03,
      fontFamily: this.config.fontFamily,
      fontTexture: this.config.fontTexture,
      backgroundColor: new THREE.Color(isCorrect ? 0x1a3a1a : 0x3a1a1a),
      backgroundOpacity: 0.95,
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    });
    
    resultPanel.add(new ThreeMeshUI.Text({
      content: isCorrect ? '✓ Correct!' : '✗ Incorrect',
      fontSize: 0.06,
      fontColor: new THREE.Color(isCorrect ? 0x00ff66 : 0xff6666),
    }));
    
    if (!isCorrect) {
      resultPanel.add(new ThreeMeshUI.Text({
        content: `Answer: ${correctAnswer}`,
        fontSize: 0.035,
        fontColor: new THREE.Color(0xcccccc),
      }));
    }
    
    resultPanel.position.set(0.8, 1.4, -1.5);
    resultPanel.rotation.y = -0.3;
    
    this.mcqPanel = resultPanel;
    this.uiContainer.add(resultPanel);
  }
  
  // ============================================================================
  // Raycast Interaction Update
  // ============================================================================
  
  updateRaycast(controllerPosition: THREE.Vector3, controllerDirection: THREE.Vector3): ThreeMeshUI.Block | null {
    this.raycaster.set(controllerPosition, controllerDirection);
    
    // Get all UI meshes
    const uiMeshes: THREE.Object3D[] = [];
    this.interactiveElements.forEach(element => {
      uiMeshes.push(element);
    });
    
    if (uiMeshes.length === 0) return null;
    
    const intersects = this.raycaster.intersectObjects(uiMeshes, true);
    
    // Reset previous hovered
    if (this.currentHovered) {
      this.currentHovered.setState('idle');
    }
    
    if (intersects.length > 0) {
      // Find the parent Block element
      let target = intersects[0].object;
      while (target && !(target instanceof ThreeMeshUI.Block)) {
        target = target.parent as THREE.Object3D;
      }
      
      if (target && target instanceof ThreeMeshUI.Block && this.interactiveElements.has(target)) {
        target.setState('hovered');
        this.currentHovered = target;
        return target;
      }
    }
    
    this.currentHovered = null;
    return null;
  }
  
  selectHovered(): void {
    if (this.currentHovered) {
      this.currentHovered.setState('selected');
    }
  }
  
  // ============================================================================
  // Update (call in render loop)
  // ============================================================================
  
  update(): void {
    // Must call ThreeMeshUI.update() each frame
    ThreeMeshUI.update();
  }
  
  // ============================================================================
  // Event Callbacks
  // ============================================================================
  
  setOnTTSPlay(callback: () => void): void {
    this.onTTSPlay = callback;
  }
  
  setOnTTSPause(callback: () => void): void {
    this.onTTSPause = callback;
  }
  
  setOnMCQAnswer(callback: (questionId: string, answerIndex: number) => void): void {
    this.onMCQAnswer = callback;
  }
  
  setOnExit(callback: () => void): void {
    this.onExit = callback;
  }
  
  // ============================================================================
  // Visibility Control
  // ============================================================================
  
  showPanel(panel: 'info' | 'tts' | 'mcq' | 'all'): void {
    if (panel === 'info' || panel === 'all') this.infoPanel?.visible === true;
    if (panel === 'tts' || panel === 'all') this.ttsPanel?.visible === true;
    if (panel === 'mcq' || panel === 'all') this.mcqPanel?.visible === true;
  }
  
  hidePanel(panel: 'info' | 'tts' | 'mcq' | 'all'): void {
    if (panel === 'info' || panel === 'all' && this.infoPanel) this.infoPanel.visible = false;
    if (panel === 'tts' || panel === 'all' && this.ttsPanel) this.ttsPanel.visible = false;
    if (panel === 'mcq' || panel === 'all' && this.mcqPanel) this.mcqPanel.visible = false;
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  dispose(): void {
    console.log('[VRUISystem] Disposing...');
    
    // Stop audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    
    // Remove all panels
    if (this.infoPanel) this.uiContainer.remove(this.infoPanel);
    if (this.ttsPanel) this.uiContainer.remove(this.ttsPanel);
    if (this.mcqPanel) this.uiContainer.remove(this.mcqPanel);
    if (this.mainPanel) this.uiContainer.remove(this.mainPanel);
    
    // Clear interactive elements
    this.interactiveElements.clear();
    
    // Remove UI container
    this.scene.remove(this.uiContainer);
    
    // Clear callbacks
    this.onTTSPlay = null;
    this.onTTSPause = null;
    this.onMCQAnswer = null;
    this.onExit = null;
    
    this.isInitialized = false;
    console.log('[VRUISystem] Disposed');
  }
}
