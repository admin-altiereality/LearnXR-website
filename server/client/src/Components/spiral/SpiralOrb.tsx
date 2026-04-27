import { useEffect, useMemo, useRef } from 'react';

export type SpiralOrbState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'generating'
  | 'suggesting'
  | 'speaking'
  | 'classLaunch';

interface SpiralOrbProps {
  state: SpiralOrbState;
  onTap: () => void;
  /** Diameter in pixels. */
  size?: number;
  /** Smaller docked control once a scene is visible. */
  compact?: boolean;
  /** 0-100 progress shown as a circular ring during generation. */
  progress?: number | null;
  /** Short state label shown inside the orb. */
  statusLabel?: string;
  /** Shows tap-to-stop affordance during active generation. */
  canCancel?: boolean;
  /** Disables interaction (e.g. while microphone permission is being requested). */
  disabled?: boolean;
  className?: string;
}

/** Siri-like frosted glass palette: cool neutrals + state accent. */
const STATE_THEME: Record<
  SpiralOrbState,
  { accent: string; accent2: string; ring: string; glow: string }
> = {
  idle: {
    accent: 'rgba(147, 197, 253, 0.85)',
    accent2: 'rgba(56, 189, 248, 0.45)',
    ring: 'rgba(255, 255, 255, 0.35)',
    glow: 'rgba(56, 189, 248, 0.35)',
  },
  listening: {
    accent: 'rgba(196, 181, 253, 0.9)',
    accent2: 'rgba(139, 92, 246, 0.5)',
    ring: 'rgba(255, 255, 255, 0.45)',
    glow: 'rgba(139, 92, 246, 0.45)',
  },
  thinking: {
    accent: 'rgba(253, 224, 71, 0.85)',
    accent2: 'rgba(251, 191, 36, 0.5)',
    ring: 'rgba(255, 255, 255, 0.4)',
    glow: 'rgba(251, 191, 36, 0.4)',
  },
  generating: {
    accent: 'rgba(125, 211, 252, 0.92)',
    accent2: 'rgba(59, 130, 246, 0.52)',
    ring: 'rgba(186, 230, 253, 0.5)',
    glow: 'rgba(14, 165, 233, 0.5)',
  },
  suggesting: {
    accent: 'rgba(240, 171, 252, 0.9)',
    accent2: 'rgba(168, 85, 247, 0.45)',
    ring: 'rgba(255, 255, 255, 0.42)',
    glow: 'rgba(217, 70, 239, 0.42)',
  },
  speaking: {
    accent: 'rgba(110, 231, 183, 0.9)',
    accent2: 'rgba(52, 211, 153, 0.5)',
    ring: 'rgba(255, 255, 255, 0.42)',
    glow: 'rgba(45, 212, 191, 0.42)',
  },
  classLaunch: {
    accent: 'rgba(167, 243, 208, 0.92)',
    accent2: 'rgba(16, 185, 129, 0.52)',
    ring: 'rgba(209, 250, 229, 0.48)',
    glow: 'rgba(5, 150, 105, 0.46)',
  },
};

/**
 * SpiralOrb — Siri-inspired glass orb: soft core, orbiting rings, subtle inner spiral.
 */
export const SpiralOrb = ({
  state,
  onTap,
  size = 320,
  compact = false,
  progress = null,
  statusLabel,
  canCancel = false,
  disabled = false,
  className = '',
}: SpiralOrbProps) => {
  const theme = STATE_THEME[state];
  const ringRef = useRef<SVGGElement | null>(null);

  const spiralPath = useMemo(() => {
    const turns = 3.5;
    const points: string[] = [];
    const steps = 280;
    const a = 5;
    const b = 8;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns * Math.PI * 2;
      const r = a + b * t;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return points.join(' ');
  }, []);

  useEffect(() => {
    const node = ringRef.current;
    if (!node) return;
    const speeds: Record<SpiralOrbState, number> = {
      idle: 28,
      listening: 10,
      thinking: 5,
      generating: 4,
      suggesting: 16,
      speaking: 8,
      classLaunch: 6,
    };
    const direction = state === 'thinking' || state === 'classLaunch' ? -1 : 1;
    node.style.animation = `siri-ring-spin ${speeds[state]}s linear infinite`;
    node.style.animationDirection = direction === -1 ? 'reverse' : 'normal';
  }, [state]);

  const breathClass =
    state === 'idle'
      ? 'animate-siri-breathe-idle'
      : state === 'listening'
        ? 'animate-siri-breathe-listen'
        : state === 'speaking'
          ? 'animate-siri-breathe-speak'
          : state === 'generating'
            ? 'animate-siri-breathe-generate'
            : 'animate-siri-breathe-think';

  const safeProgress = typeof progress === 'number' && Number.isFinite(progress)
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : null;
  const progressCircumference = 2 * Math.PI * 136;
  const progressOffset =
    safeProgress === null
      ? progressCircumference
      : progressCircumference - (safeProgress / 100) * progressCircumference;
  const displayLabel = statusLabel || (
    state === 'listening'
      ? 'Listening'
      : state === 'thinking'
        ? 'Understanding'
        : state === 'generating'
          ? 'Creating'
          : state === 'suggesting'
            ? 'Choose'
            : state === 'classLaunch'
              ? 'Launch'
              : state === 'speaking'
                ? 'Speaking'
                : 'Tap'
  );

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={
        state === 'listening'
          ? 'Microphone on. Tap to turn it off.'
          : state === 'thinking'
            ? 'Thinking…'
            : state === 'generating'
              ? 'Generating. Tap to stop.'
            : state === 'speaking'
              ? 'Speaking. Tap to skip.'
              : state === 'suggesting'
                ? 'Suggestions ready.'
                : state === 'classLaunch'
                  ? 'Launching to class.'
                  : 'Microphone off. Tap to talk.'
      }
      className={`group relative block rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${className}`}
      style={{ width: size, height: size, background: 'transparent', border: 'none' }}
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-full border transition-opacity ${
          state === 'listening'
            ? 'border-violet-200/60 opacity-100 animate-siri-listening-ripple'
            : state === 'thinking'
              ? 'border-amber-200/60 opacity-100 animate-siri-scan-ring'
              : state === 'generating'
                ? 'border-sky-200/70 opacity-100 animate-siri-generating-ring'
                : state === 'suggesting'
                  ? 'border-fuchsia-200/60 opacity-100 animate-siri-suggestion-ring'
                  : state === 'classLaunch'
                    ? 'border-emerald-200/70 opacity-100 animate-siri-class-ring'
              : state === 'speaking'
                ? 'border-emerald-200/60 opacity-100 animate-siri-speaking-ring'
                : 'border-white/10 opacity-50'
        }`}
        aria-hidden="true"
      />

      {state === 'speaking' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-end gap-1"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="block w-1.5 rounded-full bg-emerald-100/80 animate-siri-audio-bar"
              style={{
                height: compact ? 16 + i * 4 : 22 + i * 7,
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </span>
      )}

      {state === 'listening' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-10%] rounded-full border border-violet-200/30 animate-siri-listening-ripple-delayed"
        />
      )}

      {(state === 'generating' || state === 'classLaunch') && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-7%] z-20 rounded-full"
        >
          <svg viewBox="0 0 300 300" className="h-full w-full -rotate-90">
            <circle
              cx="150"
              cy="150"
              r="136"
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="8"
            />
            <circle
              cx="150"
              cy="150"
              r="136"
              fill="none"
              stroke={state === 'classLaunch' ? 'rgba(110,231,183,0.95)' : 'rgba(125,211,252,0.95)'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={progressCircumference}
              strokeDashoffset={progressOffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
        </span>
      )}

      {/* Ambient glow */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-full ${breathClass}`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${theme.glow} 0%, rgba(0,0,0,0) 65%)`,
          filter: 'blur(32px)',
          transform: 'scale(1.15)',
        }}
      />

      {/* Glass disc + Siri-style rings */}
      <svg
        viewBox="-150 -150 300 300"
        width="100%"
        height="100%"
        className="relative z-10 select-none"
        aria-hidden="true"
      >
        <defs>
          <filter id="siriSoftBlur" x="-40" y="-40" width="100" height="100">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="siriGlass" cx="35%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor={theme.accent} stopOpacity="0.55" />
            <stop offset="70%" stopColor={theme.accent2} stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0a1628" stopOpacity="0.5" />
          </radialGradient>
          <radialGradient id="siriEdge" cx="50%" cy="50%" r="50%">
            <stop offset="78%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.22)" />
          </radialGradient>
          <linearGradient id="siriSpiral" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Orbit rings (Siri stack) */}
        <circle
          cx="0"
          cy="0"
          r="128"
          fill="none"
          stroke={theme.ring}
          strokeWidth="0.8"
          strokeOpacity="0.35"
        />
        <circle
          cx="0"
          cy="0"
          r="120"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.2"
        />
        <circle
          cx="0"
          cy="0"
          r="102"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.5"
        />

        <g ref={ringRef} style={{ transformOrigin: '0px 0px' }}>
          <path
            d={spiralPath}
            fill="none"
            stroke="url(#siriSpiral)"
            strokeWidth={state === 'thinking' ? 2.2 : 1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        </g>

        <circle cx="0" cy="0" r="64" fill="url(#siriGlass)" />
        <circle cx="0" cy="0" r="64" fill="url(#siriEdge)" />
        <circle
          cx="-18"
          cy="-22"
          r="20"
          fill="rgba(255,255,255,0.2)"
          filter="url(#siriSoftBlur)"
        />
        <circle cx="0" cy="0" r="14" fill="rgba(255,255,255,0.45)" />
      </svg>

      <span className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
        <span
          className={`mb-1 flex items-center justify-center rounded-full border border-white/20 bg-black/25 text-white shadow-lg backdrop-blur-md ${
            compact ? 'h-8 w-8' : 'h-12 w-12'
          }`}
          aria-hidden="true"
        >
          {state === 'listening' ? (
            <span className={`${compact ? 'h-4 w-2' : 'h-5 w-3'} rounded-full border-2 border-white/90 border-b-transparent`} />
          ) : canCancel ? (
            <span className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} rounded-[3px] bg-white/90`} />
          ) : (
            <span className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} rounded-full bg-white/85`} />
          )}
        </span>
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold uppercase tracking-[0.18em] text-white/85`}>
          {displayLabel}
        </span>
        {safeProgress !== null && (
          <span className={`${compact ? 'text-lg' : 'text-3xl'} font-bold leading-none text-white`}>
            {safeProgress}%
          </span>
        )}
      </span>

      <style>{`
        @keyframes siri-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes siri-breathe-idle {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes siri-breathe-listen {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes siri-breathe-think {
          0% { filter: blur(32px) hue-rotate(0deg); }
          100% { filter: blur(32px) hue-rotate(360deg); }
        }
        @keyframes siri-breathe-speak {
          0%, 100% { transform: scale(1.02); opacity: 0.95; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes siri-breathe-generate {
          0%, 100% { transform: scale(1.08); opacity: 0.88; filter: blur(32px) hue-rotate(0deg); }
          50% { transform: scale(1.18); opacity: 1; filter: blur(32px) hue-rotate(80deg); }
        }
        @keyframes siri-listening-ripple {
          0%, 100% { transform: scale(0.98); opacity: 0.65; }
          50% { transform: scale(1.16); opacity: 1; }
        }
        @keyframes siri-scan-ring {
          from { transform: rotate(0deg) scale(1.04); filter: hue-rotate(0deg); }
          to { transform: rotate(360deg) scale(1.04); filter: hue-rotate(120deg); }
        }
        @keyframes siri-speaking-ring {
          0%, 100% { transform: scale(1.02); opacity: 0.55; }
          50% { transform: scale(1.14); opacity: 1; }
        }
        @keyframes siri-audio-bar {
          0%, 100% { transform: scaleY(0.45); opacity: 0.55; }
          50% { transform: scaleY(1.15); opacity: 1; }
        }
        @keyframes siri-generating-ring {
          from { transform: rotate(0deg) scale(1.08); filter: hue-rotate(0deg); }
          to { transform: rotate(360deg) scale(1.08); filter: hue-rotate(180deg); }
        }
        @keyframes siri-suggestion-ring {
          0%, 100% { transform: scale(1.04); opacity: 0.55; }
          50% { transform: scale(1.2); opacity: 0.95; }
        }
        @keyframes siri-class-ring {
          from { transform: rotate(0deg) scale(1.08); }
          to { transform: rotate(-360deg) scale(1.08); }
        }
        .animate-siri-breathe-idle { animation: siri-breathe-idle 5s ease-in-out infinite; }
        .animate-siri-breathe-listen { animation: siri-breathe-listen 1.25s ease-in-out infinite; }
        .animate-siri-breathe-think { animation: siri-breathe-think 4s linear infinite; }
        .animate-siri-breathe-speak { animation: siri-breathe-speak 0.85s ease-in-out infinite; }
        .animate-siri-breathe-generate { animation: siri-breathe-generate 1.6s ease-in-out infinite; }
        .animate-siri-listening-ripple { animation: siri-listening-ripple 1.25s ease-in-out infinite; }
        .animate-siri-listening-ripple-delayed { animation: siri-listening-ripple 1.6s ease-in-out infinite 220ms; }
        .animate-siri-scan-ring { animation: siri-scan-ring 1.4s linear infinite; border-top-color: rgba(34, 211, 238, 0.95); }
        .animate-siri-speaking-ring { animation: siri-speaking-ring 0.9s ease-in-out infinite; }
        .animate-siri-audio-bar { animation: siri-audio-bar 0.72s ease-in-out infinite; transform-origin: bottom; }
        .animate-siri-generating-ring { animation: siri-generating-ring 1.2s linear infinite; border-top-color: rgba(125, 211, 252, 1); }
        .animate-siri-suggestion-ring { animation: siri-suggestion-ring 1.8s ease-in-out infinite; }
        .animate-siri-class-ring { animation: siri-class-ring 1.35s linear infinite; border-top-color: rgba(110, 231, 183, 1); }
      `}</style>
    </button>
  );
};

export default SpiralOrb;
