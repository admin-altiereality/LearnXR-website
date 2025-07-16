// Download Service - Handle asset downloads with proper filename generation
// Manages download operations for skybox and mesh assets

import { unifiedStorageService } from './unifiedStorageService';
import type { DownloadInfo, JobId, Job } from '../types/unifiedGeneration';

export class DownloadService {
  private downloadQueue: Map<string, Promise<void>> = new Map();
  private downloadHistory: DownloadInfo[] = [];

  /**
   * Download an asset with proper filename and progress tracking
   */
  async downloadAsset(
    jobId: JobId,
    type: 'skybox' | 'mesh',
    options: {
      showProgress?: boolean;
      customFilename?: string;
      openInNewTab?: boolean;
    } = {}
  ): Promise<DownloadInfo> {
    const downloadKey = `${jobId}-${type}`;
    
    // Check if already downloading
    if (this.downloadQueue.has(downloadKey)) {
      await this.downloadQueue.get(downloadKey);
      return this.getDownloadInfo(jobId, type);
    }

    // Start download
    const downloadPromise = this.performDownload(jobId, type, options);
    this.downloadQueue.set(downloadKey, downloadPromise);

    try {
      await downloadPromise;
      const downloadInfo = await this.getDownloadInfo(jobId, type);
      
      // Add to history
      this.downloadHistory.unshift(downloadInfo);
      if (this.downloadHistory.length > 50) {
        this.downloadHistory.pop();
      }
      
      return downloadInfo;
    } finally {
      this.downloadQueue.delete(downloadKey);
    }
  }

  /**
   * Get download information for an asset
   */
  private async getDownloadInfo(jobId: JobId, type: 'skybox' | 'mesh'): Promise<DownloadInfo> {
    return await unifiedStorageService.getDownloadInfo(jobId, type);
  }

  /**
   * Perform the actual download
   */
  private async performDownload(
    jobId: JobId,
    type: 'skybox' | 'mesh',
    options: {
      showProgress?: boolean;
      customFilename?: string;
      openInNewTab?: boolean;
    }
  ): Promise<void> {
    try {
      const downloadInfo = await this.getDownloadInfo(jobId, type);
      const filename = options.customFilename || downloadInfo.filename;

      if (options.openInNewTab) {
        // Open in new tab
        window.open(downloadInfo.url, '_blank');
      } else {
        // Direct download
        await this.downloadFile(downloadInfo.url, filename, options.showProgress);
      }

      console.log(`✅ ${type} downloaded successfully: ${filename}`);
    } catch (error) {
      console.error(`❌ Download failed for ${type}:`, error);
      throw error;
    }
  }

  /**
   * Download file with progress tracking
   */
  private async downloadFile(
    url: string,
    filename: string,
    showProgress: boolean = false
  ): Promise<void> {
    if (showProgress) {
      // Download with progress tracking
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response body');
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        received += value.length;
        
        if (total > 0) {
          const progress = (received / total) * 100;
          this.updateDownloadProgress(filename, progress);
        }
      }

      // Combine chunks into blob
      const blob = new Blob(chunks);
      this.createDownloadLink(blob, filename);
    } else {
      // Simple download
      this.createDownloadLink(url, filename);
    }
  }

  /**
   * Create download link and trigger download
   */
  private createDownloadLink(urlOrBlob: string | Blob, filename: string): void {
    const link = document.createElement('a');
    
    if (typeof urlOrBlob === 'string') {
      link.href = urlOrBlob;
    } else {
      link.href = URL.createObjectURL(urlOrBlob);
    }
    
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL if created
    if (typeof urlOrBlob !== 'string') {
      setTimeout(() => URL.revokeObjectURL(link.href), 100);
    }
  }

  /**
   * Update download progress (can be customized for UI integration)
   */
  private updateDownloadProgress(filename: string, progress: number): void {
    // Emit progress event for UI components to listen to
    const event = new CustomEvent('downloadProgress', {
      detail: { filename, progress }
    });
    window.dispatchEvent(event);
  }

  /**
   * Download multiple assets as a zip file
   */
  async downloadMultipleAssets(
    assets: Array<{ jobId: JobId; type: 'skybox' | 'mesh'; customName?: string }>,
    zipFilename?: string
  ): Promise<void> {
    try {
      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add each asset to the zip
      const downloadPromises = assets.map(async (asset) => {
        try {
          const downloadInfo = await this.getDownloadInfo(asset.jobId, asset.type);
          const response = await fetch(downloadInfo.url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch ${asset.type}: ${response.statusText}`);
          }

          const blob = await response.blob();
          const filename = asset.customName || downloadInfo.filename;
          
          zip.file(filename, blob);
        } catch (error) {
          console.error(`Failed to add ${asset.type} to zip:`, error);
          // Add error file instead
          zip.file(`ERROR-${asset.type}.txt`, `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      await Promise.all(downloadPromises);

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const finalFilename = zipFilename || `assets-${Date.now()}.zip`;
      
      this.createDownloadLink(zipBlob, finalFilename);
      
      console.log(`✅ Downloaded ${assets.length} assets as ${finalFilename}`);
    } catch (error) {
      console.error('❌ Failed to download multiple assets:', error);
      throw error;
    }
  }

  /**
   * Download all assets from a job
   */
  async downloadJobAssets(jobId: JobId, zipFilename?: string): Promise<void> {
    try {
      const job = await unifiedStorageService.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const assets: Array<{ jobId: JobId; type: 'skybox' | 'mesh'; customName?: string }> = [];
      
      if (job.skyboxUrl) {
        assets.push({ 
          jobId, 
          type: 'skybox', 
          customName: `${this.createPromptSlug(job.prompt)}-skybox.${job.skyboxResult?.format || 'png'}`
        });
      }
      
      if (job.meshUrl) {
        assets.push({ 
          jobId, 
          type: 'mesh', 
          customName: `${this.createPromptSlug(job.prompt)}-mesh.${job.meshResult?.format || 'glb'}`
        });
      }

      if (assets.length === 0) {
        throw new Error('No assets available for download');
      }

      if (assets.length === 1) {
        // Single asset - download directly
        await this.downloadAsset(jobId, assets[0].type);
      } else {
        // Multiple assets - download as zip
        const finalZipFilename = zipFilename || `${this.createPromptSlug(job.prompt)}-assets.zip`;
        await this.downloadMultipleAssets(assets, finalZipFilename);
      }
    } catch (error) {
      console.error('❌ Failed to download job assets:', error);
      throw error;
    }
  }

  /**
   * Create a URL-safe slug from prompt
   */
  private createPromptSlug(prompt: string): string {
    return prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)
      .replace(/-+$/, '');
  }

  /**
   * Get download history
   */
  getDownloadHistory(): DownloadInfo[] {
    return [...this.downloadHistory];
  }

  /**
   * Clear download history
   */
  clearDownloadHistory(): void {
    this.downloadHistory = [];
  }

  /**
   * Get download statistics
   */
  getDownloadStats(): {
    totalDownloads: number;
    skyboxDownloads: number;
    meshDownloads: number;
    totalSize: number;
    averageSize: number;
  } {
    const skyboxDownloads = this.downloadHistory.filter(d => d.type === 'skybox').length;
    const meshDownloads = this.downloadHistory.filter(d => d.type === 'mesh').length;
    const totalSize = this.downloadHistory.reduce((sum, d) => sum + d.size, 0);
    
    return {
      totalDownloads: this.downloadHistory.length,
      skyboxDownloads,
      meshDownloads,
      totalSize,
      averageSize: this.downloadHistory.length > 0 ? totalSize / this.downloadHistory.length : 0
    };
  }

  /**
   * Check if download is in progress
   */
  isDownloadInProgress(jobId: JobId, type: 'skybox' | 'mesh'): boolean {
    return this.downloadQueue.has(`${jobId}-${type}`);
  }

  /**
   * Cancel download (if possible)
   */
  async cancelDownload(jobId: JobId, type: 'skybox' | 'mesh'): Promise<void> {
    const downloadKey = `${jobId}-${type}`;
    
    if (this.downloadQueue.has(downloadKey)) {
      this.downloadQueue.delete(downloadKey);
      console.log(`🚫 Download cancelled: ${downloadKey}`);
    }
  }

  /**
   * Validate download URL
   */
  async validateDownloadUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('URL validation failed:', error);
      return false;
    }
  }

  /**
   * Get file size from URL
   */
  async getFileSize(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch (error) {
      console.error('Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * Check if file format is supported
   */
  isSupportedFormat(format: string, type: 'skybox' | 'mesh'): boolean {
    const supportedSkyboxFormats = ['png', 'jpg', 'jpeg', 'hdr', 'exr'];
    const supportedMeshFormats = ['glb', 'gltf', 'usdz', 'obj', 'fbx', 'dae'];
    
    const supportedFormats = type === 'skybox' ? supportedSkyboxFormats : supportedMeshFormats;
    return supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Get MIME type for file format
   */
  getMimeType(format: string, type: 'skybox' | 'mesh'): string {
    const mimeTypes: Record<string, string> = {
      // Skybox formats
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      hdr: 'image/vnd.radiance',
      exr: 'image/x-exr',
      
      // Mesh formats
      glb: 'model/gltf-binary',
      gltf: 'model/gltf+json',
      usdz: 'model/vnd.usdz+zip',
      obj: 'model/obj',
      fbx: 'application/octet-stream',
      dae: 'model/vnd.collada+xml'
    };
    
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }
}

// Export singleton instance
export const downloadService = new DownloadService(); 