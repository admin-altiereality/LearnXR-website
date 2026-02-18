/**
 * Build lesson payload from a LessonBundle for launching the VR lesson player.
 * Used when Super Admin previews an Associate's draft from Lesson Edit Requests.
 */

import type { LessonBundle } from './firestore/getLessonBundle';
import type { LessonChapter, LessonTopic, LessonMCQ } from '../contexts/LessonContext';

/**
 * Build chapter and topic in the shape expected by LessonContext and VRLessonPlayer.
 * Uses first topic in bundle if topicId not provided.
 */
export function buildLessonPayloadFromBundle(
  bundle: LessonBundle,
  topicId?: string
): { chapter: LessonChapter; topic: LessonTopic } {
  const ch = bundle.chapter;
  const topics = ch?.topics || [];
  const topic = topicId
    ? topics.find((t: { topic_id?: string }) => t.topic_id === topicId) ?? topics[0]
    : topics[0];

  if (!ch || !topic) {
    throw new Error('Bundle has no chapter or topic');
  }

  const chapter: LessonChapter = {
    chapter_id: ch.id || ch.chapter_id || '',
    chapter_name: ch.chapter_name || 'Untitled Chapter',
    chapter_number: ch.chapter_number ?? 1,
    curriculum: ch.curriculum_id || ch.curriculum || 'CBSE',
    class_name: String(ch.class_id ?? ch.class_name ?? '8'),
    subject: ch.subject_id || ch.subject || 'Science',
  };

  // Prioritize topic.skybox_url (set by draft overlay) over bundle.skybox
  // This ensures associate's draft skybox changes are shown in preview
  // Check multiple possible locations for skybox URL - order matters!
  let skyboxUrl = '';
  let skyboxId: string | undefined = undefined;
  
  // Priority 1: Topic-level skybox_url (set by draft overlay from associate's changes)
  if (topic?.skybox_url) {
    skyboxUrl = topic.skybox_url;
    skyboxId = topic.skybox_id;
  }
  // Priority 2: Topic sharedAssets skybox_url
  else if (topic?.sharedAssets?.skybox_url) {
    skyboxUrl = topic.sharedAssets.skybox_url;
    skyboxId = topic.sharedAssets.skybox_id;
  }
  // Priority 3: Bundle skybox (from original fetch or draft overlay)
  else if (bundle.skybox) {
    skyboxUrl = bundle.skybox.imageUrl || bundle.skybox.file_url || bundle.skybox.skybox_url || '';
    skyboxId = bundle.skybox.id;
  }
  
  // If we have skybox_id but no URL, keep the ID so player can fetch it
  if (!skyboxUrl && !skyboxId) {
    skyboxId = topic?.skybox_id ?? topic?.sharedAssets?.skybox_id ?? bundle.skybox?.id;
  }
  
  // Debug logging
  console.log('[buildLessonPayloadFromBundle] Skybox extraction:', {
    topic_skybox_url: topic?.skybox_url,
    topic_skybox_id: topic?.skybox_id,
    topic_sharedAssets_skybox_url: topic?.sharedAssets?.skybox_url,
    topic_sharedAssets_skybox_id: topic?.sharedAssets?.skybox_id,
    bundle_skybox_exists: !!bundle.skybox,
    bundle_skybox_id: bundle.skybox?.id,
    bundle_skybox_imageUrl: bundle.skybox?.imageUrl,
    bundle_skybox_file_url: bundle.skybox?.file_url,
    bundle_skybox_skybox_url: bundle.skybox?.skybox_url,
    final_skyboxUrl: skyboxUrl || '(empty - will fetch by ID if available)',
    final_skyboxId: skyboxId,
  });
  const avatarIntro = bundle.avatarScripts?.intro ?? bundle.intro ?? topic?.topic_avatar_intro ?? '';
  const avatarExplanation = bundle.avatarScripts?.explanation ?? bundle.explanation ?? topic?.topic_avatar_explanation ?? '';
  const avatarOutro = bundle.avatarScripts?.outro ?? bundle.outro ?? topic?.topic_avatar_outro ?? '';

  const mcqs: LessonMCQ[] = (bundle.mcqs || []).map((m: any) => ({
    id: m.id || '',
    question: m.question || m.question_text || '',
    options: Array.isArray(m.options) ? m.options : [],
    correct_option_index: m.correct_option_index ?? 0,
    explanation: m.explanation || '',
  }));

  const ttsAudio = (bundle.tts || []).map((t: any) => ({
    script_type: t.script_type || t.section || 'full',
    audio_url: t.audio_url || t.url || '',
    language: t.language || t.lang || bundle.lang || 'en',
  }));

  const assetUrls = (bundle.assets3d || []).map((a: any) => a.glb_url || a.file_url).filter(Boolean);

  const lessonTopic: LessonTopic = {
    topic_id: topic.topic_id || topic.id || '',
    topic_name: topic.topic_name || 'Untitled Topic',
    topic_priority: topic.topic_priority ?? 1,
    learning_objective: topic.learning_objective || '',
    in3d_prompt: topic.in3d_prompt || '',
    skybox_id: skyboxId,
    skybox_url: skyboxUrl,
    avatar_intro: avatarIntro,
    avatar_explanation: avatarExplanation,
    avatar_outro: avatarOutro,
    asset_list: topic.asset_list || [],
    asset_urls: assetUrls,
    asset_ids: topic.asset_ids || [],
    mcqs,
    ttsAudio,
    language: bundle.lang || 'en',
  };

  return { chapter, topic: lessonTopic };
}
