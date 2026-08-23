/**
 * useLiveClassSessions
 * --------------------
 * Live discovery of class sessions a student may join.
 *
 * Replaces the two 15-second pollers that used to live inside StudentDashboard
 * and JoinClassPage. Uses onSnapshot so the top bar appears the instant a
 * teacher starts a session, with no reload.
 *
 * Membership is the UNION of `users/{uid}.class_ids` and `classes/{id}.student_ids`
 * — the two sides legitimately drift (onboarding writes only the user side), and
 * firestore.rules `studentInClass()` uses the same union.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isSessionStale, sessionAgeMs } from '../services/classSessionService';
import type { ClassSession } from '../types/lms';

export interface LiveClassSession extends ClassSession {
  className: string;
  teacherName: string;
  /** True once the teacher has actually launched a lesson or scene. */
  lessonLive: boolean;
}

interface ClassMeta {
  className: string;
  studentIds: string[];
  teacherName: string;
}

/**
 * @param scope 'my-classes' (default) restricts to the student's own classes.
 *              'school' returns every waiting/active session in the school.
 */
export function useLiveClassSessions(scope: 'my-classes' | 'school' = 'my-classes') {
  const { user, profile } = useAuth();
  const [rawSessions, setRawSessions] = useState<ClassSession[]>([]);
  const [classMeta, setClassMeta] = useState<Record<string, ClassMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache of class docs we've already resolved, so we only fetch new class ids.
  const metaCacheRef = useRef<Record<string, ClassMeta>>({});

  const schoolId = profile?.school_id;
  const isStudent = profile?.role === 'student';
  const isGuest = profile?.isGuest === true;
  const enabled = Boolean(user?.uid && isStudent && schoolId && !isGuest);

  // Live subscription to the school's waiting/active sessions.
  // Sessions are CREATED as 'waiting' and only flip to 'active' on launch,
  // so both statuses must be included or a freshly started session is missed.
  useEffect(() => {
    if (!enabled || !schoolId) {
      setRawSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'class_sessions'),
      where('school_id', '==', schoolId),
      where('status', 'in', ['waiting', 'active'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession));
        // Drop abandoned sessions, then keep only the NEWEST open session per class.
        // Without this, every session a teacher ever left open still reads as live
        // and a student can join a dead one instead of today's lesson.
        const fresh = all.filter((s) => !isSessionStale(s));
        const newestPerClass = new Map<string, ClassSession>();
        fresh.forEach((s) => {
          const current = newestPerClass.get(s.class_id);
          if (!current) {
            newestPerClass.set(s.class_id, s);
            return;
          }
          const currentAge = sessionAgeMs(current) ?? Number.MAX_SAFE_INTEGER;
          const candidateAge = sessionAgeMs(s) ?? Number.MAX_SAFE_INTEGER;
          if (candidateAge < currentAge) newestPerClass.set(s.class_id, s);
        });
        setRawSessions([...newestPerClass.values()]);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('useLiveClassSessions:', err);
        setRawSessions([]);
        setError('Could not check for live classes.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [enabled, schoolId]);

  // Resolve class name / roster / teacher name for any class id we haven't seen.
  const classIdsKey = useMemo(
    () => [...new Set(rawSessions.map((s) => s.class_id).filter(Boolean))].sort().join(','),
    [rawSessions]
  );

  useEffect(() => {
    const classIds = classIdsKey ? classIdsKey.split(',') : [];
    const missing = classIds.filter((id) => !metaCacheRef.current[id]);
    if (missing.length === 0) {
      setClassMeta({ ...metaCacheRef.current });
      return;
    }
    let cancelled = false;
    (async () => {
      // allSettled, never all: one permission-denied must not blank the whole list.
      const classResults = await Promise.allSettled(
        missing.map((id) => getDoc(doc(db, 'classes', id)))
      );
      const teacherUidByClass: Record<string, string> = {};
      classResults.forEach((res, i) => {
        if (res.status !== 'fulfilled' || !res.value.exists()) return;
        const data = res.value.data() as Record<string, unknown>;
        const id = missing[i];
        metaCacheRef.current[id] = {
          className: (data.class_name as string) || (data.name as string) || id,
          studentIds: Array.isArray(data.student_ids)
            ? (data.student_ids as unknown[]).filter(
                (v): v is string => typeof v === 'string' && v.length > 0
              )
            : [],
          teacherName: 'Your teacher',
        };
        const classTeacher = (data.class_teacher_id as string) || '';
        if (classTeacher) teacherUidByClass[id] = classTeacher;
      });

      // Teacher names are best-effort: the users read rule only allows a student to
      // read teachers whose managed_class_ids intersect their own class_ids, so a
      // denial here is expected and must degrade to the fallback label.
      const teacherEntries = Object.entries(teacherUidByClass);
      if (teacherEntries.length > 0) {
        const teacherResults = await Promise.allSettled(
          teacherEntries.map(([, uid]) => getDoc(doc(db, 'users', uid)))
        );
        teacherResults.forEach((res, i) => {
          if (res.status !== 'fulfilled' || !res.value.exists()) return;
          const data = res.value.data() as Record<string, unknown>;
          const [classId] = teacherEntries[i];
          const name =
            (data.name as string) || (data.displayName as string) || (data.email as string);
          if (name && metaCacheRef.current[classId]) {
            metaCacheRef.current[classId].teacherName = name;
          }
        });
      }
      if (!cancelled) setClassMeta({ ...metaCacheRef.current });
    })();
    return () => {
      cancelled = true;
    };
  }, [classIdsKey]);

  const sessions = useMemo<LiveClassSession[]>(() => {
    if (!user?.uid) return [];
    const myClassIds = new Set(
      Array.isArray(profile?.class_ids) ? profile!.class_ids!.filter(Boolean) : []
    );
    return rawSessions
      .filter((session) => {
        if (scope === 'school') return true;
        if (myClassIds.has(session.class_id)) return true;
        return classMeta[session.class_id]?.studentIds.includes(user.uid) === true;
      })
      .map((session) => ({
        ...session,
        className: classMeta[session.class_id]?.className || session.class_id,
        teacherName: classMeta[session.class_id]?.teacherName || 'Your teacher',
        lessonLive: Boolean(session.launched_lesson || session.launched_scene),
      }));
  }, [rawSessions, classMeta, scope, user?.uid, profile?.class_ids]);

  return { sessions, loading, error };
}
