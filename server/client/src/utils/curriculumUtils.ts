import { CurriculumChapter, Topic } from '../types/firebase';

/**
 * Generate a deterministic document ID for a curriculum chapter
 * Format: {curriculum}_{class}_{subject}_ch{chapter_number}
 * Example: "CBSE_8_Science_ch3"
 */
export function generateChapterDocumentId(
  curriculum: string,
  classNum: number,
  subject: string,
  chapterNumber: number
): string {
  // Normalize inputs
  const normalizedCurriculum = curriculum.toUpperCase().trim();
  const normalizedSubject = subject.trim().replace(/\s+/g, '_');
  const normalizedClass = classNum.toString();
  const normalizedChapter = chapterNumber.toString();
  
  return `${normalizedCurriculum}_${normalizedClass}_${normalizedSubject}_ch${normalizedChapter}`;
}

/**
 * Parse a chapter document ID back into its components
 */
export function parseChapterDocumentId(
  documentId: string
): {
  curriculum: string;
  class: number;
  subject: string;
  chapter_number: number;
} | null {
  // Format: {curriculum}_{class}_{subject}_ch{chapter_number}
  const match = documentId.match(/^(.+?)_(\d+)_(.+?)_ch(\d+)$/);
  
  if (!match) {
    return null;
  }
  
  const [, curriculum, classStr, subject, chapterStr] = match;
  
  return {
    curriculum: curriculum.toUpperCase(),
    class: parseInt(classStr, 10),
    subject: subject.replace(/_/g, ' '),
    chapter_number: parseInt(chapterStr, 10),
  };
}

/**
 * Create a curriculum chapter document with proper structure
 */
export function createCurriculumChapter(
  curriculum: string,
  classNum: number,
  subject: string,
  chapterNumber: number,
  chapterName: string,
  topics: Omit<Topic, 'topic_id'>[]
): CurriculumChapter {
  // Generate topic IDs for topics that don't have them
  const topicsWithIds: Topic[] = topics.map((topic, index) => ({
    ...topic,
    topic_id: topic.topic_id || `topic_${index + 1}_${Date.now()}`,
  }));
  
  return {
    curriculum: curriculum.toUpperCase().trim(),
    class: classNum,
    subject: subject.trim(),
    chapter_number: chapterNumber,
    chapter_name: chapterName.trim(),
    topics: topicsWithIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Query helper: Build query filters for curriculum chapters
 */
export interface CurriculumQueryFilters {
  curriculum?: string;
  class?: number;
  subject?: string;
  chapter_number?: number;
}

/**
 * Validate a curriculum chapter structure
 */
export function validateCurriculumChapter(
  chapter: Partial<CurriculumChapter>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!chapter.curriculum || !chapter.curriculum.trim()) {
    errors.push('curriculum is required');
  }
  
  if (chapter.class === undefined || chapter.class === null || chapter.class < 1 || chapter.class > 12) {
    errors.push('class must be a number between 1 and 12');
  }
  
  if (!chapter.subject || !chapter.subject.trim()) {
    errors.push('subject is required');
  }
  
  if (chapter.chapter_number === undefined || chapter.chapter_number === null || chapter.chapter_number < 1) {
    errors.push('chapter_number must be a positive number');
  }
  
  if (!chapter.chapter_name || !chapter.chapter_name.trim()) {
    errors.push('chapter_name is required');
  }
  
  if (!chapter.topics || !Array.isArray(chapter.topics) || chapter.topics.length === 0) {
    errors.push('topics array is required and must contain at least one topic');
  } else {
    chapter.topics.forEach((topic, index) => {
      if (!topic.topic_name || !topic.topic_name.trim()) {
        errors.push(`topics[${index}].topic_name is required`);
      }
      
      if (!topic.learning_objective || !topic.learning_objective.trim()) {
        errors.push(`topics[${index}].learning_objective is required`);
      }
      
      if (!topic.in3d_prompt || !topic.in3d_prompt.trim()) {
        errors.push(`topics[${index}].in3d_prompt is required`);
      }
      
      if (!['mesh', 'skybox', 'mixed'].includes(topic.scene_type)) {
        errors.push(`topics[${index}].scene_type must be 'mesh', 'skybox', or 'mixed'`);
      }
      
      if (topic.topic_priority === undefined || topic.topic_priority < 1) {
        errors.push(`topics[${index}].topic_priority must be a positive number`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
