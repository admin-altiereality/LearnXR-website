import { Request } from 'express';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { initializeAdmin, initializeServices, MESHY_API_KEY } from '../utils/services';
import { finalizeGeneratedAsset } from './meshyAssetStorage';

type SourceCollection = 'text_to_3d_assets' | 'avatar_to_3d_assets';
type JobStatus = 'dry_run' | 'queued' | 'running' | 'completed' | 'completed_with_errors' | 'cancelled' | 'failed';
type ItemStatus =
  | 'scan_result'
  | 'pending'
  | 'generating_preview'
  | 'refining_texture'
  | 'finalizing'
  | 'replaced'
  | 'failed'
  | 'cancelled';

interface JobScope {
  chapterId?: string;
  topicId?: string;
  sourceCollections?: SourceCollection[];
  limit?: number;
  healthCheck?: boolean;
}

interface RegenerationSettings {
  aiModel: 'meshy-6' | 'latest';
  concurrency: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
  targetFormats: string[];
  /** Meshy only honours `targetPolycount` when remeshing; leave this on or you get the raw high-poly mesh. */
  shouldRemesh: boolean;
  targetPolycount: number;
  hdTexture: boolean;
  enablePbr: boolean;
  removeLighting: boolean;
  autoSize: boolean;
  originAt: 'bottom' | 'center';
  moderation: boolean;
  apiBaseUrl: string;
}

interface SelectedRegenerationItem {
  sourceCollection: SourceCollection;
  sourceAssetId: string;
}

interface CreateRegenerationJobInput {
  dryRun?: boolean;
  scope?: JobScope;
  selectedItems?: SelectedRegenerationItem[];
  settings?: Partial<RegenerationSettings>;
  createdBy?: string;
}

interface MeshyTaskResponse {
  id?: string;
  result?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  progress?: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    usdz?: string;
    obj?: string;
    mtl?: string;
  };
  thumbnail_url?: string;
  texture_urls?: Array<{
    base_color?: string;
    metallic?: string;
    normal?: string;
    roughness?: string;
  }>;
  task_error?: { message?: string };
}

interface RegenerationCandidate {
  id: string;
  source_collection: SourceCollection;
  source_asset_id: string;
  old_meshy_asset_id?: string;
  prompt: string;
  chapter_id: string;
  topic_id: string;
  broken_reasons: string[];
  old_url_type: string;
  estimated_meshy_task_count: number;
  legacy_url_snapshot: Record<string, unknown>;
}

const JOBS_COLLECTION = 'meshy_asset_regeneration_jobs';
const MESHY_ASSETS_COLLECTION = 'meshy_assets';
const SOURCE_COLLECTIONS: SourceCollection[] = ['text_to_3d_assets', 'avatar_to_3d_assets'];
const MESHY_API_BASE_URL = 'https://api.meshy.ai/openapi/v2';
const DEFAULT_API_BASE_URL = 'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api';
const PROCESSING_STATUSES: ItemStatus[] = ['pending', 'generating_preview', 'refining_texture', 'finalizing'];

function getDb(): admin.firestore.Firestore {
  initializeAdmin();
  return admin.firestore();
}

function serverTimestamp(): admin.firestore.FieldValue {
  return admin.firestore.FieldValue.serverTimestamp();
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

function boundedLimit(limit: unknown): number {
  const numeric = Number(limit || 100);
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(1, Math.min(Math.floor(numeric), 200));
}

function normalizeScope(scope?: JobScope): JobScope {
  const sourceCollections = Array.isArray(scope?.sourceCollections) && scope?.sourceCollections.length
    ? scope.sourceCollections.filter((value): value is SourceCollection => SOURCE_COLLECTIONS.includes(value as SourceCollection))
    : SOURCE_COLLECTIONS;
  return {
    chapterId: scope?.chapterId ? String(scope.chapterId) : undefined,
    topicId: scope?.topicId ? String(scope.topicId) : undefined,
    sourceCollections,
    limit: boundedLimit(scope?.limit),
    healthCheck: scope?.healthCheck === true,
  };
}

function normalizeSettings(settings?: Partial<RegenerationSettings>): RegenerationSettings {
  return {
    aiModel: settings?.aiModel === 'latest' ? 'latest' : 'meshy-6',
    concurrency: Math.max(1, Math.min(Number(settings?.concurrency || 2), 2)),
    pollIntervalMs: Math.max(2500, Math.min(Number(settings?.pollIntervalMs || 5000), 15000)),
    maxPollAttempts: Math.max(30, Math.min(Number(settings?.maxPollAttempts || 90), 160)),
    targetFormats: Array.isArray(settings?.targetFormats) && settings.targetFormats.length ? settings.targetFormats : ['glb'],
    shouldRemesh: settings?.shouldRemesh !== false,
    targetPolycount: Math.max(1000, Math.min(Number(settings?.targetPolycount || 30000), 300000)),
    // Defaults OFF, matching routes/meshy.ts: 4096px maps cost ~39MB on the wire and
    // ~160MB of RGBA once decoded, for no visible gain at lesson viewing distance.
    hdTexture: settings?.hdTexture === true,
    enablePbr: settings?.enablePbr !== false,
    removeLighting: settings?.removeLighting !== false,
    autoSize: settings?.autoSize !== false,
    originAt: settings?.originAt === 'center' ? 'center' : 'bottom',
    moderation: settings?.moderation !== false,
    apiBaseUrl: (settings?.apiBaseUrl || process.env.RENDER_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMeshyApiKey(): string {
  initializeServices();
  const key = (process.env.MESHY_API_KEY || MESHY_API_KEY || '').trim().replace(/^Bearer\s+/i, '');
  if (!key) {
    throw new Error('Meshy API key is not configured');
  }
  return key;
}

function isApprovedPromptAsset(data: admin.firestore.DocumentData): boolean {
  const prompt = String(data.prompt || '').trim();
  if (!prompt) return false;
  return data.approval_status === true ||
    data.approved === true ||
    data.status === 'approved' ||
    data.status === 'ready' ||
    data.status === 'failed' ||
    data.status === 'complete';
}

function isTokenRenderUrl(urlValue: string): boolean {
  return urlValue.includes('/render-asset/') && urlValue.endsWith('.glb');
}

function isFirebaseStorageUrl(urlValue: string): boolean {
  return urlValue.includes('firebasestorage.googleapis.com') ||
    urlValue.includes('firebasestorage.app') ||
    urlValue.includes('storage.googleapis.com') ||
    urlValue.startsWith('gs://');
}

function isMeshyUrl(urlValue: string): boolean {
  return urlValue.includes('assets.meshy.ai') || urlValue.includes('meshylabs.com') || urlValue.includes('meshy.ai');
}

function isExternalModelUrl(urlValue: string): boolean {
  if (!urlValue || isTokenRenderUrl(urlValue) || isFirebaseStorageUrl(urlValue)) return false;
  return /^https?:\/\//i.test(urlValue);
}

function getNestedString(data: admin.firestore.DocumentData | undefined, path: string): string {
  if (!data) return '';
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (!isPlainRecord(current)) return undefined;
    return current[key];
  }, data);
  return typeof value === 'string' ? value.trim() : '';
}

function activeGlbUrl(sourceData: admin.firestore.DocumentData, meshyData?: admin.firestore.DocumentData): string {
  return getNestedString(sourceData, 'animated_render_url') ||
    getNestedString(sourceData, 'render_url') ||
    getNestedString(sourceData, 'model_urls.glb') ||
    getNestedString(sourceData, 'glb_url') ||
    getNestedString(meshyData, 'animated_render_url') ||
    getNestedString(meshyData, 'render_url') ||
    getNestedString(meshyData, 'model_urls.glb') ||
    getNestedString(meshyData, 'glb_url') ||
    '';
}

function classifyUrl(urlValue: string): string {
  if (!urlValue) return 'missing';
  if (isTokenRenderUrl(urlValue)) return 'render_url';
  if (isFirebaseStorageUrl(urlValue)) return 'firebase_storage';
  if (isMeshyUrl(urlValue)) return 'meshy_external';
  if (isExternalModelUrl(urlValue)) return 'external';
  return 'unknown';
}

function getStoragePath(sourceData: admin.firestore.DocumentData, meshyData?: admin.firestore.DocumentData): string {
  return getNestedString(sourceData, 'storage_path') ||
    getNestedString(sourceData, 'storagePath') ||
    getNestedString(sourceData, 'storage_paths.glb') ||
    getNestedString(meshyData, 'storage_path') ||
    getNestedString(meshyData, 'storagePath') ||
    getNestedString(meshyData, 'storage_paths.glb') ||
    '';
}

function getRenderUrl(sourceData: admin.firestore.DocumentData, meshyData?: admin.firestore.DocumentData): string {
  const renderUrl = getNestedString(sourceData, 'render_url') || getNestedString(meshyData, 'render_url');
  return isTokenRenderUrl(renderUrl) ? renderUrl : '';
}

function getLegacyUrlSnapshot(
  sourceData: admin.firestore.DocumentData,
  meshyData?: admin.firestore.DocumentData
): Record<string, unknown> {
  return cleanForFirestore({
    source: {
      render_url: sourceData.render_url,
      glb_url: sourceData.glb_url,
      model_urls: sourceData.model_urls,
      asset_url: sourceData.asset_url,
      final_asset_url: sourceData.final_asset_url,
      textured_model_glb: sourceData.textured_model_glb,
      downloadUrl: sourceData.downloadUrl,
    },
    meshy_asset: meshyData ? {
      render_url: meshyData.render_url,
      glb_url: meshyData.glb_url,
      model_urls: meshyData.model_urls,
      source_model_urls: meshyData.source_model_urls,
      asset_url: meshyData.asset_url,
      final_asset_url: meshyData.final_asset_url,
    } : undefined,
  }) as Record<string, unknown>;
}

async function healthCheckRenderUrl(renderUrl: string): Promise<boolean> {
  if (!renderUrl) return false;
  try {
    const head = await axios.head(renderUrl, {
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    if (head.status >= 200 && head.status < 400) return true;
  } catch {
    // Some render paths only support GET. Fall through to a byte-range GET.
  }

  try {
    await axios.get<ArrayBuffer>(renderUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 1024 * 1024,
      headers: {
        Range: 'bytes=0-1023',
        Accept: 'model/gltf-binary,*/*',
      },
      validateStatus: (status) => status === 200 || status === 206,
    });
    return true;
  } catch {
    return false;
  }
}

function makeItemId(sourceCollection: SourceCollection, sourceAssetId: string): string {
  return `${sourceCollection}__${sourceAssetId}`.replace(/[\/#?[\]]+/g, '_');
}

async function buildCandidate(
  sourceCollection: SourceCollection,
  sourceDoc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot,
  options: { forceInclude?: boolean; healthCheck?: boolean } = {}
): Promise<RegenerationCandidate | null> {
  if (!sourceDoc.exists) return null;
  const sourceData = sourceDoc.data() || {};
  if (!isApprovedPromptAsset(sourceData)) return null;

  const prompt = String(sourceData.prompt || '').trim();
  const chapterId = String(sourceData.chapter_id || sourceData.chapterId || '').trim();
  const topicId = String(sourceData.topic_id || sourceData.topicId || '').trim();
  if (!chapterId || !topicId) return null;

  const oldMeshyAssetId = String(sourceData.meshy_asset_id || '').trim();
  let meshyData: admin.firestore.DocumentData | undefined;
  let meshyMissing = false;
  if (oldMeshyAssetId) {
    const meshySnap = await getDb().collection(MESHY_ASSETS_COLLECTION).doc(oldMeshyAssetId).get();
    if (meshySnap.exists) {
      meshyData = meshySnap.data() || {};
    } else {
      meshyMissing = true;
    }
  }

  const reasons: string[] = [];
  const activeUrl = activeGlbUrl(sourceData, meshyData);
  const urlType = classifyUrl(activeUrl);
  const storagePath = getStoragePath(sourceData, meshyData);
  const renderUrl = getRenderUrl(sourceData, meshyData);

  if (!oldMeshyAssetId) reasons.push('missing_meshy_asset_id');
  if (meshyMissing) reasons.push('referenced_meshy_asset_missing');
  if (sourceData.asset_repair_status === 'failed' || meshyData?.asset_repair_status === 'failed') {
    reasons.push('asset_repair_status_failed');
  }
  if (urlType === 'meshy_external') reasons.push('active_meshy_external_url');
  if (urlType === 'external') reasons.push('active_external_url');
  if (urlType === 'firebase_storage' && !renderUrl) reasons.push('direct_firebase_storage_url_without_render_proxy');
  if (!storagePath) reasons.push('missing_firebase_storage_path');
  if (!renderUrl) reasons.push('missing_render_url');
  if (renderUrl && options.healthCheck) {
    const healthy = await healthCheckRenderUrl(renderUrl);
    if (!healthy) reasons.push('render_url_failed_health_check');
  }

  if (reasons.length === 0 && !options.forceInclude) return null;
  if (reasons.length === 0 && options.forceInclude) reasons.push('selected_for_regeneration');

  return {
    id: makeItemId(sourceCollection, sourceDoc.id),
    source_collection: sourceCollection,
    source_asset_id: sourceDoc.id,
    old_meshy_asset_id: oldMeshyAssetId || undefined,
    prompt,
    chapter_id: chapterId,
    topic_id: topicId,
    broken_reasons: [...new Set(reasons)],
    old_url_type: urlType,
    estimated_meshy_task_count: 2,
    legacy_url_snapshot: getLegacyUrlSnapshot(sourceData, meshyData),
  };
}

async function scanBrokenAssets(scope: JobScope): Promise<RegenerationCandidate[]> {
  const db = getDb();
  const normalizedScope = normalizeScope(scope);
  const candidates: RegenerationCandidate[] = [];

  for (const sourceCollection of normalizedScope.sourceCollections || SOURCE_COLLECTIONS) {
    let query: admin.firestore.Query = db.collection(sourceCollection);
    if (normalizedScope.chapterId) {
      query = query.where('chapter_id', '==', normalizedScope.chapterId);
    }
    const snap = await query.limit(normalizedScope.limit || 100).get();
    for (const sourceDoc of snap.docs) {
      const data = sourceDoc.data() || {};
      if (normalizedScope.topicId && String(data.topic_id || data.topicId || '') !== normalizedScope.topicId) {
        continue;
      }
      const candidate = await buildCandidate(sourceCollection, sourceDoc, {
        healthCheck: normalizedScope.healthCheck,
      });
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates;
}

async function getSelectedCandidates(
  selectedItems: SelectedRegenerationItem[],
  healthCheck: boolean
): Promise<RegenerationCandidate[]> {
  const db = getDb();
  const candidates: RegenerationCandidate[] = [];
  for (const selected of selectedItems) {
    if (!SOURCE_COLLECTIONS.includes(selected.sourceCollection)) continue;
    const sourceDoc = await db.collection(selected.sourceCollection).doc(selected.sourceAssetId).get();
    const candidate = await buildCandidate(selected.sourceCollection, sourceDoc, {
      forceInclude: true,
      healthCheck,
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

function initialCounts(candidates: RegenerationCandidate[], dryRun: boolean): Record<string, number> {
  return {
    total: candidates.length,
    scan_result: dryRun ? candidates.length : 0,
    pending: dryRun ? 0 : candidates.length,
    generating_preview: 0,
    refining_texture: 0,
    finalizing: 0,
    replaced: 0,
    failed: 0,
    cancelled: 0,
  };
}

export async function createRegenerationJob(input: CreateRegenerationJobInput): Promise<Record<string, unknown>> {
  const db = getDb();
  const dryRun = input.dryRun === true;
  const scope = normalizeScope(input.scope);
  const settings = normalizeSettings(input.settings);
  const candidates = input.selectedItems?.length
    ? await getSelectedCandidates(input.selectedItems, scope.healthCheck === true)
    : await scanBrokenAssets(scope);
  const jobRef = db.collection(JOBS_COLLECTION).doc();
  const status: JobStatus = dryRun ? 'dry_run' : candidates.length > 0 ? 'queued' : 'completed';
  const batch = db.batch();

  const jobData = cleanForFirestore({
    id: jobRef.id,
    status,
    dry_run: dryRun,
    created_by: input.createdBy || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    completed_at: !dryRun && candidates.length === 0 ? serverTimestamp() : undefined,
    scope,
    settings,
    counts: initialCounts(candidates, dryRun),
  }) as Record<string, unknown>;
  batch.set(jobRef, jobData);

  for (const candidate of candidates) {
    const itemRef = jobRef.collection('items').doc(candidate.id);
    batch.set(itemRef, cleanForFirestore({
      ...candidate,
      status: dryRun ? 'scan_result' : 'pending',
      stage: dryRun ? 'scan_result' : 'pending',
      progress: 0,
      attempt_count: 0,
      created_by: input.createdBy || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }) as Record<string, unknown>);
  }

  await batch.commit();
  return getRegenerationJob(jobRef.id);
}

export async function getRegenerationJob(jobId: string): Promise<Record<string, unknown>> {
  const db = getDb();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new Error(`Regeneration job not found: ${jobId}`);
  const itemsSnap = await jobRef.collection('items').orderBy('created_at', 'asc').limit(250).get();
  return {
    id: jobRef.id,
    ...jobSnap.data(),
    items: itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

async function updateJobCounts(jobRef: admin.firestore.DocumentReference): Promise<Record<string, number>> {
  const itemsSnap = await jobRef.collection('items').get();
  const counts: Record<string, number> = {
    total: itemsSnap.size,
    scan_result: 0,
    pending: 0,
    generating_preview: 0,
    refining_texture: 0,
    finalizing: 0,
    replaced: 0,
    failed: 0,
    cancelled: 0,
  };
  itemsSnap.docs.forEach((doc) => {
    const status = String(doc.data().status || 'pending');
    counts[status] = (counts[status] || 0) + 1;
  });
  await jobRef.set({ counts, updated_at: serverTimestamp() }, { merge: true });
  return counts;
}

export async function cancelRegenerationJob(jobId: string): Promise<Record<string, unknown>> {
  const db = getDb();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const pendingSnap = await jobRef.collection('items').where('status', '==', 'pending').get();
  const batch = db.batch();
  pendingSnap.docs.forEach((doc) => {
    batch.set(doc.ref, {
      status: 'cancelled',
      stage: 'cancelled',
      cancelled_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true });
  });
  batch.set(jobRef, {
    status: 'cancelled',
    cancelled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  await updateJobCounts(jobRef);
  return getRegenerationJob(jobId);
}

export async function retryFailedRegenerationItems(jobId: string): Promise<Record<string, unknown>> {
  const db = getDb();
  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);
  const failedSnap = await jobRef.collection('items').where('status', '==', 'failed').get();
  const batch = db.batch();
  failedSnap.docs.forEach((doc) => {
    batch.set(doc.ref, {
      status: 'pending',
      stage: 'pending',
      progress: 0,
      error: admin.firestore.FieldValue.delete(),
      updated_at: serverTimestamp(),
    }, { merge: true });
  });
  batch.set(jobRef, {
    status: failedSnap.empty ? 'completed_with_errors' : 'queued',
    updated_at: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  await updateJobCounts(jobRef);
  return getRegenerationJob(jobId);
}

function isHumanoidPrompt(prompt: string): boolean {
  return /\b(person|people|human|boy|girl|man|woman|child|teacher|student|character|avatar|doctor|nurse|worker|robot|humanoid)\b/i.test(prompt);
}

async function meshyRequest<T>(
  method: 'get' | 'post',
  endpoint: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const apiKey = getMeshyApiKey();
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await axios.request<T>({
        method,
        url: `${MESHY_API_BASE_URL}${endpoint}`,
        data: payload,
        timeout: method === 'post' ? 60000 : 30000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      if (status === 429 && attempt < 4) {
        const retryAfter = Number(error?.response?.headers?.['retry-after'] || 0);
        await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * (attempt + 1)));
        continue;
      }
      if (status >= 500 && attempt < 4) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw new Error(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Meshy API request failed');
    }
  }
  throw new Error(lastError instanceof Error ? lastError.message : 'Meshy API request failed');
}

async function createPreviewTask(prompt: string, settings: RegenerationSettings): Promise<string> {
  const payload: Record<string, unknown> = {
    mode: 'preview',
    prompt: prompt.trim().slice(0, 600),
    ai_model: settings.aiModel,
    model_type: 'standard',
    topology: 'triangle',
    // Without should_remesh, Meshy ignores target_polycount and returns its raw mesh —
    // this path previously sent neither, so every regenerated asset came back high-poly.
    should_remesh: settings.shouldRemesh,
    target_polycount: settings.targetPolycount,
    target_formats: settings.targetFormats,
    auto_size: settings.autoSize,
    origin_at: settings.originAt,
    moderation: settings.moderation,
  };
  if (isHumanoidPrompt(prompt)) payload.pose_mode = 'a-pose';
  const response = await meshyRequest<MeshyTaskResponse>('post', '/text-to-3d', payload);
  const taskId = String(response.result || response.id || '').trim();
  if (!taskId) throw new Error('Meshy preview task did not return a task ID');
  return taskId;
}

async function createRefineTask(previewTaskId: string, prompt: string, settings: RegenerationSettings): Promise<string> {
  const response = await meshyRequest<MeshyTaskResponse>('post', '/text-to-3d', {
    mode: 'refine',
    preview_task_id: previewTaskId,
    ai_model: settings.aiModel,
    enable_pbr: settings.enablePbr,
    hd_texture: settings.hdTexture,
    remove_lighting: settings.removeLighting,
    texture_prompt: prompt.trim().slice(0, 600),
    target_formats: settings.targetFormats,
    auto_size: settings.autoSize,
    origin_at: settings.originAt,
    moderation: settings.moderation,
  });
  const taskId = String(response.result || response.id || '').trim();
  if (!taskId) throw new Error('Meshy refine task did not return a task ID');
  return taskId;
}

async function pollMeshyTask(
  taskId: string,
  itemRef: admin.firestore.DocumentReference,
  settings: RegenerationSettings,
  stage: ItemStatus,
  progressBase: number,
  progressScale: number
): Promise<MeshyTaskResponse> {
  for (let attempt = 0; attempt < settings.maxPollAttempts; attempt += 1) {
    const task = await meshyRequest<MeshyTaskResponse>('get', `/text-to-3d/${encodeURIComponent(taskId)}`);
    const status = task.status || 'PENDING';
    const taskProgress = Math.max(0, Math.min(Number(task.progress || 0), 100));
    await itemRef.set({
      status: stage,
      stage,
      progress: Math.min(95, progressBase + Math.round((taskProgress / 100) * progressScale)),
      meshy_task_status: status,
      updated_at: serverTimestamp(),
    }, { merge: true });

    if (status === 'SUCCEEDED') return task;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(task.task_error?.message || `Meshy task ${taskId} ended with status ${status}`);
    }
    await sleep(settings.pollIntervalMs);
  }
  throw new Error(`Timed out waiting for Meshy task ${taskId}`);
}

function replaceIdList(list: unknown, oldId: string, newId: string): string[] {
  const ids = Array.isArray(list) ? list.map((value) => String(value)).filter(Boolean) : [];
  let replaced = false;
  const next = ids.map((id) => {
    if (oldId && id === oldId) {
      replaced = true;
      return newId;
    }
    return id;
  });
  if (!replaced && !next.includes(newId)) next.push(newId);
  return next.filter((id, index, array) => array.indexOf(id) === index);
}

async function replaceMeshyAssetInTopic(
  chapterId: string,
  topicId: string,
  oldAssetId: string,
  newAssetId: string
): Promise<boolean> {
  const db = getDb();
  const chapterRef = db.collection('curriculum_chapters').doc(chapterId);
  const chapterSnap = await chapterRef.get();
  if (!chapterSnap.exists) return false;

  const chapter = chapterSnap.data() || {};
  const topics = Array.isArray(chapter.topics) ? [...chapter.topics] : [];
  const topicIndex = topics.findIndex((topic: any) => String(topic?.topic_id || topic?.id || '') === topicId);
  if (topicIndex < 0) return false;

  const topic = topics[topicIndex] || {};
  const sharedAssets = isPlainRecord(topic.sharedAssets) ? topic.sharedAssets : {};
  topics[topicIndex] = {
    ...topic,
    sharedAssets: {
      ...sharedAssets,
      meshy_asset_ids: replaceIdList(sharedAssets.meshy_asset_ids, oldAssetId, newAssetId),
      asset_ids: replaceIdList(sharedAssets.asset_ids, oldAssetId, newAssetId),
    },
    meshy_asset_ids: replaceIdList(topic.meshy_asset_ids, oldAssetId, newAssetId),
    asset_ids: replaceIdList(topic.asset_ids, oldAssetId, newAssetId),
  };

  await chapterRef.update({
    topics,
    updatedAt: serverTimestamp(),
  });
  return true;
}

function staleExternalUrlCleanup(sourceData: admin.firestore.DocumentData): Record<string, unknown> {
  const cleanup: Record<string, unknown> = {};
  ['asset_url', 'final_asset_url', 'textured_model_glb', 'downloadUrl'].forEach((key) => {
    const value = typeof sourceData[key] === 'string' ? sourceData[key] : '';
    if (isMeshyUrl(value) || isExternalModelUrl(value)) {
      cleanup[key] = admin.firestore.FieldValue.delete();
    }
  });
  return cleanup;
}

async function processRegenerationItem(
  jobRef: admin.firestore.DocumentReference,
  itemDoc: admin.firestore.QueryDocumentSnapshot,
  settings: RegenerationSettings
): Promise<void> {
  const db = getDb();
  const itemRef = itemDoc.ref;
  const itemData = itemDoc.data() || {};
  const sourceCollection = itemData.source_collection as SourceCollection;
  const sourceAssetId = String(itemData.source_asset_id || '');
  const oldMeshyAssetId = String(itemData.old_meshy_asset_id || '');
  const prompt = String(itemData.prompt || '').trim();
  const chapterId = String(itemData.chapter_id || '');
  const topicId = String(itemData.topic_id || '');
  const sourceRef = db.collection(sourceCollection).doc(sourceAssetId);

  try {
    await itemRef.set({
      status: 'generating_preview',
      stage: 'generating_preview',
      started_at: itemData.started_at || serverTimestamp(),
      attempt_count: admin.firestore.FieldValue.increment(1),
      progress: 1,
      updated_at: serverTimestamp(),
    }, { merge: true });

    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) throw new Error(`Source asset not found: ${sourceCollection}/${sourceAssetId}`);
    const sourceData = sourceSnap.data() || {};

    const previewTaskId = await createPreviewTask(prompt, settings);
    await itemRef.set({
      meshy_preview_id: previewTaskId,
      updated_at: serverTimestamp(),
    }, { merge: true });
    await pollMeshyTask(previewTaskId, itemRef, settings, 'generating_preview', 5, 40);

    await itemRef.set({
      status: 'refining_texture',
      stage: 'refining_texture',
      progress: 48,
      updated_at: serverTimestamp(),
    }, { merge: true });
    const refineTaskId = await createRefineTask(previewTaskId, prompt, settings);
    await itemRef.set({
      meshy_refine_id: refineTaskId,
      updated_at: serverTimestamp(),
    }, { merge: true });
    const refinedTask = await pollMeshyTask(refineTaskId, itemRef, settings, 'refining_texture', 50, 35);

    if (!refinedTask.model_urls?.glb) {
      throw new Error('Meshy refine task completed without a GLB URL');
    }

    await itemRef.set({
      status: 'finalizing',
      stage: 'finalizing',
      progress: 88,
      updated_at: serverTimestamp(),
    }, { merge: true });

    const finalized = await finalizeGeneratedAsset(
      {} as Request,
      {
        sourceAssetId,
        sourceCollection,
        chapterId,
        topicId,
        prompt,
        name: prompt.slice(0, 100) || 'Regenerated 3D Asset',
        aiModel: settings.aiModel,
        meshyId: refineTaskId,
        meshyPreviewId: previewTaskId,
        modelUrls: refinedTask.model_urls,
        thumbnailUrl: refinedTask.thumbnail_url,
        textureUrls: refinedTask.texture_urls,
        metadata: {
          regeneration_job_id: jobRef.id,
          regenerated_from_meshy_asset_id: oldMeshyAssetId || null,
          broken_reasons: itemData.broken_reasons || [],
          generation_profile: 'meshy-6-pbr-hd-texture',
        },
      },
      String(itemData.created_by || ''),
      settings.apiBaseUrl
    );

    const newMeshyAssetId = String(finalized.id || finalized.asset_id || '');
    if (!newMeshyAssetId) throw new Error('Finalize completed without returning a new meshy asset ID');

    await replaceMeshyAssetInTopic(chapterId, topicId, oldMeshyAssetId, newMeshyAssetId);

    if (oldMeshyAssetId && oldMeshyAssetId !== newMeshyAssetId) {
      await db.collection(MESHY_ASSETS_COLLECTION).doc(oldMeshyAssetId).set({
        active: false,
        status: 'replaced',
        asset_repair_status: 'regenerated',
        replaced_by_meshy_asset_id: newMeshyAssetId,
        replaced_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
    }

    await sourceRef.set(cleanForFirestore({
      ...staleExternalUrlCleanup(sourceData),
      regenerated_from_meshy_asset_id: oldMeshyAssetId || undefined,
      regeneration_job_id: jobRef.id,
      regenerated_at: serverTimestamp(),
      asset_repair_status: 'ready',
      asset_repair_error: admin.firestore.FieldValue.delete(),
      updated_at: serverTimestamp(),
    }) as Record<string, unknown>, { merge: true });

    await itemRef.set({
      status: 'replaced',
      stage: 'replaced',
      progress: 100,
      new_meshy_asset_id: newMeshyAssetId,
      render_url: finalized.render_url,
      storage_path: finalized.storage_path,
      completed_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true });
  } catch (error: any) {
    const message = error?.message || String(error);
    await itemRef.set({
      status: 'failed',
      stage: 'failed',
      error: message,
      failed_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true });
    await sourceRef.set({
      asset_repair_status: 'failed',
      asset_repair_error: message,
      updated_at: serverTimestamp(),
    }, { merge: true });
  }
}

async function finishJobIfIdle(jobRef: admin.firestore.DocumentReference): Promise<void> {
  const itemsSnap = await jobRef.collection('items').get();
  const hasProcessing = itemsSnap.docs.some((doc) => PROCESSING_STATUSES.includes(doc.data().status as ItemStatus));
  const counts = await updateJobCounts(jobRef);
  if (hasProcessing) return;

  const finalStatus: JobStatus = counts.failed > 0
    ? 'completed_with_errors'
    : counts.cancelled > 0 && counts.replaced === 0
      ? 'cancelled'
      : 'completed';
  await jobRef.set({
    status: finalStatus,
    completed_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
}

async function processJob(jobRef: admin.firestore.DocumentReference): Promise<void> {
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) return;
  const jobData = jobSnap.data() || {};
  if (jobData.status !== 'queued' && jobData.status !== 'running') return;
  const settings = normalizeSettings(jobData.settings as Partial<RegenerationSettings>);

  await jobRef.set({
    status: 'running',
    started_at: jobData.started_at || serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });

  const pendingSnap = await jobRef
    .collection('items')
    .where('status', '==', 'pending')
    .limit(settings.concurrency)
    .get();

  if (pendingSnap.empty) {
    await finishJobIfIdle(jobRef);
    return;
  }

  await Promise.all(pendingSnap.docs.map((itemDoc) => processRegenerationItem(jobRef, itemDoc, settings)));
  await finishJobIfIdle(jobRef);
}

export async function processMeshyRegenerationJobs(maxJobs = 1): Promise<Record<string, unknown>> {
  initializeAdmin();
  initializeServices();
  const db = getDb();
  const jobsSnap = await db
    .collection(JOBS_COLLECTION)
    .where('status', 'in', ['queued', 'running'])
    .limit(Math.max(1, Math.min(maxJobs, 3)))
    .get();

  for (const jobDoc of jobsSnap.docs) {
    await processJob(jobDoc.ref);
  }

  return {
    processedJobs: jobsSnap.size,
  };
}
