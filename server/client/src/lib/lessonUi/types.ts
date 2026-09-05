/**
 * Shared contract for the immersive lesson panel.
 *
 * Both players describe their lesson to the renderer with the same flat state
 * object and get back the same clickable regions, so the UI can be identical in
 * the krpano player and in XRLessonPlayerV3 without either owning it.
 */

/** The panel is drawn at a fixed size; regions are in these coordinates. */
export const PANEL_W = 2048;
export const PANEL_H = 1280;

/** A clickable rectangle on the panel, in canvas coordinates. */
export interface ButtonRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  action: string;
}

/**
 * What the panel renders. Every field is already produced by both players —
 * this was `KrpanoUiStatePayload` in VRLessonPlayerKrpano before it was shared.
 */
export interface LessonUiState {
  /** Session-level phase name: intro | explanation | outro | quiz | completed. */
  phase: string;
  script: string;
  ttsStatus: string;
  question: string;
  options: string[];
  showQuiz: boolean;
  showResult: boolean;
  scoreLabel: string;
  selectedAnswer: number;
  waitingForUser: boolean;
  isPlayingAudio: boolean;
  currentMcqIndex: number;
  totalMcqs: number;
  correctAnswer: number;
  explanation: string;
  /** Separable sub-meshes in the scene; below 2 the model tools stay hidden. */
  modelPartCount: number;
  controlStudentsEnabled: boolean;
  isStudent: boolean;
  isHost: boolean;
}

/** A blank state, so callers can spread over it rather than list every field. */
export const EMPTY_LESSON_UI_STATE: LessonUiState = {
  phase: 'intro',
  script: '',
  ttsStatus: 'idle',
  question: '',
  options: [],
  showQuiz: false,
  showResult: false,
  scoreLabel: '',
  selectedAnswer: -1,
  waitingForUser: false,
  isPlayingAudio: false,
  currentMcqIndex: 0,
  totalMcqs: 0,
  correctAnswer: -1,
  explanation: '',
  modelPartCount: 0,
  controlStudentsEnabled: false,
  isStudent: false,
  isHost: false,
};

/**
 * Everything the panel can emit. Parsed rather than string-matched so a player
 * that forgets to handle one gets a compile error instead of a dead button.
 */
export type LessonUiAction =
  | { kind: 'phaseGo'; phase: string }
  | { kind: 'ttsPlay' }
  | { kind: 'ttsPause' }
  | { kind: 'replay' }
  | { kind: 'skipToQuiz' }
  | { kind: 'continue' }
  | { kind: 'mcqSelect'; index: number }
  | { kind: 'mcqSubmit' }
  | { kind: 'mcqNext' }
  | { kind: 'directClassView' }
  | { kind: 'model'; op: 'explodeUp' | 'explodeDown' | 'isolate' | 'section' | 'reset' }
  | { kind: 'panelGrab' }
  | { kind: 'panelResize' };

/** Turn a raw action string from the panel into a typed action, or null. */
export function parseLessonUiAction(raw: string | null | undefined): LessonUiAction | null {
  const action = String(raw || '').trim();
  if (!action) return null;

  if (action.startsWith('phaseGo:')) {
    const phase = action.slice('phaseGo:'.length);
    return phase ? { kind: 'phaseGo', phase } : null;
  }
  if (action.startsWith('mcqSelect:')) {
    const index = Number.parseInt(action.slice('mcqSelect:'.length), 10);
    return Number.isFinite(index) ? { kind: 'mcqSelect', index } : null;
  }
  if (action.startsWith('model:')) {
    const op = action.slice('model:'.length);
    return op === 'explodeUp' || op === 'explodeDown' || op === 'isolate' || op === 'section' || op === 'reset'
      ? { kind: 'model', op }
      : null;
  }

  switch (action) {
    case 'ttsPlay':
      return { kind: 'ttsPlay' };
    case 'ttsPause':
      return { kind: 'ttsPause' };
    case 'replay':
      return { kind: 'replay' };
    case 'skipToQuiz':
      return { kind: 'skipToQuiz' };
    case 'continue':
      return { kind: 'continue' };
    case 'mcqSubmit':
      return { kind: 'mcqSubmit' };
    case 'mcqNext':
      return { kind: 'mcqNext' };
    case 'directClassView':
      return { kind: 'directClassView' };
    case 'panelGrab':
      return { kind: 'panelGrab' };
    case 'panelResize':
      return { kind: 'panelResize' };
    default:
      return null;
  }
}
