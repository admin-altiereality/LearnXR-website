import { ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../config/firebase';
import { getApiBaseUrl } from '../utils/apiConfig';

export type LessonBuilderQueueStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled';

export interface LessonBuilderQueueJob {
  id: string;
  userId: string;
  userEmail?: string | null;
  webhookUrl: string;
  file: {
    storagePath: string;
    fileName: string;
    sizeBytes: number;
    contentType: string;
  };
  prompt: string;
  language: string;
  curriculum: string;
  classLevel: string;
  subject: string;
  status: LessonBuilderQueueStatus;
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

interface QueueApiResponse {
  jobs: LessonBuilderQueueJob[];
}

interface QueueUploadItem {
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

interface EnqueueJobsInput {
  files: File[];
  webhookUrl: string;
  prompt: string;
  language: string;
  curriculum: string;
  classLevel: string;
  subject: string;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '-');
}

async function getAuthHeaders(includeJson = true): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl().replace(/\/$/, '')}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string'
        ? String((payload as { message: string }).message)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function uploadFileToStorage(file: File): Promise<QueueUploadItem> {
  if (!storage || !auth.currentUser) {
    throw new Error('Storage is not available for queue uploads.');
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `n8n-builder/${auth.currentUser.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/pdf',
    customMetadata: {
      originalFileName: file.name,
      uploadedBy: auth.currentUser.uid,
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    storagePath,
    fileName: file.name,
    sizeBytes: file.size,
    contentType: file.type || 'application/pdf',
  };
}

export async function listLessonBuilderQueueJobs() {
  const headers = await getAuthHeaders(false);
  const data = await request<QueueApiResponse>('/n8n-builder/jobs', { headers });
  return data.jobs;
}

export async function refreshLessonBuilderQueue() {
  const headers = await getAuthHeaders(true);
  const data = await request<QueueApiResponse>('/n8n-builder/refresh', {
    method: 'POST',
    headers,
  });
  return data.jobs;
}

export async function cancelLessonBuilderQueueJob(jobId: string) {
  const headers = await getAuthHeaders(true);
  const data = await request<QueueApiResponse>(`/n8n-builder/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    headers,
  });
  return data.jobs;
}

export async function enqueueLessonBuilderJobs(input: EnqueueJobsInput) {
  if (!auth.currentUser) {
    throw new Error('Please sign in to queue lesson builds.');
  }

  const uploadedItems: QueueUploadItem[] = [];
  for (const file of input.files) {
    uploadedItems.push(await uploadFileToStorage(file));
  }

  const headers = await getAuthHeaders(true);
  const payload = await request<QueueApiResponse>('/n8n-builder/jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: uploadedItems,
      webhookUrl: input.webhookUrl,
      prompt: input.prompt,
      language: input.language,
      curriculum: input.curriculum,
      classLevel: input.classLevel,
      subject: input.subject,
    }),
  });

  return payload.jobs;
}
