/**
 * Personalized Learning API Service
 * Fetches AI-powered recommendations for students
 */

import api from '../config/axios';

export interface LearningRecommendation {
  recommendedTopicIds: string[];
  recommendedChapterIds: string[];
  strengths: string[];
  areasToImprove: string[];
  studyTips: string[];
  nextBestAction: string;
  reasoning: string;
}

export interface StudentAnalytics {
  subjectsLearned: string[];
  totalMcqsAnswered: number;
  assessmentAttemptsCount?: number; // Deprecated - assessment feature removed
}

export interface SubjectScoreSummary {
  subject: string;
  averageScore: number;
  attemptCount: number;
}

export interface TopicScoreSummary {
  chapterId: string;
  topicId: string;
  subject?: string;
  averageScore: number;
  attemptCount: number;
}

export interface IncompleteLesson {
  chapterId: string;
  topicId: string;
  subject?: string;
  curriculum?: string;
  className?: string;
  launchedAt?: string;
  status: 'in_progress' | 'abandoned';
}

export interface LearningSummary {
  subjectsWithLowScores: SubjectScoreSummary[];
  subjectsWithHighScores: SubjectScoreSummary[];
  topicsWithLowScores: TopicScoreSummary[];
  topicsWithHighScores: TopicScoreSummary[];
  incompleteLessons: IncompleteLesson[];
}

export interface PersonalizedLearningResponse {
  data: LearningRecommendation;
  meta?: { fallback?: boolean; viewedStudentId?: string; analytics?: StudentAnalytics; learningSummary?: LearningSummary };
}

export async function getPersonalizedRecommendations(studentId?: string): Promise<PersonalizedLearningResponse> {
  try {
    const url = studentId
      ? `/ai-education/personalized-learning/recommendations?studentId=${encodeURIComponent(studentId)}`
      : '/ai-education/personalized-learning/recommendations';
    const { data } = await api.get<{
      success: boolean;
      data?: LearningRecommendation;
      error?: string;
      meta?: { fallback?: boolean; viewedStudentId?: string; analytics?: StudentAnalytics; learningSummary?: LearningSummary };
    }>(url);
    if (!data.success || !data.data) throw new Error(data?.error || 'Failed to load recommendations');
    return { data: data.data, meta: data.meta };
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response
        ? (err.response as { data?: { error?: string; message?: string } }).data?.error ||
          (err.response as { data?: { error?: string; message?: string } }).data?.message
        : null;
    throw new Error(message || (err instanceof Error ? err.message : 'Failed to load recommendations'));
  }
}
