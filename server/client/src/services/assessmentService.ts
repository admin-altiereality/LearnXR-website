/**
 * Automated Assessment API Service
 * Create assessments, list, submit attempts, view results
 */

import api from '../config/axios';

export interface AssessmentQuestion {
  id: string;
  type: 'mcq' | 'short_answer' | 'true_false';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  points: number;
}

export interface Assessment {
  id: string;
  title: string;
  description?: string;
  classId: string;
  schoolId: string;
  createdBy: string;
  subject?: string;
  curriculum?: string;
  questions: AssessmentQuestion[];
  totalPoints: number;
  passingPercentage: number;
  createdAt: string;
  updatedAt: string;
}

/** Per-question result (Open edX style: show correct answer after submit) */
export interface QuestionResult {
  questionId: string;
  correct: boolean;
  pointsEarned: number;
  correctAnswer: string | number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  studentId: string;
  classId: string;
  schoolId: string;
  answers: Record<string, string | number>;
  score?: { correct: number; total: number; percentage: number; pointsEarned: number };
  questionResults?: QuestionResult[];
  gradedAt?: string;
  completedAt: string;
}

export async function createAssessment(params: {
  title: string;
  description?: string;
  classId: string;
  schoolId: string;
  subject?: string;
  curriculum?: string;
  questions: AssessmentQuestion[];
  passingPercentage?: number;
}): Promise<Assessment> {
  const { data } = await api.post<{ success: boolean; data: Assessment }>('/assessment', params);
  if (!data.success || !data.data) throw new Error('Failed to create assessment');
  return data.data;
}

export async function getAssessment(id: string): Promise<Assessment> {
  const { data } = await api.get<{ success: boolean; data: Assessment }>(`/assessment/${id}`);
  if (!data.success || !data.data) throw new Error('Assessment not found');
  return data.data;
}

export async function listAssessmentsByClass(classId: string): Promise<Assessment[]> {
  const { data } = await api.get<{ success: boolean; data: Assessment[] }>(`/assessment/class/${classId}`);
  if (!data.success) throw new Error('Failed to list assessments');
  return data.data ?? [];
}

export async function listAssessmentsForStudent(): Promise<Assessment[]> {
  const { data } = await api.get<{ success: boolean; data: Assessment[] }>('/assessment/student/me');
  if (!data.success) throw new Error('Failed to list assessments');
  return data.data ?? [];
}

export async function submitAttempt(
  assessmentId: string,
  answers: Record<string, string | number>
): Promise<AssessmentAttempt> {
  const { data } = await api.post<{ success: boolean; data: AssessmentAttempt }>(
    `/assessment/${assessmentId}/submit`,
    { answers }
  );
  if (!data.success || !data.data) throw new Error('Failed to submit attempt');
  return data.data;
}

export async function getMyAttempts(): Promise<AssessmentAttempt[]> {
  const { data } = await api.get<{ success: boolean; data: AssessmentAttempt[] }>(
    '/assessment/student/me/attempts'
  );
  if (!data.success) throw new Error('Failed to load attempts');
  return data.data ?? [];
}

export async function getAttemptsForAssessment(assessmentId: string): Promise<AssessmentAttempt[]> {
  const { data } = await api.get<{ success: boolean; data: AssessmentAttempt[] }>(
    `/assessment/${assessmentId}/attempts`
  );
  if (!data.success) throw new Error('Failed to load attempts');
  return data.data ?? [];
}
