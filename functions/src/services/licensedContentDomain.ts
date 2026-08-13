export const LICENSED_DELIVERY_MODES = ['krpano_native', 'hosted_embed', 'external_link'] as const;
export type LicensedDeliveryMode = (typeof LICENSED_DELIVERY_MODES)[number];

export const LICENSED_LINK_TYPES = ['permanent', 'student_access', 'temporary'] as const;
export type LicensedLinkType = (typeof LICENSED_LINK_TYPES)[number];

export const LICENSED_CONTENT_STATUSES = ['draft', 'review', 'published', 'suspended', 'retired'] as const;
export type LicensedContentStatus = (typeof LICENSED_CONTENT_STATUSES)[number];

export interface LicensedNativeSource {
  artifact_storage_path: string;
  sha256: string;
  environment_storage_path?: string;
  interaction_manifest?: Record<string, unknown>;
}

export interface LicensedHostedSource {
  approved_origins: string[];
  embed_approved: boolean;
  sso_enabled: boolean;
  content_url?: string;
  xr_supported?: boolean;
  sdk_post_message?: boolean;
}

export interface LicensedExternalLinkSource {
  approved_origins: string[];
  launch_url: string;
  link_type: LicensedLinkType;
  link_expires_at?: string;
  last_verified_at?: string;
}

export interface LicensedContentImport {
  provider: string;
  provider_content_id: string;
  revision: string;
  title: string;
  description: string;
  subject: string;
  grade_bands: string[];
  curriculum_tags: string[];
  languages: string[];
  thumbnail_storage_path?: string;
  content_type: string;
  delivery_mode: LicensedDeliveryMode;
  collection_ids: string[];
  capabilities: string[];
  attribution: string;
  native?: LicensedNativeSource;
  hosted?: LicensedHostedSource;
  external_link?: LicensedExternalLinkSource;
}

export type ExternalLinkLaunchCode =
  | 'ready'
  | 'not_external_link'
  | 'provider_not_approved'
  | 'provider_inactive'
  | 'license_not_started'
  | 'license_expired'
  | 'link_type_not_permitted'
  | 'link_expired'
  | 'invalid_link';

export interface ExternalLinkLaunchResult {
  allowed: boolean;
  code: ExternalLinkLaunchCode;
  launchUrl?: string;
}

export type ProviderLicenseStatus = 'active' | 'expiring' | 'expired';

export const MAPPING_REVIEW_STATUSES = ['suggested', 'academic_review', 'scientific_review', 'approved', 'rejected'] as const;
export type MappingReviewStatus = (typeof MAPPING_REVIEW_STATUSES)[number];

export interface ScientificSource {
  title: string;
  publisher: string;
  url: string;
}

export interface LessonContentMapping {
  licensed_content_id: string;
  chapter_id: string;
  topic_id: string;
  class_id: string;
  subject_id: string;
  curriculum: string;
  phase: string;
  priority: number;
  curriculum_objective_ids: string[];
  mapping_score: number;
  score_breakdown: Record<string, number>;
  scientific_sources: ScientificSource[];
  review_status: MappingReviewStatus;
  teaching_notes: string;
  placement: Record<string, unknown> | null;
}

export interface LessonContentMappingValidation {
  ok: boolean;
  errors: string[];
  value?: LessonContentMapping;
}

export interface ContentEntitlementLike {
  status?: unknown;
  collection_ids?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
}

export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
  value?: LicensedContentImport;
}

export type LicensedCatalogAvailability =
  | 'ready'
  | 'staging_only'
  | 'catalog_empty'
  | 'not_entitled'
  | 'no_accessible_content';

export function resolveLicensedCatalogAvailability(input: {
  publishedCount: number;
  accessibleCount: number;
  isContentStaff: boolean;
  hasActiveEntitlement: boolean;
}): LicensedCatalogAvailability {
  if (input.isContentStaff && input.publishedCount === 0 && input.accessibleCount > 0) {
    return 'staging_only';
  }
  if (input.publishedCount === 0) return 'catalog_empty';
  if (!input.isContentStaff && !input.hasActiveEntitlement) return 'not_entitled';
  if (input.accessibleCount === 0) return 'no_accessible_content';
  return 'ready';
}

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const PRIVATE_ARTIFACT_PREFIX = '_licensed_content/';
const FORBIDDEN_KEYS = new Set([
  'credential',
  'credentials',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'secret',
  'username',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(stringValue).filter(Boolean))];
}

function findForbiddenKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenKey(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return key;
    const found = findForbiddenKey(nested);
    if (found) return found;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isRecord(value) && typeof value.toDate === 'function') {
    const result = value.toDate();
    return result instanceof Date && !Number.isNaN(result.getTime()) ? result : null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function validateImportedManifest(input: unknown): ManifestValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['Manifest must be a JSON object.'] };

  const forbiddenKey = findForbiddenKey(input);
  if (forbiddenKey) errors.push(`Provider credentials are forbidden in manifests (${forbiddenKey}).`);

  const provider = stringValue(input.provider).toLowerCase();
  const providerContentId = stringValue(input.provider_content_id);
  const revision = stringValue(input.revision);
  const title = stringValue(input.title);
  const description = stringValue(input.description);
  const subject = stringValue(input.subject);
  const contentType = stringValue(input.content_type);
  const attribution = stringValue(input.attribution);
  const deliveryMode = stringValue(input.delivery_mode) as LicensedDeliveryMode;
  const gradeBands = stringList(input.grade_bands);
  const curriculumTags = stringList(input.curriculum_tags);
  const languages = stringList(input.languages);
  const collectionIds = stringList(input.collection_ids);
  const capabilities = stringList(input.capabilities);

  if (!SAFE_ID.test(provider)) errors.push('provider must be a safe identifier.');
  if (!SAFE_ID.test(providerContentId)) errors.push('provider_content_id must be a safe identifier.');
  if (!SAFE_ID.test(revision)) errors.push('revision must be a safe identifier.');
  if (!title || title.length > 180) errors.push('title is required and must be at most 180 characters.');
  if (!description || description.length > 3000) errors.push('description is required and must be at most 3000 characters.');
  if (!subject || subject.length > 100) errors.push('subject is required and must be at most 100 characters.');
  if (!contentType || contentType.length > 80) errors.push('content_type is required and must be at most 80 characters.');
  if (!attribution || attribution.length > 500) errors.push('attribution is required and must be at most 500 characters.');
  if (!LICENSED_DELIVERY_MODES.includes(deliveryMode)) errors.push('delivery_mode is not supported.');
  if (gradeBands.length === 0) errors.push('grade_bands must contain at least one value.');
  if (languages.length === 0) errors.push('languages must contain at least one value.');
  if (collectionIds.length === 0) errors.push('collection_ids must contain at least one value.');

  let native: LicensedNativeSource | undefined;
  if (deliveryMode === 'krpano_native') {
    const source = isRecord(input.native) ? input.native : {};
    const artifactStoragePath = stringValue(source.artifact_storage_path);
    const environmentStoragePath = stringValue(source.environment_storage_path);
    const sha256 = stringValue(source.sha256);
    if (!artifactStoragePath.startsWith(PRIVATE_ARTIFACT_PREFIX) || !artifactStoragePath.toLowerCase().endsWith('.glb')) {
      errors.push(`Native content requires a private GLB storage path under ${PRIVATE_ARTIFACT_PREFIX}.`);
    }
    if (!SHA256.test(sha256)) errors.push('Native content requires a valid sha256 hash.');
    if ('artifact_url' in source) errors.push('Remote artifact URLs are not accepted; use an approved private storage path.');
    if ('environment_url' in source) errors.push('Remote environment URLs are not accepted; use an approved private storage path.');
    if (environmentStoragePath && !environmentStoragePath.startsWith(PRIVATE_ARTIFACT_PREFIX)) {
      errors.push(`Native environments must use a private storage path under ${PRIVATE_ARTIFACT_PREFIX}.`);
    }
    native = {
      artifact_storage_path: artifactStoragePath,
      sha256,
      ...(environmentStoragePath ? { environment_storage_path: environmentStoragePath } : {}),
      ...(isRecord(source.interaction_manifest) ? { interaction_manifest: source.interaction_manifest } : {}),
    };
  }

  let hosted: LicensedHostedSource | undefined;
  if (deliveryMode === 'hosted_embed') {
    const source = isRecord(input.hosted) ? input.hosted : {};
    const approvedOrigins = stringList(source.approved_origins).filter((origin) => isAllowedHostedOrigin(origin, [origin]));
    const contentUrl = stringValue(source.content_url);
    if (approvedOrigins.length === 0) errors.push('Hosted content requires at least one valid HTTPS approved origin.');
    if (contentUrl) {
      if (!isAllowedHostedOrigin(contentUrl, approvedOrigins)) {
        errors.push('Hosted content_url must use an approved HTTPS origin.');
      } else {
        const parsedContentUrl = new URL(contentUrl);
        if (parsedContentUrl.search || parsedContentUrl.hash) {
          errors.push('Hosted content_url cannot contain query parameters, access tokens, or fragments.');
        }
      }
    }
    hosted = {
      approved_origins: approvedOrigins,
      embed_approved: source.embed_approved === true,
      sso_enabled: source.sso_enabled === true,
      ...(contentUrl ? { content_url: contentUrl } : {}),
      xr_supported: source.xr_supported === true,
      sdk_post_message: source.sdk_post_message === true,
    };
  }

  let externalLink: LicensedExternalLinkSource | undefined;
  if (deliveryMode === 'external_link') {
    const source = isRecord(input.external_link) ? input.external_link : {};
    const approvedOrigins = stringList(source.approved_origins).filter((origin) => isAllowedHostedOrigin(origin, [origin]));
    const launchUrl = stringValue(source.launch_url);
    const linkType = stringValue(source.link_type) as LicensedLinkType;
    const linkExpiresAt = stringValue(source.link_expires_at);
    const lastVerifiedAt = stringValue(source.last_verified_at);
    if (approvedOrigins.length === 0) errors.push('External links require at least one valid HTTPS approved origin.');
    if (!LICENSED_LINK_TYPES.includes(linkType)) errors.push('External link_type is not supported.');
    if (!launchUrl || !isAllowedHostedOrigin(launchUrl, approvedOrigins)) {
      errors.push('External launch_url must use an approved HTTPS origin.');
    } else {
      const parsedLaunchUrl = new URL(launchUrl);
      if (parsedLaunchUrl.search || parsedLaunchUrl.hash) {
        errors.push('External launch_url cannot contain query parameters, access tokens, or fragments.');
      }
    }
    if (linkType === 'temporary' && !linkExpiresAt) errors.push('Temporary external links require an expiry.');
    if (linkExpiresAt && !parseDate(linkExpiresAt)) errors.push('External link expiry must be a valid date.');
    if (lastVerifiedAt && !parseDate(lastVerifiedAt)) errors.push('External link verification date must be valid.');
    externalLink = {
      approved_origins: approvedOrigins,
      launch_url: launchUrl,
      link_type: linkType,
      ...(linkExpiresAt ? { link_expires_at: new Date(linkExpiresAt).toISOString() } : {}),
      ...(lastVerifiedAt ? { last_verified_at: new Date(lastVerifiedAt).toISOString() } : {}),
    };
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    value: {
      provider,
      provider_content_id: providerContentId,
      revision,
      title,
      description,
      subject,
      grade_bands: gradeBands,
      curriculum_tags: curriculumTags,
      languages,
      ...(stringValue(input.thumbnail_storage_path)
        ? { thumbnail_storage_path: stringValue(input.thumbnail_storage_path) }
        : {}),
      content_type: contentType,
      delivery_mode: deliveryMode,
      collection_ids: collectionIds,
      capabilities,
      attribution,
      ...(native ? { native } : {}),
      ...(hosted ? { hosted } : {}),
      ...(externalLink ? { external_link: externalLink } : {}),
    },
  };
}

export function resolveExternalLinkLaunch(
  content: Record<string, unknown>,
  provider: Record<string, unknown>,
  now = new Date(),
): ExternalLinkLaunchResult {
  if (content.delivery_mode !== 'external_link') return { allowed: false, code: 'not_external_link' };
  if (provider.licensing_approved !== true || provider.external_link_approved !== true) {
    return { allowed: false, code: 'provider_not_approved' };
  }
  if (!['active', 'expiring'].includes(String(provider.status))) {
    return { allowed: false, code: 'provider_inactive' };
  }
  const licenseStartsAt = parseDate(provider.license_starts_at);
  const licenseEndsAt = parseDate(provider.license_ends_at);
  if (!licenseEndsAt) return { allowed: false, code: 'provider_not_approved' };
  if (licenseStartsAt && licenseStartsAt.getTime() > now.getTime()) {
    return { allowed: false, code: 'license_not_started' };
  }
  if (licenseEndsAt.getTime() <= now.getTime()) return { allowed: false, code: 'license_expired' };

  const source = isRecord(content.external_link) ? content.external_link : {};
  const approvedOrigins = stringList(source.approved_origins);
  const launchUrl = stringValue(source.launch_url);
  const linkType = stringValue(source.link_type);
  const permittedLinkTypes = stringList(provider.permitted_link_types);
  if (!permittedLinkTypes.includes(linkType)) return { allowed: false, code: 'link_type_not_permitted' };
  const linkExpiresAt = parseDate(source.link_expires_at);
  if (linkExpiresAt && linkExpiresAt.getTime() <= now.getTime()) return { allowed: false, code: 'link_expired' };
  if (!launchUrl || !isAllowedHostedOrigin(launchUrl, approvedOrigins)) {
    return { allowed: false, code: 'invalid_link' };
  }
  const parsedLaunchUrl = new URL(launchUrl);
  if (parsedLaunchUrl.search || parsedLaunchUrl.hash) return { allowed: false, code: 'invalid_link' };
  return { allowed: true, code: 'ready', launchUrl: parsedLaunchUrl.toString() };
}

export function resolveProviderLicenseStatus(
  provider: Record<string, unknown>,
  now = new Date(),
): ProviderLicenseStatus {
  if (provider.licensing_approved !== true) return 'expired';
  const licenseEndsAt = parseDate(provider.license_ends_at);
  if (!licenseEndsAt || licenseEndsAt.getTime() <= now.getTime()) return 'expired';
  const warningWindowMs = 30 * 24 * 60 * 60 * 1000;
  return licenseEndsAt.getTime() - now.getTime() <= warningWindowMs ? 'expiring' : 'active';
}

export function canSetMappingReviewStatus(role: unknown, status: unknown): boolean {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedStatus = String(status || '').trim() as MappingReviewStatus;
  if (!MAPPING_REVIEW_STATUSES.includes(normalizedStatus)) return false;
  if (['admin', 'superadmin'].includes(normalizedRole)) return true;
  return normalizedRole === 'associate' && ['suggested', 'academic_review'].includes(normalizedStatus);
}

export function canUpdateExistingMapping(role: unknown, existingStatus: unknown): boolean {
  if (String(existingStatus || '') !== 'approved') return true;
  return ['admin', 'superadmin'].includes(String(role || '').trim().toLowerCase());
}

export function validateLessonContentMapping(input: unknown): LessonContentMappingValidation {
  const source = isRecord(input) ? input : {};
  const errors: string[] = [];
  const licensedContentId = stringValue(source.licensed_content_id);
  const chapterId = stringValue(source.chapter_id);
  const topicId = stringValue(source.topic_id);
  const classId = stringValue(source.class_id);
  const subjectId = stringValue(source.subject_id);
  const curriculum = stringValue(source.curriculum);
  const phase = stringValue(source.phase) || 'learn';
  const priority = Number(source.priority ?? 0);
  const objectives = stringList(source.curriculum_objective_ids);
  const mappingScore = Number(source.mapping_score ?? 0);
  const reviewStatus = (stringValue(source.review_status) || 'suggested') as MappingReviewStatus;
  const teachingNotes = stringValue(source.teaching_notes).slice(0, 2000);
  const placement = isRecord(source.placement) ? source.placement : null;

  if (!/^[a-f0-9]{40}$/.test(licensedContentId)) errors.push('A valid licensed_content_id is required.');
  if (!chapterId || chapterId.length > 256) errors.push('A valid chapter_id is required.');
  if (!topicId || topicId.length > 256) errors.push('A valid topic_id is required.');
  if (!classId || classId.length > 128) errors.push('A valid class_id is required.');
  if (!subjectId || subjectId.length > 128) errors.push('A valid subject_id is required.');
  if (!curriculum || curriculum.length > 128) errors.push('A valid curriculum is required.');
  if (!['intro', 'learn', 'summary', 'quiz', 'replay'].includes(phase)) errors.push('Lesson phase is not supported.');
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) errors.push('Priority must be an integer from 0 to 100.');
  if (!Number.isFinite(mappingScore) || mappingScore < 0 || mappingScore > 100) errors.push('Mapping score must be from 0 to 100.');
  if (!MAPPING_REVIEW_STATUSES.includes(reviewStatus)) errors.push('Mapping review status is not supported.');
  if (objectives.length > 20 || objectives.some((value) => value.length > 160)) errors.push('Curriculum objective IDs are invalid.');

  const scoreBreakdownSource = isRecord(source.score_breakdown) ? source.score_breakdown : {};
  const scoreBreakdown = Object.fromEntries(Object.entries(scoreBreakdownSource).map(([key, value]) => [key, Number(value)]));
  if (Object.keys(scoreBreakdown).length > 10 || Object.values(scoreBreakdown).some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    errors.push('Mapping score breakdown is invalid.');
  }

  const scientificSources = Array.isArray(source.scientific_sources)
    ? source.scientific_sources.slice(0, 10).map((item) => {
      const record = isRecord(item) ? item : {};
      return {
        title: stringValue(record.title).slice(0, 200),
        publisher: stringValue(record.publisher).slice(0, 160),
        url: stringValue(record.url).slice(0, 1000),
      };
    })
    : [];
  const invalidEvidence = scientificSources.some((item) => {
    if (!item.title || !item.publisher || !item.url) return true;
    try {
      return new URL(item.url).protocol !== 'https:';
    } catch {
      return true;
    }
  });
  if (invalidEvidence) errors.push('Scientific evidence sources must be complete HTTPS references.');
  if (reviewStatus !== 'suggested' && (objectives.length === 0 || scientificSources.length === 0 || Object.keys(scoreBreakdown).length === 0)) {
    errors.push('Reviewed mappings require curriculum objectives, scientific evidence, and a score breakdown.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      licensed_content_id: licensedContentId,
      chapter_id: chapterId,
      topic_id: topicId,
      class_id: classId,
      subject_id: subjectId,
      curriculum,
      phase,
      priority,
      curriculum_objective_ids: objectives,
      mapping_score: mappingScore,
      score_breakdown: scoreBreakdown,
      scientific_sources: scientificSources,
      review_status: reviewStatus,
      teaching_notes: teachingNotes,
      placement,
    },
  };
}

export function buildLicensedContentDocument(input: unknown, actorUid: string, now = new Date()) {
  const validation = validateImportedManifest(input);
  if (!validation.ok || !validation.value) {
    throw new Error(validation.errors.join(' '));
  }
  const value = validation.value;
  return {
    ...value,
    import_key: `${value.provider}:${value.provider_content_id}:${value.revision}`,
    status: 'draft' as LicensedContentStatus,
    created_by: actorUid,
    updated_by: actorUid,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function isEntitlementActive(
  entitlement: ContentEntitlementLike,
  contentCollections: string[],
  now = new Date(),
): boolean {
  if (entitlement.status !== 'active') return false;
  const startsAt = parseDate(entitlement.starts_at);
  const endsAt = parseDate(entitlement.ends_at);
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() < now.getTime()) return false;
  const entitledCollections = stringList(entitlement.collection_ids);
  return entitledCollections.includes('*') || contentCollections.some((collection) => entitledCollections.includes(collection));
}

export function isAllowedHostedOrigin(url: string, approvedOrigins: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return approvedOrigins.some((candidate) => {
      try {
        return new URL(candidate).origin === parsed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
