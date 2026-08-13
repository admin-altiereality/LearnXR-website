import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildLicensedContentDocument, validateImportedManifest } from '../lib/services/licensedContentDomain.js';

const projectId = process.env.GCLOUD_PROJECT || 'learnxr-evoneuralai';
const manifestPath = resolve(process.argv[2] || '../docs/integrations/corinth-linked-pilot.json');
const actorUid = process.env.LICENSED_CONTENT_ACTOR || 'deployment-operator';
const databaseRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;

const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const raw = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
  throw new Error('Manifest file must contain between 1 and 100 records.');
}

const manifests = raw.map((item, index) => {
  const validation = validateImportedManifest(item);
  if (!validation.ok || !validation.value) {
    throw new Error(`Manifest ${index + 1} is invalid: ${validation.errors.join(' ')}`);
  }
  return validation.value;
});

function documentId(manifest) {
  return createHash('sha256')
    .update(`${manifest.provider}:${manifest.provider_content_id}:${manifest.revision}`)
    .digest('hex')
    .slice(0, 40);
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, firestoreValue(nested)])) } };
  }
  throw new Error(`Unsupported Firestore value: ${typeof value}`);
}

function fields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const ids = manifests.map(documentId);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate provider revisions in manifest file.');

const existing = await Promise.all(ids.map(async (id) => {
  const response = await fetch(`${databaseRoot}/licensed_content/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}));
const immutable = existing.find((document) => document && !['draft', 'review'].includes(document.fields?.status?.stringValue));
if (immutable) throw new Error(`Published revision ${immutable.name} cannot be replaced.`);

const now = new Date();
const writes = [];
manifests.forEach((manifest, index) => {
  const id = ids[index];
  const built = buildLicensedContentDocument(manifest, actorUid, now);
  writes.push({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/licensed_content/${id}`,
      fields: fields({ ...built, created_at: now.toISOString(), updated_at: now.toISOString() }),
    },
  });
  const jobId = randomUUID().replaceAll('-', '');
  writes.push({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/licensed_content_import_jobs/${jobId}`,
      fields: fields({ provider: manifest.provider, import_key: built.import_key, content_id: id, status: 'validated', actor_uid: actorUid, created_at: now.toISOString() }),
    },
  });
  const auditId = randomUUID().replaceAll('-', '');
  writes.push({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/licensed_content_audit_log/${auditId}`,
      fields: fields({ action: existing[index] ? 'revision_reimported' : 'revision_imported', actor_uid: actorUid, content_id: id, metadata: { import_key: built.import_key, import_job_id: jobId }, created_at: now.toISOString() }),
    },
  });
});

await request(commitUrl, { method: 'POST', body: JSON.stringify({ writes }) });
console.log(`Staged ${manifests.length} Corinth account-linked revisions in ${projectId}.`);
