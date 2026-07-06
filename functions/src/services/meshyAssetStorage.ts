import { Request } from 'express';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { initializeAdmin } from '../utils/services';

type SourceCollection = 'text_to_3d_assets' | 'avatar_to_3d_assets' | 'meshy_assets';

interface ModelUrls {
  glb?: string;
  fbx?: string;
  usdz?: string;
  obj?: string;
  mtl?: string;
}

interface TextureUrls {
  base_color?: string;
  metallic?: string;
  normal?: string;
  roughness?: string;
}

export interface FinalizeGeneratedAssetInput {
  sourceAssetId: string;
  sourceCollection: SourceCollection;
  chapterId: string;
  topicId: string;
  userId?: string;
  prompt?: string;
  name?: string;
  artStyle?: string;
  aiModel?: string;
  meshyId?: string;
  meshyPreviewId?: string;
  modelUrls?: ModelUrls;
  thumbnailUrl?: string;
  textureUrls?: TextureUrls[];
  metadata?: Record<string, unknown>;
}

export interface FinalizeAnimatedAssetInput {
  sourceAssetId: string;
  sourceCollection: SourceCollection;
  meshyAssetId?: string;
  animationGlbUrl: string;
  rigTaskId?: string;
  animationTaskId?: string;
  actionId?: number;
}

export interface RegisterUploadedAssetInput {
  assetId: string;
  storagePath: string;
  chapterId: string;
  topicId: string;
  userId?: string;
  name?: string;
  fileName?: string;
  originalFileName?: string;
  fileSize?: number;
  contentType?: string;
}

interface StoredFileResult {
  storagePath: string;
  contentType: string;
  size: number;
  sourceUrl?: string;
}

interface StoragePathResult {
  bucket?: string;
  path: string;
}

const MAX_ASSET_BYTES = 500 * 1024 * 1024;
const MESHY_ASSETS_COLLECTION = 'meshy_assets';
const CONTENT_COLLECTIONS: SourceCollection[] = ['text_to_3d_assets', 'avatar_to_3d_assets'];

function getDb(): admin.firestore.Firestore {
  initializeAdmin();
  return admin.firestore();
}

function getBucket(bucketName?: string) {
  initializeAdmin();
  if (bucketName) return admin.storage().bucket(bucketName);
  return admin.storage().bucket();
}

function createRenderToken(): string {
  return randomBytes(24).toString('base64url');
}

function sanitizePathSegment(value: string | undefined, fallback: string): string {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function contentTypeForFile(fileName: string, upstreamContentType?: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.glb')) return 'model/gltf-binary';
  if (lower.endsWith('.gltf')) return 'model/gltf+json';
  if (lower.endsWith('.fbx')) return 'application/octet-stream';
  if (lower.endsWith('.usdz')) return 'model/vnd.usdz+zip';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return upstreamContentType || 'application/octet-stream';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isFirestoreSentinel(value: unknown): boolean {
  return !!value &&
    typeof value === 'object' &&
    typeof (value as { isEqual?: unknown }).isEqual === 'function';
}

function cleanForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (isFirestoreSentinel(value)) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanForFirestore(item))
      .filter((item) => item !== undefined);
  }
  if (isPlainRecord(value)) {
    const output: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = cleanForFirestore(item);
      if (cleaned !== undefined) output[key] = cleaned;
    });
    return output;
  }
  return value;
}

function buildApiBaseUrl(req: Request): string {
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host') || '';
  return `${protocol}://${host}/api`;
}

export function buildRenderAssetUrl(req: Request, assetId: string, token: string, fileName = 'model.glb'): string {
  return `${buildApiBaseUrl(req)}/render-asset/${encodeURIComponent(assetId)}/${encodeURIComponent(token)}/${fileName}`;
}

export function buildRenderAssetUrlFromBase(apiBaseUrl: string, assetId: string, token: string, fileName = 'model.glb'): string {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  return `${normalizedBaseUrl}/render-asset/${encodeURIComponent(assetId)}/${encodeURIComponent(token)}/${fileName}`;
}

function buildFirebaseMediaUrl(bucketName: string, storagePath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

function extractStoragePathFromFirebaseUrl(urlValue: string): StoragePathResult | null {
  if (!urlValue) return null;

  if (urlValue.startsWith('gs://')) {
    const withoutScheme = urlValue.slice('gs://'.length);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex <= 0) return null;
    return {
      bucket: withoutScheme.slice(0, slashIndex),
      path: withoutScheme.slice(slashIndex + 1),
    };
  }

  try {
    const parsed = new URL(urlValue);
    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const match = parsed.pathname.match(/\/v0\/b\/([^/]+)\/o\/([^/]+)/);
      if (!match) return null;
      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2]),
      };
    }

    if (parsed.hostname === 'storage.googleapis.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return {
        bucket: parts[0],
        path: decodeURIComponent(parts.slice(1).join('/')),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isFirebaseStorageUrl(urlValue: string): boolean {
  return urlValue.includes('firebasestorage.googleapis.com') ||
    urlValue.includes('firebasestorage.app') ||
    urlValue.startsWith('gs://') ||
    urlValue.includes('storage.googleapis.com');
}

async function uploadRemoteFile(url: string, storagePath: string, fileName: string): Promise<StoredFileResult> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: MAX_ASSET_BYTES,
    maxBodyLength: MAX_ASSET_BYTES,
    headers: {
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      'User-Agent': 'LearnXR-Firebase-Asset-Finalizer/1.0',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const buffer = Buffer.from(response.data);
  const contentType = contentTypeForFile(fileName, String(response.headers['content-type'] || ''));
  const bucket = getBucket();
  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        sourceUrl: url.slice(0, 500),
        storedAt: new Date().toISOString(),
      },
    },
  });

  return {
    storagePath,
    contentType,
    size: buffer.length,
    sourceUrl: url,
  };
}

async function ensureUploadedStoragePath(storagePath: string, contentType?: string): Promise<StoredFileResult> {
  const bucket = getBucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Uploaded file not found in Storage: ${storagePath}`);
  }
  const [metadata] = await file.getMetadata();
  return {
    storagePath,
    contentType: contentType || String(metadata.contentType || contentTypeForFile(storagePath)),
    size: Number(metadata.size || 0),
  };
}

async function linkMeshyAssetToTopic(
  chapterId: string,
  topicId: string,
  assetId: string,
  userId?: string
): Promise<void> {
  const db = getDb();
  const chapterRef = db.collection('curriculum_chapters').doc(chapterId);
  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) return;

  const chapter = chapterSnap.data() || {};
  const topics = Array.isArray(chapter.topics) ? [...chapter.topics] : [];
  const topicIndex = topics.findIndex((topic: any) => String(topic?.topic_id || topic?.id || '') === topicId);
  if (topicIndex < 0) return;

  const currentTopic = topics[topicIndex] || {};
  const sharedAssets = currentTopic.sharedAssets || {};
  const existingIds = [
    ...(Array.isArray(sharedAssets.meshy_asset_ids) ? sharedAssets.meshy_asset_ids : []),
    ...(Array.isArray(sharedAssets.asset_ids) ? sharedAssets.asset_ids : []),
    ...(Array.isArray(currentTopic.meshy_asset_ids) ? currentTopic.meshy_asset_ids : []),
    ...(Array.isArray(currentTopic.asset_ids) ? currentTopic.asset_ids : []),
  ].map((id: unknown) => String(id)).filter(Boolean);
  const allIds = [...new Set([...existingIds, assetId])];

  topics[topicIndex] = {
    ...currentTopic,
    sharedAssets: {
      ...sharedAssets,
      meshy_asset_ids: allIds,
      asset_ids: allIds,
    },
    meshy_asset_ids: allIds,
    asset_ids: allIds,
  };

  const updatePayload: Record<string, unknown> = {
    topics,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await chapterRef.update(updatePayload);

  if (userId) {
    const historyRef = chapterRef.collection('history').doc();
    await historyRef.set({
      action: 'linked_3d_asset',
      description: `Linked 3D asset ${assetId} to topic`,
      userId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

function normalizeModelUrls(input?: ModelUrls): ModelUrls {
  return input && typeof input === 'object' ? input : {};
}

function normalizeTextureUrls(input?: TextureUrls[]): TextureUrls[] {
  return Array.isArray(input) ? input : [];
}

async function writeAssetRecord(
  req: Request,
  params: {
    assetId: string;
    chapterId: string;
    topicId: string;
    name?: string;
    prompt?: string;
    sourceCollection?: SourceCollection;
    sourceAssetId?: string;
    userId?: string;
    meshyId?: string;
    meshyPreviewId?: string;
    storageFiles: {
      glb: StoredFileResult;
      fbx?: StoredFileResult;
      usdz?: StoredFileResult;
      thumbnail?: StoredFileResult;
      textures?: Record<string, StoredFileResult>;
    };
    sourceModelUrls?: ModelUrls;
    sourceThumbnailUrl?: string;
    artStyle?: string;
    aiModel?: string;
    metadata?: Record<string, unknown>;
    extra?: Record<string, unknown>;
    apiBaseUrl?: string;
  }
): Promise<Record<string, unknown>> {
  const db = getDb();
  const bucket = getBucket();
  const renderToken = createRenderToken();
  const renderUrl = params.apiBaseUrl
    ? buildRenderAssetUrlFromBase(params.apiBaseUrl, params.assetId, renderToken)
    : buildRenderAssetUrl(req, params.assetId, renderToken);
  const firebaseDownloadUrl = buildFirebaseMediaUrl(bucket.name, params.storageFiles.glb.storagePath);
  const storagePaths: Record<string, unknown> = {
    glb: params.storageFiles.glb.storagePath,
  };
  if (params.storageFiles.fbx) storagePaths.fbx = params.storageFiles.fbx.storagePath;
  if (params.storageFiles.usdz) storagePaths.usdz = params.storageFiles.usdz.storagePath;
  if (params.storageFiles.thumbnail) storagePaths.thumbnail = params.storageFiles.thumbnail.storagePath;
  if (params.storageFiles.textures) {
    storagePaths.textures = Object.fromEntries(
      Object.entries(params.storageFiles.textures).map(([key, value]) => [key, value.storagePath])
    );
  }

  const assetData = cleanForFirestore({
    asset_id: params.assetId,
    chapter_id: params.chapterId,
    topic_id: params.topicId,
    name: params.name || params.prompt?.slice(0, 100) || 'Generated 3D Asset',
    prompt: params.prompt,
    storage_path: params.storageFiles.glb.storagePath,
    storagePath: params.storageFiles.glb.storagePath,
    storage_bucket: bucket.name,
    storage_paths: storagePaths,
    render_token: renderToken,
    render_url: renderUrl,
    firebase_download_url: firebaseDownloadUrl,
    glb_url: renderUrl,
    fbx_url: params.storageFiles.fbx ? buildFirebaseMediaUrl(bucket.name, params.storageFiles.fbx.storagePath) : undefined,
    usdz_url: params.storageFiles.usdz ? buildFirebaseMediaUrl(bucket.name, params.storageFiles.usdz.storagePath) : undefined,
    thumbnail_url: params.storageFiles.thumbnail ? buildFirebaseMediaUrl(bucket.name, params.storageFiles.thumbnail.storagePath) : params.sourceThumbnailUrl,
    model_urls: {
      ...(params.sourceModelUrls || {}),
      glb: renderUrl,
      fbx: params.storageFiles.fbx ? buildFirebaseMediaUrl(bucket.name, params.storageFiles.fbx.storagePath) : params.sourceModelUrls?.fbx,
      usdz: params.storageFiles.usdz ? buildFirebaseMediaUrl(bucket.name, params.storageFiles.usdz.storagePath) : params.sourceModelUrls?.usdz,
    },
    source_model_urls: params.sourceModelUrls,
    source_thumbnail_url: params.sourceThumbnailUrl,
    meshy_id: params.meshyId,
    meshy_preview_id: params.meshyPreviewId,
    status: 'complete',
    isCore: false,
    assetTier: 'optional',
    asset_repair_status: 'ready',
    metadata: {
      ...(params.metadata || {}),
      source: params.sourceCollection === 'avatar_to_3d_assets' ? 'avatar_to_3d_asset' : 'text_to_3d_asset',
      source_asset_id: params.sourceAssetId,
      source_collection: params.sourceCollection,
      art_style: params.artStyle,
      ai_model: params.aiModel,
    },
    ...params.extra,
  }) as Record<string, unknown>;

  assetData.created_at = admin.firestore.FieldValue.serverTimestamp();
  assetData.updated_at = admin.firestore.FieldValue.serverTimestamp();

  await db.collection(MESHY_ASSETS_COLLECTION).doc(params.assetId).set(assetData, { merge: true });

  if (params.sourceCollection && params.sourceAssetId && params.sourceCollection !== MESHY_ASSETS_COLLECTION) {
    const sourceUpdate = cleanForFirestore({
      meshy_asset_id: params.assetId,
      storage_path: params.storageFiles.glb.storagePath,
      storage_paths: storagePaths,
      render_token: renderToken,
      render_url: renderUrl,
      firebase_download_url: firebaseDownloadUrl,
      glb_url: renderUrl,
      model_urls: {
        glb: renderUrl,
        fbx: assetData.fbx_url,
        usdz: assetData.usdz_url,
      },
      thumbnail_url: assetData.thumbnail_url,
      status: 'complete',
      asset_repair_status: 'ready',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }) as Record<string, unknown>;
    await db.collection(params.sourceCollection).doc(params.sourceAssetId).set(sourceUpdate, { merge: true });
  }

  await linkMeshyAssetToTopic(params.chapterId, params.topicId, params.assetId, params.userId);
  return {
    id: params.assetId,
    ...assetData,
    render_url: renderUrl,
    glb_url: renderUrl,
  };
}

export async function finalizeGeneratedAsset(
  req: Request,
  input: FinalizeGeneratedAssetInput,
  authenticatedUserId?: string,
  apiBaseUrl?: string
): Promise<Record<string, unknown>> {
  const db = getDb();
  const assetRef = db.collection(MESHY_ASSETS_COLLECTION).doc();
  const assetId = assetRef.id;
  const chapterSegment = sanitizePathSegment(input.chapterId, 'chapter');
  const topicSegment = sanitizePathSegment(input.topicId, 'topic');
  const basePath = `meshy_assets/${chapterSegment}/${topicSegment}/${assetId}`;
  const modelUrls = normalizeModelUrls(input.modelUrls);
  const textureUrls = normalizeTextureUrls(input.textureUrls);

  if (!modelUrls.glb) {
    throw new Error('GLB model URL is required to finalize a 3D asset');
  }

  const storageFiles: {
    glb: StoredFileResult;
    fbx?: StoredFileResult;
    usdz?: StoredFileResult;
    thumbnail?: StoredFileResult;
    textures?: Record<string, StoredFileResult>;
  } = {
    glb: await uploadRemoteFile(modelUrls.glb, `${basePath}/model.glb`, 'model.glb'),
  };

  if (modelUrls.fbx) {
    storageFiles.fbx = await uploadRemoteFile(modelUrls.fbx, `${basePath}/model.fbx`, 'model.fbx');
  }
  if (modelUrls.usdz) {
    storageFiles.usdz = await uploadRemoteFile(modelUrls.usdz, `${basePath}/model.usdz`, 'model.usdz');
  }
  if (input.thumbnailUrl) {
    storageFiles.thumbnail = await uploadRemoteFile(input.thumbnailUrl, `${basePath}/thumbnail.jpg`, 'thumbnail.jpg');
  }
  if (textureUrls[0]) {
    const textureSet = textureUrls[0];
    const textureFiles: Record<string, StoredFileResult> = {};
    if (textureSet.base_color) {
      textureFiles.base_color = await uploadRemoteFile(textureSet.base_color, `${basePath}/textures/base_color.jpg`, 'base_color.jpg');
    }
    if (textureSet.metallic) {
      textureFiles.metallic = await uploadRemoteFile(textureSet.metallic, `${basePath}/textures/metallic.jpg`, 'metallic.jpg');
    }
    if (textureSet.normal) {
      textureFiles.normal = await uploadRemoteFile(textureSet.normal, `${basePath}/textures/normal.jpg`, 'normal.jpg');
    }
    if (textureSet.roughness) {
      textureFiles.roughness = await uploadRemoteFile(textureSet.roughness, `${basePath}/textures/roughness.jpg`, 'roughness.jpg');
    }
    if (Object.keys(textureFiles).length > 0) storageFiles.textures = textureFiles;
  }

  return writeAssetRecord(req, {
    assetId,
    chapterId: input.chapterId,
    topicId: input.topicId,
    userId: input.userId || authenticatedUserId,
    name: input.name,
    prompt: input.prompt,
    sourceCollection: input.sourceCollection,
    sourceAssetId: input.sourceAssetId,
    meshyId: input.meshyId,
    meshyPreviewId: input.meshyPreviewId,
    storageFiles,
    sourceModelUrls: modelUrls,
    sourceThumbnailUrl: input.thumbnailUrl,
    artStyle: input.artStyle,
    aiModel: input.aiModel,
    metadata: input.metadata,
    apiBaseUrl,
  });
}

export async function registerUploadedAsset(
  req: Request,
  input: RegisterUploadedAssetInput,
  authenticatedUserId?: string
): Promise<Record<string, unknown>> {
  const storedGlb = await ensureUploadedStoragePath(input.storagePath, input.contentType);
  return writeAssetRecord(req, {
    assetId: input.assetId,
    chapterId: input.chapterId,
    topicId: input.topicId,
    userId: input.userId || authenticatedUserId,
    name: input.name,
    storageFiles: { glb: storedGlb },
    extra: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      originalFileName: input.originalFileName,
      contentType: input.contentType || storedGlb.contentType,
      metadata: {
        source: 'manual_upload',
        uploaded_by: input.userId || authenticatedUserId,
      },
    },
  });
}

export async function finalizeAnimatedAsset(
  req: Request,
  input: FinalizeAnimatedAssetInput
): Promise<Record<string, unknown>> {
  const db = getDb();
  const sourceCollection = input.sourceCollection;
  const sourceSnap = await db.collection(sourceCollection).doc(input.sourceAssetId).get();
  const sourceData = sourceSnap.exists ? sourceSnap.data() || {} : {};
  const targetMeshyAssetId = input.meshyAssetId || String(sourceData.meshy_asset_id || input.sourceAssetId);
  const meshyRef = db.collection(MESHY_ASSETS_COLLECTION).doc(targetMeshyAssetId);
  const meshySnap = await meshyRef.get();
  const meshyData = meshySnap.exists ? meshySnap.data() || {} : {};
  const chapterId = String(meshyData.chapter_id || sourceData.chapter_id || '');
  const topicId = String(meshyData.topic_id || sourceData.topic_id || '');

  if (!chapterId || !topicId) {
    throw new Error('Cannot finalize animation without chapter_id and topic_id');
  }

  const chapterSegment = sanitizePathSegment(chapterId, 'chapter');
  const topicSegment = sanitizePathSegment(topicId, 'topic');
  const storagePath = `meshy_assets/${chapterSegment}/${topicSegment}/${targetMeshyAssetId}/animated_model.glb`;
  const stored = await uploadRemoteFile(input.animationGlbUrl, storagePath, 'animated_model.glb');
  const token = createRenderToken();
  const renderUrl = buildRenderAssetUrl(req, targetMeshyAssetId, token, 'animated_model.glb');

  const updatePayload = cleanForFirestore({
    animated_storage_path: stored.storagePath,
    animated_render_token: token,
    animated_render_url: renderUrl,
    animated_glb_url: renderUrl,
    rig_task_id: input.rigTaskId,
    animation_task_id: input.animationTaskId,
    animation_action_id: input.actionId,
    asset_repair_status: 'ready',
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }) as Record<string, unknown>;

  await meshyRef.set(updatePayload, { merge: true });
  await db.collection(sourceCollection).doc(input.sourceAssetId).set(updatePayload, { merge: true });

  return {
    meshyAssetId: targetMeshyAssetId,
    animated_render_url: renderUrl,
    animated_glb_url: renderUrl,
    animated_storage_path: stored.storagePath,
  };
}

async function repairAssetDocument(
  req: Request,
  docRef: admin.firestore.DocumentReference,
  data: admin.firestore.DocumentData
): Promise<'updated' | 'skipped' | 'failed'> {
  const existingRenderUrl = String(data.render_url || '');
  if (existingRenderUrl.includes('/render-asset/')) return 'skipped';

  const existingStoragePath = data.storage_path || data.storagePath || data.storage_paths?.glb;
  const sourceGlbUrl = String(
    data.glb_url ||
    data.model_urls?.glb ||
    data.textured_model_glb ||
    data.final_asset_url ||
    data.asset_url ||
    ''
  );
  if (!existingStoragePath && !sourceGlbUrl) return 'skipped';

  try {
    const assetId = docRef.id;
    let storagePath = existingStoragePath ? String(existingStoragePath) : '';
    let storageBucket: string | undefined = data.storage_bucket ? String(data.storage_bucket) : undefined;

    if (!storagePath && sourceGlbUrl && isFirebaseStorageUrl(sourceGlbUrl)) {
      const parsed = extractStoragePathFromFirebaseUrl(sourceGlbUrl);
      if (parsed) {
        storagePath = parsed.path;
        storageBucket = parsed.bucket;
      }
    }

    if (!storagePath && sourceGlbUrl) {
      const chapterSegment = sanitizePathSegment(String(data.chapter_id || 'chapter'), 'chapter');
      const topicSegment = sanitizePathSegment(String(data.topic_id || 'topic'), 'topic');
      storagePath = `meshy_assets/${chapterSegment}/${topicSegment}/${assetId}/model.glb`;
      await uploadRemoteFile(sourceGlbUrl, storagePath, 'model.glb');
    }

    if (!storagePath) return 'skipped';

    const token = createRenderToken();
    const renderUrl = buildRenderAssetUrl(req, assetId, token);
    const bucket = getBucket(storageBucket);
    const updatePayload = cleanForFirestore({
      storage_path: storagePath,
      storagePath,
      storage_bucket: bucket.name,
      storage_paths: {
        ...(isPlainRecord(data.storage_paths) ? data.storage_paths : {}),
        glb: storagePath,
      },
      render_token: token,
      render_url: renderUrl,
      firebase_download_url: buildFirebaseMediaUrl(bucket.name, storagePath),
      glb_url: renderUrl,
      model_urls: {
        ...(isPlainRecord(data.model_urls) ? data.model_urls : {}),
        glb: renderUrl,
      },
      source_model_urls: sourceGlbUrl ? { glb: sourceGlbUrl } : undefined,
      asset_repair_status: 'ready',
      asset_repair_error: admin.firestore.FieldValue.delete(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }) as Record<string, unknown>;
    await docRef.set(updatePayload, { merge: true });
    return 'updated';
  } catch (error: any) {
    await docRef.set({
      asset_repair_status: 'failed',
      asset_repair_error: error?.message || String(error),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return 'failed';
  }
}

async function repairSourceCollection(
  req: Request,
  collectionName: SourceCollection,
  limit: number
): Promise<{ updated: number; skipped: number; failed: number; createdMeshyAssets: number }> {
  const db = getDb();
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let createdMeshyAssets = 0;
  const snap = await db.collection(collectionName).limit(limit).get();

  for (const sourceDoc of snap.docs) {
    const sourceData = sourceDoc.data() || {};
    const meshyAssetId = sourceData.meshy_asset_id ? String(sourceData.meshy_asset_id) : '';
    if (meshyAssetId) {
      const meshyRef = db.collection(MESHY_ASSETS_COLLECTION).doc(meshyAssetId);
      const meshySnap = await meshyRef.get();
      if (meshySnap.exists) {
        const outcome = await repairAssetDocument(req, meshyRef, meshySnap.data() || {});
        if (outcome === 'updated') updated++;
        else if (outcome === 'failed') failed++;
        else skipped++;
        const repaired = (await meshyRef.get()).data() || {};
        await sourceDoc.ref.set(cleanForFirestore({
          render_url: repaired.render_url,
          glb_url: repaired.glb_url,
          model_urls: repaired.model_urls,
          storage_path: repaired.storage_path,
          storage_paths: repaired.storage_paths,
          firebase_download_url: repaired.firebase_download_url,
          asset_repair_status: repaired.asset_repair_status,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }) as Record<string, unknown>, { merge: true });
        continue;
      }
    }

    const sourceUrl = String(sourceData.glb_url || sourceData.model_urls?.glb || '');
    const chapterId = String(sourceData.chapter_id || '');
    const topicId = String(sourceData.topic_id || '');
    if (!sourceUrl || !chapterId || !topicId) {
      skipped++;
      continue;
    }

    try {
      const assetRef = db.collection(MESHY_ASSETS_COLLECTION).doc();
      const chapterSegment = sanitizePathSegment(chapterId, 'chapter');
      const topicSegment = sanitizePathSegment(topicId, 'topic');
      const storagePath = `meshy_assets/${chapterSegment}/${topicSegment}/${assetRef.id}/model.glb`;
      let stored: StoredFileResult;
      if (isFirebaseStorageUrl(sourceUrl)) {
        const parsed = extractStoragePathFromFirebaseUrl(sourceUrl);
        if (!parsed) throw new Error('Could not derive Storage path from Firebase URL');
        stored = {
          storagePath: parsed.path,
          contentType: contentTypeForFile(parsed.path),
          size: 0,
          sourceUrl,
        };
      } else {
        stored = await uploadRemoteFile(sourceUrl, storagePath, 'model.glb');
      }

      const asset = await writeAssetRecord(req, {
        assetId: assetRef.id,
        chapterId,
        topicId,
        userId: String(sourceData.created_by || sourceData.userId || ''),
        prompt: String(sourceData.prompt || ''),
        sourceCollection: collectionName,
        sourceAssetId: sourceDoc.id,
        storageFiles: { glb: stored },
        sourceModelUrls: { glb: sourceUrl },
      });
      await sourceDoc.ref.set({
        meshy_asset_id: assetRef.id,
        render_url: asset.render_url,
        glb_url: asset.glb_url,
        model_urls: asset.model_urls,
        storage_path: asset.storage_path,
        storage_paths: asset.storage_paths,
        asset_repair_status: 'ready',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      createdMeshyAssets++;
      updated++;
    } catch (error: any) {
      await sourceDoc.ref.set({
        asset_repair_status: 'failed',
        asset_repair_error: error?.message || String(error),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      failed++;
    }
  }

  return { updated, skipped, failed, createdMeshyAssets };
}

export async function backfillAssets(
  req: Request,
  limit: number
): Promise<Record<string, unknown>> {
  const db = getDb();
  const boundedLimit = Math.max(1, Math.min(limit, 200));
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let createdMeshyAssets = 0;

  const meshySnap = await db.collection(MESHY_ASSETS_COLLECTION).limit(boundedLimit).get();
  for (const assetDoc of meshySnap.docs) {
    const outcome = await repairAssetDocument(req, assetDoc.ref, assetDoc.data() || {});
    if (outcome === 'updated') updated++;
    else if (outcome === 'failed') failed++;
    else skipped++;
  }

  for (const collectionName of CONTENT_COLLECTIONS) {
    const result = await repairSourceCollection(req, collectionName, boundedLimit);
    updated += result.updated;
    skipped += result.skipped;
    failed += result.failed;
    createdMeshyAssets += result.createdMeshyAssets;
  }

  return {
    limit: boundedLimit,
    updated,
    skipped,
    failed,
    createdMeshyAssets,
    status: failed > 0 ? 'completed_with_errors' : 'completed',
  };
}
