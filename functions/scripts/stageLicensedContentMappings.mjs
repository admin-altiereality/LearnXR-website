import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateLessonContentMapping } from '../lib/services/licensedContentDomain.js';

const projectId = process.env.GCLOUD_PROJECT || 'learnxr-evoneuralai';
const mappingPath = resolve(process.argv[2] || '../docs/integrations/corinth-linked-pilot-mappings.json');
const actorUid = process.env.LICENSED_CONTENT_ACTOR || 'deployment-operator';
const root = `projects/${projectId}/databases/(default)/documents`;
const apiRoot = `https://firestore.googleapis.com/v1/${root}`;
const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const raw = JSON.parse(await readFile(mappingPath, 'utf8'));

if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
  throw new Error('Mapping file must contain between 1 and 100 records.');
}
const mappings = raw.map((item, index) => {
  const validation = validateLessonContentMapping(item);
  if (!validation.ok || !validation.value) {
    throw new Error(`Mapping ${index + 1} is invalid: ${validation.errors.join(' ')}`);
  }
  if (validation.value.review_status === 'approved') {
    throw new Error(`Mapping ${index + 1} cannot be directly staged as approved.`);
  }
  return validation.value;
});

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, firestoreValue(nested)])) } };
}

function fields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]));
}

const contentIds = [...new Set(mappings.map((mapping) => mapping.licensed_content_id))];
await Promise.all(contentIds.map(async (contentId) => {
  const response = await fetch(`${apiRoot}/licensed_content/${contentId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) throw new Error(`Licensed content ${contentId} does not exist.`);
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
}));

const mappingIds = mappings.map((mapping) => createHash('sha256')
  .update(`${mapping.chapter_id}:${mapping.topic_id}:${mapping.licensed_content_id}`)
  .digest('hex')
  .slice(0, 40));
await Promise.all(mappingIds.map(async (mappingId) => {
  const response = await fetch(`${apiRoot}/lesson_content_links/${mappingId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const existing = await response.json();
  if (existing.fields?.review_status?.stringValue === 'approved') {
    throw new Error(`Approved curriculum mapping ${mappingId} cannot be replaced by the staging script.`);
  }
}));

const now = new Date().toISOString();
const writes = mappings.flatMap((mapping, index) => {
  const id = mappingIds[index];
  const auditId = randomUUID().replaceAll('-', '');
  return [
    {
      update: {
        name: `${root}/lesson_content_links/${id}`,
        fields: fields({ ...mapping, reviewed_by: actorUid, reviewed_at: now, updated_by: actorUid, updated_at: now }),
      },
    },
    {
      update: {
        name: `${root}/licensed_content_audit_log/${auditId}`,
        fields: fields({
          action: 'lesson_link_staged',
          actor_uid: actorUid,
          content_id: mapping.licensed_content_id,
          metadata: { link_id: id, chapter_id: mapping.chapter_id, topic_id: mapping.topic_id, review_status: mapping.review_status, mapping_score: mapping.mapping_score },
          created_at: now,
        }),
      },
    },
  ];
});

const response = await fetch(commitUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
console.log(`Staged ${mappings.length} licensed curriculum mappings in ${projectId}.`);
