import * as admin from 'firebase-admin';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { initializeAdmin } from '../utils/services';

const COLLECTION = 'n8n_lesson_builder_jobs';
const MAX_RESPONSE_PREVIEW = 4000;
const STALE_STARTING_MS = 5 * 60 * 1000;

export type LessonBuilderJobStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export interface LessonBuilderStoredFile {
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

export interface LessonBuilderJob {
  id: string;
  userId: string;
  userEmail?: string | null;
  webhookUrl: string;
  file: LessonBuilderStoredFile;
  prompt: string;
  language: string;
  curriculum: string;
  classLevel: string;
  subject: string;
  status: LessonBuilderJobStatus;
  queueOrder: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  executionId?: string | null;
  httpStatus?: number | null;
  responsePreview?: string | null;
  errorMessage?: string | null;
}

interface QueueJobInput {
  webhookUrl: string;
  file: LessonBuilderStoredFile;
  prompt: string;
  language: string;
  curriculum?: string;
  classLevel?: string;
  subject?: string;
}

interface ExecutionResult {
  status: 'running' | 'success' | 'error';
  finished: boolean;
  raw: unknown;
}

function getDb() {
  initializeAdmin();
  return admin.firestore();
}

function getBucket() {
  initializeAdmin();
  return admin.storage().bucket();
}

function nowIso() {
  return new Date().toISOString();
}

function toPreview(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, MAX_RESPONSE_PREVIEW);
  try {
    return JSON.stringify(value, null, 2).slice(0, MAX_RESPONSE_PREVIEW);
  } catch {
    return String(value).slice(0, MAX_RESPONSE_PREVIEW);
  }
}

function mapJob(doc: QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): LessonBuilderJob | null {
  const data = doc.data();
  if (!data) return null;

  return {
    id: doc.id,
    userId: String(data.userId ?? ''),
    userEmail: (data.userEmail as string | null | undefined) ?? null,
    webhookUrl: String(data.webhookUrl ?? ''),
    file: {
      storagePath: String(data.file?.storagePath ?? ''),
      fileName: String(data.file?.fileName ?? ''),
      sizeBytes: Number(data.file?.sizeBytes ?? 0),
      contentType: String(data.file?.contentType ?? 'application/pdf'),
    },
    prompt: String(data.prompt ?? ''),
    language: String(data.language ?? ''),
    curriculum: String(data.curriculum ?? ''),
    classLevel: String(data.classLevel ?? ''),
    subject: String(data.subject ?? ''),
    status: (data.status as LessonBuilderJobStatus) ?? 'queued',
    queueOrder: Number(data.queueOrder ?? 0),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    startedAt: (data.startedAt as string | null | undefined) ?? null,
    finishedAt: (data.finishedAt as string | null | undefined) ?? null,
    executionId: (data.executionId as string | null | undefined) ?? null,
    httpStatus: (data.httpStatus as number | null | undefined) ?? null,
    responsePreview: (data.responsePreview as string | null | undefined) ?? null,
    errorMessage: (data.errorMessage as string | null | undefined) ?? null,
  };
}

function sortAscending(jobs: LessonBuilderJob[]) {
  return [...jobs].sort((a, b) => {
    if (a.queueOrder !== b.queueOrder) return a.queueOrder - b.queueOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function sortJobsForDisplay(jobs: LessonBuilderJob[]) {
  return [...jobs].sort((a, b) => {
    if (a.queueOrder !== b.queueOrder) return b.queueOrder - a.queueOrder;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

async function listUserJobDocs(userId: string) {
  const snapshot = await getDb().collection(COLLECTION).where('userId', '==', userId).get();
  return snapshot.docs.map((doc) => mapJob(doc)).filter((job): job is LessonBuilderJob => Boolean(job));
}

export async function listJobsForUser(userId: string, limit = 50) {
  const jobs = await listUserJobDocs(userId);
  return sortJobsForDisplay(jobs).slice(0, limit);
}

export async function enqueueJobsForUser(
  userId: string,
  userEmail: string | null | undefined,
  items: QueueJobInput[],
) {
  if (!items.length) return [];

  const db = getDb();
  const existing = await listUserJobDocs(userId);
  const maxQueueOrder = existing.reduce((max, job) => Math.max(max, job.queueOrder), 0);
  const batch = db.batch();
  const created: LessonBuilderJob[] = [];
  const createdAt = nowIso();

  items.forEach((item, index) => {
    const docRef = db.collection(COLLECTION).doc();
    const queueOrder = maxQueueOrder + index + 1;
    const job: LessonBuilderJob = {
      id: docRef.id,
      userId,
      userEmail: userEmail ?? null,
      webhookUrl: item.webhookUrl,
      file: item.file,
      prompt: item.prompt,
      language: item.language,
      curriculum: item.curriculum ?? '',
      classLevel: item.classLevel ?? '',
      subject: item.subject ?? '',
      status: 'queued',
      queueOrder,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      finishedAt: null,
      executionId: null,
      httpStatus: null,
      responsePreview: null,
      errorMessage: null,
    };
    batch.set(docRef, job);
    created.push(job);
  });

  await batch.commit();
  return sortJobsForDisplay(created);
}

export async function cancelQueuedJob(userId: string, jobId: string) {
  const ref = getDb().collection(COLLECTION).doc(jobId);
  const snap = await ref.get();
  const job = mapJob(snap);
  if (!job || job.userId !== userId) {
    throw new Error('Queue item not found.');
  }
  if (job.status !== 'queued') {
    throw new Error('Only queued items can be cancelled.');
  }

  await ref.update({
    status: 'cancelled',
    updatedAt: nowIso(),
    finishedAt: nowIso(),
    errorMessage: 'Cancelled before processing.',
  });
}

async function fetchExecutionResult(executionId: string): Promise<ExecutionResult | null> {
  const n8nApiUrl = process.env.N8N_API_URL;
  const n8nApiKey = process.env.N8N_API_KEY;
  if (!n8nApiUrl || !n8nApiKey) return null;

  const url = `${n8nApiUrl.replace(/\/$/, '')}/api/v1/executions/${encodeURIComponent(executionId)}?includeData=true`;
  const response = await fetch(url, {
    headers: { 'X-N8N-API-KEY': n8nApiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch execution ${executionId}: ${response.status}`);
  }

  const raw = (await response.json()) as { status?: 'running' | 'success' | 'error'; finished?: boolean };
  const status = raw.status ?? 'running';

  return {
    status,
    finished: Boolean(raw.finished),
    raw,
  };
}

async function markJobStatus(
  jobId: string,
  patch: Partial<LessonBuilderJob>,
) {
  await getDb()
    .collection(COLLECTION)
    .doc(jobId)
    .update({
      ...patch,
      updatedAt: nowIso(),
    });
}

async function startClaimedJob(job: LessonBuilderJob) {
  const bucket = getBucket();
  const [buffer] = await bucket.file(job.file.storagePath).download();

  const body = new FormData();
  body.append(
    'file',
    new Blob([buffer], { type: job.file.contentType || 'application/pdf' }),
    job.file.fileName,
  );
  body.append('prompt', job.prompt);
  body.append('language', job.language);
  body.append('curriculum', job.curriculum);
  body.append('class', job.classLevel);
  body.append('subject', job.subject);

  const response = await fetch(job.webhookUrl, {
    method: 'POST',
    body,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const executionId =
    payload && typeof payload === 'object' && typeof (payload as { executionId?: unknown }).executionId === 'string'
      ? String((payload as { executionId: string }).executionId)
      : null;

  if (!response.ok) {
    await markJobStatus(job.id, {
      status: 'error',
      finishedAt: nowIso(),
      httpStatus: response.status,
      responsePreview: toPreview(payload),
      errorMessage:
        payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
          ? String((payload as { message: string }).message)
          : `Request failed with status ${response.status}`,
    });
    return;
  }

  await markJobStatus(job.id, {
    status: executionId ? 'running' : 'success',
    executionId,
    httpStatus: response.status,
    responsePreview: toPreview(payload),
    errorMessage: null,
    ...(executionId ? {} : { finishedAt: nowIso() }),
  });
}

async function claimNextQueuedJob(userId: string): Promise<LessonBuilderJob | null> {
  const db = getDb();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(
      db.collection(COLLECTION).where('userId', '==', userId),
    );
    const jobs = snapshot.docs
      .map((doc) => mapJob(doc))
      .filter((job): job is LessonBuilderJob => Boolean(job));
    const ordered = sortAscending(jobs);
    const hasActive = ordered.some((job) => job.status === 'starting' || job.status === 'running');
    if (hasActive) return null;

    const nextJob = ordered.find((job) => job.status === 'queued');
    if (!nextJob) return null;

    transaction.update(db.collection(COLLECTION).doc(nextJob.id), {
      status: 'starting',
      startedAt: nowIso(),
      updatedAt: nowIso(),
      errorMessage: null,
      finishedAt: null,
    });

    return { ...nextJob, status: 'starting', startedAt: nowIso(), updatedAt: nowIso() };
  });
}

async function syncRunningJob(job: LessonBuilderJob) {
  if (job.status === 'starting') {
    const age = Date.now() - new Date(job.updatedAt).getTime();
    if (age > STALE_STARTING_MS) {
      await markJobStatus(job.id, {
        status: 'error',
        finishedAt: nowIso(),
        errorMessage: 'Queue item got stuck before the workflow could start.',
      });
    }
    return;
  }

  if (!job.executionId) {
    await markJobStatus(job.id, {
      status: 'error',
      finishedAt: nowIso(),
      errorMessage: 'Missing execution id for running queue item.',
    });
    return;
  }

  const execution = await fetchExecutionResult(job.executionId);
  if (!execution) return;
  if (!execution.finished) return;

  await markJobStatus(job.id, {
    status: execution.status === 'error' ? 'error' : 'success',
    finishedAt: nowIso(),
    responsePreview: toPreview(execution.raw),
    errorMessage:
      execution.status === 'error'
        ? 'The n8n workflow finished with an error.'
        : null,
  });
}

export async function syncUserQueue(userId: string) {
  const jobs = sortAscending(await listUserJobDocs(userId));
  const active = jobs.find((job) => job.status === 'starting' || job.status === 'running');

  if (active) {
    await syncRunningJob(active);
    const refreshed = sortAscending(await listUserJobDocs(userId));
    const stillActive = refreshed.find((job) => job.status === 'starting' || job.status === 'running');
    if (stillActive) {
      return sortJobsForDisplay(refreshed);
    }
  }

  const claimed = await claimNextQueuedJob(userId);
  if (claimed) {
    try {
      await startClaimedJob(claimed);
    } catch (error) {
      await markJobStatus(claimed.id, {
        status: 'error',
        finishedAt: nowIso(),
        errorMessage: error instanceof Error ? error.message : 'Failed to start queue item.',
      });
    }
  }

  return listJobsForUser(userId);
}

export async function syncAllQueues() {
  const snapshot = await getDb()
    .collection(COLLECTION)
    .where('status', 'in', ['queued', 'starting', 'running'])
    .get();

  const jobs = snapshot.docs
    .map((doc) => mapJob(doc))
    .filter((job): job is LessonBuilderJob => Boolean(job));

  const uniqueUserIds = [...new Set(jobs.map((job) => job.userId).filter(Boolean))];
  for (const userId of uniqueUserIds) {
    await syncUserQueue(userId);
  }
}
