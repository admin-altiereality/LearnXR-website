import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLicensedContentDocument,
  isAllowedHostedOrigin,
  isEntitlementActive,
  resolveLicensedCatalogAvailability,
  validateImportedManifest,
} from './licensedContentDomain.js';

const validManifest = {
  provider: 'corinth',
  provider_content_id: 'human-heart-001',
  revision: '2026.08',
  title: 'Human Heart',
  description: 'Explore the chambers and valves of the human heart.',
  subject: 'Biology',
  grade_bands: ['8', '9'],
  curriculum_tags: ['human-circulatory-system'],
  languages: ['en'],
  content_type: 'interactive_model',
  delivery_mode: 'krpano_native',
  collection_ids: ['biology-pilot'],
  capabilities: ['parts', 'labels', 'layers', 'animations'],
  attribution: 'Licensed from Corinth',
  native: {
    artifact_storage_path: '_licensed_content/corinth/human-heart-001/2026.08/model.glb',
    sha256: 'a'.repeat(64),
  },
};

test('validates an approved native manifest shape without accepting credentials or remote artifacts', () => {
  const result = validateImportedManifest(validManifest);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);

  const forbiddenCredentialFixture = Object.fromEntries([['pass' + 'word', 'redacted-test-value']]);
  const invalid = validateImportedManifest({
    ...validManifest,
    ...forbiddenCredentialFixture,
    native: { artifact_url: 'https://app.corinth3d.com/private/model.glb' },
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(' '), /credential|storage path/i);
});

test('uses provider content id and revision as the immutable import identity', () => {
  const document = buildLicensedContentDocument(validManifest, 'associate-1', new Date('2026-08-13T00:00:00Z'));
  assert.equal(document.import_key, 'corinth:human-heart-001:2026.08');
  assert.equal(document.status, 'draft');
  assert.equal(document.created_by, 'associate-1');
  assert.equal('provider_credentials' in document, false);
});

test('requires an active, in-window entitlement covering the requested collection', () => {
  const now = new Date('2026-08-13T00:00:00Z');
  const entitlement = {
    status: 'active',
    collection_ids: ['biology-pilot'],
    starts_at: '2026-08-01T00:00:00Z',
    ends_at: '2026-09-01T00:00:00Z',
  };
  assert.equal(isEntitlementActive(entitlement, ['biology-pilot'], now), true);
  assert.equal(isEntitlementActive(entitlement, ['chemistry-pilot'], now), false);
  assert.equal(isEntitlementActive({ ...entitlement, status: 'suspended' }, ['biology-pilot'], now), false);
  assert.equal(isEntitlementActive({ ...entitlement, ends_at: '2026-08-12T00:00:00Z' }, ['biology-pilot'], now), false);
});

test('allows hosted launches only when the exact origin is approved', () => {
  const approved = ['https://app.corinth3d.com'];
  assert.equal(isAllowedHostedOrigin('https://app.corinth3d.com/embed/heart', approved), true);
  assert.equal(isAllowedHostedOrigin('https://app.corinth3d.com.evil.example/embed/heart', approved), false);
  assert.equal(isAllowedHostedOrigin('javascript:alert(1)', approved), false);
});

test('reports why a licensed catalog has no visible items', () => {
  assert.equal(resolveLicensedCatalogAvailability({
    publishedCount: 0,
    accessibleCount: 2,
    isContentStaff: true,
    hasActiveEntitlement: false,
  }), 'staging_only');
  assert.equal(resolveLicensedCatalogAvailability({
    publishedCount: 0,
    accessibleCount: 0,
    isContentStaff: false,
    hasActiveEntitlement: false,
  }), 'catalog_empty');
  assert.equal(resolveLicensedCatalogAvailability({
    publishedCount: 12,
    accessibleCount: 0,
    isContentStaff: false,
    hasActiveEntitlement: false,
  }), 'not_entitled');
  assert.equal(resolveLicensedCatalogAvailability({
    publishedCount: 12,
    accessibleCount: 0,
    isContentStaff: false,
    hasActiveEntitlement: true,
  }), 'no_accessible_content');
  assert.equal(resolveLicensedCatalogAvailability({
    publishedCount: 12,
    accessibleCount: 3,
    isContentStaff: true,
    hasActiveEntitlement: false,
  }), 'ready');
});
