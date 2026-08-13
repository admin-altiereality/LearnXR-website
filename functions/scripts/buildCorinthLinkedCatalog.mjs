import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { classifyCorinthCurriculum } from '../lib/services/corinthCurriculum.js';
import { validateImportedManifest } from '../lib/services/licensedContentDomain.js';

const sourcePath = resolve(process.argv[2] || '../docs/integrations/corinth-linked-catalog-source-100.json');
const outputPath = resolve(process.argv[3] || '../docs/integrations/corinth-linked-catalog-100.json');
const sourceItems = JSON.parse(await readFile(sourcePath, 'utf8'));

if (!Array.isArray(sourceItems) || sourceItems.length !== 100) {
  throw new Error('The Corinth source inventory must contain exactly 100 lessons.');
}

const sourceIds = sourceItems.map((item) => String(item.provider_content_id || ''));
if (sourceIds.some((id) => !id) || new Set(sourceIds).size !== sourceIds.length) {
  throw new Error('Every Corinth lesson must have a unique provider_content_id.');
}

function validateSourceUrl(value) {
  const parsed = new URL(String(value || ''));
  if (parsed.origin !== 'https://app.corinth3d.com' || !parsed.pathname.startsWith('/content/') || parsed.search || parsed.hash) {
    throw new Error(`Invalid permanent Corinth content URL: ${value}`);
  }
  return parsed.toString();
}

function normalizeContentType(value) {
  const label = String(value || '').toLowerCase();
  if (label.includes('experience') || label.includes('field trip')) return 'interactive_experience';
  if (label.includes('video')) return 'video';
  return 'interactive_model';
}

function conceptTag(title) {
  const normalized = String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return normalized || 'immersive-stem';
}

const manifests = sourceItems.map((item) => {
  const classification = classifyCorinthCurriculum({
    category: String(item.category || ''),
    title: String(item.title || ''),
    description: String(item.description || ''),
  });
  const sourceUrl = validateSourceUrl(item.source_url);
  const contentType = normalizeContentType(item.content_type_label);
  const curriculumTags = Array.isArray(item.curriculum_tags) && item.curriculum_tags.length > 0
    ? item.curriculum_tags.map(String)
    : [...classification.curriculumTags, conceptTag(item.title)];

  return {
    provider: 'corinth',
    provider_content_id: String(item.provider_content_id),
    revision: 'linked-2026-08-13',
    title: String(item.title),
    description: String(item.description),
    subject: item.subject ? String(item.subject) : classification.subject,
    grade_bands: Array.isArray(item.grade_bands) && item.grade_bands.length > 0
      ? item.grade_bands.map(String)
      : classification.gradeBands,
    curriculum_tags: [...new Set(curriculumTags)],
    languages: ['en'],
    content_type: contentType,
    delivery_mode: 'external_link',
    collection_ids: ['corinth-linked-catalog-100'],
    capabilities: contentType === 'video'
      ? ['provider-viewer', 'video']
      : ['provider-viewer', 'interactive-3d'],
    attribution: 'Licensed Corinth 3D link',
    external_link: {
      approved_origins: ['https://app.corinth3d.com'],
      launch_url: sourceUrl,
      link_type: 'permanent',
      last_verified_at: '2026-08-13T00:00:00.000Z',
    },
  };
});

const validationErrors = manifests.flatMap((manifest, index) => {
  const result = validateImportedManifest(manifest);
  return result.errors.map((error) => `Lesson ${index + 1}: ${error}`);
});
if (validationErrors.length > 0) throw new Error(validationErrors.join('\n'));

await writeFile(outputPath, `${JSON.stringify(manifests, null, 2)}\n`);
console.log(`Generated ${manifests.length} validated Corinth lessons at ${outputPath}.`);
