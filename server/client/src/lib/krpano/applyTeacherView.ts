/**
 * Apply a host / teacher look-at to a student krpano viewer.
 * Explicit Direct (`options.force`) uses lookto + temporary control lock so
 * students actually land on the host view instead of fighting a short tween.
 *
 * Important: presence of `sync_id` alone must NOT force-lock — leftover sync_id
 * from a prior Direct would otherwise lock students on every continuous follow.
 */

export type KrpanoViewCaller = {
  call?: (action: string) => void;
  get?: (name: string) => unknown;
};

export type TeacherViewLike = {
  hlookat: number;
  vlookat: number;
  fov?: number;
  sync_id?: number;
};

import { releaseUserControl, suspendUserControl } from './userControl';

const DIRECT_LOCK_MS = 2800;

/** Pending release for the Direct lock, so repeated Directs do not stack timers. */
let directReleaseTimer: ReturnType<typeof setTimeout> | null = null;

/** Read live h/v/fov from a krpano instance (supports get + call fallbacks). */
export function readKrpanoLookat(viewer: KrpanoViewCaller | null | undefined): {
  hlookat: number;
  vlookat: number;
  fov: number;
} | null {
  if (!viewer) return null;
  try {
    if (typeof viewer.get === 'function') {
      const h = Number(viewer.get('view.hlookat'));
      const v = Number(viewer.get('view.vlookat'));
      const fov = Number(viewer.get('view.fov'));
      if (Number.isFinite(h) && Number.isFinite(v)) {
        return { hlookat: h, vlookat: v, fov: Number.isFinite(fov) ? fov : 90 };
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Apply teacher_view to student.
 * Pass `force: true` only when `sync_id` is new (Direct class to my view).
 */
export function applyTeacherViewToKrpano(
  viewer: KrpanoViewCaller | null | undefined,
  view: TeacherViewLike,
  options?: { force?: boolean }
): boolean {
  if (!viewer?.call) return false;
  const h = Number(view.hlookat);
  const v = Number(view.vlookat);
  const fov = Number(view.fov ?? 90) || 90;
  if (!Number.isFinite(h) || !Number.isFinite(v)) return false;

  const isDirect = options?.force === true;

  try {
    if (isDirect) {
      // Stop any in-flight tween, lock drag, then lookto with a clear blend.
      // The lock goes through the shared refcount rather than writing the flag
      // directly: the marker is another writer, and whichever released last used to
      // win — a Direct could re-enable panning under an active marker, and a marker
      // toggle could cancel this lock mid-tween.
      viewer.call('stoptween(view.hlookat); stoptween(view.vlookat); stoptween(view.fov);');
      suspendUserControl(viewer, 'direct');
      // Schedule the release BEFORE the call that can throw. krpano's lookto throws
      // whenever the pano has not loaded; the outer catch swallowed it, the release was
      // never scheduled, and 'direct' stuck in the module-level holder set forever —
      // which then wrote `off` to every subsequently embedded viewer.
      if (directReleaseTimer !== null) clearTimeout(directReleaseTimer);
      directReleaseTimer = setTimeout(() => {
        directReleaseTimer = null;
        releaseUserControl(viewer, 'direct');
      }, DIRECT_LOCK_MS);
      viewer.call(
        `lookto(${h}, ${v}, ${fov}, tween(easeInOutQuad, 0.55), true, true);`
      );
    } else {
      viewer.call(
        `tween(view.hlookat,${h},view.vlookat,${v},view.fov,${fov},time=0.28);`
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Direct an active WebVR headset horizontally toward the teacher's view.
 * KRPano intentionally leaves pitch under physical head control in VR.
 */
export function applyTeacherViewToImmersiveKrpano(
  viewer: KrpanoViewCaller | null | undefined,
  view: TeacherViewLike
): boolean {
  if (!viewer?.call) return false;
  const h = Number(view.hlookat);
  if (!Number.isFinite(h)) return false;

  try {
    viewer.call('stopmovements();');
    viewer.call(`webvr.lookat(${h});`);
    return true;
  } catch {
    return false;
  }
}
