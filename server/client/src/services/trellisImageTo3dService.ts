import api from '../config/axios';
import type { PersistedAssetResponse } from './meshyApiService';

export type TrellisGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface TrellisGeneration {
  id: string;
  status: TrellisGenerationStatus;
  created_at?: string;
  decimation_target?: number;
  texture_size?: number;
  [key: string]: unknown;
}

export interface TrellisCreateOptions {
  image: File;
  decimationTarget?: number;
  textureSize?: number;
}

export interface TrellisFinalizeOptions {
  jobId: string;
  chapterId: string;
  topicId: string;
  userId: string;
  name: string;
  sourceFileName: string;
  decimationTarget: number;
  textureSize: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

const DEFAULT_DECIMATION_TARGET = 300000;
const DEFAULT_TEXTURE_SIZE = 1024;
/** Trellis image-to-3D often exceeds 10 minutes under load. */
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 360; // ~30 minutes of waiting (+ request latency)

function unwrapResponse<T>(payload: ApiEnvelope<T> | T): T {
  const envelope = payload as ApiEnvelope<T>;
  if (envelope && typeof envelope === 'object' && 'success' in envelope) {
    if (envelope.success === false) {
      throw new Error(envelope.message || envelope.error || 'Trellis request failed');
    }
    if (envelope.data !== undefined) return envelope.data;
  }
  return payload as T;
}

function pickRawStatus(payload: Record<string, unknown>): unknown {
  const nested = payload.data && typeof payload.data === 'object'
    ? (payload.data as Record<string, unknown>)
    : undefined;
  return (
    payload.status
    ?? payload.state
    ?? payload.phase
    ?? payload.job_status
    ?? nested?.status
    ?? nested?.state
    ?? nested?.phase
  );
}

function hasReadyOutput(payload: Record<string, unknown>): boolean {
  const modelUrls = payload.model_urls;
  if (modelUrls && typeof modelUrls === 'object') {
    const glb = (modelUrls as Record<string, unknown>).glb;
    if (typeof glb === 'string' && glb.trim()) return true;
  }
  for (const key of ['output_url', 'glb_url', 'asset_url', 'url'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return true;
  }
  return false;
}

export function normalizeTrellisStatus(
  raw: unknown,
  payload?: Record<string, unknown>
): TrellisGenerationStatus {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  if (['succeeded', 'success', 'completed', 'complete', 'finished', 'done', 'ready'].includes(value)) {
    return 'succeeded';
  }
  if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(value)) {
    return 'failed';
  }
  if (['queued', 'pending', 'backlogged', 'scheduled', 'created', 'submitted', 'waiting'].includes(value)) {
    return 'queued';
  }
  if (
    ['running', 'processing', 'in-progress', 'inprogress', 'generating', 'sampling', 'started', 'active'].includes(value)
  ) {
    return 'running';
  }
  if (payload && hasReadyOutput(payload)) return 'succeeded';
  return value ? 'running' : 'queued';
}

function normalizeGeneration(payload: TrellisGeneration | Record<string, unknown>): TrellisGeneration {
  const record = payload as Record<string, unknown>;
  const id = String(record.id || record.job_id || record.generation_id || '').trim();
  return {
    ...record,
    id,
    status: normalizeTrellisStatus(pickRawStatus(record), record),
  };
}

function validateImageFile(image: File): void {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const extension = image.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';

  if (!allowedTypes.includes(image.type) || !allowedExtensions.includes(extension)) {
    throw new Error('Upload a PNG, JPG, JPEG, or WebP image for Trellis 2 generation.');
  }
  if (image.size <= 0 || image.size > 12 * 1024 * 1024) {
    throw new Error('Image must be smaller than 12 MB.');
  }
}

class TrellisImageTo3dService {
  async createGeneration(options: TrellisCreateOptions): Promise<TrellisGeneration> {
    validateImageFile(options.image);

    const form = new FormData();
    form.append('image', options.image);
    form.append('decimation_target', String(options.decimationTarget || DEFAULT_DECIMATION_TARGET));
    form.append('texture_size', String(options.textureSize || DEFAULT_TEXTURE_SIZE));

    const response = await api.post('/trellis/generations', form);
    return normalizeGeneration(unwrapResponse<TrellisGeneration>(response.data));
  }

  async getGeneration(jobId: string): Promise<TrellisGeneration> {
    const response = await api.get(`/trellis/generations/${encodeURIComponent(jobId)}`);
    return normalizeGeneration(unwrapResponse<TrellisGeneration>(response.data));
  }

  async pollForCompletion(
    jobId: string,
    onProgress?: (generation: TrellisGeneration, attempt: number) => void
  ): Promise<TrellisGeneration> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const generation = await this.getGeneration(jobId);
      onProgress?.(generation, attempt + 1);

      if (generation.status === 'succeeded') return generation;
      if (generation.status === 'failed') {
        throw new Error('Trellis 2 generation failed.');
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(
      `Trellis 2 generation timed out after ~${Math.round((MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 60000)} minutes. Job ${jobId} may still be running — leave this panel open and retry shortly.`
    );
  }

  async finalizeGeneration(options: TrellisFinalizeOptions): Promise<PersistedAssetResponse> {
    const response = await api.post(`/trellis/generations/${encodeURIComponent(options.jobId)}/finalize`, {
      chapterId: options.chapterId,
      topicId: options.topicId,
      userId: options.userId,
      name: options.name,
      sourceFileName: options.sourceFileName,
      decimationTarget: options.decimationTarget,
      textureSize: options.textureSize,
    });

    const data = unwrapResponse<PersistedAssetResponse | TrellisGeneration>(response.data);
    const record = data as Record<string, unknown>;
    const looksPersisted = Boolean(
      record.asset_id
      || record.renderUrl
      || record.render_url
      || (record.model_urls && typeof record.model_urls === 'object')
    );
    if (looksPersisted) return data as PersistedAssetResponse;

    const maybeGeneration = normalizeGeneration(record);
    if (maybeGeneration.status !== 'succeeded') {
      throw new Error(`Trellis 2 generation is still ${maybeGeneration.status}.`);
    }
    return data as PersistedAssetResponse;
  }
}

export const trellisImageTo3dService = new TrellisImageTo3dService();
