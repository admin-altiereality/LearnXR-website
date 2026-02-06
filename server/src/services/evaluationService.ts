/**
 * Evaluation Service
 *
 * Aggregates assessment data (student_scores + assessment_attempts) and lesson
 * progress (lesson_launches) to provide a single "evaluation" view per student
 * or per class. Used by dashboards and reporting.
 */

import * as admin from 'firebase-admin';
import { db, isFirebaseInitialized } from '../config/firebase-admin';
import { getAttemptsByStudent } from './assessmentService';
import type { AssessmentAttempt } from './assessmentService';

// ---------------------------------------------------------------------------
// Types (raw Firestore shapes used in this service)
// ---------------------------------------------------------------------------

export interface StudentScoreRecord {
  id?: string;
  student_id: string;
  school_id?: string;
  class_id?: string;
  chapter_id: string;
  topic_id: string;
  curriculum?: string;
  class_name?: string;
  subject?: string;
  attempt_number?: number;
  score?: { correct: number; total: number; percentage: number };
  answers?: Record<string, number>;
  completed_at: admin.firestore.Timestamp | string;
  time_taken_seconds?: number;
  topic_objective?: string;
  learning_objective_id?: string;
}

export interface LessonLaunchRecord {
  id?: string;
  student_id: string;
  school_id?: string;
  class_id?: string;
  chapter_id: string;
  topic_id: string;
  curriculum?: string;
  class_name?: string;
  subject?: string;
  launched_at: admin.firestore.Timestamp | string;
  completed_at?: admin.firestore.Timestamp | string;
  completion_status: 'in_progress' | 'completed' | 'abandoned';
  duration_seconds?: number;
}

export interface EvaluationBySubject {
  subject: string;
  attemptCount: number;
  averageScore: number;
  lastScore: number | null;
  lastAttemptAt: string | null;
}

export interface EvaluationByTopic {
  chapterId: string;
  topicId: string;
  subject: string;
  curriculum?: string;
  attemptCount: number;
  averageScore: number;
  lastScore: number | null;
  lastAttemptAt: string | null;
  topicObjective?: string;
}

/** Learning objective progress: met when score for that topic >= 70% */
export interface EvaluationObjective {
  chapterId: string;
  topicId: string;
  subject: string;
  topicObjective?: string;
  met: boolean;
  scoreUsed: number;
  attemptCount: number;
}

export interface StudentEvaluationSummary {
  studentId: string;
  averageScore: number;
  totalAttempts: number;
  completedLessons: number;
  totalLessonLaunches: number;
  completionRate: number;
}

export interface StudentEvaluation {
  studentId: string;
  recentScores: StudentScoreRecord[];
  recentAttempts: (AssessmentAttempt & { subject?: string; title?: string })[];
  bySubject: EvaluationBySubject[];
  byTopic: EvaluationByTopic[];
  /** Learning objectives derived from topic scores (met when score >= 70%) */
  objectives: EvaluationObjective[];
  completion: {
    totalLessonLaunches: number;
    completedLessons: number;
    completionRate: number;
  };
  options?: { fromDate?: string; toDate?: string; limit?: number };
}

export interface ClassEvaluation {
  classId: string;
  studentSummaries: StudentEvaluationSummary[];
  aggregate: {
    totalAttempts: number;
    averageScore: number;
    completionRate: number;
    totalLessonLaunches: number;
    completedLessons: number;
  };
  bySubject: EvaluationBySubject[];
  options?: { fromDate?: string; toDate?: string; limit?: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timestampToDate(ts: admin.firestore.Timestamp | string): Date {
  if (typeof ts === 'string') return new Date(ts);
  return ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000);
}

function inDateRange(
  date: Date,
  fromDate?: string,
  toDate?: string
): boolean {
  if (fromDate && date < new Date(fromDate)) return false;
  if (toDate && date > new Date(toDate)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// getStudentEvaluation
// ---------------------------------------------------------------------------

export async function getStudentEvaluation(
  studentId: string,
  options?: { fromDate?: string; toDate?: string; limit?: number }
): Promise<StudentEvaluation | null> {
  if (!isFirebaseInitialized() || !db) {
    throw new Error('Database not available');
  }

  const limit = Math.min(options?.limit ?? 200, 500);
  const fromDate = options?.fromDate;
  const toDate = options?.toDate;

  const scoresRef = db.collection('student_scores');
  const launchesRef = db.collection('lesson_launches');

  const [scoresSnap, launchesSnap] = await Promise.all([
    scoresRef
      .where('student_id', '==', studentId)
      .orderBy('completed_at', 'desc')
      .limit(limit)
      .get(),
    launchesRef
      .where('student_id', '==', studentId)
      .orderBy('launched_at', 'desc')
      .limit(limit)
      .get(),
  ]);

  const rawScores = scoresSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as StudentScoreRecord[];

  const rawLaunches = launchesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as LessonLaunchRecord[];

  let attempts = await getAttemptsByStudent(studentId);
  if (attempts.length > limit) {
    attempts = attempts.slice(0, limit);
  }

  const assessmentIds = [...new Set(attempts.map((a) => a.assessmentId))];
  const assessmentMap = new Map<string, { subject?: string; title?: string }>();
  const batchSize = 10;
  for (let i = 0; i < assessmentIds.length; i += batchSize) {
    const batch = assessmentIds.slice(i, i + batchSize);
    const assessmentSnap = await db
      .collection('assessments')
      .where(admin.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    assessmentSnap.docs.forEach((d) => {
      const data = d.data();
      assessmentMap.set(d.id, { subject: data.subject, title: data.title });
    });
  }

  const filterByDate = <T extends { completed_at?: unknown; completedAt?: unknown }>(
    items: T[],
    getDate: (x: T) => Date
  ): T[] => {
    if (!fromDate && !toDate) return items;
    return items.filter((x) => inDateRange(getDate(x), fromDate, toDate));
  };

  const scores = filterByDate(rawScores, (s) => timestampToDate(s.completed_at));
  const launches = filterByDate(rawLaunches, (l) => timestampToDate(l.launched_at));
  const attemptsFiltered = filterByDate(attempts, (a) =>
    typeof a.completedAt === 'string' ? new Date(a.completedAt) : (a.completedAt as admin.firestore.Timestamp).toDate()
  );

  const recentScores = scores.slice(0, 50);
  const recentAttempts = attemptsFiltered.slice(0, 50).map((a) => ({
    ...a,
    subject: assessmentMap.get(a.assessmentId)?.subject,
    title: assessmentMap.get(a.assessmentId)?.title,
  }));

  const bySubjectMap = new Map<string, { total: number; sum: number; lastScore: number; lastAt: string }>();
  for (const s of scores) {
    const sub = s.subject || 'General';
    const pct = s.score?.percentage ?? 0;
    const at = typeof s.completed_at === 'string' ? s.completed_at : timestampToDate(s.completed_at).toISOString();
    if (!bySubjectMap.has(sub)) {
      bySubjectMap.set(sub, { total: 0, sum: 0, lastScore: pct, lastAt: at });
    }
    const rec = bySubjectMap.get(sub)!;
    rec.total += 1;
    rec.sum += pct;
    if (at > rec.lastAt) {
      rec.lastScore = pct;
      rec.lastAt = at;
    }
  }
  for (const a of attemptsFiltered) {
    const sub = assessmentMap.get(a.assessmentId)?.subject || 'General';
    const pct = a.score?.percentage ?? 0;
    const at =
      typeof a.completedAt === 'string'
        ? a.completedAt
        : (a.completedAt as admin.firestore.Timestamp).toDate().toISOString();
    if (!bySubjectMap.has(sub)) {
      bySubjectMap.set(sub, { total: 0, sum: 0, lastScore: pct, lastAt: at });
    }
    const rec = bySubjectMap.get(sub)!;
    rec.total += 1;
    rec.sum += pct;
    if (at > rec.lastAt) {
      rec.lastScore = pct;
      rec.lastAt = at;
    }
  }
  const bySubject: EvaluationBySubject[] = Array.from(bySubjectMap.entries()).map(
    ([subject, rec]) => ({
      subject,
      attemptCount: rec.total,
      averageScore: rec.total > 0 ? Math.round(rec.sum / rec.total) : 0,
      lastScore: rec.total > 0 ? rec.lastScore : null,
      lastAttemptAt: rec.total > 0 ? rec.lastAt : null,
    })
  );

  const byTopicMap = new Map<
    string,
    {
      subject: string;
      curriculum?: string;
      topicObjective?: string;
      total: number;
      sum: number;
      lastScore: number;
      lastAt: string;
    }
  >();
  for (const s of scores) {
    const key = `${s.chapter_id}|${s.topic_id}`;
    const pct = s.score?.percentage ?? 0;
    const at = typeof s.completed_at === 'string' ? s.completed_at : timestampToDate(s.completed_at).toISOString();
    if (!byTopicMap.has(key)) {
      byTopicMap.set(key, {
        subject: s.subject || 'General',
        curriculum: s.curriculum,
        topicObjective: s.topic_objective,
        total: 0,
        sum: 0,
        lastScore: pct,
        lastAt: at,
      });
    }
    const rec = byTopicMap.get(key)!;
    rec.total += 1;
    rec.sum += pct;
    if (at > rec.lastAt) {
      rec.lastScore = pct;
      rec.lastAt = at;
    }
    if (s.topic_objective && !rec.topicObjective) {
      rec.topicObjective = s.topic_objective;
    }
  }
  const byTopic: EvaluationByTopic[] = Array.from(byTopicMap.entries()).map(
    ([key, rec]) => {
      const [chapterId, topicId] = key.split('|');
      const avgScore = rec.total > 0 ? Math.round(rec.sum / rec.total) : 0;
      return {
        chapterId,
        topicId,
        subject: rec.subject,
        curriculum: rec.curriculum,
        attemptCount: rec.total,
        averageScore: avgScore,
        lastScore: rec.total > 0 ? rec.lastScore : null,
        lastAttemptAt: rec.total > 0 ? rec.lastAt : null,
        topicObjective: rec.topicObjective,
      };
    }
  );

  const objectives: EvaluationObjective[] = byTopic.map((t) => {
    const scoreUsed = t.lastScore ?? t.averageScore ?? 0;
    const met = scoreUsed >= 70;
    return {
      chapterId: t.chapterId,
      topicId: t.topicId,
      subject: t.subject,
      topicObjective: t.topicObjective,
      met,
      scoreUsed,
      attemptCount: t.attemptCount,
    };
  });

  const completedLessons = launches.filter((l) => l.completion_status === 'completed').length;
  const totalLessonLaunches = launches.length;
  const completionRate =
    totalLessonLaunches > 0 ? Math.round((completedLessons / totalLessonLaunches) * 100) : 0;

  return {
    studentId,
    recentScores,
    recentAttempts,
    bySubject,
    byTopic,
    objectives,
    completion: {
      totalLessonLaunches,
      completedLessons,
      completionRate,
    },
    options: { fromDate, toDate, limit },
  };
}

// ---------------------------------------------------------------------------
// getClassEvaluation
// ---------------------------------------------------------------------------

export async function getClassEvaluation(
  classId: string,
  options?: { fromDate?: string; toDate?: string; limit?: number }
): Promise<ClassEvaluation | null> {
  if (!isFirebaseInitialized() || !db) {
    throw new Error('Database not available');
  }

  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) {
    return null;
  }

  const classData = classDoc.data();
  const studentIds: string[] = classData?.student_ids || [];
  if (studentIds.length === 0) {
    return {
      classId,
      studentSummaries: [],
      aggregate: {
        totalAttempts: 0,
        averageScore: 0,
        completionRate: 0,
        totalLessonLaunches: 0,
        completedLessons: 0,
      },
      bySubject: [],
      options: options,
    };
  }

  const scoresSnap = await db
    .collection('student_scores')
    .where('class_id', '==', classId)
    .get();

  const launchesSnap = await db
    .collection('lesson_launches')
    .where('class_id', '==', classId)
    .get();

  const attemptsSnap = await db
    .collection('assessment_attempts')
    .where('classId', '==', classId)
    .get();

  const scores = scoresSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as StudentScoreRecord[];
  const launches = launchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as LessonLaunchRecord[];
  const attempts = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AssessmentAttempt[];

  const fromDate = options?.fromDate;
  const toDateOpt = options?.toDate;
  const filterScore = (s: StudentScoreRecord) => {
    if (!fromDate && !toDateOpt) return true;
    const date = timestampToDate(s.completed_at);
    return inDateRange(date, fromDate, toDateOpt);
  };
  const filterLaunch = (l: LessonLaunchRecord) => {
    if (!fromDate && !toDateOpt) return true;
    const date = timestampToDate(l.launched_at);
    return inDateRange(date, fromDate, toDateOpt);
  };
  const filterAttempt = (a: AssessmentAttempt) => {
    if (!fromDate && !toDateOpt) return true;
    const date = timestampToDate(a.completedAt as admin.firestore.Timestamp | string);
    return inDateRange(date, fromDate, toDateOpt);
  };

  const scoresFiltered = scores.filter(filterScore);
  const launchesFiltered = launches.filter(filterLaunch);
  const attemptsFiltered = attempts.filter(filterAttempt);

  const studentSummaries: StudentEvaluationSummary[] = studentIds.map((sid) => {
    const sScores = scoresFiltered.filter((s) => s.student_id === sid);
    const sLaunches = launchesFiltered.filter((l) => l.student_id === sid);
    const sAttempts = attemptsFiltered.filter((a) => a.studentId === sid);
    const totalAttempts = sScores.length + sAttempts.length;
    const avg =
      totalAttempts > 0
        ? (sScores.reduce((sum, s) => sum + (s.score?.percentage ?? 0), 0) +
          sAttempts.reduce((sum, a) => sum + (a.score?.percentage ?? 0), 0)) /
          totalAttempts
        : 0;
    const completed = sLaunches.filter((l) => l.completion_status === 'completed').length;
    const totalL = sLaunches.length;
    const completionRate = totalL > 0 ? Math.round((completed / totalL) * 100) : 0;
    return {
      studentId: sid,
      averageScore: Math.round(avg),
      totalAttempts,
      completedLessons: completed,
      totalLessonLaunches: totalL,
      completionRate,
    };
  });

  const bySubjectMap = new Map<string, { total: number; sum: number }>();
  for (const s of scoresFiltered) {
    const sub = s.subject || 'General';
    const pct = s.score?.percentage ?? 0;
    if (!bySubjectMap.has(sub)) bySubjectMap.set(sub, { total: 0, sum: 0 });
    const rec = bySubjectMap.get(sub)!;
    rec.total += 1;
    rec.sum += pct;
  }
  const assessmentIds = [...new Set(attemptsFiltered.map((a) => a.assessmentId))];
  const assessmentSubjectMap = new Map<string, string>();
  if (assessmentIds.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < assessmentIds.length; i += batchSize) {
      const batch = assessmentIds.slice(i, i + batchSize);
      const snap = await db
        .collection('assessments')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      snap.docs.forEach((d) => {
        assessmentSubjectMap.set(d.id, (d.data().subject as string) || 'General');
      });
    }
  }
  for (const a of attemptsFiltered) {
    const sub = assessmentSubjectMap.get(a.assessmentId) || 'General';
    const pct = a.score?.percentage ?? 0;
    if (!bySubjectMap.has(sub)) bySubjectMap.set(sub, { total: 0, sum: 0 });
    const rec = bySubjectMap.get(sub)!;
    rec.total += 1;
    rec.sum += pct;
  }
  const bySubject: EvaluationBySubject[] = Array.from(bySubjectMap.entries()).map(
    ([subject, rec]) => ({
      subject,
      attemptCount: rec.total,
      averageScore: rec.total > 0 ? Math.round(rec.sum / rec.total) : 0,
      lastScore: null,
      lastAttemptAt: null,
    })
  );

  const totalAttempts = scoresFiltered.length + attemptsFiltered.length;
  const totalScoreSum =
    scoresFiltered.reduce((sum, s) => sum + (s.score?.percentage ?? 0), 0) +
    attemptsFiltered.reduce((sum, a) => sum + (a.score?.percentage ?? 0), 0);
  const averageScore = totalAttempts > 0 ? Math.round(totalScoreSum / totalAttempts) : 0;
  const completedLessons = launchesFiltered.filter((l) => l.completion_status === 'completed').length;
  const totalLessonLaunches = launchesFiltered.length;
  const completionRate =
    totalLessonLaunches > 0 ? Math.round((completedLessons / totalLessonLaunches) * 100) : 0;

  return {
    classId,
    studentSummaries,
    aggregate: {
      totalAttempts,
      averageScore,
      completionRate,
      totalLessonLaunches,
      completedLessons,
    },
    bySubject,
    options: options,
  };
}
