/**
 * useEnforcedPlayerRoute – keep a class together in one player.
 *
 * The teacher picks a player when they launch, and it rides on
 * `launched_lesson.player`. But a viewer can still arrive in the wrong player:
 * a tab left open from a previous launch, a bookmarked route, a call site that
 * was never converted, or the legacy VRLessonPlayer's render-time bounce.
 *
 * So rather than trusting every entry point to route correctly, each player
 * checks on arrival and redirects if it is not the one the class is using. That
 * is what makes the launch structure homogeneous: getting it wrong is
 * self-correcting instead of stranding half the class.
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClassSession } from '../contexts/ClassSessionContext';
import { normalizePlayerChoice, resolvePlayerRoute } from '../lib/classroom/resolvePlayerRoute';
import type { LessonPlayerChoice } from '../types/lms';

/**
 * @param currentPlayer which player is calling this — the one already rendering.
 * @param enabled set false while the player is still deciding what to load.
 */
export function useEnforcedPlayerRoute(currentPlayer: LessonPlayerChoice, enabled = true): void {
  const navigate = useNavigate();
  const location = useLocation();
  /** Launch ids already acted on, so a redirect can never bounce repeatedly. */
  const handledRef = useRef<string | null>(null);

  let session: ReturnType<typeof useClassSession> | null = null;
  try {
    session = useClassSession();
  } catch {
    // Not inside a ClassSessionProvider: nothing to enforce.
    session = null;
  }

  // A student follows the session they joined; a host follows the one they run.
  const launched =
    session?.joinedSession?.launched_lesson ?? session?.activeSession?.launched_lesson ?? null;

  useEffect(() => {
    if (!enabled || !launched) return;

    const wanted = normalizePlayerChoice(launched.player);
    if (wanted === currentPlayer) return;

    const route = resolvePlayerRoute(launched);
    // Never navigate to where we already are, whatever the session says.
    if (route === location.pathname) return;

    const launchKey = `${launched.launch_id || ''}:${route}`;
    if (handledRef.current === launchKey) return;
    handledRef.current = launchKey;

    console.log(
      `[PlayerRoute] Class is using "${wanted}" but this is "${currentPlayer}" — moving to ${route}`
    );
    navigate(route, { replace: true });
  }, [enabled, launched, currentPlayer, navigate, location.pathname]);
}
