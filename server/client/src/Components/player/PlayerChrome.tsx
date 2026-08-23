/**
 * PlayerChrome
 * ------------
 * The layout shell for the VR lesson player.
 *
 * The old player had every panel free-floating with a hand-picked z-index, so
 * overlap was avoided by guesswork and mostly failed — the host control stack
 * covered the quiz, and the host header covered the player's own audio controls.
 *
 * Here there are exactly three bands. The stage is BOUNDED by the two bar
 * heights (published as CSS variables), so a bar physically cannot enter the
 * stage's box. Overlap is structurally impossible rather than carefully avoided.
 *
 *   ┌──────────────────────────────┐
 *   │ top bar        --hud-top     │
 *   ├──────────────────────────────┤
 *   │ stage (centred content)      │  ← top-right stays empty for toasts
 *   ├──────────────────────────────┤
 *   │ bottom bar     --hud-bottom  │
 *   └──────────────────────────────┘
 */

import type { ReactNode } from 'react';

interface PlayerChromeProps {
  topBar?: ReactNode;
  bottomBar?: ReactNode;
  /** Centred content: quiz card, lesson stage card, scrubber. */
  children?: ReactNode;
  /** Full-bleed layers that must sit above the stage (gates, lobby, drawers). */
  overlays?: ReactNode;
}

export const PlayerChrome = ({
  topBar,
  bottomBar,
  children,
  overlays,
}: PlayerChromeProps) => {
  // --hud-top / --hud-bottom are defined on the PLAYER ROOT, not here: siblings of
  // this component need them too, and inline custom properties do not reach siblings.
  return (
    <div className="pointer-events-none absolute inset-0">
      {topBar && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-hud h-[var(--hud-top)] pt-[env(safe-area-inset-top,0px)]">
          {topBar}
        </div>
      )}

      {/* Stage: bounded by both bars. Content centres here and scrolls internally
          rather than growing into the bars. */}
      <div className="pointer-events-none absolute inset-x-0 top-[var(--hud-top)] bottom-[var(--hud-bottom)] z-stage flex items-end justify-center px-3 pb-3 sm:items-center sm:pb-0">
        <div className="pointer-events-none flex max-h-full w-full max-w-lg flex-col gap-2 overflow-y-auto overscroll-contain [&>*]:pointer-events-auto">
          {children}
        </div>
      </div>

      {bottomBar && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-hud h-[var(--hud-bottom)] pb-[env(safe-area-inset-bottom,0px)]">
          {bottomBar}
        </div>
      )}

      {overlays}
    </div>
  );
};
