/**
 * Class Session Service
 *
 * Manages teacher class sessions: create session, launch lesson/scene to class,
 * student join by code, and real-time progress. Used for "launch to multiple headsets"
 * from Teacher Dashboard.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';
import { getApiBaseUrl } from '../utils/apiConfig';
import type {
  ClassSession,
  LaunchedLesson,
  LaunchedScene,
  SessionStudentProgress,
  SessionLessonPhase,
  SessionQuizAnswer,
} from '../types/lms';

const COLLECTION_SESSIONS = 'class_sessions';
const SUBCOLLECTION_PROGRESS = 'progress';

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I to avoid confusion

function generateSessionCode(length: number = 6): string {
  let code = '';
  const arr = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i++) code += ALPHANUM[arr[i] % ALPHANUM.length];
  return code;
}

/**
 * Create a new class session. Teacher must manage the class (teacher_ids or shared).
 * Returns session id or null.
 */
export async function createSession(
  teacherUid: string,
  schoolId: string,
  classId: string
): Promise<string | null> {
  try {
    const sessionRef = doc(collection(db, COLLECTION_SESSIONS));
    const sessionCode = generateSessionCode(6);

    const session: Omit<ClassSession, 'id'> = {
      teacher_uid: teacherUid,
      school_id: schoolId,
      class_id: classId,
      status: 'waiting',
      session_code: sessionCode.toUpperCase(),
      launched_lesson: null,
      launched_scene: null,
      created_at: serverTimestamp() as any,
      updated_at: serverTimestamp() as any,
    };

    await setDoc(sessionRef, session);
    return sessionRef.id;
  } catch (err) {
    console.error('classSessionService.createSession:', err);
    return null;
  }
}

/**
 * Launch a curriculum lesson to the class. Only session owner can call.
 */
export async function launchLesson(
  sessionId: string,
  teacherUid: string,
  payload: LaunchedLesson
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists() || snap.data()?.teacher_uid !== teacherUid) return false;

    await updateDoc(sessionRef, {
      launched_lesson: payload,
      launched_scene: null, // clear scene when launching lesson
      status: 'active',
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.launchLesson:', err);
    return false;
  }
}

/**
 * Launch current Create-page scene to the class. Only session owner can call.
 */
export async function launchScene(
  sessionId: string,
  teacherUid: string,
  payload: LaunchedScene
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists() || snap.data()?.teacher_uid !== teacherUid) return false;

    await updateDoc(sessionRef, {
      launched_scene: payload,
      launched_lesson: null, // clear lesson when launching scene
      status: 'active',
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.launchScene:', err);
    return false;
  }
}

/**
 * Update teacher view (hlookat, vlookat, fov) for student sync in Krpano. Only session owner can call.
 */
export async function updateTeacherView(
  sessionId: string,
  teacherUid: string,
  view: { hlookat: number; vlookat: number; fov?: number }
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists() || snap.data()?.teacher_uid !== teacherUid) return false;
    await updateDoc(sessionRef, {
      teacher_view: view,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.updateTeacherView:', err);
    return false;
  }
}

/**
 * End the session. Only session owner can call.
 */
export async function endSession(sessionId: string, teacherUid: string): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists() || snap.data()?.teacher_uid !== teacherUid) return false;

    await updateDoc(sessionRef, {
      status: 'ended',
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.endSession:', err);
    return false;
  }
}

export interface JoinSessionResult {
  sessionId: string | null;
  errorMessage?: string;
}

/**
 * Student joins a session by code. Uses backend API; returns sessionId and optional error message.
 */
export async function joinSession(sessionCode: string): Promise<JoinSessionResult> {
  try {
    const normalizedCode = sessionCode.trim().toUpperCase();
    if (!normalizedCode) return { sessionId: null, errorMessage: 'Please enter a session code.' };

    const token = await auth.currentUser?.getIdToken();
    if (!token) return { sessionId: null, errorMessage: 'You must be signed in to join a session.' };

    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '');
    const response = await fetch(`${apiBaseUrl}/class-sessions/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionCode: normalizedCode }),
    });

    const json = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    const message = json?.message ?? json?.error ?? null;

    if (!response.ok) {
      console.error('classSessionService.joinSession API error:', response.status, json);
      if (response.status === 401) return { sessionId: null, errorMessage: message ?? 'Please sign in again.' };
      if (response.status === 403) return { sessionId: null, errorMessage: message ?? 'You cannot join this session.' };
      if (response.status === 404) return { sessionId: null, errorMessage: message ?? 'Invalid or expired session code.' };
      return { sessionId: null, errorMessage: message ?? 'Could not join session. Try again.' };
    }

    const data = json && typeof json === 'object' && json !== null && 'data' in json ? (json as { data?: { sessionId?: string } }).data : undefined;
    const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : null;
    return { sessionId, errorMessage: sessionId ? undefined : (message ?? 'Invalid response from server.') };
  } catch (err) {
    console.error('classSessionService.joinSession:', err);
    const isFirebasePermission = err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'permission-denied';
    return {
      sessionId: null,
      errorMessage: isFirebasePermission
        ? 'You don’t have access to this session. If you just joined, try again in a moment.'
        : 'Could not join session. Check your connection and try again.',
    };
  }
}

/**
 * Subscribe to session document. Returns unsubscribe function.
 * Optional onError is called on permission/other errors so the UI can show a message or clear state.
 */
export function subscribeSession(
  sessionId: string,
  onUpdate: (session: ClassSession | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
  return onSnapshot(
    sessionRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate({ id: snap.id, ...snap.data() } as ClassSession);
    },
    (err) => {
      console.error('classSessionService.subscribeSession:', err);
      onUpdate(null);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

/**
 * Subscribe to progress subcollection for a session. Returns unsubscribe function.
 */
export function subscribeSessionProgress(
  sessionId: string,
  onUpdate: (progress: SessionStudentProgress[]) => void
): Unsubscribe {
  const progressRef = collection(db, COLLECTION_SESSIONS, sessionId, SUBCOLLECTION_PROGRESS);
  const q = progressRef; // no ordering required for list
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ ...d.data() } as SessionStudentProgress));
      onUpdate(list);
    },
    (err) => {
      console.error('classSessionService.subscribeSessionProgress:', err);
      onUpdate([]);
    }
  );
}

export interface ReportSessionQuizPayload {
  score: number;
  total: number;
  answers: SessionQuizAnswer[];
}

/**
 * Report current phase for a student in a session (called from XR player or lesson view).
 * When phase is 'completed' after quiz, pass quiz payload so teacher sees score and per-question results.
 * Pass displayName and/or email so the teacher dashboard can show name or email.
 */
export async function reportSessionProgress(
  sessionId: string,
  studentUid: string,
  displayName: string | undefined,
  phase: SessionLessonPhase,
  launchId?: string | null,
  quiz?: ReportSessionQuizPayload,
  email?: string | null
): Promise<boolean> {
  try {
    const progressRef = doc(db, COLLECTION_SESSIONS, sessionId, SUBCOLLECTION_PROGRESS, studentUid);
    const data: Record<string, unknown> = {
      student_uid: studentUid,
      display_name: displayName ?? null,
      email: email ?? null,
      phase,
      launch_id: launchId ?? null,
      last_updated: serverTimestamp(),
    };
    if (quiz && quiz.total > 0) {
      data.quiz_score = quiz.score;
      data.quiz_total = quiz.total;
      data.quiz_answers = quiz.answers;
    }
    await setDoc(progressRef, data, { merge: true });
    return true;
  } catch (err) {
    console.error('classSessionService.reportSessionProgress:', err);
    return false;
  }
}

/**
 * Get session by id (one-off read). Useful after join.
 */
export async function getSession(sessionId: string): Promise<ClassSession | null> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ClassSession;
  } catch (err) {
    console.error('classSessionService.getSession:', err);
    return null;
  }
}
