import { auth } from '../config/firebase';

export type MeshyRegenerationSourceCollection = 'text_to_3d_assets' | 'avatar_to_3d_assets';

export type MeshyRegenerationJobStatus =
  | 'dry_run'
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'cancelled'
  | 'failed';

export type MeshyRegenerationItemStatus =
  | 'scan_result'
  | 'pending'
  | 'generating_preview'
  | 'refining_texture'
  | 'finalizing'
  | 'replaced'
  | 'failed'
  | 'cancelled';

export interface MeshyRegenerationScope {
  chapterId?: string;
  topicId?: string;
  sourceCollections?: MeshyRegenerationSourceCollection[];
  limit?: number;
  healthCheck?: boolean;
}

export interface MeshyRegenerationSelectedItem {
  sourceCollection: MeshyRegenerationSourceCollection;
  sourceAssetId: string;
}

export interface MeshyRegenerationCounts {
  total?: number;
  scan_result?: number;
  pending?: number;
  generating_preview?: number;
  refining_texture?: number;
  finalizing?: number;
  replaced?: number;
  failed?: number;
  cancelled?: number;
  [key: string]: number | undefined;
}

export interface MeshyRegenerationItem {
  id: string;
  status: MeshyRegenerationItemStatus;
  stage?: string;
  progress?: number;
  source_collection: MeshyRegenerationSourceCollection;
  source_asset_id: string;
  old_meshy_asset_id?: string;
  new_meshy_asset_id?: string;
  prompt?: string;
  chapter_id?: string;
  topic_id?: string;
  broken_reasons?: string[];
  old_url_type?: string;
  estimated_meshy_task_count?: number;
  render_url?: string;
  storage_path?: string;
  error?: string;
  legacy_url_snapshot?: Record<string, unknown>;
  attempt_count?: number;
}

export interface MeshyRegenerationJob {
  id: string;
  status: MeshyRegenerationJobStatus;
  dry_run?: boolean;
  created_by?: string;
  scope?: MeshyRegenerationScope;
  settings?: Record<string, unknown>;
  counts?: MeshyRegenerationCounts;
  error?: string;
  items?: MeshyRegenerationItem[];
}

export interface CreateMeshyRegenerationJobParams {
  dryRun?: boolean;
  scope?: MeshyRegenerationScope;
  selectedItems?: MeshyRegenerationSelectedItem[];
  settings?: Record<string, unknown>;
}

const getApiBaseUrl = () => {
  if (window.VITE_ENV.VITE_API_BASE_URL) {
    return window.VITE_ENV.VITE_API_BASE_URL;
  }

  if (window.VITE_ENV?.DEV) {
    return 'http://localhost:5001/learnxr-evoneuralai/us-central1/api';
  }

  const region = 'us-central1';
  const projectId = window.VITE_ENV.VITE_FIREBASE_PROJECT_ID || 'learnxr-evoneuralai';
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
};

class MeshyRegenerationService {
  private baseUrl = getApiBaseUrl();

  private async authHeaders(): Promise<HeadersInit> {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...(await this.authHeaders()),
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    const raw = body?.data ?? body;
    if (!response.ok) {
      throw new Error(body?.message || raw?.message || raw?.error || `Request failed: ${response.status}`);
    }
    return raw as T;
  }

  async createJob(params: CreateMeshyRegenerationJobParams): Promise<MeshyRegenerationJob> {
    return this.request<MeshyRegenerationJob>('/meshy/regeneration/jobs', {
      method: 'POST',
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(120000),
    });
  }

  async getJob(jobId: string): Promise<MeshyRegenerationJob> {
    return this.request<MeshyRegenerationJob>(`/meshy/regeneration/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(30000),
    });
  }

  async cancelJob(jobId: string): Promise<MeshyRegenerationJob> {
    return this.request<MeshyRegenerationJob>(`/meshy/regeneration/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(30000),
    });
  }

  async retryFailed(jobId: string): Promise<MeshyRegenerationJob> {
    return this.request<MeshyRegenerationJob>(`/meshy/regeneration/jobs/${encodeURIComponent(jobId)}/retry-failed`, {
      method: 'POST',
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(30000),
    });
  }
}

export const meshyRegenerationService = new MeshyRegenerationService();
