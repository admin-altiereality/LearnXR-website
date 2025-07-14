import React, { useState } from 'react';
import { EnhancedMeshyPanel } from '../Components/EnhancedMeshyPanel';
import { MeshyTestPanel } from '../Components/MeshyTestPanel';
import { MeshyDebugPanel } from '../Components/MeshyDebugPanel';
import { StorageStatusIndicator } from '../Components/StorageStatusIndicator';
import { useAuth } from '../contexts/AuthContext';

const ThreeDGenerate = () => {
  const { user } = useAuth();
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState([]);

  const handleAssetGenerated = (asset) => {
    setGeneratedAssets(prev => [asset, ...prev]);
    console.log('New asset generated:', asset);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">🎨 3D Asset Generator</h1>
        <p className="text-gray-300 text-lg">
          Create stunning 3D models using AI-powered generation
        </p>
        <div className="flex justify-center space-x-4 mt-4">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="px-4 py-2 bg-blue-600/50 hover:bg-blue-600/70 text-white rounded-md text-sm transition-colors"
          >
            {showTestPanel ? 'Hide' : 'Show'} Test Panel
          </button>
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="px-4 py-2 bg-red-600/50 hover:bg-red-600/70 text-white rounded-md text-sm transition-colors"
          >
            {showDebugPanel ? 'Hide' : 'Show'} Debug Panel
          </button>
        </div>
      </div>

      {/* Test Panel */}
      {showTestPanel && (
        <div className="mb-8">
          <MeshyTestPanel />
        </div>
      )}

      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="mb-8">
          <MeshyDebugPanel />
        </div>
      )}

      {/* Main Generation Panel */}
      <div className="mb-8">
        <EnhancedMeshyPanel 
          onAssetGenerated={handleAssetGenerated}
          className="w-full"
        />
      </div>

      {/* Generated Assets Display */}
      {generatedAssets.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Recently Generated Assets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generatedAssets.map((asset, index) => (
              <div key={asset.id || index} className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-4">
                <h3 className="text-white font-medium mb-2">{asset.prompt}</h3>
                <div className="text-sm text-gray-400 mb-2">
                  Format: {asset.format} | Quality: {asset.metadata?.quality || 'medium'}
                </div>
                {asset.downloadUrl && (
                  <a
                    href={asset.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage Status */}
      <div className="mb-8">
        <StorageStatusIndicator />
      </div>

      {/* Help Section */}
      <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/30">
        <h3 className="text-lg font-semibold text-white mb-4">💡 How to Use</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
          <div>
            <h4 className="font-medium text-white mb-2">Getting Started</h4>
            <ul className="space-y-1">
              <li>• Enter a detailed description of your 3D object</li>
              <li>• Choose your preferred style and quality</li>
              <li>• Select output format (GLB recommended)</li>
              <li>• Click "Generate" and wait for completion</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-white mb-2">Tips for Better Results</h4>
            <ul className="space-y-1">
              <li>• Be specific about materials and textures</li>
              <li>• Include lighting and environment details</li>
              <li>• Use descriptive adjectives</li>
              <li>• Higher quality takes longer but looks better</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeDGenerate; 