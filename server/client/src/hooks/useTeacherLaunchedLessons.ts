/**
 * useTeacherLaunchedLessons
 * -------------------------
 * Every lesson this teacher has launched to a class, newest first, keyed by
 * `${chapter_id}__${topic_id}` so the Lessons list can mark launched lessons
 * differently and open their stats.
 *
 * Reads `class_sessions` (which carry `launched_lesson`) rather than
 * `lesson_launches` — lesson_launches is written per STUDENT, so it does not
 * tell us what the teacher pushed to the class, and it is empty when nobody
 * joined.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { ClassSession } from '../types/lms';

export interface LaunchedLessonRecord {
  sessionId: string;
  classId: string;
  chapterId: string;
  topicId: string;
  title: string | null;
  subject: string | null;
  status: ClassSession['status'];
  launchedAt: Date | null;
  isLive: boolean;
}

export function lessonKey(chapterId: string, topicId: string): string {
  return `${chapterId}__${topicId}`;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function useTeacherLaunchedLessons() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  const canHost = ['teacher', 'partner', 'principal', 'school', 'admin', 'superadmin'].includes(
    profile?.role ?? ''
  );

  useEffect(() => {
    if (!user?.uid || !canHost) {
      setSessions([]);
      setLoading(false);
      return;
    }
    // teacher_uid only — no orderBy, so this needs no composite index and cannot
    // fail closed on a missing one.
    const q = query(collection(db, 'class_sessions'), where('teacher_uid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession)));
        setLoading(false);
      },
      (err) => {
        console.error('useTeacherLaunchedLessons:', err);
        setSessions([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid, canHost]);

  /** Newest launch per lesson, keyed by chapter+topic. */
  const byLesson = useMemo(() => {
    const map = new Map<string, LaunchedLessonRecord>();
    sessions.forEach((s) => {
      const l = s.launched_lesson;
      if (!l?.chapter_id || !l?.topic_id) return;
      const key = lessonKey(l.chapter_id, l.topic_id);
      const launchedAt = toDate(s.updated_at) ?? toDate(s.created_at);
      const record: LaunchedLessonRecord = {
        sessionId: s.id,
        classId: s.class_id,
        chapterId: l.chapter_id,
        topicId: l.topic_id,
        title: l.title ?? null,
        subject: l.subject ?? null,
        status: s.status,
        launchedAt,
        isLive: s.status !== 'ended',
      };
      const existing = map.get(key);
      if (
        !existing ||
        (launchedAt && existing.launchedAt && launchedAt > existing.launchedAt) ||
        (launchedAt && !existing.launchedAt)
      ) {
        map.set(key, record);
      }
    });
    return map;
  }, [sessions]);

  /** Every launch, newest first — one row per session. */
  const history = useMemo(() => {
    return sessions
      .filter((s) => s.launched_lesson?.chapter_id)
      .map((s) => {
        const l = s.launched_lesson!;
        const launchedAt = toDate(s.updated_at) ?? toDate(s.created_at);
        return {
          sessionId: s.id,
          classId: s.class_id,
          chapterId: l.chapter_id,
          topicId: l.topic_id,
          title: l.title ?? null,
          subject: l.subject ?? null,
          status: s.status,
          launchedAt,
          isLive: s.status !== 'ended',
        } as LaunchedLessonRecord;
      })
      .sort((a, b) => (b.launchedAt?.getTime() ?? 0) - (a.launchedAt?.getTime() ?? 0));
  }, [sessions]);

  return { byLesson, history, loading };
}
