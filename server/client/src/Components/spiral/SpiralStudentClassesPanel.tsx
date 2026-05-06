import { useEffect, useState } from 'react';

import { Input } from '../ui/input';

const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

function isValidSessionCodeFormat(raw: string): boolean {
  return SESSION_CODE_REGEX.test(raw.trim().toUpperCase());
}

function sanitizeSessionCodeChunk(raw: string): string {
  const upper = raw.toUpperCase();
  let out = '';
  for (let i = 0; i < upper.length && out.length < 6; i += 1) {
    const c = upper[i];
    if (SESSION_CODE_ALPHABET.includes(c)) out += c;
  }
  return out;
}

interface SpiralStudentClassesPanelProps {
  sessionLoading: boolean;
  joinedSessionId: string | null;
  sessionError: string | null;
  clearSessionError: () => void;
  onJoinWithCode: (code: string) => void | Promise<boolean>;
}

/**
 * Enter a teacher's live class session on Spiral via session code — same contract as Dashboard / Lessons.
 */
export const SpiralStudentClassesPanel = ({
  sessionLoading,
  joinedSessionId,
  sessionError,
  clearSessionError,
  onJoinWithCode,
}: SpiralStudentClassesPanelProps) => {
  const [code, setCode] = useState('');

  useEffect(() => {
    clearSessionError();
  }, [code, clearSessionError]);

  const normalized = sanitizeSessionCodeChunk(code.trim());

  const handleJoin = () => {
    if (!isValidSessionCodeFormat(normalized)) return;
    void onJoinWithCode(normalized);
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-24 z-[24] w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/12 bg-slate-950/85 p-3 text-xs text-white/85 shadow-xl backdrop-blur-xl md:right-6">
      <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-white/55">Join class</p>
      <p className="mb-3 text-[11px] leading-snug text-white/50">
        Ask your teacher for the <strong className="font-semibold text-white/70">6-character</strong> session code,
        then enter it below (letters A–Z and digits; no 0, O, 1, or I).
      </p>
      <label className="sr-only" htmlFor="spiral-session-code">
        Session code
      </label>
      <Input
        id="spiral-session-code"
        value={code}
        onChange={(e) => setCode(sanitizeSessionCodeChunk(e.target.value))}
        placeholder="______"
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        className="mb-2 border-white/15 bg-slate-950/95 font-mono text-sm uppercase tracking-[0.35em] text-white placeholder:text-white/25 placeholder:tracking-[0.35em]"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleJoin();
        }}
      />
      {normalized.length > 0 && normalized.length < 6 ? (
        <p className="mb-2 text-[11px] text-white/45">Enter all 6 characters.</p>
      ) : null}
      {sessionError ? (
        <p className="mb-2 text-[11px] text-red-200/95" role="alert">
          {sessionError}
        </p>
      ) : null}
      <button
        type="button"
        disabled={sessionLoading || !isValidSessionCodeFormat(normalized)}
        onClick={handleJoin}
        className="flex w-full items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-600/85 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sessionLoading ? 'Joining…' : 'Join session'}
      </button>
      {joinedSessionId ? (
        <p className="mt-2 text-center text-[10px] text-emerald-200/90">Joined class session ✓</p>
      ) : null}
    </div>
  );
};
