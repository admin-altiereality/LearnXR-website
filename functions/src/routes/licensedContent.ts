import { createHash } from 'node:crypto';
import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getUserProfile, normalizeUserRole, UserProfile } from '../middleware/rbac.js';
import {
  buildLicensedContentDocument,
  isAllowedHostedOrigin,
  isEntitlementActive,
  LicensedContentImport,
  resolveLicensedCatalogAvailability,
  validateImportedManifest,
} from '../services/licensedContentDomain.js';

const router = express.Router();
const db = () => admin.firestore();
const MAX_CATALOG_ITEMS = 250;
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

function sanitizeSummary(id: string, content: Record<string, unknown>) {
  return {
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
    thumbnail_storage_path: content.thumbnail_storage_path,
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

    const items = await Promise.all(candidates.map(async ({ id, content }) => ({
      ...sanitizeSummary(id, content),
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
      const contentId = String(link.data().licensed_content_id || '');
      const contentSnapshot = await db().collection('licensed_content').doc(contentId).get();
      if (!contentSnapshot.exists) return null;
      const content = contentSnapshot.data() as Record<string, unknown>;
      if (content.status !== 'published' || !canAccessContent(profile, entitlements, content)) return null;
      const manifest = await createLaunchManifest(contentId, content);
      return { ...manifest, placement: link.data().placement, phase: link.data().phase, priority: link.data().priority };
    }));
    success(res, { items: manifests.filter(Boolean) });
  } catch (error) {
    console.error('Licensed lesson links error:', error);
    fail(res, 500, 'Could not resolve licensed lesson content.');
  }
});

async function createLaunchManifest(id: string, content: Record<string, unknown>) {
  const deliveryMode = content.delivery_mode;
  const native = typeof content.native === 'object' && content.native ? content.native as Record<string, unknown> : null;
  const hosted = typeof content.hosted === 'object' && content.hosted ? content.hosted as Record<string, unknown> : null;
  const summary = sanitizeSummary(id, content);
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
    success(res, await createLaunchManifest(loaded.id, loaded.content));
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
    const licensedContentId = String(req.body?.licensed_content_id || '').trim();
    const chapterId = String(req.body?.chapter_id || '').trim();
    const topicId = String(req.body?.topic_id || '').trim();
    if (!/^[a-f0-9]{40}$/.test(licensedContentId) || !chapterId || !topicId || chapterId.length > 256 || topicId.length > 256) {
      fail(res, 400, 'licensed_content_id, chapter_id, and topic_id are required.');
      return;
    }
    const content = await db().collection('licensed_content').doc(licensedContentId).get();
    if (!content.exists) {
      fail(res, 404, 'Licensed content was not found.');
      return;
    }
    const id = createHash('sha256').update(`${chapterId}:${topicId}:${licensedContentId}`).digest('hex').slice(0, 40);
    await db().collection('lesson_content_links').doc(id).set({
      licensed_content_id: licensedContentId,
      chapter_id: chapterId,
      topic_id: topicId,
      phase: String(req.body?.phase || 'learn'),
      placement: req.body?.placement && typeof req.body.placement === 'object' ? req.body.placement : null,
      priority: Number.isFinite(Number(req.body?.priority)) ? Number(req.body.priority) : 0,
      teaching_notes: String(req.body?.teaching_notes || '').slice(0, 2000),
      updated_by: profile.uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await appendAudit('lesson_link_upserted', profile.uid, licensedContentId, { link_id: id, chapter_id: chapterId, topic_id: topicId });
    success(res, { id });
  } catch (error) {
    console.error('Licensed lesson link error:', error);
    fail(res, 500, 'Could not map licensed content to the lesson.');
  }
});

export default router;
