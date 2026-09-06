/**
 * ModelToolbar
 * ------------
 * Teacher controls for the 3D model in the scene, shown inline in the bottom bar.
 *
 * Four things a teacher can do that a still image cannot: pull the model apart, isolate one
 * part, slice it open, and put it back. Each one broadcasts, so the class sees it happen
 * rather than being told about it.
 *
 * Hidden entirely when the scene has no 3D asset, and Explode is disabled when the asset is
 * a single mesh — a slider that visibly does nothing reads as broken, so it is better to
 * say "nothing to take apart" than to offer a dead control.
 */

import { Layers, Scissors, Focus, RotateCcw } from 'lucide-react';

export type ClipAxis = 'x' | 'y' | 'z';

export interface ToolbarAsset {
  key: string;
  name: string;
  partCount: number;
}

interface ModelToolbarProps {
  compact?: boolean;
  /** Every 3D asset in the scene, so the teacher can choose which to work on. */
  assets?: ToolbarAsset[];
  /** The asset the controls act on; null means all of them. */
  selectedAssetKey?: string | null;
  onSelectAsset?: (key: string | null) => void;
  /** Separable meshes in the CURRENT target; < 2 means nothing to explode. */
  partCount: number;
  explode: number;
  onExplodeChange: (t: number) => void;
  isolated: boolean;
  /** Name of the currently picked part, or null. Isolate needs one to isolate TO. */
  selectedPartName: string | null;
  onToggleIsolate: () => void;
  clip: { axis: ClipAxis; offset: number } | null;
  onClipChange: (clip: { axis: ClipAxis; offset: number } | null) => void;
  onReset: () => void;
}

const btn =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';
const quiet = 'border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/10';
const on = 'border-cyan-300/50 bg-cyan-400/20 text-cyan-50';

export const ModelToolbar = ({
  compact = false,
  assets = [],
  selectedAssetKey = null,
  onSelectAsset,
  partCount,
  explode,
  onExplodeChange,
  isolated,
  selectedPartName,
  onToggleIsolate,
  clip,
  onClipChange,
  onReset,
}: ModelToolbarProps) => {
  const canExplode = partCount >= 2;
  // A picker only earns its space once there is a choice to make.
  const showPicker = assets.length > 1;

  return (
    <div className="flex items-center gap-1.5">
      {/* Which asset the controls act on */}
      {showPicker && (
        <select
          value={selectedAssetKey ?? ''}
          onChange={(e) => onSelectAsset?.(e.target.value || null)}
          aria-label="Asset to control"
          title="Choose which 3D model Explode, Isolate and Section act on"
          className="h-9 max-w-[9rem] truncate rounded-lg border border-white/12 bg-white/[0.06] px-2 text-xs font-semibold text-white/75 outline-none transition hover:bg-white/10 focus:border-cyan-300/50"
        >
          <option value="">All models</option>
          {assets.map((asset) => (
            <option key={asset.key} value={asset.key}>
              {asset.name}
              {asset.partCount > 1 ? ` (${asset.partCount} parts)` : ''}
            </option>
          ))}
        </select>
      )}

      {/* Explode */}
      <div className="flex items-center gap-1.5">
        <span
          className={`${btn} ${explode > 0 ? on : quiet} pointer-events-none`}
          title={
            canExplode
              ? 'Pull the selected model apart'
              : 'This model is a single piece — nothing to take apart'
          }
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          {!compact && <span>Explode</span>}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(explode * 100)}
          disabled={!canExplode}
          onChange={(e) => onExplodeChange(Number(e.target.value) / 100)}
          aria-label="Explode amount"
          title={canExplode ? 'Explode amount' : 'This model is a single piece'}
          className="h-1.5 w-20 cursor-pointer accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>

      {/* Isolate the picked part */}
      <button
        type="button"
        onClick={onToggleIsolate}
        disabled={!selectedPartName}
        aria-pressed={isolated}
        title={
          selectedPartName
            ? `${isolated ? 'Show every part again' : `Dim everything except ${selectedPartName}`}`
            : 'Tap a part of the model first'
        }
        className={`${btn} ${isolated ? on : quiet}`}
      >
        <Focus className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span>{isolated && selectedPartName ? selectedPartName : 'Isolate'}</span>}
      </button>

      {/* Cross-section */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onClipChange(clip ? null : { axis: 'x', offset: 0 })}
          aria-pressed={Boolean(clip)}
          title={clip ? 'Close the cutaway' : 'Slice the model open to see inside'}
          className={`${btn} ${clip ? on : quiet}`}
        >
          <Scissors className="h-3.5 w-3.5 shrink-0" />
          {!compact && <span>Section</span>}
        </button>
        {clip && (
          <>
            {(['x', 'y', 'z'] as ClipAxis[]).map((axis) => (
              <button
                key={axis}
                type="button"
                onClick={() => onClipChange({ ...clip, axis })}
                aria-pressed={clip.axis === axis}
                title={`Cut along the ${axis.toUpperCase()} axis`}
                className={`h-9 w-7 rounded-lg border text-xs font-semibold uppercase transition ${
                  clip.axis === axis ? on : quiet
                }`}
              >
                {axis}
              </button>
            ))}
            <input
              type="range"
              min={-100}
              max={100}
              value={Math.round(clip.offset * 100)}
              onChange={(e) => onClipChange({ ...clip, offset: Number(e.target.value) / 100 })}
              aria-label="Cut position"
              title="Move the cut through the model"
              className="h-1.5 w-20 cursor-pointer accent-cyan-400"
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        title="Put the model back the way the lesson set it up"
        className={`${btn} ${quiet}`}
      >
        <RotateCcw className="h-3.5 w-3.5 shrink-0" />
        {!compact && <span>Reset</span>}
      </button>
    </div>
  );
};
