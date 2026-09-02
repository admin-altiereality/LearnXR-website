import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * Eases a displayed percentage toward its target every frame, and creeps gently forward
 * while the target is standing still.
 *
 * Two things made the raw value feel jerky. It only changes when a whole stage flips, so it
 * lurches (15% -> 45%) and then sits frozen for the entire 3D download; and a CSS `width`
 * transition re-runs layout on every frame it animates. Here the value is integrated in a
 * rAF loop — so any jump is glided through rather than snapped — and the caller renders it
 * with a GPU-composited transform instead of width.
 *
 * The creep is capped at a fraction of the distance to the next real milestone and is reset
 * the moment genuine progress arrives, so the bar keeps breathing during a long download
 * without ever overstating how far along it actually is.
 */
function useSmoothProgress(target: number, ceiling: number, settled: boolean): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const targetRef = useRef(target);
  const creepRef = useRef(0);

  // Reset accumulated creep whenever real progress lands, so it never stacks on top of it.
  if (targetRef.current !== target) {
    if (target > targetRef.current) creepRef.current = 0;
    targetRef.current = target;
  }

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (reduceMotion) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      if (!settled) {
        // Asymptotic: approaches 60% of the gap to the ceiling, never arrives.
        const room = Math.max(0, ceiling - targetRef.current) * 0.6;
        creepRef.current += (room - creepRef.current) * (1 - Math.exp(-dt / 4000));
      } else {
        creepRef.current = 0;
      }

      const goal = Math.min(ceiling, targetRef.current + (settled ? 0 : creepRef.current));
      const next = displayRef.current + (goal - displayRef.current) * (1 - Math.exp(-dt / 220));

      if (Math.abs(next - displayRef.current) > 0.01) {
        displayRef.current = next;
        setDisplay(next);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ceiling, settled]);

  return display;
}

/**
 * The discrete things that must finish before a lesson can start. These mirror the
 * `allReady` gate in VRLessonPlayerKrpano exactly — if a stage is added there, add it
 * here too, or the bar will read 100% while the button is still disabled.
 */
export interface LessonLoadStageState {
  /** Lesson script/topic document resolved. */
  lessonDataReady: boolean;
  /** 3D asset records discovered in Firestore (URLs known). */
  assetReady: boolean;
  /** 360° panorama image decoded and applied to the sphere. */
  skyboxReady: boolean;
  /** TTS narration fetched (or the lesson has none). */
  narrationReady: boolean;
  /** All krpano threejs model hotspots reported loaded. */
  modelsReady: boolean;
  /** Models finished, for sub-stage progress across multiple assets. */
  modelsLoaded?: number;
  /** Total models expected; 0 when the lesson has none. */
  modelsTotal?: number;
}

export interface LessonLoadProgressProps extends LessonLoadStageState {
  /** The real gate. The bar never shows 100% unless this is true. */
  allReady: boolean;
  /** Hide the per-stage checklist, leaving just the bar and its caption. */
  compact?: boolean;
  className?: string;
}

/**
 * Weights are rough shares of wall-clock load time, not equal slices — the panorama
 * and the 3D models dominate, so giving them equal billing with the (near-instant)
 * Firestore reads would make the bar jump to ~60% and then appear to stall.
 */
const STAGES: Array<{
  key: keyof LessonLoadStageState;
  weight: number;
  label: string;
  pendingLabel: string;
}> = [
  { key: 'lessonDataReady', weight: 8, label: 'Content', pendingLabel: 'Loading lesson content' },
  { key: 'assetReady', weight: 7, label: 'Assets', pendingLabel: 'Finding 3D assets' },
  { key: 'skyboxReady', weight: 30, label: '360° scene', pendingLabel: 'Loading 360° environment' },
  { key: 'modelsReady', weight: 45, label: '3D models', pendingLabel: 'Loading 3D models' },
  { key: 'narrationReady', weight: 10, label: 'Narration', pendingLabel: 'Preparing narration' },
];

const TOTAL_WEIGHT = STAGES.reduce((sum, s) => sum + s.weight, 0);

/**
 * Ceiling applied while `allReady` is false. A bar sitting at 100% next to a disabled
 * button reads as a bug, so we hold back a sliver until the gate actually opens.
 */
const PENDING_CEILING = 96;

/** Cumulative weight boundaries, used to place a tick where each stage completes. */
const TICKS = STAGES.reduce<number[]>((acc, stage, i) => {
  const prev = i === 0 ? 0 : acc[i - 1];
  acc.push(prev + (stage.weight / TOTAL_WEIGHT) * 100);
  return acc;
}, []);

export function LessonLoadProgress({
  allReady,
  compact = false,
  className = '',
  modelsLoaded = 0,
  modelsTotal = 0,
  ...stages
}: LessonLoadProgressProps) {
  const state: LessonLoadStageState = { ...stages, modelsLoaded, modelsTotal };

  let earned = 0;
  for (const stage of STAGES) {
    const done = Boolean(state[stage.key]);
    if (done) {
      earned += stage.weight;
    } else if (stage.key === 'modelsReady' && modelsTotal > 0) {
      // Partial credit so multi-model lessons advance smoothly instead of snapping 0 -> 45.
      earned += stage.weight * Math.min(1, modelsLoaded / modelsTotal);
    }
  }

  const raw = (earned / TOTAL_WEIGHT) * 100;
  const target = allReady ? 100 : Math.min(PENDING_CEILING, raw);
  const smooth = useSmoothProgress(target, allReady ? 100 : PENDING_CEILING, allReady);
  const percent = allReady ? 100 : Math.min(PENDING_CEILING, Math.round(smooth));

  const activeStage = STAGES.find((s) => !state[s.key]);
  const caption = allReady
    ? 'Ready to begin'
    : activeStage
      ? activeStage.key === 'modelsReady' && modelsTotal > 0
        ? `Loading 3D models — ${Math.min(modelsLoaded, modelsTotal)} of ${modelsTotal}`
        : activeStage.pendingLabel
      : 'Finishing up';

  return (
    <div className={`w-full text-left ${className}`}>
      <style>{`
        @keyframes lessonLoadSheen {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @keyframes lessonLoadBreathe {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
      `}</style>

      <div className="mb-2.5 flex items-end justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-medium tracking-tight text-white/85">
          {!allReady && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"
              style={{ animation: 'lessonLoadBreathe 1.4s ease-in-out infinite' }}
            />
          )}
          {allReady && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
          {caption}
        </span>
        <span className="shrink-0 text-lg font-semibold leading-none tabular-nums text-white">
          {percent}
          <span className="ml-0.5 text-xs font-normal text-white/40">%</span>
        </span>
      </div>

      {/* Thermometer: recessed tube, liquid fill, travelling sheen, stage ticks. */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Lesson loading progress"
        className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/10"
      >
        {/* Full-width fill slid into place with translateX. Driven by the rAF value above and
            composited on the GPU, so it moves continuously instead of stepping through
            layout-recalculating width transitions. */}
        <div
          className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
          style={{
            transform: `translate3d(${smooth - 100}%, 0, 0)`,
            willChange: 'transform',
            boxShadow: '0 0 12px rgba(34,211,238,0.55), 0 0 3px rgba(16,185,129,0.8)',
          }}
        >
          {!allReady && smooth > 4 && (
            <div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              style={{
                animation: 'lessonLoadSheen 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                // Counteract the parent's translate so the sheen sweeps the visible portion
                // of the bar rather than riding along off-screen with it.
                left: `${100 - smooth}%`,
              }}
            />
          )}
        </div>

        {/* One tick per stage boundary; the last is the end cap, so it's omitted. */}
        {TICKS.slice(0, -1).map((left, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 rounded-full transition-colors duration-500"
            style={{
              left: `${left}%`,
              backgroundColor: percent >= left ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>

      {!compact && (
        <ul className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {STAGES.map((stage) => {
            const done = Boolean(state[stage.key]);
            const isActive = !done && activeStage?.key === stage.key;
            return (
              <li
                key={stage.key}
                className={`flex items-center gap-1.5 text-[11px] transition-colors duration-300 ${
                  done ? 'text-white/50' : isActive ? 'text-cyan-300' : 'text-white/25'
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3 shrink-0 text-emerald-400/80" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-white/20'}`}
                    style={isActive ? { animation: 'lessonLoadBreathe 1.4s ease-in-out infinite' } : undefined}
                  />
                )}
                {stage.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
