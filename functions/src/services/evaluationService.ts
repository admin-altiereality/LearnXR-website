/**
 * Evaluation service for Firebase Functions.
 * Class evaluation only (mirrors server/src/services/evaluationService getClassEvaluation).
 */

import * as admin from 'firebase-admin';

export interface StudentEvaluationSummary {
  studentId: string;
  averageScore: number;
  totalAttempts: number;
  completedLessons: number;
  totalLessonLaunches: number;
  completionRate: number;
}

export interface EvaluationBySubject {
  subject: string;
  attemptCount: number;
  averageScore: number;
  lastScore: number | null;
  lastAttemptAt: string | null;
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

interface StudentScoreRecord {
  student_id: string;
  score?: { percentage?: number };
  completed_at: admin.firestore.Timestamp | string;
  subject?: string;
}

interface LessonLaunchRecord {
  student_id: string;
  launched_at: admin.firestore.Timestamp | string;
  completion_status: string;
}

interface AssessmentAttemptRecord {
  studentId: string;
  score?: { percentage?: number };
  completedAt: admin.firestore.Timestamp | string;
  assessmentId: string;
}

function timestampToDate(ts: admin.firestore.Timestamp | string): Date {
  if (typeof ts === 'string') return new Date(ts);
  return ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000);
}

function inDateRange(date: Date, fromDate?: string, toDate?: string): boolean {
  if (fromDate && date < new Date(fromDate)) return false;
  if (toDate && date > new Date(toDate)) return false;
  return true;
}

export async function getClassEvaluation(
  classId: string,
  options?: { fromDate?: string; toDate?: string; limit?: number }
): Promise<ClassEvaluation | null> {
  const db = admin.firestore();

  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) return null;

  const studentIds: string[] = classDoc.data()?.student_ids || [];
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

  const [scoresSnap, launchesSnap, attemptsSnap] = await Promise.all([
    db.collection('student_scores').where('class_id', '==', classId).get(),
    db.collection('lesson_launches').where('class_id', '==', classId).get(),
    db.collection('assessment_attempts').where('classId', '==', classId).get(),
  ]);

  const scores = scoresSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as StudentScoreRecord[];
  const launches = launchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as LessonLaunchRecord[];
  const attempts = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as AssessmentAttemptRecord[];

  const fromDate = options?.fromDate;
  const toDateOpt = options?.toDate;
  const filterScore = (s: StudentScoreRecord) => {
    if (!fromDate && !toDateOpt) return true;
    return inDateRange(timestampToDate(s.completed_at), fromDate, toDateOpt);
  };
  const filterLaunch = (l: LessonLaunchRecord) => {
    if (!fromDate && !toDateOpt) return true;
    return inDateRange(timestampToDate(l.launched_at), fromDate, toDateOpt);
  };
  const filterAttempt = (a: AssessmentAttemptRecord) => {
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
  const bySubject: EvaluationBySubject[] = Array.from(bySubjectMap.entries()).map(([subject, rec]) => ({
    subject,
    attemptCount: rec.total,
    averageScore: rec.total > 0 ? Math.round(rec.sum / rec.total) : 0,
    lastScore: null,
    lastAttemptAt: null,
  }));

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
