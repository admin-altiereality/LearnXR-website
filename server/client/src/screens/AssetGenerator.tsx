import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMeshyPanel } from '../Components/EnhancedMeshyPanel';
import { MeshyTestPanel } from '../Components/MeshyTestPanel';
import { MeshyDebugPanel } from '../Components/MeshyDebugPanel';
import { Meshy3DViewer } from '../Components/Meshy3DViewer';
import { StorageStatusIndicator } from '../Components/StorageStatusIndicator';
import { useAuth } from '../contexts/AuthContext';

const AssetGenerator = () => {
  const { user } = useAuth();
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [backgroundAsset, setBackgroundAsset] = useState(null);
  const [interactionMode, setInteractionMode] = useState('rotate'); // rotate, zoom, pan
  const [viewerSettings, setViewerSettings] = useState({
    autoRotate: true,
    showControls: true,
    lighting: 'dramatic',
    backgroundColor: '#000000',
    enableInteraction: true
  });

  const handleAssetGenerated = (asset) => {
    setGeneratedAssets(prev => [asset, ...prev]);
    setBackgroundAsset(asset); // Set as background immediately
    setIsGenerating(false);
    setIsMinimized(true); // Minimize panel after generation
    console.log('New asset generated:', asset);
  };

  const handleGenerationStart = () => {
    setIsGenerating(true);
    setIsMinimized(true); // Minimize panel when generation starts
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

  // Update background asset when current index changes
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
    <div className="relative w-full min-h-screen bg-black">
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
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center py-8 px-4">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white mb-4"
          >
            🎨 3D Asset Generator
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-300 text-lg mb-4"
          >
            Create stunning 3D models using AI-powered generation
          </motion.p>
          
          {/* Enhanced Debug Controls */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4"
          >
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
            
            {/* 3D Interaction Controls */}
            {backgroundAsset && (
              <>
                <button
                  onClick={toggleInteractionMode}
                  className="px-4 py-2 bg-green-600/50 hover:bg-green-600/70 text-white rounded-md text-sm transition-colors"
                >
                  Mode: {interactionMode.charAt(0).toUpperCase() + interactionMode.slice(1)}
                </button>
                <button
                  onClick={toggleAutoRotate}
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${
                    viewerSettings.autoRotate 
                      ? 'bg-yellow-600/50 hover:bg-yellow-600/70 text-white' 
                      : 'bg-gray-600/50 hover:bg-gray-600/70 text-gray-300'
                  }`}
                >
                  Auto-Rotate: {viewerSettings.autoRotate ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={toggleControls}
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${
                    viewerSettings.showControls 
                      ? 'bg-purple-600/50 hover:bg-purple-600/70 text-white' 
                      : 'bg-gray-600/50 hover:bg-gray-600/70 text-gray-300'
                  }`}
                >
                  Controls: {viewerSettings.showControls ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={changeLighting}
                  className="px-4 py-2 bg-indigo-600/50 hover:bg-indigo-600/70 text-white rounded-md text-sm transition-colors"
                >
                  Lighting: {viewerSettings.lighting.charAt(0).toUpperCase() + viewerSettings.lighting.slice(1)}
                </button>
              </>
            )}
          </motion.div>
        </div>

        {/* Test Panel */}
        <AnimatePresence>
          {showTestPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 px-4"
            >
              <MeshyTestPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Debug Panel */}
        <AnimatePresence>
          {showDebugPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 px-4"
            >
              <MeshyDebugPanel />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Assets Display */}
        {generatedAssets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 px-4"
          >
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              Recently Generated Assets
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {generatedAssets.map((asset, index) => (
                <motion.div
                  key={asset.id || index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-4 hover:bg-gray-800/70 transition-all duration-300"
                >
                  <h3 className="text-white font-medium mb-2 truncate">{asset.prompt}</h3>
                  <div className="text-sm text-gray-400 mb-2">
                    Format: {asset.format} | Quality: {asset.metadata?.quality || 'medium'}
                  </div>
                  {asset.downloadUrl && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setBackgroundAsset(asset);
                          setCurrentAssetIndex(index);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        View
                      </button>
                      <a
                        href={asset.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Navigation Arrows for Generated Assets */}
        {generatedAssets.length > 1 && (
          <>
            {/* Left Arrow */}
            <button
              onClick={() => handleAssetChange('prev')}
              className="fixed left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border border-gray-700/50 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-50"
              aria-label="Previous asset"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right Arrow */}
            <button
              onClick={() => handleAssetChange('next')}
              className="fixed right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border border-gray-700/50 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-50"
              aria-label="Next asset"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Asset Counter */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm border border-gray-700/50 text-white text-sm z-50">
              {currentAssetIndex + 1} / {generatedAssets.length}
            </div>
          </>
        )}

        {/* Main Control Panel with dynamic classes */}
        <div 
          className={`fixed inset-x-0 bottom-0 flex items-end justify-center transition-all duration-500 ease-in-out ${
            isMinimized ? 'pb-4' : 'pb-16'
          }`}
        >
          <div className={`relative w-full max-w-4xl mx-auto px-4 transition-all duration-500 ease-in-out ${
            isMinimized ? 'max-w-lg' : ''
          }`}>
            <div className={`relative z-10 bg-gray-800/30 rounded-xl shadow-2xl backdrop-blur-sm border border-gray-700/50 transition-all duration-500 ease-in-out ${
              isMinimized ? 'bg-gray-800/20' : ''
            }`}>
              {/* Toggle button for panel size */}
              <button
                onClick={togglePanelSize}
                className="absolute -top-3 right-3 w-6 h-6 rounded-full bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center transition-all duration-200"
                aria-label={isMinimized ? "Expand panel" : "Minimize panel"}
              >
                <svg
                  className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${
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
              </button>

              <div className={`transition-all duration-500 ease-in-out ${
                isMinimized ? 'p-2' : 'p-4'
              }`}>
                {isMinimized ? (
                  // Minimized View
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => setIsMinimized(false)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                    >
                      {isGenerating ? 'Generating...' : 'New Generation'}
                    </button>
                  </div>
                ) : (
                  // Full View
                  <div>
                    <EnhancedMeshyPanel 
                      onAssetGenerated={handleAssetGenerated}
                      onGenerationStart={handleGenerationStart}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Storage Status */}
        <div className="mb-8 px-4">
          <StorageStatusIndicator />
        </div>
      </div>
    </div>
  );
};

export default AssetGenerator; 