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
  FaSpinner,
  FaNetworkWired
} from 'react-icons/fa';
import { useGenerate } from '../hooks/useGenerate';
import { useAuth } from '../contexts/AuthContext';
import { skyboxApiService } from '../services/skyboxApiService';
import { promptParserService, type ParsedPrompt } from '../services/promptParserService';
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

  // Analyze prompt when it changes
  useEffect(() => {
    if (prompt.trim().length > 0) {
      try {
        const parsed = promptParserService.parsePrompt(prompt);
        setParsedPrompt(parsed);
        console.log('🔍 Prompt analysis:', {
          promptType: parsed.promptType,
          meshScore: parsed.meshScore,
          skyboxScore: parsed.skyboxScore,
          confidence: parsed.confidence
        });

        // Auto-suggest based on analysis (only if user hasn't manually set both)
        const hasManualSelection = enableSkybox !== enableMesh; // User has made a choice
        
        if (!hasManualSelection && parsed.promptType === 'mesh' && parsed.meshScore > 0.6) {
          // Strong mesh signal - auto-enable mesh, disable skybox
          setEnableMesh(true);
          setEnableSkybox(false);
          console.log('💡 Auto-enabled mesh generation based on prompt analysis');
        } else if (!hasManualSelection && parsed.promptType === 'skybox' && parsed.skyboxScore > 0.6) {
          // Strong skybox signal - auto-enable skybox, disable mesh
          setEnableSkybox(true);
          setEnableMesh(false);
          console.log('💡 Auto-enabled skybox generation based on prompt analysis');
        } else if (!hasManualSelection && parsed.promptType === 'both' && parsed.meshScore > 0.4 && parsed.skyboxScore > 0.4) {
          // Both detected - enable both
          setEnableSkybox(true);
          setEnableMesh(true);
          console.log('💡 Auto-enabled both generation types based on prompt analysis');
        }
      } catch (error) {
        console.error('Error analyzing prompt:', error);
        setParsedPrompt(null);
      }
    } else {
      setParsedPrompt(null);
    }
  }, [prompt, enableMesh, enableSkybox]);

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
  
  // Wireframe export settings
  const [enableWireframe, setEnableWireframe] = useState(false);
  const [wireframeMeshDensity, setWireframeMeshDensity] = useState<'low' | 'medium' | 'high' | 'epic'>('medium');
  const [wireframeDepthScale, setWireframeDepthScale] = useState<number>(3.0);
  const [showWireframePanel, setShowWireframePanel] = useState(false);
  
  // UI state
  const [availableStyles, setAvailableStyles] = useState<SkyboxStyle[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [parsedPrompt, setParsedPrompt] = useState<ParsedPrompt | null>(null);

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
        negativePrompt: negativePrompt.trim() || undefined,
        exportWireframe: enableWireframe,
        meshDensity: enableWireframe ? wireframeMeshDensity : undefined,
        depthScale: enableWireframe ? wireframeDepthScale : undefined
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
    enableWireframe,
    wireframeMeshDensity,
    wireframeDepthScale,
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

              {/* Prompt Analysis */}
              {parsedPrompt && prompt.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                      <FaRocket className="w-4 h-4 text-blue-400" />
                      <span>Prompt Analysis</span>
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      parsedPrompt.promptType === 'mesh'
                        ? 'bg-purple-500/20 text-purple-300'
                        : parsedPrompt.promptType === 'skybox'
                        ? 'bg-blue-500/20 text-blue-300'
                        : parsedPrompt.promptType === 'both'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-gray-500/20 text-gray-300'
                    }`}>
                      {parsedPrompt.promptType === 'mesh' ? '3D Mesh' :
                       parsedPrompt.promptType === 'skybox' ? 'Skybox' :
                       parsedPrompt.promptType === 'both' ? 'Both' : 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Mesh Score */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 flex items-center space-x-1">
                          <FaCube className="w-3 h-3" />
                          <span>3D Mesh Likelihood</span>
                        </span>
                        <span className="text-xs text-gray-300 font-medium">
                          {Math.round(parsedPrompt.meshScore * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-300"
                          style={{ width: `${parsedPrompt.meshScore * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Skybox Score */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 flex items-center space-x-1">
                          <FaImage className="w-3 h-3" />
                          <span>Skybox Likelihood</span>
                        </span>
                        <span className="text-xs text-gray-300 font-medium">
                          {Math.round(parsedPrompt.skyboxScore * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                          style={{ width: `${parsedPrompt.skyboxScore * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Suggestions */}
                    {parsedPrompt.promptType !== 'unknown' && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        {parsedPrompt.promptType === 'mesh' && parsedPrompt.meshScore > 0.6 && !enableMesh && (
                          <div className="flex items-start space-x-2 text-xs text-purple-300">
                            <FaExclamationTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>This prompt appears to describe a 3D mesh object. Consider enabling <strong>Generate 3D Mesh</strong>.</span>
                          </div>
                        )}
                        {parsedPrompt.promptType === 'skybox' && parsedPrompt.skyboxScore > 0.6 && !enableSkybox && (
                          <div className="flex items-start space-x-2 text-xs text-blue-300">
                            <FaExclamationTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>This prompt appears to describe a skybox environment. Consider enabling <strong>Generate Skybox</strong>.</span>
                          </div>
                        )}
                        {parsedPrompt.promptType === 'both' && (
                          <div className="flex items-start space-x-2 text-xs text-green-300">
                            <FaCheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span>This prompt contains both mesh objects and skybox elements. Both generation types are recommended.</span>
                          </div>
                        )}
                        {parsedPrompt.confidence > 0.5 && (
                          <div className="mt-2 text-xs text-gray-400">
                            Confidence: {Math.round(parsedPrompt.confidence * 100)}% • Method: {parsedPrompt.method}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

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

              {/* Wireframe Export Button - Always visible when skybox is enabled */}
              {enableSkybox ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Wireframe button clicked, opening panel');
                      setShowWireframePanel(true);
                    }}
                    disabled={isGenerating}
                    className={`w-full flex items-center justify-between p-4 rounded-xl text-sm font-semibold transition-all shadow-lg ${
                      enableWireframe
                        ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 border-2 border-green-500/60 text-green-200 hover:from-green-600/40 hover:to-emerald-600/40'
                        : 'bg-gradient-to-r from-gray-800/80 to-gray-700/80 border-2 border-gray-600/50 text-gray-200 hover:border-gray-500 hover:from-gray-700/90 hover:to-gray-600/90'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        enableWireframe 
                          ? 'bg-green-500/20' 
                          : 'bg-gray-700/50'
                      }`}>
                        <FaNetworkWired className={`w-5 h-5 ${enableWireframe ? 'text-green-400' : 'text-gray-400'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-bold text-base">Wireframe 3D Export</div>
                        <div className="text-xs opacity-75">
                          {enableWireframe ? 'Export enabled with current settings' : 'Click to configure wireframe export'}
                        </div>
                      </div>
                      {enableWireframe && (
                        <span className="px-3 py-1 bg-green-500/30 text-green-300 text-xs font-bold rounded-full border border-green-500/50">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg text-center">
                  <p className="text-xs text-gray-400">
                    Enable <span className="text-blue-400">Generate Skybox</span> to access Wireframe 3D Export
                  </p>
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

                      {/* Wireframe Export Settings */}
                      {enableSkybox && enableWireframe && (
                        <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                          <div className="flex items-center space-x-2 mb-2">
                            <FaNetworkWired className="w-4 h-4 text-purple-400" />
                            <label className="text-sm font-medium text-gray-300">
                              Wireframe Settings
                            </label>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">
                                Mesh Density
                              </label>
                              <select
                                value={wireframeMeshDensity}
                                onChange={(e) => setWireframeMeshDensity(e.target.value as any)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                disabled={isGenerating}
                              >
                                <option value="low">Low (~30-40MB)</option>
                                <option value="medium">Medium (~40-50MB)</option>
                                <option value="high">High (~60-70MB)</option>
                                <option value="epic">Epic (~200-300MB)</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">
                                Depth Scale: {wireframeDepthScale.toFixed(1)}
                              </label>
                              <input
                                type="range"
                                min="3.0"
                                max="10.0"
                                step="0.1"
                                value={wireframeDepthScale}
                                onChange={(e) => setWireframeDepthScale(parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                disabled={isGenerating}
                              />
                              <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>3.0 (Subtle)</span>
                                <span>10.0 (Pronounced)</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400">
                            Export skybox as 3D GLB wireframe model with adjustable mesh density and depth parallax.
                          </p>
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

      {/* Wireframe Settings Panel Modal */}
      <AnimatePresence>
        {showWireframePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowWireframePanel(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            
            {/* Panel */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl p-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowWireframePanel(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Panel Content - Horizontal Layout like the image */}
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">Wireframe 3D Export</h3>
                  <p className="text-sm text-gray-400">Export your skybox as a 3D GLB wireframe model</p>
                </div>

                {/* Horizontal Controls Row */}
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Wireframe Toggle */}
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium whitespace-nowrap">Wireframe</span>
                    <button
                      type="button"
                      onClick={() => setEnableWireframe(!enableWireframe)}
                      disabled={isGenerating}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        enableWireframe ? 'bg-green-500' : 'bg-gray-600'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enableWireframe ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Mesh Density Selection */}
                  <div className="flex items-center gap-3">
                    <label className="text-white font-medium whitespace-nowrap">Mesh density:</label>
                    <div className="flex items-center gap-3">
                      {(['low', 'medium', 'high', 'epic'] as const).map((density) => (
                        <label
                          key={density}
                          className="flex items-center space-x-1.5 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name="meshDensity"
                            value={density}
                            checked={wireframeMeshDensity === density}
                            onChange={(e) => setWireframeMeshDensity(e.target.value as any)}
                            disabled={isGenerating || !enableWireframe}
                            className={`w-4 h-4 ${
                              wireframeMeshDensity === density 
                                ? 'text-green-500 border-green-500' 
                                : 'text-gray-400 border-gray-600'
                            } focus:ring-green-500 focus:ring-offset-gray-800`}
                          />
                          <span className={`text-white capitalize text-sm ${
                            wireframeMeshDensity === density ? 'font-semibold text-green-300' : 'font-normal'
                          } ${!enableWireframe ? 'opacity-50' : ''}`}>
                            {density}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Depth Scale Slider */}
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <label className="text-white font-medium whitespace-nowrap">Depth scale</label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="range"
                        min="3.0"
                        max="10.0"
                        step="0.1"
                        value={wireframeDepthScale}
                        onChange={(e) => setWireframeDepthScale(parseFloat(e.target.value))}
                        disabled={isGenerating || !enableWireframe}
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${((wireframeDepthScale - 3.0) / 7.0) * 100}%, #374151 ${((wireframeDepthScale - 3.0) / 7.0) * 100}%, #374151 100%)`
                        }}
                      />
                      <span className="text-green-400 font-semibold text-sm min-w-[40px] text-right">
                        {wireframeDepthScale.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Download Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (enableWireframe) {
                        setShowWireframePanel(false);
                      }
                    }}
                    disabled={isGenerating || !enableWireframe}
                    className={`px-6 py-2.5 rounded-lg font-semibold text-black transition-all flex items-center justify-center space-x-2 whitespace-nowrap ${
                      enableWireframe
                        ? 'bg-green-500 hover:bg-green-600 hover:scale-105'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>DOWNLOAD GLB</span>
                  </button>
                </div>

                <p className="text-xs text-gray-400 text-center pt-2">
                  {enableWireframe 
                    ? 'Wireframe export is enabled. The GLB file will be generated with your selected settings.'
                    : 'Enable wireframe to export your skybox as a 3D GLB model.'
                  }
                </p>
              </div>
            </motion.div>
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