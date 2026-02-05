/**
 * Personalized Learning Service
 * Implements patterns from awesome-ai-llm4education: knowledge-aware recommendations,
 * mastery/weakness identification from scores, and adaptive next-step prioritization.
 * Uses existing OPENAI_API_KEY.
 */

import OpenAI from 'openai';

/** Per-subject stats for personalized dashboard (low vs high scores) */
export interface SubjectScoreSummary {
  subject: string;
  averageScore: number;
  attemptCount: number;
}

/** Per-topic (chapter + topic) stats for low/high score breakdown */
export interface TopicScoreSummary {
  chapterId: string;
  topicId: string;
  subject?: string;
  averageScore: number;
  attemptCount: number;
}

/** Incomplete lesson (in_progress or abandoned) for "complete this lesson" CTA */
export interface IncompleteLesson {
  chapterId: string;
  topicId: string;
  subject?: string;
  curriculum?: string;
  className?: string;
  launchedAt?: string;
  status: 'in_progress' | 'abandoned';
}

export interface StudentProgressSummary {
  studentId: string;
  curriculum?: string;
  classLevel?: string;
  subject?: string;
  recentScores: Array<{ chapter_id: string; topic_id: string; percentage: number; subject?: string }>;
  completedTopics: string[];
  totalAttempts: number;
  averageScore: number;
  /** Subjects where average score is below threshold (e.g. &lt; 70%) – for dashboard and AI */
  subjectsWithLowScores?: SubjectScoreSummary[];
  /** Subjects where average score is good (e.g. ≥ 70%) – for dashboard and AI */
  subjectsWithHighScores?: SubjectScoreSummary[];
  /** Per-topic: chapter/topic with low average (e.g. &lt; 70%) */
  topicsWithLowScores?: TopicScoreSummary[];
  /** Per-topic: chapter/topic with high average (e.g. ≥ 70%) */
  topicsWithHighScores?: TopicScoreSummary[];
  /** Lessons started but not completed – for "complete this lesson" */
  incompleteLessons?: IncompleteLesson[];
}

export interface LearningRecommendation {
  recommendedTopicIds: string[];
  recommendedChapterIds: string[];
  strengths: string[];
  areasToImprove: string[];
  studyTips: string[];
  nextBestAction: string;
  reasoning: string;
  /** Priority topic/chapter to focus on first (from LLM4education-style prioritization) */
  priorityFocusTopicId?: string;
  priorityFocusChapterId?: string;
}

class PersonalizedLearningService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('✅ Personalized Learning Service initialized (using existing OPENAI_API_KEY)');
    } else {
      console.warn('⚠️ OPENAI_API_KEY not found. Personalized learning will return fallback recommendations.');
    }
  }

  isConfigured(): boolean {
    return this.openai !== null;
  }

  /**
   * Get AI-powered personalized learning recommendations for a student
   */
  async getRecommendations(summary: StudentProgressSummary): Promise<LearningRecommendation> {
    if (!this.openai) {
      return this.getFallbackRecommendations(summary);
    }

    try {
      const systemPrompt = `You are an expert K-12 learning coach (knowledge-aware, LLM4education-style). From the student's progress and scores, infer mastery and weak areas, then output a JSON object with:
- recommendedTopicIds: array of topic IDs (strings) the student should study next, in priority order (max 5). Prefer topics where they scored low or have not attempted.
- recommendedChapterIds: array of chapter IDs (strings) to focus on (max 3)
- strengths: array of 2-4 short strings describing what the student is doing well (reference specific topics/scores if data exists)
- areasToImprove: array of 2-4 short strings describing areas to work on (tie to low scores or missing practice)
- studyTips: array of 2-4 actionable study tips (short strings)
- nextBestAction: one short sentence (e.g. "Complete the next lesson in Algebra" or "Review Chapter 2 concepts")
- reasoning: 1-2 sentences explaining your recommendation
- priorityFocusTopicId: (optional) single topic ID that should be the top priority, or omit
- priorityFocusChapterId: (optional) single chapter ID to focus on first, or omit

Use a knowledge-tracing mindset: identify which topics show mastery vs need practice from the scores. Be encouraging and specific. Use the actual subject/curriculum/class from the summary. Output only valid JSON, no markdown.`;

      const userPrompt = `Student summary:
- Curriculum: ${summary.curriculum || 'Not specified'}
- Class: ${summary.classLevel || 'Not specified'}
- Subject: ${summary.subject || 'Not specified'}
- Total attempts: ${summary.totalAttempts}
- Average score: ${summary.averageScore}%
- Recent scores (topic/chapter, percentage): ${JSON.stringify(summary.recentScores.slice(0, 15))}
- Completed topic IDs: ${summary.completedTopics.slice(0, 20).join(', ')}
${(summary.subjectsWithLowScores?.length ?? 0) > 0 ? `- Subjects with LOW scores (need practice): ${summary.subjectsWithLowScores!.map(s => `${s.subject} (${s.averageScore}% avg, ${s.attemptCount} attempts)`).join('; ')}` : ''}
${(summary.subjectsWithHighScores?.length ?? 0) > 0 ? `- Subjects with HIGH scores (strengths): ${summary.subjectsWithHighScores!.map(s => `${s.subject} (${s.averageScore}% avg)`).join('; ')}` : ''}
${(summary.incompleteLessons?.length ?? 0) > 0 ? `- Incomplete lessons (student should finish these): ${summary.incompleteLessons!.map(l => `${l.subject || 'Lesson'} - ${l.chapterId} / ${l.topicId} (${l.status})`).join('; ')}` : ''}
${(summary.topicsWithLowScores?.length ?? 0) > 0 ? `- Topics/chapters with LOW scores (need practice): ${summary.topicsWithLowScores!.map(t => `${t.chapterId} • ${t.topicId} (${t.subject || 'N/A'}) ${t.averageScore}%`).join('; ')}` : ''}
${(summary.topicsWithHighScores?.length ?? 0) > 0 ? `- Topics/chapters with HIGH scores (strengths): ${summary.topicsWithHighScores!.map(t => `${t.chapterId} • ${t.topicId} (${t.subject || 'N/A'}) ${t.averageScore}%`).join('; ')}` : ''}

Provide personalized learning recommendations as a single JSON object. Prioritize: (1) completing incomplete lessons, (2) improving low-score subjects and low-score topics/chapters, (3) reinforcing strengths.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 800,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      const parsed = JSON.parse(content) as LearningRecommendation;
      return {
        recommendedTopicIds: Array.isArray(parsed.recommendedTopicIds) ? parsed.recommendedTopicIds : [],
        recommendedChapterIds: Array.isArray(parsed.recommendedChapterIds) ? parsed.recommendedChapterIds : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        areasToImprove: Array.isArray(parsed.areasToImprove) ? parsed.areasToImprove : [],
        studyTips: Array.isArray(parsed.studyTips) ? parsed.studyTips : [],
        nextBestAction: typeof parsed.nextBestAction === 'string' ? parsed.nextBestAction : 'Continue with your next lesson.',
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        priorityFocusTopicId: typeof parsed.priorityFocusTopicId === 'string' ? parsed.priorityFocusTopicId : undefined,
        priorityFocusChapterId: typeof parsed.priorityFocusChapterId === 'string' ? parsed.priorityFocusChapterId : undefined,
      };
    } catch (error) {
      console.error('Personalized learning AI error:', error);
      return this.getFallbackRecommendations(summary);
    }
  }

  private getFallbackRecommendations(summary: StudentProgressSummary): LearningRecommendation {
    const areasToImprove: string[] = [];
    if (summary.averageScore < 70) areasToImprove.push('Focus on topics where you scored below 70%');
    if (summary.totalAttempts < 3) areasToImprove.push('Practice more quizzes to build confidence');

    return {
      recommendedTopicIds: [],
      recommendedChapterIds: [],
      strengths: summary.averageScore >= 70 ? ['You are meeting expectations'] : [],
      areasToImprove: areasToImprove.length > 0 ? areasToImprove : ['Keep practicing regularly'],
      studyTips: ['Review lesson content before quizzes', 'Take notes during lessons', 'Ask your teacher if stuck'],
      nextBestAction: 'Continue with the next lesson in your curriculum.',
      reasoning: 'Recommendations are based on your recent progress. Keep learning!',
    };
  }
}

export default new PersonalizedLearningService();
