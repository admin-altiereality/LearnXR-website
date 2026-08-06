/**
 * In-player live class controls for teacher/partner hosts.
 * Roster, remove student, selected student 360° preview, and redirect class view.
 * Mobile: minimized FAB by default; tap to expand the full control stack.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Loader2, Target, UserMinus, Users, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'react-toastify';
import type { ClassSession, SessionStudentProgress, TeacherSessionView } from '../../types/lms';
import { removeStudentFromSession, updateTeacherView } from '../../services/classSessionService';
import { StudentScreen360Preview } from '../StudentScreen360Preview';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getLessonBundle } from '../../services/firestore/getLessonBundle';

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
  className = '',
}: LiveClassHostOverlayProps) {
  const isMobile = useIsMobileViewport();
  const [expanded, setExpanded] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 767px)').matches : true
  );
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  /** Student 360° preview is opt-in — off until the host explicitly enables it. */
  const [studentViewOn, setStudentViewOn] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [studentSkyboxUrl, setStudentSkyboxUrl] = useState<string | null>(null);
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
  }, [sessionId]);

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
      if (ok) toast.success(`Class redirected to ${selected.display_name || 'student'}'s view`);
      else toast.error('Could not update class view');
    } catch {
      toast.error('Could not update class view');
    } finally {
      setDirecting(false);
    }
  }, [sessionId, hostUid, selected]);

  const studentName = useMemo(() => {
    if (!selected) return 'Student';
    return selected.display_name || selected.email || `Student ${selected.student_uid.slice(0, 6)}`;
  }, [selected]);

  if ((!sessionId && !code) || session?.status === 'ended') return null;

  const canDirect = Boolean(resolveHostView());

  // Mobile minimized: left-bottom FAB — stays clear of right-bottom player controls / host tip
  if (isMobile && !expanded) {
    return (
      <div
        className={`pointer-events-auto absolute z-50 ${
          className || 'left-[max(0.75rem,env(safe-area-inset-left))] bottom-[max(5.5rem,env(safe-area-inset-bottom))]'
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-zinc-950/80 px-3 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-zinc-950/90 active:scale-[0.98]"
          aria-label="Open live class controls"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-teal-200 ring-1 ring-teal-400/30">
            <Users className="h-4 w-4" />
            {visibleProgress.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-400 px-1 text-[9px] font-bold text-zinc-950">
                {visibleProgress.length}
              </span>
            )}
          </span>
          <span className="pr-0.5 text-left leading-tight">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Live class
            </span>
            <span className="block font-mono text-[13px] font-bold tracking-[0.16em]">{code || '—'}</span>
          </span>
          <ChevronUp className="h-4 w-4 text-white/40" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-auto absolute z-50 ${
        isMobile
          ? 'inset-x-3 bottom-[max(4.5rem,env(safe-area-inset-bottom))] top-auto max-h-[min(72vh,34rem)]'
          : 'left-4 top-16 w-[min(22rem,calc(100vw-2rem))] sm:top-[4.75rem]'
      } ${className}`}
    >
      <div className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border border-white/12 bg-zinc-950/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5">
          {code ? (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/5"
              aria-label="Copy class code"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                <Users className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Class code
                </span>
                <span className="block truncate font-mono text-sm font-bold tracking-[0.18em]">{code}</span>
              </span>
              <Copy className="h-3.5 w-3.5 shrink-0 text-white/50" />
            </button>
          ) : (
            <div className="flex flex-1 items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-teal-300" />
              Live class
            </div>
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tabular-nums text-white/75">
            {visibleProgress.length}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md p-1.5 text-white/65 transition hover:bg-white/10 hover:text-white"
            aria-label={expanded ? 'Collapse class controls' : 'Expand class controls'}
          >
            {isMobile ? <X className="h-4 w-4" /> : expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {expanded && (
          <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-3">
            <div className="grid gap-2">
              <button
                type="button"
                disabled={directing || !canDirect}
                onClick={() => void redirectClassToHostView()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal-500/35 bg-teal-500/20 px-3 py-3 text-xs font-semibold text-teal-50 transition hover:bg-teal-500/30 disabled:opacity-40"
              >
                {directing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                Direct class to my view
              </button>
              <button
                type="button"
                disabled={directing || !selected?.student_view || !studentViewOn}
                onClick={() => void redirectClassToStudentView()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-40"
              >
                <Eye className="h-3.5 w-3.5" />
                Match selected student
              </button>
            </div>

            {visibleProgress.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-[11px] leading-relaxed text-white/55">
                No students yet. Share the class code to let them join.
              </p>
            ) : (
              <div className="grid gap-2.5">
                <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
                  {visibleProgress.map((student) => {
                    const name =
                      student.display_name || student.email || `Student ${student.student_uid.slice(0, 6)}`;
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
                          onClick={() => setSelectedStudentUid(student.student_uid)}
                        >
                          <p className="truncate text-xs font-medium">{name}</p>
                          <p className="text-[10px] capitalize text-white/45">{student.phase || 'connected'}</p>
                        </button>
                        <button
                          type="button"
                          title={studentViewOn && active ? 'Hide student view' : 'Preview student view'}
                          onClick={() => {
                            setSelectedStudentUid(student.student_uid);
                            setStudentViewOn((on) => (active && on ? false : true));
                          }}
                          className={`rounded-lg p-1.5 hover:bg-white/10 ${
                            studentViewOn && active ? 'text-teal-300' : 'text-white/65 hover:text-white'
                          }`}
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

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                      Student view
                    </p>
                    <button
                      type="button"
                      onClick={() => setStudentViewOn((v) => !v)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                        studentViewOn
                          ? 'bg-teal-400/20 text-teal-200'
                          : 'bg-white/10 text-white/55 hover:bg-white/15'
                      }`}
                      aria-pressed={studentViewOn}
                    >
                      {studentViewOn ? 'On' : 'Off'}
                    </button>
                  </div>
                  {!studentViewOn ? (
                    <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/15 px-3 text-center text-[11px] text-white/50">
                      Student view is off. Select a student and turn it on to inspect their 360° view.
                    </div>
                  ) : selected?.student_view && studentSkyboxUrl ? (
                    <StudentScreen360Preview
                      skyboxUrl={studentSkyboxUrl}
                      view={selected.student_view}
                      studentName={studentName}
                      phaseLabel={String(selected.phase || 'Connected')}
                      getApiBaseUrl={getApiBaseUrl}
                      className="aspect-video w-full overflow-hidden rounded-xl border border-white/10"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-white/15 px-3 text-center text-[11px] text-white/50">
                      {selected
                        ? `${studentName}'s 360° view appears once they look around.`
                        : 'Select a student to inspect their live view.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
