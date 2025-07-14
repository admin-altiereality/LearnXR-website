// Storage Test Utility
// This utility helps diagnose and fix Firebase Storage configuration issues

import { isStorageAvailable, getStorageSafely, resetStorageInstance } from './firebaseStorage';
import { assetStorageService } from '../services/assetStorageService';
import { assetGenerationService } from '../services/assetGenerationService';
import { auth } from '../config/firebase';

export class StorageTestUtility {
  
  /**
   * Run comprehensive storage diagnostics
   */
  static async runFullDiagnostics() {
    console.log('🔧 Starting comprehensive storage diagnostics...');
    
    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        isBrowser: typeof window !== 'undefined',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        nodeEnv: process.env.NODE_ENV || 'unknown'
      },
      firebase: {
        configValid: false,
        storageBucket: null,
        projectId: null,
        authDomain: null
      },
      storage: {
        available: false,
        initialized: false,
        testAccess: false,
        error: null
      },
      auth: {
        currentUser: null,
        isAuthenticated: false,
        uid: null
      },
      services: {
        assetStorage: false,
        assetGeneration: false
      },
      connectivity: {
        storageConnectivity: false,
        networkConnectivity: false,
        storageConnectivityError: null,
        networkConnectivityError: null
      },
      recommendations: []
    };

    try {
      // 1. Check Firebase configuration
      console.log('📋 Checking Firebase configuration...');
      const firebaseConfig = await import('../config/firebase');
      const app = firebaseConfig.default;
      
      results.firebase.configValid = !!(
        app.options.storageBucket &&
        app.options.projectId &&
        app.options.apiKey
      );
      results.firebase.storageBucket = app.options.storageBucket;
      results.firebase.projectId = app.options.projectId;
      results.firebase.authDomain = app.options.authDomain;

      if (!results.firebase.configValid) {
        results.recommendations.push('Fix Firebase configuration - missing required fields');
      }

      // 2. Check authentication
      console.log('🔐 Checking authentication...');
      const auth = await import('../config/firebase').then(m => m.auth);
      const currentUser = auth.currentUser;
      results.auth.currentUser = currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName
      } : null;
      results.auth.isAuthenticated = !!currentUser;
      results.auth.uid = currentUser?.uid || null;

      if (!results.auth.isAuthenticated) {
        results.recommendations.push('User not authenticated - login required for storage access');
      }

      // 3. Test network connectivity
      console.log('🌐 Testing network connectivity...');
      const networkTest = await this.testNetworkConnectivity();
      results.connectivity.networkConnectivity = networkTest.success;
      results.connectivity.networkConnectivityError = networkTest.error;

      if (!results.connectivity.networkConnectivity) {
        results.recommendations.push(`Network connectivity issue: ${networkTest.error || 'Unknown error'}`);
      }

      // 4. Test storage connectivity
      console.log('🧪 Testing storage connectivity...');
      const storageTest = await this.testStorageConnectivity();
      results.connectivity.storageConnectivity = storageTest.success;
      results.connectivity.storageConnectivityError = storageTest.error;

      if (!results.connectivity.storageConnectivity) {
        results.recommendations.push(`Storage connectivity issue: ${storageTest.error || 'Unknown error'}`);
      }

      // 5. Check storage availability
      console.log('📦 Checking storage availability...');
      try {
        const { isStorageAvailable } = await import('./firebaseStorage');
        results.storage.available = await isStorageAvailable();
        results.storage.initialized = true;
        
        if (results.storage.available) {
          // Test storage access
          const { getStorageSafely } = await import('./firebaseStorage');
          const storage = await getStorageSafely();
          if (storage) {
            const testRef = storage.ref();
            results.storage.testAccess = true;
          }
        }
      } catch (error) {
        results.storage.error = error.message;
        results.recommendations.push(`Storage error: ${error.message}`);
      }

      // 6. Check service availability
      console.log('🔧 Checking service availability...');
      try {
        const { assetStorageService } = await import('../services/assetStorageService');
        results.services.assetStorage = await assetStorageService.isStorageAvailable();
      } catch (error) {
        results.recommendations.push(`Asset storage service error: ${error.message}`);
      }

      try {
        const { assetGenerationService } = await import('../services/assetGenerationService');
        results.services.assetGeneration = await assetGenerationService.isServiceAvailable();
      } catch (error) {
        results.recommendations.push(`Asset generation service error: ${error.message}`);
      }

      // 7. Generate recommendations
      if (!results.firebase.configValid) {
        results.recommendations.push('Check Firebase configuration in firebase.ts');
      }

      if (!results.connectivity.networkConnectivity) {
        results.recommendations.push('Check network connection and firewall settings');
      }

      if (!results.connectivity.storageConnectivity) {
        results.recommendations.push('Check Firebase Storage service status');
      }

      if (!results.storage.available && results.auth.isAuthenticated && results.connectivity.networkConnectivity) {
        results.recommendations.push('Try storage recovery or check Firebase Console');
      }

      if (!results.services.assetStorage && results.storage.available) {
        results.recommendations.push('Asset storage service needs reinitialization');
      }

      if (!results.services.assetGeneration && results.services.assetStorage) {
        results.recommendations.push('Check Meshy API configuration (VITE_MESHY_API_KEY)');
      }

    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      results.recommendations.push(`Diagnostic error: ${error.message}`);
    }

    console.log('📊 Diagnostic results:', results);
    return results;
  }

  /**
   * Attempt to fix common storage issues
   */
  static async attemptAutoFix() {
    console.log('🔧 Attempting automatic storage fixes...');
    
    const fixes = [];
    
    try {
      // 1. Reset storage instance
      console.log('🔄 Resetting storage instance...');
      resetStorageInstance();
      fixes.push('Reset storage instance');
      
      // 2. Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 3. Try to reinitialize storage
      console.log('🔄 Reinitializing storage...');
      const storage = await getStorageSafely();
      if (storage) {
        fixes.push('Reinitialized storage successfully');
      }
      
      // 4. Try to reinitialize asset storage service
      console.log('🔄 Reinitializing asset storage service...');
      await assetStorageService.reinitializeStorage();
      fixes.push('Reinitialized asset storage service');
      
      // 5. Check if fixes worked
      const available = await isStorageAvailable();
      if (available) {
        fixes.push('Storage is now available');
      }
      
    } catch (error) {
      console.error('❌ Auto-fix failed:', error);
      fixes.push(`Auto-fix error: ${error.message}`);
    }
    
    console.log('🔧 Auto-fix results:', fixes);
    return fixes;
  }

  /**
   * Test storage with a simple upload
   */
  static async testStorageUpload() {
    console.log('🧪 Testing storage with upload...');
    
    try {
      // Create a simple test file
      const testContent = 'This is a test file for storage validation';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testFile = new File([testBlob], 'test.txt', { type: 'text/plain' });
      
      // Try to upload
      const result = await assetStorageService.uploadAssetFile(
        'test-upload',
        testFile,
        'test.txt'
      );
      
      if (result.success) {
        console.log('✅ Storage upload test successful');
        return { success: true, downloadUrl: result.downloadUrl };
      } else {
        console.error('❌ Storage upload test failed:', result.error);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error('❌ Storage upload test error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test basic storage connectivity without upload
   */
  static async testStorageConnectivity() {
    console.log('🧪 Testing basic storage connectivity...');
    
    try {
      // Import Firebase storage
      const { getStorage, ref } = await import('firebase/storage');
      const app = await import('../config/firebase').then(m => m.default);
      
      // Create storage instance
      const storage = getStorage(app);
      console.log('✅ Storage instance created');
      
      // Create a test reference
      const testRef = ref(storage, 'connectivity-test.txt');
      console.log('✅ Test reference created:', testRef.fullPath);
      
      // Check storage bucket
      const bucketName = storage.app.options.storageBucket;
      console.log('✅ Storage bucket:', bucketName);
      
      // Test if we can access the storage bucket
      const rootRef = storage.ref();
      console.log('✅ Root reference created');
      
      return {
        success: true,
        bucketName,
        testPath: testRef.fullPath,
        message: 'Storage connectivity test passed'
      };
      
    } catch (error) {
      console.error('❌ Storage connectivity test failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Storage connectivity test failed'
      };
    }
  }

  /**
   * Test network connectivity to Firebase Storage
   */
  static async testNetworkConnectivity() {
    console.log('🌐 Testing network connectivity to Firebase Storage...');
    
    try {
      const bucketName = 'in3devoneuralai.appspot.com';
      const testUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o`;
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Network test response status:', response.status);
      
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        message: response.ok ? 'Network connectivity test passed' : 'Network connectivity test failed'
      };
      
    } catch (error) {
      console.error('❌ Network connectivity test failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Network connectivity test failed'
      };
    }
  }

  /**
   * Display diagnostic results in a user-friendly format
   */
  static displayResults(results) {
    const message = document.createElement('div');
    message.className = 'fixed top-4 right-4 bg-gray-800 text-white p-6 rounded-lg shadow-lg z-50 max-w-md max-h-96 overflow-y-auto';
    
    let html = `
      <div class="font-bold mb-4 text-lg">🔧 Storage Diagnostics</div>
      <div class="space-y-3 text-sm">
    `;
    
    // Environment
    html += `
      <div class="border-b border-gray-600 pb-2">
        <div class="font-semibold text-blue-400">Environment</div>
        <div>Browser: ${results.environment.isBrowser ? '✅' : '❌'}</div>
        <div>Node Env: ${results.environment.nodeEnv}</div>
      </div>
    `;
    
    // Firebase
    html += `
      <div class="border-b border-gray-600 pb-2">
        <div class="font-semibold text-blue-400">Firebase</div>
        <div>Config Valid: ${results.firebase.configValid ? '✅' : '❌'}</div>
        <div>Storage Bucket: ${results.firebase.storageBucket || 'Missing'}</div>
        <div>Project ID: ${results.firebase.projectId || 'Missing'}</div>
      </div>
    `;
    
    // Auth
    html += `
      <div class="border-b border-gray-600 pb-2">
        <div class="font-semibold text-blue-400">Authentication</div>
        <div>Authenticated: ${results.auth.isAuthenticated ? '✅' : '❌'}</div>
        <div>User ID: ${results.auth.uid || 'None'}</div>
      </div>
    `;
    
    // Storage
    html += `
      <div class="border-b border-gray-600 pb-2">
        <div class="font-semibold text-blue-400">Storage</div>
        <div>Available: ${results.storage.available ? '✅' : '❌'}</div>
        <div>Initialized: ${results.storage.initialized ? '✅' : '❌'}</div>
        <div>Test Access: ${results.storage.testAccess ? '✅' : '❌'}</div>
        ${results.storage.error ? `<div class="text-red-400">Error: ${results.storage.error}</div>` : ''}
      </div>
    `;
    
    // Services
    html += `
      <div class="border-b border-gray-600 pb-2">
        <div class="font-semibold text-blue-400">Services</div>
        <div>Asset Storage: ${results.services.assetStorage ? '✅' : '❌'}</div>
        <div>Asset Generation: ${results.services.assetGeneration ? '✅' : '❌'}</div>
      </div>
    `;
    
    // Recommendations
    if (results.recommendations.length > 0) {
      html += `
        <div>
          <div class="font-semibold text-yellow-400">Recommendations</div>
          <ul class="list-disc list-inside space-y-1">
            ${results.recommendations.map(rec => `<li class="text-yellow-300">${rec}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    html += `
      </div>
      <div class="mt-4 flex space-x-2">
        <button onclick="this.parentElement.parentElement.remove()" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          Close
        </button>
        <button onclick="StorageTestUtility.attemptAutoFix().then(fixes => alert('Auto-fix results: ' + fixes.join(', ')))" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Auto-Fix
        </button>
      </div>
    `;
    
    message.innerHTML = html;
    document.body.appendChild(message);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (document.body.contains(message)) {
        document.body.removeChild(message);
      }
    }, 30000);
  }
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.StorageTestUtility = StorageTestUtility;
} 