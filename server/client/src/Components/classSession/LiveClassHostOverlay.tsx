/**
 * Class roster / approvals / student-preview drawer.
 *
 * This used to be a full floating control overlay pinned at `absolute inset-0 z-50`,
 * which made it one opaque stacking context covering the quiz card and the player's
 * own audio controls. The controls now live in PlayerTopBar / PlayerBottomBar; only
 * the drawer remains, and the parent decides when it opens.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Eye, Loader2, UserMinus, X, Hand } from 'lucide-react';
import { toast } from 'react-toastify';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
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
  /** Optional skybox override (e.g. current tour stop). Falls back to launched lesson bundle. */
  skyboxUrlOverride?: string | null;
  /** Which drawer the parent wants open, or null for closed. */
  openDrawer?: null | 'roster' | 'approvals' | 'preview';
  /** Parent closes the drawer. */
  onDrawerChange?: (next: null | 'roster' | 'approvals' | 'preview') => void;
  className?: string;
}

export function LiveClassHostOverlay({
  session,
  sessionId,
  hostUid,
  progressList,
  sessionCode,
  skyboxUrlOverride,
  openDrawer = null,
  onDrawerChange,
  className = '',
}: LiveClassHostOverlayProps) {
  const activeDrawer = openDrawer;
  const setActiveDrawer = (
    next:
      | (null | 'roster' | 'approvals' | 'preview')
      | ((prev: null | 'roster' | 'approvals' | 'preview') => null | 'roster' | 'approvals' | 'preview')
  ) => {
    const value = typeof next === 'function' ? next(activeDrawer) : next;
    onDrawerChange?.(value);
  };
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  /** Student 360° preview is opt-in — off until the host explicitly enables it. */
  const [studentViewOn, setStudentViewOn] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [approvingUid, setApprovingUid] = useState<string | null>(null);
  const [studentSkyboxUrl, setStudentSkyboxUrl] = useState<string | null>(null);
  const [requestDisplayNames, setRequestDisplayNames] = useState<Record<string, string>>({});
  const [directing, setDirecting] = useState(false);

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
  const studentCount = visibleProgress.length;
  const pendingCount = pendingJoinUids.length;
  const drawerTitle =
    activeDrawer === 'roster' ? 'Students' : activeDrawer === 'approvals' ? 'Pending approvals' : 'Student preview';

  return (
    <div className={`pointer-events-none absolute inset-0 z-drawer text-white ${className}`}>
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
                          <p className="flex items-center gap-1.5 truncate text-xs font-medium">
                            {student.hand_raised && (
                              <Hand className="h-3 w-3 shrink-0 animate-pulse text-amber-300" />
                            )}
                            {name}
                          </p>
                          <p className="text-[10px] capitalize text-white/45">
                            {student.phase || 'connected'}
                            {student.lesson_ready === false ? ' · loading' : ''}
                            {student.signal === 'help' ? ' · needs help' : ''}
                            {student.signal === 'too_fast' ? ' · too fast' : ''}
                          </p>
                          {/*
                            The quiz result, shown as soon as there is one.

                            This is what the teacher reads before moving the
                            class on: advancing carries unfinished students
                            forward with the answers they have given, so knowing
                            who is still working is the difference between a
                            considered decision and an accidental one.
                          */}
                          {typeof student.quiz_total === 'number' && student.quiz_total > 0 && (
                            <p
                              className={`text-[10px] font-semibold tabular-nums ${
                                student.phase === 'completed' ? 'text-emerald-300/85' : 'text-amber-300/85'
                              }`}
                            >
                              Quiz {student.quiz_score ?? 0}/{student.quiz_total}
                              {student.phase === 'completed' ? '' : ' · still answering'}
                            </p>
                          )}
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
