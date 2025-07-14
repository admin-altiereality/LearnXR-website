import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetGenerationService, type AssetGenerationProgress, type AssetGenerationResult } from '../services/assetGenerationService';
import { useAuth } from '../contexts/AuthContext';
import type { StoredAsset } from '../services/assetStorageService';

interface AssetGenerationPanelProps {
  prompt: string;
  skyboxId?: string;
  onAssetsGenerated?: (assets: StoredAsset[]) => void;
  onClose?: () => void;
  isVisible: boolean;
}

const AssetGenerationPanel: React.FC<AssetGenerationPanelProps> = ({
  prompt,
  skyboxId,
  onAssetsGenerated,
  onClose,
  isVisible
}) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<AssetGenerationProgress | null>(null);
  const [extractionPreview, setExtractionPreview] = useState<any>(null);
  const [generatedAssets, setGeneratedAssets] = useState<StoredAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [style, setStyle] = useState('realistic');
  const [maxAssets, setMaxAssets] = useState(3);

  // Preview extraction when prompt changes
  useEffect(() => {
    if (prompt && prompt.trim().length > 0) {
      const preview = assetGenerationService.previewExtraction(prompt);
      setExtractionPreview(preview);
    } else {
      setExtractionPreview(null);
    }
  }, [prompt]);

  const handleGenerateAssets = async () => {
    if (!user?.uid) {
      setError('You must be logged in to generate assets');
      return;
    }

    if (!assetGenerationService.isMeshyConfigured()) {
      setError('3D asset generation is not configured. Please contact support.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedAssets([]);

    try {
      const result = await assetGenerationService.generateAssetsFromPrompt({
        originalPrompt: prompt,
        userId: user.uid,
        skyboxId,
        quality,
        style,
        maxAssets
      }, (progressUpdate) => {
        setProgress(progressUpdate);
      });

      if (result.success) {
        setGeneratedAssets(result.assets);
        onAssetsGenerated?.(result.assets);
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        successMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span>Generated ${result.assets.length} 3D assets successfully!</span>
        `;
        document.body.appendChild(successMessage);
        setTimeout(() => document.body.removeChild(successMessage), 5000);
      } else {
        setError(result.errors.join(', '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate assets');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleDownloadAsset = async (asset: StoredAsset) => {
    try {
      if (asset.downloadUrl) {
        const response = await fetch(asset.downloadUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${asset.prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${asset.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading asset:', error);
      setError('Failed to download asset');
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await assetGenerationService.deleteAsset(assetId);
      setGeneratedAssets(prev => prev.filter(asset => asset.id !== assetId));
    } catch (error) {
      setError('Failed to delete asset');
    }
  };

  const getProgressColor = (stage: string) => {
    switch (stage) {
      case 'extracting': return 'bg-blue-500';
      case 'generating': return 'bg-purple-500';
      case 'storing': return 'bg-green-500';
      case 'completed': return 'bg-green-600';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getProgressIcon = (stage: string) => {
    switch (stage) {
      case 'extracting': return '🔍';
      case 'generating': return '🎨';
      case 'storing': return '💾';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-gray-900/95 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div>
            <h2 className="text-2xl font-bold text-white">3D Asset Generation</h2>
            <p className="text-gray-400 mt-1">Generate 3D objects for your skybox environment</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Prompt Analysis */}
            {extractionPreview && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-3">Prompt Analysis</h3>
                {extractionPreview.hasObjects ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-300">
                      <span>📊 Found {extractionPreview.summary.objectCount} objects</span>
                      <span>•</span>
                      <span>Categories: {extractionPreview.summary.categories.join(', ')}</span>
                      <span>•</span>
                      <span>Confidence: {Math.round(extractionPreview.summary.confidence * 100)}%</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {extractionPreview.objects.map((obj: any, index: number) => (
                        <div key={index} className="bg-gray-700/30 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">{obj.keyword}</span>
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                              {obj.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{obj.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              Confidence: {Math.round(obj.confidence * 100)}%
                            </span>
                            <span className="text-xs text-blue-400">
                              "{obj.suggestedPrompt}"
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">No 3D objects detected in the prompt.</p>
                )}
              </div>
            )}

            {/* Generation Settings */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
              <h3 className="text-lg font-semibold text-white mb-3">Generation Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quality</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="low">Low (Fast, Basic)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Slow, Detailed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="realistic">Realistic</option>
                    <option value="stylized">Stylized</option>
                    <option value="anime">Anime</option>
                    <option value="cartoon">Cartoon</option>
                    <option value="low-poly">Low-Poly</option>
                    <option value="voxel">Voxel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Assets</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={maxAssets}
                    onChange={(e) => setMaxAssets(parseInt(e.target.value))}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Progress */}
            {progress && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl">{getProgressIcon(progress.stage)}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white capitalize">{progress.stage}</h3>
                    <p className="text-sm text-gray-400">{progress.message}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(progress.stage)}`}
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
                {progress.currentAsset && (
                  <p className="text-sm text-gray-400 mt-2">
                    Current: {progress.currentAsset} ({progress.completedAssets}/{progress.totalAssets})
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Generated Assets */}
            {generatedAssets.length > 0 && (
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-3">Generated Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {generatedAssets.map((asset) => (
                    <div key={asset.id} className="bg-gray-700/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{asset.prompt}</span>
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                          {asset.format.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-400 mb-3">
                        <span>{asset.category}</span>
                        <span>•</span>
                        <span>{asset.metadata?.generationTime ? `${Math.round(asset.metadata.generationTime / 1000)}s` : 'N/A'}</span>
                        <span>•</span>
                        <span>${asset.metadata?.cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex space-x-2">
                        {asset.downloadUrl && (
                          <button
                            onClick={() => handleDownloadAsset(asset)}
                            className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-2 rounded-lg text-sm transition-colors"
                          >
                            Download
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-2 rounded-lg text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleGenerateAssets}
                disabled={isGenerating || !extractionPreview?.hasObjects}
                className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                  isGenerating || !extractionPreview?.hasObjects
                    ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500/50 to-blue-500/50 hover:from-purple-600/60 hover:to-blue-600/60 text-white transform hover:-translate-y-0.5 active:translate-y-0'
                }`}
              >
                {isGenerating ? 'Generating...' : 'Generate 3D Assets'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AssetGenerationPanel; 