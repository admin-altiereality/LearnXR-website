import { collection, getDocs, limit, query } from 'firebase/firestore';

import { db } from '../config/firebase';
import { VR360_TOURS, type Vr360TourItem } from '../config/vr360Tours';

interface MinimalProfile {
  role?: string;
  curriculum?: string;
  class?: string;
  class_name?: string;
}

interface LessonSuggestionPayload {
  chapterId: string;
  topicId: string;
  chapterName: string;
  topicName: string;
  curriculum?: string;
  className?: string;
  subject?: string;
  lang?: string;
}

export type SpiralSuggestion =
  | {
      id: string;
      type: 'vr360';
      title: string;
      subtitle: string;
      description?: string;
      score: number;
      tour: Vr360TourItem;
    }
  | {
      id: string;
      type: 'lesson';
      title: string;
      subtitle: string;
      description?: string;
      score: number;
      lesson: LessonSuggestionPayload;
    };

interface SearchOptions {
  profile?: MinimalProfile | null;
  limit?: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with',
  'show', 'me', 'please', 'i', 'want', 'see', 'view', 'look', 'this', 'that',
  'open', 'play', 'start', 'lesson', 'lessons', 'tour', 'video', 'vr', '360',
  'create', 'make', 'generate', 'build',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function uniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))];
}

function scoreCorpus(promptTokens: string[], promptText: string, corpus: string): number {
  if (promptTokens.length === 0 || !corpus.trim()) return 0;
  const lowerCorpus = corpus.toLowerCase();
  const corpusTokens = new Set(uniqueTokens(corpus));
  let overlap = 0;

  for (const token of promptTokens) {
    if (corpusTokens.has(token) || lowerCorpus.includes(token)) {
      overlap += 1;
    }
  }

  const lowerPrompt = promptText.toLowerCase();
  const phraseBonus = lowerCorpus.includes(lowerPrompt) || lowerPrompt.includes(lowerCorpus)
    ? 0.35
    : 0;

  return overlap / Math.max(promptTokens.length, 1) + phraseBonus;
}

function wantsExistingContent(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(play|open|show|start|watch|lesson|lessons|tour|video|vr|class content|chapter|topic)\b/.test(lower);
}

function profileBoost(profile: MinimalProfile | null | undefined, className?: string, curriculum?: string): number {
  if (!profile) return 0;
  let boost = 0;
  const profileClass = String(profile.class || profile.class_name || '').toLowerCase();
  const lessonClass = String(className || '').toLowerCase();
  const profileCurriculum = String(profile.curriculum || '').toLowerCase();
  const lessonCurriculum = String(curriculum || '').toLowerCase();

  if (profileClass && lessonClass && (lessonClass.includes(profileClass) || profileClass.includes(lessonClass))) {
    boost += 0.12;
  }
  if (profileCurriculum && lessonCurriculum && lessonCurriculum === profileCurriculum) {
    boost += 0.08;
  }
  return boost;
}

async function searchLessonSuggestions(
  text: string,
  promptTokens: string[],
  options: SearchOptions
): Promise<SpiralSuggestion[]> {
  try {
    const snap = await getDocs(query(collection(db, 'curriculum_chapters'), limit(120)));
    const suggestions: SpiralSuggestion[] = [];

    snap.docs.forEach((docSnap) => {
      const chapter: any = { id: docSnap.id, ...docSnap.data() };
      const topics = Array.isArray(chapter.topics) ? chapter.topics : [];

      topics.forEach((topic: any, index: number) => {
        const topicId = String(topic.topic_id || topic.id || `topic-${index}`);
        const topicName = String(topic.topic_name || topic.name || topicId);
        const chapterName = String(chapter.chapter_name || chapter.name || 'Lesson');
        const curriculum = String(chapter.curriculum || chapter.curriculum_id || '');
        const className = String(chapter.class_name || chapter.class || chapter.class_id || '');
        const subject = String(chapter.subject || chapter.subject_id || '');
        const corpus = [
          chapterName,
          topicName,
          topic.learning_objective,
          topic.in3d_prompt,
          curriculum,
          className,
          subject,
        ].filter(Boolean).join(' ');
        const score = scoreCorpus(promptTokens, text, corpus) + profileBoost(options.profile, className, curriculum);

        if (score >= (wantsExistingContent(text) ? 0.22 : 0.42)) {
          suggestions.push({
            id: `lesson:${docSnap.id}:${topicId}`,
            type: 'lesson',
            title: topicName,
            subtitle: `${subject || 'Lesson'}${className ? ` • ${className}` : ''}`,
            description: chapterName,
            score,
            lesson: {
              chapterId: docSnap.id,
              topicId,
              chapterName,
              topicName,
              curriculum,
              className,
              subject,
              lang: 'en',
            },
          });
        }
      });
    });

    return suggestions;
  } catch (err) {
    console.warn('spiralContentSearch: lesson search failed', err);
    return [];
  }
}

function searchTourSuggestions(text: string, promptTokens: string[]): SpiralSuggestion[] {
  return VR360_TOURS.map((tour) => {
    const score = scoreCorpus(promptTokens, text, [tour.title, tour.description].filter(Boolean).join(' '));
    return {
      id: `vr360:${tour.id}`,
      type: 'vr360' as const,
      title: tour.title.replace(/—.*/g, '').trim(),
      subtitle: '360 video tour',
      description: tour.description,
      score,
      tour,
    };
  }).filter((suggestion) => suggestion.score >= (wantsExistingContent(text) ? 0.18 : 0.45));
}

export async function searchSpiralContent(
  text: string,
  options: SearchOptions = {}
): Promise<SpiralSuggestion[]> {
  const promptTokens = uniqueTokens(text);
  if (promptTokens.length === 0 && !wantsExistingContent(text)) return [];

  const [tourSuggestions, lessonSuggestions] = await Promise.all([
    Promise.resolve(searchTourSuggestions(text, promptTokens)),
    searchLessonSuggestions(text, promptTokens, options),
  ]);

  return [...tourSuggestions, ...lessonSuggestions]
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 4);
}
