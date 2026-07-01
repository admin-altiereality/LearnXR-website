interface SpiralSessionBannerProps {
  activeSession: { id?: string; session_code?: string } | null;
  joinedSession: { session_id?: string; id?: string; session_code?: string } | null;
  teacherJoinCode?: string | null;
  studentCount?: number;
  isTeacher: boolean;
  onEndSession: () => Promise<void>;
  onLeaveSession: () => void;
}

/**
 * Thin session strip when a Spiral class voice session is active.
 * Join code is shown large for teachers so students can read it at a glance.
 */
export const SpiralSessionBanner = ({
  activeSession,
  joinedSession,
  teacherJoinCode,
  studentCount,
  isTeacher,
  onEndSession,
  onLeaveSession,
}: SpiralSessionBannerProps) => {
  const activeId = activeSession?.id ?? null;
  const joinedId = joinedSession?.session_id ?? joinedSession?.id ?? null;

  if (!activeId && !joinedId) return null;

  const teacherCode =
    isTeacher && teacherJoinCode ? teacherJoinCode : isTeacher ? activeSession?.session_code : undefined;
  const studentCode = !isTeacher && joinedSession?.session_code ? joinedSession.session_code : undefined;
  const displayCode = teacherCode || studentCode;

  const secondaryLine = (() => {
    if (typeof studentCount === 'number') return `${studentCount} in scene`;
    if (!displayCode && !isTeacher) return joinedId ?? '';
    if (!displayCode && isTeacher) return activeSession?.session_code ?? activeId ?? '';
    return '';
  })();

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-[25] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 text-sm text-white/90 shadow-xl backdrop-blur-xl">
      {displayCode ? (
        <div className="flex flex-col items-center gap-0.5 border-b border-white/10 pb-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/85">
            Join code
          </p>
          <p className="font-mono text-2xl font-bold tracking-[0.35em] text-white sm:text-3xl">{displayCode}</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{isTeacher ? 'Class session active' : 'Joined class'}</p>
          {secondaryLine ? <p className="truncate text-xs text-white/60">{secondaryLine}</p> : null}
        </div>
        {isTeacher ? (
          <button
            type="button"
            onClick={() => void onEndSession()}
            className="shrink-0 rounded-full bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-400"
          >
            End session
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeaveSession}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/25"
          >
            Leave
          </button>
        )}
      </div>
    </div>
  );
};
