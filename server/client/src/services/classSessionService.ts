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
  writeBatch,
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
  TeacherPlayback,
  SessionLobbyMember,
  TeacherAnnotations,
  AnnotationStroke,
  TeacherImmersiveRequest,
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
/**
 * A session nobody explicitly ended is treated as abandoned once it has been
 * untouched for this long. Without this, a teacher who simply closed the tab
 * leaves a session that shows as live forever and that students can still join.
 */
export const SESSION_STALE_AFTER_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Milliseconds since a session's last write, or null if the stamp is unusable. */
export function sessionAgeMs(session: Pick<ClassSession, 'updated_at' | 'created_at'>): number | null {
  const raw = (session.updated_at ?? session.created_at) as unknown;
  if (!raw) return null;
  const asDate =
    typeof (raw as { toDate?: () => Date })?.toDate === 'function'
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(raw as string);
  const t = asDate.getTime();
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

/** True when a session should no longer be shown or joinable. */
export function isSessionStale(session: Pick<ClassSession, 'updated_at' | 'created_at' | 'status'>): boolean {
  if (session.status === 'ended') return true;
  const age = sessionAgeMs(session);
  return age !== null && age > SESSION_STALE_AFTER_MS;
}

/**
 * End every still-open session belonging to this teacher.
 *
 * Only one lesson may be live at a time, so starting or launching anywhere
 * closes the rest. This is also what stops students joining a stale session:
 * previously nothing ever moved a session to 'ended' unless the teacher
 * remembered to click End Session.
 */
export async function endOtherSessionsForTeacher(
  teacherUid: string,
  exceptSessionId?: string | null
): Promise<number> {
  try {
    const q = query(
      collection(db, COLLECTION_SESSIONS),
      where('teacher_uid', '==', teacherUid),
      where('status', 'in', ['waiting', 'active'])
    );
    const snap = await getDocs(q);
    const stale = snap.docs.filter((d) => d.id !== exceptSessionId);
    if (stale.length === 0) return 0;

    // Chunked: Firestore batches cap at 500 writes.
    let closed = 0;
    for (let i = 0; i < stale.length; i += 400) {
      const batch = writeBatch(db);
      stale.slice(i, i + 400).forEach((d) => {
        batch.update(d.ref, { status: 'ended', updated_at: serverTimestamp() });
        closed += 1;
      });
      await batch.commit();
    }
    return closed;
  } catch (err) {
    console.error('classSessionService.endOtherSessionsForTeacher:', err);
    return 0;
  }
}

/**
 * Re-issue the current launch so every joined student is pulled into the lesson,
 * including anyone who navigated away. ClassLaunchRouter dedupes on launch_id, so
 * a fresh id is what makes it act again.
 */
export async function forceStudentsToLesson(sessionId: string): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return false;
    const launched = snap.data()?.launched_lesson as LaunchedLesson | null | undefined;
    if (!launched) return false;
    await updateDoc(sessionRef, {
      launched_lesson: {
        ...launched,
        launch_id: `force_${Date.now()}`,
      },
      status: 'active',
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.forceStudentsToLesson:', err);
    return false;
  }
}

export async function createSession(
  teacherUid: string,
  schoolId: string,
  classId: string
): Promise<string | null> {
  try {
    // One live lesson at a time: close anything this teacher left open.
    await endOtherSessionsForTeacher(teacherUid);

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
  teacherUid: string,
  payload: LaunchedLesson
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return false;

    // Launching makes this the one live lesson — close any other open session.
    if (teacherUid) await endOtherSessionsForTeacher(teacherUid, sessionId);

    await updateDoc(sessionRef, {
      // Always stamp a launch id so relaunching the same topic still reaches students.
      launched_lesson: stripUndefinedDeep({
        ...payload,
        launch_id: payload.launch_id || `launch_${Date.now()}`,
      }),
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
    // Name the likely cause rather than dumping a bare FirebaseError. A denied write here
    // means the rules' classSessionLaunchKeysOnly()/canHostClassSession() guard rejected
    // it, which is not obvious from the message Firestore returns.
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'permission-denied') {
      console.error(
        'classSessionService.endSession: permission denied writing status=ended. ' +
          'Check that the signed-in user still satisfies canHostClassSession() for this ' +
          'session, and that "status" is in classSessionLaunchKeysOnly().',
        { sessionId, err }
      );
    } else {
      console.error('classSessionService.endSession:', err);
    }
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
  onUpdate: (progress: SessionStudentProgress[]) => void,
  onError?: (err: unknown) => void
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
      // Without onError a permission failure is indistinguishable from "no students joined".
      console.error('classSessionService.subscribeSessionProgress:', err);
      onUpdate([]);
      onError?.(err);
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
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as ClassSession))
      .filter((s) => !isSessionStale(s));
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

/**
 * Show or hide the in-headset panel for STUDENTS only, while control is held.
 * The teacher's own panel is never affected — they need the in-VR controls.
 */
export async function setStudentUiVisible(
  sessionId: string,
  visible: boolean
): Promise<boolean> {
  try {
    await updateDoc(doc(db, COLLECTION_SESSIONS, sessionId), {
      student_ui_visible: visible,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.setStudentUiVisible:', err);
    return false;
  }
}

/**
 * Turn lockstep ("Control Students") on or off.
 *
 * Enabling deliberately leaves the class HELD: `teacher_controlled_phase` stays
 * null and playback is 'idle', so students load the scene but nothing plays until
 * the teacher presses Play. This is the state the old overlay toggle could never
 * reach, because it broadcast a phase at the same moment it enabled control.
 */
export async function setSessionControl(
  sessionId: string,
  enabled: boolean,
  /** Also ask the class to move into immersive mode. */
  requestImmersive = false
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    const heldPlayback: TeacherPlayback = {
      state: 'idle',
      phase: null,
      play_token: 0,
      at_ms: Date.now(),
    };
    if (enabled) {
      const immersive: TeacherImmersiveRequest | null = requestImmersive
        ? { requested: true, token: Date.now(), at_ms: Date.now() }
        : null;
      await updateDoc(sessionRef, {
        control_students_enabled: true,
        teacher_controlled_phase: null,
        teacher_playback: heldPlayback,
        ...(requestImmersive ? { teacher_immersive_request: immersive } : {}),
        updated_at: serverTimestamp(),
      });
    } else {
      // Releasing control also releases immersive: students get their chrome back.
      // The student panel is NOT reset here — it follows Start class, not control, and
      // stays as the teacher last set it for the lesson.
      await updateDoc(sessionRef, {
        control_students_enabled: false,
        teacher_immersive_request: null,
        updated_at: serverTimestamp(),
      });
    }
    return true;
  } catch (err) {
    console.error('classSessionService.setSessionControl:', err);
    return false;
  }
}

/**
 * Set the teacher-driven playback gate. Writes `teacher_playback` and
 * `teacher_controlled_phase` in one update so the existing student phase-lock
 * stays consistent with the new playback state.
 */
export async function setTeacherPlayback(
  sessionId: string,
  playback: Omit<TeacherPlayback, 'at_ms'>
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      teacher_playback: { ...playback, at_ms: Date.now() },
      teacher_controlled_phase: playback.phase,
      // Starting the class makes the student panel visible again.
      //
      // The comment on setSessionControl has always said the panel "follows
      // Start class", but nothing implemented it: student_ui_visible was only
      // ever written by the teacher's manual toggle. Once a teacher had used
      // that toggle, the flag stayed false for the rest of the session and
      // students never saw the lesson panel again — including the quiz. The
      // teacher can still hide it deliberately after pressing Play.
      ...(playback.state === 'playing' ? { student_ui_visible: true } : {}),
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.setTeacherPlayback:', err);
    return false;
  }
}

/**
 * Publish the waiting-room roster. Students can only read their own progress doc,
 * so the host mirrors names (never scores) onto the session doc for the lobby.
 */
export async function publishLobbyRoster(
  sessionId: string,
  roster: SessionLobbyMember[]
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      lobby_roster: roster,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.publishLobbyRoster:', err);
    return false;
  }
}

/**
 * Record attendance for a student. `joined_at` is write-once: it is only included
 * when the progress doc does not already carry one, so the merge writes below
 * never reset the arrival time.
 */
export async function reportAttendance(
  sessionId: string,
  studentUid: string,
  fields: { lessonReady?: boolean; left?: boolean; durationSeconds?: number }
): Promise<boolean> {
  try {
    const progressRef = doc(db, COLLECTION_SESSIONS, sessionId, SUBCOLLECTION_PROGRESS, studentUid);
    const existing = await getDoc(progressRef);
    const data: Record<string, unknown> = {
      student_uid: studentUid,
      last_active_at: serverTimestamp(),
    };
    if (!existing.exists() || !existing.data()?.joined_at) {
      data.joined_at = serverTimestamp();
    }
    if (fields.lessonReady !== undefined) data.lesson_ready = fields.lessonReady;
    if (fields.left) data.left_at = serverTimestamp();
    if (fields.durationSeconds !== undefined) data.duration_seconds = fields.durationSeconds;
    await setDoc(progressRef, data, { merge: true });
    return true;
  } catch (err) {
    console.error('classSessionService.reportAttendance:', err);
    return false;
  }
}

/**
 * Publish the teacher's marker strokes to the class.
 *
 * Written on pointer-up only, never during a drag: the teacher sees their own
 * stroke locally at full framerate, and the class receives it complete. That
 * trades a little latency for roughly a 50x reduction in writes.
 *
 * NOTE: `teacher_annotations` must be present in classSessionLaunchKeysOnly()
 * in firestore.rules or this write is denied — and every write here swallows its
 * error, so a missed rules deploy looks like "the marker does nothing".
 */
export async function publishAnnotations(
  sessionId: string,
  annotations: TeacherAnnotations
): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      teacher_annotations: stripUndefinedDeep(annotations),
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('classSessionService.publishAnnotations:', err);
    notifyAnnotationWriteDenied(err);
    return false;
  }
}

/**
 * Tell the teacher once when ink is not reaching the class.
 *
 * updateDoc is latency-compensated: the teacher's own client renders the stroke from the
 * optimistic local snapshot whether or not the server accepts it, and a rejection is
 * reverted inside a window shorter than the 6.5s stroke TTL. So a denied write is
 * invisible to the person drawing and total for everyone else. Announce it rather than
 * letting "the marker silently does nothing" happen twice.
 */
let annotationWriteDeniedReported = false;
function notifyAnnotationWriteDenied(err: unknown): void {
  if (annotationWriteDeniedReported) return;
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code !== 'permission-denied') return;
  annotationWriteDeniedReported = true;
  console.error(
    '[classSession] Marker ink is NOT reaching students: the session write was denied. ' +
      "Check that classSessionLaunchKeysOnly() in firestore.rules lists 'teacher_annotations' " +
      'and that the rules are deployed to the Firestore project.'
  );
  try {
    (window as unknown as { __onAnnotationWriteDenied?: () => void }).__onAnnotationWriteDenied?.();
  } catch {
    /* no listener mounted */
  }
}

/** Wipe all ink and any in-flight laser stroke for the class. */
export async function clearAnnotations(sessionId: string): Promise<boolean> {
  const cleared: TeacherAnnotations = {
    strokes: [],
    laser: null,
    sync_id: Date.now(),
    cleared_at: Date.now(),
  };
  return publishAnnotations(sessionId, cleared);
}

/** Convenience: append one stroke to the existing set, applying caps. */
export function appendStroke(
  current: TeacherAnnotations | null | undefined,
  stroke: AnnotationStroke,
  maxInkStrokes: number
): TeacherAnnotations {
  const base: TeacherAnnotations = current ?? {
    strokes: [],
    laser: null,
    sync_id: 0,
    cleared_at: 0,
  };
  if (stroke.mode === 'laser') {
    return { ...base, laser: stroke, sync_id: Date.now() };
  }
  const strokes = [...(base.strokes ?? []), stroke];
  // Oldest ink drops out first once we hit the cap.
  const trimmed = strokes.length > maxInkStrokes ? strokes.slice(strokes.length - maxInkStrokes) : strokes;
  return { ...base, strokes: trimmed, sync_id: Date.now() };
}

/** Raise or lower a student's hand, or send a quick signal to the teacher. */
export async function reportStudentSignal(
  sessionId: string,
  studentUid: string,
  input: { handRaised?: boolean; signal?: 'help' | 'too_fast' | 'ok' | null }
): Promise<boolean> {
  try {
    const progressRef = doc(db, COLLECTION_SESSIONS, sessionId, SUBCOLLECTION_PROGRESS, studentUid);
    const data: Record<string, unknown> = {
      student_uid: studentUid,
      last_active_at: serverTimestamp(),
    };
    if (input.handRaised !== undefined) {
      data.hand_raised = input.handRaised;
      data.hand_raised_at = input.handRaised ? serverTimestamp() : null;
      if (input.handRaised) {
        const existing = await getDoc(progressRef);
        const count = Number(existing.data()?.hand_raise_count ?? 0);
        data.hand_raise_count = count + 1;
      }
    }
    if (input.signal !== undefined) {
      data.signal = input.signal;
      data.signal_at = input.signal ? serverTimestamp() : null;
    }
    await setDoc(progressRef, data, { merge: true });
    return true;
  } catch (err) {
    console.error('classSessionService.reportStudentSignal:', err);
    return false;
  }
}
