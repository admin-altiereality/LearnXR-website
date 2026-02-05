/**
 * AI Teacher Support API Service
 * Lesson plans, content suggestions, rubrics
 */

import api from '../config/axios';

export interface LessonPlanResponse {
  title: string;
  objectives: string[];
  materials: string[];
  steps: Array<{ step: number; description: string; duration?: string }>;
  assessmentIdeas: string[];
  differentiationTips: string[];
}

export interface RubricResponse {
  criteria: Array<{
    name: string;
    levels: Array<{ level: string; description: string }>;
  }>;
  maxScore: number;
}

export async function generateLessonPlan(params: {
  subject: string;
  classLevel?: string;
  curriculum?: string;
  topic: string;
  durationMinutes?: number;
}): Promise<LessonPlanResponse> {
  const { data } = await api.post<{ success: boolean; data?: LessonPlanResponse; error?: string }>(
    '/ai-education/teacher-support/lesson-plan',
    params
  );
  if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to generate lesson plan');
  return data.data;
}

export async function getContentSuggestions(params: {
  subject: string;
  classLevel?: string;
  topic: string;
  type: 'examples' | 'activities' | 'discussion_questions' | 'real_world_connections';
}): Promise<{ items: string[] }> {
  const { data } = await api.post<{ success: boolean; data?: { items: string[] }; error?: string }>(
    '/ai-education/teacher-support/content-suggestions',
    params
  );
  if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to get content suggestions');
  return data.data;
}

export async function generateRubric(params: {
  subject: string;
  classLevel?: string;
  assignmentType: string;
  criteriaCount?: number;
}): Promise<RubricResponse> {
  const { data } = await api.post<{ success: boolean; data?: RubricResponse; error?: string }>(
    '/ai-education/teacher-support/rubric',
    params
  );
  if (!data.success || !data.data) throw new Error(data.error ?? 'Failed to generate rubric');
  return data.data;
}
