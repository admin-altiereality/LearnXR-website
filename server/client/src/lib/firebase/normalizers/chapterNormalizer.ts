/**
 * Chapter Normalizer
 * Converts raw CurriculumChapter data to NormalizedChapter for UI consumption
 * Handles multi-language support and approval status
 */

import type { CurriculumChapter, Topic as FirebaseTopic } from '../../../types/firebase';
import type {
  LanguageCode,
  NormalizedChapter,
  NormalizedTopic,
  AvatarScripts,
} from '../../../types/curriculum';
import {
  getChapterNameByLanguage,
  getTopicNameByLanguage,
  getLearningObjectiveByLanguage,
} from '../utils/languageAvailability';
import { extractTopicScriptsForLanguage } from '../../../lib/firestore/queries';

/**
 * Count MCQs for a specific language in a topic
 */
export function countMcqsByLanguage(
  topic: FirebaseTopic,
  language: LanguageCode
): number {
  // Check inline MCQs in mcqs_by_language
  const inlineMcqs = (topic as any).mcqs_by_language?.[language];
  if (inlineMcqs && Array.isArray(inlineMcqs) && inlineMcqs.length > 0) {
    return inlineMcqs.length;
  }
  
  // Check language-specific MCQ IDs
  if (topic.mcq_ids_by_language?.[language]?.length) {
    return topic.mcq_ids_by_language[language].length;
  }
  
  // Legacy: count all MCQs for English
  if (language === 'en' && topic.mcq_ids?.length) {
    return topic.mcq_ids.length;
  }
  
  return 0;
}

/**
 * Count TTS audio files for a specific language in a topic
 */
export function countTtsByLanguage(
  topic: FirebaseTopic,
  language: LanguageCode
): number {
  // Check language-specific TTS IDs
  if (topic.tts_ids_by_language?.[language]?.length) {
    return topic.tts_ids_by_language[language].length;
  }
  
  // Legacy: count all TTS for English
  if (language === 'en' && topic.tts_ids?.length) {
    return topic.tts_ids.length;
  }
  
  return 0;
}

/**
 * Normalize a single topic
 */
function normalizeTopic(
  topic: FirebaseTopic,
  chapter: CurriculumChapter,
  language: LanguageCode
): NormalizedTopic {
  // Extract language-specific scripts
  const scripts = extractTopicScriptsForLanguage(topic, language);
  
  // Get language-specific names
  const topicName = getTopicNameByLanguage(topic, language);
  const learningObjective = getLearningObjectiveByLanguage(topic, language);
  
  // Extract MCQ IDs for language
  let mcqIds: string[] = [];
  const inlineMcqs = (topic as any).mcqs_by_language?.[language];
  if (inlineMcqs && Array.isArray(inlineMcqs) && inlineMcqs.length > 0) {
    // If inline MCQs are full objects, extract IDs
    if (typeof inlineMcqs[0] === 'object' && inlineMcqs[0].question_id) {
      mcqIds = inlineMcqs.map((mcq: any) => mcq.question_id || mcq.id).filter(Boolean);
    } else if (typeof inlineMcqs[0] === 'string') {
      mcqIds = inlineMcqs;
    }
  }
  
  if (mcqIds.length === 0) {
    // Check language-specific IDs
    if (topic.mcq_ids_by_language?.[language]?.length) {
      mcqIds = topic.mcq_ids_by_language[language];
    } else if (language === 'en' && topic.mcq_ids?.length) {
      mcqIds = topic.mcq_ids.filter(id => !id.includes('_hi') && !id.includes('_HI'));
    } else if (language === 'hi' && topic.mcq_ids?.length) {
      mcqIds = topic.mcq_ids.filter(id => id.includes('_hi') || id.includes('_HI'));
    }
  }
  
  // Extract TTS IDs for language
  let ttsIds: string[] = [];
  if (topic.tts_ids_by_language?.[language]?.length) {
    ttsIds = topic.tts_ids_by_language[language];
  } else if (language === 'en' && topic.tts_ids?.length) {
    ttsIds = topic.tts_ids.filter(id => !id.includes('_hi') && !id.includes('_HI'));
  } else if (language === 'hi' && topic.tts_ids?.length) {
    ttsIds = topic.tts_ids.filter(id => id.includes('_hi') || id.includes('_HI'));
  }
  
  return {
    topicId: topic.topic_id || '',
    topicName,
    topicPriority: topic.topic_priority || 1,
    learningObjective,
    in3dPrompt: topic.in3d_prompt || '',
    sceneType: topic.scene_type || 'mixed',
    cameraGuidance: topic.camera_guidance || '',
    scripts,
    mcqIds,
    ttsIds,
    skyboxId: topic.skybox_id || null,
    skyboxUrl: topic.skybox_url || '',
    skyboxRemixId: topic.skybox_remix_id || null,
    assetList: topic.asset_list || [],
    assetUrls: topic.asset_urls || [],
    assetIds: topic.asset_ids || [],
    meshyAssetIds: topic.meshy_asset_ids || [],
    status: topic.status || 'pending',
    generatedAt: topic.generatedAt || null,
  };
}

/**
 * Normalize a single chapter
 */
export function normalizeChapter(
  chapterId: string,
  chapterData: CurriculumChapter,
  language: LanguageCode = 'en'
): NormalizedChapter {
  // Get language-specific chapter name
  const chapterName = getChapterNameByLanguage(chapterData, language);
  
  // Determine supported languages
  const supportedLanguages: LanguageCode[] = [];
  if (chapterData.chapter_name_by_language?.en || chapterData.chapter_name) {
    supportedLanguages.push('en');
  }
  if (chapterData.chapter_name_by_language?.hi) {
    supportedLanguages.push('hi');
  }
  
  // Normalize topics
  const topics = (chapterData.topics || []).map(topic =>
    normalizeTopic(topic, chapterData, language)
  );
  
  // Count MCQs and TTS by language
  const mcqCountByLanguage = { en: 0, hi: 0 };
  const ttsCountByLanguage = { en: 0, hi: 0 };
  
  for (const topic of chapterData.topics || []) {
    mcqCountByLanguage.en += countMcqsByLanguage(topic, 'en');
    mcqCountByLanguage.hi += countMcqsByLanguage(topic, 'hi');
    ttsCountByLanguage.en += countTtsByLanguage(topic, 'en');
    ttsCountByLanguage.hi += countTtsByLanguage(topic, 'hi');
  }
  
  return {
    id: chapterId,
    approved: chapterData.approved || false,
    approvedAt: chapterData.approvedAt || null,
    approvedBy: chapterData.approvedBy || null,
    curriculum: chapterData.curriculum || '',
    classNumber: chapterData.class || 0,
    subject: chapterData.subject || '',
    chapterName,
    chapterNumber: chapterData.chapter_number || 0,
    supportedLanguages,
    skyboxGlbUrls: chapterData.skybox_glb_urls || [],
    meshyGlbUrls: chapterData.meshy_glb_urls || [],
    meshyAssetIds: chapterData.meshy_asset_ids || [],
    imageIds: chapterData.image_ids || [],
    topics,
    mcqCountByLanguage,
    ttsCountByLanguage,
    createdAt: chapterData.createdAt || null,
    updatedAt: chapterData.updatedAt || null,
  };
}

/**
 * Normalize multiple chapters
 */
export function normalizeChapters(
  rawChapters: Array<{ id: string; data: CurriculumChapter }>,
  language: LanguageCode = 'en'
): NormalizedChapter[] {
  return rawChapters.map(({ id, data }) => normalizeChapter(id, data, language));
}
