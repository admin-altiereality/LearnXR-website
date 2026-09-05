/**
 * useComfortBreak – prompt a headset wearer to take a break.
 *
 * Guidance for immersive learning is consistent: keep sessions short for young
 * learners, around 10–15 minutes for under-13s, and build up rather than
 * starting long. Nothing in either player tracked time in the headset, so a
 * class could sit in VR for as long as the lesson ran.
 *
 * The prompt only counts time actually spent presenting — a student who takes
 * the headset off, or who is following along on a laptop, is not accumulating
 * fatigue and should not be interrupted.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Default interval. Deliberately at the cautious end of the published range. */
export const DEFAULT_COMFORT_BREAK_MS = 10 * 60 * 1000;

export interface ComfortBreak {
  /** True when the learner has been immersed long enough to be prompted. */
  due: boolean;
  /** Minutes immersed so far, for the prompt copy. */
  immersedMinutes: number;
  /** Dismiss and start the next interval. */
  acknowledge: () => void;
}

export function useComfortBreak(options: {
  /** True while this viewer is actually in an immersive session. */
  isImmersive: boolean;
  /** Set false to disable entirely (e.g. for the teacher driving the class). */
  enabled?: boolean;
  intervalMs?: number;
}): ComfortBreak {
  const { isImmersive, enabled = true, intervalMs = DEFAULT_COMFORT_BREAK_MS } = options;

  const [due, setDue] = useState(false);
  const [immersedMs, setImmersedMs] = useState(0);
  /** Accumulated across sessions, so taking the headset off does not reset it. */
  const accumulatedRef = useRef(0);
  const enteredAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (isImmersive) {
      enteredAtRef.current = Date.now();
    } else if (enteredAtRef.current) {
      accumulatedRef.current += Date.now() - enteredAtRef.current;
      enteredAtRef.current = null;
    }

    if (!isImmersive) return;
    const tick = () => {
      const live = enteredAtRef.current ? Date.now() - enteredAtRef.current : 0;
      const total = accumulatedRef.current + live;
      setImmersedMs(total);
      if (total >= intervalMs) setDue(true);
    };
    tick();
    // Once a minute is plenty: this drives a prompt, not a progress bar.
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [isImmersive, enabled, intervalMs]);

  const acknowledge = useCallback(() => {
    setDue(false);
    // Reset the clock rather than the total, so the next prompt is a full
    // interval away instead of firing again on the next tick.
    accumulatedRef.current = 0;
    enteredAtRef.current = Date.now();
    setImmersedMs(0);
  }, []);

  return { due, immersedMinutes: Math.round(immersedMs / 60_000), acknowledge };
}
