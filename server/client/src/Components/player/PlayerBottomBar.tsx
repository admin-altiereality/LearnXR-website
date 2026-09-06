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
  Play, Pause, RotateCcw, ChevronRight, Radio, Zap, Users, Target, MoreHorizontal, Eye, EyeOff,
} from 'lucide-react';
import { MarkerToolbar } from './MarkerToolbar';
import { ModelToolbar, type ClipAxis } from './ModelToolbar';

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
  /** True once the teacher has pressed Start class (teacher_playback is no longer idle). */
  classStarted?: boolean;
  /** Whether STUDENTS currently see the in-headset panel. The teacher always keeps theirs. */
  studentUiVisible?: boolean;
  onToggleStudentUi?: (visible: boolean) => void;
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

  // 3D model (host). Absent/0 partCount hides the toolbar entirely.
  modelPartCount?: number;
  modelExplode?: number;
  onModelExplodeChange?: (t: number) => void;
  modelIsolated?: boolean;
  modelSelectedPartName?: string | null;
  onToggleModelIsolate?: () => void;
  modelClip?: { axis: ClipAxis; offset: number } | null;
  onModelClipChange?: (clip: { axis: ClipAxis; offset: number } | null) => void;
  onModelReset?: () => void;
}

export const PlayerBottomBar = (props: PlayerBottomBarProps) => {
  const {
    isHost, compact = false,
    playbackState = 'idle', currentPhase, onPlaybackCommand,
    onLocalPlayToggle, isPlayingAudio = false, playbackLocked = false,
    controlStudentsEnabled = false, onToggleControl, onForceStudentsIn, canForce = false,
    onDirectView, liveCount = 0, onOpenRoster, raisedHands = 0,
    classStarted = false, studentUiVisible = true, onToggleStudentUi,
    markerActive = false, markerColor = '#ffdd33',
    onToggleMarker, onMarkerColorChange,
    modelPartCount = 0, modelExplode = 0, onModelExplodeChange,
    modelIsolated = false, modelSelectedPartName = null, onToggleModelIsolate,
    modelClip = null, onModelClipChange, onModelReset,
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

  // ---- Flow-aware layout -------------------------------------------------
  //
  // The bar used to render all eleven host controls at equal weight, in a fixed order,
  // whether or not they meant anything yet. A teacher had to hunt for the one button that
  // mattered at that moment, and controls that do nothing (Student UI before the class has
  // started, Direct view before anyone is in) sat next to ones that do.
  //
  // Instead the bar follows the lesson: ONE primary action for the current stage, its
  // likely follow-ups beside it, and everything else demoted to the overflow — still one
  // tap away, never removed.
  const playing = playbackState === 'playing';
  const phase = currentPhase || 'intro';
  const stage: 'gathering' | 'teaching' | 'quiz' | 'review' = !classStarted
    ? 'gathering'
    : phase === 'completed'
      ? 'review'
      : phase === 'quiz'
        ? 'quiz'
        : 'teaching';

  const phaseIndex = PHASES.findIndex((p) => p.phase === phase);
  const goNextPhase = () =>
    onPlaybackCommand?.('play', PHASES[Math.min(Math.max(phaseIndex, 0) + 1, PHASES.length - 1)].phase);

  const btn = 'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition';
  const quiet = 'border-white/12 bg-white/[0.06] text-white/75 hover:bg-white/10';

  /**
   * The single most likely next press, given where the lesson is.
   * Nobody has arrived yet -> bring them in. Everyone is here but nothing is running ->
   * start. Running -> pause. It carries a ring while it is the recommended step so the eye
   * lands on it without reading the bar.
   */
  const cta = (() => {
    if (stage === 'gathering' && liveCount === 0 && canForce) {
      return {
        key: 'force',
        node: (
          <button
            type="button"
            onClick={onForceStudentsIn}
            title="Pull every joined student into this lesson"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/25 px-4 text-sm font-bold text-cyan-50 shadow-lg ring-2 ring-cyan-300/30 transition hover:bg-cyan-400/35"
          >
            <Zap className="h-4 w-4" />
            <span>Bring everyone in</span>
          </button>
        ),
      };
    }
    if (stage === 'review') {
      // The lesson has finished. Offering "Start class" here would restart a completed
      // lesson; what the teacher actually wants next is how the class did.
      return {
        key: 'roster',
        node: (
          <button
            type="button"
            onClick={onOpenRoster}
            title="See how the class did"
            className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/25 px-4 text-sm font-bold text-cyan-50 shadow-lg ring-2 ring-cyan-300/30 transition hover:bg-cyan-400/35"
          >
            <Users className="h-4 w-4" />
            <span>See results</span>
            <span className="tabular-nums opacity-80">{liveCount}</span>
          </button>
        ),
      };
    }
    // Taking control and starting the class are ONE intent, so they are one
    // button. setSessionControl deliberately holds the class at idle, which
    // meant the teacher pressed Control and then Play for a single decision,
    // with the two sitting side by side as if they were alternatives.
    if (!controlStudentsEnabled) {
      return {
        key: 'control',
        node: (
          <button
            type="button"
            onClick={() => onToggleControl?.(true)}
            title="Take control — students are held until you start the class"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-violet-300/60 bg-violet-500/30 px-4 text-sm font-bold text-violet-50 shadow-lg ring-2 ring-violet-300/25 transition hover:bg-violet-500/40"
          >
            <Radio className="h-4 w-4" />
            <span>Take control</span>
          </button>
        ),
      };
    }

    const label = playing ? 'Pause' : playbackState === 'paused' ? 'Resume' : 'Start class';
    const recommend = !classStarted;
    return {
      key: 'play',
      node: (
        <button
          type="button"
          onClick={() => onPlaybackCommand?.(playing ? 'pause' : 'play')}
          title={playing ? 'Pause the class' : playbackState === 'paused' ? 'Resume the class' : 'Start the class for everyone'}
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-lg transition ${
            playing
              ? 'border-amber-300/50 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30'
              : 'border-emerald-300/60 bg-emerald-400/30 text-emerald-50 hover:bg-emerald-400/40'
          } ${recommend ? 'ring-2 ring-emerald-300/30' : ''}`}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span>{label}</span>
        </button>
      ),
    };
  })();

  // Every control, addressable by key so each stage can compose its own bar.
  const controls: Record<string, JSX.Element> = {
    phases: (
      <div key="phases" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] p-0.5">
        {PHASES.map((p) => (
          <button
            key={p.phase}
            type="button"
            onClick={() => onPlaybackCommand?.('play', p.phase)}
            title={`Send the class to ${p.label}`}
            className={`h-8 rounded-md px-2 text-[11px] font-semibold transition ${
              phase === p.phase ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    ),
    next: (
      <button
        key="next"
        type="button"
        onClick={goNextPhase}
        title="Advance the class to the next phase"
        className={`${btn} border-teal-300/40 bg-teal-400/15 text-teal-100 hover:bg-teal-400/25`}
      >
        <ChevronRight className="h-4 w-4" />
        {!compact && <span>Next</span>}
      </button>
    ),
    replay: (
      <button
        key="replay"
        type="button"
        onClick={() => onPlaybackCommand?.('replay')}
        title="Replay the current phase for everyone"
        className={`${btn} ${quiet} text-violet-200`}
      >
        <RotateCcw className="h-4 w-4" />
        {!compact && <span>Replay</span>}
      </button>
    ),
    // Taking control is the primary button above; this is only ever the release,
    // and it names the consequence rather than the mechanism.
    release: (
      <button
        key="release"
        type="button"
        onClick={() => onToggleControl?.(false)}
        title="Release the class — students move at their own pace again"
        className={`${btn} border-rose-400/45 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30`}
      >
        <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse" />
        {!compact && <span>Let students explore</span>}
      </button>
    ),
    // Paired with the marker: after drawing on something, the next press is almost always
    // "now everyone look at it", so these two sit together rather than at opposite ends.
    direct: (
      <button
        key="direct"
        type="button"
        onClick={onDirectView}
        title="Point the whole class at what you are looking at"
        className={`${btn} ${markerActive ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : quiet}`}
      >
        <Target className="h-3.5 w-3.5" />
        {!compact && <span>Direct view</span>}
      </button>
    ),
    studentUi: (
      <button
        key="studentUi"
        type="button"
        onClick={() => onToggleStudentUi?.(!studentUiVisible)}
        disabled={!classStarted}
        aria-pressed={studentUiVisible}
        title={
          !classStarted
            ? 'Start the class first — students explore with a clean view until then'
            : studentUiVisible
              ? 'Students can see the lesson panel — hide it so they explore the scene'
              : 'Show the lesson panel to students'
        }
        className={`${btn} disabled:opacity-40 ${
          studentUiVisible ? 'border-emerald-300/45 bg-emerald-400/20 text-emerald-50' : quiet
        }`}
      >
        {studentUiVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        {!compact && <span>{studentUiVisible ? 'Student UI' : 'Student UI: off'}</span>}
      </button>
    ),
    force: (
      <button
        key="force"
        type="button"
        onClick={onForceStudentsIn}
        disabled={!canForce}
        title="Pull every joined student into this lesson"
        className={`${btn} border-cyan-300/40 bg-cyan-400/15 text-cyan-50 hover:bg-cyan-400/25 disabled:opacity-40`}
      >
        <Zap className="h-3.5 w-3.5" />
        {!compact && <span>Bring everyone in</span>}
      </button>
    ),
    roster: (
      <button
        key="roster"
        type="button"
        onClick={onOpenRoster}
        title="Student roster"
        className={`relative ${btn} ${quiet} ${stage === 'quiz' || stage === 'review' ? 'border-cyan-300/40 text-cyan-50' : ''}`}
      >
        <Users className="h-3.5 w-3.5" />
        <span className="tabular-nums">{liveCount}</span>
        {raisedHands > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
            {raisedHands}
          </span>
        )}
      </button>
    ),
  };

  /**
   * What sits beside the primary action, per stage — ordered by how likely it is to be
   * the NEXT press after the primary one.
   *   gathering: you take control, then start; the roster is what you are watching.
   *   teaching:  you advance, replay, or jump phase; marker and Direct are the attention pair.
   *   quiz:      you watch answers, and may replay or point at an option.
   *   review:    the roster IS the outcome.
   */
  const SURFACED: Record<typeof stage, string[]> = {
    // Before the class starts there is no student panel to toggle and nobody to
    // point anywhere, so studentUi and direct are not offered yet — they appear
    // in `teaching` below, once they can actually do something.
    gathering: ['roster'],
    teaching: ['next', 'phases', 'replay', 'direct', 'studentUi', 'roster'],
    quiz: ['roster', 'replay', 'direct', 'phases'],
    review: ['roster', 'replay', 'phases'],
  };

  const surfacedKeys = SURFACED[stage].filter((k) => k !== cta.key);
  /**
   * A control appears only once its precondition holds. Releasing control needs
   * control; the student panel and Direct view need a class that has started.
   * Offering them earlier gave a teacher buttons that silently did nothing.
   */
  const isAvailable = (key: string): boolean => {
    if (key === 'release') return controlStudentsEnabled;
    if (key === 'studentUi' || key === 'direct') return classStarted;
    return true;
  };
  const overflowKeys = Object.keys(controls).filter(
    (k) => !surfacedKeys.includes(k) && k !== cta.key && isAvailable(k)
  );

  // The marker travels with the teaching tools, and is hidden while gathering — there is
  // nothing to annotate before the lesson is on screen.
  const marker = (
    <MarkerToolbar
      active={markerActive}
      color={markerColor}
      compact={compact}
      onToggleActive={() => onToggleMarker?.()}
      onColorChange={(c) => onMarkerColorChange?.(c)}
    />
  );

  const showMarker = stage === 'teaching' || stage === 'quiz';

  // Model controls sit beside the marker: both are "act on what the class is looking at".
  // Shown only to a host, only while teaching, and only when there is actually a model.
  const showModel = isHost && stage === 'teaching' && modelPartCount > 0;
  const model = (
    <ModelToolbar
      compact={compact}
      partCount={modelPartCount}
      explode={modelExplode}
      onExplodeChange={(t) => onModelExplodeChange?.(t)}
      isolated={modelIsolated}
      selectedPartName={modelSelectedPartName}
      onToggleIsolate={() => onToggleModelIsolate?.()}
      clip={modelClip}
      onClipChange={(c) => onModelClipChange?.(c)}
      onReset={() => onModelReset?.()}
    />
  );

  return (
    <div className="pointer-events-auto relative flex h-full w-full items-center gap-1.5 border-t border-white/10 bg-zinc-950/80 px-2 backdrop-blur-2xl sm:gap-2 sm:px-3">
      {cta.node}

      {showMarker && (
        <>
          <div className="mx-1 hidden h-6 w-px shrink-0 bg-white/10 sm:block" />
          {marker}
        </>
      )}

      {showModel && (
        <>
          <div className="mx-1 hidden h-6 w-px shrink-0 bg-white/10 sm:block" />
          <div className="hidden items-center overflow-x-auto [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden">
            {model}
          </div>
        </>
      )}

      {!compact && (
        <>
          <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />
          <div className="flex flex-1 items-center justify-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {surfacedKeys.filter(isAvailable).map((k) => controls[k])}
          </div>
        </>
      )}

      {compact && <div className="flex-1" />}

      {(compact || overflowKeys.length > 0) && (
        <>
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
              {(compact ? [...surfacedKeys, ...overflowKeys] : overflowKeys).map((k) => controls[k])}
            </div>
          )}
        </>
      )}
    </div>
  );
};
