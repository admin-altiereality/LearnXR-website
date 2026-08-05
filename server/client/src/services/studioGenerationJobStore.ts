/**
 * Studio 3D generation job manager.
 *
 * Keeps Meshy / Trellis jobs alive across Assets tab unmounts (section switches)
 * and restores UI state from sessionStorage when the panel remounts.
 */

import { textTo3dGenerationService, type GenerationProgress } from '../services/textTo3dGenerationService';
import {
  trellisImageTo3dService,
  type TrellisGeneration,
  type TrellisGenerationStatus,
} from '../services/trellisImageTo3dService';

const STORAGE_KEY = 'learnxr.studio.generationJobs.v1';
const UI_STORAGE_KEY = 'learnxr.studio.generationUi.v1';

export type TrellisPhase = 'uploading' | 'queued' | 'running' | 'finalizing' | 'success' | 'error';
export type MeshySource = 'text_to_3d' | 'avatar_to_3d';

export interface TrellisJobSnapshot {
  provider: 'trellis';
  key: string;
  jobId: string;
  chapterId: string;
  topicId: string;
  userId: string;
  assetName: string;
  sourceFileName: string;
  decimationTarget: number;
  textureSize: number;
  phase: TrellisPhase;
  status?: TrellisGenerationStatus;
  error?: string;
  updatedAt: number;
}

export interface MeshyJobSnapshot {
  provider: 'meshy';
  key: string;
  assetId: string;
  chapterId: string;
  topicId: string;
  source: MeshySource;
  prompt: string;
  userId: string;
  phase: GenerationProgress['stage'];
  progress: number;
  message: string;
  error?: string;
  meshyAssetId?: string;
  updatedAt: number;
}

export type StudioGenerationJob = TrellisJobSnapshot | MeshyJobSnapshot;

export interface StudioGenerationUiPrefs {
  chapterId: string;
  topicId: string;
  showPanel: boolean;
  provider: 'meshy' | 'trellis';
  updatedAt: number;
}

type JobListener = (job: StudioGenerationJob | null) => void;

function trellisKey(chapterId: string, topicId: string): string {
  return `trellis:${chapterId}:${topicId}`;
}

function meshyKey(chapterId: string, topicId: string, assetId: string): string {
  return `meshy:${chapterId}:${topicId}:${assetId}`;
}

function uiKey(chapterId: string, topicId: string): string {
  return `${chapterId}:${topicId}`;
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode failures
  }
}

class StudioGenerationJobManager {
  private jobs = new Map<string, StudioGenerationJob>();
  private listeners = new Map<string, Set<JobListener>>();
  private running = new Set<string>();
  private uiPrefs = new Map<string, StudioGenerationUiPrefs>();

  constructor() {
    const stored = readStorage<Record<string, StudioGenerationJob>>(STORAGE_KEY);
    if (stored) {
      Object.entries(stored).forEach(([key, job]) => {
        if (job && typeof job === 'object') this.jobs.set(key, job);
      });
    }
    const storedUi = readStorage<Record<string, StudioGenerationUiPrefs>>(UI_STORAGE_KEY);
    if (storedUi) {
      Object.entries(storedUi).forEach(([key, prefs]) => {
        if (prefs && typeof prefs === 'object') this.uiPrefs.set(key, prefs);
      });
    }
  }

  private persist(): void {
    const payload: Record<string, StudioGenerationJob> = {};
    this.jobs.forEach((job, key) => {
      payload[key] = job;
    });
    writeStorage(STORAGE_KEY, payload);
  }

  private persistUi(): void {
    const payload: Record<string, StudioGenerationUiPrefs> = {};
    this.uiPrefs.forEach((prefs, key) => {
      payload[key] = prefs;
    });
    writeStorage(UI_STORAGE_KEY, payload);
  }

  private emit(key: string): void {
    const job = this.jobs.get(key) || null;
    const set = this.listeners.get(key);
    if (!set) return;
    set.forEach((listener) => listener(job));
  }

  private setJob(job: StudioGenerationJob): void {
    this.jobs.set(job.key, { ...job, updatedAt: Date.now() });
    this.persist();
    this.emit(job.key);
  }

  getJob(key: string): StudioGenerationJob | null {
    return this.jobs.get(key) || null;
  }

  getTrellisJob(chapterId: string, topicId: string): TrellisJobSnapshot | null {
    const job = this.jobs.get(trellisKey(chapterId, topicId));
    return job?.provider === 'trellis' ? job : null;
  }

  listMeshyJobs(chapterId: string, topicId: string): MeshyJobSnapshot[] {
    const prefix = `meshy:${chapterId}:${topicId}:`;
    const jobs: MeshyJobSnapshot[] = [];
    this.jobs.forEach((job) => {
      if (job.provider === 'meshy' && job.key.startsWith(prefix)) jobs.push(job);
    });
    return jobs;
  }

  subscribe(key: string, listener: JobListener): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);
    listener(this.jobs.get(key) || null);
    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  clearJob(key: string): void {
    this.jobs.delete(key);
    this.running.delete(key);
    this.persist();
    this.emit(key);
  }

  getUiPrefs(chapterId: string, topicId: string): StudioGenerationUiPrefs | null {
    return this.uiPrefs.get(uiKey(chapterId, topicId)) || null;
  }

  setUiPrefs(prefs: Omit<StudioGenerationUiPrefs, 'updatedAt'>): void {
    const key = uiKey(prefs.chapterId, prefs.topicId);
    this.uiPrefs.set(key, { ...prefs, updatedAt: Date.now() });
    this.persistUi();
  }

  async startTrellisJob(input: {
    chapterId: string;
    topicId: string;
    userId: string;
    image: File;
    assetName: string;
    sourceFileName: string;
    decimationTarget: number;
    textureSize: number;
  }): Promise<TrellisJobSnapshot> {
    const key = trellisKey(input.chapterId, input.topicId);
    if (this.running.has(key)) {
      const existing = this.getTrellisJob(input.chapterId, input.topicId);
      if (existing) return existing;
    }

    this.running.add(key);
    this.setJob({
      provider: 'trellis',
      key,
      jobId: '',
      chapterId: input.chapterId,
      topicId: input.topicId,
      userId: input.userId,
      assetName: input.assetName,
      sourceFileName: input.sourceFileName,
      decimationTarget: input.decimationTarget,
      textureSize: input.textureSize,
      phase: 'uploading',
      updatedAt: Date.now(),
    });

    try {
      const created = await trellisImageTo3dService.createGeneration({
        image: input.image,
        decimationTarget: input.decimationTarget,
        textureSize: input.textureSize,
      });

      this.setJob({
        provider: 'trellis',
        key,
        jobId: created.id,
        chapterId: input.chapterId,
        topicId: input.topicId,
        userId: input.userId,
        assetName: input.assetName,
        sourceFileName: input.sourceFileName,
        decimationTarget: input.decimationTarget,
        textureSize: input.textureSize,
        phase: created.status === 'queued' ? 'queued' : 'running',
        status: created.status,
        updatedAt: Date.now(),
      });

      await this.resumeTrellisJob(key);
      return this.getTrellisJob(input.chapterId, input.topicId)!;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Trellis 2 generation failed';
      this.setJob({
        provider: 'trellis',
        key,
        jobId: this.getTrellisJob(input.chapterId, input.topicId)?.jobId || '',
        chapterId: input.chapterId,
        topicId: input.topicId,
        userId: input.userId,
        assetName: input.assetName,
        sourceFileName: input.sourceFileName,
        decimationTarget: input.decimationTarget,
        textureSize: input.textureSize,
        phase: 'error',
        error: message,
        updatedAt: Date.now(),
      });
      this.running.delete(key);
      throw error;
    }
  }

  async resumeTrellisJob(key: string): Promise<void> {
    const current = this.jobs.get(key);
    if (!current || current.provider !== 'trellis') return;
    if (!current.jobId) return;
    if (current.phase === 'success') return;
    if (current.phase === 'error') {
      const timedOut = (current.error || '').toLowerCase().includes('timed out');
      if (!timedOut) return;
      // Clear recoverable timeout so UI returns to generating while we keep polling.
      this.setJob({
        ...current,
        phase: 'running',
        error: undefined,
        updatedAt: Date.now(),
      });
    }
    if (this.running.has(`${key}:poll`)) return;
    this.running.add(`${key}:poll`);
    this.running.add(key);

    try {
      const completed = await trellisImageTo3dService.pollForCompletion(current.jobId, (generation) => {
        const latest = this.jobs.get(key);
        if (!latest || latest.provider !== 'trellis') return;
        this.setJob({
          ...latest,
          phase: generation.status === 'queued' ? 'queued' : 'running',
          status: generation.status,
        });
      });

      const latest = this.jobs.get(key);
      if (!latest || latest.provider !== 'trellis') return;

      this.setJob({ ...latest, phase: 'finalizing', status: completed.status });

      await trellisImageTo3dService.finalizeGeneration({
        jobId: completed.id,
        chapterId: latest.chapterId,
        topicId: latest.topicId,
        userId: latest.userId,
        name: latest.assetName,
        sourceFileName: latest.sourceFileName,
        decimationTarget: latest.decimationTarget,
        textureSize: latest.textureSize,
      });

      this.setJob({
        ...latest,
        phase: 'success',
        status: 'succeeded',
        error: undefined,
      });
    } catch (error) {
      const latest = this.jobs.get(key);
      if (!latest || latest.provider !== 'trellis') return;
      this.setJob({
        ...latest,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Trellis 2 generation failed',
      });
    } finally {
      this.running.delete(`${key}:poll`);
      this.running.delete(key);
    }
  }

  ensureTrellisResumed(chapterId: string, topicId: string): void {
    const job = this.getTrellisJob(chapterId, topicId);
    if (!job) return;
    if (!job.jobId) return;
    if (job.phase === 'success' || job.phase === 'uploading') return;
    // Client-side poll timeout is recoverable — resume waiting for the same job id.
    if (job.phase === 'error') {
      const timedOut = (job.error || '').toLowerCase().includes('timed out');
      if (!timedOut) return;
    }
    void this.resumeTrellisJob(job.key);
  }

  async startMeshyJob(input: {
    assetId: string;
    chapterId: string;
    topicId: string;
    source: MeshySource;
    prompt: string;
    userId: string;
    collectionName: 'text_to_3d_assets' | 'avatar_to_3d_assets';
  }): Promise<{ success: boolean; meshyAssetId?: string; error?: string }> {
    const key = meshyKey(input.chapterId, input.topicId, input.assetId);
    if (this.running.has(key)) {
      const existing = this.jobs.get(key);
      if (existing?.provider === 'meshy' && !['completed', 'failed'].includes(existing.phase)) {
        return { success: false, error: 'Generation already in progress' };
      }
    }

    this.running.add(key);
    this.setJob({
      provider: 'meshy',
      key,
      assetId: input.assetId,
      chapterId: input.chapterId,
      topicId: input.topicId,
      source: input.source,
      prompt: input.prompt,
      userId: input.userId,
      phase: 'generating',
      progress: 0,
      message: 'Starting...',
      updatedAt: Date.now(),
    });

    try {
      const result = await textTo3dGenerationService.generateFromApprovedAsset(
        {
          textTo3dAssetId: input.assetId,
          prompt: input.prompt,
          chapterId: input.chapterId,
          topicId: input.topicId,
          userId: input.userId,
          artStyle: 'realistic',
          aiModel: 'meshy-6',
          collectionName: input.collectionName,
        },
        (progress) => {
          const latest = this.jobs.get(key);
          if (!latest || latest.provider !== 'meshy') return;
          this.setJob({
            ...latest,
            phase: progress.stage,
            progress: progress.progress,
            message: progress.message,
            error: progress.error,
          });
        }
      );

      const latest = this.jobs.get(key);
      if (latest?.provider === 'meshy') {
        if (result.success) {
          this.setJob({
            ...latest,
            phase: 'completed',
            progress: 100,
            message: 'Asset generated and ready!',
            meshyAssetId: result.meshyAssetId,
            error: undefined,
          });
        } else {
          this.setJob({
            ...latest,
            phase: 'failed',
            progress: latest.progress,
            message: 'Generation failed',
            error: result.error || 'Generation failed',
          });
        }
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const latest = this.jobs.get(key);
      if (latest?.provider === 'meshy') {
        this.setJob({
          ...latest,
          phase: 'failed',
          message: 'Generation failed',
          error: message,
        });
      }
      return { success: false, error: message };
    } finally {
      this.running.delete(key);
    }
  }

  isMeshyRunning(chapterId: string, topicId: string, assetId: string): boolean {
    const key = meshyKey(chapterId, topicId, assetId);
    const job = this.jobs.get(key);
    if (!job || job.provider !== 'meshy') return false;
    return !['completed', 'failed'].includes(job.phase) || this.running.has(key);
  }

  getMeshyProgress(chapterId: string, topicId: string, assetId: string): GenerationProgress | null {
    const job = this.jobs.get(meshyKey(chapterId, topicId, assetId));
    if (!job || job.provider !== 'meshy') return null;
    return {
      stage: job.phase,
      progress: job.progress,
      message: job.message,
      error: job.error,
    };
  }
}

export const studioGenerationJobManager = new StudioGenerationJobManager();

export const studioGenerationKeys = {
  trellis: trellisKey,
  meshy: meshyKey,
};

export function trellisGenerationToUi(job: TrellisJobSnapshot | null): {
  runState: TrellisPhase | 'idle';
  currentJob: TrellisGeneration | null;
  errorMessage: string | null;
  assetName: string;
  sourceFileName: string;
  decimationTarget: number;
  textureSize: number;
} {
  if (!job) {
    return {
      runState: 'idle',
      currentJob: null,
      errorMessage: null,
      assetName: '',
      sourceFileName: '',
      decimationTarget: 300000,
      textureSize: 1024,
    };
  }

  return {
    runState: job.phase,
    currentJob: job.jobId
      ? {
          id: job.jobId,
          status: job.status || (job.phase === 'queued' ? 'queued' : job.phase === 'success' ? 'succeeded' : 'running'),
        }
      : null,
    errorMessage: job.error || null,
    assetName: job.assetName,
    sourceFileName: job.sourceFileName,
    decimationTarget: job.decimationTarget,
    textureSize: job.textureSize,
  };
}
