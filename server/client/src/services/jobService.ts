// Job Service - Business logic for managing generation jobs
// Provides high-level operations for job management

import { unifiedStorageService } from './unifiedStorageService';
import { subscriptionService } from './subscriptionService';
import type { 
  Job, 
  JobId, 
  UserId, 
  GenerationRequest,
  GenerationStats,
  UserQuota 
} from '../types/unifiedGeneration';

export class JobService {
  private readonly JOBS_COLLECTION = 'unified_jobs';
  private readonly DAILY_LIMIT_FREE = 5;
  private readonly DAILY_LIMIT_PREMIUM = 50;
  private readonly MONTHLY_LIMIT_FREE = 20;
  private readonly MONTHLY_LIMIT_PREMIUM = 500;

  /**
   * Get user's generation quota
   */
  async getUserQuota(userId: UserId): Promise<UserQuota> {
    try {
      // Get subscription info
      const subscription = await subscriptionService.getActiveSubscription(userId);
      const isPremium = subscription?.planId !== 'free';
      
      // Get current usage
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const jobs = await unifiedStorageService.getUserJobs(userId, 1000);
      
      // Count today's generations
      const dailyGenerations = jobs.filter(job => {
        const jobDate = new Date(job.createdAt);
        return jobDate >= today;
      }).length;
      
      // Count this month's generations
      const monthlyGenerations = jobs.filter(job => {
        const jobDate = new Date(job.createdAt);
        return jobDate >= thisMonth;
      }).length;
      
      // Calculate limits
      const dailyLimit = isPremium ? this.DAILY_LIMIT_PREMIUM : this.DAILY_LIMIT_FREE;
      const monthlyLimit = isPremium ? this.MONTHLY_LIMIT_PREMIUM : this.MONTHLY_LIMIT_FREE;
      
      // Calculate next reset dates
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextMonth = new Date(thisMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      return {
        dailyLimit,
        monthlyLimit,
        used: Math.max(dailyGenerations, monthlyGenerations),
        remaining: Math.min(
          dailyLimit - dailyGenerations,
          monthlyLimit - monthlyGenerations
        ),
        resetDate: tomorrow.toISOString()
      };
    } catch (error) {
      console.error('Failed to get user quota:', error);
      throw new Error(`Failed to get user quota: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user can generate more assets
   */
  async canUserGenerate(userId: UserId): Promise<{ canGenerate: boolean; reason?: string }> {
    try {
      const quota = await this.getUserQuota(userId);
      
      if (quota.remaining <= 0) {
        return {
          canGenerate: false,
          reason: 'Daily or monthly generation limit reached. Please upgrade or wait for reset.'
        };
      }
      
      return { canGenerate: true };
    } catch (error) {
      console.error('Failed to check user generation ability:', error);
      return {
        canGenerate: false,
        reason: 'Unable to verify generation limits. Please try again.'
      };
    }
  }

  /**
   * Create a new generation job
   */
  async createJob(
    prompt: string,
    userId: UserId,
    request: GenerationRequest
  ): Promise<Job> {
    try {
      // Check user quota
      const canGenerate = await this.canUserGenerate(userId);
      if (!canGenerate.canGenerate) {
        throw new Error(canGenerate.reason || 'Generation limit reached');
      }

      // Create job
      const jobId = unifiedStorageService.generateJobId();
      const job = await unifiedStorageService.createJob(jobId, prompt, userId);
      
      // Log generation attempt
      console.log(`🚀 Job created for user ${userId}: ${jobId}`);
      
      return job;
    } catch (error) {
      console.error('Failed to create job:', error);
      throw new Error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get job by ID with access control
   */
  async getJob(jobId: JobId, userId: UserId): Promise<Job | null> {
    try {
      const job = await unifiedStorageService.getJob(jobId);
      
      if (!job) {
        return null;
      }
      
      // Check access control
      if (job.userId !== userId) {
        throw new Error('Access denied');
      }
      
      return job;
    } catch (error) {
      console.error('Failed to get job:', error);
      throw new Error(`Failed to get job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's recent jobs
   */
  async getUserJobs(
    userId: UserId,
    limit: number = 20,
    status?: Job['status']
  ): Promise<Job[]> {
    try {
      const jobs = await unifiedStorageService.getUserJobs(userId, limit);
      
      // Filter by status if provided
      if (status) {
        return jobs.filter(job => job.status === status);
      }
      
      return jobs;
    } catch (error) {
      console.error('Failed to get user jobs:', error);
      throw new Error(`Failed to get user jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a job (with access control)
   */
  async deleteJob(jobId: JobId, userId: UserId): Promise<void> {
    try {
      // Check access control
      const job = await this.getJob(jobId, userId);
      if (!job) {
        throw new Error('Job not found');
      }
      
      await unifiedStorageService.deleteJob(jobId);
      console.log(`🗑️ Job deleted by user ${userId}: ${jobId}`);
    } catch (error) {
      console.error('Failed to delete job:', error);
      throw new Error(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get generation statistics for user
   */
  async getGenerationStats(userId: UserId): Promise<GenerationStats> {
    try {
      const jobs = await unifiedStorageService.getUserJobs(userId, 1000);
      
      const totalGenerations = jobs.length;
      const successfulGenerations = jobs.filter(j => j.status === 'completed' || j.status === 'partial').length;
      const failedGenerations = jobs.filter(j => j.status === 'failed').length;
      
      // Calculate average generation time
      const completedJobs = jobs.filter(j => j.metadata?.totalTime);
      const averageGenerationTime = completedJobs.length > 0 
        ? completedJobs.reduce((sum, job) => sum + (job.metadata?.totalTime || 0), 0) / completedJobs.length
        : 0;
      
      // Calculate total cost
      const totalCost = jobs.reduce((sum, job) => sum + (job.metadata?.totalCost || 0), 0);
      
      // Count generations by type
      const skyboxGenerations = jobs.filter(j => j.skyboxResult).length;
      const meshGenerations = jobs.filter(j => j.meshResult).length;
      
      // Get most used styles (approximate)
      const styleUsage: Record<string, number> = {};
      jobs.forEach(job => {
        if (job.skyboxResult?.styleId) {
          styleUsage[job.skyboxResult.styleId] = (styleUsage[job.skyboxResult.styleId] || 0) + 1;
        }
      });
      
      const mostUsedStyles = Object.entries(styleUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([style]) => style);
      
      return {
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        averageGenerationTime,
        totalCost,
        skyboxGenerations,
        meshGenerations,
        mostUsedStyles
      };
    } catch (error) {
      console.error('Failed to get generation stats:', error);
      throw new Error(`Failed to get generation stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search jobs by prompt
   */
  async searchJobs(
    userId: UserId,
    searchTerm: string,
    limit: number = 20
  ): Promise<Job[]> {
    try {
      const jobs = await unifiedStorageService.getUserJobs(userId, 1000);
      
      // Simple text search in prompts
      const searchResults = jobs.filter(job =>
        job.prompt.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      // Sort by relevance (exact matches first, then partial matches)
      searchResults.sort((a, b) => {
        const aExact = a.prompt.toLowerCase().includes(searchTerm.toLowerCase());
        const bExact = b.prompt.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Secondary sort by creation date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      return searchResults.slice(0, limit);
    } catch (error) {
      console.error('Failed to search jobs:', error);
      throw new Error(`Failed to search jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    userId: UserId,
    status: Job['status'],
    limit: number = 20
  ): Promise<Job[]> {
    try {
      return await this.getUserJobs(userId, limit, status);
    } catch (error) {
      console.error('Failed to get jobs by status:', error);
      throw new Error(`Failed to get jobs by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get jobs created in a date range
   */
  async getJobsByDateRange(
    userId: UserId,
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<Job[]> {
    try {
      const jobs = await unifiedStorageService.getUserJobs(userId, limit);
      
      return jobs.filter(job => {
        const jobDate = new Date(job.createdAt);
        return jobDate >= startDate && jobDate <= endDate;
      });
    } catch (error) {
      console.error('Failed to get jobs by date range:', error);
      throw new Error(`Failed to get jobs by date range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup old jobs for user
   */
  async cleanupOldJobs(userId: UserId, daysOld: number = 30): Promise<number> {
    try {
      return await unifiedStorageService.cleanupOldJobs(userId, daysOld);
    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
      throw new Error(`Failed to cleanup old jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats(userId: UserId): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalSize: number;
    storageUsed: string;
  }> {
    try {
      return await unifiedStorageService.getUserStorageStats(userId);
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      throw new Error(`Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export user data (for GDPR compliance)
   */
  async exportUserData(userId: UserId): Promise<{
    jobs: Job[];
    stats: GenerationStats;
    quota: UserQuota;
    storageStats: any;
  }> {
    try {
      const [jobs, stats, quota, storageStats] = await Promise.all([
        this.getUserJobs(userId, 1000),
        this.getGenerationStats(userId),
        this.getUserQuota(userId),
        this.getStorageStats(userId)
      ]);

      return {
        jobs,
        stats,
        quota,
        storageStats
      };
    } catch (error) {
      console.error('Failed to export user data:', error);
      throw new Error(`Failed to export user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update job progress (for external use)
   */
  async updateJobProgress(
    jobId: JobId,
    updates: Partial<Job>
  ): Promise<void> {
    try {
      await unifiedStorageService.updateJob(jobId, updates);
    } catch (error) {
      console.error('Failed to update job progress:', error);
      throw new Error(`Failed to update job progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending jobs count
   */
  async getPendingJobsCount(userId: UserId): Promise<number> {
    try {
      const jobs = await this.getJobsByStatus(userId, 'pending');
      return jobs.length;
    } catch (error) {
      console.error('Failed to get pending jobs count:', error);
      return 0;
    }
  }

  /**
   * Get user's favorite prompts (most frequently used)
   */
  async getFavoritePrompts(userId: UserId, limit: number = 10): Promise<string[]> {
    try {
      const jobs = await unifiedStorageService.getUserJobs(userId, 1000);
      
      // Count prompt frequency
      const promptCount: Record<string, number> = {};
      jobs.forEach(job => {
        const prompt = job.prompt.toLowerCase().trim();
        promptCount[prompt] = (promptCount[prompt] || 0) + 1;
      });
      
      // Sort by frequency and return top prompts
      return Object.entries(promptCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([prompt]) => prompt);
    } catch (error) {
      console.error('Failed to get favorite prompts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const jobService = new JobService(); 