// Alternative Storage Service for Meshy.ai Assets
// This service provides multiple storage options when Firebase Storage is unavailable

export interface StorageProvider {
  name: string;
  available: boolean;
  maxFileSize: number; // in bytes
  supportsFormat: (format: string) => boolean;
  upload: (file: File | Blob, filename: string) => Promise<StorageResult>;
  getUrl: (identifier: string) => string;
}

export interface StorageResult {
  success: boolean;
  url?: string;
  identifier?: string;
  error?: string;
  provider: string;
}

export interface AssetStorageData {
  id: string;
  userId: string;
  originalName: string;
  provider: string;
  identifier: string;
  url: string;
  size: number;
  format: string;
  createdAt: string;
  metadata?: any;
}

class AlternativeStorageService {
  private providers: StorageProvider[] = [];
  private localStorageKey = 'meshy_assets_';

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // 1. Local Storage Provider (for small files < 5MB)
    this.providers.push({
      name: 'localStorage',
      available: this.isLocalStorageAvailable(),
      maxFileSize: 5 * 1024 * 1024, // 5MB
      supportsFormat: (format) => ['glb', 'usdz', 'png', 'jpg', 'jpeg'].includes(format.toLowerCase()),
      upload: this.uploadToLocalStorage.bind(this),
      getUrl: this.getLocalStorageUrl.bind(this)
    });

    // 2. Cloudinary Provider (if configured)
    if (this.isCloudinaryAvailable()) {
      this.providers.push({
        name: 'cloudinary',
        available: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        supportsFormat: (format) => ['glb', 'usdz', 'png', 'jpg', 'jpeg', 'mp4'].includes(format.toLowerCase()),
        upload: this.uploadToCloudinary.bind(this),
        getUrl: this.getCloudinaryUrl.bind(this)
      });
    }

    // 3. Direct URL Provider (for Meshy.ai generated assets)
    this.providers.push({
      name: 'directUrl',
      available: true,
      maxFileSize: Infinity,
      supportsFormat: (format) => true,
      upload: this.storeDirectUrl.bind(this),
      getUrl: this.getDirectUrl.bind(this)
    });

    console.log('🔧 Alternative storage providers initialized:', this.providers.map(p => ({ name: p.name, available: p.available })));
  }

  /**
   * Check if any storage provider is available
   */
  isStorageAvailable(): boolean {
    return this.providers.some(provider => provider.available);
  }

  /**
   * Get available storage providers
   */
  getAvailableProviders(): StorageProvider[] {
    return this.providers.filter(provider => provider.available);
  }

  /**
   * Upload asset to the best available storage provider
   */
  async uploadAsset(
    file: File | Blob,
    filename: string,
    userId: string,
    metadata?: any
  ): Promise<StorageResult> {
    const format = this.getFileFormat(filename);
    
    // Find the best available provider
    const provider = this.providers.find(p => 
      p.available && 
      p.maxFileSize >= file.size && 
      p.supportsFormat(format)
    );

    if (!provider) {
      return {
        success: false,
        error: 'No suitable storage provider available',
        provider: 'none'
      };
    }

    try {
      console.log(`📤 Uploading to ${provider.name}...`);
      const result = await provider.upload(file, filename);
      
      if (result.success) {
        // Store metadata in local storage for tracking
        this.storeAssetMetadata({
          id: this.generateId(),
          userId,
          originalName: filename,
          provider: provider.name,
          identifier: result.identifier!,
          url: result.url!,
          size: file.size,
          format,
          createdAt: new Date().toISOString(),
          metadata
        });
      }

      return result;
    } catch (error) {
      console.error(`❌ Upload to ${provider.name} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: provider.name
      };
    }
  }

  /**
   * Store Meshy.ai asset URL directly
   */
  async storeMeshyAssetUrl(
    meshyUrl: string,
    filename: string,
    userId: string,
    metadata?: any
  ): Promise<StorageResult> {
    const format = this.getFileFormat(filename);
    
    try {
      // Use direct URL provider
      const provider = this.providers.find(p => p.name === 'directUrl');
      if (!provider) {
        throw new Error('Direct URL provider not available');
      }

      const result = await provider.upload(meshyUrl as any, filename);
      
      if (result.success) {
        // Store metadata
        this.storeAssetMetadata({
          id: this.generateId(),
          userId,
          originalName: filename,
          provider: 'directUrl',
          identifier: result.identifier!,
          url: result.url!,
          size: 0, // Unknown size for direct URLs
          format,
          createdAt: new Date().toISOString(),
          metadata
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to store Meshy asset URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'directUrl'
      };
    }
  }

  /**
   * Get user's stored assets
   */
  getUserAssets(userId: string): AssetStorageData[] {
    try {
      const assets: AssetStorageData[] = [];
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        if (key.startsWith(this.localStorageKey + userId)) {
          try {
            const asset = JSON.parse(localStorage.getItem(key)!);
            assets.push(asset);
          } catch (e) {
            console.warn('Failed to parse asset data:', key);
          }
        }
      }
      
      return assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('❌ Failed to get user assets:', error);
      return [];
    }
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string, userId: string): Promise<boolean> {
    try {
      const assets = this.getUserAssets(userId);
      const asset = assets.find(a => a.id === assetId);
      
      if (!asset) {
        return false;
      }

      // Remove from local storage
      localStorage.removeItem(this.localStorageKey + userId + '_' + assetId);
      
      // If it's a local storage file, also remove the file data
      if (asset.provider === 'localStorage') {
        localStorage.removeItem(this.localStorageKey + 'file_' + asset.identifier);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to delete asset:', error);
      return false;
    }
  }

  // Private helper methods

  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private isCloudinaryAvailable(): boolean {
    // Check if Cloudinary is configured
    return !!(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && 
              import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  }

  private getFileFormat(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'unknown';
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private storeAssetMetadata(asset: AssetStorageData): void {
    try {
      const key = this.localStorageKey + asset.userId + '_' + asset.id;
      localStorage.setItem(key, JSON.stringify(asset));
    } catch (error) {
      console.error('❌ Failed to store asset metadata:', error);
    }
  }

  // Storage provider implementations

  private async uploadToLocalStorage(file: File | Blob, filename: string): Promise<StorageResult> {
    try {
      const identifier = this.generateId();
      const key = this.localStorageKey + 'file_' + identifier;
      
      // Convert file to base64 for storage
      const base64 = await this.fileToBase64(file);
      localStorage.setItem(key, base64);
      
      return {
        success: true,
        url: `local://${identifier}`,
        identifier,
        provider: 'localStorage'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'localStorage'
      };
    }
  }

  private async uploadToCloudinary(file: File | Blob, filename: string): Promise<StorageResult> {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      
      if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary not configured');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'meshy-assets');

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        url: data.secure_url,
        identifier: data.public_id,
        provider: 'cloudinary'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'cloudinary'
      };
    }
  }

  private async storeDirectUrl(url: string, filename: string): Promise<StorageResult> {
    try {
      const identifier = this.generateId();
      
      return {
        success: true,
        url,
        identifier,
        provider: 'directUrl'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'directUrl'
      };
    }
  }

  private getLocalStorageUrl(identifier: string): string {
    return `local://${identifier}`;
  }

  private getCloudinaryUrl(identifier: string): string {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/auto/upload/${identifier}`;
  }

  private getDirectUrl(identifier: string): string {
    return identifier; // Direct URLs are stored as-is
  }

  private async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async base64ToFile(base64: string, filename: string): Promise<File> {
    const response = await fetch(base64);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  /**
   * Download asset from local storage
   */
  async downloadLocalAsset(identifier: string, filename: string): Promise<File | null> {
    try {
      const key = this.localStorageKey + 'file_' + identifier;
      const base64 = localStorage.getItem(key);
      
      if (!base64) {
        return null;
      }

      return await this.base64ToFile(base64, filename);
    } catch (error) {
      console.error('❌ Failed to download local asset:', error);
      return null;
    }
  }
}

// Export singleton instance
export const alternativeStorageService = new AlternativeStorageService(); 