/**
 * MCQ Generation Service
 * Generates multiple-choice questions from lesson content or learning objectives
 * using an LLM. Output shape matches ChapterMCQ (without id/chapter_id/topic_id).
 */

import OpenAI from 'openai';

export interface GenerateMcqInput {
  chapterId: string;
  topicId: string;
  subject?: string;
  classLevel?: string;
  curriculum?: string;
  /** Learning objective for the topic (preferred input) */
  learningObjective?: string;
  /** Optional: script or lesson text to base questions on */
  scriptText?: string;
  /** Number of MCQs to generate (default 5, max 10) */
  count?: number;
  /** Language code for questions (default 'en') */
  language?: string;
}

export interface GeneratedMcq {
  question: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;

export async function generateMcqs(input: GenerateMcqInput): Promise<GeneratedMcq[]> {
  const openaiKey = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to server/.env (or your runtime env) and restart the server.');
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const count = Math.min(Math.max(1, input.count ?? DEFAULT_COUNT), MAX_COUNT);
  const language = input.language || 'en';
  const langLabel = language === 'hi' ? 'Hindi' : 'English';

  const context = [
    input.learningObjective && input.learningObjective.trim() && `Learning objective: ${input.learningObjective.trim()}`,
    input.scriptText && input.scriptText.trim() && `Lesson/script excerpt: ${input.scriptText.slice(0, 2000)}`,
    input.subject && `Subject: ${input.subject}`,
    input.classLevel && `Class: ${input.classLevel}`,
    input.curriculum && `Curriculum: ${input.curriculum}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (!context.trim()) {
    throw new Error('Provide at least one of: learningObjective, scriptText, or subject.');
  }

  const systemPrompt = `You are an expert K-12 assessment designer. Generate multiple-choice questions (MCQs) in ${langLabel} that assess understanding of the given learning objective or lesson content.
Output a JSON object with a single key "mcqs" whose value is an array of exactly ${count} items. Each item must have:
- "question" (string)
- "options" (array of exactly 4 strings)
- "correct_option_index" (0-based integer, 0-3)
- "explanation" (string, optional)
- "difficulty" ("easy" | "medium" | "hard", optional)
Questions must be clear, unambiguous, and aligned to the learning objective. Do not repeat the same idea. Output only valid JSON, no markdown.`;

  const userPrompt = `Generate ${count} MCQs based on:\n${context}`;

  let content: string;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 4000,
    });
    content = completion.choices[0]?.message?.content ?? '';
  } catch (apiErr: unknown) {
    const err = apiErr as { status?: number; message?: string; error?: { message?: string; code?: string } };
    const msg = err?.error?.message ?? err?.message ?? String(apiErr);
    if (err?.status === 401 || /invalid.*api.*key|incorrect.*key|authentication/i.test(msg)) {
      throw new Error('OpenAI API key is invalid or expired. Check OPENAI_API_KEY in server/.env.');
    }
    if (err?.status === 429 || /rate limit|quota/i.test(msg)) {
      throw new Error('OpenAI rate limit reached. Please try again in a minute.');
    }
    throw new Error(`OpenAI API error: ${msg}`);
  }

  if (!content) {
    throw new Error('No response from MCQ generation.');
  }

  let parsed: { mcqs?: GeneratedMcq[]; questions?: GeneratedMcq[] } | GeneratedMcq[];
  try {
    parsed = JSON.parse(content) as { mcqs?: GeneratedMcq[]; questions?: GeneratedMcq[] } | GeneratedMcq[];
  } catch {
    throw new Error('Invalid response format from AI. Please try again.');
  }

  const rawList = Array.isArray(parsed) ? parsed : parsed.mcqs ?? parsed.questions ?? [];
  const normalized: GeneratedMcq[] = rawList.slice(0, count).map((item: unknown) => {
    const q = item as Record<string, unknown>;
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const correct = typeof q.correct_option_index === 'number' ? q.correct_option_index : 0;
    return {
      question: String(q.question ?? ''),
      options: options.length >= 2 ? options : ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_option_index: Math.max(0, Math.min(correct, options.length - 1)),
      explanation: q.explanation != null ? String(q.explanation) : undefined,
      difficulty: ['easy', 'medium', 'hard'].includes(String(q.difficulty)) ? (q.difficulty as 'easy' | 'medium' | 'hard') : 'medium',
    };
  });

  return normalized.filter((m) => m.question.length > 0);
}
