import type { LicensedContentManifest } from '../types/licensedContent';

export const DEFAULT_LICENSED_LAB_ENVIRONMENT = '/img/immersive-stem-lab-360.png';

export function buildNativeLicensedLesson(manifest: LicensedContentManifest) {
  if (manifest.delivery_mode !== 'krpano_native') {
    throw new Error('Hosted content cannot be opened in the native KRPano lesson player.');
  }
  if (!manifest.artifact_url) {
    throw new Error('The signed native artifact URL is unavailable.');
  }

  const chapter = {
    chapter_id: '__licensed_3d__',
    chapter_name: 'Immersive STEM Library',
    chapter_number: 1,
    curriculum: 'Licensed Content',
    class_name: manifest.grade_bands.join(', '),
    subject: manifest.subject,
  };
  const topic = {
    topic_id: manifest.id,
    topic_name: manifest.title,
    topic_priority: 1,
    learning_objective: manifest.description,
    in3d_prompt: '',
    skybox_url: manifest.environment_url || DEFAULT_LICENSED_LAB_ENVIRONMENT,
    avatar_intro: `Welcome to ${manifest.title}.`,
    avatar_explanation: manifest.description,
    avatar_outro: 'Review the model from every angle and identify the key structures.',
    asset_urls: [manifest.artifact_url],
    asset_ids: [`licensed_${manifest.id}`],
    mcqs: [],
    language: manifest.languages[0] || 'en',
    licensed_content_id: manifest.id,
    licensed_interaction_manifest: manifest.interaction_manifest || null,
  };

  return {
    chapter,
    topic,
    assets3d: [{
      id: `licensed_${manifest.id}`,
      glb_url: manifest.artifact_url,
      title: manifest.title,
      provider: manifest.provider,
      revision: manifest.revision,
    }],
    licensedContent: manifest,
    startedAt: new Date().toISOString(),
    _meta: {
      assets3d: [{ id: `licensed_${manifest.id}`, glb_url: manifest.artifact_url }],
      licensed_content_id: manifest.id,
      licensed_revision: manifest.revision,
    },
  };
}
