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
import { cacheManager, CacheManager, LESSON_BUNDLE_CACHE_TTL_MS } from '../../utils/cacheManager';
import {
  persistentGet,
  persistentSet,
  persistentDeleteByPrefix,
} from '../../lib/cache/persistentCache';
import { extractTopicScriptsForLanguage } from '../../lib/firestore/queries';
import { extractMcqOptions, resolveCorrectAnswerIndex } from '../../lib/mcq/answerIndex';
import {
  getLatestUnapprovedVersionForUser,
  getChapterSnapshot,
} from '../lessonVersionService';
import type { LessonDraftSnapshot } from '../../types/lessonVersion';
// Shared with the player, which resolves the same assets a second way. Two
// copies of this precedence disagreed, and the same model arrived twice.
import { isRenderAssetUrl, isRetiredMeshyAsset, pickPlayerGlbUrl } from '../../lib/lesson/assetUrls';

// Collection names
const COLLECTION_CURRICULUM_CHAPTERS = 'curriculum_chapters';
const COLLECTION_CHAPTER_MCQS = 'chapter_mcqs';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const COLLECTION_CHAPTER_AVATAR_SCRIPTS = 'chapter_avatar_scripts';
const COLLECTION_CHAPTER_IMAGES = 'chapter_images';
const COLLECTION_SKYBOXES = 'skyboxes';
const COLLECTION_PDFS = 'pdfs';
// Try both collection names for compatibility
const COLLECTION_TEXT_TO_3D_ASSETS = 'text_to_3d_assets';
const COLLECTION_TEXT_TO_3D = 'text_to_3d'; // Alternative collection name
const COLLECTION_MESHY_ASSETS = 'meshy_assets';

/**
 * Which of the two text-to-3D collection names this project actually uses.
 *
 * Both names are tried because the data has historically lived under either. Every
 * probe of the name that turns out to be empty still bills a document read (an empty
 * query result costs one), and the old code re-probed both on every single lesson
 * open. Remembering the winner for the session means only the first lesson pays for
 * the discovery. Deliberately not persisted: it is cheap to re-learn, and pinning it
 * across sessions would hide a migration between the two.
 */
let resolvedTextTo3dCollection: string | null = null;

/** Try the collection that answered last time first, then the other. */
function textTo3dCollectionsToTry(): string[] {
  const all = [COLLECTION_TEXT_TO_3D_ASSETS, COLLECTION_TEXT_TO_3D];
  if (!resolvedTextTo3dCollection) return all;
  return [resolvedTextTo3dCollection, ...all.filter((name) => name !== resolvedTextTo3dCollection)];
}

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
  images: any[]; // Images from chapter_images collection
  textTo3dAssets: any[]; // Text-to-3D assets with all fields including approval_status
  licensedContent?: any[];
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
      imageIds: string[];
      textTo3dAssetIds: string[];
    };
    counts: {
      mcqsBeforeFilter: number;
      mcqsAfterFilter: number;
      ttsBeforeFilter: number;
      ttsAfterFilter: number;
      assetsBeforeFilter: number;
      assetsAfterFilter: number;
      imagesCount: number;
      textTo3dAssetsCount: number;
    };
  };
}

/** Licensed links change only when an admin re-curates a lesson; a minute of staleness is fine. */
const LICENSED_LINKS_CACHE_TTL_MS = 60 * 1000;

/**
 * Fetch the licensed-content links for a topic, memoised.
 *
 * This runs on every getLessonBundle call including cache hits, so without a cache
 * of its own a "cached" bundle still cost an HTTP round trip to the API — and the
 * player asks for the same bundle two or three times per lesson open.
 */
async function fetchLicensedLinks(chapterId: string, topicId: string): Promise<any[]> {
  const key = CacheManager.getLicensedLinksKey(chapterId, topicId);
  const cached = cacheManager.get<any[]>(key);
  if (cached) return cached;

  const { getLicensedLessonContent } = await import('../licensedContentService');
  const linked = await getLicensedLessonContent(chapterId, topicId);
  cacheManager.set(key, linked, LICENSED_LINKS_CACHE_TTL_MS);
  return linked;
}

async function attachLicensedContent(
  bundle: LessonBundle,
  chapterId: string,
  topicId?: string,
): Promise<LessonBundle> {
  const effectiveTopicId = topicId || bundle.chapter?.topics?.[0]?.topic_id;
  if (!effectiveTopicId) return bundle;
  try {
    const linked = await fetchLicensedLinks(chapterId, effectiveTopicId);
    if (linked.length === 0) return bundle;
    const licensedAssets = linked
      .filter((item) => item.delivery_mode === 'krpano_native' && item.artifact_url)
      .map((item) => ({
        id: `licensed_${item.id}`,
        glb_url: item.artifact_url,
        render_url: item.artifact_url,
        title: item.title,
        provider: item.provider,
        revision: item.revision,
        placement: item.placement || null,
        licensed_content_id: item.id,
        interaction_manifest: item.interaction_manifest || null,
      }));
    return {
      ...bundle,
      assets3d: [...bundle.assets3d, ...licensedAssets],
      licensedContent: linked,
      _meta: {
        ...bundle._meta,
        counts: {
          ...bundle._meta.counts,
          assetsAfterFilter: bundle.assets3d.length + licensedAssets.length,
        },
      },
    };
  } catch (error) {
    console.warn('[getLessonBundle] Licensed content links unavailable:', error);
    return bundle;
  }
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
 * Wraps each Street View Tour stop as a synthetic curriculum-shaped topic (topic_id
 * `${lessonId}__stop_${stop.id}`) so the rest of this pipeline (and VRLessonPlayerKrpano)
 * needs no tour-specific logic — a tour is just a chapter with one topic per stop.
 * Mirrors `buildTourTopics` in functions/src/services/userGeneratedLessons.ts.
 */
function buildTourStopTopics(lessonId: string, fallbackName: string, stops: any[]): any[] {
  return stops.map((stop: any, index: number) => ({
    topic_id: `${lessonId}__stop_${stop.id}`,
    topic_name: stop.label || fallbackName || `Stop ${index + 1}`,
    topic_priority: stop.order ?? index + 1,
    learning_objective: '',
    skybox_url: stop.skyboxUrl || '',
    skybox_glb_url: stop.skyboxUrl || '',
    asset_urls: Array.isArray(stop.assets) ? stop.assets.map((a: any) => a.glbUrl).filter(Boolean) : [],
    asset_ids: Array.isArray(stop.assets) ? stop.assets.map((a: any) => a.assetId).filter(Boolean) : [],
    assetPlacements: Array.isArray(stop.assets)
      ? stop.assets.map((a: any) => ({ assetId: a.assetId, url: a.glbUrl, ath: a.ath, atv: a.atv, depth: a.depth, scale: a.scale, rotationY: a.rotationY }))
      : [],
    ttsAudio: stop.voiceover?.audioUrl
      ? [{ id: `${stop.id}_voiceover`, script_type: 'intro', audio_url: stop.voiceover.audioUrl, language: stop.voiceover.language || 'en' }]
      : [],
    avatar_intro: stop.voiceover?.script || '',
    streetViewStop: {
      stopId: stop.id,
      panoId: stop.panoId,
      lat: stop.lat,
      lng: stop.lng,
      heading: stop.heading,
      pitch: stop.pitch,
      links: stop.links || [],
      copyright: stop.copyright || null,
    },
    isTourStop: true,
    isTourStopIndex: index,
    tourStopCount: stops.length,
  }));
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
  imageIds: string[];
  textTo3dAssetIds: string[];
} {
  const mcqIds: string[] = [];
  const ttsIds: string[] = [];
  const assetIds: string[] = [];
  const imageIds: string[] = [];
  const textTo3dAssetIds: string[] = [];
  let skyboxId: string | undefined;
  let pdfId: string | undefined;

  // Find the target topic (specific topic or first topic)
  const targetTopic = topicId 
    ? chapterData.topics?.find((t: any) => t.topic_id === topicId)
    : chapterData.topics?.[0];

  // ============================================
  // EXTRACT LOCALIZED CONTENT (Language-specific)
  // Priority: localized[lang] > mcq_ids_by_language > legacy fields
  // ============================================
  
  // Extract MCQ IDs (language-specific)
  // Priority 1: Check localized structure
  if (targetTopic?.localized?.[lang]?.mcq_ids?.length) {
    mcqIds.push(...targetTopic.localized[lang].mcq_ids);
  } else if (chapterData.localized?.[lang]?.mcq_ids?.length) {
    mcqIds.push(...chapterData.localized[lang].mcq_ids);
  } else {
    // Priority 2: Check for inline MCQs in mcqs_by_language[lang]
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

    // Priority 3: Check topic-level language-specific IDs
    if (targetTopic?.mcq_ids_by_language?.[lang]?.length) {
      mcqIds.push(...targetTopic.mcq_ids_by_language[lang]);
    }

    // Priority 4: Check chapter-level language-specific IDs
    if (chapterData.mcq_ids_by_language?.[lang]?.length) {
      mcqIds.push(...chapterData.mcq_ids_by_language[lang]);
    }

    // Priority 5: Fallback to general mcq_ids (filter by language pattern if needed)
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
  }

  // Extract TTS IDs (language-specific)
  // Priority 1: Check localized structure
  if (targetTopic?.localized?.[lang]?.tts_ids?.length) {
    ttsIds.push(...targetTopic.localized[lang].tts_ids);
  } else if (chapterData.localized?.[lang]?.tts_ids?.length) {
    ttsIds.push(...chapterData.localized[lang].tts_ids);
  } else {
    // Priority 2: Check topic-level language-specific IDs
    if (targetTopic?.tts_ids_by_language?.[lang]?.length) {
      ttsIds.push(...targetTopic.tts_ids_by_language[lang]);
    } else if (chapterData.tts_ids_by_language?.[lang]?.length) {
      ttsIds.push(...chapterData.tts_ids_by_language[lang]);
    } else {
      // Priority 3: Fallback to legacy fields
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
  }

  // Extract PDF ID (not language-specific, not in sharedAssets)
  pdfId = chapterData.pdf_id;

  // ============================================
  // EXTRACT SHARED ASSETS (Language-independent)
  // Priority: sharedAssets > legacy fields
  // ============================================
  
  // Extract skybox ID (shared across languages)
  // Priority 1: Check sharedAssets (topic-level or chapter-level)
  if (targetTopic?.sharedAssets?.skybox_id) {
    skyboxId = targetTopic.sharedAssets.skybox_id;
  } else if (chapterData.sharedAssets?.skybox_id) {
    skyboxId = chapterData.sharedAssets.skybox_id;
  } else {
    // Fallback to legacy fields
    skyboxId = targetTopic?.skybox_id || chapterData.skybox_id;
  }

  // Extract 3D asset IDs (meshy_assets) - shared across languages
  // Check both sharedAssets and legacy fields, merge them (sharedAssets takes priority)
  const topicSharedAssetIds = targetTopic?.sharedAssets?.meshy_asset_ids || targetTopic?.sharedAssets?.asset_ids || [];
  const chapterSharedAssetIds = chapterData.sharedAssets?.meshy_asset_ids || chapterData.sharedAssets?.asset_ids || [];
  const topicLegacyAssetIds = [
    ...(targetTopic?.asset_ids || []),
    ...(targetTopic?.meshy_asset_ids || []),
  ];
  const chapterLegacyAssetIds = chapterData.meshy_asset_ids || [];
  
  // Combine: sharedAssets first (priority), then legacy as fallback
  const allAssetIds = [
    ...(Array.isArray(topicSharedAssetIds) ? topicSharedAssetIds : []),
    ...(Array.isArray(chapterSharedAssetIds) ? chapterSharedAssetIds : []),
    ...(Array.isArray(topicLegacyAssetIds) ? topicLegacyAssetIds : []),
    ...(Array.isArray(chapterLegacyAssetIds) ? chapterLegacyAssetIds : []),
  ];
  assetIds.push(...allAssetIds);

  // Extract image IDs (from chapter_images collection) - shared across languages
  // Check both sharedAssets and legacy fields, merge them (sharedAssets takes priority)
  const sharedImageIds = Array.isArray(chapterData.sharedAssets?.image_ids) ? chapterData.sharedAssets.image_ids : [];
  const legacyImageIds = [
    ...(targetTopic?.image_ids || []),
    ...(chapterData.image_ids || []),
  ];
  
  // Combine: sharedAssets first (priority), then legacy as fallback
  const allImageIds = [
    ...sharedImageIds,
    ...(Array.isArray(legacyImageIds) ? legacyImageIds : []),
  ];
  imageIds.push(...allImageIds);

  // Extract text_to_3d_asset IDs - shared across languages
  // Check both sharedAssets and legacy fields, merge them (sharedAssets takes priority)
  const topicSharedTextTo3dIds = Array.isArray(targetTopic?.sharedAssets?.text_to_3d_asset_ids) 
    ? targetTopic.sharedAssets.text_to_3d_asset_ids 
    : [];
  const chapterSharedTextTo3dIds = Array.isArray(chapterData.sharedAssets?.text_to_3d_asset_ids)
    ? chapterData.sharedAssets.text_to_3d_asset_ids
    : [];
  const legacyTextTo3dIds = [
    ...(targetTopic?.text_to_3d_asset_ids || []),
    ...(chapterData.text_to_3d_asset_ids || []),
  ];
  
  // Combine: sharedAssets first (priority), then legacy as fallback
  const allTextTo3dIds = [
    ...topicSharedTextTo3dIds,
    ...chapterSharedTextTo3dIds,
    ...(Array.isArray(legacyTextTo3dIds) ? legacyTextTo3dIds : []),
  ];
  textTo3dAssetIds.push(...allTextTo3dIds);
  
  // Also check if any asset_ids are actually text_to_3d_assets
  // We'll filter these later when fetching

  // Debug logging to help troubleshoot
  console.log(`[extractLinkedIds] Extracted IDs for language ${lang}:`, {
    hasSharedAssets: !!(chapterData.sharedAssets || targetTopic?.sharedAssets),
    topicSharedAssets: !!targetTopic?.sharedAssets,
    chapterSharedAssets: !!chapterData.sharedAssets,
    mcqIds: mcqIds.length,
    ttsIds: ttsIds.length,
    assetIds: assetIds.length,
    imageIds: imageIds.length,
    textTo3dAssetIds: textTo3dAssetIds.length,
    skyboxId: skyboxId || 'none',
    pdfId: pdfId || 'none',
    source: {
      images: chapterData.sharedAssets?.image_ids?.length 
        ? 'sharedAssets' 
        : (chapterData.image_ids?.length ? 'legacy' : 'none'),
      assets: assetIds.length > 0 
        ? (targetTopic?.sharedAssets?.meshy_asset_ids?.length || targetTopic?.sharedAssets?.asset_ids?.length
          ? 'topic.sharedAssets'
          : (chapterData.sharedAssets?.meshy_asset_ids?.length || chapterData.sharedAssets?.asset_ids?.length
            ? 'chapter.sharedAssets'
            : 'legacy'))
        : 'none',
      textTo3d: textTo3dAssetIds.length > 0
        ? (targetTopic?.sharedAssets?.text_to_3d_asset_ids?.length
          ? 'topic.sharedAssets'
          : (chapterData.sharedAssets?.text_to_3d_asset_ids?.length
            ? 'chapter.sharedAssets'
            : 'legacy'))
        : 'none',
    },
  });

  return {
    mcqIds: [...new Set(mcqIds)], // Remove duplicates
    ttsIds: [...new Set(ttsIds)],
    skyboxId,
    pdfId,
    assetIds: [...new Set(assetIds)],
    imageIds: [...new Set(imageIds)],
    textTo3dAssetIds: [...new Set(textTo3dAssetIds)],
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

      // Fall back to individual reads only when retrying could plausibly succeed.
      // A rules rejection or a signed-out client fails identically for every document
      // in the chunk, so the old unconditional loop turned one refused read into
      // thirty — the read amplification was worst exactly when nothing would load.
      const code = (error as { code?: string } | null)?.code ?? '';
      if (code === 'permission-denied' || code === 'unauthenticated') {
        console.warn(
          `[getLessonBundle] Skipping per-document retry for ${collectionName}: ${code} applies to the whole chunk.`
        );
        continue;
      }

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
      // Handle both 'hi'/'hindi' and 'en'/'english' variations
      if (docLang === targetLang || 
          (docLang === 'en' && targetLang === 'english') ||
          (docLang === 'hindi' && targetLang === 'hi') ||
          (docLang === 'hi' && targetLang === 'hindi')) {
        return true;
      }
      // If language field exists but doesn't match, exclude
      return false;
    }
    
    // Priority 2: Check lang field (case-insensitive)
    if (doc.lang) {
      const docLang = String(doc.lang).toLowerCase().trim();
      const targetLang = lang.toLowerCase();
      // Handle both 'hi'/'hindi' and 'en'/'english' variations
      if (docLang === targetLang || 
          (docLang === 'en' && targetLang === 'english') ||
          (docLang === 'hindi' && targetLang === 'hi') ||
          (docLang === 'hi' && targetLang === 'hindi')) {
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
    sampleIds: docs.slice(0, 5).map(d => ({ 
      id: d.id, 
      language: d.language || d.lang || 'none',
      matches: filtered.some(f => f.id === d.id)
    })),
  });
  
  return filtered;
}

/**
 * Merge Associate's draft snapshot into the published bundle.
 * Overlays overview, scene_skybox, avatar_script, mcqs, images, assets3d onto the bundle.
 */
function mergeDraftIntoBundle(
  bundle: LessonBundle,
  draft: LessonDraftSnapshot,
  topicId: string
): void {
  const topic = bundle.chapter?.topics?.find((t: any) => t.topic_id === topicId);
  if (topic && draft.overview) {
    if (draft.overview.topic_name !== undefined) topic.topic_name = draft.overview.topic_name;
    if (draft.overview.learning_objective !== undefined) topic.learning_objective = draft.overview.learning_objective;
    if (draft.overview.topic_priority !== undefined) topic.topic_priority = draft.overview.topic_priority;
    if (draft.overview.scene_type !== undefined) topic.scene_type = draft.overview.scene_type;
  }
  if (topic && draft.scene_skybox) {
    if (draft.scene_skybox.in3d_prompt !== undefined) topic.in3d_prompt = draft.scene_skybox.in3d_prompt;
    if (draft.scene_skybox.camera_guidance !== undefined) topic.camera_guidance = draft.scene_skybox.camera_guidance;
    if (draft.scene_skybox.skybox_id !== undefined) topic.skybox_id = draft.scene_skybox.skybox_id;
    if (draft.scene_skybox.skybox_url !== undefined) topic.skybox_url = draft.scene_skybox.skybox_url;
    if (draft.scene_skybox.asset_list !== undefined) {
      if (!topic.sharedAssets) topic.sharedAssets = {};
      topic.sharedAssets.asset_list = draft.scene_skybox.asset_list;
    }
    if (draft.scene_skybox.sharedAssets) {
      if (!topic.sharedAssets) topic.sharedAssets = {};
      Object.assign(topic.sharedAssets, draft.scene_skybox.sharedAssets);
    }
  }
  if (draft.avatar_script) {
    bundle.avatarScripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
    if (draft.avatar_script.intro !== undefined) bundle.avatarScripts.intro = draft.avatar_script.intro;
    if (draft.avatar_script.explanation !== undefined) bundle.avatarScripts.explanation = draft.avatar_script.explanation;
    if (draft.avatar_script.outro !== undefined) bundle.avatarScripts.outro = draft.avatar_script.outro;
    if (draft.avatar_script.intro !== undefined) bundle.intro = draft.avatar_script.intro;
    if (draft.avatar_script.explanation !== undefined) bundle.explanation = draft.avatar_script.explanation;
    if (draft.avatar_script.outro !== undefined) bundle.outro = draft.avatar_script.outro;
  }
  if (Array.isArray(draft.mcqs)) {
    bundle.mcqs = draft.mcqs.map((m) => ({
      id: m.id || `mcq_${Math.random()}`,
      question: m.question || m.question_text,
      options: Array.isArray(m.options) ? m.options : [],
      correct_option_index: m.correct_option_index ?? 0,
      explanation: m.explanation || '',
      question_text: m.question,
    }));
  }
  if (Array.isArray(draft.images) && draft.images.length >= 0) {
    bundle.images = draft.images.map((img) => ({
      ...img,
      image_url: img.image_url ?? img.url,
      url: img.url ?? img.image_url,
    }));
  }
  if (Array.isArray(draft.assets3d) && draft.assets3d.length >= 0) {
    bundle.assets3d = draft.assets3d
      .filter((a) => !isRetiredMeshyAsset(a) && pickPlayerGlbUrl(a))
      .map((a) => {
        const glbUrl = pickPlayerGlbUrl(a);
        return {
          ...a,
          animated_render_url: isRenderAssetUrl(String(a.animated_render_url || '')) ? a.animated_render_url : '',
          animated_glb_url: isRenderAssetUrl(String(a.animated_render_url || '')) ? a.animated_render_url : '',
          glb_url: glbUrl,
          file_url: glbUrl,
          model_urls: {
            ...(a.model_urls || {}),
            glb: glbUrl,
          },
        };
      });
  }
  // Update bundle skybox when draft has skybox_url (Associate may have changed skybox)
  if (draft.scene_skybox?.skybox_url) {
    const url = draft.scene_skybox.skybox_url;
    bundle.skybox = {
      ...(bundle.skybox || {}),
      skybox_url: url,
      imageUrl: url,
      file_url: url,
    };
  }
  // Overlay draft TTS (Associate-generated; not yet in chapter_tts until approval)
  if (Array.isArray(draft.tts) && draft.tts.length > 0) {
    bundle.tts = draft.tts.map((t) => ({
      ...t,
      audio_url: t.audio_url ?? (t as any).audioUrl,
      url: t.audio_url ?? (t as any).url,
    }));
  }
}

/**
 * Copy the parts of a bundle that `mergeDraftIntoBundle` writes to.
 *
 * The overlay mutates in place, and the object it was handed is the one sitting in
 * the cache — so an Associate's unapproved draft used to leak into the bundle that
 * every later reader of that chapter received, for as long as the entry lived.
 *
 * This is a targeted copy rather than a deep clone on purpose: a Firestore Timestamp
 * is a class instance, and structuredClone would strip its prototype and break
 * `.toDate()` on any caller downstream. Everything not listed here is shared by
 * reference, which is safe precisely because nothing writes to it.
 */
function cloneBundleForOverlay(bundle: LessonBundle): LessonBundle {
  return {
    ...bundle,
    chapter: bundle.chapter
      ? {
          ...bundle.chapter,
          topics: Array.isArray(bundle.chapter.topics)
            ? bundle.chapter.topics.map((topic: any) => ({
                ...topic,
                sharedAssets: topic?.sharedAssets ? { ...topic.sharedAssets } : topic?.sharedAssets,
              }))
            : bundle.chapter.topics,
        }
      : bundle.chapter,
    mcqs: [...bundle.mcqs],
    tts: [...bundle.tts],
    images: [...bundle.images],
    assets3d: [...bundle.assets3d],
    avatarScripts: bundle.avatarScripts ? { ...bundle.avatarScripts } : bundle.avatarScripts,
    skybox: bundle.skybox ? { ...bundle.skybox } : bundle.skybox,
  };
}

/**
 * Overlay an Associate's latest unapproved draft onto a copy of the published bundle.
 * Returns the bundle untouched when the viewer is not an Associate or has no draft.
 */
async function withAssociateDraft(
  bundle: LessonBundle,
  chapterId: string,
  topicId: string | undefined,
  userId: string | undefined,
  userRole: string | undefined
): Promise<LessonBundle> {
  if (userRole !== 'associate' || !userId) return bundle;

  const effectiveTopicId = topicId || bundle.chapter?.topics?.[0]?.topic_id;
  if (!effectiveTopicId) return bundle;

  try {
    const version = await getLatestUnapprovedVersionForUser(chapterId, effectiveTopicId, userId);
    if (!version?.snapshot_ref) return bundle;

    const draft = await getChapterSnapshot(version.snapshot_ref);
    if (!draft) return bundle;

    const overlaid = cloneBundleForOverlay(bundle);
    mergeDraftIntoBundle(overlaid, draft, effectiveTopicId);
    console.log('[getLessonBundle] Overlaid Associate draft for topic', effectiveTopicId);
    return overlaid;
  } catch (err) {
    console.warn('[getLessonBundle] Associate draft overlay failed:', err);
    return bundle;
  }
}

/** Bump when the persisted bundle shape changes, so old entries are ignored rather than misread. */
const PERSISTED_BUNDLE_VERSION = 'v1';

/** A week. An entry is only ever used while it still matches the chapter's updatedAt. */
const PERSISTED_BUNDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PersistedBundle {
  bundle: LessonBundle;
  /** The chapter's updatedAt at the time the bundle was assembled. */
  chapterVersion: string;
}

function persistedBundleKeyPrefix(chapterId: string): string {
  return `bundle:${PERSISTED_BUNDLE_VERSION}:${chapterId}:`;
}

function persistedBundleKey(
  chapterId: string,
  topicId: string | undefined,
  lang: string,
  source: string
): string {
  return `${persistedBundleKeyPrefix(chapterId)}${topicId || 'first'}:${lang}:${source}`;
}

/**
 * A comparable version string for the chapter document.
 *
 * Returns null when the chapter carries no usable timestamp. In that case there is
 * nothing cheap to revalidate against, so the persisted bundle is simply not used
 * rather than risk serving an edited lesson from a week-old copy.
 */
function readChapterVersion(chapterData: any): string | null {
  const raw = chapterData?.updatedAt ?? chapterData?.updated_at ?? null;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw?.toMillis === 'function') return String(raw.toMillis());
  if (typeof raw?.seconds === 'number') return `${raw.seconds}.${raw.nanoseconds ?? 0}`;
  return null;
}

/**
 * Invalidate cached lesson bundles for a chapter (call after chapter/topic updates).
 * Reduces stale reads after curriculum edits.
 */
export function invalidateLessonBundleCache(chapterId: string): void {
  const escaped = chapterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  cacheManager.invalidatePattern(`^bundle:${escaped}:`);
  // The on-disk copy has to go too, or a curriculum edit would keep being papered
  // over by a bundle that outlives the tab.
  void persistentDeleteByPrefix(persistedBundleKeyPrefix(chapterId));
}

export interface GetLessonBundleParams {
  chapterId: string;
  lang: LanguageCode;
  topicId?: string; // Optional: specific topic to extract data from
  userId?: string; // Optional: when Associate, fetch and overlay their draft
  userRole?: string; // Optional: must be 'associate' to overlay draft
  /** 'user_generated' fetches from user_generated_lessons instead of curriculum_chapters (Street View / Create-scene / Spiral-scene drafts). */
  source?: 'curriculum' | 'user_generated';
}

/**
 * Bundles currently being built, so concurrent callers share one fan-out.
 *
 * Opening a lesson asks for the same bundle from up to three places — the /lessons
 * prefetch, the player's URL-param path and the player's preparation effect. They
 * overlap, so the 10-minute cache below could not absorb them: each one missed, and
 * each one ran the full multi-collection fan-out. Joining the in-flight promise
 * collapses those into a single set of reads.
 *
 * Keyed on the same identity as the cache, plus the viewer where that changes the
 * result (only an Associate, whose draft is overlaid on top).
 */
const inFlightBundles = new Map<string, Promise<LessonBundle>>();

export function getLessonBundle(params: GetLessonBundleParams): Promise<LessonBundle> {
  const { chapterId, lang, topicId, userId, userRole, source = 'curriculum' } = params;
  const viewer = userRole === 'associate' ? `associate:${userId ?? ''}` : 'published';
  const inFlightKey = `${CacheManager.getBundleKey(chapterId, topicId, lang, source)}|${viewer}`;

  const existing = inFlightBundles.get(inFlightKey);
  if (existing) {
    console.log(`[getLessonBundle] Joining in-flight request for ${inFlightKey}`);
    return existing;
  }

  const pending = buildLessonBundle(params).finally(() => {
    inFlightBundles.delete(inFlightKey);
  });
  inFlightBundles.set(inFlightKey, pending);
  return pending;
}

async function buildLessonBundle(params: GetLessonBundleParams): Promise<LessonBundle> {
  const { chapterId, lang, topicId, userId, userRole, source = 'curriculum' } = params;

  const cacheKey = CacheManager.getBundleKey(chapterId, topicId, lang, source);
  const cached = cacheManager.get<LessonBundle>(cacheKey);
  if (cached) {
    console.log(`[getLessonBundle] Cache hit for ${cacheKey}`);
    const bundle = await withAssociateDraft(cached, chapterId, topicId, userId, userRole);
    return attachLicensedContent(bundle, chapterId, topicId);
  }

  console.log(`[getLessonBundle] Fetching bundle for chapter ${chapterId}, language ${lang}`);

  try {
    // Step 1: Fetch chapter document (or, for a user-generated lesson, wrap its
    // draft in the same { id, topics: [...] } shape the rest of this pipeline expects).
    let chapterData: any;
    if (source === 'user_generated') {
      const lessonRef = doc(db, 'user_generated_lessons', chapterId);
      const lessonSnap = await getDoc(lessonRef);
      if (!lessonSnap.exists()) {
        throw new Error(`Lesson ${chapterId} not found`);
      }
      const lessonData = lessonSnap.data() as Record<string, any>;
      const tourStops = Array.isArray(lessonData.streetViewTour?.stops) ? lessonData.streetViewTour.stops : [];

      chapterData = {
        id: lessonSnap.id,
        chapter_name: lessonData.title || 'My Lesson',
        chapter_number: 1,
        curriculum: lessonData.curriculum || '',
        class_name: lessonData.class_name || '',
        subject: lessonData.subject || '',
        isStreetViewTour: tourStops.length > 0,
        topics:
          tourStops.length > 0
            ? buildTourStopTopics(chapterId, lessonData.title || 'My Lesson', tourStops)
            : [
                {
                  topic_id: chapterId,
                  topic_name: lessonData.title || 'My Lesson',
                  topic_priority: 1,
                  learning_objective: '',
                  skybox_url: lessonData.skybox_url || '',
                  skybox_glb_url: lessonData.skybox_glb_url || lessonData.skybox_url || '',
                  asset_urls: Array.isArray(lessonData.asset_urls) ? lessonData.asset_urls : [],
                  asset_ids: Array.isArray(lessonData.asset_ids) ? lessonData.asset_ids : [],
                  sharedAssets: {
                    meshy_asset_ids: Array.isArray(lessonData.meshy_asset_ids) ? lessonData.meshy_asset_ids : [],
                    asset_ids: Array.isArray(lessonData.asset_ids) ? lessonData.asset_ids : [],
                  },
                },
              ],
      };
    } else {
      const chapterRef = doc(db, COLLECTION_CURRICULUM_CHAPTERS, chapterId);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        throw new Error(`Chapter ${chapterId} not found`);
      }

      chapterData = {
        id: chapterSnap.id,
        ...chapterSnap.data(),
      };
    }

    console.log(`[getLessonBundle] Chapter loaded:`, {
      id: chapterData.id,
      name: chapterData.chapter_name,
      topicsCount: chapterData.topics?.length || 0,
    });

    // Step 1b: If a previously assembled bundle is on disk and the chapter has not
    // been edited since, reuse it. The chapter document above is the only read this
    // path costs; the ten-or-so collection reads below are skipped entirely. That is
    // what makes a repeat lesson open cheap on a cold page load, where the in-memory
    // cache is always empty.
    const persistKey = persistedBundleKey(chapterId, topicId, lang, source);
    const chapterVersion = readChapterVersion(chapterData);

    if (chapterVersion) {
      const persisted = await persistentGet<PersistedBundle>(persistKey);
      if (persisted?.chapterVersion === chapterVersion && persisted.bundle) {
        console.log(`[getLessonBundle] Reusing persisted bundle for ${persistKey} (chapter unchanged)`);
        cacheManager.set(cacheKey, persisted.bundle, LESSON_BUNDLE_CACHE_TTL_MS);
        const viewerBundle = await withAssociateDraft(
          persisted.bundle,
          chapterId,
          topicId,
          userId,
          userRole
        );
        return attachLicensedContent(viewerBundle, chapterId, topicId);
      }
    }

    // Step 2: Extract linked IDs (from specific topic if provided)
    const extractedIds = extractLinkedIds(chapterData, lang, topicId);
    console.log(`[getLessonBundle] Extracted IDs from ${topicId ? `topic ${topicId}` : 'first topic'}:`, extractedIds);

    // Step 3: Fetch linked documents in parallel
    const [mcqsRaw, ttsRaw, skyboxData, pdfData, meshyAssetsRaw, imagesRaw, textTo3dAssetsRaw] = await Promise.all([
      extractedIds.mcqIds.length > 0
        ? fetchDocsByIds(COLLECTION_CHAPTER_MCQS, extractedIds.mcqIds)
        : Promise.resolve([]),
      extractedIds.ttsIds.length > 0
        ? fetchDocsByIds(COLLECTION_CHAPTER_TTS, extractedIds.ttsIds)
        : Promise.resolve([]),
      (() => {
        const skyboxIdRaw = extractedIds.skyboxId;
        const skyboxIdStr = typeof skyboxIdRaw === 'string' ? skyboxIdRaw : (skyboxIdRaw as any)?.id;
        if (!skyboxIdStr) return Promise.resolve(null);
        return (async () => {
            try {
              const skyboxRef = doc(db, COLLECTION_SKYBOXES, skyboxIdStr);
              const skyboxSnap = await getDoc(skyboxRef);
              if (skyboxSnap.exists()) {
                return { id: skyboxSnap.id, ...skyboxSnap.data() };
              }
            } catch (err) {
              console.warn(`[getLessonBundle] Failed to fetch skybox:`, err);
            }
            return null;
          })();
      })(),
      extractedIds.pdfId
        ? (async () => {
            try {
              const pdfRef = doc(db, COLLECTION_PDFS, extractedIds.pdfId!);
              const pdfSnap = await getDoc(pdfRef);
              if (pdfSnap.exists()) {
                const pdfData = { id: pdfSnap.id, ...pdfSnap.data() };
                console.log(`[getLessonBundle] Loaded PDF: ${pdfData.id}`, {
                  hasImages: !!(pdfData.images && Array.isArray(pdfData.images)),
                  imageCount: pdfData.images?.length || 0,
                });
                return pdfData;
              }
            } catch (err) {
              console.warn(`[getLessonBundle] Failed to fetch PDF:`, err);
            }
            return null;
          })()
        : Promise.resolve(null),
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
      // Fetch images from chapter_images collection
      // Always try both: fetch by IDs AND query by chapter_id/topic_id, then merge
      (async () => {
        try {
          const topic = topicId 
            ? chapterData.topics?.find((t: any) => t.topic_id === topicId)
            : chapterData.topics?.[0];
          
          // Both lookups are kept — an image can be linked by id on the topic OR
          // carry chapter_id/topic_id without being in any id array, and the union is
          // what the studio expects to see. They now run concurrently instead of one
          // after the other, which halves the wall time of this branch.
          const [imagesByIds, imagesByQuery] = await Promise.all([
            extractedIds.imageIds.length > 0
              ? fetchDocsByIds(COLLECTION_CHAPTER_IMAGES, extractedIds.imageIds).then((docs) => {
                  console.log(`[getLessonBundle] Found ${docs.length} images by IDs`);
                  return docs;
                })
              : Promise.resolve([] as any[]),
            topic
              ? (async () => {
                  try {
                    const imagesRef = collection(db, COLLECTION_CHAPTER_IMAGES);
                    const q = query(
                      imagesRef,
                      where('chapter_id', '==', chapterId),
                      where('topic_id', '==', topic.topic_id || '')
                    );
                    const snapshot = await getDocs(q);
                    const docs = snapshot.docs.map((docSnap) => ({
                      id: docSnap.id,
                      ...docSnap.data(),
                    }));
                    if (docs.length > 0) {
                      console.log(`[getLessonBundle] Found ${docs.length} images via chapter_id/topic_id query`);
                    }
                    return docs;
                  } catch (err) {
                    console.warn(`[getLessonBundle] Error querying images by chapter_id/topic_id:`, err);
                    return [] as any[];
                  }
                })()
              : Promise.resolve([] as any[]),
          ]);

          // Merge both results and remove duplicates by ID
          const imageMap = new Map<string, any>();
          
          // Add images fetched by IDs first (priority)
          imagesByIds.forEach(img => {
            if (img.id) {
              imageMap.set(img.id, img);
            }
          });
          
          // Add images from query (will overwrite duplicates, but that's okay)
          imagesByQuery.forEach(img => {
            if (img.id && !imageMap.has(img.id)) {
              imageMap.set(img.id, img);
            }
          });
          
          const mergedImages = Array.from(imageMap.values());
          
          if (mergedImages.length > 0) {
            console.log(`[getLessonBundle] Merged ${mergedImages.length} images (${imagesByIds.length} by IDs, ${imagesByQuery.length} by query)`);
          }
          
          return mergedImages;
        } catch (err) {
          console.warn(`[getLessonBundle] Error fetching images:`, err);
          return [];
        }
      })(),
      // Fetch text_to_3d_assets with all fields (including approval_status, prompt, model_urls, etc.)
      // Try both collection names: text_to_3d_assets and text_to_3d
      (async () => {
        try {
          const topic = topicId 
            ? chapterData.topics?.find((t: any) => t.topic_id === topicId)
            : chapterData.topics?.[0];
          if (!topic) return [];
          
          // First try by IDs if available (try both collection names)
          let textTo3dAssets: any[] = [];
          if (extractedIds.textTo3dAssetIds.length > 0) {
            for (const collectionName of textTo3dCollectionsToTry()) {
              try {
                textTo3dAssets = await fetchDocsByIds(collectionName, extractedIds.textTo3dAssetIds);
                if (textTo3dAssets.length > 0) {
                  resolvedTextTo3dCollection = collectionName;
                  console.log(`[getLessonBundle] Found ${textTo3dAssets.length} text_to_3d_assets by IDs from ${collectionName}`);
                  break;
                }
              } catch (err) {
                // Try the other collection name.
              }
            }
          }
          
          // Also check if any assetIds are actually text_to_3d_assets
          if (extractedIds.assetIds.length > 0 && textTo3dAssets.length === 0) {
            // Try fetching by IDs to see if they're text_to_3d_assets
            for (const collectionName of textTo3dCollectionsToTry()) {
              try {
                const potentialAssets = await fetchDocsByIds(collectionName, extractedIds.assetIds);
                // Filter to only include those that have text_to_3d_asset specific fields
                const textTo3dOnly = potentialAssets.filter((a: any) => 
                  a.prompt || a.model_urls || a.approval_status !== undefined
                );
                if (textTo3dOnly.length > 0) {
                  textTo3dAssets = textTo3dOnly;
                  resolvedTextTo3dCollection = collectionName;
                  console.log(`[getLessonBundle] Found ${textTo3dAssets.length} text_to_3d_assets from assetIds in ${collectionName}`);
                  break;
                }
              } catch (err) {
                // Continue to next collection
              }
            }
          }
          
          // Fallback: Query by chapter_id/topic_id, most-recently-successful collection first.
          if (textTo3dAssets.length === 0) {
            for (const collectionName of textTo3dCollectionsToTry()) {
              try {
                const textTo3dRef = collection(db, collectionName);
                const q = query(
                  textTo3dRef,
                  where('chapter_id', '==', chapterId),
                  where('topic_id', '==', topic?.topic_id || '')
                );
                const snapshot = await getDocs(q);
                textTo3dAssets = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(), // Include all fields: approval_status, prompt, model_urls, status, etc.
                }));
                
                if (textTo3dAssets.length > 0) {
                  resolvedTextTo3dCollection = collectionName;
                  console.log(`[getLessonBundle] Found ${textTo3dAssets.length} text_to_3d_assets via chapter_id/topic_id query from ${collectionName}`);
                  break;
                }
              } catch (err) {
                // Continue to next collection
              }
            }
          }
          
          return textTo3dAssets || [];
        } catch (err) {
          console.warn(`[getLessonBundle] Error fetching text_to_3d_assets:`, err);
          return [];
        }
      })(),
    ]);

    // Derive PDF images from fetched pdfData (cannot reference pdfData inside Promise.all)
    let pdfSuitableImages: any[] = [];
    try {
      if (pdfData && pdfData.images && Array.isArray(pdfData.images)) {
        pdfSuitableImages = pdfData.images.map((img: any, idx: number) => {
          const imageUrl = img.url || img.image_url || img.imageUrl || img.fileUrl || img.file_url || '';
          const thumbnailUrl = img.thumbnail_url || img.thumbnailUrl || img.thumbnail || imageUrl;
          return {
            id: img.id || `pdf_image_${pdfData.id}_${idx}`,
            source: 'pdf',
            pdf_id: pdfData.id,
            pdf_name: pdfData.name || pdfData.filename || 'PDF Document',
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            url: imageUrl,
            name: img.name || img.filename || `PDF Image ${idx + 1}`,
            description: img.description || img.caption || '',
            suitable_for_3d: img.suitable_for_3d === true,
            type: img.type || (img.suitable_for_3d ? 'pdf_3d' : 'pdf'),
            order: img.order ?? idx,
            ...img,
          };
        });
        if (pdfSuitableImages.length > 0) {
          console.log(`[getLessonBundle] Found ${pdfSuitableImages.length} PDF images (${pdfSuitableImages.filter((i: any) => i.suitable_for_3d).length} suitable for 3D)`);
        }
      }
    } catch (err) {
      console.warn(`[getLessonBundle] Error checking PDF images:`, err);
    }

    // Step 4: Apply language filtering
    const mcqsBeforeFilter = mcqsRaw.length;
    const ttsBeforeFilter = ttsRaw.length;
    const assetsBeforeFilter = (meshyAssetsRaw?.length || 0);

    // Option extraction and correct-answer resolution now live in
    // src/lib/mcq/answerIndex.ts so that the fetch layers and all four players agree.
    // The old local copies defaulted an unreadable document to index 0, which scored
    // option A correct instead of reporting that the answer could not be read.

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
          const correctIndex = resolveCorrectAnswerIndex(mcq, options, 'getLessonBundle');
          return {
            // Spread FIRST. It used to come last, which meant the raw document's
            // correct_option_index overwrote the resolved one and this branch silently
            // ignored correct_option_text entirely.
            ...mcq,
            id: mcq.question_id || mcq.id || `inline_${lang}_${index}`,
            question: mcq.question || mcq.question_text || '',
            options: options,
            correct_option_index: correctIndex,
            explanation: mcq.explanation || mcq.explanation_text || '',
          };
        });
      } else {
        // They're IDs, use fetched MCQs and process them
        const filtered = filterByLanguage(mcqsRaw, lang);
        mcqs = filtered.map((mcq: any) => {
          const options = extractMcqOptions(mcq);
          const correctIndex = resolveCorrectAnswerIndex(mcq, options, 'getLessonBundle');
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
        const correctIndex = resolveCorrectAnswerIndex(mcq, options, 'getLessonBundle');
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

    // Filter TTS by language and ensure language field is set
    let tts = filterByLanguage(ttsRaw, lang).map(t => ({
      ...t,
      language: t.language || t.lang || lang, // Ensure language field is explicitly set
    }));
    // Street View Tour stops embed their voiceover audio inline on the topic (no chapter_tts
    // doc/tts_ids) — surface it the same way so the player's existing TTS pipeline just works.
    if (Array.isArray(topic?.ttsAudio) && topic.ttsAudio.length > 0) {
      tts = topic.ttsAudio.map((t: any) => ({ ...t, language: t.language || lang }));
    }
    
    // Enhanced logging for TTS debugging
    console.log(`[getLessonBundle] TTS processing for language ${lang}:`, {
      rawTtsCount: ttsRaw.length,
      filteredTtsCount: tts.length,
      rawTtsSamples: ttsRaw.slice(0, 3).map((t: any) => ({
        id: t.id,
        language: t.language || t.lang || 'none',
        script_type: t.script_type || t.section || 'none',
        hasAudio: !!(t.audio_url || t.audioUrl || t.url),
      })),
      filteredTtsSamples: tts.slice(0, 3).map((t: any) => ({
        id: t.id,
        language: t.language,
        script_type: t.script_type || t.section || 'none',
        hasAudio: !!(t.audio_url || t.audioUrl || t.url),
      })),
    });
    
    // Separate meshy_assets from text_to_3d_assets
    // text_to_3d_assets are already fetched separately in textTo3dAssetsRaw
    // meshy_assets are in meshyAssetsRaw
    // assetsRaw might contain either, but we'll use meshyAssetsRaw as primary source
    const allAssetsRaw = [...(meshyAssetsRaw || [])]
      .filter((asset: any) => !isRetiredMeshyAsset(asset) && pickPlayerGlbUrl(asset));
    // IMPORTANT: 3D assets are LANGUAGE-INDEPENDENT - do NOT filter by language
    // They should appear in both English and Hindi tabs
    const assets3d = allAssetsRaw.map((asset: any) => {
      const glbUrl = pickPlayerGlbUrl(asset);
      const animatedRenderUrl = isRenderAssetUrl(String(asset.animated_render_url || ''))
        ? String(asset.animated_render_url)
        : '';
      return {
        ...asset,
        animated_render_url: animatedRenderUrl,
        animated_glb_url: animatedRenderUrl,
        render_url: isRenderAssetUrl(String(asset.render_url || '')) ? asset.render_url : glbUrl,
        glb_url: glbUrl,
        file_url: glbUrl,
        model_urls: {
          ...(asset.model_urls || {}),
          glb: glbUrl,
        },
      };
    }); // Remove language filtering for 3D assets
    
    // text_to_3d_assets don't need language filtering (they're language-agnostic)
    // But we'll keep them separate in the bundle
    
    console.log(`[getLessonBundle] Merged assets (language-independent):`, {
      textTo3dAssets: textTo3dAssetsRaw?.length || 0,
      meshyAssets: meshyAssetsRaw?.length || 0,
      retiredOrUnrenderableAssets: (meshyAssetsRaw?.length || 0) - allAssetsRaw.length,
      total: allAssetsRaw.length,
      assets3d: assets3d.length,
      note: '3D assets are NOT filtered by language - they appear in all languages',
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

    // Ensure all arrays have safe defaults
    const safeTextTo3dAssets = Array.isArray(textTo3dAssetsRaw) ? textTo3dAssetsRaw : [];
    const safeImagesRaw = Array.isArray(imagesRaw) ? imagesRaw : [];
    const safePdfSuitableImages = Array.isArray(pdfSuitableImages) ? pdfSuitableImages : [];
    const safeMcqs = Array.isArray(mcqs) ? mcqs : [];
    const safeTts = Array.isArray(tts) ? tts : [];
    const safeAssets3d = Array.isArray(assets3d) ? assets3d : [];
    
    const bundle: LessonBundle = {
      lang,
      chapter: chapterData,
      mcqs: safeMcqs,
      tts: safeTts,
      avatarScripts,
      skybox: skyboxData,
      pdf: pdfData,
      assets3d: safeAssets3d,
      images: [...safeImagesRaw, ...safePdfSuitableImages], // Merge regular images with PDF suitable images
      textTo3dAssets: safeTextTo3dAssets,
      intro,
      explanation,
      outro,
      _meta: {
        extractedIds,
        counts: {
          mcqsBeforeFilter,
          mcqsAfterFilter: safeMcqs.length,
          ttsBeforeFilter,
          ttsAfterFilter: safeTts.length,
          assetsBeforeFilter,
          assetsAfterFilter: safeAssets3d.length,
          imagesCount: safeImagesRaw.length + safePdfSuitableImages.length,
          textTo3dAssetsCount: safeTextTo3dAssets.length,
        },
      },
    };

    console.log(`[getLessonBundle] Bundle built successfully:`, {
      lang,
      chapterId: bundle.chapter.id,
      mcqs: bundle.mcqs.length,
      tts: bundle.tts.length,
      ttsLanguages: bundle.tts.map((t: any) => t.language || t.lang || 'unknown'),
      assets3d: bundle.assets3d.length,
      assets3dNote: '3D assets are language-independent and appear in all languages',
      images: bundle.images.length,
      textTo3dAssets: bundle.textTo3dAssets.length,
      hasAvatarScripts: !!bundle.avatarScripts,
      hasSkybox: !!bundle.skybox,
      hasPdf: !!bundle.pdf,
      textTo3dApproved: bundle.textTo3dAssets.filter((a: any) => a.approval_status === true).length,
    });

    // Cache bundle to reduce Firebase reads (invalidated on chapter/topic save)
    cacheManager.set(cacheKey, bundle, LESSON_BUNDLE_CACHE_TTL_MS);

    // And keep a copy on disk, tagged with the chapter version it was built from, so
    // the next cold load can revalidate with one read instead of rebuilding. Not
    // awaited: persistence is an optimisation and must never delay the lesson.
    if (chapterVersion) {
      void persistentSet(
        persistKey,
        { bundle, chapterVersion } satisfies PersistedBundle,
        PERSISTED_BUNDLE_TTL_MS
      );
    }

    // The bundle just cached is the published one. The Associate overlay is applied
    // to a copy so the cached entry stays clean for every other reader.
    const viewerBundle = await withAssociateDraft(bundle, chapterId, topicId, userId, userRole);

    return attachLicensedContent(viewerBundle, chapterId, topicId);
  } catch (error) {
    console.error(`[getLessonBundle] Error building bundle:`, error);
    throw error;
  }
}
