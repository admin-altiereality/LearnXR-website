import { useRef } from 'react';
import type { SpiralOrbState } from './SpiralOrb';

export interface SpiralControlsProps {
  orbState: SpiralOrbState;
  isMuted: boolean;
  micSupported: boolean;
  /** True while a generation flow is active (skybox or 3D). */
  isGenerating: boolean;
  /** Caller decides whether reset makes sense (e.g. there is something to clear). */
  canReset: boolean;
  onToggleMic: () => void;
  onStopGeneration: () => void;
  onToggleMute: () => void;
  onReset: () => void;
}

/**
 * Floating control bar for the Spiral page. Visible at all times so students
 * (or any user) can clearly see how to start/stop the mic, halt generation,
 * silence the assistant, or wipe the conversation back to a clean slate.
 *
 * Why this exists separately from the orb: the orb itself is a tap target,
 * but enterprise UX requires explicit, labelled buttons for every action.
 */
export const SpiralControls = ({
  orbState,
  isMuted,
  micSupported,
  isGenerating,
  canReset,
  onToggleMic,
  onStopGeneration,
  onToggleMute,
  onReset,
}: SpiralControlsProps) => {
  const micActive = orbState === 'listening';
  const moreMenuRef = useRef<HTMLDetailsElement>(null);

  return (
    <div
      role="toolbar"
      aria-label="Spiral controls"
      className="pointer-events-auto absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-white shadow-2xl backdrop-blur-2xl md:bottom-8"
    >
      <ControlButton
        label={micActive ? 'Stop microphone' : 'Start microphone'}
        active={micActive}
        accent="violet"
        disabled={!micSupported}
        onClick={onToggleMic}
      >
        {micActive ? <MicOnIcon /> : <MicOffIcon />}
      </ControlButton>

      <ControlButton
        label="Stop generation"
        accent="sky"
        disabled={!isGenerating}
        onClick={onStopGeneration}
      >
        <StopIcon />
      </ControlButton>

      <ControlButton
        label={isMuted ? 'Unmute assistant' : 'Mute assistant'}
        active={isMuted}
        accent="emerald"
        onClick={onToggleMute}
      >
        {isMuted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
      </ControlButton>

      {canReset ? (
        <details ref={moreMenuRef} className="relative group">
          <summary
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/85 transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300/40 [&::-webkit-details-marker]:hidden"
            aria-label="More actions"
          >
            <DotsHorizontalIcon />
          </summary>
          <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-40 min-w-[11rem] -translate-x-1/2 rounded-2xl border border-white/12 bg-slate-950/95 py-2 shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-rose-100 transition hover:bg-rose-500/15"
              onClick={() => {
                onReset();
                moreMenuRef.current?.removeAttribute('open');
              }}
            >
              <ResetIcon />
              <span>Reset</span>
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
};

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  accent: 'violet' | 'sky' | 'emerald' | 'rose';
}

const ACCENT_STYLES: Record<ControlButtonProps['accent'], { active: string; idle: string; ring: string }> = {
  violet: {
    active: 'bg-violet-500/30 text-violet-50 border-violet-200/40',
    idle: 'bg-white/5 text-white/85 hover:bg-white/10 border-white/10',
    ring: 'focus-visible:ring-violet-300/40',
  },
  sky: {
    active: 'bg-sky-500/25 text-sky-50 border-sky-200/40',
    idle: 'bg-white/5 text-white/85 hover:bg-white/10 border-white/10',
    ring: 'focus-visible:ring-sky-300/40',
  },
  emerald: {
    active: 'bg-emerald-500/25 text-emerald-50 border-emerald-200/40',
    idle: 'bg-white/5 text-white/85 hover:bg-white/10 border-white/10',
    ring: 'focus-visible:ring-emerald-300/40',
  },
  rose: {
    active: 'bg-rose-500/25 text-rose-50 border-rose-200/40',
    idle: 'bg-white/5 text-white/85 hover:bg-white/10 border-white/10',
    ring: 'focus-visible:ring-rose-300/40',
  },
};

const ControlButton = ({ label, onClick, children, active, disabled, accent }: ControlButtonProps) => {
  const style = ACCENT_STYLES[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active ?? undefined}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-4 ${style.ring} disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? style.active : style.idle
      }`}
    >
      {children}
    </button>
  );
};

const MicOnIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11Z" />
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M19 11h-1.7a5.97 5.97 0 0 1-.7 2.36l1.45 1.45A8 8 0 0 0 19 11Zm-7-7a3 3 0 0 0-3 3v.18l5.99 5.99c.01-.06.01-.11.01-.17V7a3 3 0 0 0-3-3Zm-9 .27 4.18 4.18A3 3 0 0 0 7 7v4a5 5 0 0 0 5 5c.4 0 .79-.05 1.16-.13l1.55 1.55A6.85 6.85 0 0 1 12 18a7 7 0 0 1-7-6.92V11H3a8.96 8.96 0 0 0 4.51 7.69l-3.24 3.25 1.41 1.41L20.49 6.78l-1.41-1.41L3 4.27Z" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12Zm-2.5-7.7v2.06A6.5 6.5 0 0 1 18.5 12a6.5 6.5 0 0 1-4.5 5.64v2.06a8.5 8.5 0 0 0 0-15.4Z" />
  </svg>
);

const SpeakerMutedIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M3 9v6h4l5 5V4L7 9H3Zm14.59 6L19 16.41 21.59 19l1.41-1.41L20.41 15 23 12.41 21.59 11 19 13.59 16.41 11 15 12.41 17.59 15Z" />
  </svg>
);

const DotsHorizontalIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
  </svg>
);

const ResetIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
    <path d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6 0 2.97-2.16 5.43-5 5.91v2.02A8 8 0 0 0 20 13c0-4.42-3.58-8-8-8Zm-6.32 2.78L4.27 6.36A8 8 0 0 0 11 20.93v-2.02A6 6 0 0 1 5.68 7.78Z" />
  </svg>
);

export default SpiralControls;
