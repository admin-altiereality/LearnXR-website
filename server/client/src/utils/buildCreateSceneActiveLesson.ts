import type { LaunchedScene } from '../types/lms';

const CHAPTER_ID = '__spiral_generated__';

function topicIdFromScene(scene: LaunchedScene): string {
  const raw = [scene.skybox_id, scene.skybox_image_url, scene.meshy_glb_url, scene.name]
    .filter(Boolean)
    .join('|');
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = Math.imul(31, h) + raw.charCodeAt(i) | 0;
  }
  return `create_${Math.abs(h).toString(36)}`;
}

/**
 * Synthetic activeLesson for KRPano when teacher launches a Spiral create_scene to the class.
 * Shape aligned with StudentDashboard / VRLessonPlayerKrpano sessionStorage bootstrap.
 */
export function buildCreateSceneActiveLesson(scene: LaunchedScene, lang = 'en'): Record<string, unknown> {
  const topicId = topicIdFromScene(scene);
  const skyboxUrl = scene.skybox_image_url || '';
  const skyboxGlb = scene.skybox_glb_url || '';
  const assetUrls: string[] = [];
  if (scene.meshy_glb_url) {
    assetUrls.push(scene.meshy_glb_url);
  }

  const mcqs: unknown[] = [];
  const ttsAudio: unknown[] = [];

  const cleanTopic = {
    topic_id: topicId,
    topic_name: scene.name || 'Spiral generated scene',
    topic_priority: 1,
    learning_objective: '',
    skybox_id: scene.skybox_id ?? null,
    skybox_remix_id: null,
    skybox_url: skyboxUrl,
    skybox_glb_url: skyboxGlb,
    avatar_intro: '',
    avatar_explanation: '',
    avatar_outro: '',
    asset_urls: assetUrls,
    asset_ids: assetUrls.map((_, i) => `spiral_asset_${i}`),
    mcq_ids: [] as string[],
    mcqs,
    tts_ids: [] as string[],
    tts_audio_url: '',
    ttsAudio,
    language: lang,
  };

  const cleanChapter = {
    chapter_id: CHAPTER_ID,
    chapter_name: scene.name || 'Spiral scene',
    chapter_number: 1,
    curriculum: '',
    class_name: '',
    subject: '',
  };

  return {
    chapter: cleanChapter,
    topic: cleanTopic,
    image3dasset: null,
    meshy_asset_ids: [] as string[],
    assets3d: [] as unknown[],
    startedAt: new Date().toISOString(),
    _meta: { assets3d: [], meshy_asset_ids: [] as string[] },
    language: lang,
    ttsAudio,
  };
}
