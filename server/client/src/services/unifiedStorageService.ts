// Unified Storage Service for Skybox + Mesh Assets
// Handles Firebase Storage operations for both skybox and mesh assets

import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  StorageReference,
  getStorage,
  uploadBytesResumable,
  UploadTaskSnapshot
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  limit,
  setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStorageWithFallback } from '../utils/firebaseStorage';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Job, 
  SkyboxResult, 
  MeshResult, 
  StorageConfig, 
  DownloadInfo,
  JobId,
  UserId 
} from '../types/unifiedGeneration';

export class UnifiedStorageService {
  private storage: any = null;
  private jobsCollection = 'unified_jobs';
  private initialized = false;
  private storageConfig: StorageConfig = {
    basePath: 'user',
    skyboxPath: 'skybox',
    meshPath: 'mesh',
    maxRetries: 3,
    retryDelay: 1000
  };

  constructor() {
    this.initializeStorage();
  }

  /**
   * Filter out undefined values from an object to prevent Firestore errors
   */
  private filterUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.filter(item => item !== undefined).map(item => this.filterUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const filtered: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          filtered[key] = this.filterUndefinedValues(value);
        }
      }
      return filtered;
    }
    
    return obj;
  }

  private async initializeStorage() {
    if (this.initialized) return;

    try {
      this.storage = await getStorageWithFallback();
      this.initialized = true;
      console.log('✅ Unified Storage Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Unified Storage Service:', error);
      this.storage = null;
    }
  }

  /**
   * Check if storage is available
   */
  async isStorageAvailable(): Promise<boolean> {
    await this.initializeStorage();
    return this.storage !== null;
  }

  /**
   * Generate a unique job ID
   */
  generateJobId(): JobId {
    return uuidv4();
  }

  /**
   * Generate timestamp for folder organization
   */
  generateTimestamp(): string {
    return Date.now().toString();
  }

  /**
   * Create storage path for job assets
   */
  createJobPath(userId: UserId, timestamp: string): string {
    return `${this.storageConfig.basePath}/${userId}/${timestamp}`;
  }

  /**
   * Create new job record
   */
  async createJob(
    jobId: JobId,
    prompt: string,
    userId: UserId
  ): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      id: jobId,
      prompt,
      userId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      errors: []
    };

    try {
      await setDoc(doc(db, this.jobsCollection, jobId), job);
      console.log(`✅ Job created: ${jobId}`);
      return job;
    } catch (error) {
      console.error('❌ Failed to create job:', error);
      throw new Error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update job status and results
   */
  async updateJob(
    jobId: JobId,
    updates: Partial<Job>
  ): Promise<void> {
    try {
      const jobRef = doc(db, this.jobsCollection, jobId);
      
      // Normalize errors field to always be an array
      let normalizedErrors = updates.errors;
      if (updates.errors !== undefined) {
        if (Array.isArray(updates.errors)) {
          normalizedErrors = updates.errors;
        } else if (typeof updates.errors === 'object' && updates.errors !== null) {
          // Handle legacy object format - convert to array
          console.warn(`⚠️ UnifiedStorageService: Converting legacy errors object to array for job ${jobId}`);
          const errorObj = updates.errors as any;
          normalizedErrors = [];
          if (errorObj.message) normalizedErrors.push(errorObj.message);
          if (errorObj.status && errorObj.status !== 'completed') {
            normalizedErrors.push(`Status: ${errorObj.status}`);
          }
          if (errorObj.prompt) {
            normalizedErrors.push(`Prompt: ${errorObj.prompt}`);
          }
          if (normalizedErrors.length === 0) {
            normalizedErrors = ['Unknown error'];
          }
        } else if (typeof updates.errors === 'string') {
          normalizedErrors = [updates.errors];
        } else {
          normalizedErrors = [];
        }
      }
      
      // Filter out undefined values to prevent Firestore errors
      const cleanUpdates = this.filterUndefinedValues({
        ...updates,
        ...(normalizedErrors !== undefined && { errors: normalizedErrors }),
        updatedAt: new Date().toISOString()
      });
      
      await updateDoc(jobRef, cleanUpdates);
      console.log(`✅ Job updated: ${jobId}`);
    } catch (error) {
      console.error('❌ Failed to update job:', error);
      throw new Error(`Failed to update job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize errors field to always be an array
   */
  private normalizeErrors(errors: any): string[] {
    if (!errors) {
      return [];
    }
    if (Array.isArray(errors)) {
      return errors.filter(e => typeof e === 'string');
    }
    if (typeof errors === 'object') {
      // Handle legacy object format - convert to array
      const errorArray: string[] = [];
      if (errors.message) errorArray.push(errors.message);
      if (errors.status && errors.status !== 'completed') {
        errorArray.push(`Status: ${errors.status}`);
      }
      if (errors.prompt) {
        errorArray.push(`Prompt: ${errors.prompt}`);
      }
      return errorArray.length > 0 ? errorArray : ['Unknown error'];
    }
    if (typeof errors === 'string') {
      return [errors];
    }
    return [];
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: JobId): Promise<Job | null> {
    try {
      const jobRef = doc(db, this.jobsCollection, jobId);
      const jobDoc = await getDoc(jobRef);
      
      if (!jobDoc.exists()) {
        return null;
      }

      const jobData = jobDoc.data();
      
      // Normalize errors field if it exists
      if (jobData.errors !== undefined) {
        const normalizedErrors = this.normalizeErrors(jobData.errors);
        if (normalizedErrors.length > 0 && !Array.isArray(jobData.errors)) {
          // If we had to normalize, update the document to fix the structure
          console.warn(`⚠️ UnifiedStorageService: Normalizing errors field for job ${jobId} from object to array`);
          await updateDoc(jobRef, { errors: normalizedErrors });
        }
        jobData.errors = normalizedErrors;
      }

      return jobData as Job;
    } catch (error) {
      console.error('❌ Failed to get job:', error);
      throw new Error(`Failed to get job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's jobs
   */
  async getUserJobs(
    userId: UserId,
    limitCount: number = 20
  ): Promise<Job[]> {
    try {
      const q = query(
        collection(db, this.jobsCollection),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const jobs: Job[] = [];

      querySnapshot.forEach((docSnapshot) => {
        const jobData = docSnapshot.data();
        
        // Normalize errors field if it exists
        if (jobData.errors !== undefined) {
          jobData.errors = this.normalizeErrors(jobData.errors);
        }
        
        jobs.push(jobData as Job);
      });

      return jobs;
    } catch (error) {
      console.error('❌ Failed to get user jobs:', error);
      throw new Error(`Failed to get user jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store skybox asset
   */
  async storeSkyboxAsset(
    jobId: JobId,
    userId: UserId,
    timestamp: string,
    skyboxData: Blob,
    format: 'hdr' | 'png' | 'jpg' = 'png'
  ): Promise<string> {
    if (!this.storage) {
      throw new Error('Storage not available');
    }

    try {
      const jobPath = this.createJobPath(userId, timestamp);
      const filename = `skybox.${format}`;
      const storageRef = ref(this.storage, `${jobPath}/${filename}`);

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, skyboxData);
      
      // Wait for upload to complete
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Skybox upload progress: ${progress}%`);
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`✅ Skybox stored: ${downloadUrl}`);
      
      return downloadUrl;
    } catch (error) {
      console.error('❌ Failed to store skybox:', error);
      throw new Error(`Failed to store skybox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store mesh asset
   */
  async storeMeshAsset(
    jobId: JobId,
    userId: UserId,
    timestamp: string,
    meshData: Blob,
    format: 'glb' | 'usdz' | 'obj' | 'fbx' = 'glb'
  ): Promise<string> {
    if (!this.storage) {
      throw new Error('Storage not available');
    }

    try {
      const jobPath = this.createJobPath(userId, timestamp);
      const filename = `mesh.${format}`;
      const storageRef = ref(this.storage, `${jobPath}/${filename}`);

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, meshData);
      
      // Wait for upload to complete
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Mesh upload progress: ${progress}%`);
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`✅ Mesh stored: ${downloadUrl}`);
      
      return downloadUrl;
    } catch (error) {
      console.error('❌ Failed to store mesh:', error);
      throw new Error(`Failed to store mesh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store asset from URL (for direct URLs from APIs) with CORS handling
   */
  async storeAssetFromUrl(
    url: string,
    jobId: JobId,
    userId: UserId,
    timestamp: string,
    type: 'skybox' | 'mesh',
    format: string
  ): Promise<string> {
    try {
      console.log(`🔄 Storing ${type} asset from URL:`, url);
      
      // Use proxy strategies to avoid CORS issues
      const blob = await this.fetchAssetWithProxy(url);
      
      // Store based on type
      if (type === 'skybox') {
        return await this.storeSkyboxAsset(jobId, userId, timestamp, blob, format as 'hdr' | 'png' | 'jpg');
      } else {
        return await this.storeMeshAsset(jobId, userId, timestamp, blob, format as 'glb' | 'usdz' | 'obj' | 'fbx');
      }
    } catch (error) {
      console.error('❌ Failed to store asset from URL:', error);
      throw new Error(`Failed to store asset from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch asset with proxy strategies to avoid CORS issues
   */
  private async fetchAssetWithProxy(url: string): Promise<Blob> {
    if (!url) {
      throw new Error('Asset URL is required');
    }

    // Get the correct API base URL
    const getApiBaseUrl = () => {
      const region = 'us-central1';
      const projectId = 'in3devoneuralai';
      return `https://${region}-${projectId}.cloudfunctions.net/api`;
    };

    // Try multiple download strategies (same as working components)
    const strategies = [
      // Strategy 1: Use Firebase Functions proxy URL (primary method to avoid CORS)
      async () => {
        const proxyUrl = `${getApiBaseUrl()}/proxy-asset?url=${encodeURIComponent(url)}`;
        console.log('🔄 Fetching via Firebase Functions proxy:', proxyUrl);
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'User-Agent': 'In3D.ai-WebApp/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Firebase proxy fetch failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
      },
      
      // Strategy 2: Local development server proxy (for development)
      async () => {
        const localProxy = `http://localhost:5002/proxy-asset?url=${encodeURIComponent(url)}`;
        console.log('🔄 Fetching via local development proxy:', localProxy);
        const response = await fetch(localProxy, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'User-Agent': 'In3D.ai-WebApp/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Local proxy fetch failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
      },
      
      // Strategy 3: Direct URL (last resort - will likely fail due to CORS)
      async () => {
        console.log('🔄 Fetching direct URL (last resort):', url);
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': '*/*',
            'User-Agent': 'In3D.ai-WebApp/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Direct fetch failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
      }
    ];

    let lastError: Error | null = null;

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        console.log('✅ Asset fetched successfully via proxy');
        return result;
      } catch (error) {
        console.warn('⚠️ Fetch strategy failed:', error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    throw lastError || new Error('All fetch strategies failed');
  }

  /**
   * Generate download filename
   */
  generateDownloadFilename(prompt: string, timestamp: string, type: 'skybox' | 'mesh', format: string): string {
    // Create prompt slug (first 30 chars, alphanumeric only)
    const promptSlug = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)
      .replace(/-+$/, '');

    // Convert timestamp to readable format
    const date = new Date(parseInt(timestamp));
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return `${promptSlug}-${type}-${dateString}.${format}`;
  }

  /**
   * Get download info for an asset
   */
  async getDownloadInfo(
    jobId: JobId,
    type: 'skybox' | 'mesh'
  ): Promise<DownloadInfo> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const timestamp = job.createdAt ? new Date(job.createdAt).getTime().toString() : this.generateTimestamp();
      let url: string;
      let format: string;

      if (type === 'skybox') {
        if (!job.skyboxUrl) {
          throw new Error('Skybox not available');
        }
        url = job.skyboxUrl;
        format = job.skyboxResult?.format || 'png';
      } else {
        if (!job.meshUrl) {
          throw new Error('Mesh not available');
        }
        url = job.meshUrl;
        format = job.meshResult?.format || 'glb';
      }

      const filename = this.generateDownloadFilename(job.prompt, timestamp, type, format);
      
      // Get file size by fetching headers
      let size = 0;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        size = contentLength ? parseInt(contentLength) : 0;
      } catch (error) {
        console.warn('Could not determine file size:', error);
      }

      return {
        filename,
        url,
        size,
        format,
        type
      };
    } catch (error) {
      console.error('❌ Failed to get download info:', error);
      throw new Error(`Failed to get download info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete job and all associated assets
   */
  async deleteJob(jobId: JobId): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Delete from Firestore
      await deleteDoc(doc(db, this.jobsCollection, jobId));

      // Delete from Storage if available
      if (this.storage && job.createdAt) {
        const timestamp = new Date(job.createdAt).getTime().toString();
        const jobPath = this.createJobPath(job.userId, timestamp);
        const storageRef = ref(this.storage, jobPath);
        
        try {
          const files = await listAll(storageRef);
          const deletePromises = files.items.map(item => deleteObject(item));
          await Promise.all(deletePromises);
        } catch (error) {
          console.warn('Failed to delete storage files:', error);
        }
      }

      console.log(`✅ Job deleted: ${jobId}`);
    } catch (error) {
      console.error('❌ Failed to delete job:', error);
      throw new Error(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage usage stats for user
   */
  async getUserStorageStats(userId: UserId): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalSize: number;
    storageUsed: string;
  }> {
    try {
      const jobs = await this.getUserJobs(userId, 1000); // Get all jobs
      
      const totalJobs = jobs.length;
      const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'partial').length;
      const failedJobs = jobs.filter(j => j.status === 'failed').length;
      
      // Calculate total size (approximate)
      let totalSize = 0;
      for (const job of jobs) {
        if (job.skyboxResult?.metadata?.size) {
          totalSize += job.skyboxResult.metadata.size;
        }
        if (job.meshResult?.metadata?.size) {
          totalSize += job.meshResult.metadata.size;
        }
      }

      const storageUsed = this.formatBytes(totalSize);

      return {
        totalJobs,
        completedJobs,
        failedJobs,
        totalSize,
        storageUsed
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      throw new Error(`Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup old jobs (older than 30 days)
   */
  async cleanupOldJobs(userId: UserId, daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const jobs = await this.getUserJobs(userId, 1000);
      const oldJobs = jobs.filter(job => 
        new Date(job.createdAt) < cutoffDate
      );

      let deletedCount = 0;
      for (const job of oldJobs) {
        try {
          await this.deleteJob(job.id);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete old job ${job.id}:`, error);
        }
      }

      console.log(`✅ Cleaned up ${deletedCount} old jobs`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old jobs:', error);
      throw new Error(`Failed to cleanup old jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const unifiedStorageService = new UnifiedStorageService(); 