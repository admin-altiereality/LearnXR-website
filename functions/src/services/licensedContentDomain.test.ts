import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLicensedContentDocument,
  canSetMappingReviewStatus,
  canUpdateExistingMapping,
  isAllowedHostedOrigin,
  isEntitlementActive,
  resolveExternalLinkLaunch,
  resolveLicensedCatalogAvailability,
  resolveProviderLicenseStatus,
  validateLessonContentMapping,
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

test('accepts a permanent provider content link and rejects tokenized links', () => {
  const hostedManifest = {
    ...validManifest,
    delivery_mode: 'hosted_embed',
    native: undefined,
    hosted: {
      approved_origins: ['https://app.corinth3d.com'],
      embed_approved: false,
      sso_enabled: false,
      content_url: 'https://app.corinth3d.com/content/p-clov-rez-zaludek',
    },
  };
  const accepted = validateImportedManifest(hostedManifest);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value?.hosted?.content_url, hostedManifest.hosted.content_url);

  const rejected = validateImportedManifest({
    ...hostedManifest,
    hosted: {
      ...hostedManifest.hosted,
      content_url: `${hostedManifest.hosted.content_url}?access_token=sensitive`,
    },
  });
  assert.equal(rejected.ok, false);
  assert.match(rejected.errors.join(' '), /token|query/i);
});

test('validates link-only Corinth content without treating it as an embed', () => {
  const externalManifest = {
    ...validManifest,
    delivery_mode: 'external_link',
    native: undefined,
    external_link: {
      approved_origins: ['https://app.corinth3d.com'],
      launch_url: 'https://app.corinth3d.com/content/p-clov-rez-zaludek',
      link_type: 'permanent',
      last_verified_at: '2026-08-13T00:00:00.000Z',
    },
  };
  const accepted = validateImportedManifest(externalManifest);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value?.delivery_mode, 'external_link');
  assert.equal(accepted.value?.external_link?.link_type, 'permanent');
  assert.equal(accepted.value?.external_link?.launch_url, externalManifest.external_link.launch_url);

  const tokenized = validateImportedManifest({
    ...externalManifest,
    external_link: {
      ...externalManifest.external_link,
      launch_url: `${externalManifest.external_link.launch_url}?token=do-not-store`,
    },
  });
  assert.equal(tokenized.ok, false);
  assert.match(tokenized.errors.join(' '), /query|token/i);
});

test('requires temporary provider links to declare their own expiry', () => {
  const result = validateImportedManifest({
    ...validManifest,
    delivery_mode: 'external_link',
    native: undefined,
    external_link: {
      approved_origins: ['https://app.corinth3d.com'],
      launch_url: 'https://app.corinth3d.com/content/temporary-scene',
      link_type: 'temporary',
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /expiry/i);
});

test('allows external launches only inside the provider and link license windows', () => {
  const content = {
    delivery_mode: 'external_link',
    external_link: {
      approved_origins: ['https://app.corinth3d.com'],
      launch_url: 'https://app.corinth3d.com/content/human-heart',
      link_type: 'student_access',
      link_expires_at: '2026-09-01T00:00:00.000Z',
    },
  };
  const provider = {
    licensing_approved: true,
    external_link_approved: true,
    status: 'active',
    license_starts_at: '2026-08-01T00:00:00.000Z',
    license_ends_at: '2027-02-01T00:00:00.000Z',
    permitted_link_types: ['student_access'],
  };

  assert.deepEqual(
    resolveExternalLinkLaunch(content, provider, new Date('2026-08-13T00:00:00.000Z')),
    { allowed: true, code: 'ready', launchUrl: content.external_link.launch_url },
  );
  assert.equal(
    resolveExternalLinkLaunch(content, { ...provider, status: 'expiring' }, new Date('2026-08-13T00:00:00.000Z')).code,
    'ready',
  );
  assert.equal(
    resolveExternalLinkLaunch(content, provider, new Date('2026-10-01T00:00:00.000Z')).code,
    'link_expired',
  );
  assert.equal(
    resolveExternalLinkLaunch(content, { ...provider, license_ends_at: '2026-08-12T00:00:00.000Z' }, new Date('2026-08-13T00:00:00.000Z')).code,
    'license_expired',
  );
  assert.equal(
    resolveExternalLinkLaunch(content, { ...provider, permitted_link_types: ['permanent'] }, new Date('2026-08-13T00:00:00.000Z')).code,
    'link_type_not_permitted',
  );
  assert.equal(
    resolveExternalLinkLaunch(content, { ...provider, status: 'expired' }, new Date('2026-08-13T00:00:00.000Z')).code,
    'provider_inactive',
  );
});

test('derives active, expiring, and expired provider license states', () => {
  const provider = {
    licensing_approved: true,
    license_starts_at: '2026-08-01T00:00:00.000Z',
    license_ends_at: '2027-02-01T00:00:00.000Z',
  };
  assert.equal(resolveProviderLicenseStatus(provider, new Date('2026-12-01T00:00:00.000Z')), 'active');
  assert.equal(resolveProviderLicenseStatus(provider, new Date('2027-01-15T00:00:00.000Z')), 'expiring');
  assert.equal(resolveProviderLicenseStatus(provider, new Date('2027-02-01T00:00:00.000Z')), 'expired');
  assert.equal(resolveProviderLicenseStatus({ ...provider, licensing_approved: false }, new Date('2026-12-01T00:00:00.000Z')), 'expired');
});

test('validates evidence-backed curriculum mappings before review', () => {
  const result = validateLessonContentMapping({
    licensed_content_id: 'a'.repeat(40),
    chapter_id: 'cbse-8-science-8',
    topic_id: 'cell-structure-and-functions',
    class_id: '8',
    subject_id: 'science',
    curriculum: 'CBSE',
    phase: 'learn',
    priority: 20,
    curriculum_objective_ids: ['NCERT-SCI-8-8.2'],
    mapping_score: 86,
    score_breakdown: { semantic: 30, grade_fit: 20, learning_objective: 25, scientific_quality: 11 },
    scientific_sources: [{ title: 'NCERT Class 8 Science', publisher: 'NCERT', url: 'https://ncert.nic.in/textbook.php' }],
    review_status: 'academic_review',
  });
  assert.equal(result.ok, true);
  assert.equal(result.value?.review_status, 'academic_review');
  assert.equal(result.value?.mapping_score, 86);
});

test('rejects untrusted mapping sources and restricts final review states to admins', () => {
  const invalid = validateLessonContentMapping({
    licensed_content_id: 'a'.repeat(40),
    chapter_id: 'chapter',
    topic_id: 'topic',
    class_id: '8',
    subject_id: 'science',
    curriculum: 'CBSE',
    scientific_sources: [{ title: 'Local note', publisher: 'Unknown', url: 'http://example.com/note' }],
    review_status: 'approved',
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(' '), /HTTPS|evidence/i);
  assert.equal(canSetMappingReviewStatus('associate', 'approved'), false);
  assert.equal(canSetMappingReviewStatus('associate', 'academic_review'), true);
  assert.equal(canSetMappingReviewStatus('admin', 'approved'), true);
  assert.equal(canUpdateExistingMapping('associate', 'approved'), false);
  assert.equal(canUpdateExistingMapping('admin', 'approved'), true);
  assert.equal(canUpdateExistingMapping('associate', 'academic_review'), true);
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
