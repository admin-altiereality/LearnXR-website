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
  getDocs,
  query,
  where,
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
  SessionStudentView,
  SessionLessonPhase,
  SessionQuizAnswer,
  TeacherContentState,
} from '../types/lms';

const COLLECTION_SESSIONS = 'class_sessions';
const SUBCOLLECTION_PROGRESS = 'progress';

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I to avoid confusion

/**
 * Firestore updateDoc/setDoc reject `undefined` field values.
 * Remove undefined keys recursively for plain objects and arrays.
 */
function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedDeep(v);
  }
  return out as T;
}

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
 * Launch a curriculum lesson to the class.
 * Host authorization is enforced by Firestore rules (owner, managing teacher, school/principal).
 */
export async function launchLesson(
  sessionId: string,
  _teacherUid: string,
  payload: LaunchedLesson
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return false;

    await updateDoc(sessionRef, {
      launched_lesson: stripUndefinedDeep(payload),
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

export async function updateTeacherContentState(
  sessionId: string,
  _teacherUid: string,
  state: TeacherContentState,
): Promise<boolean> {
  try {
    await updateDoc(doc(db, COLLECTION_SESSIONS, sessionId), {
      teacher_content_state: stripUndefinedDeep(state),
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.updateTeacherContentState:', err);
    return false;
  }
}

/**
 * Launch current Create-page scene to the class.
 * Host authorization is enforced by Firestore rules.
 */
export async function launchScene(
  sessionId: string,
  _teacherUid: string,
  payload: LaunchedScene
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return false;

    await updateDoc(sessionRef, {
      launched_scene: stripUndefinedDeep(payload),
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
 * Update teacher/host view for student sync in Krpano / VR360.
 * Host authorization is enforced by Firestore rules.
 * Caches session existence per session+uid to avoid repeated getDoc on every drag.
 *
 * Pass `force: true` (or an explicit `sync_id`) for “Direct class to my view” so
 * students re-apply even when look-at values match the last applied snapshot.
 *
 * Uses dotted field paths so continuous drag updates never wipe an in-flight
 * Direct `sync_id` / playhead (full-object replace was racing students).
 */
const _teacherViewValidCache = new Map<string, boolean>();
/** Skip non-force host broadcasts briefly after Direct so students can apply cleanly. */
let _directViewCooldownUntil = 0;
const DIRECT_VIEW_COOLDOWN_MS = 2800;

export type TeacherViewUpdate = {
  hlookat: number;
  vlookat: number;
  fov?: number;
  /** When true, assigns a fresh sync_id so students always re-apply. */
  force?: boolean;
  sync_id?: number;
  video_time?: number;
  playing?: boolean;
};

export async function updateTeacherView(
  sessionId: string,
  teacherUid: string,
  view: TeacherViewUpdate
): Promise<boolean> {
  try {
    const cacheKey = `${sessionId}:${teacherUid}`;
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);

    if (!_teacherViewValidCache.has(cacheKey)) {
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) {
        console.warn('updateTeacherView: session not found', sessionId);
        _teacherViewValidCache.set(cacheKey, false);
        return false;
      }
      // Host check is enforced by Firestore rules on update
      _teacherViewValidCache.set(cacheKey, true);
    }

    if (!_teacherViewValidCache.get(cacheKey)) return false;

    const { force, ...rest } = view;
    const isDirect = force === true || typeof rest.sync_id === 'number';

    // Continuous drag must not clobber / race an explicit Direct snapshot.
    if (!isDirect && Date.now() < _directViewCooldownUntil) {
      return true;
    }

    const updates: Record<string, unknown> = {
      'teacher_view.hlookat': rest.hlookat,
      'teacher_view.vlookat': rest.vlookat,
      'teacher_view.fov': rest.fov ?? 90,
      updated_at: serverTimestamp(),
    };
    if (typeof rest.video_time === 'number' && Number.isFinite(rest.video_time)) {
      updates['teacher_view.video_time'] = rest.video_time;
    }
    if (typeof rest.playing === 'boolean') {
      updates['teacher_view.playing'] = rest.playing;
    }
    if (isDirect) {
      updates['teacher_view.sync_id'] =
        typeof rest.sync_id === 'number' ? rest.sync_id : Date.now();
      _directViewCooldownUntil = Date.now() + DIRECT_VIEW_COOLDOWN_MS;
    }

    await updateDoc(sessionRef, updates);
    return true;
  } catch (err) {
    console.error('classSessionService.updateTeacherView:', err);
    return false;
  }
}

/**
 * End the session. Host authorization is enforced by Firestore rules.
 */
export async function endSession(sessionId: string, _teacherUid: string): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return false;

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
  requiresApproval?: boolean;
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

    const data = json && typeof json === 'object' && json !== null && 'data' in json ? (json as { data?: { sessionId?: string; requiresApproval?: boolean } }).data : undefined;
    const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : null;
    const requiresApproval = data?.requiresApproval === true;
    return { sessionId, requiresApproval, errorMessage: sessionId ? undefined : (message ?? 'Invalid response from server.') };
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
 * Remove a student from a class session. Only the session owner (teacher) can call.
 * Returns true if the request succeeded.
 */
export async function removeStudentFromSession(
  sessionId: string,
  _teacherUid: string,
  studentUid: string
): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;

    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '');
    const response = await fetch(`${apiBaseUrl}/class-sessions/${sessionId}/remove-student`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ studentUid }),
    });

    if (!response.ok) {
      console.error('classSessionService.removeStudentFromSession API error:', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('classSessionService.removeStudentFromSession:', err);
    return false;
  }
}

/**
 * Approve a student's request to rejoin the session after being removed.
 */
export async function approveJoinRequest(sessionId: string, studentUid: string): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;

    const apiBaseUrl = getApiBaseUrl().replace(/\/$/, '');
    const response = await fetch(`${apiBaseUrl}/class-sessions/${sessionId}/approve-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ studentUid }),
    });
    
    if (!response.ok) {
      console.error('classSessionService.approveJoinRequest API error:', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('classSessionService.approveJoinRequest:', err);
    return false;
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
 * Report student’s current 360° view (hlookat, vlookat, fov) for teacher “see what they see” preview.
 * Merges into progress doc so phase/quiz are not overwritten.
 */
export async function reportStudentView(
  sessionId: string,
  studentUid: string,
  view: SessionStudentView
): Promise<boolean> {
  try {
    const progressRef = doc(db, COLLECTION_SESSIONS, sessionId, SUBCOLLECTION_PROGRESS, studentUid);
    await setDoc(
      progressRef,
      {
        student_uid: studentUid,
        student_view: view,
        last_updated: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('classSessionService.reportStudentView:', err);
    return false;
  }
}

/**
 * Get active sessions for a school (waiting or active). Used by JoinClassPage for students.
 */
export async function getActiveSessionsForSchool(schoolId: string): Promise<ClassSession[]> {
  try {
    const sessionsRef = collection(db, COLLECTION_SESSIONS);
    const q = query(
      sessionsRef,
      where('school_id', '==', schoolId),
      where('status', 'in', ['waiting', 'active'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession));
  } catch (err) {
    console.error('classSessionService.getActiveSessionsForSchool:', err);
    return [];
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

/**
 * Broadcast the teacher's current lesson phase to all students.
 * Students subscribe to `teacher_controlled_phase` and lock their local phase.
 * `control_students_enabled` must be true for students to follow.
 */
export async function broadcastTeacherPhase(
  sessionId: string,
  teacherUid: string,
  phase: string,
  controlEnabled: boolean
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      'teacher_controlled_phase': controlEnabled ? phase : null,
      'control_students_enabled': controlEnabled,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.broadcastTeacherPhase:', err);
    return false;
  }
}
