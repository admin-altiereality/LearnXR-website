export const LICENSED_DELIVERY_MODES = ['krpano_native', 'hosted_embed'] as const;
export type LicensedDeliveryMode = (typeof LICENSED_DELIVERY_MODES)[number];

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
  xr_supported?: boolean;
  sdk_post_message?: boolean;
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
  | 'catalog_empty'
  | 'not_entitled'
  | 'no_accessible_content';

export function resolveLicensedCatalogAvailability(input: {
  publishedCount: number;
  accessibleCount: number;
  isContentStaff: boolean;
  hasActiveEntitlement: boolean;
}): LicensedCatalogAvailability {
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
    if (approvedOrigins.length === 0) errors.push('Hosted content requires at least one valid HTTPS approved origin.');
    hosted = {
      approved_origins: approvedOrigins,
      embed_approved: source.embed_approved === true,
      sso_enabled: source.sso_enabled === true,
      xr_supported: source.xr_supported === true,
      sdk_post_message: source.sdk_post_message === true,
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
