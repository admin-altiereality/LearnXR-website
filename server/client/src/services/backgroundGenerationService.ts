/**
 * BackgroundGenerationService - Manages generation tasks that persist across navigation
 * 
 * This service uses Firestore as the source of truth, allowing generation to continue
 * in the background even when users navigate away from the create page.
 */

import { meshyApiService, type MeshyAsset } from './meshyApiService';
import { unifiedStorageService } from './unifiedStorageService';
import { onSnapshot, doc, query, where, collection, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { StoredAsset } from './assetStorageService';
import type { Job, UserId } from '../types/unifiedGeneration';

export interface GenerationTask {
  id: string;
  jobId: string; // Firestore job ID
  taskId?: string; // API task ID (e.g., Meshy task ID)
  type: 'meshy' | 'asset-generation' | 'unified';
  prompt: string;
  userId: string;
  status: 'pending' | 'generating' | 'polling' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  stage?: string;
  startedAt: number;
  completedAt?: number;
  result?: StoredAsset | StoredAsset[] | MeshyAsset;
  error?: string;
  metadata?: {
    quality?: string;
    style?: string;
    artStyle?: string;
    aiModel?: string;
    [key: string]: any;
  };
  // UI State to persist
  uiState?: {
    prompt: string;
    negativePrompt?: string;
    artStyle?: string;
    aiModel?: string;
    topology?: string;
    targetPolycount?: number;
    shouldRemesh?: boolean;
    symmetryMode?: string;
    moderation?: boolean;
    seed?: number;
    [key: string]: any;
  };
}

interface GenerationProgressCallback {
  (progress: {
    stage: string;
    progress: number;
    message: string;
    taskId?: string;
  }): void;
}

class BackgroundGenerationService {
  private tasks: Map<string, GenerationTask> = new Map();
  private pollingIntervals: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private progressCallbacks: Map<string, GenerationProgressCallback> = new Map();
  private firestoreListeners: Map<string, () => void> = new Map();
  private readonly JOBS_COLLECTION = 'unified_jobs';
  private readonly MESHY_JOBS_COLLECTION = 'meshy_generations'; // For Meshy-specific jobs

  constructor() {
    // Service is initialized, but we'll fetch active jobs when user logs in
  }

  /**
   * Initialize service for a user - fetch active jobs from Firestore
   */
  async initializeForUser(userId: UserId): Promise<void> {
    try {
      // Fetch active unified jobs
      const activeUnifiedJobs = await this.fetchActiveJobs(userId);
      activeUnifiedJobs.forEach(job => {
        // Only restore if not already in tasks
        if (!this.tasks.has(job.id)) {
          this.restoreJobFromFirestore(job);
        }
      });

      // Fetch active Meshy jobs (includes recently completed for UI restoration)
      const activeMeshyJobs = await this.fetchActiveMeshyJobs(userId);
      activeMeshyJobs.forEach(job => {
        // Only restore if not already in tasks
        if (!this.tasks.has(job.id)) {
          this.restoreMeshyJobFromFirestore(job);
        } else {
          // If task exists, check if it needs polling resumed
          const existingTask = this.tasks.get(job.id);
          if (existingTask) {
            // Update task with latest data from Firestore
            if (job.status) existingTask.status = job.status;
            if (job.progress !== undefined) existingTask.progress = job.progress;
            if (job.message) existingTask.message = job.message;
            if (job.result) existingTask.result = job.result;
            if (job.uiState) existingTask.uiState = job.uiState;
            
            // Resume polling if needed
            if (existingTask.taskId && 
                (existingTask.status === 'polling' || existingTask.status === 'generating') &&
                !this.pollingIntervals.has(existingTask.id)) {
              console.log(`🔄 Resuming polling for task ${existingTask.id}`);
              this.startPolling(existingTask);
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to initialize background generation service:', error);
    }
  }

  /**
   * Fetch active jobs from Firestore
   */
  private async fetchActiveJobs(userId: UserId): Promise<Job[]> {
    try {
      const jobsRef = collection(db, this.JOBS_COLLECTION);
      const q = query(
        jobsRef,
        where('userId', '==', userId),
        where('status', 'in', ['pending', 'processing'])
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
    } catch (error) {
      console.error('Failed to fetch active jobs:', error);
      return [];
    }
  }

  /**
   * Fetch active Meshy jobs from Firestore
   * Also includes recently completed jobs (within last hour) for UI restoration
   */
  private async fetchActiveMeshyJobs(userId: UserId): Promise<any[]> {
    try {
      // Check if meshy_generations collection exists
      const meshyJobsRef = collection(db, this.MESHY_JOBS_COLLECTION);
      
      // Fetch active jobs
      const activeQuery = query(
        meshyJobsRef,
        where('userId', '==', userId),
        where('status', 'in', ['pending', 'generating', 'polling'])
      );
      
      const activeSnapshot = await getDocs(activeQuery);
      const activeJobs = activeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Also fetch recently completed jobs (within last hour) for UI restoration
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const completedQuery = query(
        meshyJobsRef,
        where('userId', '==', userId),
        where('status', '==', 'completed')
      );
      
      const completedSnapshot = await getDocs(completedQuery);
      const recentCompletedJobs = completedSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter((job: any) => {
          const completedAt = job.completedAt || job.updatedAt;
          if (!completedAt) return false;
          const completedTime = typeof completedAt === 'string' ? new Date(completedAt).getTime() : completedAt;
          return completedTime > oneHourAgo;
        });
      
      console.log(`📊 Found ${activeJobs.length} active and ${recentCompletedJobs.length} recently completed Meshy jobs`);
      
      // Return active jobs first, then recently completed (most recent first)
      return [...activeJobs, ...recentCompletedJobs.sort((a: any, b: any) => {
        const aTime = a.completedAt || a.updatedAt || 0;
        const bTime = b.completedAt || b.updatedAt || 0;
        return bTime - aTime;
      })];
    } catch (error) {
      // Collection might not exist yet, that's okay
      console.log('Meshy jobs collection not found or empty:', error);
      return [];
    }
  }

  /**
   * Restore a job from Firestore
   */
  private restoreJobFromFirestore(job: Job) {
    const task: GenerationTask = {
      id: job.id,
      jobId: job.id,
      type: 'unified',
      prompt: job.prompt,
      userId: job.userId,
      status: this.mapJobStatusToTaskStatus(job.status),
      progress: this.calculateJobProgress(job),
      message: this.getJobMessage(job),
      startedAt: new Date(job.createdAt).getTime(),
      metadata: job.metadata
    };

    this.tasks.set(job.id, task);
    
    // Set up Firestore listener for real-time updates
    this.setupJobListener(job.id, job.userId);
  }

  /**
   * Restore a Meshy job from Firestore
   */
  private restoreMeshyJobFromFirestore(jobData: any) {
    // Ensure UI state is properly restored - this is critical for UI persistence
    const uiState = jobData.uiState || {
      prompt: jobData.prompt,
      negativePrompt: jobData.negativePrompt,
      artStyle: jobData.metadata?.artStyle || jobData.artStyle,
      aiModel: jobData.metadata?.aiModel || jobData.aiModel,
      topology: jobData.metadata?.topology || jobData.topology,
      targetPolycount: jobData.metadata?.targetPolycount || jobData.targetPolycount,
      shouldRemesh: jobData.shouldRemesh,
      symmetryMode: jobData.symmetryMode,
      moderation: jobData.moderation,
      seed: jobData.seed
    };
    
    const task: GenerationTask = {
      id: jobData.id,
      jobId: jobData.id,
      taskId: jobData.taskId,
      type: 'meshy',
      prompt: jobData.prompt,
      userId: jobData.userId,
      status: jobData.status || 'polling',
      progress: jobData.progress || 0,
      message: jobData.message || 'Resuming generation...',
      stage: jobData.stage,
      startedAt: jobData.startedAt || Date.now(),
      metadata: jobData.metadata,
      uiState: uiState, // Always include UI state for proper restoration
      result: jobData.result
    };
    
    console.log('🔄 Restored Meshy task from Firestore:', {
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      hasUIState: !!task.uiState,
      prompt: task.uiState?.prompt
    });

    this.tasks.set(jobData.id, task);
    
    console.log(`💾 Restored Meshy task:`, {
      id: task.id,
      status: task.status,
      progress: task.progress,
      hasResult: !!task.result,
      hasUIState: !!task.uiState,
      hasTaskId: !!task.taskId
    });
    
    // Resume polling if task is in progress and not already polling
    if (task.taskId && (task.status === 'polling' || task.status === 'generating')) {
      if (!this.pollingIntervals.has(task.id)) {
        console.log(`🔄 Restoring polling for task ${task.id} with taskId ${task.taskId}`);
        const callback = this.progressCallbacks.get(task.id);
        this.startPolling(task, callback);
      } else {
        console.log(`✅ Polling already active for task ${task.id}`);
      }
    }
    
    // If task is completed, ensure result is properly stored
    if (task.status === 'completed' && task.result) {
      console.log(`✅ Task ${task.id} is completed with result, ready for UI restoration`);
    }

    // Set up Firestore listener (only if not already set up)
    if (!this.firestoreListeners.has(jobData.id)) {
      this.setupMeshyJobListener(jobData.id, jobData.userId);
    }
  }

  /**
   * Set up Firestore listener for job updates
   */
  private setupJobListener(jobId: string, _userId: string) {
    const jobRef = doc(db, this.JOBS_COLLECTION, jobId);
    
    const unsubscribe = onSnapshot(jobRef, (doc) => {
      if (doc.exists()) {
        const job = { id: doc.id, ...doc.data() } as Job;
        this.updateTaskFromJob(job);
      }
    });

    this.firestoreListeners.set(jobId, unsubscribe);
  }

  /**
   * Set up Firestore listener for Meshy job updates
   */
  private setupMeshyJobListener(jobId: string, _userId: string) {
    const jobRef = doc(db, this.MESHY_JOBS_COLLECTION, jobId);
    
    const unsubscribe = onSnapshot(jobRef, (doc) => {
      if (doc.exists()) {
        const jobData = { id: doc.id, ...doc.data() };
        this.updateTaskFromMeshyJob(jobData);
      }
    });

    this.firestoreListeners.set(jobId, unsubscribe);
  }

  /**
   * Update task from Firestore job
   */
  private updateTaskFromJob(job: Job) {
    const task = this.tasks.get(job.id);
    if (!task) return;

    task.status = this.mapJobStatusToTaskStatus(job.status);
    task.progress = this.calculateJobProgress(job);
    task.message = this.getJobMessage(job);
    
    if (job.status === 'completed') {
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = new Date(job.updatedAt).getTime();
      this.cleanupTask(task.id);
    } else if (job.status === 'failed') {
      task.status = 'failed';
      task.error = job.errors.join(', ');
      this.cleanupTask(task.id);
    }

    this.notifyProgress(task);
  }

  /**
   * Update task from Meshy job
   */
  private updateTaskFromMeshyJob(jobData: any) {
    const task = this.tasks.get(jobData.id);
    if (!task) return;

    task.status = jobData.status || task.status;
    task.progress = jobData.progress || task.progress;
    task.message = jobData.message || task.message;
    task.stage = jobData.stage || task.stage;
    
    // Preserve UI state if it exists in Firestore update
    if (jobData.uiState) {
      task.uiState = jobData.uiState;
    }
    
    // Preserve result if it exists
    if (jobData.result) {
      task.result = jobData.result;
    }

    if (jobData.status === 'completed') {
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = jobData.completedAt || Date.now();
      this.cleanupTask(task.id);
    } else if (jobData.status === 'failed') {
      task.status = 'failed';
      task.error = jobData.error || 'Generation failed';
      this.cleanupTask(task.id);
    }

    this.notifyProgress(task);
  }

  /**
   * Map Job status to Task status
   */
  private mapJobStatusToTaskStatus(jobStatus: Job['status']): GenerationTask['status'] {
    switch (jobStatus) {
      case 'pending':
        return 'pending';
      case 'processing':
        return 'generating';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'partial':
        return 'generating';
      default:
        return 'pending';
    }
  }

  /**
   * Calculate progress from job state
   */
  private calculateJobProgress(job: Job): number {
    if (job.status === 'completed') return 100;
    if (job.status === 'failed') return 0;
    
    // Estimate progress based on what's completed
    let progress = 0;
    if (job.skyboxResult) {
      if (job.skyboxResult.status === 'completed') progress += 50;
      else if (job.skyboxResult.status === 'processing') progress += 25;
    }
    if (job.meshResult) {
      if (job.meshResult.status === 'completed') progress += 50;
      else if (job.meshResult.status === 'processing') progress += 25;
    }
    
    return Math.min(progress, 100);
  }

  /**
   * Get message from job state
   */
  private getJobMessage(job: Job): string {
    if (job.status === 'completed') return 'Generation completed successfully!';
    if (job.status === 'failed') return `Generation failed: ${job.errors.join(', ')}`;
    if (job.skyboxResult && job.meshResult) {
      return 'Generating skybox and mesh...';
    } else if (job.skyboxResult) {
      return 'Generating skybox...';
    } else if (job.meshResult) {
      return 'Generating mesh...';
    }
    return 'Initializing generation...';
  }

  /**
   * Start a new Meshy generation task
   */
  async startMeshyGeneration(
    userId: UserId,
    request: {
      prompt: string;
      negative_prompt?: string;
      art_style?: string;
      seed?: number;
      ai_model?: string;
      topology?: string;
      target_polycount?: number;
      should_remesh?: boolean;
      symmetry_mode?: string;
      moderation?: boolean;
    },
    uiState?: {
      prompt: string;
      negativePrompt?: string;
      artStyle?: string;
      aiModel?: string;
      topology?: string;
      targetPolycount?: number;
      shouldRemesh?: boolean;
      symmetryMode?: string;
      moderation?: boolean;
      seed?: number;
      [key: string]: any;
    },
    onProgress?: GenerationProgressCallback
  ): Promise<string> {
    const jobId = unifiedStorageService.generateJobId();
    
    // Create job in Firestore with UI state
    const jobData = {
      id: jobId,
      userId,
      prompt: request.prompt,
      status: 'pending',
      progress: 0,
      message: 'Initiating generation...',
      stage: 'generating',
      startedAt: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        artStyle: request.art_style,
        aiModel: request.ai_model,
        topology: request.topology,
        targetPolycount: request.target_polycount
      },
      uiState: uiState || {
        prompt: request.prompt,
        negativePrompt: request.negative_prompt,
        artStyle: request.art_style,
        aiModel: request.ai_model,
        topology: request.topology,
        targetPolycount: request.target_polycount,
        shouldRemesh: request.should_remesh,
        symmetryMode: request.symmetry_mode,
        moderation: request.moderation,
        seed: request.seed
      }
    };

    // Save to Firestore
    await this.saveMeshyJobToFirestore(jobId, jobData);
    
    const task: GenerationTask = {
      id: jobId,
      jobId,
      type: 'meshy',
      prompt: request.prompt,
      userId,
      status: 'pending',
      progress: 0,
      message: 'Initiating generation...',
      startedAt: Date.now(),
      metadata: jobData.metadata,
      uiState: jobData.uiState // Ensure UI state is stored in task
    };
    
    console.log('💾 Created task with UI state:', {
      taskId: jobId,
      hasUIState: !!jobData.uiState,
      prompt: jobData.uiState?.prompt
    });

    this.tasks.set(jobId, task);
    if (onProgress) {
      this.progressCallbacks.set(jobId, onProgress);
    }

    // Set up Firestore listener
    this.setupMeshyJobListener(jobId, userId);

    // Start generation
    this.startMeshyGenerationAsync(task, request, onProgress);

    return jobId;
  }

  /**
   * Save Meshy job to Firestore
   */
  private async saveMeshyJobToFirestore(jobId: string, jobData: any) {
    try {
      const jobRef = doc(db, this.MESHY_JOBS_COLLECTION, jobId);
      await setDoc(jobRef, jobData);
      console.log(`✅ Meshy job saved to Firestore: ${jobId}`);
    } catch (error) {
      console.error('Failed to save Meshy job to Firestore:', error);
      throw error;
    }
  }

  /**
   * Update Meshy job in Firestore
   * Preserves UI state if it exists in the task
   */
  private async updateMeshyJobInFirestore(jobId: string, updates: Partial<GenerationTask>) {
    try {
      const task = this.tasks.get(jobId);
      const jobRef = doc(db, this.MESHY_JOBS_COLLECTION, jobId);
      
      // Preserve UI state if it exists in the task
      const updateData: any = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // If task has UI state and updates don't include it, preserve it
      if (task?.uiState && !updates.uiState) {
        updateData.uiState = task.uiState;
      }
      
      await updateDoc(jobRef, updateData);
    } catch (error) {
      console.error('Failed to update Meshy job in Firestore:', error);
    }
  }

  /**
   * Async Meshy generation
   */
  private async startMeshyGenerationAsync(
    task: GenerationTask,
    request: any,
    onProgress?: GenerationProgressCallback
  ) {
    try {
      task.status = 'generating';
      task.message = 'Creating generation request...';
      task.progress = 10;
      this.updateTask(task);
      await this.updateMeshyJobInFirestore(task.jobId, task);
      this.notifyProgress(task, onProgress);

      // Generate asset
      const generation = await meshyApiService.generateAsset(request);
      
      if (!generation.result) {
        throw new Error('No task ID received from Meshy API');
      }

      task.taskId = generation.result;
      task.status = 'polling';
      task.message = 'Generation started, polling for completion...';
      task.progress = 20;
      this.updateTask(task);
      await this.updateMeshyJobInFirestore(task.jobId, {
        taskId: generation.result,
        status: 'polling',
        progress: 20,
        message: task.message
      });
      this.notifyProgress(task, onProgress);

      // Start polling
      this.startPolling(task, onProgress);

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.message = `Generation failed: ${task.error}`;
      this.updateTask(task);
      await this.updateMeshyJobInFirestore(task.jobId, task);
      this.notifyProgress(task, onProgress);
    }
  }

  /**
   * Start polling for task completion
   * This continues running independently of component lifecycle
   */
  private startPolling(task: GenerationTask, onProgress?: GenerationProgressCallback) {
    if (!task.taskId) {
      console.error('Cannot start polling without task ID');
      return;
    }

    // Don't start if already polling
    if (this.pollingIntervals.has(task.id)) {
      console.log(`⚠️ Polling already active for task ${task.id}, skipping`);
      return;
    }

    // Clear any existing polling interval (shouldn't happen, but safety check)
    this.stopPolling(task.id);
    
    console.log(`🚀 Starting background polling for task ${task.id} (taskId: ${task.taskId})`);

    let attempts = 0;
    let currentInterval = 3000;
    const maxAttempts = 120;

    const poll = async () => {
      try {
        const status = await meshyApiService.getGenerationStatus(task.taskId!);
        
        // Update progress
        if (status.progress !== undefined) {
          task.progress = Math.max(task.progress, status.progress);
        }
        task.message = `Generating... ${task.progress}%`;
        task.stage = status.status.toLowerCase();
        this.updateTask(task);
        await this.updateMeshyJobInFirestore(task.jobId, {
          progress: task.progress,
          message: task.message,
          stage: task.stage
        });
        this.notifyProgress(task, onProgress);

        if (status.status === 'SUCCEEDED') {
          console.log(`✅ Generation completed for task ${task.id}`);
          this.stopPolling(task.id);
          
          const asset = meshyApiService.mapToAsset(status);
          task.status = 'completed';
          task.progress = 100;
          task.message = 'Generation completed successfully!';
          task.result = asset;
          task.completedAt = Date.now();
          this.updateTask(task);
          
          // Save completed task with result and UI state to Firestore
          await this.updateMeshyJobInFirestore(task.jobId, {
            status: 'completed',
            progress: 100,
            message: task.message,
            completedAt: task.completedAt,
            result: asset,
            // Preserve UI state
            uiState: task.uiState
          });
          
          console.log(`💾 Saved completed task ${task.id} to Firestore with result`);
          this.notifyProgress(task, onProgress);
          this.cleanupTask(task.id);
        } else if (status.status === 'FAILED') {
          this.stopPolling(task.id);
          
          task.status = 'failed';
          task.error = status.task_error?.message || 'Generation failed';
          task.message = `Generation failed: ${task.error}`;
          this.updateTask(task);
          await this.updateMeshyJobInFirestore(task.jobId, task);
          this.notifyProgress(task, onProgress);
        } else if (status.status === 'CANCELED') {
          this.stopPolling(task.id);
          
          task.status = 'cancelled';
          task.message = 'Generation was cancelled';
          this.updateTask(task);
          await this.updateMeshyJobInFirestore(task.jobId, task);
          this.notifyProgress(task, onProgress);
        } else {
          // Continue polling
          attempts++;
          if (attempts < maxAttempts) {
            const jitter = Math.random() * 0.1 * currentInterval;
            const delay = currentInterval + jitter;
            currentInterval = Math.min(currentInterval * 1.2, 30000);
            
            const timeoutId = setTimeout(poll, delay);
            this.pollingIntervals.set(task.id, timeoutId);
          } else {
            this.stopPolling(task.id);
            task.status = 'failed';
            task.error = 'Generation timed out';
            task.message = 'Generation timed out after maximum attempts';
            this.updateTask(task);
            await this.updateMeshyJobInFirestore(task.jobId, task);
            this.notifyProgress(task, onProgress);
          }
        }
      } catch (error) {
        console.error(`Error polling task ${task.taskId}:`, error);
        attempts++;
        
        if (attempts < maxAttempts) {
          const delay = currentInterval * 2;
          const timeoutId = setTimeout(poll, delay);
          this.pollingIntervals.set(task.id, timeoutId);
        } else {
          this.stopPolling(task.id);
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : 'Polling failed';
          task.message = `Generation failed: ${task.error}`;
          this.updateTask(task);
          await this.updateMeshyJobInFirestore(task.jobId, task);
          this.notifyProgress(task, onProgress);
        }
      }
    };

    poll();
  }

  /**
   * Stop polling for a task
   */
  private stopPolling(taskId: string) {
    const timeout = this.pollingIntervals.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.pollingIntervals.delete(taskId);
    }
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): GenerationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get UI state for a task
   */
  getTaskUIState(taskId: string): GenerationTask['uiState'] | undefined {
    const task = this.tasks.get(taskId);
    return task?.uiState;
  }

  /**
   * Get active tasks for a user
   */
  getActiveTasksForUser(userId: UserId): GenerationTask[] {
    return Array.from(this.tasks.values()).filter(
      task => task.userId === userId && (task.status === 'generating' || task.status === 'polling')
    );
  }

  /**
   * Get all tasks for a user (including completed)
   */
  getAllTasksForUser(userId: UserId): GenerationTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt); // Most recent first
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): GenerationTask[] {
    return Array.from(this.tasks.values()).filter(
      task => task.status === 'generating' || task.status === 'polling'
    );
  }

  /**
   * Get all tasks
   */
  getAllTasks(): GenerationTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      this.stopPolling(taskId);
      task.status = 'cancelled';
      task.message = 'Generation cancelled';
      this.updateTask(task);
      await this.updateMeshyJobInFirestore(task.jobId, task);
      this.cleanupTask(taskId);
    }
  }

  /**
   * Register progress callback for a task
   */
  registerProgressCallback(taskId: string, callback: GenerationProgressCallback) {
    this.progressCallbacks.set(taskId, callback);
    
    // Immediately notify with current progress if task exists
    const task = this.tasks.get(taskId);
    if (task) {
      this.notifyProgress(task, callback);
    }
  }

  /**
   * Unregister progress callback
   * Note: This does NOT stop polling - polling continues in the background
   */
  unregisterProgressCallback(taskId: string) {
    this.progressCallbacks.delete(taskId);
    // Polling continues even without callbacks - it will update Firestore
    console.log(`📝 Unregistered callback for task ${taskId}, but polling continues`);
  }

  /**
   * Update task
   */
  private updateTask(task: GenerationTask) {
    this.tasks.set(task.id, task);
  }

  /**
   * Notify progress callback
   * Progress is always saved to Firestore, even if no callbacks are registered
   */
  private notifyProgress(task: GenerationTask, onProgress?: GenerationProgressCallback) {
    const progress = {
      stage: task.stage || task.status,
      progress: task.progress,
      message: task.message,
      taskId: task.taskId
    };

    // Notify provided callback
    if (onProgress) {
      try {
        onProgress(progress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }

    // Notify registered callbacks (may be empty if component unmounted)
    const registeredCallback = this.progressCallbacks.get(task.id);
    if (registeredCallback) {
      try {
        registeredCallback(progress);
      } catch (error) {
        console.error('Error in registered progress callback:', error);
        // Remove broken callback
        this.progressCallbacks.delete(task.id);
      }
    }
    
    // Progress is always saved to Firestore via updateMeshyJobInFirestore
    // So even if no callbacks are registered, the state persists
  }

  /**
   * Cleanup completed/failed tasks
   * Note: This does NOT stop polling for active tasks - polling continues independently
   */
  private cleanupTask(taskId: string) {
    // Only stop polling if task is actually completed/failed
    const task = this.tasks.get(taskId);
    if (task && (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')) {
      this.stopPolling(taskId);
      
      // Unregister callback after a delay
      setTimeout(() => {
        this.progressCallbacks.delete(taskId);
      }, 5000);
    }
  }

  /**
   * Cleanup all listeners and tasks
   */
  cleanup() {
    // Stop all polling
    this.pollingIntervals.forEach((timeout) => clearTimeout(timeout));
    this.pollingIntervals.clear();
    
    // Unsubscribe from Firestore listeners
    this.firestoreListeners.forEach((unsubscribe) => unsubscribe());
    this.firestoreListeners.clear();
    
    // Clear tasks and callbacks
    this.tasks.clear();
    this.progressCallbacks.clear();
  }
}

export const backgroundGenerationService = new BackgroundGenerationService();
