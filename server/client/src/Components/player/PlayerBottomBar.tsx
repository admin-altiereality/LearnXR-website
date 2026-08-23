/**
 * PlayerBottomBar
 * ---------------
 * The teacher's control surface, replacing the floating left stack that used to
 * cover the quiz card.
 *
 * One tap reaches playback transport, marker tools and class controls. Roster and
 * approvals are lists, so they live in a sheet — the badge count stays here.
 * On compact widths the secondary items collapse behind an overflow button.
 */

import { useState } from 'react';
import {
  Play, Pause, RotateCcw, ChevronRight, Radio, Zap, Users, Target, MoreHorizontal,
} from 'lucide-react';
import { MarkerToolbar } from './MarkerToolbar';

const PHASES: Array<{ phase: string; label: string }> = [
  { phase: 'intro', label: 'Intro' },
  { phase: 'explanation', label: 'Learn' },
  { phase: 'outro', label: 'Summary' },
  { phase: 'quiz', label: 'Quiz' },
];

interface PlayerBottomBarProps {
  isHost: boolean;
  compact?: boolean;

  // Playback (student sees a read-only version; host drives)
  playbackState?: 'idle' | 'playing' | 'paused';
  currentPhase?: string | null;
  onPlaybackCommand?: (cmd: 'play' | 'pause' | 'replay', phase?: string) => void;
  /** Student-side local narration control, used when not under teacher control. */
  onLocalPlayToggle?: () => void;
  isPlayingAudio?: boolean;
  playbackLocked?: boolean;

  // Class controls (host)
  controlStudentsEnabled?: boolean;
  onToggleControl?: (enabled: boolean) => void;
  onForceStudentsIn?: () => void;
  canForce?: boolean;
  onDirectView?: () => void;
  liveCount?: number;
  onOpenRoster?: () => void;
  raisedHands?: number;

  // Marker (host)
  markerActive?: boolean;
  markerColor?: string;
  onToggleMarker?: () => void;
  onMarkerColorChange?: (c: string) => void;
}

export const PlayerBottomBar = (props: PlayerBottomBarProps) => {
  const {
    isHost, compact = false,
    playbackState = 'idle', currentPhase, onPlaybackCommand,
    onLocalPlayToggle, isPlayingAudio = false, playbackLocked = false,
    controlStudentsEnabled = false, onToggleControl, onForceStudentsIn, canForce = false,
    onDirectView, liveCount = 0, onOpenRoster, raisedHands = 0,
    markerActive = false, markerColor = '#ffdd33',
    onToggleMarker, onMarkerColorChange,
  } = props;

  const [overflowOpen, setOverflowOpen] = useState(false);

  // ---- Student bar: narration only, and only when the teacher isn't driving ----
  if (!isHost) {
    return (
      <div className="pointer-events-auto flex h-full w-full items-center justify-center gap-2 border-t border-white/10 bg-zinc-950/80 px-3 backdrop-blur-2xl">
        <button
          type="button"
          onClick={onLocalPlayToggle}
          disabled={playbackLocked}
          title={playbackLocked ? 'Your teacher controls playback' : isPlayingAudio ? 'Pause' : 'Play'}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
            playbackLocked
              ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35'
              : 'border-primary/50 bg-primary/20 text-primary hover:bg-primary/30'
          }`}
        >
          {isPlayingAudio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playbackLocked ? 'Teacher is leading' : isPlayingAudio ? 'Pause' : 'Play'}
        </button>
      </div>
    );
  }

  const playing = playbackState === 'playing';
  const primary = (
    <>
      <button
        type="button"
        onClick={() => onPlaybackCommand?.(playing ? 'pause' : 'play')}
        title={playing ? 'Pause the class' : playbackState === 'paused' ? 'Resume the class' : 'Start the class'}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
          playing
            ? 'border-amber-300/50 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30'
            : 'border-emerald-300/50 bg-emerald-400/25 text-emerald-50 hover:bg-emerald-400/35'
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {!compact && <span>{playing ? 'Pause' : playbackState === 'paused' ? 'Resume' : 'Start class'}</span>}
      </button>

      {!compact && (
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] p-0.5">
          {PHASES.map((p) => (
            <button
              key={p.phase}
              type="button"
              onClick={() => onPlaybackCommand?.('play', p.phase)}
              title={`Send the class to ${p.label}`}
              className={`h-8 rounded-md px-2 text-[11px] font-semibold transition ${
                currentPhase === p.phase ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onPlaybackCommand?.('replay')}
        title="Replay the current phase for everyone"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-violet-200 transition hover:bg-white/10"
      >
        <RotateCcw className="h-4 w-4" />
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => {
            const i = PHASES.findIndex((p) => p.phase === (currentPhase || 'intro'));
            onPlaybackCommand?.('play', PHASES[Math.min(i + 1, PHASES.length - 1)].phase);
          }}
          title="Advance the class to the next phase"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-teal-200 transition hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </>
  );

  const classControls = (
    <>
      <button
        type="button"
        onClick={() => onToggleControl?.(!controlStudentsEnabled)}
        aria-pressed={controlStudentsEnabled}
        title={controlStudentsEnabled ? 'Lockstep is on — students follow you' : 'Take control of the class'}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
          controlStudentsEnabled
            ? 'border-rose-400/45 bg-rose-500/20 text-rose-100'
            : 'border-violet-400/40 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30'
        }`}
      >
        <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse" />
        {!compact && <span>{controlStudentsEnabled ? 'Control: ON' : 'Control'}</span>}
      </button>

      <button
        type="button"
        onClick={onForceStudentsIn}
        disabled={!canForce}
        title="Pull every joined student into this lesson"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-2.5 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-400/25 disabled:opacity-40"
      >
        <Zap className="h-3.5 w-3.5" />
        {!compact && <span>Bring everyone in</span>}
      </button>

      <button
        type="button"
        onClick={onDirectView}
        title="Point the whole class at what you are looking at"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/10"
      >
        <Target className="h-3.5 w-3.5" />
        {!compact && <span>Direct view</span>}
      </button>

      <button
        type="button"
        onClick={onOpenRoster}
        title="Student roster"
        className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/10"
      >
        <Users className="h-3.5 w-3.5" />
        <span className="tabular-nums">{liveCount}</span>
        {raisedHands > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
            {raisedHands}
          </span>
        )}
      </button>
    </>
  );

  const marker = (
    <MarkerToolbar
      active={markerActive}
      color={markerColor}
      compact={compact}
      onToggleActive={() => onToggleMarker?.()}
      onColorChange={(c) => onMarkerColorChange?.(c)}
    />
  );

  return (
    <div className="pointer-events-auto relative flex h-full w-full items-center gap-1.5 border-t border-white/10 bg-zinc-950/80 px-2 backdrop-blur-2xl sm:gap-2 sm:px-3">
      {primary}
      <div className="mx-1 hidden h-6 w-px shrink-0 bg-white/10 sm:block" />
      {marker}

      {compact ? (
        <>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-expanded={overflowOpen}
            title="More controls"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] text-white/75"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {overflowOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] right-2 flex flex-wrap items-center justify-end gap-1.5 rounded-xl border border-white/12 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-2xl">
              {classControls}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />
          <div className="flex flex-1 items-center justify-end gap-1.5 overflow-x-auto">
            {classControls}
          </div>
        </>
      )}
    </div>
  );
};
