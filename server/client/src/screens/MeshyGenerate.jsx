import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMeshyPanel } from '../Components/EnhancedMeshyPanel';
import { Meshy3DViewer } from '../Components/Meshy3DViewer';
import { StorageStatusIndicator } from '../Components/StorageStatusIndicator';
import { useAuth } from '../contexts/AuthContext';

const ThreeDGenerate = () => {
  const { user } = useAuth();
  const [generatedAssets, setGeneratedAssets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [backgroundAsset, setBackgroundAsset] = useState(null);
  const [interactionMode, setInteractionMode] = useState('rotate');
  const [viewerSettings, setViewerSettings] = useState({
    autoRotate: true,
    showControls: true,
    lighting: 'dramatic',
    backgroundColor: '#000000',
    enableInteraction: true
  });

  const handleAssetGenerated = (asset) => {
    setGeneratedAssets(prev => [asset, ...prev]);
    setBackgroundAsset(asset);
    setIsGenerating(false);
    setIsMinimized(true);
    console.log('New asset generated:', asset);
  };

  const handleGenerationStart = () => {
    setIsGenerating(true);
    setIsMinimized(true);
  };

  const togglePanelSize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleAssetChange = (direction) => {
    if (generatedAssets.length === 0) return;
    
    if (direction === 'next') {
      setCurrentAssetIndex((prev) => (prev + 1) % generatedAssets.length);
    } else {
      setCurrentAssetIndex((prev) => (prev - 1 + generatedAssets.length) % generatedAssets.length);
    }
    setBackgroundAsset(generatedAssets[currentAssetIndex]);
  };

  useEffect(() => {
    if (generatedAssets.length > 0) {
      setBackgroundAsset(generatedAssets[currentAssetIndex]);
    }
  }, [currentAssetIndex, generatedAssets]);

  const toggleInteractionMode = () => {
    const modes = ['rotate', 'zoom', 'pan'];
    const currentIndex = modes.indexOf(interactionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setInteractionMode(modes[nextIndex]);
  };

  const toggleAutoRotate = () => {
    setViewerSettings(prev => ({
      ...prev,
      autoRotate: !prev.autoRotate
    }));
  };

  const toggleControls = () => {
    setViewerSettings(prev => ({
      ...prev,
      showControls: !prev.showControls
    }));
  };

  const changeLighting = () => {
    const lightingOptions = ['studio', 'outdoor', 'indoor', 'dramatic'];
    const currentIndex = lightingOptions.indexOf(viewerSettings.lighting);
    const nextIndex = (currentIndex + 1) % lightingOptions.length;
    setViewerSettings(prev => ({
      ...prev,
      lighting: lightingOptions[nextIndex]
    }));
  };

  return (
    <div className="relative w-full min-h-screen bg-black flex flex-col">
      {/* Top Spacer to account for header */}
      <div className="h-20 lg:h-24"></div>
      {/* Background 3D Viewer with Enhanced Interaction */}
      {backgroundAsset && backgroundAsset.downloadUrl && (
        <div className="fixed inset-0 w-full h-full z-0">
          <Meshy3DViewer
            modelUrl={backgroundAsset.downloadUrl}
            modelFormat={backgroundAsset.format || 'glb'}
            autoRotate={viewerSettings.autoRotate}
            showControls={viewerSettings.showControls}
            lighting={viewerSettings.lighting}
            backgroundColor={viewerSettings.backgroundColor}
            interactionMode={interactionMode}
            enableInteraction={viewerSettings.enableInteraction}
            className="w-full h-full"
            onLoad={(model) => {
              console.log('Background 3D model loaded:', model);
            }}
            onError={(error) => {
              console.error('Background 3D model error:', error);
            }}
          />
        </div>
      )}

      {/* Main Content Layer */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Futuristic Header */}
        <div className="text-center py-4 lg:py-6 px-4 flex-shrink-0">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-4"
          >
            🎨 3D Asset Generator
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-300 text-lg lg:text-xl mb-4 lg:mb-6 font-light"
          >
            Create stunning 3D models using AI-powered generation
          </motion.p>
          

        </div>

        {/* Navigation Arrows for Generated Assets */}
        {generatedAssets.length > 1 && (
          <>
            {/* Left Arrow */}
            <motion.button
              onClick={() => handleAssetChange('prev')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="fixed left-6 top-1/2 transform -translate-y-1/2 p-4 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-md border border-gray-700/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-50 shadow-xl"
              aria-label="Previous asset"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>

            {/* Right Arrow */}
            <motion.button
              onClick={() => handleAssetChange('next')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="fixed right-6 top-1/2 transform -translate-y-1/2 p-4 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-md border border-gray-700/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-50 shadow-xl"
              aria-label="Next asset"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>

            {/* Asset Counter */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black/40 px-6 py-3 rounded-full backdrop-blur-md border border-gray-700/50 text-white text-sm z-50 shadow-xl"
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="font-medium">{currentAssetIndex + 1} / {generatedAssets.length}</span>
              </div>
            </motion.div>
          </>
        )}

        {/* Main Control Panel with 1:3 ratio layout */}
        <div 
          className={`fixed inset-x-0 bottom-0 flex items-end justify-center transition-all duration-500 ease-in-out ${
            isMinimized ? 'pb-4' : 'pb-6 lg:pb-8'
          }`}
        >
          <div className={`relative w-full max-w-6xl mx-auto px-4 transition-all duration-500 ease-in-out ${
            isMinimized ? 'max-w-lg' : ''
          }`}>
            <div className={`relative z-10 bg-gray-800/20 rounded-2xl shadow-2xl backdrop-blur-xl border border-gray-700/30 transition-all duration-500 ease-in-out ${
              isMinimized ? 'bg-gray-800/10' : ''
            }`}>
              {/* Toggle button for panel size */}
              <motion.button
                onClick={togglePanelSize}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute -top-4 right-4 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500/50 to-purple-500/50 hover:from-blue-500/70 hover:to-purple-500/70 flex items-center justify-center transition-all duration-200 border border-gray-600/50 shadow-lg"
                aria-label={isMinimized ? "Expand panel" : "Minimize panel"}
              >
                <svg
                  className={`w-5 h-5 text-white transition-transform duration-300 ${
                    isMinimized ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                  />
                </svg>
              </motion.button>

              <div className={`transition-all duration-500 ease-in-out ${
                isMinimized ? 'p-3' : 'p-4 lg:p-6 xl:p-8'
              }`}>
                {isMinimized ? (
                  // Minimized View
                  <div className="flex items-center justify-center">
                    <motion.button
                      onClick={() => setIsMinimized(false)}
                      whileHover={{ scale: 1.05 }}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium"
                    >
                      {isGenerating ? '🔄 Generating...' : '✨ New Generation'}
                    </motion.button>
                  </div>
                ) : (
                  // Full View with 1:3 ratio layout
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
                    {/* Left section - 1/4 width */}
                    <div className="lg:col-span-1 space-y-3 lg:space-y-4">
                      <div className="text-center lg:text-left">
                        <h3 className="text-base lg:text-lg font-semibold text-white mb-1 lg:mb-2">3D Asset Generator</h3>
                        <p className="text-xs lg:text-sm text-gray-400">Transform your ideas into stunning 3D models</p>
                      </div>
                      
                      {/* Quick Stats */}
                      <div className="bg-gray-700/20 rounded-lg p-3 lg:p-4 border border-gray-600/30">
                        <div className="text-center">
                          <div className="text-xl lg:text-2xl font-bold text-blue-400">{generatedAssets.length}</div>
                          <div className="text-xs text-gray-400">Assets Generated</div>
                        </div>
                      </div>

                      {/* 3D Viewer Controls - Only show when there's a background asset */}
                      {backgroundAsset && (
                        <div className="bg-gray-700/20 rounded-lg p-3 lg:p-4 border border-gray-600/30">
                          <h4 className="text-xs lg:text-sm font-medium text-white mb-3 text-center">3D Viewer Controls</h4>
                          
                          {/* Interaction Mode */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-300">Mode</span>
                              <button
                                onClick={toggleInteractionMode}
                                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                {interactionMode.charAt(0).toUpperCase() + interactionMode.slice(1)}
                              </button>
                            </div>
                          </div>

                          {/* Auto Rotate Toggle */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-300">Auto Rotate</span>
                              <button
                                onClick={toggleAutoRotate}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  viewerSettings.autoRotate ? 'bg-yellow-500/50' : 'bg-gray-600/50'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    viewerSettings.autoRotate ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Controls Toggle */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-300">Controls</span>
                              <button
                                onClick={toggleControls}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  viewerSettings.showControls ? 'bg-purple-500/50' : 'bg-gray-600/50'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    viewerSettings.showControls ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Lighting Control */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-300">Lighting</span>
                              <button
                                onClick={changeLighting}
                                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                {viewerSettings.lighting.charAt(0).toUpperCase() + viewerSettings.lighting.slice(1)}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Right section - 3/4 width */}
                    <div className="lg:col-span-3">
                      <EnhancedMeshyPanel 
                        onAssetGenerated={handleAssetGenerated}
                        onGenerationStart={handleGenerationStart}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Storage Status */}
        <div className="mb-4 lg:mb-6 px-4 flex-shrink-0">
          <StorageStatusIndicator />
        </div>
        
        {/* Bottom Spacer to account for footer */}
        <div className="h-20 lg:h-24 flex-shrink-0"></div>
      </div>
    </div>
  );
};

export default ThreeDGenerate; 