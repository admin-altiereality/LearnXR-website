/**
 * useClassroomSession – the live-class brain, shared by every lesson player.
 *
 * Everything a player needs to take part in a teacher-led class lives here:
 * who is host, whether the class is under lockstep, the playback gate, view
 * sync, progress and attendance reporting, the lobby roster and hand-raise.
 *
 * Both players speak the same phase vocabulary — the one stored in Firestore —
 * so the only thing they still differ on is how they read and write their own
 * camera (`view`). There used to be a `phaseAdapter` translating between two
 * sets of phase names on every read and write; the names were unified instead,
 * which removed a whole class of desynchronisation.
 *
 * Safe to call outside a `ClassSessionProvider`: every capability degrades to a
 * no-op and `isClassHost` / `isStudentInSession` stay false.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useClassSession } from '../contexts/ClassSessionContext';
import {
  reportSessionProgress,
  reportStudentView,
  reportAttendance,
  updateTeacherView,
  type ReportSessionQuizPayload,
} from '../services/classSessionService';
import { resolveStudentDisplayName } from '../utils/displayName';
import { isTransientPhase } from '../lib/classroom/phases';
import {
  createHostViewSender,
  shouldApplyTeacherView,
  STUDENT_DRAG_GRACE_MS,
  type AppliedView,
} from '../lib/classroom/viewSync';
import type {
  ClassSession,
  SessionLessonPhase,
  SessionStudentProgress,
  TeacherPlayback,
} from '../types/lms';

/** How a player reads and writes its own camera. Omit to opt out of view sync. */
export interface ClassroomViewAdapter {
  /** Current view, or null while the scene is not ready. */
  read(): { h: number; v: number; fov: number } | null;
  /** Adopt the teacher's view. `isDirect` marks an explicit "Direct class to my view". */
  apply(view: AppliedView, options: { isDirect: boolean }): void;
  /** Subscribe to local view changes. Return an unsubscribe. */
  subscribe?(listener: (h: number, v: number, fov: number) => void): () => void;
  /** True while this viewer is in immersive VR, where only Directs may be applied. */
  isImmersive?(): boolean;
}

export interface UseClassroomSessionOptions<P extends SessionLessonPhase = SessionLessonPhase> {
  /** The player's current phase, in the session's own vocabulary. */
  playerPhase: P | null | undefined;
  /** The player's phase setter, called when the teacher drives the class. */
  setPlayerPhase: (phase: P) => void;
  /** True once the lesson is playable. Gates the playback follower. */
  lessonReady?: boolean;
  /** True once scene *and* audio are loaded. Published as lobby readiness. */
  allReady?: boolean;
  view?: ClassroomViewAdapter | null;
  /**
   * Player-specific side effects for a playback command. Must be declarative —
   * reset the "last played phase" marker and enable autoplay rather than calling
   * TTS directly, or the phase closure goes stale and clips double-play.
   */
  onPlaybackCommand?: (cmd: 'play' | 'pause' | 'replay', phase: SessionLessonPhase) => void;
  /** Quiz result to attach to the `completed` progress report. Consumed once. */
  pendingQuizRef?: MutableRefObject<ReportSessionQuizPayload | null>;
  /** Element whose pointer input grants the student their drag grace window. */
  dragGraceTarget?: HTMLElement | null;
  /** False on hardware that cannot show the in-headset panel. */
  immersiveUiDeviceCapable?: boolean;
  /** Set false to disable every effect (e.g. before the player has mounted a scene). */
  enabled?: boolean;
}

export interface UseClassroomSessionResult {
  // --- identity ---
  isClassHost: boolean;
  isStudentInSession: boolean;
  isStudentRemoved: boolean;
  /** False while removed or awaiting the teacher's approval to rejoin. */
  isAdmitted: boolean;
  activeSession: ClassSession | null;
  joinedSession: ClassSession | null;
  activeSessionId: string | null;
  joinedSessionId: string | null;
  hostSessionId: string | null;
  hostSessionCode: string | null;

  // --- class state ---
  controlStudentsEnabled: boolean;
  teacherControlledPhase: string | null;
  teacherPlayback: TeacherPlayback | null;
  /** The class has actually begun — teacher pressed Play, not merely took control. */
  classStarted: boolean;
  studentUiVisible: boolean;
  /** Whether THIS viewer should see the in-headset lesson panel. */
  showImmersiveUiForThisViewer: boolean;

  // --- roster ---
  progressList: SessionStudentProgress[];
  rosterCounts: { inLesson: number; joined: number };
  enrolledCount: number | null;
  pendingJoinCount: number;
  raisedHandCount: number;
  handRaised: boolean;

  // --- handlers ---
  handleTeacherPlaybackCommand: (cmd: 'play' | 'pause' | 'replay', phaseOverride?: string) => void;
  directClassToCurrentView: () => Promise<boolean>;
  toggleControl: (enabled: boolean) => Promise<void>;
  toggleStudentUi: (visible: boolean) => Promise<void>;
  forceStudentsIn: () => Promise<void>;
  toggleHandRaised: () => void;
  endSession: ((sessionIdOverride?: string) => Promise<boolean>) | undefined;
  /** Returns true (and toasts) when a student action is locked by the teacher. */
  blockStudentPhaseControl: (actionLabel: string) => boolean;
  /** Marks the student as actively looking, suspending follow briefly. */
  markStudentLooking: () => void;
}

/** Stable empty list so `progressList` does not change identity every render. */
const EMPTY_PROGRESS: SessionStudentProgress[] = [];

const STORAGE_KEY_ACTIVE_SESSION = 'learnxr_class_session_id';
const STORAGE_KEY_PARTNER_DEMO = 'learnxr_partner_demo_session';
const STUDENT_VIEW_REPORT_THROTTLE_MS = 220;

export function useClassroomSession<P extends SessionLessonPhase = SessionLessonPhase>(
  options: UseClassroomSessionOptions<P>
): UseClassroomSessionResult {
  const {
    playerPhase,
    setPlayerPhase,
    lessonReady = false,
    allReady = false,
    view = null,
    onPlaybackCommand,
    pendingQuizRef,
    dragGraceTarget = null,
    immersiveUiDeviceCapable = true,
    enabled = true,
  } = options;

  const { user, profile } = useAuth();

  // The provider is not mounted on every route that can host a player, and
  // useClassSession throws rather than returning null.
  let classSession: ReturnType<typeof useClassSession> | null = null;
  try {
    classSession = useClassSession();
  } catch {
    classSession = null;
  }

  const activeSessionId = classSession?.activeSessionId ?? null;
  const activeSession = classSession?.activeSession ?? null;
  const joinedSessionId = classSession?.joinedSessionId ?? null;
  const joinedSession = classSession?.joinedSession ?? null;
  const progressList = classSession?.progressList ?? EMPTY_PROGRESS;
  const bindActiveSession = classSession?.bindActiveSession;
  const broadcastTeacherPhase = classSession?.broadcastTeacherPhase;
  const setSessionControl = classSession?.setSessionControl;
  const setStudentUiVisible = classSession?.setStudentUiVisible;
  const setTeacherPlayback = classSession?.setTeacherPlayback;
  const publishLobbyRoster = classSession?.publishLobbyRoster;
  const forceStudentsToLesson = classSession?.forceStudentsToLesson;
  const reportSignal = classSession?.reportSignal;
  const isAdmitted = classSession?.isAdmitted ?? false;
  const endSession = classSession?.endSession;

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /** Partner demo sessions are hosted without a teacher profile; the id lives in storage. */
  const partnerSessionMeta = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_PARTNER_DEMO);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { code?: string; id?: string };
      if (!parsed?.id && !parsed?.code) return null;
      return {
        id: typeof parsed.id === 'string' ? parsed.id : null,
        code: typeof parsed.code === 'string' ? parsed.code : null,
      };
    } catch {
      return null;
    }
  }, [activeSessionId, activeSession?.session_code, profile?.role]);

  const isTeacherInSession = Boolean(
    activeSessionId && activeSession && user?.uid && activeSession.teacher_uid === user.uid
  );

  const isClassHost = Boolean(
    isTeacherInSession ||
      (profile?.role === 'partner' &&
        (partnerSessionMeta?.id || partnerSessionMeta?.code || activeSession?.hosted_by_partner)) ||
      (activeSessionId &&
        activeSession &&
        user?.uid &&
        (activeSession.teacher_uid === user.uid ||
          (profile?.role === 'partner' && activeSession.hosted_by_partner === true)))
  );

  const isStudentInSession = Boolean(
    joinedSessionId && joinedSession && user?.uid && joinedSession.teacher_uid !== user.uid
  );

  const isStudentRemoved = useMemo(() => {
    if (!isStudentInSession || !user?.uid || !joinedSession) return false;
    const removed = Array.isArray(joinedSession.removed_student_uids)
      ? joinedSession.removed_student_uids
      : [];
    return removed.includes(user.uid);
  }, [isStudentInSession, user?.uid, joinedSession?.removed_student_uids]);

  const hostSessionId = activeSessionId || partnerSessionMeta?.id || null;
  const hostSessionCode = useMemo(
    () => activeSession?.session_code || partnerSessionMeta?.code || null,
    [activeSession?.session_code, partnerSessionMeta?.code]
  );

  // Restore a host session from storage (partner demo, or a reload mid-class).
  useEffect(() => {
    if (!enabled || !bindActiveSession || activeSessionId) return;
    const stored =
      typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_SESSION) : null;
    const id = partnerSessionMeta?.id || stored;
    if (!id) return;
    const role = profile?.role;
    if (role === 'partner' || role === 'teacher' || role === 'admin' || role === 'superadmin') {
      bindActiveSession(id);
    }
  }, [enabled, bindActiveSession, activeSessionId, partnerSessionMeta?.id, profile?.role]);

  // -------------------------------------------------------------------------
  // Class state
  // -------------------------------------------------------------------------

  // Teachers read their own session, students read the one they joined.
  const sessionForControl = isStudentInSession ? joinedSession : activeSession;
  const controlStudentsEnabled = sessionForControl?.control_students_enabled ?? false;
  const teacherControlledPhase = sessionForControl?.teacher_controlled_phase ?? null;
  const teacherPlayback = sessionForControl?.teacher_playback ?? null;

  /**
   * Has the class actually STARTED? Deliberately not "has the teacher taken
   * control": students should be free to look around from the moment they
   * arrive, with the lesson UI appearing when the lesson begins.
   */
  const classStarted = Boolean(teacherPlayback && teacherPlayback.state !== 'idle');
  /** The teacher's explicit override. Defaults to shown, so starting a class just works. */
  const studentUiVisible = sessionForControl?.student_ui_visible ?? true;

  /**
   * Whether THIS viewer sees lesson content rather than the waiting state.
   *
   * `!controlStudentsEnabled` is the important clause. Without it a student was
   * held from the moment they joined — before the teacher had taken control of
   * anything — because `classStarted` is false until Play is pressed. That
   * conflated "the teacher has not started yet" with "this student is under
   * teacher control", and left students staring at a waiting card with dead
   * buttons in a class nobody was driving. Holding requires lockstep.
   */
  const showImmersiveUiForThisViewer =
    immersiveUiDeviceCapable &&
    (isClassHost ||
      !isStudentInSession ||
      !controlStudentsEnabled ||
      (classStarted && studentUiVisible));

  const currentStudentDisplayName = resolveStudentDisplayName(profile as never, {
    uid: user?.uid,
    displayName: user?.displayName,
    email: user?.email,
  });

  const blockStudentPhaseControl = useCallback(
    (actionLabel: string): boolean => {
      if (!isStudentInSession || !controlStudentsEnabled) return false;
      toast.info(`Teacher is controlling the lesson. ${actionLabel} is locked for now.`);
      return true;
    },
    [isStudentInSession, controlStudentsEnabled]
  );

  // -------------------------------------------------------------------------
  // Roster
  // -------------------------------------------------------------------------

  const rosterCounts = useMemo(() => {
    const active = progressList.filter((p) => p?.student_uid && !p.removed);
    const inLesson = active.filter((p) => !p.left_at && p.phase && p.phase !== 'idle');
    return { inLesson: inLesson.length, joined: active.length };
  }, [progressList]);

  const raisedHandCount = useMemo(
    () => progressList.filter((s) => s.hand_raised).length,
    [progressList]
  );

  const pendingJoinCount = Array.isArray(activeSession?.join_requests)
    ? activeSession.join_requests.length
    : 0;

  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  useEffect(() => {
    const classId = activeSession?.class_id;
    if (!enabled || !isClassHost || !classId) {
      setEnrolledCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'classes', classId));
        if (cancelled || !snap.exists()) return;
        const ids = snap.data()?.student_ids;
        setEnrolledCount(Array.isArray(ids) ? ids.length : null);
      } catch {
        if (!cancelled) setEnrolledCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isClassHost, activeSession?.class_id]);

  // Host: relay the roster onto the session doc. Students may only read their OWN
  // progress doc, so the lobby list has to come through the session.
  const lobbyRosterKey = progressList
    .map((p) => `${p.student_uid}:${p.lesson_ready ? 1 : 0}`)
    .sort()
    .join(',');
  useEffect(() => {
    if (!enabled || !isClassHost || !activeSessionId || !publishLobbyRoster) return;
    const roster = progressList
      .filter((p) => p?.student_uid && !p.removed)
      .map((p) => ({
        uid: p.student_uid,
        name: resolveStudentDisplayName(null, null, {
          uid: p.student_uid,
          displayName: p.display_name,
          email: p.email,
        }),
        ready: p.lesson_ready === true,
      }));
    void publishLobbyRoster(roster);
    // Names and readiness only — re-publishing on every progress snapshot would
    // write on each phase tick for every student in the class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isClassHost, activeSessionId, publishLobbyRoster, lobbyRosterKey]);

  // -------------------------------------------------------------------------
  // Progress + attendance (students only)
  //
  // Only students write progress documents. A host may hold an active session id
  // for view broadcast, but Firestore correctly reserves these writes for the
  // student whose document it is.
  // -------------------------------------------------------------------------

  // A removed student must stop writing into the class immediately, including
  // while a rejoin request is pending — otherwise they keep appearing on the
  // teacher's roster and in the view preview after being removed.
  const sessionIdForReport = isStudentInSession && isAdmitted ? joinedSessionId : null;

  useEffect(() => {
    if (!enabled || !sessionIdForReport || !user?.uid) return;
    reportSessionProgress(
      sessionIdForReport,
      user.uid,
      currentStudentDisplayName,
      'loading',
      undefined,
      undefined,
      profile?.email ?? user?.email ?? undefined
    ).catch(() => {});
  }, [enabled, sessionIdForReport, user?.uid, currentStudentDisplayName, user?.email, profile?.email]);

  useEffect(() => {
    if (!enabled || !sessionIdForReport || !user?.uid) return;
    const phase = (playerPhase ?? 'idle');
    const quiz = phase === 'completed' ? pendingQuizRef?.current ?? null : null;
    if (quiz && pendingQuizRef) pendingQuizRef.current = null;
    reportSessionProgress(
      sessionIdForReport,
      user.uid,
      currentStudentDisplayName,
      phase,
      undefined,
      quiz ?? undefined,
      profile?.email ?? user?.email ?? undefined
    ).catch(() => {});
    // pendingQuizRef is stable for the life of a player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    playerPhase,
    sessionIdForReport,
    user?.uid,
    user?.email,
    profile?.email,
    currentStudentDisplayName,
  ]);

  // Attendance: arrival, then readiness once the scene has loaded.
  useEffect(() => {
    if (!enabled || !isStudentInSession || !isAdmitted || !joinedSessionId || !user?.uid) return;
    void reportAttendance(joinedSessionId, user.uid, { lessonReady: allReady });
  }, [enabled, isStudentInSession, isAdmitted, joinedSessionId, user?.uid, allReady]);

  // Attendance: departure + duration when the player unmounts.
  useEffect(() => {
    if (!enabled || !isStudentInSession || !joinedSessionId || !user?.uid) return;
    const startedAt = Date.now();
    const sid = joinedSessionId;
    const uid = user.uid;
    return () => {
      void reportAttendance(sid, uid, {
        left: true,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    };
  }, [enabled, isStudentInSession, joinedSessionId, user?.uid]);

  // -------------------------------------------------------------------------
  // Phase lockstep
  // -------------------------------------------------------------------------

  /** Flips true only on a deliberate Play / phase command from the teacher. */
  const teacherPlaybackStartedRef = useRef(false);
  const lastBroadcastPhaseRef = useRef<string | null>(null);

  /**
   * Teacher: mirror local phase changes to the class — but ONLY once the teacher
   * has deliberately started it.
   *
   * Without this gate holding a class is impossible: pressing "Start Lesson"
   * sets the teacher's own phase to `intro`, this effect broadcasts it, and every
   * student is released instantly.
   */
  useEffect(() => {
    if (!enabled || !isClassHost || !controlStudentsEnabled || !broadcastTeacherPhase) return;
    if (!teacherPlaybackStartedRef.current) return;
    const sessionPhase = (playerPhase ?? 'idle');
    if (isTransientPhase(sessionPhase)) return;
    if (sessionPhase === lastBroadcastPhaseRef.current) return;
    lastBroadcastPhaseRef.current = sessionPhase;
    void broadcastTeacherPhase(sessionPhase, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isClassHost, controlStudentsEnabled, playerPhase, broadcastTeacherPhase]);

  /** Student: lock to the teacher's phase, overriding local auto-progression. */
  const lastAppliedTeacherPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !isStudentInSession || !controlStudentsEnabled || !teacherControlledPhase) return;
    if (teacherControlledPhase === lastAppliedTeacherPhaseRef.current) return;
    lastAppliedTeacherPhaseRef.current = teacherControlledPhase;
    const local = teacherControlledPhase as P;
    if (local) setPlayerPhase(local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isStudentInSession, controlStudentsEnabled, teacherControlledPhase, setPlayerPhase]);

  // -------------------------------------------------------------------------
  // Playback gate
  // -------------------------------------------------------------------------

  const playbackTokenRef = useRef(0);

  /**
   * The only thing that releases a held class: it flips
   * `teacherPlaybackStartedRef` and writes `teacher_playback`, which every
   * student's follower applies.
   */
  const handleTeacherPlaybackCommand = useCallback(
    (cmd: 'play' | 'pause' | 'replay', phaseOverride?: string) => {
      if (!isClassHost || !setTeacherPlayback) return;
      teacherPlaybackStartedRef.current = true;
      const phase = (phaseOverride
        ? phaseOverride
        : (playerPhase ?? 'idle')) as SessionLessonPhase;

      if (cmd === 'pause') {
        void setTeacherPlayback({
          state: 'paused',
          phase,
          play_token: playbackTokenRef.current,
        });
        onPlaybackCommand?.('pause', phase);
        return;
      }

      // play and replay both advance the token so students re-fire on the same phase.
      playbackTokenRef.current += 1;
      void setTeacherPlayback({ state: 'playing', phase, play_token: playbackTokenRef.current });

      if (phaseOverride) {
        const local = phase as P;
        if (local) setPlayerPhase(local);
      }
      onPlaybackCommand?.(cmd, phase);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClassHost, setTeacherPlayback, playerPhase, setPlayerPhase, onPlaybackCommand]
  );

  /**
   * Student follower: mirror the teacher's playback gate.
   *
   * Driven purely by the CURRENT value of `teacher_playback`, so a late joiner or
   * a mid-lesson reload lands on the class's current point with no extra code.
   */
  const appliedPlaybackRef = useRef<{ phase: string | null; token: number } | null>(null);
  useEffect(() => {
    if (!enabled || !isStudentInSession || !controlStudentsEnabled || !lessonReady) return;

    // No gate yet, or explicitly held: stay silent.
    if (!teacherPlayback || teacherPlayback.state === 'idle') {
      onPlaybackCommand?.('pause', (playerPhase ?? 'idle'));
      return;
    }

    if (teacherPlayback.state === 'paused') {
      onPlaybackCommand?.('pause', teacherPlayback.phase ?? (playerPhase ?? 'idle'));
      return;
    }

    const applied = appliedPlaybackRef.current;
    if (
      applied &&
      applied.phase === teacherPlayback.phase &&
      applied.token === teacherPlayback.play_token
    ) {
      return;
    }
    appliedPlaybackRef.current = {
      phase: teacherPlayback.phase ?? null,
      token: teacherPlayback.play_token,
    };

    if (teacherPlayback.phase) {
      const local = teacherPlayback.phase as P;
      if (local && local !== playerPhase) setPlayerPhase(local);
    }
    onPlaybackCommand?.('play', teacherPlayback.phase ?? (playerPhase ?? 'idle'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    isStudentInSession,
    controlStudentsEnabled,
    lessonReady,
    teacherPlayback,
    setPlayerPhase,
    onPlaybackCommand,
  ]);

  // -------------------------------------------------------------------------
  // View sync
  // -------------------------------------------------------------------------

  const viewRef = useRef<ClassroomViewAdapter | null>(view);
  viewRef.current = view;
  const controlEnabledRef = useRef(controlStudentsEnabled);
  controlEnabledRef.current = controlStudentsEnabled;

  const [hostLookat, setHostLookat] = useState<{ h: number; v: number; fov: number } | null>(null);

  // Host: broadcast the view to students.
  useEffect(() => {
    if (!enabled || !isClassHost || !hostSessionId || !user?.uid || !view) return;
    const sender = createHostViewSender({
      // Continuous follow is applied by students ONLY under lockstep, so outside
      // it every one of these writes is read by the whole class and discarded.
      isEnabled: () => controlEnabledRef.current,
      onSend: (h, v, fov) => {
        setHostLookat({ h, v, fov });
        updateTeacherView(hostSessionId, user.uid!, { hlookat: h, vlookat: v, fov }).catch((err) => {
          console.warn('[ViewSync] Host updateTeacherView failed:', err);
        });
      },
    });
    const unsubscribe = view.subscribe?.((h, v, fov) => sender.send(h, v, fov));
    return () => {
      unsubscribe?.();
      sender.reset();
    };
  }, [enabled, isClassHost, hostSessionId, user?.uid, view]);

  /** "Direct class to my view" — a forced sync every student applies immediately. */
  const directClassToCurrentView = useCallback(async (): Promise<boolean> => {
    if (!isClassHost || !hostSessionId || !user?.uid) return false;
    const live = viewRef.current?.read() ?? null;
    const fallback = activeSession?.teacher_view
      ? {
          h: Number(activeSession.teacher_view.hlookat),
          v: Number(activeSession.teacher_view.vlookat),
          fov: Number(activeSession.teacher_view.fov) || 90,
        }
      : null;
    const chosen = live ?? hostLookat ?? fallback;
    if (!chosen || !Number.isFinite(chosen.h) || !Number.isFinite(chosen.v)) return false;

    const normalized = { h: chosen.h, v: chosen.v, fov: Number(chosen.fov) || 90 };
    setHostLookat(normalized);
    return updateTeacherView(hostSessionId, user.uid, {
      hlookat: normalized.h,
      vlookat: normalized.v,
      fov: normalized.fov,
      force: true,
      sync_id: Date.now(),
    });
  }, [isClassHost, hostSessionId, user?.uid, hostLookat, activeSession?.teacher_view]);

  // Student: a short grace window after their own input, so follow does not
  // fight a drag in progress.
  const studentDragUntilRef = useRef(0);
  const markStudentLooking = useCallback(() => {
    studentDragUntilRef.current = Date.now() + STUDENT_DRAG_GRACE_MS;
  }, []);

  useEffect(() => {
    if (!enabled || !isStudentInSession || !dragGraceTarget) return;
    const el = dragGraceTarget;
    const mark = () => markStudentLooking();
    el.addEventListener('pointerdown', mark);
    el.addEventListener('pointermove', mark);
    el.addEventListener('wheel', mark, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', mark);
      el.removeEventListener('pointermove', mark);
      el.removeEventListener('wheel', mark);
    };
  }, [enabled, isStudentInSession, dragGraceTarget, markStudentLooking]);

  // Student: follow the teacher's view.
  const teacherView = joinedSession?.teacher_view;
  const lastTeacherViewRef = useRef<AppliedView | null>(null);
  useEffect(() => {
    if (!enabled || !isStudentInSession || !view || !teacherView) return;
    const decision = shouldApplyTeacherView({
      teacherView,
      previous: lastTeacherViewRef.current,
      controlEnabled: controlStudentsEnabled,
      inImmersive: view.isImmersive?.() ?? false,
      studentDragUntil: studentDragUntilRef.current,
    });
    if (!decision.apply || !decision.next) return;
    lastTeacherViewRef.current = decision.next;
    view.apply(decision.next, { isDirect: decision.isDirect });
  }, [
    enabled,
    isStudentInSession,
    view,
    controlStudentsEnabled,
    teacherView?.hlookat,
    teacherView?.vlookat,
    teacherView?.fov,
    teacherView?.sync_id,
  ]);

  // Student: report their own view so the teacher's preview matches what they see.
  useEffect(() => {
    if (!enabled || !isStudentInSession || !isAdmitted || !joinedSessionId || !user?.uid || !view?.subscribe)
      return;
    let lastReported = 0;
    const unsubscribe = view.subscribe((h, v, fov) => {
      const now = Date.now();
      if (now - lastReported < STUDENT_VIEW_REPORT_THROTTLE_MS) return;
      lastReported = now;
      reportStudentView(joinedSessionId, user.uid!, {
        hlookat: h,
        vlookat: v,
        fov,
      }).catch(() => {});
    });
    return () => unsubscribe?.();
  }, [enabled, isStudentInSession, isAdmitted, joinedSessionId, user?.uid, view]);

  // -------------------------------------------------------------------------
  // Host controls / student signals
  // -------------------------------------------------------------------------

  const toggleControl = useCallback(
    async (nextEnabled: boolean) => {
      if (!nextEnabled) teacherPlaybackStartedRef.current = false;
      // Taking control also asks the class into immersive mode.
      const ok = await setSessionControl?.(nextEnabled, nextEnabled);
      // Snap the class onto the teacher's view the moment control is taken, rather
      // than leaving them scattered until the teacher next happens to move.
      // Awaited so students already have control_students_enabled true.
      if (ok && nextEnabled) await directClassToCurrentView();
    },
    [setSessionControl, directClassToCurrentView]
  );

  const toggleStudentUi = useCallback(
    async (visible: boolean) => {
      await setStudentUiVisible?.(visible);
    },
    [setStudentUiVisible]
  );

  const forceStudentsIn = useCallback(async () => {
    const ok = await forceStudentsToLesson?.();
    toast[ok ? 'success' : 'error'](
      ok ? 'Bringing everyone into the lesson…' : 'Could not reach the class.'
    );
  }, [forceStudentsToLesson]);

  const [handRaised, setHandRaised] = useState(false);
  const toggleHandRaised = useCallback(() => {
    setHandRaised((prev) => {
      const next = !prev;
      void reportSignal?.({ handRaised: next });
      toast.info(next ? 'Hand raised — your teacher can see it.' : 'Hand lowered.');
      return next;
    });
  }, [reportSignal]);

  return {
    isClassHost,
    isStudentInSession,
    isStudentRemoved,
    isAdmitted,
    activeSession,
    joinedSession,
    activeSessionId,
    joinedSessionId,
    hostSessionId,
    hostSessionCode,

    controlStudentsEnabled,
    teacherControlledPhase,
    teacherPlayback,
    classStarted,
    studentUiVisible,
    showImmersiveUiForThisViewer,

    progressList,
    rosterCounts,
    enrolledCount,
    pendingJoinCount,
    raisedHandCount,
    handRaised,

    handleTeacherPlaybackCommand,
    directClassToCurrentView,
    toggleControl,
    toggleStudentUi,
    forceStudentsIn,
    toggleHandRaised,
    endSession,
    blockStudentPhaseControl,
    markStudentLooking,
  };
}
