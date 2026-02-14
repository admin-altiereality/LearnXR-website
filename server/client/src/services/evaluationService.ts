/**
 * Evaluation API client
 * Fetches aggregated evaluation data (scores + assessment attempts + completion)
 * for students and classes from the LMS evaluation endpoints.
 */

import api from '../config/axios';

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
  recentScores: unknown[];
  recentAttempts: unknown[];
  bySubject: EvaluationBySubject[];
  byTopic: EvaluationByTopic[];
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

export interface GetStudentEvaluationParams {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface GetClassEvaluationParams {
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export async function getStudentEvaluation(
  studentId: string,
  params?: GetStudentEvaluationParams
): Promise<StudentEvaluation> {
  const searchParams = new URLSearchParams();
  if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) searchParams.set('toDate', params.toDate);
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  const url = `/lms/students/${encodeURIComponent(studentId)}/evaluation${query ? `?${query}` : ''}`;
  const { data } = await api.get<{ success: boolean; data: StudentEvaluation }>(url);
  if (!data.success || !data.data) throw new Error('Failed to fetch student evaluation');
  return data.data;
}

export async function getClassEvaluation(
  classId: string,
  params?: GetClassEvaluationParams
): Promise<ClassEvaluation | null> {
  const searchParams = new URLSearchParams();
  if (params?.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) searchParams.set('toDate', params.toDate);
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  const url = `/lms/classes/${encodeURIComponent(classId)}/evaluation${query ? `?${query}` : ''}`;
  try {
    const { data } = await api.get<{ success: boolean; data: ClassEvaluation }>(url);
    if (!data.success || !data.data) return null;
    return data.data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null; // Endpoint not deployed
    throw err;
  }
}
