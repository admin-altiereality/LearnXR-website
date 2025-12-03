// Asset Storage Service for Firebase Storage
// This service handles storing and retrieving 3D assets and their metadata

import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  StorageReference
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
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStorageWithFallback, isStorageAvailable, resetStorageInstance } from '../utils/firebaseStorage';
import { v4 as uuidv4 } from 'uuid';
import type { MeshyAsset } from './meshyApiService';
import type { ExtractedObject } from './keywordExtractionService';

export interface StoredAsset {
  id: string;
  userId: string;
  skyboxId?: string;
  prompt: string;
  originalPrompt: string;
  category: string;
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  previewUrl?: string;
  format: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  metadata: {
    meshyId: string;
    generationTime: number;
    cost: number;
    quality: string;
    style: string;
    tags: string[];
  };
}

export interface AssetUploadResult {
  success: boolean;
  assetId: string;
  downloadUrl: string;
  error?: string;
}

export interface AssetQueryOptions {
  userId?: string;
  skyboxId?: string;
  category?: string;
  status?: string;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'confidence';
  orderDirection?: 'asc' | 'desc';
}

export class AssetStorageService {
  private storage: any = null;
  private assetsCollection = '3d_assets';
  private readonly STORAGE_FOLDER = '3d-assets';
  private initializationPromise: Promise<void> | null = null;
  private initializationRetries = 0;
  private readonly MAX_RETRIES = 3;
  
  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeStorage();
    return this.initializationPromise;
  }

  private async _initializeStorage() {
    try {
      console.log('🚀 AssetStorageService: Initializing storage...');
      
      // Check if storage is available first
      const available = await isStorageAvailable();
      if (!available) {
        console.warn('⚠️ Storage availability check failed, but continuing with initialization...');
      }
      
      // Try to get storage instance without throwing
      try {
        this.storage = await getStorageWithFallback();
        console.log('✅ AssetStorageService initialized with storage');
        
        // Reset retry counter on successful initialization
        this.initializationRetries = 0;
      } catch (storageError) {
        console.warn('⚠️ Storage initialization failed, but not throwing error:', storageError);
        this.storage = null;
        
        // Don't throw the error, just set storage to null
        // This allows the service to continue working without storage
      }
    } catch (error) {
      console.error('❌ AssetStorageService failed to initialize:', error);
      this.storage = null;
      
      // Retry initialization if we haven't exceeded max retries
      if (this.initializationRetries < this.MAX_RETRIES) {
        this.initializationRetries++;
        console.log(`🔄 Retrying storage initialization (attempt ${this.initializationRetries}/${this.MAX_RETRIES})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * this.initializationRetries));
        
        // Reset promise to allow retry
        this.initializationPromise = null;
        // Don't throw error, just return
        return;
      } else {
        console.error('💥 Max retries exceeded for storage initialization');
        // Don't throw error, just log it
        console.error(`Failed to initialize storage after ${this.MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  /**
   * Check if storage is available with enhanced error handling
   */
  async isStorageAvailable(): Promise<boolean> {
    try {
      if (!this.storage) {
        await this.initializeStorage();
      }
      
      // Additional check to ensure storage is working
      if (this.storage) {
        // Test storage access (Firebase v9+ API)
        try {
          const testRef = ref(this.storage, 'test/availability-check');
          return true;
        } catch (error) {
          console.error('❌ Storage reference test failed:', error);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Storage availability check failed:', error);
      
      // Reset storage instance on failure
      this.storage = null;
      this.initializationPromise = null;
      
      return false;
    }
  }
  
  /**
   * Force re-initialization of storage (useful for recovery)
   */
  async reinitializeStorage(): Promise<void> {
    console.log('🔄 Forcing storage re-initialization...');
    
    // Reset everything
    this.storage = null;
    this.initializationPromise = null;
    this.initializationRetries = 0;
    
    // Reset the global storage instance
    resetStorageInstance();
    
    // Re-initialize
    await this.initializeStorage();
  }
  
  /**
   * Store asset metadata in Firestore
   */
  async storeAssetMetadata(
    asset: MeshyAsset,
    extractedObject: ExtractedObject,
    userId: string,
    skyboxId?: string,
    originalPrompt?: string
  ): Promise<string> {
    try {
      const assetId = uuidv4();
      const now = new Date().toISOString();
      
      const assetData: StoredAsset = {
        id: assetId,
        userId,
        skyboxId,
        prompt: asset.prompt,
        originalPrompt: originalPrompt || asset.prompt,
        category: extractedObject.category,
        confidence: extractedObject.confidence,
        status: asset.status,
        downloadUrl: asset.downloadUrl,
        previewUrl: asset.previewUrl,
        format: asset.format,
        size: asset.size,
        createdAt: now,
        updatedAt: now,
        error: asset.error,
        metadata: {
          meshyId: asset.id,
          generationTime: 0, // Will be updated when completed
          cost: 0, // Will be calculated based on quality
          quality: 'medium',
          style: 'realistic',
          tags: [extractedObject.category, extractedObject.keyword]
        }
      };
      
      // Store in Firestore
      await addDoc(collection(db, this.assetsCollection), assetData);
      
      console.log(`Asset metadata stored with ID: ${assetId}`);
      return assetId;
    } catch (error) {
      console.error('Error storing asset metadata:', error);
      throw new Error(`Failed to store asset metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update asset status and URLs when generation completes
   */
  async updateAssetCompletion(
    assetId: string,
    asset: MeshyAsset,
    generationTime: number,
    cost: number
  ): Promise<void> {
    try {
      const assetRef = doc(db, this.assetsCollection, assetId);
      
      await updateDoc(assetRef, {
        status: asset.status,
        downloadUrl: asset.downloadUrl,
        previewUrl: asset.previewUrl,
        size: asset.size,
        updatedAt: new Date().toISOString(),
        error: asset.error,
        'metadata.generationTime': generationTime,
        'metadata.cost': cost
      });
      
      console.log(`Asset ${assetId} updated with completion data`);
    } catch (error) {
      console.error('Error updating asset completion:', error);
      throw new Error(`Failed to update asset completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Upload asset file to Firebase Storage
   */
  async uploadAssetFile(
    assetId: string,
    file: File | Blob,
    filename: string
  ): Promise<AssetUploadResult> {
    try {
      if (!this.storage) {
        return {
          success: false,
          assetId,
          downloadUrl: '',
          error: 'Firebase Storage is not available'
        };
      }
      
      const storageRef = ref(this.storage, `${this.STORAGE_FOLDER}/${assetId}/${filename}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      console.log(`Asset file uploaded: ${downloadUrl}`);
      
      return {
        success: true,
        assetId,
        downloadUrl
      };
    } catch (error) {
      console.error('Error uploading asset file:', error);
      return {
        success: false,
        assetId,
        downloadUrl: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Download asset file from Firebase Storage
   */
  async downloadAssetFile(assetId: string, filename: string): Promise<Blob> {
    try {
      if (!this.storage) {
        throw new Error('Firebase Storage is not available');
      }
      
      const storageRef = ref(this.storage, `${this.STORAGE_FOLDER}/${assetId}/${filename}`);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Error downloading asset file:', error);
      throw new Error(`Failed to download asset file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get asset by ID
   */
  async getAsset(assetId: string): Promise<StoredAsset | null> {
    try {
      const assetDoc = await getDoc(doc(db, this.assetsCollection, assetId));
      
      if (assetDoc.exists()) {
        return assetDoc.data() as StoredAsset;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting asset:', error);
      throw new Error(`Failed to get asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Query assets with filters
   */
  async queryAssets(options: AssetQueryOptions): Promise<StoredAsset[]> {
    try {
      let q = collection(db, this.assetsCollection);
      const constraints: any[] = [];
      
      // Add filters
      if (options.userId) {
        constraints.push(where('userId', '==', options.userId));
      }
      
      if (options.skyboxId) {
        constraints.push(where('skyboxId', '==', options.skyboxId));
      }
      
      if (options.category) {
        constraints.push(where('category', '==', options.category));
      }
      
      if (options.status) {
        constraints.push(where('status', '==', options.status));
      }
      
      // Add ordering
      if (options.orderBy) {
        constraints.push(orderBy(options.orderBy, options.orderDirection || 'desc'));
      }
      
      // Add limit
      if (options.limit) {
        constraints.push(limit(options.limit));
      }
      
      // Apply constraints
      if (constraints.length > 0) {
        q = query(q, ...constraints);
      }
      
      const querySnapshot = await getDocs(q);
      const assets: StoredAsset[] = [];
      
      querySnapshot.forEach((doc) => {
        assets.push(doc.data() as StoredAsset);
      });
      
      return assets;
    } catch (error) {
      console.error('Error querying assets:', error);
      throw new Error(`Failed to query assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get assets for a specific skybox
   */
  async getAssetsForSkybox(skyboxId: string): Promise<StoredAsset[]> {
    return this.queryAssets({ skyboxId, orderBy: 'createdAt', orderDirection: 'desc' });
  }
  
  /**
   * Get assets for a specific user
   */
  async getUserAssets(userId: string, limit?: number): Promise<StoredAsset[]> {
    // Query without orderBy to avoid index requirement, then sort client-side
    const assets = await this.queryAssets({ 
      userId
    });
    
    // Sort by createdAt descending (most recent first)
    const sorted = assets.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    
    // Apply limit after sorting
    return limit ? sorted.slice(0, limit) : sorted;
  }
  
  /**
   * Delete asset and its files
   */
  async deleteAsset(assetId: string): Promise<void> {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, this.assetsCollection, assetId));
      
      // Delete from Storage
      if (this.storage) {
        const storageRef = ref(this.storage, `${this.STORAGE_FOLDER}/${assetId}`);
        const files = await listAll(storageRef);
        
        // Delete all files in the asset folder
        const deletePromises = files.items.map(item => deleteObject(item));
        await Promise.all(deletePromises);
      }
      
      console.log(`Asset ${assetId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw new Error(`Failed to delete asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update asset metadata
   */
  async updateAssetMetadata(assetId: string, updates: Partial<StoredAsset>): Promise<void> {
    try {
      const assetRef = doc(db, this.assetsCollection, assetId);
      
      await updateDoc(assetRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`Asset ${assetId} metadata updated`);
    } catch (error) {
      console.error('Error updating asset metadata:', error);
      throw new Error(`Failed to update asset metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get storage usage statistics
   */
  async getStorageStats(userId?: string): Promise<{
    totalAssets: number;
    totalSize: number;
    completedAssets: number;
    pendingAssets: number;
    failedAssets: number;
  }> {
    try {
      const options: AssetQueryOptions = { orderBy: 'createdAt', orderDirection: 'desc' };
      if (userId) {
        options.userId = userId;
      }
      
      const assets = await this.queryAssets(options);
      
      const stats = {
        totalAssets: assets.length,
        totalSize: assets.reduce((sum, asset) => sum + (asset.size || 0), 0),
        completedAssets: assets.filter(asset => asset.status === 'completed').length,
        pendingAssets: assets.filter(asset => asset.status === 'pending' || asset.status === 'processing').length,
        failedAssets: assets.filter(asset => asset.status === 'failed').length
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw new Error(`Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Clean up orphaned assets (assets without valid skybox references)
   */
  async cleanupOrphanedAssets(): Promise<number> {
    try {
      // Get all assets without skyboxId
      const orphanedAssets = await this.queryAssets({ 
        status: 'completed',
        limit: 1000 // Process in batches
      });
      
      const assetsToDelete = orphanedAssets.filter(asset => !asset.skyboxId);
      
      // Delete orphaned assets
      const deletePromises = assetsToDelete.map(asset => this.deleteAsset(asset.id));
      await Promise.all(deletePromises);
      
      console.log(`Cleaned up ${assetsToDelete.length} orphaned assets`);
      return assetsToDelete.length;
    } catch (error) {
      console.error('Error cleaning up orphaned assets:', error);
      throw new Error(`Failed to cleanup orphaned assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const assetStorageService = new AssetStorageService(); 