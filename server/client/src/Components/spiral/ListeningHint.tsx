import { useEffect, useState } from 'react';
import { learnXRFontStyle } from '../LearnXRTypography';
import type { SpiralOrbState } from './SpiralOrb';

interface ListeningHintProps {
  state: SpiralOrbState;
  /** Optional override (e.g. live transcript while listening). */
  liveText?: string;
  compact?: boolean;
  className?: string;
}

const PHRASES: Record<SpiralOrbState, string[]> = {
  idle: ['Tap the orb to talk', 'Ask me anything!', 'I can show you a magical world'],
  listening: ['I am listening…', 'Tell me!', 'Go on, I hear you'],
  thinking: ['Thinking…', 'One moment, please', 'Looking that up for you'],
  generating: ['Creating now…', 'Tap the orb to stop', 'Making it for you'],
  suggesting: ['Pick one to play', 'Say play first one', 'Or keep creating'],
  speaking: ['Here you go!', 'Watch and listen', 'Enjoy your adventure'],
  classLaunch: ['Launching to class…', 'Getting students ready', 'Starting class content'],
};

const ROTATE_INTERVAL_MS = 2400;

export const ListeningHint = ({ state, liveText, compact = false, className = '' }: ListeningHintProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % PHRASES[state].length);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [state]);

  const showLive = state === 'listening' && liveText && liveText.trim().length > 0;
  const text = showLive ? liveText : PHRASES[state][index];

  return (
    <div
      className={`pointer-events-none select-none text-center text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)] ${className}`}
      role="status"
      aria-live="polite"
    >
      <p
        key={`${state}-${index}-${showLive ? 'live' : 'phrase'}`}
        className={`font-medium tracking-tight text-white/95 ${
          compact ? 'text-lg md:text-2xl' : 'text-3xl md:text-5xl'
        }`}
        style={{
          ...learnXRFontStyle,
          letterSpacing: '0.02em',
          animation: 'spiral-hint-fade 0.45s ease-out',
        }}
      >
        {text}
      </p>
      <style>{`
        @keyframes spiral-hint-fade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ListeningHint;
