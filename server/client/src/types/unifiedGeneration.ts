// Unified Generation Types for Skybox + Mesh Generation System

export interface SkyboxResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  prompt: string;
  styleId: string;
  negativePrompt?: string;
  format: 'hdr' | 'png' | 'jpg';
  error?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    style?: string;
  };
}

export interface MeshResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  previewUrl?: string;
  prompt: string;
  format: 'glb' | 'usdz' | 'obj' | 'fbx';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  style: 'realistic' | 'sculpture' | 'cartoon' | 'anime';
  error?: string;
  createdAt: string;
  updatedAt: string;
  model_urls?: {
    glb?: string;
    fbx?: string;
    usdz?: string;
    obj?: string;
    mtl?: string;
  };
  metadata?: {
    polycount?: number;
    size?: number;
    aiModel?: string;
    topology?: string;
    cost?: number;
    generationTime?: number;
  };
}

export interface Job {
  id: string;
  prompt: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  createdAt: string;
  updatedAt: string;
  skyboxUrl?: string;
  meshUrl?: string;
  skyboxResult?: SkyboxResult;
  meshResult?: MeshResult;
  errors: string[];
  metadata?: {
    totalTime?: number;
    totalCost?: number;
    retryCount?: number;
  };
}

export interface GenerationRequest {
  prompt: string;
  userId: string;
  skyboxConfig?: {
    styleId: string;
    negativePrompt?: string;
    variations?: number;
  };
  meshConfig?: {
    quality?: 'low' | 'medium' | 'high' | 'ultra';
    style?: 'realistic' | 'sculpture' | 'cartoon' | 'anime';
    format?: 'glb' | 'usdz' | 'obj' | 'fbx';
    aiModel?: 'meshy-4' | 'meshy-5';
    topology?: 'quad' | 'triangle';
    targetPolycount?: number;
  };
}

export interface GenerationResponse {
  success: boolean;
  jobId: string;
  skybox?: SkyboxResult;
  mesh?: MeshResult;
  errors: string[];
  message?: string;
}

export interface GenerationProgress {
  jobId: string;
  stage: 'initializing' | 'skybox_generating' | 'mesh_generating' | 'storing' | 'completed' | 'failed';
  skyboxProgress: number;
  meshProgress: number;
  overallProgress: number;
  message: string;
  errors: string[];
  estimatedTimeRemaining?: number;
}

export interface DownloadInfo {
  filename: string;
  url: string;
  size: number;
  format: string;
  type: 'skybox' | 'mesh';
}

export interface UnifiedGenerationHookResult {
  isGenerating: boolean;
  progress: GenerationProgress | null;
  currentJob: Job | null;
  error: string | null;
  generateAssets: (request: GenerationRequest) => Promise<GenerationResponse>;
  downloadAsset: (jobId: string, type: 'skybox' | 'mesh') => Promise<DownloadInfo>;
  cancelGeneration: (jobId: string) => Promise<void>;
  retryGeneration: (jobId: string) => Promise<GenerationResponse>;
}

export interface JobsCollection {
  [jobId: string]: Job;
}

export interface StorageConfig {
  basePath: string;
  skyboxPath: string;
  meshPath: string;
  maxRetries: number;
  retryDelay: number;
}

export interface ApiError {
  provider: 'skybox' | 'mesh';
  error: string;
  code?: string;
  retryable: boolean;
  timestamp: string;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface PreviewSceneConfig {
  skyboxUrl?: string;
  meshUrl?: string;
  meshFormat?: 'glb' | 'usdz' | 'obj' | 'fbx';
  autoRotate?: boolean;
  enableControls?: boolean;
  cameraPosition?: [number, number, number];
  backgroundColor?: string;
  lighting?: 'studio' | 'outdoor' | 'dramatic' | 'soft';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  averageGenerationTime: number;
  totalCost: number;
  skyboxGenerations: number;
  meshGenerations: number;
  mostUsedStyles: string[];
}

export interface UserQuota {
  dailyLimit: number;
  monthlyLimit: number;
  used: number;
  remaining: number;
  resetDate: string;
}

// Event types for progress tracking
export type GenerationEvent = 
  | { type: 'generation_started'; jobId: string; timestamp: string }
  | { type: 'skybox_progress'; jobId: string; progress: number; message: string }
  | { type: 'mesh_progress'; jobId: string; progress: number; message: string }
  | { type: 'skybox_completed'; jobId: string; result: SkyboxResult }
  | { type: 'mesh_completed'; jobId: string; result: MeshResult }
  | { type: 'generation_completed'; jobId: string; job: Job }
  | { type: 'generation_failed'; jobId: string; error: string }
  | { type: 'generation_cancelled'; jobId: string };

export type GenerationEventHandler = (event: GenerationEvent) => void;

// Utility types
export type PromptSlug = string;
export type Timestamp = string;
export type JobId = string;
export type UserId = string;
export type AssetUrl = string; 