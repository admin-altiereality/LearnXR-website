/**
 * UI Panel System - three-mesh-ui based unified UI for WebXR
 * 
 * This module provides a comprehensive UI system using three-mesh-ui
 * with glassmorphism styling for immersive WebXR experiences.
 */

import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';

// ============================================================================
// Types
// ============================================================================

export type LessonPhase = 'waiting' | 'intro' | 'content' | 'outro' | 'mcq' | 'complete';

export interface UITheme {
  colors: {
    panelBackground: string;
    panelBorder: string;
    primaryAccent: string;
    secondaryAccent: string;
    success: string;
    error: string;
    warning: string;
    textPrimary: string;
    textSecondary: string;
  };
  spacing: {
    panelPadding: number;
    elementGap: number;
    buttonPadding: number;
  };
  typography: {
    titleSize: number;
    bodySize: number;
    buttonSize: number;
    smallSize: number;
  };
  effects: {
    borderRadius: number;
    borderWidth: number;
    hoverScale: number;
    pressScale: number;
  };
}

export interface TTSControlState {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number; // 0-1
  currentTime: number;
  duration: number;
}

export interface QuizState {
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  selectedOption: number | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
}

export interface MCQData {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface ButtonConfig {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'error';
}

// ============================================================================
// Debug Logging
// ============================================================================

const DEBUG = {
  UI: '[UI]',
};

function log(...args: any[]): void {
  console.log(DEBUG.UI, ...args);
}

// ============================================================================
// Default Theme
// ============================================================================

export const DEFAULT_THEME: UITheme = {
  colors: {
    panelBackground: 'rgba(15, 23, 42, 0.85)',    // slate-900 semi-transparent
    panelBorder: 'rgba(56, 189, 248, 0.3)',       // cyan-400 glow
    primaryAccent: '#06b6d4',                      // cyan-500
    secondaryAccent: '#8b5cf6',                    // violet-500
    success: '#10b981',                            // emerald-500
    error: '#ef4444',                              // red-500
    warning: '#f59e0b',                            // amber-500
    textPrimary: '#f8fafc',                        // slate-50
    textSecondary: '#94a3b8',                      // slate-400
  },
  spacing: {
    panelPadding: 0.04,      // meters
    elementGap: 0.02,
    buttonPadding: 0.015,
  },
  typography: {
    titleSize: 0.045,
    bodySize: 0.032,
    buttonSize: 0.028,
    smallSize: 0.024,
  },
  effects: {
    borderRadius: 0.02,
    borderWidth: 0.002,
    hoverScale: 1.05,
    pressScale: 0.95,
  },
};

// ============================================================================
// Phase Colors
// ============================================================================

const PHASE_COLORS: Record<LessonPhase, string> = {
  waiting: '#64748b',  // slate-500
  intro: '#06b6d4',    // cyan-500
  content: '#8b5cf6',  // violet-500
  outro: '#10b981',    // emerald-500
  mcq: '#f59e0b',      // amber-500
  complete: '#22c55e', // green-500
};

const PHASE_LABELS: Record<LessonPhase, string> = {
  waiting: 'Ready',
  intro: 'Introduction',
  content: 'Explanation',
  outro: 'Conclusion',
  mcq: 'Quiz',
  complete: 'Complete',
};

// ============================================================================
// UI Panel System Class
// ============================================================================

export class UIPanelSystem {
  private theme: UITheme;
  private mainContainer: ThreeMeshUI.Block | null = null;
  private headerSection: ThreeMeshUI.Block | null = null;
  private contentSection: ThreeMeshUI.Block | null = null;
  private ttsControlBar: ThreeMeshUI.Block | null = null;
  private scoreDisplay: ThreeMeshUI.Block | null = null;
  private assetSelector: ThreeMeshUI.Block | null = null;
  private progressIndicator: ThreeMeshUI.Block | null = null;
  
  // Interactive elements
  private interactiveElements: Map<string, THREE.Object3D> = new Map();
  private buttonCallbacks: Map<string, () => void> = new Map();
  
  // Current state
  private currentPhase: LessonPhase = 'waiting';
  private lessonTitle: string = '';
  private scriptText: string = '';
  private ttsState: TTSControlState = {
    isPlaying: false,
    isPaused: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
  };
  private quizState: QuizState = {
    currentQuestion: 0,
    totalQuestions: 0,
    score: 0,
    selectedOption: null,
    isAnswered: false,
    isCorrect: null,
  };

  // Font reference (must be loaded externally)
  private fontFamily: string = '';
  private fontTexture: string = '';

  constructor(theme: Partial<UITheme> = {}) {
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Set font for text rendering
   * Font files must be loaded before creating UI
   */
  setFont(fontFamily: string, fontTexture: string): void {
    this.fontFamily = fontFamily;
    this.fontTexture = fontTexture;
    log('Font set:', fontFamily);
  }

  /**
   * Create the main UI container
   */
  createMainPanel(position: THREE.Vector3, rotation: THREE.Euler): ThreeMeshUI.Block {
    // Create main container with glassmorphism style
    this.mainContainer = new ThreeMeshUI.Block({
      width: 1.2,
      height: 1.6,
      padding: this.theme.spacing.panelPadding,
      borderRadius: this.theme.effects.borderRadius,
      backgroundColor: new THREE.Color(0x0f172a),
      backgroundOpacity: 0.85,
      fontFamily: this.fontFamily || undefined,
      fontTexture: this.fontTexture || undefined,
      justifyContent: 'start',
      alignItems: 'center',
      contentDirection: 'column',
    });

    this.mainContainer.position.copy(position);
    this.mainContainer.rotation.copy(rotation);
    this.mainContainer.name = 'mainUIPanel';

    // Create sections
    this.createHeaderSection();
    this.createContentSection();
    this.createTTSControlBar();
    this.createScoreDisplay();
    this.createProgressIndicator();

    log('Main UI panel created');
    return this.mainContainer;
  }

  /**
   * Create header section with title and phase badge
   */
  private createHeaderSection(): void {
    if (!this.mainContainer) return;

    this.headerSection = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.12,
      padding: 0.01,
      margin: 0.01,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(0x1e293b),
      backgroundOpacity: 0.6,
      justifyContent: 'space-between',
      alignItems: 'center',
      contentDirection: 'row',
    });
    this.headerSection.name = 'headerSection';

    // Phase badge
    const phaseBadge = new ThreeMeshUI.Block({
      width: 0.2,
      height: 0.06,
      padding: 0.008,
      borderRadius: 0.008,
      backgroundColor: new THREE.Color(PHASE_COLORS[this.currentPhase]),
      backgroundOpacity: 1,
      justifyContent: 'center',
      alignItems: 'center',
    });
    phaseBadge.name = 'phaseBadge';

    const phaseText = new ThreeMeshUI.Text({
      content: PHASE_LABELS[this.currentPhase],
      fontSize: this.theme.typography.smallSize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });
    phaseBadge.add(phaseText);

    // Title
    const titleText = new ThreeMeshUI.Text({
      content: this.lessonTitle || 'Lesson',
      fontSize: this.theme.typography.titleSize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });

    this.headerSection.add(phaseBadge, titleText);
    this.mainContainer.add(this.headerSection);
  }

  /**
   * Create content section (script or quiz)
   */
  private createContentSection(): void {
    if (!this.mainContainer) return;

    this.contentSection = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.9,
      padding: 0.02,
      margin: 0.01,
      borderRadius: 0.015,
      backgroundColor: new THREE.Color(0x1e293b),
      backgroundOpacity: 0.4,
      justifyContent: 'start',
      alignItems: 'center',
      contentDirection: 'column',
    });
    this.contentSection.name = 'contentSection';

    this.mainContainer.add(this.contentSection);
  }

  /**
   * Create TTS control bar
   */
  private createTTSControlBar(): void {
    if (!this.mainContainer) return;

    this.ttsControlBar = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.14,
      padding: 0.01,
      margin: 0.01,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(0x1e293b),
      backgroundOpacity: 0.6,
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'column',
    });
    this.ttsControlBar.name = 'ttsControlBar';

    // Progress bar container
    const progressContainer = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.02,
      padding: 0,
      margin: 0.005,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(0x334155),
      backgroundOpacity: 1,
      justifyContent: 'start',
      alignItems: 'center',
      contentDirection: 'row',
    });
    progressContainer.name = 'progressContainer';

    // Progress fill
    const progressFill = new ThreeMeshUI.Block({
      width: 0.0,
      height: 0.018,
      padding: 0,
      borderRadius: 0.009,
      backgroundColor: new THREE.Color(this.theme.colors.primaryAccent),
      backgroundOpacity: 1,
    });
    progressFill.name = 'progressFill';
    progressContainer.add(progressFill);

    // Button container
    const buttonContainer = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.08,
      padding: 0.005,
      backgroundColor: new THREE.Color(0x000000),
      backgroundOpacity: 0,
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'row',
    });
    buttonContainer.name = 'buttonContainer';

    // Create TTS buttons
    const buttons: ButtonConfig[] = [
      { id: 'prev', label: '⏮', onClick: () => this.triggerCallback('prev') },
      { id: 'playPause', label: '▶', onClick: () => this.triggerCallback('playPause') },
      { id: 'stop', label: '⏹', onClick: () => this.triggerCallback('stop') },
      { id: 'next', label: '⏭', onClick: () => this.triggerCallback('next') },
    ];

    buttons.forEach(btn => {
      const button = this.createButton(btn);
      buttonContainer.add(button);
    });

    this.ttsControlBar.add(progressContainer, buttonContainer);
    this.mainContainer.add(this.ttsControlBar);
  }

  /**
   * Create score display
   */
  private createScoreDisplay(): void {
    if (!this.mainContainer) return;

    this.scoreDisplay = new ThreeMeshUI.Block({
      width: 0.3,
      height: 0.08,
      padding: 0.01,
      margin: 0.01,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(this.theme.colors.warning),
      backgroundOpacity: 0.8,
      justifyContent: 'center',
      alignItems: 'center',
    });
    this.scoreDisplay.name = 'scoreDisplay';
    this.scoreDisplay.visible = false; // Hidden by default, shown during quiz

    const scoreText = new ThreeMeshUI.Text({
      content: `Score: 0/0`,
      fontSize: this.theme.typography.buttonSize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });
    scoreText.name = 'scoreText';

    this.scoreDisplay.add(scoreText);
    this.mainContainer.add(this.scoreDisplay);
  }

  /**
   * Create progress indicator
   */
  private createProgressIndicator(): void {
    if (!this.mainContainer) return;

    this.progressIndicator = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.04,
      padding: 0.005,
      margin: 0.01,
      borderRadius: 0.005,
      backgroundColor: new THREE.Color(0x334155),
      backgroundOpacity: 0.6,
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'row',
    });
    this.progressIndicator.name = 'progressIndicator';

    this.mainContainer.add(this.progressIndicator);
  }

  // ============================================================================
  // Button Creation
  // ============================================================================

  /**
   * Create a styled button
   */
  private createButton(config: ButtonConfig): ThreeMeshUI.Block {
    const variantColors: Record<string, string> = {
      primary: this.theme.colors.primaryAccent,
      secondary: this.theme.colors.secondaryAccent,
      success: this.theme.colors.success,
      error: this.theme.colors.error,
    };

    const bgColor = variantColors[config.variant || 'primary'];

    const button = new ThreeMeshUI.Block({
      width: 0.08,
      height: 0.06,
      padding: 0.01,
      margin: 0.008,
      borderRadius: 0.008,
      backgroundColor: new THREE.Color(bgColor),
      backgroundOpacity: config.disabled ? 0.3 : 0.6,
      justifyContent: 'center',
      alignItems: 'center',
    });
    button.name = `button_${config.id}`;
    button.userData.isInteractable = !config.disabled;
    button.userData.buttonId = config.id;

    const labelText = new ThreeMeshUI.Text({
      content: config.icon || config.label,
      fontSize: this.theme.typography.buttonSize,
      fontColor: new THREE.Color(
        config.disabled ? this.theme.colors.textSecondary : this.theme.colors.textPrimary
      ),
    });

    button.add(labelText);

    // Store callback
    this.buttonCallbacks.set(config.id, config.onClick);
    this.interactiveElements.set(config.id, button);

    // Setup hover/press states
    this.setupButtonStates(button, bgColor);

    return button;
  }

  /**
   * Setup button hover and press states
   */
  private setupButtonStates(button: ThreeMeshUI.Block, baseColor: string): void {
    const states = {
      state: 'idle',
      attributes: {
        idle: {
          backgroundColor: new THREE.Color(baseColor),
          backgroundOpacity: 0.6,
        },
        hovered: {
          backgroundColor: new THREE.Color(baseColor),
          backgroundOpacity: 0.9,
        },
        selected: {
          backgroundColor: new THREE.Color(baseColor),
          backgroundOpacity: 1.0,
        },
      },
    };

    button.setupState(states);
  }

  /**
   * Trigger button callback
   */
  private triggerCallback(buttonId: string): void {
    const callback = this.buttonCallbacks.get(buttonId);
    if (callback) {
      callback();
      log(`Button triggered: ${buttonId}`);
    }
  }

  // ============================================================================
  // Content Updates
  // ============================================================================

  /**
   * Update lesson title
   */
  setLessonTitle(title: string): void {
    this.lessonTitle = title;
    this.updateHeader();
  }

  /**
   * Update current phase
   */
  setPhase(phase: LessonPhase): void {
    this.currentPhase = phase;
    this.updateHeader();
    this.updateContentVisibility();
    log(`Phase updated: ${phase}`);
  }

  /**
   * Update script text
   */
  setScriptText(text: string): void {
    this.scriptText = text;
    this.updateScriptContent();
  }

  /**
   * Update TTS control state
   */
  setTTSState(state: Partial<TTSControlState>): void {
    this.ttsState = { ...this.ttsState, ...state };
    this.updateTTSControls();
  }

  /**
   * Update quiz state
   */
  setQuizState(state: Partial<QuizState>): void {
    this.quizState = { ...this.quizState, ...state };
    this.updateQuizDisplay();
  }

  /**
   * Update header section
   */
  private updateHeader(): void {
    if (!this.headerSection) return;

    // Find and update phase badge
    const phaseBadge = this.headerSection.getObjectByName('phaseBadge') as ThreeMeshUI.Block;
    if (phaseBadge) {
      phaseBadge.set({
        backgroundColor: new THREE.Color(PHASE_COLORS[this.currentPhase]),
      });
      // Update phase text
      const children = phaseBadge.children;
      if (children.length > 0) {
        const textObj = children[0] as ThreeMeshUI.Text;
        textObj.set({ content: PHASE_LABELS[this.currentPhase] });
      }
    }
  }

  /**
   * Update content section visibility
   */
  private updateContentVisibility(): void {
    if (!this.ttsControlBar || !this.scoreDisplay) return;

    // Show TTS controls for narration phases
    this.ttsControlBar.visible = ['intro', 'content', 'outro'].includes(this.currentPhase);

    // Show score during quiz
    this.scoreDisplay.visible = this.currentPhase === 'mcq';
  }

  /**
   * Update script content display
   */
  private updateScriptContent(): void {
    if (!this.contentSection) return;

    // Clear existing content
    while (this.contentSection.children.length > 0) {
      this.contentSection.remove(this.contentSection.children[0]);
    }

    // Add script text
    const textBlock = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.8,
      padding: 0.02,
      backgroundColor: new THREE.Color(0x000000),
      backgroundOpacity: 0,
      justifyContent: 'start',
      alignItems: 'start',
      textAlign: 'left',
    });

    const scriptTextObj = new ThreeMeshUI.Text({
      content: this.scriptText || '',
      fontSize: this.theme.typography.bodySize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });

    textBlock.add(scriptTextObj);
    this.contentSection.add(textBlock);
  }

  /**
   * Update TTS controls display
   */
  private updateTTSControls(): void {
    if (!this.ttsControlBar) return;

    // Update progress bar
    const progressFill = this.ttsControlBar.getObjectByName('progressFill') as ThreeMeshUI.Block;
    if (progressFill) {
      progressFill.set({
        width: Math.max(0.001, this.ttsState.progress * 1.0),
      });
    }

    // Update play/pause button icon
    const playPauseButton = this.interactiveElements.get('playPause') as ThreeMeshUI.Block;
    if (playPauseButton && playPauseButton.children.length > 0) {
      const textObj = playPauseButton.children[0] as ThreeMeshUI.Text;
      textObj.set({
        content: this.ttsState.isPlaying ? '⏸' : '▶',
      });
    }
  }

  /**
   * Update quiz display
   */
  private updateQuizDisplay(): void {
    if (!this.scoreDisplay) return;

    const scoreText = this.scoreDisplay.getObjectByName('scoreText') as ThreeMeshUI.Text;
    if (scoreText) {
      scoreText.set({
        content: `Score: ${this.quizState.score}/${this.quizState.totalQuestions}`,
      });
    }
  }

  // ============================================================================
  // Quiz Panel Creation
  // ============================================================================

  /**
   * Create quiz panel with question and options
   */
  createQuizPanel(mcq: MCQData, questionIndex: number, totalQuestions: number): void {
    if (!this.contentSection) return;

    // Clear existing content
    while (this.contentSection.children.length > 0) {
      this.contentSection.remove(this.contentSection.children[0]);
    }

    // Question container
    const questionContainer = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.25,
      padding: 0.02,
      margin: 0.01,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(0x334155),
      backgroundOpacity: 0.4,
      justifyContent: 'center',
      alignItems: 'center',
    });

    const questionText = new ThreeMeshUI.Text({
      content: mcq.question,
      fontSize: this.theme.typography.bodySize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });
    questionContainer.add(questionText);
    this.contentSection.add(questionContainer);

    // Options container
    const optionsContainer = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.55,
      padding: 0.01,
      backgroundColor: new THREE.Color(0x000000),
      backgroundOpacity: 0,
      justifyContent: 'start',
      alignItems: 'center',
      contentDirection: 'column',
    });

    mcq.options.forEach((option, index) => {
      const optionButton = this.createOptionButton(option, index, mcq.correctAnswer);
      optionsContainer.add(optionButton);
    });

    this.contentSection.add(optionsContainer);

    // Update quiz state
    this.quizState.currentQuestion = questionIndex;
    this.quizState.totalQuestions = totalQuestions;
    this.updateQuizDisplay();

    log(`Quiz panel created: Question ${questionIndex + 1}/${totalQuestions}`);
  }

  /**
   * Create option button for quiz
   */
  private createOptionButton(text: string, index: number, correctIndex: number): ThreeMeshUI.Block {
    const labels = ['A', 'B', 'C', 'D'];
    
    const optionButton = new ThreeMeshUI.Block({
      width: 0.95,
      height: 0.1,
      padding: 0.015,
      margin: 0.008,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(0x334155),
      backgroundOpacity: 0.6,
      justifyContent: 'start',
      alignItems: 'center',
      contentDirection: 'row',
    });
    optionButton.name = `option_${index}`;
    optionButton.userData.isInteractable = true;
    optionButton.userData.optionIndex = index;
    optionButton.userData.isCorrect = index === correctIndex;

    // Label
    const labelText = new ThreeMeshUI.Text({
      content: `${labels[index]}.  `,
      fontSize: this.theme.typography.buttonSize,
      fontColor: new THREE.Color(this.theme.colors.primaryAccent),
    });

    // Option text
    const optionText = new ThreeMeshUI.Text({
      content: text,
      fontSize: this.theme.typography.buttonSize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });

    optionButton.add(labelText, optionText);

    // Store as interactive element
    this.interactiveElements.set(`option_${index}`, optionButton);
    this.buttonCallbacks.set(`option_${index}`, () => this.triggerCallback(`selectOption_${index}`));

    return optionButton;
  }

  /**
   * Update option button state after selection
   */
  updateOptionState(selectedIndex: number, correctIndex: number): void {
    for (let i = 0; i < 4; i++) {
      const option = this.interactiveElements.get(`option_${i}`) as ThreeMeshUI.Block;
      if (!option) continue;

      let bgColor = 0x334155;
      let opacity = 0.6;

      if (i === selectedIndex) {
        if (i === correctIndex) {
          bgColor = 0x10b981; // success
          opacity = 0.8;
        } else {
          bgColor = 0xef4444; // error
          opacity = 0.8;
        }
      } else if (i === correctIndex) {
        bgColor = 0x10b981; // show correct answer
        opacity = 0.6;
      }

      option.set({
        backgroundColor: new THREE.Color(bgColor),
        backgroundOpacity: opacity,
      });
      option.userData.isInteractable = false;
    }

    this.quizState.selectedOption = selectedIndex;
    this.quizState.isAnswered = true;
    this.quizState.isCorrect = selectedIndex === correctIndex;
  }

  // ============================================================================
  // Start Screen
  // ============================================================================

  /**
   * Create start screen overlay
   */
  createStartScreen(
    lessonTitle: string,
    description: string,
    onStart: () => void
  ): ThreeMeshUI.Block {
    const startScreen = new ThreeMeshUI.Block({
      width: 1.0,
      height: 0.8,
      padding: 0.04,
      borderRadius: 0.02,
      backgroundColor: new THREE.Color(0x0f172a),
      backgroundOpacity: 0.95,
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'column',
    });
    startScreen.name = 'startScreen';

    // Title
    const titleText = new ThreeMeshUI.Text({
      content: lessonTitle,
      fontSize: this.theme.typography.titleSize * 1.2,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });

    // Description
    const descText = new ThreeMeshUI.Text({
      content: description,
      fontSize: this.theme.typography.bodySize,
      fontColor: new THREE.Color(this.theme.colors.textSecondary),
    });

    // Start button
    const startButton = new ThreeMeshUI.Block({
      width: 0.3,
      height: 0.1,
      padding: 0.02,
      margin: 0.04,
      borderRadius: 0.015,
      backgroundColor: new THREE.Color(this.theme.colors.primaryAccent),
      backgroundOpacity: 0.9,
      justifyContent: 'center',
      alignItems: 'center',
    });
    startButton.name = 'startButton';
    startButton.userData.isInteractable = true;

    const startButtonText = new ThreeMeshUI.Text({
      content: 'START',
      fontSize: this.theme.typography.titleSize,
      fontColor: new THREE.Color(this.theme.colors.textPrimary),
    });
    startButton.add(startButtonText);

    // Store callback
    this.buttonCallbacks.set('start', onStart);
    this.interactiveElements.set('start', startButton);

    startScreen.add(titleText, descText, startButton);

    log('Start screen created');
    return startScreen;
  }

  // ============================================================================
  // Asset Selector
  // ============================================================================

  /**
   * Create asset selector thumbnails
   */
  createAssetSelector(
    assets: Array<{ id: string; name: string; thumbnail?: string }>,
    onSelect: (assetId: string) => void
  ): ThreeMeshUI.Block {
    this.assetSelector = new ThreeMeshUI.Block({
      width: 1.12,
      height: 0.12,
      padding: 0.01,
      margin: 0.01,
      borderRadius: 0.01,
      backgroundColor: new THREE.Color(0x1e293b),
      backgroundOpacity: 0.6,
      justifyContent: 'center',
      alignItems: 'center',
      contentDirection: 'row',
    });
    this.assetSelector.name = 'assetSelector';

    assets.forEach((asset, index) => {
      const thumbnail = new ThreeMeshUI.Block({
        width: 0.08,
        height: 0.08,
        padding: 0.005,
        margin: 0.005,
        borderRadius: 0.008,
        backgroundColor: new THREE.Color(0x334155),
        backgroundOpacity: 0.8,
        justifyContent: 'center',
        alignItems: 'center',
      });
      thumbnail.name = `assetThumbnail_${asset.id}`;
      thumbnail.userData.isInteractable = true;
      thumbnail.userData.assetId = asset.id;

      const label = new ThreeMeshUI.Text({
        content: (index + 1).toString(),
        fontSize: this.theme.typography.smallSize,
        fontColor: new THREE.Color(this.theme.colors.textPrimary),
      });
      thumbnail.add(label);

      this.buttonCallbacks.set(`asset_${asset.id}`, () => onSelect(asset.id));
      this.interactiveElements.set(`asset_${asset.id}`, thumbnail);

      this.assetSelector.add(thumbnail);
    });

    if (this.mainContainer) {
      this.mainContainer.add(this.assetSelector);
    }

    log(`Asset selector created with ${assets.length} assets`);
    return this.assetSelector;
  }

  /**
   * Update active asset highlight
   */
  setActiveAsset(assetId: string): void {
    this.interactiveElements.forEach((element, key) => {
      if (key.startsWith('asset_')) {
        const isActive = key === `asset_${assetId}`;
        (element as ThreeMeshUI.Block).set({
          backgroundColor: new THREE.Color(
            isActive ? this.theme.colors.primaryAccent : 0x334155
          ),
        });
      }
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get main container
   */
  getMainContainer(): ThreeMeshUI.Block | null {
    return this.mainContainer;
  }

  /**
   * Get all interactive elements
   */
  getInteractiveElements(): Map<string, THREE.Object3D> {
    return this.interactiveElements;
  }

  /**
   * Set button callback
   */
  setButtonCallback(buttonId: string, callback: () => void): void {
    this.buttonCallbacks.set(buttonId, callback);
  }

  /**
   * Handle button click by ID
   */
  handleButtonClick(buttonId: string): void {
    this.triggerCallback(buttonId);
  }

  /**
   * Update theme
   */
  setTheme(theme: Partial<UITheme>): void {
    this.theme = { ...this.theme, ...theme };
    log('Theme updated');
  }

  /**
   * Show/hide main panel
   */
  setVisible(visible: boolean): void {
    if (this.mainContainer) {
      this.mainContainer.visible = visible;
    }
  }

  /**
   * Get current theme
   */
  getTheme(): UITheme {
    return { ...this.theme };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.interactiveElements.clear();
    this.buttonCallbacks.clear();
    this.mainContainer = null;
    this.headerSection = null;
    this.contentSection = null;
    this.ttsControlBar = null;
    this.scoreDisplay = null;
    this.assetSelector = null;
    this.progressIndicator = null;
    log('UI Panel System disposed');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createUIPanelSystem(theme?: Partial<UITheme>): UIPanelSystem {
  return new UIPanelSystem(theme);
}

export default UIPanelSystem;
