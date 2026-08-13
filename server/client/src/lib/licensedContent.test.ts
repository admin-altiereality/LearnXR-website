import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNativeLicensedLesson } from './licensedContent';

test('builds a KRPano-compatible synthetic lesson from a signed native manifest', () => {
  const lesson = buildNativeLicensedLesson({
    id: 'abc123',
    provider: 'corinth',
    provider_content_id: 'heart',
    revision: '2',
    title: 'Human Heart',
    description: 'Inspect chambers, valves, and circulation.',
    subject: 'Biology',
    grade_bands: ['8'],
    curriculum_tags: ['circulation'],
    languages: ['en'],
    content_type: 'interactive_model',
    delivery_mode: 'krpano_native',
    collection_ids: ['biology'],
    capabilities: ['parts', 'labels'],
    attribution: 'Licensed from Corinth',
    status: 'published',
    artifact_url: 'https://storage.example/signed-heart.glb',
    environment_url: 'https://storage.example/lab.jpg',
    interaction_manifest: { parts: [{ id: 'left-ventricle', label: 'Left ventricle' }] },
  });

  assert.equal(lesson.chapter.chapter_id, '__licensed_3d__');
  assert.equal(lesson.topic.topic_id, 'abc123');
  assert.deepEqual(lesson.topic.asset_urls, ['https://storage.example/signed-heart.glb']);
  assert.deepEqual(lesson.topic.asset_ids, ['licensed_abc123']);
  assert.equal(lesson.topic.skybox_url, 'https://storage.example/lab.jpg');
  assert.equal(lesson.licensedContent.id, 'abc123');
});

test('rejects a native launch when the signed artifact URL is absent', () => {
  assert.throws(
    () => buildNativeLicensedLesson({
      id: 'abc123',
      title: 'Human Heart',
      description: 'Heart model',
      subject: 'Biology',
      provider: 'corinth',
      provider_content_id: 'heart',
      revision: '2',
      grade_bands: ['8'],
      curriculum_tags: [],
      languages: ['en'],
      content_type: 'interactive_model',
      delivery_mode: 'krpano_native',
      collection_ids: ['biology'],
      capabilities: [],
      attribution: 'Licensed from Corinth',
      status: 'published',
      artifact_url: null,
    }),
    /artifact/i,
  );
});
