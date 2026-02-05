/**
 * Personalized Learning Service (Firebase Functions)
 * Uses OpenAI to recommend learning paths, strengths/weaknesses, next steps.
 */

import OpenAI from 'openai';

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

export interface StudentProgressSummary {
  studentId: string;
  curriculum?: string;
  classLevel?: string;
  subject?: string;
  recentScores: Array<{ chapter_id: string; topic_id: string; percentage: number; subject?: string }>;
  completedTopics: string[];
  totalAttempts: number;
  averageScore: number;
  subjectsWithLowScores?: SubjectScoreSummary[];
  subjectsWithHighScores?: SubjectScoreSummary[];
  topicsWithLowScores?: TopicScoreSummary[];
  topicsWithHighScores?: TopicScoreSummary[];
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
}

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openai) return openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    openai = new OpenAI({ apiKey: apiKey.trim() });
    return openai;
  }
  return null;
}

export async function getRecommendations(summary: StudentProgressSummary): Promise<LearningRecommendation> {
  const client = getOpenAI();
  if (!client) {
    return getFallbackRecommendations(summary);
  }

  try {
    const systemPrompt = `You are an expert K-12 learning coach for LearnXR. Given a student's progress and scores, you must output a JSON object with:
- recommendedTopicIds: array of topic IDs (strings) the student should study next, in priority order (max 5)
- recommendedChapterIds: array of chapter IDs (strings) to focus on (max 3)
- strengths: array of 2-4 short strings describing what the student is doing well
- areasToImprove: array of 2-4 short strings describing areas to work on
- studyTips: array of 2-4 actionable study tips (short strings)
- nextBestAction: one short sentence (e.g. "Complete the next lesson in Algebra" or "Review Chapter 2 concepts")
- reasoning: 1-2 sentences explaining your recommendation

Be encouraging and specific. Use the actual subject/curriculum/class from the summary. Output only valid JSON, no markdown.`;

    const userPrompt = `Student summary:
- Curriculum: ${summary.curriculum || 'Not specified'}
- Class: ${summary.classLevel || 'Not specified'}
- Subject: ${summary.subject || 'Not specified'}
- Total attempts: ${summary.totalAttempts}
- Average score: ${summary.averageScore}%
- Recent scores: ${JSON.stringify(summary.recentScores.slice(0, 15))}
- Completed topic IDs: ${summary.completedTopics.slice(0, 20).join(', ')}
${(summary.subjectsWithLowScores?.length ?? 0) > 0 ? `- Subjects with LOW scores (need practice): ${summary.subjectsWithLowScores!.map(s => `${s.subject} (${s.averageScore}% avg, ${s.attemptCount} attempts)`).join('; ')}` : ''}
${(summary.subjectsWithHighScores?.length ?? 0) > 0 ? `- Subjects with HIGH scores (strengths): ${summary.subjectsWithHighScores!.map(s => `${s.subject} (${s.averageScore}% avg)`).join('; ')}` : ''}
${(summary.incompleteLessons?.length ?? 0) > 0 ? `- Incomplete lessons (student should finish these): ${summary.incompleteLessons!.map(l => `${l.subject || 'Lesson'} - ${l.chapterId} / ${l.topicId} (${l.status})`).join('; ')}` : ''}
${(summary.topicsWithLowScores?.length ?? 0) > 0 ? `- Topics/chapters with LOW scores (need practice): ${summary.topicsWithLowScores!.map(t => `${t.chapterId} • ${t.topicId} (${t.subject || 'N/A'}) ${t.averageScore}%`).join('; ')}` : ''}
${(summary.topicsWithHighScores?.length ?? 0) > 0 ? `- Topics/chapters with HIGH scores (strengths): ${summary.topicsWithHighScores!.map(t => `${t.chapterId} • ${t.topicId} (${t.subject || 'N/A'}) ${t.averageScore}%`).join('; ')}` : ''}

Provide personalized learning recommendations as a single JSON object. Prioritize: (1) completing incomplete lessons, (2) improving low-score subjects and low-score topics/chapters, (3) reinforcing strengths.`;

    const completion = await client.chat.completions.create({
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
    };
  } catch (error) {
    console.error('Personalized learning AI error:', error);
    return getFallbackRecommendations(summary);
  }
}

function getFallbackRecommendations(summary: StudentProgressSummary): LearningRecommendation {
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
