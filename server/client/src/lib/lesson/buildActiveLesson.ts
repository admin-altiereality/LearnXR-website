/**
 * buildActiveLesson – turn a launched lesson into the payload the player reads.
 *
 * This transformation used to live inside ClassLaunchRouter, which made it
 * reachable only by students: the router returns immediately for anyone who is
 * not `isStudentInSession`, so a TEACHER advancing their class never got new
 * lesson data at all. Their player disposed the finished topic and then reloaded
 * the same one, because the only copy of the lesson — a single `activeLesson`
 * key in sessionStorage — still held it.
 *
 * Students had a subtler version of the same problem. The player and the router
 * both react to the same session snapshot; the player read sessionStorage
 * synchronously while the router only wrote it after an `await getLessonBundle`.
 * The synchronous read won, so the player loaded the previous topic. Passing
 * lesson data between two subscribers through one unstamped key cannot be made
 * reliable by tuning the timing — the dependency has to go.
 *
 * With the transformation here, the player fetches its own bundle for the topic
 * it was told about, and the router keeps doing the same for the initial
 * navigation. Nobody waits on anybody, and a teacher is served exactly like a
 * student.
 */

import { getLessonBundle } from '../../services/firestore/getLessonBundle';
import type { LanguageCode } from '../../types/curriculum';
import type { LaunchedLesson } from '../../types/lms';

export interface ActiveLessonChapter {
  chapter_id: string;
  chapter_name: string;
  chapter_number: number;
  curriculum: string;
  class_name: string;
  subject: string;
}

export interface ActiveLessonPayload {
  chapter: ActiveLessonChapter;
  topic: Record<string, any>;
  image3dasset: any;
  meshy_asset_ids: string[];
  assets3d: any[];
  startedAt: string;
  _meta: { assets3d: any[]; meshy_asset_ids: string[] };
  language: LanguageCode;
  ttsAudio: any[];
}

/**
 * Fetch and shape the lesson a launch points at.
 *
 * Returns null when the chapter or topic cannot be resolved, so the caller can
 * leave the current lesson standing rather than tearing the room down around a
 * lesson that never arrived.
 */
export async function buildActiveLesson(
  launched: Pick<
    LaunchedLesson,
    'chapter_id' | 'topic_id' | 'lang' | 'lesson_type' | 'curriculum' | 'class_name' | 'subject'
  >
): Promise<ActiveLessonPayload | null> {
  const effectiveLang = (launched.lang ?? 'en') as LanguageCode;
  const lessonType = String(launched.lesson_type ?? 'curriculum');

  const bundle = await getLessonBundle({
    chapterId: launched.chapter_id,
    lang: effectiveLang,
    topicId: launched.topic_id,
    source: lessonType === 'user_generated' ? 'user_generated' : 'curriculum',
  });

  const fullData: any = bundle.chapter;
  const topic: any =
    fullData?.topics?.find((t: { topic_id?: string }) => t.topic_id === launched.topic_id) ||
    fullData?.topics?.[0];
  if (!topic) return null;

  const scripts = bundle.avatarScripts || { intro: '', explanation: '', outro: '' };
  const assetUrls = [...(topic.asset_urls || [])];
  const assetIds = [...(topic.asset_ids || [])];
  const safeAssets3d = Array.isArray(bundle.assets3d) ? bundle.assets3d : [];

  // URLs and ids are appended in step, and mergeLessonAssets pairs them by
  // index to recognise an asset arriving from more than one source. Adding to
  // one list without the other silently breaks that pairing.
  safeAssets3d.forEach((asset: any) => {
    const glb =
      asset?.animated_render_url ||
      asset?.animated_glb_url ||
      asset?.render_url ||
      asset?.model_urls?.glb ||
      asset?.glb_url;
    if (glb && !assetUrls.includes(glb)) {
      assetUrls.push(glb);
      assetIds.push(asset.id || `asset_${assetUrls.length}`);
    }
  });

  const safeMcqs = Array.isArray(bundle.mcqs) ? bundle.mcqs : [];
  const mcqs = safeMcqs.map((m: any, i: number) => ({
    id: m.id || `mcq_${i}`,
    question: m.question || m.question_text || '',
    options: Array.isArray(m.options) ? m.options : [],
    correct_option_index: m.correct_option_index ?? 0,
    explanation: m.explanation || '',
  }));

  const safeTts = Array.isArray(bundle.tts) ? bundle.tts : [];
  const ttsAudio = safeTts
    .map((tts: any) => ({
      id: tts.id || '',
      script_type: tts.script_type || tts.section || 'full',
      audio_url: tts.audio_url || tts.audioUrl || tts.url || '',
      language: tts.language || tts.lang || effectiveLang,
    }))
    .filter((tts) => (tts.language || 'en').toLowerCase() === effectiveLang.toLowerCase());

  const skyboxUrl = bundle.skybox?.imageUrl || (bundle.skybox as any)?.file_url || topic.skybox_url || '';
  const skyboxGlb =
    (bundle.skybox as any)?.stored_glb_url ||
    (bundle.skybox as any)?.glb_url ||
    topic.skybox_glb_url ||
    '';

  const chapter: ActiveLessonChapter = {
    chapter_id: String(launched.chapter_id),
    chapter_name: fullData.chapter_name || 'Untitled Chapter',
    chapter_number: Number(fullData.chapter_number) || 1,
    // The launch payload wins where it says anything: a teacher can launch a
    // chapter into a class whose name differs from the chapter's own.
    curriculum: String(launched.curriculum || fullData.curriculum || ''),
    class_name: String((launched.class_name || fullData.class_name) ?? ''),
    subject: String((launched.subject || fullData.subject) ?? ''),
  };

  const cleanTopic = {
    topic_id: String(topic.topic_id ?? launched.topic_id),
    topic_name: topic.topic_name || 'Untitled Topic',
    topic_priority: Number(topic.topic_priority) || 1,
    learning_objective: topic.learning_objective || '',
    skybox_id: bundle.skybox?.id ?? topic.skybox_id ?? null,
    skybox_remix_id: topic.skybox_remix_id ?? null,
    skybox_url: skyboxUrl,
    skybox_glb_url: skyboxGlb,
    avatar_intro: scripts.intro || '',
    avatar_explanation: scripts.explanation || '',
    avatar_outro: scripts.outro || '',
    asset_urls: assetUrls,
    asset_ids: assetIds,
    mcq_ids: topic.mcq_ids || [],
    mcqs,
    tts_ids: topic.tts_ids || [],
    tts_audio_url: topic.tts_audio_url || '',
    ttsAudio,
    language: effectiveLang,
  };

  return {
    chapter,
    topic: cleanTopic,
    image3dasset: fullData.image3dasset ?? null,
    meshy_asset_ids: fullData.meshy_asset_ids ?? [],
    assets3d: safeAssets3d,
    startedAt: new Date().toISOString(),
    _meta: {
      assets3d: safeAssets3d,
      meshy_asset_ids: fullData.meshy_asset_ids || [],
    },
    language: effectiveLang,
    ttsAudio,
  };
}
