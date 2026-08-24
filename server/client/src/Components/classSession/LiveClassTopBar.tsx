/**
 * LiveClassTopBar
 * ---------------
 * Persistent, app-wide banner telling a student that their class is live.
 *
 * Two states:
 *   not joined  →  "Ms Sharma started Class 5 Science"      [Join]
 *   joined      →  "You're in Class 5 Science"  + code      [Leave]
 *
 * Joining does NOT navigate — ClassLaunchRouter owns navigation, so there is
 * exactly one place that decides where a launched lesson opens.
 *
 * This also absorbs the old ActiveSessionCodeBadge (which was fixed top-right
 * and would collide with this bar).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaCopy, FaSignOutAlt, FaBolt, FaTachometerAlt, FaStop } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useClassSession } from '../../contexts/ClassSessionContext';
import { useLiveClassSessions } from '../../hooks/useLiveClassSessions';

const HOST_ROLES = ['teacher', 'partner', 'principal', 'school', 'admin', 'superadmin'];

export const LiveClassTopBar = () => {
  const { profile } = useAuth();
  const {
    joinedSession,
    joinSession,
    leaveSessionAsStudent,
    sessionLoading,
    activeSession,
    activeSessionId,
    progressList,
    forceStudentsToLesson,
    endSession,
  } = useClassSession();
  const { sessions } = useLiveClassSessions('my-classes');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [forcing, setForcing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const isStudent = profile?.role === 'student';
  const isHost = HOST_ROLES.includes(profile?.role ?? '');

  // ---- Host bar: live session, who has joined, and the controls -------------
  if (isHost) {
    if (!activeSessionId || !activeSession || activeSession.status === 'ended') return null;

    const joinedCount = progressList.length;
    const readyCount = progressList.filter((p) => p.lesson_ready).length;
    const lessonLive = Boolean(activeSession.launched_lesson || activeSession.launched_scene);
    const dashboardPath =
      profile?.role === 'partner' ? '/dashboard/partner'
        : profile?.role === 'principal' ? '/dashboard/principal'
        : profile?.role === 'school' ? '/dashboard/school'
        : profile?.role === 'teacher' ? '/dashboard/teacher'
        : '/studio/content';

    const copyHostCode = async () => {
      try {
        await navigator.clipboard.writeText(activeSession.session_code);
        toast.success('Class code copied');
      } catch {
        toast.error('Could not copy class code');
      }
    };

    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-[60] border-b border-emerald-400/30 bg-card/95 shadow-lg backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-500">
            <FaUsers className="h-3.5 w-3.5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your class is live
            </p>
            <p className="truncate text-sm font-medium text-foreground">
              <span className="tabular-nums font-semibold">{joinedCount}</span>{' '}
              {joinedCount === 1 ? 'student has' : 'students have'} joined
              {joinedCount > 0 && (
                <span className="text-muted-foreground"> · {readyCount} ready</span>
              )}
              {lessonLive ? ' · lesson launched' : ' · no lesson launched yet'}
            </p>
          </div>

          <button
            type="button"
            onClick={copyHostCode}
            className="hidden items-center gap-2 rounded-md px-2 py-1.5 font-mono text-sm font-bold tracking-[0.18em] text-foreground transition hover:bg-muted sm:flex"
            aria-label="Copy class session code"
          >
            {activeSession.session_code}
            <FaCopy className="h-3 w-3 text-muted-foreground" />
          </button>

          <button
            type="button"
            disabled={!lessonLive || forcing}
            title={
              lessonLive
                ? 'Pull every joined student into the lesson now'
                : 'Launch a lesson first'
            }
            onClick={async () => {
              setForcing(true);
              try {
                const ok = await forceStudentsToLesson();
                toast[ok ? 'success' : 'error'](
                  ok ? 'Bringing everyone into the lesson…' : 'Could not reach the class.'
                );
              } finally {
                setForcing(false);
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <FaBolt className="h-3 w-3" />
            {forcing ? 'Bringing in…' : 'Bring everyone in'}
          </button>

          <Link
            to={dashboardPath}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <FaTachometerAlt className="h-3 w-3" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          {/* Two-step confirm, in-app.
              This used to gate on window.confirm(). A browser that suppresses dialogs —
              which every major one does once the user ticks "prevent this page from
              creating additional dialogs", and which also happens in embedded contexts —
              returns false from confirm(), so the handler returned immediately: no write,
              no toast, no error. Clicking End did nothing at all, with nothing to see in
              the console. The result is also honoured now; it used to toast success
              unconditionally, so a rejected write still read as "Class session ended." */}
          <button
            type="button"
            disabled={ending}
            title={confirmEnd ? 'Click again to end for everyone' : 'End this class session for everyone'}
            onClick={async () => {
              if (!confirmEnd) {
                setConfirmEnd(true);
                window.setTimeout(() => setConfirmEnd(false), 4000);
                return;
              }
              setConfirmEnd(false);
              setEnding(true);
              try {
                const ok = await endSession();
                toast[ok ? 'success' : 'error'](
                  ok ? 'Class session ended.' : 'Could not end the session. It is still live — see the console for why.'
                );
              } finally {
                setEnding(false);
              }
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              confirmEnd
                ? 'border-destructive bg-destructive/15 text-destructive'
                : 'border-destructive/40 text-destructive hover:bg-destructive/10'
            }`}
          >
            <FaStop className="h-3 w-3" />
            <span className="hidden sm:inline">
              {ending ? 'Ending…' : confirmEnd ? 'Confirm end?' : 'End'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (!isStudent) return null;

  const joined = joinedSession && joinedSession.status !== 'ended' ? joinedSession : null;
  // Only surface a session the student has not already joined.
  const invite = joined ? null : sessions.find((s) => s.status !== 'ended') ?? null;

  if (!joined && !invite) return null;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Class code copied');
    } catch {
      toast.error('Could not copy class code');
    }
  };

  const handleJoin = async () => {
    if (!invite) return;
    setJoiningId(invite.id);
    try {
      const ok = await joinSession(invite.session_code);
      if (ok) toast.success('Joined the class. Waiting for your teacher.');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] border-b border-teal-400/30 bg-card/95 shadow-lg backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-teal-400">
          <FaUsers className="h-3.5 w-3.5" />
        </span>

        {joined ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Joined class
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {joined.launched_lesson || joined.launched_scene
                  ? 'Lesson is live'
                  : 'Waiting for your teacher to start'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyCode(joined.session_code)}
              className="hidden items-center gap-2 rounded-md px-2 py-1.5 font-mono text-sm font-bold tracking-[0.18em] text-foreground transition hover:bg-muted sm:flex"
              aria-label="Copy class session code"
            >
              {joined.session_code}
              <FaCopy className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={leaveSessionAsStudent}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <FaSignOutAlt className="h-3 w-3" />
              Leave
            </button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Class is live
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {invite!.teacherName} started {invite!.className}
                {invite!.lessonLive ? ' — lesson in progress' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleJoin}
              disabled={sessionLoading || joiningId === invite!.id}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {joiningId === invite!.id ? 'Joining…' : 'Join'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
