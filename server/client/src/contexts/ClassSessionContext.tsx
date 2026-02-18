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
import { useAuth } from './AuthContext';
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
  launchLesson: (payload: LaunchedLesson) => Promise<boolean>;
  launchScene: (payload: LaunchedScene) => Promise<boolean>;
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

export function ClassSessionProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_SESSION) : null
  );
  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [progressList, setProgressList] = useState<SessionStudentProgress[]>([]);
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_JOINED_SESSION) : null
  );
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
      sessionStorage.removeItem('learnxr_class_session_id');
    }
  }, []);

  const startSession = useCallback(
    async (classId: string): Promise<string | null> => {
      if (!user?.uid || !profile || profile.role !== 'teacher' || !profile.school_id) {
        setSessionError('You must be a teacher with a school to start a session.');
        return null;
      }
      setSessionLoading(true);
      setSessionError(null);
      try {
        const id = await createSession(user.uid, profile.school_id, classId);
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
    async (payload: LaunchedLesson): Promise<boolean> => {
      if (!activeSessionId || !user?.uid) return false;
      setSessionLoading(true);
      try {
        const ok = await apiLaunchLesson(activeSessionId, user.uid, payload);
        if (!ok) setSessionError('Failed to launch lesson.');
        return ok;
      } finally {
        setSessionLoading(false);
      }
    },
    [activeSessionId, user?.uid]
  );

  const launchScene = useCallback(
    async (payload: LaunchedScene): Promise<boolean> => {
      if (!activeSessionId || !user?.uid) return false;
      setSessionLoading(true);
      try {
        const ok = await apiLaunchScene(activeSessionId, user.uid, payload);
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

  // Teacher: subscribe to active session (everyone with activeSessionId from storage may get this)
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      setProgressList([]);
      return;
    }
    const unsubSession = subscribeSession(activeSessionId, setActiveSession);
    return () => {
      unsubSession();
    };
  }, [activeSessionId]);

  // Teacher only: subscribe to progress when this user owns the session (avoids permission-denied for students who have learnxr_class_session_id set from a launched lesson)
  useEffect(() => {
    if (!activeSessionId || !activeSession || activeSession.teacher_uid !== user?.uid) {
      setProgressList([]);
      return;
    }
    const unsubProgress = subscribeSessionProgress(activeSessionId, setProgressList);
    return () => unsubProgress();
  }, [activeSessionId, activeSession?.teacher_uid, user?.uid]);

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

  // Restore session from storage on load (e.g. after refresh) – validate still exists
  useEffect(() => {
    if (!user?.uid) return;
    const storedActive = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_SESSION) : null;
    const storedJoined = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_JOINED_SESSION) : null;
    if (storedActive && !activeSessionId) {
      getSession(storedActive).then((s) => {
        if (s && s.teacher_uid === user.uid && s.status !== 'ended') setActiveSessionId(storedActive);
        else if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
      });
    }
    if (storedJoined && !joinedSessionId) {
      getSession(storedJoined).then((s) => {
        if (s && s.status !== 'ended') setJoinedSessionId(storedJoined);
        else if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY_JOINED_SESSION);
      });
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

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
