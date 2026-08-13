import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = process.env.GCLOUD_PROJECT || 'learnxr-evoneuralai';
const manifestPath = resolve(process.argv[2] || '../docs/integrations/corinth-linked-catalog-100.json');
const schoolId = String(process.argv[3] || '').trim();
const actorUid = process.env.LICENSED_CONTENT_ACTOR || 'deployment-operator';
const databaseRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;

if (!/^[a-zA-Z0-9_-]{1,128}$/.test(schoolId)) {
  throw new Error('A valid entitled school document ID is required.');
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const manifests = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifests) || manifests.length !== 100) {
  throw new Error('The release manifest must contain exactly 100 lessons.');
}

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

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const provider = await request(`${databaseRoot}/licensed_content_providers/corinth`);
const providerFields = provider.fields || {};
const licenseEndsAt = providerFields.license_ends_at?.stringValue;
if (providerFields.licensing_approved?.booleanValue !== true || providerFields.external_link_approved?.booleanValue !== true) {
  throw new Error('Corinth licensing and external-link approval must both be active before release.');
}
if (!licenseEndsAt || new Date(licenseEndsAt).getTime() <= Date.now()) {
  throw new Error('The Corinth provider license is expired or has no valid end date.');
}

const ids = manifests.map(documentId);
if (new Set(ids).size !== 100) throw new Error('The release manifest contains duplicate revisions.');
const contentDocuments = await Promise.all(ids.map((id) => request(`${databaseRoot}/licensed_content/${id}`)));
const invalid = contentDocuments.find((document) => {
  const fields = document.fields || {};
  return fields.provider?.stringValue !== 'corinth' || fields.delivery_mode?.stringValue !== 'external_link';
});
if (invalid) throw new Error(`Invalid staged content document: ${invalid.name}`);

const now = new Date().toISOString();
const writes = contentDocuments.flatMap((document, index) => {
  const contentId = ids[index];
  const fields = {
    ...document.fields,
    status: firestoreValue('published'),
    published_at: document.fields.published_at || firestoreValue(now),
    updated_at: firestoreValue(now),
    updated_by: firestoreValue(actorUid),
  };
  const auditId = randomUUID().replaceAll('-', '');
  return [
    { update: { name: document.name, fields } },
    {
      update: {
        name: `projects/${projectId}/databases/(default)/documents/licensed_content_audit_log/${auditId}`,
        fields: {
          action: firestoreValue('published'),
          actor_uid: firestoreValue(actorUid),
          content_id: firestoreValue(contentId),
          metadata: firestoreValue({ release_manifest: 'corinth-linked-catalog-100' }),
          created_at: firestoreValue(now),
        },
      },
    },
  ];
});

const entitlementId = createHash('sha256').update(`school:${schoolId}:corinth`).digest('hex').slice(0, 40);
writes.push({
  update: {
    name: `projects/${projectId}/databases/(default)/documents/content_entitlements/${entitlementId}`,
    fields: {
      target_type: firestoreValue('school'),
      target_id: firestoreValue(schoolId),
      provider: firestoreValue('corinth'),
      collection_ids: firestoreValue(['corinth-linked-catalog-100']),
      status: firestoreValue('active'),
      starts_at: firestoreValue(providerFields.license_starts_at?.stringValue || now),
      ends_at: firestoreValue(licenseEndsAt),
      updated_by: firestoreValue(actorUid),
      updated_at: firestoreValue(now),
    },
  },
});

await request(commitUrl, { method: 'POST', body: JSON.stringify({ writes }) });
console.log(`Published ${ids.length} Corinth lessons and entitled school ${schoolId} through ${licenseEndsAt}.`);
