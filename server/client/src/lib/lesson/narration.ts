/**
 * narration – one owner for the lesson's spoken audio.
 *
 * XRLessonPlayerV3 used to create a bare `new Audio()` per phase and drop the
 * previous one with `pause(); ref = null`. That is not enough to stop it:
 *
 *   - `pause()` called while the element's `play()` promise is still pending
 *     does not take effect — the promise resolves and the element plays anyway.
 *     The intro clip carried on while the explanation clip started, which is
 *     exactly the "intro and learn play together" fault.
 *   - the abandoned element kept its `onended` handler, so it could still drive
 *     a phase change long after nothing referenced it.
 *   - `removeEventListener('timeupdate', () => {})` passed a fresh arrow
 *     function, so it removed nothing.
 *
 * The fix is a generation token. Every `play()` claims a generation; anything
 * that arrives late — a resolving play promise, an `ended` event, an error —
 * is ignored unless it still holds the current one. That makes "stop the old
 * clip" reliable instead of best-effort.
 */

export type NarrationState = 'idle' | 'playing' | 'paused' | 'ended';

export interface NarrationHandlers {
  /** The clip finished on its own. Never fires for a clip that was superseded. */
  onEnded?: () => void;
  /** The clip could not be played (bad URL, decode failure, blocked autoplay). */
  onError?: (reason: string) => void;
  onStateChange?: (state: NarrationState) => void;
}

export interface NarrationController {
  play(url: string, handlers?: NarrationHandlers): void;
  /** Resume a paused clip, or return false if there is nothing to resume. */
  resume(): boolean;
  pause(): void;
  /** Stop and forget the current clip. Fires no callbacks. */
  stop(): void;
  setMuted(muted: boolean): void;
  getState(): NarrationState;
  /** The URL currently loaded, for debugging and for deciding on a replay. */
  getUrl(): string | null;
  dispose(): void;
}

export function createNarrationController(
  options: { onStateChange?: (state: NarrationState) => void } = {}
): NarrationController {
  let audio: HTMLAudioElement | null = null;
  let generation = 0;
  let state: NarrationState = 'idle';
  let muted = false;
  let url: string | null = null;
  let disposed = false;

  const setState = (next: NarrationState) => {
    if (state === next) return;
    state = next;
    options.onStateChange?.(next);
  };

  /**
   * Detach and silence the current element.
   *
   * Order matters: clear the handlers BEFORE pausing, so a pause that races a
   * pending play cannot deliver an event we would otherwise act on.
   */
  const teardown = () => {
    generation += 1;
    const el = audio;
    audio = null;
    url = null;
    if (!el) return;
    el.onended = null;
    el.onerror = null;
    el.onplay = null;
    el.onpause = null;
    try {
      el.pause();
      // Releasing the source stops a buffering element that has not started yet;
      // pause alone leaves it able to begin once the network catches up.
      el.removeAttribute('src');
      el.load();
    } catch {
      /* element already detached */
    }
  };

  return {
    play(nextUrl, handlers = {}) {
      if (disposed || !nextUrl) return;
      teardown();

      const mine = generation;
      const el = new Audio(nextUrl);
      el.muted = muted;
      el.preload = 'auto';
      audio = el;
      url = nextUrl;

      el.onplay = () => {
        if (mine !== generation) return;
        setState('playing');
        handlers.onStateChange?.('playing');
      };
      el.onpause = () => {
        // `ended` also pauses; do not report that as a user pause.
        if (mine !== generation || el.ended) return;
        setState('paused');
        handlers.onStateChange?.('paused');
      };
      el.onended = () => {
        if (mine !== generation) return;
        setState('ended');
        handlers.onStateChange?.('ended');
        handlers.onEnded?.();
      };
      el.onerror = () => {
        if (mine !== generation) return;
        setState('idle');
        handlers.onStateChange?.('idle');
        handlers.onError?.(el.error?.message || 'audio failed to load');
      };

      el.play().catch((err: unknown) => {
        // A superseded clip losing its race is expected, not an error.
        if (mine !== generation) return;
        const reason = err instanceof Error ? err.message : String(err);
        setState('idle');
        handlers.onStateChange?.('idle');
        handlers.onError?.(reason);
      });
    },

    resume() {
      if (disposed || !audio || state === 'playing') return false;
      const mine = generation;
      audio.play().catch(() => {
        if (mine === generation) setState('idle');
      });
      return true;
    },

    pause() {
      if (disposed || !audio) return;
      try {
        audio.pause();
      } catch {
        /* nothing playing */
      }
    },

    stop() {
      teardown();
      setState('idle');
    },

    setMuted(next) {
      muted = next;
      if (audio) audio.muted = next;
    },

    getState() {
      return state;
    },

    getUrl() {
      return url;
    },

    dispose() {
      teardown();
      disposed = true;
      state = 'idle';
    },
  };
}
