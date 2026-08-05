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
} from '../services/classSessionService';
import type {
  ClassSession,
  LaunchedLesson,
  LaunchedScene,
  SessionStudentProgress,
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

  // Student
  joinedSessionId: string | null;
  joinedSession: ClassSession | null;
  joinSession: (sessionCode: string) => Promise<boolean>;
  leaveSessionAsStudent: () => void;

  // Shared
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
  const { user, profile } = useAuth();
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

  const clearSessionError = useCallback(() => setSessionError(null), []);

  const leaveSessionAsTeacher = useCallback(() => {
    setActiveSessionId(null);
    setActiveSession(null);
    setProgressList([]);
    if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
  }, []);

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
          return true;
        }
        setSessionError(result.errorMessage ?? 'Invalid or expired code, or you are not in this class.');
        return false;
      } finally {
        setSessionLoading(false);
      }
    },
    [user?.uid, profile]
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
  useEffect(() => {
    if (!activeSessionId || !activeSession || !user?.uid) {
      setProgressList([]);
      return;
    }
    if (profile?.role === 'student') {
      setProgressList([]);
      return;
    }
    const unsubProgress = subscribeSessionProgress(activeSessionId, setProgressList);
    return () => unsubProgress();
  }, [activeSessionId, activeSession, user?.uid, profile?.role]);

  // Student: subscribe to joined session; on permission error clear state so user can retry
  useEffect(() => {
    if (!joinedSessionId) {
      setJoinedSession(null);
      return;
    }
    const handleSubscribeError = (err: Error) => {
      const code = err && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === 'permission-denied') {
        setSessionError('Could not load session. If you just joined, try again in a moment.');
        setJoinedSessionId(null);
        setJoinedSession(null);
        if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
      }
    };
    const unsub = subscribeSession(joinedSessionId, setJoinedSession, handleSubscribeError);
    return () => unsub();
  }, [joinedSessionId]);

  // When teacher ends the session, student sees status 'ended' → leave session and redirect to dashboard
  useEffect(() => {
    if (!joinedSession || joinedSession.status !== 'ended') return;
    leaveSessionAsStudent();
    navigate('/dashboard/student', { replace: true });
  }, [joinedSession?.status, leaveSessionAsStudent, navigate]);

  // When teacher removes this student, leave session and redirect
  useEffect(() => {
    if (!joinedSession || !user?.uid) return;
    const removed = joinedSession.removed_student_uids?.includes(user.uid);
    if (!removed) return;
    setSessionError('You were removed from the class by the teacher.');
    leaveSessionAsStudent();
    navigate('/dashboard/student', { replace: true });
  }, [joinedSession?.removed_student_uids, user?.uid, leaveSessionAsStudent, navigate]);

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
          // Any session the signed-in user can read (host rules) may be restored
          if (s && s.status !== 'ended') {
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
    joinedSessionId,
    joinedSession,
    joinSession,
    leaveSessionAsStudent,
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
