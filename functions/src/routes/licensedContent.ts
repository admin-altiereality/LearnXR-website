import { createHash } from 'node:crypto';
import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getUserProfile, normalizeUserRole, UserProfile } from '../middleware/rbac.js';
import {
  buildLicensedContentDocument,
  canSetMappingReviewStatus,
  canUpdateExistingMapping,
  isAllowedHostedOrigin,
  isEntitlementActive,
  LICENSED_LINK_TYPES,
  LessonContentMapping,
  LessonContentMappingValidation,
  LicensedContentImport,
  resolveExternalLinkLaunch,
  resolveLicensedCatalogAvailability,
  validateImportedManifest,
  validateLessonContentMapping,
} from '../services/licensedContentDomain.js';

const router = express.Router();
const db = () => admin.firestore();
const MAX_CATALOG_ITEMS = 250;
const MAX_BATCH_IMPORT_ITEMS = 100;
const SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const SAFE_DOCUMENT_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

interface AccessTarget {
  type: 'school' | 'partner';
  id: string;
}

interface EntitlementRecord {
  provider?: unknown;
  target_type?: unknown;
  target_id?: unknown;
  status?: unknown;
  collection_ids?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
}

function fail(res: Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({ success: false, error: message, ...(details ? { details } : {}) });
}

function success(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

function isContentStaff(profile: UserProfile): boolean {
  return profile.role === 'associate' || profile.role === 'admin' || profile.role === 'superadmin';
}

function isContentAdmin(profile: UserProfile): boolean {
  return profile.role === 'admin' || profile.role === 'superadmin';
}

function resolveAccessTarget(profile: UserProfile): AccessTarget | null {
  if (profile.role === 'partner' && typeof profile.partner_id === 'string' && profile.partner_id) {
    return { type: 'partner', id: profile.partner_id };
  }
  const schoolId = profile.role === 'principal' ? profile.managed_school_id : profile.school_id;
  return typeof schoolId === 'string' && schoolId ? { type: 'school', id: schoolId } : null;
}

async function requireProfile(req: Request, res: Response): Promise<UserProfile | null> {
  const uid = req.user?.uid;
  if (!uid) {
    fail(res, 401, 'Authentication required.');
    return null;
  }
  const profile = await getUserProfile(uid);
  if (!profile) {
    fail(res, 403, 'User profile is unavailable.');
    return null;
  }
  return { ...profile, role: normalizeUserRole(profile.role) };
}

async function getEntitlements(profile: UserProfile): Promise<EntitlementRecord[]> {
  if (isContentStaff(profile)) return [];
  const target = resolveAccessTarget(profile);
  if (!target) return [];
  const snapshot = await db()
    .collection('content_entitlements')
    .where('target_id', '==', target.id)
    .limit(100)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as EntitlementRecord)
    .filter((item) => item.target_type === target.type);
}

function canAccessContent(
  profile: UserProfile,
  entitlements: EntitlementRecord[],
  content: Record<string, unknown>,
): boolean {
  if (isContentStaff(profile)) return true;
  const provider = typeof content.provider === 'string' ? content.provider : '';
  const collections = Array.isArray(content.collection_ids)
    ? content.collection_ids.filter((value): value is string => typeof value === 'string')
    : [];
  return entitlements.some(
    (entitlement) => entitlement.provider === provider && isEntitlementActive(entitlement, collections),
  );
}

function contentDocumentId(manifest: LicensedContentImport): string {
  return createHash('sha256')
    .update(`${manifest.provider}:${manifest.provider_content_id}:${manifest.revision}`)
    .digest('hex')
    .slice(0, 40);
}

function getProviderPreviewUrl(content: Record<string, unknown>): string | null {
  const hosted = typeof content.hosted === 'object' && content.hosted
    ? content.hosted as Record<string, unknown>
    : null;
  const contentUrl = typeof hosted?.content_url === 'string' ? hosted.content_url : '';
  const approvedOrigins = Array.isArray(hosted?.approved_origins)
    ? hosted.approved_origins.filter((value): value is string => typeof value === 'string')
    : [];
  if (!contentUrl || !isAllowedHostedOrigin(contentUrl, approvedOrigins)) return null;
  const parsed = new URL(contentUrl);
  return parsed.search || parsed.hash ? null : parsed.toString();
}

function sanitizeSummary(id: string, content: Record<string, unknown>, includeStaffFields = false) {
  const external = typeof content.external_link === 'object' && content.external_link
    ? content.external_link as Record<string, unknown>
    : null;
  const summary = {
    id,
    provider: content.provider,
    provider_content_id: content.provider_content_id,
    revision: content.revision,
    title: content.title,
    description: content.description,
    subject: content.subject,
    grade_bands: content.grade_bands,
    curriculum_tags: content.curriculum_tags,
    languages: content.languages,
    content_type: content.content_type,
    delivery_mode: content.delivery_mode,
    collection_ids: content.collection_ids,
    capabilities: content.capabilities,
    attribution: content.attribution,
    status: content.status,
    ...(external ? {
      external_link: {
        link_type: external.link_type,
        link_expires_at: external.link_expires_at || null,
        last_verified_at: external.last_verified_at || null,
      },
    } : {}),
  };
  const providerPreviewUrl = includeStaffFields ? getProviderPreviewUrl(content) : null;
  return {
    ...summary,
    ...(providerPreviewUrl ? { provider_preview_url: providerPreviewUrl } : {}),
  };
}

async function validateNativeArtifactForPublication(content: Record<string, unknown>): Promise<string | null> {
  const native = typeof content.native === 'object' && content.native
    ? content.native as Record<string, unknown>
    : null;
  const path = typeof native?.artifact_storage_path === 'string' ? native.artifact_storage_path : '';
  const expectedHash = typeof native?.sha256 === 'string' ? native.sha256.toLowerCase() : '';
  if (!path.startsWith('_licensed_content/') || !expectedHash) return 'Native artifact metadata is incomplete.';
  const file = admin.storage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return 'The private native artifact does not exist in Storage.';
  const [metadata] = await file.getMetadata();
  const storedHash = String(metadata.metadata?.sha256 || metadata.md5Hash || '').toLowerCase();
  if (storedHash !== expectedHash) return 'The native artifact hash does not match the approved manifest.';
  return null;
}

async function signStoragePath(path: unknown): Promise<string | null> {
  if (typeof path !== 'string' || !path.startsWith('_licensed_content/')) return null;
  const [url] = await admin.storage().bucket().file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });
  return url;
}

async function appendAudit(
  action: string,
  actorUid: string,
  contentId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db().collection('licensed_content_audit_log').add({
    action,
    actor_uid: actorUid,
    content_id: contentId,
    metadata,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function loadAccessibleContent(
  req: Request,
  res: Response,
): Promise<{ profile: UserProfile; id: string; content: Record<string, unknown> } | null> {
  const profile = await requireProfile(req, res);
  if (!profile) return null;
  const id = String(req.params.id || '').trim();
  if (!/^[a-f0-9]{40}$/.test(id)) {
    fail(res, 400, 'Invalid content ID.');
    return null;
  }
  const snapshot = await db().collection('licensed_content').doc(id).get();
  if (!snapshot.exists) {
    fail(res, 404, 'Content not found.');
    return null;
  }
  const content = snapshot.data() as Record<string, unknown>;
  if (!isContentStaff(profile) && content.status !== 'published') {
    fail(res, 404, 'Content not found.');
    return null;
  }
  const entitlements = await getEntitlements(profile);
  if (!canAccessContent(profile, entitlements, content)) {
    fail(res, 403, 'Your school or partner account is not entitled to this content.');
    return null;
  }
  return { profile, id, content };
}

router.get('/catalog', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    const includeDrafts = req.query.includeDrafts === 'true' && isContentStaff(profile);
    const snapshot = includeDrafts
      ? await db().collection('licensed_content').limit(MAX_CATALOG_ITEMS).get()
      : await db().collection('licensed_content').where('status', '==', 'published').limit(MAX_CATALOG_ITEMS).get();
    const entitlements = await getEntitlements(profile);
    const activeEntitlements = entitlements.filter((item) => {
      const collections = Array.isArray(item.collection_ids)
        ? item.collection_ids.filter((value): value is string => typeof value === 'string')
        : [];
      return isEntitlementActive(item, collections);
    });
    const search = String(req.query.search || '').trim().toLowerCase();
    const subject = String(req.query.subject || '').trim().toLowerCase();
    const grade = String(req.query.grade || '').trim().toLowerCase();
    const deliveryMode = String(req.query.deliveryMode || '').trim();

    const candidates = snapshot.docs
      .map((document) => ({ id: document.id, content: document.data() as Record<string, unknown> }))
      .filter(({ content }) => canAccessContent(profile, entitlements, content))
      .filter(({ content }) => !subject || String(content.subject || '').toLowerCase() === subject)
      .filter(({ content }) => !deliveryMode || content.delivery_mode === deliveryMode)
      .filter(({ content }) => {
        const grades = Array.isArray(content.grade_bands) ? content.grade_bands.map(String) : [];
        return !grade || grades.some((value) => value.toLowerCase() === grade);
      })
      .filter(({ content }) => {
        if (!search) return true;
        const haystack = [content.title, content.description, content.subject, ...(Array.isArray(content.curriculum_tags) ? content.curriculum_tags : [])]
          .map(String)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });

    const providerIds = [...new Set(candidates.map(({ content }) => String(content.provider || '')).filter(Boolean))];
    const providerSnapshots = providerIds.length > 0
      ? await db().getAll(...providerIds.map((providerId) => db().collection('licensed_content_providers').doc(providerId)))
      : [];
    const providers = new Map(providerSnapshots.map((providerSnapshot) => [providerSnapshot.id, providerSnapshot.data() || {}]));
    const availableCandidates = includeDrafts
      ? candidates
      : candidates.filter(({ content }) => content.delivery_mode !== 'external_link' || resolveExternalLinkLaunch(
        content,
        providers.get(String(content.provider || '')) || {},
      ).allowed);

    const items = await Promise.all(availableCandidates.map(async ({ id, content }) => ({
      ...sanitizeSummary(id, content, isContentStaff(profile)),
      thumbnail_url: await signStoragePath(content.thumbnail_storage_path),
    })));
    const publishedCount = includeDrafts
      ? snapshot.docs.filter((document) => document.data().status === 'published').length
      : snapshot.size;
    const draftCount = includeDrafts
      ? snapshot.docs.filter((document) => document.data().status === 'draft').length
      : 0;
    const reviewCount = includeDrafts
      ? snapshot.docs.filter((document) => document.data().status === 'review').length
      : 0;
    const entitled = isContentStaff(profile) || activeEntitlements.length > 0;
    success(res, {
      items,
      entitled,
      access_target: resolveAccessTarget(profile),
      catalog_state: {
        availability: resolveLicensedCatalogAvailability({
          publishedCount,
          accessibleCount: items.length,
          isContentStaff: isContentStaff(profile),
          hasActiveEntitlement: activeEntitlements.length > 0,
        }),
        published_count: publishedCount,
        accessible_count: items.length,
        total_count: snapshot.size,
        draft_count: draftCount,
        review_count: reviewCount,
      },
    });
  } catch (error) {
    console.error('Licensed catalog error:', error);
    fail(res, 500, 'Could not load the licensed content catalog.');
  }
});

router.get('/lesson-links', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    const chapterId = String(req.query.chapterId || '').trim();
    const topicId = String(req.query.topicId || '').trim();
    if (!chapterId || !topicId) {
      fail(res, 400, 'chapterId and topicId are required.');
      return;
    }
    const links = await db()
      .collection('lesson_content_links')
      .where('chapter_id', '==', chapterId)
      .where('topic_id', '==', topicId)
      .limit(50)
      .get();
    const entitlements = await getEntitlements(profile);
    const manifests = await Promise.all(links.docs.map(async (link) => {
      if (link.data().review_status && link.data().review_status !== 'approved') return null;
      const contentId = String(link.data().licensed_content_id || '');
      const contentSnapshot = await db().collection('licensed_content').doc(contentId).get();
      if (!contentSnapshot.exists) return null;
      const content = contentSnapshot.data() as Record<string, unknown>;
      if (content.status !== 'published' || !canAccessContent(profile, entitlements, content)) return null;
      if (content.delivery_mode === 'external_link') {
        const provider = await db().collection('licensed_content_providers').doc(String(content.provider || '')).get();
        if (!resolveExternalLinkLaunch(content, provider.data() || {}).allowed) return null;
      }
      const manifest = await createLaunchManifest(contentId, content);
      return { ...manifest, placement: link.data().placement, phase: link.data().phase, priority: link.data().priority };
    }));
    success(res, { items: manifests.filter(Boolean) });
  } catch (error) {
    console.error('Licensed lesson links error:', error);
    fail(res, 500, 'Could not resolve licensed lesson content.');
  }
});

async function createLaunchManifest(id: string, content: Record<string, unknown>, includeStaffFields = false) {
  const deliveryMode = content.delivery_mode;
  const native = typeof content.native === 'object' && content.native ? content.native as Record<string, unknown> : null;
  const hosted = typeof content.hosted === 'object' && content.hosted ? content.hosted as Record<string, unknown> : null;
  const summary = sanitizeSummary(id, content, includeStaffFields);
  if (deliveryMode === 'krpano_native' && native) {
    return {
      ...summary,
      artifact_url: await signStoragePath(native.artifact_storage_path),
      environment_url: await signStoragePath(native.environment_storage_path),
      interaction_manifest: native.interaction_manifest || null,
      expires_at: new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString(),
    };
  }
  return {
    ...summary,
    hosted: hosted ? {
      xr_supported: hosted.xr_supported === true,
      sdk_post_message: hosted.sdk_post_message === true,
    } : null,
  };
}

router.get('/:id/manifest', async (req, res) => {
  try {
    const loaded = await loadAccessibleContent(req, res);
    if (!loaded) return;
    success(res, await createLaunchManifest(loaded.id, loaded.content, isContentStaff(loaded.profile)));
  } catch (error) {
    console.error('Licensed manifest error:', error);
    fail(res, 500, 'Could not create a licensed content manifest.');
  }
});

router.post('/:id/embed-session', async (req, res) => {
  try {
    const loaded = await loadAccessibleContent(req, res);
    if (!loaded) return;
    if (loaded.content.delivery_mode !== 'hosted_embed') {
      fail(res, 409, 'This item uses native KRPano delivery.');
      return;
    }
    const hosted = typeof loaded.content.hosted === 'object' && loaded.content.hosted
      ? loaded.content.hosted as Record<string, unknown>
      : {};
    const approvedOrigins = Array.isArray(hosted.approved_origins)
      ? hosted.approved_origins.filter((value): value is string => typeof value === 'string')
      : [];
    const providerConfig = await db().collection('licensed_content_providers').doc(String(loaded.content.provider)).get();
    const config = providerConfig.data() || {};
    const launchUrl = typeof config.embed_launch_url === 'string' ? config.embed_launch_url : '';
    if (
      config.licensing_approved !== true ||
      config.embed_sso_approved !== true ||
      hosted.embed_approved !== true ||
      hosted.sso_enabled !== true ||
      !isAllowedHostedOrigin(launchUrl, approvedOrigins)
    ) {
      fail(res, 503, 'Provider SSO embed is not configured or approved for this content.');
      return;
    }
    fail(res, 503, 'Provider SSO adapter is awaiting the official Corinth token contract.');
  } catch (error) {
    console.error('Licensed embed launch error:', error);
    fail(res, 500, 'Could not start the hosted content session.');
  }
});

router.post('/:id/launch', async (req, res) => {
  try {
    const loaded = await loadAccessibleContent(req, res);
    if (!loaded) return;
    if (loaded.content.delivery_mode !== 'external_link') {
      fail(res, 409, 'This item does not use external-link delivery.');
      return;
    }
    const providerId = String(loaded.content.provider || '');
    const providerSnapshot = await db().collection('licensed_content_providers').doc(providerId).get();
    const launch = resolveExternalLinkLaunch(loaded.content, providerSnapshot.data() || {});
    if (!launch.allowed || !launch.launchUrl) {
      const expired = ['provider_inactive', 'license_expired', 'link_expired'].includes(launch.code);
      fail(res, expired ? 410 : 503, expired
        ? 'This licensed enrichment is no longer available. Continue with the LearnXR lesson.'
        : 'This licensed enrichment is not configured for launch.', { code: launch.code });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    await appendAudit('external_link_launched', loaded.profile.uid, loaded.id, {
      provider: providerId,
      link_type: (loaded.content.external_link as Record<string, unknown> | undefined)?.link_type || null,
    });
    success(res, {
      launch_url: launch.launchUrl,
      provider: providerId,
      license_ends_at: providerSnapshot.data()?.license_ends_at || null,
    });
  } catch (error) {
    console.error('Licensed external launch error:', error);
    fail(res, 500, 'Could not start the licensed enrichment.');
  }
});

router.post('/admin/import', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentStaff(profile)) {
      fail(res, 403, 'Associate or administrator access is required.');
      return;
    }
    const validation = validateImportedManifest(req.body);
    if (!validation.ok || !validation.value) {
      fail(res, 400, 'Manifest validation failed.', validation.errors);
      return;
    }
    const contentId = contentDocumentId(validation.value);
    const ref = db().collection('licensed_content').doc(contentId);
    const now = new Date();
    const document = buildLicensedContentDocument(validation.value, profile.uid, now);
    const existing = await ref.get();
    if (existing.exists && !['draft', 'review'].includes(String(existing.data()?.status))) {
      fail(res, 409, 'Published, suspended, or retired revisions are immutable. Import a new revision.');
      return;
    }
    await ref.set({
      ...document,
      created_at: existing.data()?.created_at || admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
    const jobRef = await db().collection('licensed_content_import_jobs').add({
      provider: validation.value.provider,
      import_key: document.import_key,
      content_id: contentId,
      status: 'validated',
      actor_uid: profile.uid,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    await appendAudit(existing.exists ? 'revision_reimported' : 'revision_imported', profile.uid, contentId, {
      import_key: document.import_key,
      import_job_id: jobRef.id,
    });
    success(res, { id: contentId, import_key: document.import_key, status: 'draft' }, existing.exists ? 200 : 201);
  } catch (error) {
    console.error('Licensed import error:', error);
    fail(res, 500, 'Could not import the licensed content manifest.');
  }
});

router.post('/admin/import-batch', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentStaff(profile)) {
      fail(res, 403, 'Associate or administrator access is required.');
      return;
    }
    const manifests: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];
    if (manifests.length === 0 || manifests.length > MAX_BATCH_IMPORT_ITEMS) {
      fail(res, 400, `items must contain between 1 and ${MAX_BATCH_IMPORT_ITEMS} manifests.`);
      return;
    }
    const validations = manifests.map((manifest) => validateImportedManifest(manifest));
    const validationErrors = validations.flatMap((validation, index) => validation.errors.map((error) => ({ index, error })));
    if (validationErrors.length > 0 || validations.some((validation) => !validation.value)) {
      fail(res, 400, 'Batch manifest validation failed.', validationErrors);
      return;
    }
    const values = validations.map((validation) => validation.value as LicensedContentImport);
    const ids = values.map(contentDocumentId);
    if (new Set(ids).size !== ids.length) {
      fail(res, 409, 'The batch contains duplicate provider content revisions.');
      return;
    }
    const refs = ids.map((id) => db().collection('licensed_content').doc(id));
    const existingSnapshots = await db().getAll(...refs);
    const immutable = existingSnapshots.find((snapshot) => snapshot.exists && !['draft', 'review'].includes(String(snapshot.data()?.status)));
    if (immutable) {
      fail(res, 409, `Revision ${immutable.id} is immutable. Import a new provider revision.`);
      return;
    }
    const batch = db().batch();
    const now = new Date();
    values.forEach((value, index) => {
      const document = buildLicensedContentDocument(value, profile.uid, now);
      const existing = existingSnapshots[index];
      batch.set(refs[index], {
        ...document,
        created_at: existing.data()?.created_at || admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: false });
      const jobRef = db().collection('licensed_content_import_jobs').doc();
      batch.set(jobRef, {
        provider: value.provider,
        import_key: document.import_key,
        content_id: ids[index],
        status: 'validated',
        actor_uid: profile.uid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      const auditRef = db().collection('licensed_content_audit_log').doc();
      batch.set(auditRef, {
        action: existing.exists ? 'revision_reimported' : 'revision_imported',
        actor_uid: profile.uid,
        content_id: ids[index],
        metadata: { import_key: document.import_key, import_job_id: jobRef.id },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    success(res, {
      imported: values.length,
      items: values.map((value, index) => ({ id: ids[index], import_key: `${value.provider}:${value.provider_content_id}:${value.revision}`, status: 'draft' })),
    }, 201);
  } catch (error) {
    console.error('Licensed batch import error:', error);
    fail(res, 500, 'Could not import the licensed content batch.');
  }
});

router.post('/admin/:id/status', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    const requestedStatus = String(req.body?.status || '');
    const allowedForAssociate = ['draft', 'review'];
    const allowedForAdmin = ['draft', 'review', 'published', 'suspended', 'retired'];
    const allowed = isContentAdmin(profile) ? allowedForAdmin : allowedForAssociate;
    if (!isContentStaff(profile) || !allowed.includes(requestedStatus)) {
      fail(res, 403, 'You cannot apply the requested publication status.');
      return;
    }
    const id = String(req.params.id || '');
    if (!/^[a-f0-9]{40}$/.test(id)) {
      fail(res, 400, 'Invalid content ID.');
      return;
    }
    const ref = db().collection('licensed_content').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      fail(res, 404, 'Content not found.');
      return;
    }
    const content = snapshot.data() || {};
    if (requestedStatus === 'published') {
      const provider = await db().collection('licensed_content_providers').doc(String(content.provider)).get();
      const config = provider.data() || {};
      const deliveryApproved = content.delivery_mode === 'krpano_native'
        ? config.native_hosting_approved === true
        : content.delivery_mode === 'external_link'
          ? resolveExternalLinkLaunch(content, config).allowed
          : config.embed_sso_approved === true;
      if (config.licensing_approved !== true || !deliveryApproved) {
        fail(res, 409, 'Provider licensing and delivery rights must be approved before publication.');
        return;
      }
      if (content.delivery_mode === 'krpano_native') {
        const artifactError = await validateNativeArtifactForPublication(content);
        if (artifactError) {
          fail(res, 409, artifactError);
          return;
        }
      }
    }
    await ref.update({
      status: requestedStatus,
      updated_by: profile.uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...(requestedStatus === 'published' ? { published_at: admin.firestore.FieldValue.serverTimestamp() } : {}),
    });
    await appendAudit(`status_${requestedStatus}`, profile.uid, id);
    success(res, { id, status: requestedStatus });
  } catch (error) {
    console.error('Licensed status error:', error);
    fail(res, 500, 'Could not update licensed content status.');
  }
});

router.get('/admin/providers/:provider', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentAdmin(profile)) {
      fail(res, 403, 'Administrator access is required.');
      return;
    }
    const provider = String(req.params.provider || '').trim().toLowerCase();
    if (!SAFE_DOCUMENT_ID.test(provider)) {
      fail(res, 400, 'Invalid provider ID.');
      return;
    }
    const snapshot = await db().collection('licensed_content_providers').doc(provider).get();
    success(res, snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);
  } catch (error) {
    console.error('Licensed provider read error:', error);
    fail(res, 500, 'Could not load the licensed provider configuration.');
  }
});

router.put('/admin/providers/:provider', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentAdmin(profile)) {
      fail(res, 403, 'Administrator access is required.');
      return;
    }
    const provider = String(req.params.provider || '').trim().toLowerCase();
    const status = String(req.body?.status || 'active');
    const licenseStartsAt = new Date(String(req.body?.license_starts_at || ''));
    const licenseEndsAt = new Date(String(req.body?.license_ends_at || ''));
    const permittedLinkTypes = Array.isArray(req.body?.permitted_link_types)
      ? [...new Set<string>(req.body.permitted_link_types.map(String))]
      : [];
    const licensedSeatCount = Number(req.body?.licensed_seat_count);
    const agreementReference = String(req.body?.agreement_reference || '').trim().slice(0, 256);
    if (
      !SAFE_DOCUMENT_ID.test(provider) ||
      !['active', 'expiring', 'expired'].includes(status) ||
      Number.isNaN(licenseStartsAt.getTime()) ||
      Number.isNaN(licenseEndsAt.getTime()) ||
      licenseEndsAt.getTime() <= licenseStartsAt.getTime() ||
      permittedLinkTypes.length === 0 ||
      permittedLinkTypes.some((value) => !LICENSED_LINK_TYPES.includes(value as typeof LICENSED_LINK_TYPES[number])) ||
      !Number.isInteger(licensedSeatCount) ||
      licensedSeatCount < 1 ||
      licensedSeatCount > 100000
    ) {
      fail(res, 400, 'Provider license dates, status, permitted link types, and licensed seat count are required.');
      return;
    }
    const document = {
      integration_mode: 'external_link',
      licensing_approved: req.body?.licensing_approved === true,
      external_link_approved: req.body?.external_link_approved === true,
      status,
      license_starts_at: licenseStartsAt.toISOString(),
      license_ends_at: licenseEndsAt.toISOString(),
      licensed_seat_count: licensedSeatCount,
      permitted_link_types: permittedLinkTypes,
      agreement_reference: agreementReference,
      updated_by: profile.uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db().collection('licensed_content_providers').doc(provider).set(document, { merge: true });
    await appendAudit('provider_license_updated', profile.uid, null, {
      provider,
      status,
      license_ends_at: document.license_ends_at,
    });
    success(res, { id: provider, ...document });
  } catch (error) {
    console.error('Licensed provider update error:', error);
    fail(res, 500, 'Could not update the licensed provider configuration.');
  }
});

router.post('/admin/entitlements', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentAdmin(profile)) {
      fail(res, 403, 'Administrator access is required.');
      return;
    }
    const targetType = req.body?.target_type === 'partner' ? 'partner' : 'school';
    const targetId = String(req.body?.target_id || '').trim();
    const provider = String(req.body?.provider || '').trim().toLowerCase();
    const collectionIds: string[] = Array.isArray(req.body?.collection_ids)
      ? [...new Set<string>(req.body.collection_ids.map(String).map((value: string) => value.trim()).filter(Boolean))]
      : [];
    const status = ['active', 'suspended', 'expired'].includes(req.body?.status) ? req.body.status : 'active';
    if (!SAFE_DOCUMENT_ID.test(targetId) || !SAFE_DOCUMENT_ID.test(provider) || collectionIds.length === 0 || collectionIds.some((value) => value !== '*' && !SAFE_DOCUMENT_ID.test(value))) {
      fail(res, 400, 'target_id, provider, and collection_ids are required.');
      return;
    }
    const id = createHash('sha256').update(`${targetType}:${targetId}:${provider}`).digest('hex').slice(0, 40);
    await db().collection('content_entitlements').doc(id).set({
      target_type: targetType,
      target_id: targetId,
      provider,
      collection_ids: collectionIds,
      status,
      starts_at: req.body?.starts_at || null,
      ends_at: req.body?.ends_at || null,
      updated_by: profile.uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await appendAudit('entitlement_upserted', profile.uid, null, { entitlement_id: id, target_type: targetType, target_id: targetId, provider });
    success(res, { id, status });
  } catch (error) {
    console.error('Licensed entitlement error:', error);
    fail(res, 500, 'Could not update the content entitlement.');
  }
});

router.post('/admin/lesson-links', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentStaff(profile)) {
      fail(res, 403, 'Associate or administrator access is required.');
      return;
    }
    const validation = validateLessonContentMapping(req.body);
    if (!validation.ok || !validation.value) {
      fail(res, 400, 'Curriculum mapping validation failed.', validation.errors);
      return;
    }
    const mapping = validation.value;
    if (!canSetMappingReviewStatus(profile.role, mapping.review_status)) {
      fail(res, 403, 'Your role cannot set the requested mapping review status.');
      return;
    }
    const licensedContentId = mapping.licensed_content_id;
    const chapterId = mapping.chapter_id;
    const topicId = mapping.topic_id;
    const content = await db().collection('licensed_content').doc(licensedContentId).get();
    if (!content.exists) {
      fail(res, 404, 'Licensed content was not found.');
      return;
    }
    const id = createHash('sha256').update(`${chapterId}:${topicId}:${licensedContentId}`).digest('hex').slice(0, 40);
    const linkReference = db().collection('lesson_content_links').doc(id);
    const existingLink = await linkReference.get();
    if (!canUpdateExistingMapping(profile.role, existingLink.data()?.review_status)) {
      fail(res, 403, 'Only an administrator can change an approved curriculum mapping.');
      return;
    }
    await linkReference.set({
      ...mapping,
      reviewed_by: profile.uid,
      reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
      ...(mapping.review_status === 'approved' ? {
        approved_by: profile.uid,
        approved_at: admin.firestore.FieldValue.serverTimestamp(),
      } : {}),
      updated_by: profile.uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await appendAudit('lesson_link_upserted', profile.uid, licensedContentId, {
      link_id: id,
      chapter_id: chapterId,
      topic_id: topicId,
      review_status: mapping.review_status,
      mapping_score: mapping.mapping_score,
    });
    success(res, { id, review_status: mapping.review_status });
  } catch (error) {
    console.error('Licensed lesson link error:', error);
    fail(res, 500, 'Could not map licensed content to the lesson.');
  }
});

router.post('/admin/lesson-links-batch', async (req, res) => {
  try {
    const profile = await requireProfile(req, res);
    if (!profile) return;
    if (!isContentStaff(profile)) {
      fail(res, 403, 'Associate or administrator access is required.');
      return;
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0 || items.length > MAX_BATCH_IMPORT_ITEMS) {
      fail(res, 400, `items must contain between 1 and ${MAX_BATCH_IMPORT_ITEMS} mappings.`);
      return;
    }
    const validations: LessonContentMappingValidation[] = items.map((item: unknown) => validateLessonContentMapping(item));
    const invalidIndex = validations.findIndex((validation) => !validation.ok || !validation.value);
    if (invalidIndex >= 0) {
      fail(res, 400, `Curriculum mapping ${invalidIndex + 1} failed validation.`, validations[invalidIndex].errors);
      return;
    }
    const mappings: LessonContentMapping[] = validations.map((validation) => validation.value!);
    const unauthorized = mappings.find((mapping) => !canSetMappingReviewStatus(profile.role, mapping.review_status));
    if (unauthorized) {
      fail(res, 403, 'Your role cannot set one or more requested mapping review statuses.');
      return;
    }
    const uniqueContentIds = [...new Set(mappings.map((mapping) => mapping.licensed_content_id))];
    const contentSnapshots = await db().getAll(...uniqueContentIds.map((id) => db().collection('licensed_content').doc(id)));
    const missingContent = contentSnapshots.find((snapshot) => !snapshot.exists);
    if (missingContent) {
      fail(res, 404, `Licensed content ${missingContent.id} was not found.`);
      return;
    }

    const linkIds = mappings.map((mapping) => createHash('sha256')
      .update(`${mapping.chapter_id}:${mapping.topic_id}:${mapping.licensed_content_id}`)
      .digest('hex')
      .slice(0, 40));
    const existingLinks = await db().getAll(...linkIds.map((id) => db().collection('lesson_content_links').doc(id)));
    if (existingLinks.some((snapshot) => !canUpdateExistingMapping(profile.role, snapshot.data()?.review_status))) {
      fail(res, 403, 'Only an administrator can change an approved curriculum mapping.');
      return;
    }

    const batch = db().batch();
    const ids: string[] = [];
    mappings.forEach((mapping, index) => {
      const id = linkIds[index];
      ids.push(id);
      batch.set(db().collection('lesson_content_links').doc(id), {
        ...mapping,
        reviewed_by: profile.uid,
        reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
        ...(mapping.review_status === 'approved' ? {
          approved_by: profile.uid,
          approved_at: admin.firestore.FieldValue.serverTimestamp(),
        } : {}),
        updated_by: profile.uid,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(db().collection('licensed_content_audit_log').doc(), {
        action: 'lesson_link_upserted',
        actor_uid: profile.uid,
        content_id: mapping.licensed_content_id,
        metadata: {
          link_id: id,
          chapter_id: mapping.chapter_id,
          topic_id: mapping.topic_id,
          review_status: mapping.review_status,
          mapping_score: mapping.mapping_score,
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    success(res, { imported: mappings.length, ids });
  } catch (error) {
    console.error('Licensed lesson link batch error:', error);
    fail(res, 500, 'Could not import curriculum mappings.');
  }
});

export default router;
