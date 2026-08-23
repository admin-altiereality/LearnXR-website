/**
 * Single owner for krpano's `control.usercontrol` flag, with self-healing.
 *
 * Two writers used to fight over it with no coordination — the marker (suspends
 * panning while drawing) and applyTeacherView's Direct lock (off → lookto → restore).
 * Whichever released last won.
 *
 * Reference counting fixed the fighting but not the stranding: if the viewer reference
 * was momentarily null when a holder released, the restoring write was silently
 * dropped and krpano stayed on `off` — panning dead, with nothing in the UI to say why.
 * That is exactly what was observed in production (`control.usercontrol === 'off'`
 * with no marker active).
 *
 * So this module now treats `holders` as the single source of truth and RECONCILES:
 * anything that drifts is repaired, and the viewer is resolved from a global fallback
 * when the caller's reference has gone.
 */

interface KrpanoLike {
  call?: (action: string) => void;
  get?: (name: string) => unknown;
}

const holders = new Set<string>();

/** Panning is suspended only while at least one holder is active. */
function desiredValue(): 'off' | 'all' {
  return holders.size > 0 ? 'off' : 'all';
}

/**
 * Resolve a usable viewer. The caller's reference can be stale or null across a
 * re-embed, so fall back to the live global the player publishes.
 */
function resolveViewer(viewer: KrpanoLike | null | undefined): KrpanoLike | null {
  if (viewer?.call) return viewer;
  if (typeof window === 'undefined') return null;
  const global = (window as unknown as { __krpanoLessonViewer?: KrpanoLike }).__krpanoLessonViewer;
  return global?.call ? global : null;
}

function write(viewer: KrpanoLike | null | undefined) {
  const target = resolveViewer(viewer);
  if (!target?.call) return;
  try {
    target.call(`set(control.usercontrol, ${desiredValue()});`);
  } catch (err) {
    console.warn('[userControl] failed to set control.usercontrol:', err);
  }
}

/** Suspend panning on behalf of `holder`. Idempotent. */
export function suspendUserControl(viewer: KrpanoLike | null | undefined, holder: string) {
  holders.add(holder);
  write(viewer);
}

/**
 * Release `holder`'s claim. Panning resumes when no holder remains.
 * Writes unconditionally — a release that skipped the write is how the flag got
 * stranded in the first place.
 */
export function releaseUserControl(viewer: KrpanoLike | null | undefined, holder: string) {
  holders.delete(holder);
  write(viewer);
}

/** True while at least one holder is suspending panning. */
export function isUserControlSuspended(): boolean {
  return holders.size > 0;
}

/**
 * Repair drift between what krpano has and what the holders say it should have.
 * Cheap enough to poll: one `get` and, only on mismatch, one `set`.
 */
export function reconcileUserControl(viewer: KrpanoLike | null | undefined) {
  const target = resolveViewer(viewer);
  if (!target?.get || !target?.call) return;
  try {
    const current = String(target.get('control.usercontrol') ?? '');
    if (current && current !== desiredValue()) {
      console.warn(
        `[userControl] repairing control.usercontrol: was "${current}", expected "${desiredValue()}"`
      );
      write(target);
    }

    // controls3d.xml binds control.dragscale to a live `link:` expression that
    // evaluates to 0 at the default view.oz — which disables drag entirely. It is no
    // longer included for plain panoramas, but a lesson WITH 3D assets still loads it,
    // so repair the value there rather than shipping a lesson nobody can look around.
    const drag = Number(target.get('control.dragscale'));
    if (Number.isFinite(drag) && drag === 0) {
      console.warn('[userControl] repairing control.dragscale: was 0 (drag disabled)');
      target.call('set(control.dragscale, 1.0);');
    }
  } catch {
    /* viewer not ready */
  }
}

/**
 * Drop every claim and restore panning. Called whenever a viewer is embedded or torn
 * down, so a claim left by a destroyed viewer cannot disable panning on the next one.
 */
export function resetUserControl(viewer: KrpanoLike | null | undefined) {
  holders.clear();
  write(viewer);
}
