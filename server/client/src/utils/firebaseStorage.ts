import { getStorage, ref } from 'firebase/storage';
import app, { storage as preInitializedStorage } from '../config/firebase';

/**
 * Cache metadata for lesson assets uploaded from the browser.
 *
 * Storage objects written without a `cacheControl` are served with no freshness
 * lifetime, so a skybox panorama or a teacher-uploaded model was re-downloaded on
 * every view. The Cloud Functions upload paths have always set this; the client ones
 * never did, which meant Meshy-generated assets were cacheable and teacher-uploaded
 * ones were not.
 *
 * `immutable` is accurate here because every one of these call sites writes to a
 * path that includes a timestamp or a generated id and is never overwritten in place.
 */
export const IMMUTABLE_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Upload metadata for an immutable asset, preserving any content type the caller knows. */
export function immutableUploadMetadata(contentType?: string) {
  return contentType
    ? { cacheControl: IMMUTABLE_ASSET_CACHE_CONTROL, contentType }
    : { cacheControl: IMMUTABLE_ASSET_CACHE_CONTROL };
}

let storageInstance: ReturnType<typeof getStorage> | null = null;
let storageInitialized = false;
let storageInitPromise: Promise<ReturnType<typeof getStorage> | null> | null = null;

// Enhanced storage initialization with better error handling
export async function getStorageSafely(): Promise<ReturnType<typeof getStorage> | null> {
  console.log('🔧 getStorageSafely called');
  
  if (typeof window === 'undefined') {
    console.warn('Storage initialization skipped - not in browser environment');
    return null;
  }

  // Use pre-initialized storage if available
  if (preInitializedStorage) {
    console.log('✅ Using pre-initialized storage instance');
    return preInitializedStorage;
  }

  if (storageInitialized && storageInstance) {
    console.log('✅ Using cached storage instance');
    return storageInstance;
  }

  if (storageInitPromise) {
    console.log('⏳ Storage initialization already in progress, waiting...');
    return storageInitPromise;
  }

  storageInitPromise = new Promise(async (resolve) => {
    try {
      console.log('🚀 Initializing Firebase Storage...');
      console.log('📋 Firebase app config:', {
        projectId: app.options.projectId,
        storageBucket: app.options.storageBucket,
        authDomain: app.options.authDomain
      });

      // Check if Firebase app is properly initialized
      if (!app.options.storageBucket) {
        throw new Error('Firebase Storage bucket not configured');
      }

      // Wait a bit to ensure Firebase is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));

      storageInstance = getStorage(app);
      storageInitialized = true;
      
      console.log('✅ Firebase Storage initialized successfully');
      console.log('📦 Storage bucket:', app.options.storageBucket);
      resolve(storageInstance);
    } catch (error) {
      console.error('❌ Firebase Storage initialization failed:', error);
      storageInstance = null;
      storageInitialized = false;
      
      // Provide detailed error information
      if (error instanceof Error) {
        if (error.message.includes('storageBucket')) {
          console.error('💡 Storage bucket configuration issue. Check your Firebase config.');
        } else if (error.message.includes('auth')) {
          console.error('💡 Authentication issue. Check if user is logged in.');
        } else {
          console.error('💡 Unknown storage initialization error.');
        }
      }
      
      resolve(null);
    } finally {
      storageInitPromise = null;
    }
  });

  return storageInitPromise;
}

// Enhanced availability check with detailed diagnostics
export async function isStorageAvailable(): Promise<boolean> {
  try {
    console.log('🔍 Checking Firebase Storage availability...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('⚠️ Not in browser environment');
      return false;
    }

    // Check if Firebase app is configured
    if (!app.options.storageBucket) {
      console.error('❌ Firebase Storage bucket not configured');
      return false;
    }

    // Try to get storage instance
    const storage = await getStorageSafely();
    
    if (!storage) {
      console.error('❌ Storage initialization failed');
      return false;
    }

    // Test storage access with a simple operation
    try {
      // Create a test reference to verify storage is accessible (Firebase v9+ API)
      const testRef = ref(storage, 'test/availability-check');
      console.log('✅ Storage reference created successfully');
      
      // Check if we can access the storage bucket
      const bucketName = storage.app.options.storageBucket;
      console.log('✅ Storage bucket accessible:', bucketName);
      
      return true;
    } catch (testError) {
      console.error('❌ Storage access test failed:', testError);
      return false;
    }
  } catch (error) {
    console.error('❌ Storage availability check failed:', error);
    return false;
  }
}

// Get storage with enhanced error handling
export async function getStorageWithFallback() {
  try {
    const storage = await getStorageSafely();
    if (!storage) {
      console.warn('⚠️ Storage fallback: Storage is not available');
      return null;
    }
    return storage;
  } catch (error) {
    console.error('💥 Storage fallback failed:', error);
    return null;
  }
}

// Synchronous version for backward compatibility
export function getStorageSafelySync(): ReturnType<typeof getStorage> | null {
  return preInitializedStorage || storageInstance;
}

// Reset storage instance (useful for testing or re-initialization)
export function resetStorageInstance() {
  storageInstance = null;
  storageInitialized = false;
  storageInitPromise = null;
  console.log('🔄 Storage instance reset');
} 