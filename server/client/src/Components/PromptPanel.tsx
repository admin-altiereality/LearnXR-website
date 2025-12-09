// PromptPanel - Unified UI for Skybox + Mesh Generation
// Single prompt drives both services simultaneously

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FaPlay, 
  FaStop, 
  FaDownload, 
  FaEye, 
  FaCog, 
  FaRocket,
  FaImage,
  FaCube,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSpinner
} from 'react-icons/fa';
import { useGenerate } from '../hooks/useGenerate';
import { useAuth } from '../contexts/AuthContext';
import { skyboxApiService } from '../services/skyboxApiService';
import type { GenerationRequest } from '../types/unifiedGeneration';
import type { SkyboxStyle } from '../types/skybox';

interface PromptPanelProps {
  onAssetsGenerated?: (jobId: string) => void;
  onGenerationStart?: () => void;
  onClose?: () => void;
  className?: string;
}

interface SkyboxStyle {
  id: string;
  name: string;
  image: string;
  description?: string;
}

export const PromptPanel: React.FC<PromptPanelProps> = ({
  onAssetsGenerated,
  onGenerationStart,
  onClose,
  className = ''
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    isGenerating,
    progress,
    currentJob,
    error,
    generateAssets,
    downloadAsset,
    cancelGeneration
  } = useGenerate();
  
  // Debug logging for progress
  useEffect(() => {
    if (progress) {
      console.log('📊 PromptPanel progress update:', {
        stage: progress.stage,
        skyboxProgress: progress.skyboxProgress,
        meshProgress: progress.meshProgress,
        overallProgress: progress.overallProgress,
        message: progress.message,
        isGenerating
      });
    }
  }, [progress, isGenerating]);

  // Form state
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<SkyboxStyle | null>(null);
  const [enableSkybox, setEnableSkybox] = useState(true);
  const [enableMesh, setEnableMesh] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced settings
  const [meshQuality, setMeshQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('medium');
  const [meshStyle, setMeshStyle] = useState<'realistic' | 'sculpture' | 'cartoon' | 'anime'>('realistic');
  const [meshFormat, setMeshFormat] = useState<'glb' | 'usdz' | 'obj' | 'fbx'>('glb');
  
  // UI state
  const [availableStyles, setAvailableStyles] = useState<SkyboxStyle[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Load available skybox styles
  const loadStyles = useCallback(async () => {
    try {
      setStylesLoading(true);
      const response = await skyboxApiService.getStyles();
      // Handle nested response structure: { success, data: { styles: [...] } }
      const rawStyles = response?.data?.styles || response?.styles || response?.data || [];
      const stylesArr = Array.isArray(rawStyles) ? rawStyles : [];
      if (stylesArr.length > 0) {
        setAvailableStyles(stylesArr);
        // Auto-select first style if none selected
        if (!selectedStyle && stylesArr.length > 0) {
          setSelectedStyle(stylesArr[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load skybox styles:', error);
      
      // If skybox service is down, disable skybox generation but allow mesh generation
      if (error instanceof Error && error.message.includes('not configured properly')) {
        setEnableSkybox(false);
        // Show a user-friendly message
        const warningMessage = document.createElement('div');
        warningMessage.className = 'fixed top-4 right-4 bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        warningMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          <span>Skybox service is temporarily unavailable. Mesh generation is still available.</span>
        `;
        document.body.appendChild(warningMessage);
        setTimeout(() => {
          if (document.body.contains(warningMessage)) {
            document.body.removeChild(warningMessage);
          }
        }, 8000);
      }
    } finally {
      setStylesLoading(false);
    }
  }, [selectedStyle]);

  useEffect(() => {
    loadStyles();
  }, [loadStyles]);

  // Validate form
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (!prompt.trim()) {
      errors.push('Prompt is required');
    }
    
    if (prompt.length > 1000) {
      errors.push('Prompt must be 1000 characters or less');
    }
    
    if (enableSkybox && !selectedStyle && availableStyles.length > 0) {
      errors.push('Please select a skybox style');
    }
    
    if (enableSkybox && availableStyles.length === 0 && !stylesLoading) {
      errors.push('Skybox service is currently unavailable. Please try mesh generation only.');
    }
    
    if (!enableSkybox && !enableMesh) {
      errors.push('At least one generation type must be enabled');
    }
    
    return errors;
  }, [prompt, enableSkybox, enableMesh, selectedStyle]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    if (!user?.uid) {
      alert('Please log in to generate assets');
      return;
    }

    const errors = validateForm();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    console.log('🎮 Starting generation from PromptPanel:', {
      prompt: prompt.trim(),
      enableSkybox,
      enableMesh,
      selectedStyle: selectedStyle?.id,
      meshQuality,
      meshStyle
    });

    onGenerationStart?.();

    const request: GenerationRequest = {
      prompt: prompt.trim(),
      userId: user.uid,
      skyboxConfig: enableSkybox && selectedStyle ? {
        styleId: selectedStyle.id,
        negativePrompt: negativePrompt.trim() || undefined
      } : undefined,
      meshConfig: enableMesh ? {
        quality: meshQuality,
        style: meshStyle,
        format: meshFormat
      } : false
    };

    console.log('📤 Sending generation request:', request);

    try {
      const response = await generateAssets(request);
      console.log('📥 Generation response:', response);
      
      if (response.success) {
        console.log('✅ Generation successful, job ID:', response.jobId);
        onAssetsGenerated?.(response.jobId);
        setIsMinimized(true);
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        successMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span>Assets generated successfully!</span>
        `;
        document.body.appendChild(successMessage);
        setTimeout(() => {
          if (document.body.contains(successMessage)) {
            document.body.removeChild(successMessage);
          }
        }, 5000);
      } else {
        console.error('❌ Generation failed:', response.errors);
        
        // Show partial success message if mesh worked but skybox failed
        if (response.errors.some(error => error.includes('Skybox service'))) {
          const partialMessage = document.createElement('div');
          partialMessage.className = 'fixed top-4 right-4 bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
          partialMessage.innerHTML = `
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <span>Mesh generated successfully! Skybox service is temporarily unavailable.</span>
          `;
          document.body.appendChild(partialMessage);
          setTimeout(() => {
            if (document.body.contains(partialMessage)) {
              document.body.removeChild(partialMessage);
            }
          }, 6000);
        }
      }
    } catch (error) {
      console.error('💥 Generation error:', error);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('Skybox service is not available')) {
          // Automatically disable skybox and suggest mesh-only generation
          setEnableSkybox(false);
          
          const suggestionMessage = document.createElement('div');
          suggestionMessage.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
          suggestionMessage.innerHTML = `
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
            <span>Skybox service is down. Try mesh generation only instead!</span>
          `;
          document.body.appendChild(suggestionMessage);
          setTimeout(() => {
            if (document.body.contains(suggestionMessage)) {
              document.body.removeChild(suggestionMessage);
            }
          }, 6000);
        }
      }
    }
  }, [
    user,
    prompt,
    negativePrompt,
    selectedStyle,
    enableSkybox,
    enableMesh,
    meshQuality,
    meshStyle,
    meshFormat,
    validateForm,
    generateAssets,
    onGenerationStart,
    onAssetsGenerated
  ]);

  // Handle download
  const handleDownload = useCallback(async (type: 'skybox' | 'mesh') => {
    if (!currentJob) return;

    try {
      await downloadAsset(currentJob.id, type);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Failed to download ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [currentJob, downloadAsset]);

  // Handle preview
  const handlePreview = useCallback(() => {
    if (!currentJob) return;
    navigate(`/preview/${currentJob.id}`);
  }, [currentJob, navigate]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (!currentJob) return;
    
    try {
      await cancelGeneration(currentJob.id);
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  }, [currentJob, cancelGeneration]);

  // Progress bar component
  const ProgressBar: React.FC<{ label: string; progress: number; active: boolean }> = ({ 
    label, 
    progress, 
    active 
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className={`${active ? 'text-blue-400' : 'text-gray-400'}`}>{label}</span>
        <span className="text-gray-300">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            active ? 'bg-blue-500' : 'bg-gray-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  // Result thumbnail component
  const ResultThumbnail: React.FC<{ 
    type: 'skybox' | 'mesh'; 
    available: boolean; 
    error?: string;
  }> = ({ type, available, error }) => {
    const isReady = available && !error;
    const Icon = type === 'skybox' ? FaImage : FaCube;
    
    return (
      <div className={`relative p-4 rounded-lg border-2 ${
        isReady ? 'border-green-500 bg-green-500/10' : 
        error ? 'border-red-500 bg-red-500/10' : 
        'border-gray-500 bg-gray-500/10'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Icon className={`w-5 h-5 ${
              isReady ? 'text-green-400' : error ? 'text-red-400' : 'text-gray-400'
            }`} />
            <span className="text-sm font-medium capitalize">{type}</span>
          </div>
          {isReady && (
            <FaCheckCircle className="w-4 h-4 text-green-400" />
          )}
          {error && (
            <FaExclamationTriangle className="w-4 h-4 text-red-400" />
          )}
        </div>
        
        {error && (
          <p className="text-xs text-red-300 mb-2">{error}</p>
        )}
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleDownload(type)}
            disabled={!isReady}
            className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
              isReady 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <FaDownload className="w-3 h-3 mr-1 inline" />
            Download
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <FaRocket className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Unified Generation</h2>
          {isGenerating && (
            <FaSpinner className="w-4 h-4 text-blue-400 animate-spin" />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <span className="text-gray-400">
              {isMinimized ? '□' : '−'}
            </span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded text-gray-400"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  maxLength={1000}
                  disabled={isGenerating}
                />
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{prompt.length}/1000</span>
                  <span>Be descriptive for better results</span>
                </div>
              </div>

              {/* Generation Options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enable-skybox"
                    checked={enableSkybox}
                    onChange={(e) => setEnableSkybox(e.target.checked)}
                    disabled={isGenerating}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enable-skybox" className="text-sm text-gray-300">
                    <FaImage className="w-4 h-4 inline mr-1" />
                    Generate Skybox
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enable-mesh"
                    checked={enableMesh}
                    onChange={(e) => setEnableMesh(e.target.checked)}
                    disabled={isGenerating}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="enable-mesh" className="text-sm text-gray-300">
                    <FaCube className="w-4 h-4 inline mr-1" />
                    Generate 3D Mesh
                  </label>
                </div>
              </div>

              {/* Skybox Style Selection */}
              {enableSkybox && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Skybox Style
                  </label>
                  {stylesLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <FaSpinner className="w-5 h-5 animate-spin text-blue-400" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                      {availableStyles.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style)}
                          disabled={isGenerating}
                          className={`p-2 rounded-lg border-2 transition-all ${
                            selectedStyle?.id === style.id
                              ? 'border-blue-500 bg-blue-500/20'
                              : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                          }`}
                        >
                          <img
                            src={style.image}
                            alt={style.name}
                            className="w-full h-12 object-cover rounded"
                          />
                          <p className="text-xs text-gray-300 mt-1 truncate">
                            {style.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Settings */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center space-x-2 text-sm text-gray-400 hover:text-gray-300"
                >
                  <FaCog className="w-4 h-4" />
                  <span>Advanced Settings</span>
                  <span className="transform transition-transform duration-200" style={{
                    transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </span>
                </button>
                
                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 space-y-3 overflow-hidden"
                    >
                      {/* Negative Prompt */}
                      {enableSkybox && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Negative Prompt (optional)
                          </label>
                          <input
                            type="text"
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="What to avoid..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isGenerating}
                          />
                        </div>
                      )}

                      {/* Mesh Settings */}
                      {enableMesh && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Quality
                            </label>
                            <select
                              value={meshQuality}
                              onChange={(e) => setMeshQuality(e.target.value as any)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isGenerating}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="ultra">Ultra</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Style
                            </label>
                            <select
                              value={meshStyle}
                              onChange={(e) => setMeshStyle(e.target.value as any)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isGenerating}
                            >
                              <option value="realistic">Realistic</option>
                              <option value="sculpture">Sculpture</option>
                              <option value="cartoon">Cartoon</option>
                              <option value="anime">Anime</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Format
                            </label>
                            <select
                              value={meshFormat}
                              onChange={(e) => setMeshFormat(e.target.value as any)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isGenerating}
                            >
                              <option value="glb">GLB</option>
                              <option value="usdz">USDZ</option>
                              <option value="obj">OBJ</option>
                              <option value="fbx">FBX</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Generate Button */}
              <button
                onClick={isGenerating ? handleCancel : handleGenerate}
                disabled={!enableSkybox && !enableMesh}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  isGenerating
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <FaStop className="w-4 h-4 mr-2 inline" />
                    Cancel Generation
                  </>
                ) : (
                  <>
                    <FaPlay className="w-4 h-4 mr-2 inline" />
                    Generate Assets
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Section */}
      <AnimatePresence>
        {(isGenerating || currentJob) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-gray-700 p-4 space-y-4"
          >
            {/* Progress Bars */}
            {isGenerating && progress && (
              <div className="space-y-3">
                <div className="text-sm text-gray-300 mb-2">
                  {progress.message}
                </div>
                
                {enableSkybox && (
                  <ProgressBar
                    label="Skybox Generation"
                    progress={progress.skyboxProgress || 0}
                    active={progress.stage === 'skybox_generating'}
                  />
                )}
                
                {enableMesh && (
                  <ProgressBar
                    label="3D Mesh Generation"
                    progress={progress.meshProgress || 0}
                    active={progress.stage === 'mesh_generating'}
                  />
                )}
                
                <ProgressBar
                  label="Overall Progress"
                  progress={progress.overallProgress || 0}
                  active={true}
                />
                
                {/* Debug info */}
                <div className="text-xs text-gray-500 mt-2">
                  Stage: {progress.stage} | Job: {progress.jobId}
                </div>
              </div>
            )}

            {/* Results */}
            {currentJob && !isGenerating && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Generated Assets</h3>
                  {(currentJob.skyboxUrl || currentJob.meshUrl) && (
                    <button
                      onClick={handlePreview}
                      className="flex items-center space-x-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm text-white transition-colors"
                    >
                      <FaEye className="w-3 h-3" />
                      <span>Preview in 3D</span>
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {enableSkybox && (
                    <ResultThumbnail
                      type="skybox"
                      available={!!currentJob.skyboxUrl}
                      error={currentJob.errors.find(e => e.toLowerCase().includes('skybox'))}
                    />
                  )}
                  
                  {enableMesh && (
                    <ResultThumbnail
                      type="mesh"
                      available={!!currentJob.meshUrl}
                      error={currentJob.errors.find(e => e.toLowerCase().includes('mesh'))}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FaExclamationTriangle className="w-4 h-4 text-red-400" />
                  <div className="flex-1">
                    <span className="text-sm text-red-300">{error}</span>
                    {error.includes('CORS') && (
                      <div className="text-xs text-red-400/80 mt-1">
                        This may be due to network restrictions. The system will use fallback strategies to handle this.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}; 