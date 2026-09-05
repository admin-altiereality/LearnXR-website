/**
 * The shared immersive lesson panel.
 *
 * One renderer, two consumers: XRLessonPlayerV3 imports it directly, and the
 * krpano player publishes it on `window` so `immersive_ui.xml` can call it from
 * inside a krpano action. That indirection exists only because the krpano side
 * is XML-hosted JavaScript with no module loader — it is not a second copy.
 */

export { drawLessonPanel, ensureLessonPanelFont } from './drawLessonPanel';
export type { DrawLessonPanelOptions } from './drawLessonPanel';
export { actionAtUv, regionAtCanvas, regionAtUv } from './hitTest';
export {
  EMPTY_LESSON_UI_STATE,
  PANEL_H,
  PANEL_W,
  parseLessonUiAction,
} from './types';
export type { ButtonRegion, LessonUiAction, LessonUiState } from './types';

import { drawLessonPanel, ensureLessonPanelFont } from './drawLessonPanel';
import type { DrawLessonPanelOptions } from './drawLessonPanel';
import type { ButtonRegion, LessonUiState } from './types';

declare global {
  interface Window {
    /**
     * Published for `public/krpano/plugins/immersive_ui.xml`, which draws the
     * panel from inside a krpano action and needs the regions back.
     */
    __learnxrDrawLessonPanel?: (
      ctx: CanvasRenderingContext2D,
      state: LessonUiState,
      opts?: DrawLessonPanelOptions
    ) => ButtonRegion[];
  }
}

/**
 * Publish the renderer for the krpano XML. Safe to call repeatedly; returns a
 * teardown so a player can remove it when it unmounts.
 */
export function installLessonPanelRenderer(): () => void {
  if (typeof window === 'undefined') return () => {};
  const font = ensureLessonPanelFont();
  const draw: NonNullable<Window['__learnxrDrawLessonPanel']> = (ctx, state, opts) =>
    drawLessonPanel(ctx, state, { font, ...opts });
  window.__learnxrDrawLessonPanel = draw;
  return () => {
    if (window.__learnxrDrawLessonPanel === draw) {
      delete window.__learnxrDrawLessonPanel;
    }
  };
}
