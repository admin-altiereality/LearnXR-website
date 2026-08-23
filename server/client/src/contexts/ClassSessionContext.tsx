/**
 * ClassSessionContext – Teacher class sessions and student join
 *
 * Teacher: start session, launch lesson/scene, end session, see live progress.
 * Student: join by code, receive launched_lesson / launched_scene and open lesson/scene.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import type { UserProfile } from '../utils/rbac';
import {
  createSession,
  launchLesson as apiLaunchLesson,
  launchScene as apiLaunchScene,
  endSession as apiEndSession,
  joinSession as apiJoinSession,
  subscribeSession,
  subscribeSessionProgress,
  getSession,
  broadcastTeacherPhase as apiBroadcastTeacherPhase,
  updateTeacherContentState as apiUpdateTeacherContentState,
  setSessionControl as apiSetSessionControl,
  setTeacherPlayback as apiSetTeacherPlayback,
  publishLobbyRoster as apiPublishLobbyRoster,
  reportStudentSignal as apiReportStudentSignal,
  forceStudentsToLesson as apiForceStudentsToLesson,
} from '../services/classSessionService';
import type {
  ClassSession,
  LaunchedLesson,
  LaunchedScene,
  SessionStudentProgress,
  TeacherContentState,
  TeacherPlayback,
  SessionLobbyMember,
} from '../types/lms';

interface ClassSessionContextValue {
  // Teacher
  activeSessionId: string | null;
  activeSession: ClassSession | null;
  progressList: SessionStudentProgress[];
  startSession: (classId: string) => Promise<string | null>;
  launchLesson: (payload: LaunchedLesson, sessionIdOverride?: string) => Promise<boolean>;
  launchScene: (payload: LaunchedScene, sessionIdOverride?: string) => Promise<boolean>;
  endSession: () => Promise<boolean>;
  leaveSessionAsTeacher: () => void;
  bindActiveSession: (sessionId: string) => void;
  /** Broadcast the teacher's current lesson phase so students follow it. */
  broadcastTeacherPhase: (phase: string, controlEnabled: boolean) => Promise<boolean>;
  updateTeacherContentState: (state: TeacherContentState) => Promise<boolean>;
  /** Turn lockstep on/off. Enabling holds the class until the teacher presses Play. */
  setSessionControl: (enabled: boolean, requestImmersive?: boolean) => Promise<boolean>;
  /** Drive the class's playback gate (Play / Pause / Replay / jump to a phase). */
  setTeacherPlayback: (playback: Omit<TeacherPlayback, 'at_ms'>) => Promise<boolean>;
  /** Publish the names-only waiting-room roster for students. */
  publishLobbyRoster: (roster: SessionLobbyMember[]) => Promise<boolean>;
  /** Re-issue the current launch so every joined student is pulled into the lesson. */
  forceStudentsToLesson: () => Promise<boolean>;

  // Student
  joinedSessionId: string | null;
  joinedSession: ClassSession | null;
  joinSession: (sessionCode: string) => Promise<boolean>;
  leaveSessionAsStudent: () => void;
  /** Raise/lower hand or send a quick signal to the teacher. */
  reportSignal: (input: { handRaised?: boolean; signal?: 'help' | 'too_fast' | 'ok' | null }) => Promise<boolean>;

  // Shared
  isWaitingForApproval: boolean;
  sessionLoading: boolean;
  sessionError: string | null;
  clearSessionError: () => void;
}

const ClassSessionContext = createContext<ClassSessionContextValue | null>(null);

const STORAGE_KEY_ACTIVE_SESSION = 'learnxr_class_session_id';
const STORAGE_KEY_JOINED_SESSION = 'learnxr_joined_session_id';

function canStartClassSession(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'teacher' && (profile.school_id || (profile.managed_class_ids && profile.managed_class_ids.length > 0)))
    return true;
  if (profile.role === 'admin' || profile.role === 'superadmin') return true;
  if (profile.role === 'principal' && profile.managed_school_id) return true;
  if (profile.role === 'school' && profile.school_id) return true;
  return false;
}

/** Resolve school_id for the session; uses profile or the class document (e.g. superadmin / teacher profile edge cases). */
async function resolveSchoolIdForClassSession(
  classId: string,
  profile: UserProfile
): Promise<string | null> {
  if (profile.school_id) return profile.school_id;
  if (profile.role === 'principal' && profile.managed_school_id) return profile.managed_school_id;
  try {
    const snap = await getDoc(doc(db, 'classes', classId));
    if (snap.exists()) {
      const sid = snap.data()?.school_id;
      if (typeof sid === 'string') return sid;
    }
  } catch (e) {
    console.warn('resolveSchoolIdForClassSession:', e);
  }
  return null;
}

export function ClassSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  // Do not trust sessionStorage until validated against the signed-in user.
  // Blind restore caused permission-denied on subscribe/launch when the stored
  // session belonged to another account (e.g. school → teacher switch).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [progressList, setProgressList] = useState<SessionStudentProgress[]>([]);
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(null);
  const [joinedSession, setJoinedSession] = useState<ClassSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  const clearSessionError = useCallback(() => setSessionError(null), []);

  const leaveSessionAsTeacher = useCallback(() => {
    setActiveSessionId(null);
    setActiveSession(null);
    setProgressList([]);
    if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
  }, []);

  const bindActiveSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setSessionError(null);
    if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, sessionId);
  }, []);

  const broadcastTeacherPhase = useCallback(
    async (phase: string, controlEnabled: boolean): Promise<boolean> => {
      const sid = activeSessionId;
      const uid = user?.uid;
      if (!sid || !uid) return false;
      return apiBroadcastTeacherPhase(sid, uid, phase, controlEnabled);
    },
    [activeSessionId, user?.uid]
  );

  const updateTeacherContentState = useCallback(
    async (state: TeacherContentState): Promise<boolean> => {
      if (!activeSessionId || !user?.uid) return false;
      return apiUpdateTeacherContentState(activeSessionId, user.uid, state);
    },
    [activeSessionId, user?.uid]
  );

  const setSessionControl = useCallback(
    async (enabled: boolean, requestImmersive = false): Promise<boolean> => {
      if (!activeSessionId) return false;
      return apiSetSessionControl(activeSessionId, enabled, requestImmersive);
    },
    [activeSessionId]
  );

  const setTeacherPlayback = useCallback(
    async (playback: Omit<TeacherPlayback, 'at_ms'>): Promise<boolean> => {
      if (!activeSessionId) return false;
      return apiSetTeacherPlayback(activeSessionId, playback);
    },
    [activeSessionId]
  );

  const publishLobbyRoster = useCallback(
    async (roster: SessionLobbyMember[]): Promise<boolean> => {
      if (!activeSessionId) return false;
      return apiPublishLobbyRoster(activeSessionId, roster);
    },
    [activeSessionId]
  );

  const forceStudentsToLesson = useCallback(async (): Promise<boolean> => {
    if (!activeSessionId) return false;
    return apiForceStudentsToLesson(activeSessionId);
  }, [activeSessionId]);

  const reportSignal = useCallback(
    async (input: { handRaised?: boolean; signal?: 'help' | 'too_fast' | 'ok' | null }): Promise<boolean> => {
      if (!joinedSessionId || !user?.uid) return false;
      return apiReportStudentSignal(joinedSessionId, user.uid, input);
    },
    [joinedSessionId, user?.uid]
  );

  const leaveSessionAsStudent = useCallback(() => {
    setJoinedSessionId(null);
    setJoinedSession(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
      sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
    }
  }, []);

  const startSession = useCallback(
    async (classId: string): Promise<string | null> => {
      if (!user?.uid || !profile || !canStartClassSession(profile)) {
        setSessionError('You do not have permission to start a class session.');
        return null;
      }
      setSessionLoading(true);
      setSessionError(null);
      try {
        const schoolId = await resolveSchoolIdForClassSession(classId, profile);
        if (!schoolId) {
          setSessionError('Could not determine school for this class. Select a class in your school.');
          return null;
        }
        const id = await createSession(user.uid, schoolId, classId);
        if (id) {
          setActiveSessionId(id);
          if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, id);
        } else {
          setSessionError('Could not create session. Check your connection.');
        }
        return id;
      } finally {
        setSessionLoading(false);
      }
    },
    [user?.uid, profile]
  );

  const launchLesson = useCallback(
    async (payload: LaunchedLesson, sessionIdOverride?: string): Promise<boolean> => {
      const sessionId = sessionIdOverride ?? activeSessionId;
      if (!sessionId || !user?.uid) return false;
      setSessionLoading(true);
      try {
        const ok = await apiLaunchLesson(sessionId, user.uid, payload);
        if (!ok) {
          setSessionError('Failed to launch lesson. Start a new class session and try again.');
          // Drop stale/inaccessible session so the next launch creates a fresh one.
          if (sessionId === activeSessionId) leaveSessionAsTeacher();
        }
        return ok;
      } finally {
        setSessionLoading(false);
      }
    },
    [activeSessionId, user?.uid, leaveSessionAsTeacher]
  );

  const launchScene = useCallback(
    async (payload: LaunchedScene, sessionIdOverride?: string): Promise<boolean> => {
      const sessionId = sessionIdOverride ?? activeSessionId;
      if (!sessionId || !user?.uid) return false;
      setSessionLoading(true);
      try {
        const ok = await apiLaunchScene(sessionId, user.uid, payload);
        if (!ok) setSessionError('Failed to send scene.');
        return ok;
      } finally {
        setSessionLoading(false);
      }
    },
    [activeSessionId, user?.uid]
  );

  const endSession = useCallback(async (): Promise<boolean> => {
    if (!activeSessionId || !user?.uid) return false;
    setSessionLoading(true);
    try {
      const ok = await apiEndSession(activeSessionId, user.uid);
      if (ok) leaveSessionAsTeacher();
      else setSessionError('Failed to end session.');
      return ok;
    } finally {
      setSessionLoading(false);
    }
  }, [activeSessionId, user?.uid, leaveSessionAsTeacher]);

  const joinSession = useCallback(
    async (sessionCode: string): Promise<boolean> => {
      if (!user?.uid || !profile || profile.role !== 'student') {
        setSessionError('Only students can join a class session.');
        return false;
      }
      setSessionLoading(true);
      setSessionError(null);
      try {
        const result = await apiJoinSession(sessionCode);
        if (result.sessionId) {
          setJoinedSessionId(result.sessionId);
          if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY_JOINED_SESSION, result.sessionId);
          
          if (result.requiresApproval) {
            setIsWaitingForApproval(true);
          } else {
            setIsWaitingForApproval(false);
          }
          
          // Refresh so guest/school class links from the join API are visible immediately
          try {
            await refreshProfile();
          } catch {
            // non-fatal — Auth onSnapshot will usually pick up the Admin write
          }
          return true;
        }
        setSessionError(result.errorMessage ?? 'Invalid or expired code, or you are not in this class.');
        return false;
      } finally {
        setSessionLoading(false);
      }
    },
    [user?.uid, profile, refreshProfile]
  );

  // Teacher: subscribe to active session; clear stale IDs on permission-denied
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      setProgressList([]);
      return;
    }
    const handleSubscribeError = (err: Error) => {
      const code = err && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === 'permission-denied') {
        leaveSessionAsTeacher();
        setSessionError('Previous class session is no longer accessible. Start a new session to launch.');
      }
    };
    const unsubSession = subscribeSession(activeSessionId, setActiveSession, handleSubscribeError);
    return () => {
      unsubSession();
    };
  }, [activeSessionId, leaveSessionAsTeacher]);

  // Host: subscribe to progress once session doc is readable (students must not use activeSessionId)
  // The removed-set is read through a ref so the listener is NOT torn down and
  // rebuilt on every session snapshot (teacher_view writes fire on each 360 drag).
  const removedStudentsRef = useRef<Set<string>>(new Set());
  const removedStudentsKey = Array.isArray(activeSession?.removed_student_uids)
    ? activeSession!.removed_student_uids!.join(',')
    : '';
  useEffect(() => {
    removedStudentsRef.current = new Set(
      removedStudentsKey ? removedStudentsKey.split(',').filter(Boolean) : []
    );
    // Re-filter what we already have so a removal takes effect without a new snapshot.
    setProgressList((prev) =>
      prev.filter((s) => s?.student_uid && !removedStudentsRef.current.has(s.student_uid))
    );
  }, [removedStudentsKey]);

  const hasReadableSession = Boolean(activeSession);
  useEffect(() => {
    if (!activeSessionId || !hasReadableSession || !user?.uid) {
      setProgressList([]);
      return;
    }
    if (profile?.role === 'student') {
      setProgressList([]);
      return;
    }
    const unsubProgress = subscribeSessionProgress(
      activeSessionId,
      (list) => {
        setProgressList(
          list.filter((s) => s?.student_uid && !removedStudentsRef.current.has(s.student_uid))
        );
      },
      (err) => {
        const code = (err as { code?: string })?.code;
        setSessionError(
          code === 'permission-denied'
            ? 'You do not have permission to view this class roster.'
            : 'Could not load the class roster. Check your connection.'
        );
      }
    );
    return () => unsubProgress();
  }, [activeSessionId, hasReadableSession, user?.uid, profile?.role]);

  // Student: subscribe to joined session; retry briefly after join (guest school link can lag)
  useEffect(() => {
    if (!joinedSessionId) {
      setJoinedSession(null);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let unsub: (() => void) | null = null;
    let attempts = 0;
    const maxAttempts = 4;

    const startSubscribe = () => {
      if (cancelled) return;
      unsub?.();
      unsub = subscribeSession(
        joinedSessionId,
        (session) => {
          if (!cancelled) setJoinedSession(session);
        },
        (err: Error) => {
          const code = err && 'code' in err ? (err as { code?: string }).code : undefined;
          if (code !== 'permission-denied' || cancelled) return;
          if (attempts < maxAttempts) {
            attempts += 1;
            retryTimer = setTimeout(() => {
              void (async () => {
                try {
                  await refreshProfile();
                } catch {
                  // non-fatal
                }
                if (!cancelled) startSubscribe();
              })();
            }, 500 * attempts);
            return;
          }
          setSessionError('Could not load session. If you just joined, try the code again in a moment.');
          setJoinedSessionId(null);
          setJoinedSession(null);
          if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
        }
      );
    };

    startSubscribe();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsub?.();
    };
  }, [joinedSessionId, refreshProfile]);

  // When teacher ends the session, student sees status 'ended' → leave session and redirect to dashboard
  useEffect(() => {
    if (!joinedSession || joinedSession.status !== 'ended') return;
    leaveSessionAsStudent();
    navigate('/dashboard/student', { replace: true });
  }, [joinedSession?.status, leaveSessionAsStudent, navigate]);

  // Licensed class launches are routed centrally so they work from every dashboard.
  useEffect(() => {
    const launched = joinedSession?.launched_lesson;
    if (!launched?.licensed_content_id) return;
    if (!['licensed_3d', 'licensed_embed', 'licensed_link'].includes(String(launched.lesson_type))) return;
    const launchKey = `${joinedSessionId || ''}:${launched.lesson_type}:${launched.licensed_content_id}:${launched.launch_id || ''}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem('learnxr_handled_licensed_launch') === launchKey) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('learnxr_handled_licensed_launch', launchKey);
      if (joinedSessionId) sessionStorage.setItem(STORAGE_KEY_JOINED_SESSION, joinedSessionId);
    }
    navigate(`/immersive-stem/${encodeURIComponent(launched.licensed_content_id)}`);
  }, [joinedSession?.launched_lesson, joinedSessionId, navigate]);

  // When teacher removes this student, leave session and redirect (unless requesting join)
  useEffect(() => {
    if (!joinedSession || !user?.uid) return;
    const removed = joinedSession.removed_student_uids?.includes(user.uid);
    const requesting = joinedSession.join_requests?.includes(user.uid);
    
    if (removed) {
      if (requesting) {
        setIsWaitingForApproval(true);
      } else {
        setIsWaitingForApproval(false);
        setSessionError('You were removed from the class by the teacher.');
        leaveSessionAsStudent();
        navigate('/dashboard/student', { replace: true });
      }
    } else {
      setIsWaitingForApproval(false);
    }
  }, [joinedSession?.removed_student_uids, joinedSession?.join_requests, user?.uid, leaveSessionAsStudent, navigate]);

  // Restore session from storage only after auth is ready, and only if this user owns it
  useEffect(() => {
    if (!user?.uid || typeof window === 'undefined') return;
    let cancelled = false;
    const storedActive = sessionStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
    const storedJoined = sessionStorage.getItem(STORAGE_KEY_JOINED_SESSION);

    (async () => {
      if (storedActive) {
        try {
          const s = await getSession(storedActive);
          if (cancelled) return;
          const isHostRole =
            profile?.role === 'teacher' ||
            profile?.role === 'partner' ||
            profile?.role === 'admin' ||
            profile?.role === 'superadmin' ||
            profile?.role === 'principal' ||
            profile?.role === 'school';
          // Never restore teacher/host active session from storage for students (shared key pollution)
          if (s && s.status !== 'ended' && isHostRole) {
            setActiveSessionId(storedActive);
          } else {
            sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
          }
        } catch {
          if (!cancelled) sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
        }
      }
      if (storedJoined && profile?.role === 'student') {
        try {
          const s = await getSession(storedJoined);
          if (cancelled) return;
          if (s && s.status !== 'ended') {
            setJoinedSessionId(storedJoined);
          } else {
            sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
          }
        } catch {
          if (!cancelled) sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
        }
      } else if (
        !storedJoined &&
        storedActive &&
        profile?.role === 'student'
      ) {
        // Lessons launch historically wrote the active key for students — recover follow sync.
        try {
          const s = await getSession(storedActive);
          if (cancelled) return;
          if (s && s.status !== 'ended') {
            setJoinedSessionId(storedActive);
            sessionStorage.setItem(STORAGE_KEY_JOINED_SESSION, storedActive);
          }
        } catch {
          /* ignore */
        }
      } else if (storedJoined && profile?.role && profile.role !== 'student') {
        sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, profile?.role]);

  const value: ClassSessionContextValue = {
    activeSessionId,
    activeSession,
    progressList,
    startSession,
    launchLesson,
    launchScene,
    endSession,
    leaveSessionAsTeacher,
    bindActiveSession,
    broadcastTeacherPhase,
    updateTeacherContentState,
    setSessionControl,
    setTeacherPlayback,
    publishLobbyRoster,
    forceStudentsToLesson,
    joinedSessionId,
    joinedSession,
    joinSession,
    leaveSessionAsStudent,
    reportSignal,
    isWaitingForApproval,
    sessionLoading,
    sessionError,
    clearSessionError,
  };

  return (
    <ClassSessionContext.Provider value={value}>
      {children}
    </ClassSessionContext.Provider>
  );
}

export function useClassSession(): ClassSessionContextValue {
  const ctx = useContext(ClassSessionContext);
  if (!ctx) {
    throw new Error('useClassSession must be used within ClassSessionProvider');
  }
  return ctx;
}
