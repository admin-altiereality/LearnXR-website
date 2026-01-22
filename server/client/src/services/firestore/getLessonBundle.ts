/**
 * Unified Lesson Bundle Fetch Pipeline
 * 
 * This is the SINGLE source of truth for fetching complete lesson data.
 * It joins all related collections and applies language filtering correctly.
 * 
 * Used by:
 * - /lessons page
 * - /studio/content page
 * - Any component that needs complete lesson data
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { LanguageCode } from '../../types/curriculum';
import { extractTopicScriptsForLanguage } from '../../lib/firestore/queries';

// Collection names
const COLLECTION_CURRICULUM_CHAPTERS = 'curriculum_chapters';
const COLLECTION_CHAPTER_MCQS = 'chapter_mcqs';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const COLLECTION_CHAPTER_AVATAR_SCRIPTS = 'chapter_avatar_scripts';
const COLLECTION_SKYBOXES = 'skyboxes';
const COLLECTION_PDFS = 'pdfs';
const COLLECTION_TEXT_TO_3D_ASSETS = 'text_to_3d_assets';
const COLLECTION_MESHY_ASSETS = 'meshy_assets';

/**
 * Lesson Bundle - Complete lesson data for a specific language
 */
export interface LessonBundle {
  lang: LanguageCode;
  chapter: any;
  mcqs: any[];
  tts: any[];
  avatarScripts: any | null;
  skybox: any | null;
  pdf: any | null;
  assets3d: any[];
  intro?: any | null;
  explanation?: any | null;
  outro?: any | null;
  // Metadata
  _meta: {
    extractedIds: {
      mcqIds: string[];
      ttsIds: string[];
      skyboxId?: string;
      pdfId?: string;
      assetIds: string[];
    };
    counts: {
      mcqsBeforeFilter: number;
      mcqsAfterFilter: number;
      ttsBeforeFilter: number;
      ttsAfterFilter: number;
      assetsBeforeFilter: number;
      assetsAfterFilter: number;
    };
  };
}

/**
 * Chunk array for Firestore 'in' queries (max 30 items)
 */
function chunkArray<T>(array: T[], size: number = 30): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extract linked IDs from chapter document
 * @param topicId - Optional topic ID to extract from specific topic, otherwise uses first topic
 */
function extractLinkedIds(chapterData: any, lang: LanguageCode, topicId?: string): {
  mcqIds: string[];
  ttsIds: string[];
  skyboxId?: string;
  pdfId?: string;
  assetIds: string[];
} {
  const mcqIds: string[] = [];
  const ttsIds: string[] = [];
  const assetIds: string[] = [];
  let skyboxId: string | undefined;
  let pdfId: string | undefined;

  // Find the target topic (specific topic or first topic)
  const targetTopic = topicId 
    ? chapterData.topics?.find((t: any) => t.topic_id === topicId)
    : chapterData.topics?.[0];

  // Extract MCQ IDs (language-specific)
  // Priority 1: Check for inline MCQs in mcqs_by_language[lang]
  const inlineMcqs = targetTopic?.mcqs_by_language?.[lang];
  if (inlineMcqs && Array.isArray(inlineMcqs)) {
    // If they're IDs (strings), collect them
    inlineMcqs.forEach((item: any) => {
      if (typeof item === 'string') {
        mcqIds.push(item);
      } else if (item?.question_id || item?.id) {
        mcqIds.push(item.question_id || item.id);
      }
    });
  }

  // Priority 2: Check topic-level language-specific IDs
  if (targetTopic?.mcq_ids_by_language?.[lang]?.length) {
    mcqIds.push(...targetTopic.mcq_ids_by_language[lang]);
  }

  // Priority 3: Check chapter-level language-specific IDs
  if (chapterData.mcq_ids_by_language?.[lang]?.length) {
    mcqIds.push(...chapterData.mcq_ids_by_language[lang]);
  }

  // Priority 4: Fallback to general mcq_ids (filter by language pattern if needed)
  if (mcqIds.length === 0) {
    const allMcqIds = [
      ...(targetTopic?.mcq_ids || []),
      ...(chapterData.mcq_ids || []),
    ];
    if (lang === 'hi') {
      mcqIds.push(...allMcqIds.filter((id: string) => id.includes('_hi') || id.includes('_HI')));
    } else {
      mcqIds.push(...allMcqIds.filter((id: string) => !id.includes('_hi') && !id.includes('_HI')));
    }
  }

  // Extract TTS IDs (language-specific)
  if (targetTopic?.tts_ids_by_language?.[lang]?.length) {
    ttsIds.push(...targetTopic.tts_ids_by_language[lang]);
  } else if (chapterData.tts_ids_by_language?.[lang]?.length) {
    ttsIds.push(...chapterData.tts_ids_by_language[lang]);
  } else {
    const allTtsIds = [
      ...(targetTopic?.tts_ids || []),
      ...(chapterData.tts_ids || []),
    ];
    // Filter by language if IDs contain language markers
    if (lang === 'hi') {
      ttsIds.push(...allTtsIds.filter((id: string) => id.includes('_hi') || id.includes('_HI')));
    } else {
      ttsIds.push(...allTtsIds.filter((id: string) => !id.includes('_hi') && !id.includes('_HI')));
    }
  }

  // Extract skybox ID
  skyboxId = targetTopic?.skybox_id || chapterData.skybox_id;

  // Extract PDF ID
  pdfId = chapterData.pdf_id;

  // Extract 3D asset IDs
  const allAssetIds = [
    ...(targetTopic?.asset_ids || []),
    ...(targetTopic?.meshy_asset_ids || []),
    ...(chapterData.meshy_asset_ids || []),
  ];
  assetIds.push(...allAssetIds);

  return {
    mcqIds: [...new Set(mcqIds)], // Remove duplicates
    ttsIds: [...new Set(ttsIds)],
    skyboxId,
    pdfId,
    assetIds: [...new Set(assetIds)],
  };
}

/**
 * Fetch documents by IDs with chunking (Firestore 'in' query limit is 30)
 */
async function fetchDocsByIds(collectionName: string, ids: string[]): Promise<any[]> {
  if (ids.length === 0) return [];

  const chunks = chunkArray(ids, 30);
  const allDocs: any[] = [];

  for (const chunk of chunks) {
    try {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, where(documentId(), 'in', chunk));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(docSnap => {
        allDocs.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
    } catch (error) {
      console.warn(`[getLessonBundle] Error fetching ${collectionName} chunk:`, error);
      // Try individual fetches as fallback
      for (const id of chunk) {
        try {
          const docRef = doc(db, collectionName, id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            allDocs.push({
              id: docSnap.id,
              ...docSnap.data(),
            });
          }
        } catch (err) {
          console.warn(`[getLessonBundle] Failed to fetch ${collectionName}/${id}:`, err);
        }
      }
    }
  }

  return allDocs;
}

/**
 * Filter documents by language
 * Enhanced to check multiple field names, ID patterns, and handle case-insensitive matching
 */
function filterByLanguage<T extends { language?: string; lang?: string; id?: string }>(
  docs: T[],
  lang: LanguageCode
): T[] {
  const filtered = docs.filter(doc => {
    // Priority 1: Check explicit language field (case-insensitive)
    if (doc.language) {
      const docLang = String(doc.language).toLowerCase().trim();
      const targetLang = lang.toLowerCase();
      if (docLang === targetLang || (docLang === 'en' && targetLang === 'english')) {
        return true;
      }
      // If language field exists but doesn't match, exclude
      return false;
    }
    
    // Priority 2: Check lang field (case-insensitive)
    if (doc.lang) {
      const docLang = String(doc.lang).toLowerCase().trim();
      const targetLang = lang.toLowerCase();
      if (docLang === targetLang || (docLang === 'en' && targetLang === 'english')) {
        return true;
      }
      // If lang field exists but doesn't match, exclude
      return false;
    }
    
    // Priority 3: Check ID pattern for language indicator
    if (doc.id) {
      const idLower = String(doc.id).toLowerCase();
      if (lang === 'hi') {
        // Hindi: must contain _hi, _hindi, hi_, or similar
        if (idLower.includes('_hi') || idLower.includes('_hindi') || idLower.includes('hi_') || idLower.endsWith('_hi')) {
          return true;
        }
        // If ID doesn't have Hindi marker and we want Hindi, exclude it
        return false;
      } else {
        // English: should NOT contain _hi, _hindi
        if (idLower.includes('_hi') || idLower.includes('_hindi') || idLower.includes('hi_') || idLower.endsWith('_hi')) {
          return false;
        }
        // If no language marker, assume English for legacy data
        return true;
      }
    }
    
    // Priority 4: If no language field and no ID pattern, assume English for legacy data
    return lang === 'en';
  });
  
  console.log(`[filterByLanguage] Filtered ${docs.length} docs to ${filtered.length} for language ${lang}`, {
    before: docs.length,
    after: filtered.length,
    language: lang,
    sampleIds: docs.slice(0, 3).map(d => ({ id: d.id, language: d.language || d.lang || 'none' })),
  });
  
  return filtered;
}

/**
 * Get complete lesson bundle for a chapter and language
 */
export async function getLessonBundle(params: {
  chapterId: string;
  lang: LanguageCode;
  topicId?: string; // Optional: specific topic to extract data from
}): Promise<LessonBundle> {
  const { chapterId, lang, topicId } = params;

  console.log(`[getLessonBundle] Fetching bundle for chapter ${chapterId}, language ${lang}`);

  try {
    // Step 1: Fetch chapter document
    const chapterRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, chapterId);
    const chapterSnap = await getDoc(chapterRef);

    if (!chapterSnap.exists()) {
      throw new Error(`Chapter ${chapterId} not found`);
    }

    const chapterData = {
      id: chapterSnap.id,
      ...chapterSnap.data(),
    };

    console.log(`[getLessonBundle] Chapter loaded:`, {
      id: chapterData.id,
      name: chapterData.chapter_name,
      topicsCount: chapterData.topics?.length || 0,
    });

    // Step 2: Extract linked IDs (from specific topic if provided)
    const extractedIds = extractLinkedIds(chapterData, lang, topicId);
    console.log(`[getLessonBundle] Extracted IDs from ${topicId ? `topic ${topicId}` : 'first topic'}:`, extractedIds);

    // Step 3: Fetch linked documents in parallel
    const [mcqsRaw, ttsRaw, skyboxData, pdfData, assetsRaw, meshyAssetsRaw] = await Promise.all([
      extractedIds.mcqIds.length > 0
        ? fetchDocsByIds(COLLECTION_CHAPTER_MCQS, extractedIds.mcqIds)
        : Promise.resolve([]),
      extractedIds.ttsIds.length > 0
        ? fetchDocsByIds(COLLECTION_CHAPTER_TTS, extractedIds.ttsIds)
        : Promise.resolve([]),
      extractedIds.skyboxId
        ? (async () => {
            try {
              const skyboxRef = doc(db, COLLECTION_SKYBOXES, extractedIds.skyboxId!);
              const skyboxSnap = await getDoc(skyboxRef);
              if (skyboxSnap.exists()) {
                return { id: skyboxSnap.id, ...skyboxSnap.data() };
              }
            } catch (err) {
              console.warn(`[getLessonBundle] Failed to fetch skybox:`, err);
            }
            return null;
          })()
        : Promise.resolve(null),
      extractedIds.pdfId
        ? (async () => {
            try {
              const pdfRef = doc(db, COLLECTION_PDFS, extractedIds.pdfId!);
              const pdfSnap = await getDoc(pdfRef);
              if (pdfSnap.exists()) {
                return { id: pdfSnap.id, ...pdfSnap.data() };
              }
            } catch (err) {
              console.warn(`[getLessonBundle] Failed to fetch PDF:`, err);
            }
            return null;
          })()
        : Promise.resolve(null),
      extractedIds.assetIds.length > 0
        ? fetchDocsByIds(COLLECTION_TEXT_TO_3D_ASSETS, extractedIds.assetIds)
        : Promise.resolve([]),
      // Also fetch meshy_assets by chapter_id/topic_id as fallback (for assets added via AssetsTab)
      (async () => {
        try {
          const topic = topicId 
            ? chapterData.topics?.find((t: any) => t.topic_id === topicId)
            : chapterData.topics?.[0];
          if (!topic) return [];
          
          // Query meshy_assets by chapter_id and topic_id
          const meshyRef = collection(db, COLLECTION_MESHY_ASSETS);
          const q = query(
            meshyRef,
            where('chapter_id', '==', chapterId),
            where('topic_id', '==', topic?.topic_id || '')
          );
          const snapshot = await getDocs(q);
          const meshyAssets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          if (meshyAssets.length > 0) {
            console.log(`[getLessonBundle] Found ${meshyAssets.length} meshy_assets via chapter_id/topic_id query`);
          }
          
          return meshyAssets;
        } catch (err) {
          console.warn(`[getLessonBundle] Error fetching meshy_assets:`, err);
          return [];
        }
      })(),
    ]);

    // Step 4: Apply language filtering
    const mcqsBeforeFilter = mcqsRaw.length;
    const ttsBeforeFilter = ttsRaw.length;
    const assetsBeforeFilter = assetsRaw.length + (meshyAssetsRaw?.length || 0);

    // Helper function to extract MCQ options from various field formats
    const extractMcqOptions = (data: any): string[] => {
      // Priority 1: Check for options array
      if (Array.isArray(data.options) && data.options.length > 0) {
        return data.options;
      }
      // Priority 2: Check for choices array
      if (Array.isArray(data.choices) && data.choices.length > 0) {
        return data.choices;
      }
      // Priority 3: Check for answers array
      if (Array.isArray(data.answers) && data.answers.length > 0) {
        return data.answers;
      }
      // Priority 4: Extract from individual fields (option_a, option_b, etc.)
      const extractedOptions: string[] = [];
      const optionFields = [
        'option_a', 'option_b', 'option_c', 'option_d',
        'optionA', 'optionB', 'optionC', 'optionD',
        'option1', 'option2', 'option3', 'option4',
        'a', 'b', 'c', 'd',
        'option_1', 'option_2', 'option_3', 'option_4',
      ];
      optionFields.forEach(key => {
        if (data[key]) extractedOptions.push(String(data[key]));
      });
      if (extractedOptions.length > 0) {
        return extractedOptions;
      }
      return [];
    };

    // Helper function to extract correct option index
    const extractCorrectOptionIndex = (data: any, options: string[]): number => {
      // Priority 1: Check correct_option_index
      let correctIndex = data.correct_option_index ?? data.correct_index ?? data.correctIndex ?? data.correct ?? 0;
      if (typeof correctIndex === 'number') {
        return correctIndex;
      }
      // Priority 2: Parse as number
      const parsed = parseInt(String(correctIndex), 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
      // Priority 3: Check if correct answer is stored as a letter (A, B, C, D)
      if (typeof data.correct_answer === 'string' && data.correct_answer.length === 1) {
        const letterIndex = data.correct_answer.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
        if (letterIndex >= 0 && letterIndex < options.length) {
          return letterIndex;
        }
      }
      // Priority 4: Check correct_option_text and find matching index
      if (data.correct_option_text && options.length > 0) {
        const index = options.findIndex(opt => opt === data.correct_option_text);
        if (index >= 0) {
          return index;
        }
      }
      return 0;
    };

    // For MCQs: Check for inline MCQs first (they're already language-filtered)
    let mcqs: any[] = [];
    const topic = topicId 
      ? chapterData.topics?.find((t: any) => t.topic_id === topicId)
      : chapterData.topics?.[0];
    if (topic?.mcqs_by_language?.[lang] && Array.isArray(topic.mcqs_by_language[lang])) {
      const inlineMcqs = topic.mcqs_by_language[lang];
      // If first item is a full MCQ object (has 'question'), use them directly
      if (inlineMcqs.length > 0 && typeof inlineMcqs[0] === 'object' && inlineMcqs[0].question) {
        mcqs = inlineMcqs.map((mcq: any, index: number) => {
          const options = extractMcqOptions(mcq);
          const correctIndex = extractCorrectOptionIndex(mcq, options);
          return {
            id: mcq.question_id || mcq.id || `inline_${lang}_${index}`,
            question: mcq.question || mcq.question_text || '',
            options: options,
            correct_option_index: correctIndex,
            explanation: mcq.explanation || mcq.explanation_text || '',
            ...mcq,
          };
        });
      } else {
        // They're IDs, use fetched MCQs and process them
        const filtered = filterByLanguage(mcqsRaw, lang);
        mcqs = filtered.map((mcq: any) => {
          const options = extractMcqOptions(mcq);
          const correctIndex = extractCorrectOptionIndex(mcq, options);
          return {
            ...mcq,
            options: options,
            correct_option_index: correctIndex,
          };
        });
      }
    } else {
      // Use fetched MCQs, filter by language, and process options
      const filtered = filterByLanguage(mcqsRaw, lang);
      mcqs = filtered.map((mcq: any) => {
        const options = extractMcqOptions(mcq);
        const correctIndex = extractCorrectOptionIndex(mcq, options);
        return {
          ...mcq,
          options: options,
          correct_option_index: correctIndex,
        };
      });
      
      // Log if we're getting fewer MCQs than expected
      if (mcqs.length === 0 && mcqsRaw.length > 0) {
        console.warn(`[getLessonBundle] No MCQs after filtering for ${lang}, but ${mcqsRaw.length} MCQs found. Sample:`, {
          sampleMcqs: mcqsRaw.slice(0, 3).map(m => ({
            id: m.id,
            language: m.language || m.lang || 'none',
            question: m.question?.substring(0, 50) || m.question_text?.substring(0, 50),
            hasOptions: !!m.options,
            optionsCount: Array.isArray(m.options) ? m.options.length : 0,
          })),
        });
      }
    }
    
    // Log MCQ processing results
    console.log(`[getLessonBundle] Processed ${mcqs.length} MCQs with options:`, {
      mcqsWithOptions: mcqs.filter(m => m.options && m.options.length > 0).length,
      mcqsWithoutOptions: mcqs.filter(m => !m.options || m.options.length === 0).length,
      sampleMcq: mcqs.length > 0 ? {
        id: mcqs[0].id,
        optionsCount: mcqs[0].options?.length || 0,
        correctIndex: mcqs[0].correct_option_index,
      } : null,
    });

    const tts = filterByLanguage(ttsRaw, lang).map(t => ({
      ...t,
      language: t.language || t.lang || lang, // Ensure language field is explicitly set
    }));
    
    // Merge text_to_3d_assets with meshy_assets (both are 3D assets)
    const allAssetsRaw = [...assetsRaw, ...(meshyAssetsRaw || [])];
    const assets3d = filterByLanguage(allAssetsRaw, lang);
    
    console.log(`[getLessonBundle] Merged assets:`, {
      textTo3dAssets: assetsRaw.length,
      meshyAssets: meshyAssetsRaw?.length || 0,
      total: allAssetsRaw.length,
      afterFilter: assets3d.length,
    });

    const mcqsAfterFilter = mcqs.length;
    const ttsAfterFilter = tts.length;
    const assetsAfterFilter = assets3d.length;

    // Enhanced logging for debugging
    console.log(`[getLessonBundle] Language filtering results for ${lang}:`, {
      mcqs: {
        before: mcqsRaw.length,
        after: mcqs.length,
        ids: mcqsRaw.slice(0, 5).map(m => ({ id: m.id, language: m.language || m.lang || 'none' })),
      },
      tts: {
        before: ttsRaw.length,
        after: tts.length,
        ids: ttsRaw.slice(0, 5).map(t => ({ id: t.id, language: t.language || t.lang || 'none', script_type: t.script_type || t.section })),
      },
      extractedIds: {
        mcqIds: extractedIds.mcqIds,
        ttsIds: extractedIds.ttsIds,
      },
    });

    // Step 5: Extract avatar scripts for the selected language
    let avatarScripts: any | null = null;
    if (topic) {
      const scripts = extractTopicScriptsForLanguage(topic, lang);
      if (scripts.intro || scripts.explanation || scripts.outro) {
        avatarScripts = scripts;
      }
    }

    // Step 6: Extract intro/explanation/outro if they exist in chapter or topic
    const intro = chapterData.intro?.[lang] || topic?.intro?.[lang] || null;
    const explanation = chapterData.explanation?.[lang] || topic?.explanation?.[lang] || null;
    const outro = chapterData.outro?.[lang] || topic?.outro?.[lang] || null;

    const bundle: LessonBundle = {
      lang,
      chapter: chapterData,
      mcqs,
      tts,
      avatarScripts,
      skybox: skyboxData,
      pdf: pdfData,
      assets3d,
      intro,
      explanation,
      outro,
      _meta: {
        extractedIds,
        counts: {
          mcqsBeforeFilter,
          mcqsAfterFilter,
          ttsBeforeFilter,
          ttsAfterFilter,
          assetsBeforeFilter,
          assetsAfterFilter,
        },
      },
    };

    console.log(`[getLessonBundle] Bundle built successfully:`, {
      lang,
      chapterId: bundle.chapter.id,
      mcqs: bundle.mcqs.length,
      tts: bundle.tts.length,
      assets3d: bundle.assets3d.length,
      hasAvatarScripts: !!bundle.avatarScripts,
      hasSkybox: !!bundle.skybox,
      hasPdf: !!bundle.pdf,
    });

    return bundle;
  } catch (error) {
    console.error(`[getLessonBundle] Error building bundle:`, error);
    throw error;
  }
}
