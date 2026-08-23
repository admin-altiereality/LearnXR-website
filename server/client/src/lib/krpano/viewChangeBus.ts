/**
 * viewChangeBus
 * -------------
 * krpano calls a single global `window.__krpanoOnViewChange(h, v, fov)` on every
 * view change. Until now that global had exactly ONE owner at a time — the host
 * view-sync effect or the student view-reporting effect — so whichever mounted
 * last silently won.
 *
 * Anything else that needs view ticks (the annotation overlay) cannot become a
 * third owner. This bus makes the player register one dispatcher and lets every
 * consumer subscribe.
 */

export type ViewChangeListener = (hlookat: number, vlookat: number, fov: number) => void;

const listeners = new Set<ViewChangeListener>();
let installed = false;
/** Last known view, updated by the dispatcher itself so it can never be unsubscribed. */
let lastView: { hlookat: number; vlookat: number; fov: number } | null = null;

/** Subscribe to view changes. Returns an unsubscribe function. */
export function onViewChange(listener: ViewChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Install the single global dispatcher. Safe to call more than once.
 * Returns a teardown that removes the global and drops all listeners.
 */
export function installViewChangeBus(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!installed) {
    (window as unknown as Record<string, unknown>).__krpanoOnViewChange = (
      h: number,
      v: number,
      fov: number
    ) => {
      lastView = { hlookat: h, vlookat: v, fov };
      listeners.forEach((fn) => {
        try {
          fn(h, v, fov);
        } catch (err) {
          console.error('viewChangeBus listener failed:', err);
        }
      });
    };
    installed = true;
  }
  return () => {
    // Deliberately NOT listeners.clear(): each subscriber removes itself via the
    // function returned by onViewChange(). Clearing here dropped subscribers that
    // outlive a single player mount — under StrictMode, on the very first mount.
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__krpanoOnViewChange;
    }
    installed = false;
  };
}

export function getLastView() {
  return lastView;
}
