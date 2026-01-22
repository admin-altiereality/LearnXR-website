/**
 * Language Availability Checker
 * Provides utilities to check if chapters/topics have content available
 * for specific languages (MCQs, TTS, Avatar Scripts)
 */

import type { CurriculumChapter, Topic } from '../../../types/firebase';
import type { LanguageCode } from '../../../types/curriculum';

/**
 * Check if a topic has content for a specific language
 */
export function topicHasContentForLanguage(
  topic: Topic,
  language: LanguageCode
): boolean {
  // Check for inline MCQs in mcqs_by_language
  const inlineMcqs = (topic as any).mcqs_by_language?.[language];
  if (inlineMcqs && Array.isArray(inlineMcqs) && inlineMcqs.length > 0) {
    return true;
  }
  
  // Check language-specific MCQ IDs
  if (topic.mcq_ids_by_language?.[language]?.length) {
    return true;
  }
  
  // Check language-specific TTS IDs
  if (topic.tts_ids_by_language?.[language]?.length) {
    return true;
  }
  
  // Check language-specific avatar scripts
  const topicAvatarScripts = (topic as any).topic_avatar_scripts?.[language];
  if (topicAvatarScripts && (topicAvatarScripts.intro || topicAvatarScripts.explanation || topicAvatarScripts.outro)) {
    return true;
  }
  
  if (topic.avatar_scripts_by_language?.[language]) {
    const scripts = topic.avatar_scripts_by_language[language];
    if (scripts.intro || scripts.explanation || scripts.outro) {
      return true;
    }
  }
  
  // Legacy fields (only for English)
  if (language === 'en') {
    if (topic.topic_avatar_intro || topic.topic_avatar_explanation || topic.topic_avatar_outro) {
      return true;
    }
    if (topic.mcq_ids?.length) return true;
    if (topic.tts_ids?.length) return true;
  }
  
  return false;
}

/**
 * Check if a chapter has content for a specific language
 */
export function chapterHasContentForLanguage(
  chapter: CurriculumChapter,
  language: LanguageCode
): boolean {
  // Check chapter-level language-specific IDs
  if (chapter.mcq_ids_by_language?.[language]?.length) return true;
  if (chapter.tts_ids_by_language?.[language]?.length) return true;
  if (chapter.avatar_scripts_by_language?.[language]) return true;
  
  // Check all topics
  for (const topic of chapter.topics || []) {
    if (topicHasContentForLanguage(topic, language)) {
      return true;
    }
  }
  
  // Legacy fields (only for English)
  if (language === 'en') {
    if (chapter.mcq_ids?.length) return true;
    if (chapter.tts_ids?.length) return true;
    for (const topic of chapter.topics || []) {
      if (topic.topic_avatar_intro || topic.topic_avatar_explanation) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get available languages for a chapter
 */
export function getAvailableLanguagesForChapter(
  chapter: CurriculumChapter
): LanguageCode[] {
  const languages: LanguageCode[] = [];
  
  if (chapterHasContentForLanguage(chapter, 'en')) {
    languages.push('en');
  }
  if (chapterHasContentForLanguage(chapter, 'hi')) {
    languages.push('hi');
  }
  
  return languages;
}

/**
 * Get language-specific chapter name
 */
export function getChapterNameByLanguage(
  chapter: CurriculumChapter,
  language: LanguageCode
): string {
  const nameByLanguage = (chapter as any).chapter_name_by_language;
  if (nameByLanguage?.[language]) {
    return nameByLanguage[language];
  }
  // Fallback to legacy field
  return chapter.chapter_name || '';
}

/**
 * Get language-specific topic name
 */
export function getTopicNameByLanguage(
  topic: Topic,
  language: LanguageCode
): string {
  const nameByLanguage = (topic as any).topic_name_by_language;
  if (nameByLanguage?.[language]) {
    return nameByLanguage[language];
  }
  // Fallback to legacy field
  return topic.topic_name || '';
}

/**
 * Get language-specific learning objective
 */
export function getLearningObjectiveByLanguage(
  topic: Topic,
  language: LanguageCode
): string {
  const objectiveByLanguage = (topic as any).learning_objective_by_language;
  if (objectiveByLanguage?.[language]) {
    return objectiveByLanguage[language];
  }
  // Fallback to legacy field
  return topic.learning_objective || '';
}

/**
 * Get language-specific subject name
 * Maps common English subject names to Hindi equivalents
 */
export function getSubjectNameByLanguage(
  subject: string,
  language: LanguageCode
): string {
  if (language === 'en') {
    return subject;
  }
  
  // Hindi translations for common subjects
  const subjectMap: Record<string, string> = {
    'Science': 'विज्ञान',
    'Mathematics': 'गणित',
    'Math': 'गणित',
    'Social Science': 'सामाजिक विज्ञान',
    'Social Studies': 'सामाजिक अध्ययन',
    'English': 'अंग्रेजी',
    'Hindi': 'हिंदी',
    'History': 'इतिहास',
    'Geography': 'भूगोल',
    'Civics': 'नागरिक शास्त्र',
    'Physics': 'भौतिकी',
    'Chemistry': 'रसायन विज्ञान',
    'Biology': 'जीव विज्ञान',
    'Computer Science': 'कंप्यूटर विज्ञान',
  };
  
  // Check if there's a language-specific field in the chapter
  // For now, use the mapping
  return subjectMap[subject] || subject;
}
