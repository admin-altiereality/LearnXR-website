import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const projectId = process.env.GCLOUD_PROJECT || 'learnxr-evoneuralai';
const provider = String(process.env.LICENSED_PROVIDER || 'corinth').trim().toLowerCase();
const actorUid = process.env.LICENSED_CONTENT_ACTOR || 'deployment-operator';
const licenseStartsAt = new Date(String(process.env.LICENSE_STARTS_AT || ''));
const licenseEndsAt = new Date(String(process.env.LICENSE_ENDS_AT || ''));
const licensedSeatCount = Number(process.env.LICENSED_SEAT_COUNT);
const agreementReference = String(process.env.LICENSE_AGREEMENT_REFERENCE || '').trim();
const permittedLinkTypes = String(process.env.PERMITTED_LINK_TYPES || 'permanent')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const licensingApproved = process.env.LICENSING_APPROVED === 'true';
const externalLinkApproved = process.env.EXTERNAL_LINK_APPROVED === 'true';

if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(provider)) throw new Error('LICENSED_PROVIDER is invalid.');
if (Number.isNaN(licenseStartsAt.getTime()) || Number.isNaN(licenseEndsAt.getTime()) || licenseEndsAt <= licenseStartsAt) {
  throw new Error('LICENSE_STARTS_AT and LICENSE_ENDS_AT must define a valid license window.');
}
if (!Number.isInteger(licensedSeatCount) || licensedSeatCount < 1 || licensedSeatCount > 100000) {
  throw new Error('LICENSED_SEAT_COUNT must be an integer from 1 to 100000.');
}
if (!agreementReference) throw new Error('LICENSE_AGREEMENT_REFERENCE is required for auditability.');
if (!licensingApproved || !externalLinkApproved) {
  throw new Error('LICENSING_APPROVED=true and EXTERNAL_LINK_APPROVED=true are required to enable provider launches.');
}
if (permittedLinkTypes.length === 0 || permittedLinkTypes.some((value) => !['permanent', 'student_access', 'temporary'].includes(value))) {
  throw new Error('PERMITTED_LINK_TYPES contains an unsupported value.');
}

const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
const now = new Date().toISOString();
const providerDocument = {
  integration_mode: 'external_link',
  licensing_approved: true,
  external_link_approved: true,
  status: 'active',
  license_starts_at: licenseStartsAt.toISOString(),
  license_ends_at: licenseEndsAt.toISOString(),
  licensed_seat_count: licensedSeatCount,
  permitted_link_types: [...new Set(permittedLinkTypes)],
  agreement_reference: agreementReference.slice(0, 256),
  updated_by: actorUid,
  updated_at: now,
};

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

const providerName = `projects/${projectId}/databases/(default)/documents/licensed_content_providers/${provider}`;
const auditName = `projects/${projectId}/databases/(default)/documents/licensed_content_audit_log/${randomUUID().replaceAll('-', '')}`;
const response = await fetch(commitUrl, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    writes: [
      {
        update: { name: providerName, fields: fields(providerDocument) },
        updateMask: { fieldPaths: Object.keys(providerDocument) },
      },
      {
        update: {
          name: auditName,
          fields: fields({
            action: 'provider_license_configured',
            actor_uid: actorUid,
            content_id: null,
            metadata: {
              provider,
              license_starts_at: providerDocument.license_starts_at,
              license_ends_at: providerDocument.license_ends_at,
              licensed_seat_count: licensedSeatCount,
              permitted_link_types: providerDocument.permitted_link_types,
            },
            created_at: now,
          }),
        },
      },
    ],
  }),
});

if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
console.log(`Configured ${provider} external-link licensing through ${providerDocument.license_ends_at} in ${projectId}.`);
