import React, { useState, useEffect, useCallback } from 'react';
import { meshyApiService, type MeshyGenerationRequest, type MeshyStyle } from '../services/meshyApiService';
import { Meshy3DViewer, MeshyAssetCard } from './Meshy3DViewer';
import { useAuth } from '../contexts/AuthContext';

interface EnhancedMeshyPanelProps {
  onAssetGenerated?: (asset: any) => void;
  onGenerationStart?: () => void;
  onClose?: () => void;
  className?: string;
}

interface GenerationProgress {
  stage: 'idle' | 'generating' | 'polling' | 'completed' | 'failed';
  progress: number;
  message: string;
  taskId?: string;
  estimatedTime?: number;
}

export const EnhancedMeshyPanel: React.FC<EnhancedMeshyPanelProps> = ({
  onAssetGenerated,
  onGenerationStart,
  onClose,
  className = ''
}) => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedArtStyle, setSelectedArtStyle] = useState<'realistic' | 'sculpture'>('realistic');
  const [selectedAiModel, setSelectedAiModel] = useState<'meshy-4' | 'meshy-5'>('meshy-4');
  const [selectedTopology, setSelectedTopology] = useState<'quad' | 'triangle'>('triangle');
  const [targetPolycount, setTargetPolycount] = useState(30000);
  const [shouldRemesh, setShouldRemesh] = useState(true);
  const [symmetryMode, setSymmetryMode] = useState<'off' | 'auto' | 'on'>('auto');
  const [moderation, setModeration] = useState(false);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to generate'
  });
  const [generatedAssets, setGeneratedAssets] = useState<any[]>([]);
  const [availableStyles, setAvailableStyles] = useState<MeshyStyle[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load available styles and usage on component mount
  useEffect(() => {
    loadStyles();
    loadUsage();
  }, []);

  const loadStyles = async () => {
    try {
      const styles = await meshyApiService.getAvailableStyles();
      setAvailableStyles(styles);
    } catch (error) {
      console.error('Failed to load styles:', error);
    }
  };

  const loadUsage = async () => {
    try {
      const usageData = await meshyApiService.getUsage();
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const validatePrompt = useCallback((text: string) => {
    if (!text.trim()) return 'Prompt is required';
    if (text.length > 600) return 'Prompt must be 600 characters or less';
    return null;
  }, []);

  const estimateCost = useCallback(() => {
    // Meshy doesn't provide quality-based pricing, using fixed cost
    return 0.05; // Estimated cost per generation
  }, []);

  const estimateTime = useCallback(() => {
    // Meshy doesn't provide quality-based timing, using fixed time
    return 90; // Estimated time in seconds
  }, []);

  const handleGenerate = async () => {
    if (!user?.uid) {
      setError('You must be logged in to generate 3D assets');
      return;
    }

    const promptError = validatePrompt(prompt);
    if (promptError) {
      setError(promptError);
      return;
    }

    if (!meshyApiService.isConfigured()) {
      setError('Meshy API is not configured. Please contact support.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({
      stage: 'generating',
      progress: 0,
      message: 'Initiating generation...'
    });
    onGenerationStart?.(); // Call the new prop

    try {
      const request: MeshyGenerationRequest = {
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        art_style: selectedArtStyle,
        seed: seed || Math.floor(Math.random() * 1000000),
        ai_model: selectedAiModel,
        topology: selectedTopology,
        target_polycount: targetPolycount,
        should_remesh: shouldRemesh,
        symmetry_mode: symmetryMode,
        moderation: moderation
      };

      // Validate request
      const validation = meshyApiService.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      setProgress({
        stage: 'generating',
        progress: 10,
        message: 'Creating generation request...'
      });

      // Generate asset
      const generation = await meshyApiService.generateAsset(request);

      setProgress({
        stage: 'polling',
        progress: 20,
        message: 'Generation started, polling for completion...',
        taskId: generation.result,
        estimatedTime: estimateTime()
      });

      // Poll for completion
      const completedAsset = await meshyApiService.pollForCompletion(generation.result);

      setProgress({
        stage: 'completed',
        progress: 100,
        message: 'Generation completed successfully!'
      });

      // Add to generated assets
      const assetWithMetadata = {
        ...completedAsset,
        metadata: {
          ...completedAsset.metadata,
          category: 'custom',
          confidence: 1,
          originalPrompt: prompt,
          userId: user.uid,
          generationTime: Date.now(),
          cost: estimateCost(),
          art_style: selectedArtStyle,
          ai_model: selectedAiModel,
          topology: selectedTopology,
          target_polycount: targetPolycount
        }
      };

      setGeneratedAssets(prev => [assetWithMetadata, ...prev]);
      onAssetGenerated?.(assetWithMetadata);

      // Reload usage
      await loadUsage();

    } catch (error) {
      console.error('Generation failed:', error);
      setError(error instanceof Error ? error.message : 'Generation failed');
      setProgress({
        stage: 'failed',
        progress: 0,
        message: 'Generation failed'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (assetId: string) => {
    const asset = generatedAssets.find(a => a.id === assetId);
    if (!asset?.downloadUrl) return;

    try {
      console.log('📥 Starting download for asset:', assetId);
      console.log('🔗 Download URL:', asset.downloadUrl);
      
      // Use the improved download method with fallback strategies
      const blob = await meshyApiService.downloadAsset(asset.downloadUrl);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asset.prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${asset.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('✅ Download completed successfully');
    } catch (error) {
      console.error('❌ Download failed:', error);
      setError(`Failed to download asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (assetId: string) => {
    setGeneratedAssets(prev => prev.filter(a => a.id !== assetId));
  };

  const handleView = (assetId: string) => {
    // This could open a modal or navigate to a full-screen viewer
    console.log('View asset:', assetId);
  };

  return (
    <div className={`bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/50 p-2 sm:p-3 lg:p-4 w-full ${className}`}>
      {/* Header - Hidden in this context since it's in the left panel */}
      {onClose && (
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">🎨 3D Asset Generator</h2>
            <p className="text-gray-400 text-xs">Powered by Meshy.ai</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Usage Info - Compact */}
      {usage && (
        <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-300">Quota:</span>
            <span className="text-white">{usage.quota_remaining}/{usage.quota_limit}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-blue-300">Cost:</span>
            <span className="text-white">${usage.total_cost.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${((usage.quota_limit - usage.quota_remaining) / usage.quota_limit) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Generation Form */}
      <div className="space-y-2 sm:space-y-3 mb-2 sm:mb-3">
        {/* Prompt Input */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Describe your 3D object *
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A futuristic spaceship with glowing engines and metallic wings"
            className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs sm:text-sm"
            rows={2}
            maxLength={600}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{prompt.length}/600</span>
            <span>${estimateCost().toFixed(2)} | ~{Math.ceil(estimateTime() / 60)}min</span>
          </div>
        </div>

        {/* Negative Prompt */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
            Negative Prompt (optional)
          </label>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="e.g., blurry, low quality, distorted"
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            maxLength={1000}
          />
        </div>

        {/* Basic Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          {/* Art Style Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
              Art Style
            </label>
            <select
              value={selectedArtStyle}
              onChange={(e) => setSelectedArtStyle(e.target.value as 'realistic' | 'sculpture')}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="realistic">Realistic</option>
              <option value="sculpture">Sculpture</option>
            </select>
          </div>

          {/* AI Model Selection */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
              AI Model
            </label>
            <select
              value={selectedAiModel}
              onChange={(e) => setSelectedAiModel(e.target.value as 'meshy-4' | 'meshy-5')}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="meshy-4">Meshy 4 (Faster)</option>
              <option value="meshy-5">Meshy 5 (Better Quality)</option>
            </select>
          </div>
        </div>

        {/* Advanced Controls Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          <span>Advanced Options</span>
        </button>

        {/* Advanced Controls */}
        {showAdvanced && (
          <div className="space-y-3 sm:space-y-4 p-2 sm:p-3 lg:p-4 bg-gray-800/30 rounded-lg border border-gray-700/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {/* Topology */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Topology
                </label>
                <select
                  value={selectedTopology}
                  onChange={(e) => setSelectedTopology(e.target.value as 'quad' | 'triangle')}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="triangle">Triangle (Default)</option>
                  <option value="quad">Quad (Better for editing)</option>
                </select>
              </div>

              {/* Target Polycount */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Target Polycount
                </label>
                <input
                  type="number"
                  min="100"
                  max="300000"
                  value={targetPolycount}
                  onChange={(e) => setTargetPolycount(parseInt(e.target.value))}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Range: 100 - 300,000
                </div>
              </div>

              {/* Symmetry Mode */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Symmetry Mode
                </label>
                <select
                  value={symmetryMode}
                  onChange={(e) => setSymmetryMode(e.target.value as 'off' | 'auto' | 'on')}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="auto">Auto (Recommended)</option>
                  <option value="on">On (Force symmetry)</option>
                  <option value="off">Off (No symmetry)</option>
                </select>
              </div>

              {/* Seed */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-2">
                  Seed (Optional)
                </label>
                <input
                  type="number"
                  value={seed || ''}
                  onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Random"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/50 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Leave empty for random
                </div>
              </div>
            </div>

            {/* Remesh and Moderation Options */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={shouldRemesh}
                  onChange={(e) => setShouldRemesh(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-300">Should Remesh (Recommended)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={moderation}
                  onChange={(e) => setModeration(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-300">Enable Content Moderation</span>
              </label>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-2 sm:p-3 bg-red-900/50 border border-red-500/50 rounded-md">
            <div className="text-red-400 text-xs sm:text-sm">{error}</div>
          </div>
        )}

        {/* Progress Display */}
        {isGenerating && (
          <div className="p-2 sm:p-3 lg:p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-blue-300 text-xs sm:text-sm">{progress.message}</span>
              <span className="text-white text-xs sm:text-sm">{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2">
              <div 
                className="bg-blue-500 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>
            {progress.estimatedTime && (
              <div className="text-xs text-gray-400 mt-1">
                ~{Math.ceil(progress.estimatedTime / 60)} minutes remaining
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full py-2 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-blue-500/50 to-purple-600/50 hover:from-blue-600/60 hover:to-purple-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50 text-sm sm:text-base"
        >
          {isGenerating ? 'Generating...' : `Generate 3D Asset (${estimateCost().toFixed(2)})`}
        </button>
      </div>

      {/* Generated Assets */}
      {generatedAssets.length > 0 && (
        <div className="mt-4 sm:mt-6 lg:mt-8">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-4">Generated Assets</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            {generatedAssets.map((asset) => (
              <MeshyAssetCard
                key={asset.id}
                asset={asset}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onView={handleView}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 