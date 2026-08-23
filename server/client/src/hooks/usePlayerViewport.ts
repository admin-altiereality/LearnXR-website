/**
 * usePlayerViewport
 * -----------------
 * ONE source of truth for player layout breakpoints.
 *
 * It replaces three competing mechanisms that disagreed with each other:
 *   - `isPhoneViewport` in VRLessonPlayerKrpano (768px OR mobile UA — so every
 *     iPad and every Android, at any width, counted as a phone)
 *   - `useIsMobileViewport(768)` in LiveClassHostOverlay (pure width)
 *   - Tailwind `sm:` (640px) used for all host-overlay layout switching
 *
 * Between 640 and 767px those disagreed: CSS had already switched to the desktop
 * column while JS still forced the stack collapsed, so the teacher's entire
 * control stack disappeared. Width alone decides layout here; user-agent is used
 * only to detect a headset, which is a capability question rather than a size one.
 */

import { useEffect, useState } from 'react';

const COMPACT_QUERY = '(max-width: 767px)';
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

export interface PlayerViewport {
  /** Narrow layout: essentials in the bar, everything else behind overflow. */
  isCompact: boolean;
  /** Touch-primary input — larger hit targets, no hover affordances. */
  isTouch: boolean;
  /** Standalone VR browser (Quest). Layout is driven by krpano, not the DOM bar. */
  isHeadset: boolean;
}

function detectHeadset(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /OculusBrowser|Quest|Pico|VR/i.test(ua);
}

export function usePlayerViewport(): PlayerViewport {
  const [state, setState] = useState<PlayerViewport>(() => ({
    isCompact: typeof window !== 'undefined' ? window.matchMedia(COMPACT_QUERY).matches : false,
    isTouch: typeof window !== 'undefined' ? window.matchMedia(TOUCH_QUERY).matches : false,
    isHeadset: detectHeadset(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compact = window.matchMedia(COMPACT_QUERY);
    const touch = window.matchMedia(TOUCH_QUERY);
    const sync = () => {
      setState({
        isCompact: compact.matches,
        isTouch: touch.matches,
        isHeadset: detectHeadset(),
      });
    };
    sync();
    compact.addEventListener('change', sync);
    touch.addEventListener('change', sync);
    return () => {
      compact.removeEventListener('change', sync);
      touch.removeEventListener('change', sync);
    };
  }, []);

  return state;
}
