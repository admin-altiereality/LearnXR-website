/**
 * In-player live class controls for teacher/partner hosts.
 * Roster, remove student, selected student 360° preview, and redirect class view.
 * Mobile: minimized FAB by default; tap to expand the full control stack.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Copy, Eye, Loader2, PanelLeftClose, PanelLeftOpen, Target, UserMinus, Users, X, Radio, ChevronRight, SkipForward, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import type { ClassSession, SessionStudentProgress, TeacherSessionView } from '../../types/lms';
import { approveJoinRequest, removeStudentFromSession, updateTeacherView } from '../../services/classSessionService';
import { StudentScreen360Preview } from '../StudentScreen360Preview';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getLessonBundle } from '../../services/firestore/getLessonBundle';
import { resolveStudentDisplayName } from '../../utils/displayName';
import { db } from '../../config/firebase';

export type HostLookat = Pick<TeacherSessionView, 'hlookat' | 'vlookat' | 'fov' | 'video_time' | 'playing'>;

export interface LiveClassHostOverlayProps {
  session: ClassSession | null;
  sessionId: string | null;
  hostUid: string | null;
  progressList: SessionStudentProgress[];
  sessionCode?: string | null;
  /** Fallback host look-at when getLiveHostView is unavailable. */
  hostView?: HostLookat | null;
  /**
   * Preferred: read live yaw/pitch/FOV (+ optional video time) from the player
   * at click time so Direct uses the current camera, not a stale React snapshot.
   */
  getLiveHostView?: () => HostLookat | null;
  /** Optional skybox override (e.g. current tour stop). Falls back to launched lesson bundle. */
  skyboxUrlOverride?: string | null;
  /** Whether Control Students mode is active (teacher controls lesson phase). */
  controlStudentsEnabled?: boolean;
  /** Current lesson phase to display when control is on. */
  currentLessonPhase?: string | null;
  /** Called when teacher toggles control students or advances the phase. */
  onBroadcastPhase?: (phase: string, controlEnabled: boolean) => void;
  /** Called when teacher ends the class session. */
  onEndSession?: () => Promise<boolean> | void;
  className?: string;
}

function useIsMobileViewport(breakpointPx = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpointPx]);
  return mobile;
}

export function LiveClassHostOverlay({
  session,
  sessionId,
  hostUid,
  progressList,
  sessionCode,
  hostView,
  getLiveHostView,
  skyboxUrlOverride,
  controlStudentsEnabled = false,
  currentLessonPhase,
  onBroadcastPhase,
  onEndSession,
  className = '',
}: LiveClassHostOverlayProps) {
  const isMobile = useIsMobileViewport();
  const [expanded, setExpanded] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 767px)').matches : true
  );
  const [activeDrawer, setActiveDrawer] = useState<null | 'roster' | 'approvals' | 'preview'>(null);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  /** Student 360° preview is opt-in — off until the host explicitly enables it. */
  const [studentViewOn, setStudentViewOn] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [approvingUid, setApprovingUid] = useState<string | null>(null);
  const [studentSkyboxUrl, setStudentSkyboxUrl] = useState<string | null>(null);
  const [classRosterCount, setClassRosterCount] = useState<number | null>(null);
  const [requestDisplayNames, setRequestDisplayNames] = useState<Record<string, string>>({});
  const [directing, setDirecting] = useState(false);

  // Keep expand default aligned with viewport changes (collapse when crossing to mobile).
  useEffect(() => {
    if (isMobile) setExpanded(false);
    else setExpanded(true);
  }, [isMobile]);

  const code = sessionCode || session?.session_code || null;
  const removedSet = useMemo(
    () => new Set(Array.isArray(session?.removed_student_uids) ? session.removed_student_uids : []),
    [session?.removed_student_uids]
  );
  const visibleProgress = useMemo(
    () => progressList.filter((s) => s?.student_uid && !removedSet.has(s.student_uid)),
    [progressList, removedSet]
  );
  const pendingJoinUids = useMemo(
    () => (Array.isArray(session?.join_requests) ? session.join_requests.filter(Boolean) : []),
    [session?.join_requests]
  );
  const pendingJoinKey = useMemo(() => [...new Set(pendingJoinUids)].sort().join(','), [pendingJoinUids]);
  const selected =
    visibleProgress.find((s) => s.student_uid === selectedStudentUid) || null;

  const resolveHostView = useCallback((): HostLookat | null => {
    const live = getLiveHostView?.() ?? null;
    if (live && Number.isFinite(live.hlookat) && Number.isFinite(live.vlookat)) return live;
    if (hostView && Number.isFinite(hostView.hlookat) && Number.isFinite(hostView.vlookat)) return hostView;
    return null;
  }, [getLiveHostView, hostView]);

  // Drop selection when the student leaves / is removed or session changes
  useEffect(() => {
    if (!selectedStudentUid) return;
    if (!visibleProgress.some((s) => s.student_uid === selectedStudentUid)) {
      setSelectedStudentUid(null);
      setStudentViewOn(false);
    }
  }, [visibleProgress, selectedStudentUid]);

  useEffect(() => {
    setSelectedStudentUid(null);
    setStudentViewOn(false);
    setActiveDrawer(null);
  }, [sessionId]);

  useEffect(() => {
    const classId = session?.class_id;
    if (!classId) {
      setClassRosterCount(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'classes', classId));
        if (cancelled) return;
        if (!snap.exists()) {
          setClassRosterCount(null);
          return;
        }
        const data = snap.data();
        setClassRosterCount(Array.isArray(data?.student_ids) ? data.student_ids.length : null);
      } catch {
        if (!cancelled) setClassRosterCount(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.class_id]);

  useEffect(() => {
    if (!pendingJoinKey) {
      setRequestDisplayNames({});
      return;
    }

    const unsubscribers: Unsubscribe[] = [...new Set(pendingJoinUids)].map((uid) =>
      onSnapshot(doc(db, 'users', uid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setRequestDisplayNames((prev) => ({
          ...prev,
          [uid]: resolveStudentDisplayName(
            {
              uid,
              name: typeof data?.name === 'string' ? data.name : null,
              displayName: typeof data?.displayName === 'string' ? data.displayName : null,
              email: typeof data?.email === 'string' ? data.email : null,
            },
            null,
            null
          ),
        }));
      })
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [pendingJoinKey, pendingJoinUids]);

  useEffect(() => {
    if (!studentViewOn && activeDrawer === 'preview') {
      setActiveDrawer(null);
    }
  }, [activeDrawer, studentViewOn]);

  useEffect(() => {
    if (skyboxUrlOverride) {
      setStudentSkyboxUrl(skyboxUrlOverride);
      return;
    }
    const launched = session?.launched_lesson;
    if (!launched) {
      setStudentSkyboxUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const bundle = await getLessonBundle({
          chapterId: launched.chapter_id,
          topicId: launched.topic_id,
          lang: 'en',
          source: launched.lesson_type === 'user_generated' ? 'user_generated' : 'curriculum',
        });
        const topic =
          bundle.chapter?.topics?.find((item: { topic_id?: string }) => item.topic_id === launched.topic_id) ||
          bundle.chapter?.topics?.[0];
        const url =
          (bundle.skybox as { imageUrl?: string; file_url?: string } | null)?.imageUrl ||
          (bundle.skybox as { imageUrl?: string; file_url?: string } | null)?.file_url ||
          topic?.skybox_url ||
          null;
        if (!cancelled) setStudentSkyboxUrl(url);
      } catch {
        if (!cancelled) setStudentSkyboxUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.launched_lesson, skyboxUrlOverride]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Class code copied');
    } catch {
      toast.error('Could not copy class code');
    }
  }, [code]);

  const handleRemove = useCallback(
    async (studentUid: string) => {
      if (!sessionId || !hostUid) return;
      setRemovingUid(studentUid);
      try {
        const ok = await removeStudentFromSession(sessionId, hostUid, studentUid);
        if (ok) {
          toast.success('Student removed from the class');
          if (selectedStudentUid === studentUid) setSelectedStudentUid(null);
        } else {
          toast.error('Could not remove student');
        }
      } finally {
        setRemovingUid(null);
      }
    },
    [sessionId, hostUid, selectedStudentUid]
  );

  const handleApprove = useCallback(
    async (studentUid: string) => {
      if (!sessionId) return;
      setApprovingUid(studentUid);
      try {
        const ok = await approveJoinRequest(sessionId, studentUid);
        if (ok) toast.success('Student approved to rejoin');
        else toast.error('Could not approve student');
      } finally {
        setApprovingUid(null);
      }
    },
    [sessionId]
  );

  const redirectClassToHostView = useCallback(async () => {
    if (!sessionId || !hostUid) {
      toast.info('No active class session.');
      return;
    }
    // Prefer a fresh live read at click time (not a stale React snapshot).
    const view = resolveHostView();
    if (!view) {
      toast.info('Look around first, then redirect the class to your view.');
      return;
    }
    setDirecting(true);
    try {
      const syncId = Date.now();
      const ok = await updateTeacherView(sessionId, hostUid, {
        hlookat: view.hlookat,
        vlookat: view.vlookat,
        fov: view.fov ?? 90,
        force: true,
        sync_id: syncId,
        ...(typeof view.video_time === 'number' && Number.isFinite(view.video_time)
          ? { video_time: view.video_time }
          : {}),
        ...(typeof view.playing === 'boolean' ? { playing: view.playing } : {}),
      });
      if (ok) toast.success('Class view updated to match yours');
      else toast.error('Could not update class view');
    } catch {
      toast.error('Could not update class view');
    } finally {
      setDirecting(false);
    }
  }, [sessionId, hostUid, resolveHostView]);

  const redirectClassToStudentView = useCallback(async () => {
    if (!sessionId || !hostUid || !selected?.student_view) {
      toast.info('Select a student who is looking around first.');
      return;
    }
    setDirecting(true);
    try {
      const ok = await updateTeacherView(sessionId, hostUid, {
        hlookat: selected.student_view.hlookat,
        vlookat: selected.student_view.vlookat,
        fov: selected.student_view.fov ?? 90,
        force: true,
        sync_id: Date.now(),
      });
      const name = resolveStudentDisplayName(null, null, {
        uid: selected.student_uid,
        displayName: selected.display_name,
        email: selected.email,
      });
      if (ok) toast.success(`Class redirected to ${name}'s view`);
      else toast.error('Could not update class view');
    } catch {
      toast.error('Could not update class view');
    } finally {
      setDirecting(false);
    }
  }, [sessionId, hostUid, selected]);

  const studentName = useMemo(() => {
    if (!selected) return 'Student';
    return resolveStudentDisplayName(null, null, {
      uid: selected.student_uid,
      displayName: selected.display_name,
      email: selected.email,
    });
  }, [selected]);

  if ((!sessionId && !code) || session?.status === 'ended') return null;

  const canDirect = Boolean(resolveHostView());
  const studentCount = visibleProgress.length;
  const pendingCount = pendingJoinUids.length;
  const selectedCanPreview = Boolean(selected?.student_view && studentSkyboxUrl);
  const drawerTitle =
    activeDrawer === 'roster' ? 'Students' : activeDrawer === 'approvals' ? 'Pending approvals' : 'Student preview';
  const phaseButtons = [
    { phase: 'intro', label: 'Intro' },
    { phase: 'explanation', label: 'Learn' },
    { phase: 'outro', label: 'Summary' },
    { phase: 'quiz', label: 'Quiz' },
  ];

  return (
    <div className={`pointer-events-none absolute inset-0 z-50 text-white ${className}`}>
      <div className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-1.5 rounded-2xl border border-white/12 bg-zinc-950/80 px-2 py-2 shadow-[0_14px_45px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:left-[13.5rem] sm:gap-2 sm:px-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/70 transition hover:bg-white/12 hover:text-white"
          aria-label={expanded ? 'Hide teacher controls' : 'Show teacher controls'}
        >
          {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {code ? (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5"
              aria-label="Copy class code"
            >
              <span className="min-w-0">
                <span className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:block">Class code</span>
                <span className="block truncate font-mono text-xs font-bold tracking-[0.18em] sm:text-sm">{code}</span>
              </span>
              <Copy className="h-3.5 w-3.5 shrink-0 text-white/45" />
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-teal-300" />
              Live class
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-teal-400/15 px-2 py-1 text-[10px] font-semibold text-teal-100 sm:px-2.5 sm:text-[11px]">
            Live: {studentCount}
          </span>
          <span className="rounded-full bg-cyan-400/15 px-2 py-1 text-[10px] font-semibold text-cyan-100 sm:px-2.5 sm:text-[11px]">
            Class: {classRosterCount ?? '-'}
          </span>
          <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-semibold min-[430px]:inline-flex ${pendingCount ? 'bg-amber-400/20 text-amber-100' : 'bg-white/8 text-white/55'}`}>
            Pending: {pendingCount}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveDrawer((v) => (v === 'approvals' ? null : 'approvals'))}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${activeDrawer === 'approvals' ? 'bg-amber-400/20 text-amber-100' : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white'}`}
          aria-label="Open pending approvals"
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-300 px-1 text-[9px] font-bold text-zinc-950">
              {pendingCount}
            </span>
          )}
        </button>
        {onEndSession && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to end this class session? All students will be exited.')) {
                void onEndSession();
              }
            }}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-2.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/25 sm:px-3"
            aria-label="End class session"
          >
            <X className="h-3.5 w-3.5 text-red-300" />
            <span className="hidden sm:inline">End Session</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className="pointer-events-auto absolute bottom-[max(0.85rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] flex gap-2 rounded-2xl border border-white/12 bg-zinc-950/82 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:bottom-auto sm:right-auto sm:top-[max(5.25rem,calc(env(safe-area-inset-top)+5.25rem))] sm:w-72 sm:flex-col sm:p-2.5">
          <div className="hidden grid-cols-2 gap-2 sm:grid">
            <div className="rounded-xl bg-white/8 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">Live</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-teal-100">{studentCount}</p>
            </div>
            <div className="rounded-xl bg-white/8 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">Class</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-100">{classRosterCount ?? '-'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !controlStudentsEnabled;
              onBroadcastPhase?.(currentLessonPhase || 'intro', next);
            }}
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-semibold transition sm:h-auto sm:flex-none sm:px-3 sm:py-3 sm:text-xs ${
              controlStudentsEnabled
                ? 'border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                : 'border-violet-500/35 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30'
            }`}
            title={controlStudentsEnabled ? 'Control Students is on' : 'Control Students is off'}
          >
            <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse" />
            <span className="hidden sm:inline">{controlStudentsEnabled ? 'Control Students: ON' : 'Control Students: OFF'}</span>
            <span className="sm:hidden">Control</span>
          </button>

          {controlStudentsEnabled && (
            <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-2 sm:block">
              <div className="mb-2 grid grid-cols-4 gap-1">
                {phaseButtons.map((item) => {
                  const active = currentLessonPhase === item.phase;
                  return (
                    <button
                      key={item.phase}
                      type="button"
                      title={`Send students to ${item.label}`}
                      onClick={() => onBroadcastPhase?.(item.phase, true)}
                      className={`rounded-lg border px-1.5 py-1.5 text-[10px] font-semibold transition ${
                        active
                          ? 'border-teal-300/50 bg-teal-400/20 text-teal-100'
                          : 'border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  title="Replay current phase"
                  onClick={() => onBroadcastPhase?.(currentLessonPhase || 'intro', true)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-1.5 py-1.5 text-[10px] font-semibold text-violet-300 transition hover:bg-violet-500/20"
                >
                  <RotateCcw className="h-3 w-3" />
                  Replay
                </button>
                <button
                  type="button"
                  title="Advance to next phase"
                  onClick={() => {
                    const phases = ['intro', 'explanation', 'outro', 'quiz'];
                    const idx = phases.indexOf(currentLessonPhase || 'intro');
                    const next = phases[Math.min(idx + 1, phases.length - 1)];
                    onBroadcastPhase?.(next, true);
                  }}
                  className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-1.5 py-1.5 text-[10px] font-semibold text-teal-300 transition hover:bg-teal-500/20"
                >
                  <ChevronRight className="h-3 w-3" />
                  Next
                </button>
                <button
                  type="button"
                  title="Skip all students to quiz"
                  onClick={() => onBroadcastPhase?.('quiz', true)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-1.5 py-1.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  <SkipForward className="h-3 w-3" />
                  Quiz
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={directing || !canDirect}
            onClick={() => void redirectClassToHostView()}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-2 text-[11px] font-semibold text-white/85 transition hover:bg-white/10 hover:text-white disabled:opacity-40 sm:h-auto sm:flex-none sm:px-3 sm:py-3 sm:text-xs"
          >
            {directing ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-400" /> : <Target className="h-3.5 w-3.5 shrink-0 text-teal-400" />}
            <span className="hidden sm:inline">Direct class to my view</span>
            <span className="sm:hidden">Direct</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawer((v) => (v === 'roster' ? null : 'roster'))}
            className={`relative inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-semibold transition sm:h-auto sm:flex-none sm:px-3 sm:py-3 sm:text-xs ${
              activeDrawer === 'roster' ? 'border-teal-300/45 bg-teal-400/18 text-teal-100' : 'border-white/12 bg-white/[0.06] text-white/85 hover:bg-white/10'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Roster</span>
            <span className="sm:hidden">Students</span>
            {studentCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-300 px-1 text-[9px] font-bold text-zinc-950">
                {studentCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveDrawer((v) => (v === 'approvals' ? null : 'approvals'))}
            className={`relative inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-semibold transition sm:h-auto sm:flex-none sm:px-3 sm:py-3 sm:text-xs ${
              activeDrawer === 'approvals' ? 'border-amber-300/45 bg-amber-400/18 text-amber-100' : 'border-white/12 bg-white/[0.06] text-white/85 hover:bg-white/10'
            }`}
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Approvals</span>
            <span className="sm:hidden">Approve</span>
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-300 px-1 text-[9px] font-bold text-zinc-950">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={!selectedCanPreview}
            onClick={() => {
              if (!selectedCanPreview) return;
              setStudentViewOn((on) => {
                const next = !on;
                setActiveDrawer(next ? 'preview' : null);
                return next;
              });
            }}
            className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-2 text-[11px] font-semibold transition disabled:opacity-40 sm:h-auto sm:flex-none sm:px-3 sm:py-3 sm:text-xs ${
              studentViewOn && activeDrawer === 'preview' ? 'border-cyan-300/45 bg-cyan-400/18 text-cyan-100' : 'border-white/12 bg-white/[0.06] text-white/85 hover:bg-white/10'
            }`}
            title={selectedCanPreview ? 'Toggle selected student preview' : 'Select a student with an active view first'}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{studentViewOn ? 'Preview on' : 'Preview off'}</span>
            <span className="sm:hidden">Preview</span>
          </button>

          <button
            type="button"
            disabled={directing || !selected?.student_view || !studentViewOn}
            onClick={() => void redirectClassToStudentView()}
            className="hidden items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-40 sm:inline-flex"
          >
            <Eye className="h-3.5 w-3.5" />
            Match selected student
          </button>
        </div>
      )}

      {activeDrawer && (
        <div className="pointer-events-auto absolute bottom-[max(4.95rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] max-h-[min(62vh,34rem)] overflow-hidden rounded-2xl border border-white/12 bg-zinc-950/90 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:bottom-auto sm:left-auto sm:right-4 sm:top-[max(5.25rem,calc(env(safe-area-inset-top)+5.25rem))] sm:w-[min(25rem,calc(100vw-22rem))] sm:max-h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{drawerTitle}</p>
              <p className="text-[10px] text-white/45">
                {activeDrawer === 'roster'
                  ? `${studentCount} active student${studentCount === 1 ? '' : 's'}`
                  : activeDrawer === 'approvals'
                    ? `${pendingCount} pending request${pendingCount === 1 ? '' : 's'}`
                    : studentName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeDrawer === 'preview') setStudentViewOn(false);
                setActiveDrawer(null);
              }}
              className="rounded-lg p-1.5 text-white/65 transition hover:bg-white/10 hover:text-white"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeDrawer === 'roster' && (
            <div className="max-h-[calc(min(62vh,34rem)-3.5rem)] overflow-y-auto p-3 sm:max-h-[calc(100vh-10.5rem)]">
              {visibleProgress.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-[11px] leading-relaxed text-white/55">
                  No students yet. Share the class code to let them join.
                </p>
              ) : (
                <div className="grid gap-2">
                  {visibleProgress.map((student) => {
                    const name = resolveStudentDisplayName(null, null, {
                      uid: student.student_uid,
                      displayName: student.display_name,
                      email: student.email,
                    });
                    const active = selected?.student_uid === student.student_uid;
                    return (
                      <div
                        key={student.student_uid}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                          active ? 'border-teal-400/40 bg-teal-400/10' : 'border-white/10 bg-white/[0.04]'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setSelectedStudentUid(student.student_uid);
                            if (studentViewOn && student.student_view) setActiveDrawer('preview');
                          }}
                        >
                          <p className="truncate text-xs font-medium">{name}</p>
                          <p className="text-[10px] capitalize text-white/45">{student.phase || 'connected'}</p>
                        </button>
                        <button
                          type="button"
                          title="Preview student view"
                          disabled={!student.student_view}
                          onClick={() => {
                            setSelectedStudentUid(student.student_uid);
                            if (student.student_view) {
                              setStudentViewOn(true);
                              setActiveDrawer('preview');
                            }
                          }}
                          className="rounded-lg p-1.5 text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-35"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Remove student"
                          disabled={removingUid === student.student_uid}
                          onClick={() => void handleRemove(student.student_uid)}
                          className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                        >
                          {removingUid === student.student_uid ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeDrawer === 'approvals' && (
            <div className="max-h-[calc(min(62vh,34rem)-3.5rem)] overflow-y-auto p-3 sm:max-h-[calc(100vh-10.5rem)]">
              {pendingJoinUids.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-[11px] leading-relaxed text-white/55">
                  No pending lobby approvals.
                </p>
              ) : (
                <div className="grid gap-2">
                  {pendingJoinUids.map((uid) => {
                    const progress = progressList.find((item) => item.student_uid === uid);
                    const name =
                      requestDisplayNames[uid] ??
                      resolveStudentDisplayName(null, null, {
                        uid,
                        displayName: progress?.display_name,
                        email: progress?.email,
                      });
                    return (
                      <div key={uid} className="flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-400/8 px-3 py-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">{name}</p>
                          <p className="text-[10px] text-white/45">Waiting in lobby</p>
                        </div>
                        <button
                          type="button"
                          disabled={approvingUid === uid}
                          onClick={() => void handleApprove(uid)}
                          className="inline-flex items-center justify-center rounded-lg bg-amber-300 px-3 py-1.5 text-[11px] font-bold text-zinc-950 transition hover:bg-amber-200 disabled:opacity-55"
                        >
                          {approvingUid === uid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeDrawer === 'preview' && studentViewOn && selected?.student_view && studentSkyboxUrl && (
            <div className="p-3">
              <StudentScreen360Preview
                skyboxUrl={studentSkyboxUrl}
                view={selected.student_view}
                studentName={studentName}
                phaseLabel={String(selected.phase || 'Connected')}
                getApiBaseUrl={getApiBaseUrl}
                className="aspect-video w-full overflow-hidden rounded-xl border border-white/10"
              />
              <button
                type="button"
                disabled={directing}
                onClick={() => void redirectClassToStudentView()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-40"
              >
                {directing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" /> : <Eye className="h-3.5 w-3.5" />}
                Match selected student
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
