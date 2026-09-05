/**
 * resolvePlayerRoute – the single place that decides which player a lesson opens in.
 *
 * The teacher picks a player when they launch, the choice rides along on
 * `launched_lesson.player`, and every student follows it. Before this existed the
 * routing was hard-coded in a dozen `navigate('/vrlessonplayer-krpano')` calls,
 * which is how the class and the teacher could end up in different players.
 *
 * The default is now the Three.js player. It handles 3D assets, teacher control,
 * view sync and the lesson panel better than krpano, so a launch that does not
 * name a player gets it. krpano remains fully supported and is still the right
 * choice for content authored specifically for it — licensed krpano_native
 * lessons route there explicitly regardless of this default.
 */

import type { LaunchedLesson, LessonPlayerChoice } from '../../types/lms';

export const PLAYER_ROUTES: Record<LessonPlayerChoice, string> = {
  krpano: '/vrlessonplayer-krpano',
  xr_v3: '/xrlessonplayer',
};

export const DEFAULT_PLAYER: LessonPlayerChoice = 'xr_v3';

/** Narrow an arbitrary value to a known player, falling back to the default. */
export function normalizePlayerChoice(value: unknown): LessonPlayerChoice {
  return value === 'xr_v3' || value === 'krpano' ? value : DEFAULT_PLAYER;
}

/**
 * Route for a launched lesson. Accepts the whole payload, a bare player value, or
 * nothing at all, so every call site can pass what it happens to have.
 */
export function resolvePlayerRoute(
  source?: Pick<LaunchedLesson, 'player'> | LessonPlayerChoice | null
): string {
  if (!source) return PLAYER_ROUTES[DEFAULT_PLAYER];
  const choice =
    typeof source === 'string' ? normalizePlayerChoice(source) : normalizePlayerChoice(source.player);
  return PLAYER_ROUTES[choice];
}

/** Human label for the player picker. */
export function playerLabel(choice: LessonPlayerChoice): string {
  return choice === 'xr_v3' ? 'XR player (Three.js)' : '360° player (krpano)';
}

/**
 * Open a launched lesson in the player the class was launched into.
 *
 * The single entry point for navigating into a player. Every call site used to
 * hardcode a route, which is how a teacher could end up in one player while
 * their students sat in another.
 */
export function openLessonInPlayer(
  navigate: (to: string, options?: { replace?: boolean }) => void,
  options: {
    launched?: Pick<LaunchedLesson, 'player'> | LessonPlayerChoice | null;
    replace?: boolean;
    /** Delay in ms, for callers that let third-party iframes settle first. */
    delayMs?: number;
  } = {}
): void {
  const route = resolvePlayerRoute(options.launched ?? null);
  const go = () => navigate(route, options.replace ? { replace: true } : undefined);
  if (options.delayMs && options.delayMs > 0) {
    setTimeout(go, options.delayMs);
    return;
  }
  go();
}
