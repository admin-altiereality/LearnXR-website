import React, { useState, useEffect } from 'react';
import { assetGenerationService } from '../services/assetGenerationService';

interface StorageStatus {
  meshyConfigured: boolean;
  firebaseStorageAvailable: boolean;
  alternativeStorageAvailable: boolean;
  userAuthenticated: boolean;
  errors: string[];
}

export const StorageStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const serviceStatus = await assetGenerationService.getServiceStatus();
        setStatus(serviceStatus);
      } catch (error) {
        console.error('Failed to get storage status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg z-40 text-xs">
        🔄 Checking storage...
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Determine which storage is being used
  const isUsingAlternativeStorage = !status.firebaseStorageAvailable && status.alternativeStorageAvailable;
  const isUsingFirebaseStorage = status.firebaseStorageAvailable;
  const noStorageAvailable = !status.firebaseStorageAvailable && !status.alternativeStorageAvailable;

  if (noStorageAvailable) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg z-40 text-xs flex items-center space-x-2">
        <span>❌</span>
        <span>No storage available</span>
      </div>
    );
  }

  if (isUsingAlternativeStorage) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg z-40 text-xs flex items-center space-x-2">
        <span>🔄</span>
        <span>Using alternative storage</span>
      </div>
    );
  }

  if (isUsingFirebaseStorage) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg z-40 text-xs flex items-center space-x-2">
        <span>✅</span>
        <span>Firebase storage ready</span>
      </div>
    );
  }

  return null;
}; 