/**
 * MarkerToolbar
 * -------------
 * Teacher marker controls, shown inline in the bottom bar.
 *
 * One marker, no modes: every stroke now fades on its own after a few seconds, so
 * there is nothing to clear and no laser/ink distinction left to make.
 *
 * Marker is a MODE: while it is on, dragging draws and krpano panning is
 * suspended. Turning it off restores panning. That is deliberate — it is how
 * every whiteboard tool behaves, and it keeps one obvious state.
 */

import { Highlighter } from 'lucide-react';

export const MARKER_COLORS = ['#ffdd33', '#ff5c5c', '#4ade80', '#60a5fa'];

interface MarkerToolbarProps {
  active: boolean;
  color: string;
  compact?: boolean;
  onToggleActive: () => void;
  onColorChange: (color: string) => void;
}

export const MarkerToolbar = ({
  active,
  color,
  compact = false,
  onToggleActive,
  onColorChange,
}: MarkerToolbarProps) => {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggleActive}
        title={active ? 'Marker on — drag to draw. Click to resume looking around.' : 'Marker: draw on the panorama'}
        aria-pressed={active}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
          active
            ? 'border-amber-300/50 bg-amber-400/25 text-amber-100'
            : 'border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/10'
        }`}
      >
        <Highlighter className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span>Marker</span>}
      </button>

      {active && (
        <div className="flex items-center gap-1">
          {MARKER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              aria-label={`Marker colour ${c}`}
              aria-pressed={color === c}
              className={`h-6 w-6 rounded-full border-2 transition ${
                color === c ? 'border-white scale-110' : 'border-white/25 hover:border-white/60'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
