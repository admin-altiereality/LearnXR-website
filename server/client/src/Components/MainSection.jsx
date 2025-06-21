import { serverTimestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';
import { useAuth } from '../contexts/AuthContext';
import { skyboxService } from '../services/skyboxService';
import { subscriptionService } from '../services/subscriptionService';
import DownloadPopup from './DownloadPopup';
import UpgradeModal from './UpgradeModal';

const MainSection = ({ setBackgroundSkybox }) => {
  const [showNegativeTextInput, setShowNegativeTextInput] = useState(false);
  const [skyboxStyles, setSkyboxStyles] = useState([]);
  const [selectedSkybox, setSelectedSkybox] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [negativeText, setNegativeText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showStylePreview, setShowStylePreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [generatedImageId, setGeneratedImageId] = useState(null);
  const [generatedVariations, setGeneratedVariations] = useState([]);
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0);
  const [numVariations, setNumVariations] = useState(5);
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentSkyboxIndex, setCurrentSkyboxIndex] = useState(0);

  useEffect(() => {
    const fetchSkyboxStyles = async () => {
      try {
        const response = await api.get(`/api/skybox/getSkyboxStyles`);
        setSkyboxStyles(response.data.styles || []);
      } catch (error) {
        console.error("Error fetching skybox styles:", error);
        setError("Failed to load skybox styles");
      }
    };

    fetchSkyboxStyles();
  }, []);

  // Modify the effect to handle navigation source and style selection
  useEffect(() => {
    const fromExplore = sessionStorage.getItem('fromExplore');
    const savedStyle = sessionStorage.getItem('selectedSkyboxStyle');
    const preserveBackground = sessionStorage.getItem('preserveBackground');
    
    if (fromExplore && savedStyle) {
      try {
        const parsedStyle = JSON.parse(savedStyle);
        setSelectedSkybox(parsedStyle);
        setShowStylePreview(true);
        
        // Only update the background if we're not preserving it
        if (!preserveBackground) {
          setBackgroundSkybox(null);
        }
        
        // Clear the stored data after using it
        sessionStorage.removeItem('fromExplore');
        sessionStorage.removeItem('selectedSkyboxStyle');
        sessionStorage.removeItem('preserveBackground');
      } catch (error) {
        console.error('Error parsing saved skybox style:', error);
      }
    }
  }, [setBackgroundSkybox]);

  // Load subscription data
  useEffect(() => {
    const loadSubscription = async () => {
      if (user?.uid) {
        const userSubscription = await subscriptionService.getUserSubscription(user.uid);
        setSubscription(userSubscription);
      }
    };
    
    loadSubscription();
  }, [user?.uid]);

  // Calculate subscription info from subscription data
  const subscriptionInfo = {
    plan: subscription?.planId || 'Free',
    generationsLeft: subscription?.usage?.limit - subscription?.usage?.count || 0,
    totalGenerations: subscription?.usage?.count || 0,
    planName: subscription?.planId === 'free' ? 'Free Plan' : subscription?.planId === 'pro' ? 'Pro Plan' : 'Enterprise Plan',
    maxGenerations: subscription?.planId === 'free' ? 10 : subscription?.planId === 'pro' ? Infinity : Infinity
  };

  // Get current plan details
  const currentPlan = subscriptionService.getPlanById(subscription?.planId || 'free');
  const remainingGenerations = currentPlan?.limits.skyboxGenerations === Infinity 
    ? '∞' 
    : Math.max(0, (currentPlan?.limits.skyboxGenerations || 10) - (subscription?.usage?.skyboxGenerations || 0));
  const usagePercentage = currentPlan?.limits.skyboxGenerations === Infinity 
    ? 0 
    : Math.min(((subscription?.usage?.skyboxGenerations || 0) / (currentPlan?.limits.skyboxGenerations || 10)) * 100, 100);

  // Update subscription after generation
  const updateSubscriptionCount = async () => {
    if (user?.uid) {
      const updatedSubscription = await subscriptionService.getUserSubscription(user.uid);
      setSubscription(updatedSubscription);
    }
  };

  const generateSkybox = async () => {
    if (!prompt || !selectedSkybox) {
      setError("Please provide a prompt and select a skybox style");
      return;
    }

    // Check subscription limits before generating
    if (currentPlan?.limits.skyboxGenerations !== Infinity && remainingGenerations <= 0) {
      setError(
        subscription?.planId === 'free' 
          ? "You've reached your free tier limit. Please upgrade to continue generating skyboxes."
          : "You've reached your daily generation limit. Please try again tomorrow."
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setShowStylePreview(false);
    setProgress(0);
    setGeneratedVariations([]);
    setCurrentVariationIndex(0);
    setCurrentSkyboxIndex(0);

    let pollInterval;
    let skyboxId;

    try {
      // Create initial Firestore document with pending status
      skyboxId = await skyboxService.createSkybox(user.uid, {
        promptUsed: prompt,
        styleId: selectedSkybox.id,
        metadata: {
          theme: selectedSkybox.name,
          style: selectedSkybox.model,
          subscriptionPlan: subscriptionInfo.plan
        },
        title: prompt,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Generate all skyboxes as variations
      const variations = [];
      for (let i = 0; i < numVariations; i++) {
        setCurrentSkyboxIndex(i);
        const variationResponse = await api.post("/api/skybox/generateSkybox", {
          prompt: prompt,
          skybox_style_id: selectedSkybox.id,
          webhook_url: `/api/skybox/${prompt}`,
        });

        if (variationResponse.data && variationResponse.data.id) {
          variations.push(variationResponse.data.id);
          // Update progress after each variation is queued
          const baseProgress = 30;
          const progressPerSkybox = 60 / numVariations;
          const currentProgress = baseProgress + (i * progressPerSkybox);
          setProgress(Math.min(currentProgress, 90));
        }
      }

      // Poll for variation statuses
      const variationResults = await Promise.all(
        variations.map(async (variationId) => {
          let variationStatus;
          do {
            const statusResponse = await api.get(`/api/imagine/getImagineById?id=${variationId}`);
            variationStatus = statusResponse.data;
            if (variationStatus.status !== "completed" && variationStatus.status !== "complete") {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } while (variationStatus.status !== "completed" && variationStatus.status !== "complete");

          return {
            image: variationStatus.file_url,
            image_jpg: variationStatus.file_url,
            title: variationStatus.title || prompt,
            prompt: variationStatus.prompt || prompt
          };
        })
      );

      // Set all variations
      setGeneratedVariations(variationResults);
      setBackgroundSkybox(variationResults[0]);
      
      // Update Firebase with all variations
      await skyboxService.updateSkybox(skyboxId, {
        status: 'complete',
        imageUrl: variationResults[0].image,
        variations: variationResults,
        updatedAt: serverTimestamp()
      });

      setProgress(100);
      setIsGenerating(false);
      
      // Add minimized state after successful generation
      setTimeout(() => {
        setIsMinimized(true);
      }, 1000);
    } catch (error) {
      console.error("Error generating skybox:", error);
      
      if (skyboxId) {
        await skyboxService.updateSkybox(skyboxId, {
          status: 'failed',
          error: error.message,
          updatedAt: serverTimestamp()
        });
      }

      setError("Failed to generate skybox: " + error.message);
      setIsGenerating(false);
      setProgress(0);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  };

  const handleVariationChange = (direction) => {
    if (generatedVariations.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentVariationIndex + 1) % generatedVariations.length;
    } else {
      newIndex = (currentVariationIndex - 1 + generatedVariations.length) % generatedVariations.length;
    }

    setCurrentVariationIndex(newIndex);
    setBackgroundSkybox(generatedVariations[newIndex]);
  };

  // Modify the skybox style selection handler
  const handleSkyboxStyleChange = (e) => {
    const style = skyboxStyles.find(
      (style) => style.id === parseInt(e.target.value)
    );
    setSelectedSkybox(style);
    setShowStylePreview(true);
  };

  // Modify the handleUpgrade function to show modal instead of direct navigation
  const handleUpgrade = () => {
    setShowUpgradeModal(true); // Show modal instead of navigating directly
  };

  // Add function to toggle panel size
  const togglePanelSize = () => {
    setIsMinimized(!isMinimized);
  };

  // Helper for progress status text
  const getProgressStatus = (progress) => {
    if (progress < 10) return 'Initializing...';
    if (progress < 20) return 'Processing prompt...';
    if (progress < 90) return `Generating skybox ${currentSkyboxIndex + 1} of ${numVariations}...`;
    if (progress < 100) return 'Finalizing...';
    return 'Applying skybox...';
  };

  return (
    <div className="relative w-full min-h-screen">
      {/* Sidebar for Style Preview */}
      {showStylePreview && selectedSkybox && (
        <div className="fixed right-0 top-[64px] bottom-[64px] w-72 bg-gray-800/40 shadow-2xl backdrop-blur-sm border-l border-gray-700/50 transform transition-transform duration-300 ease-in-out z-20">
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-gray-100">Style Preview</h3>
              <button
                onClick={() => setShowStylePreview(false)}
                className="text-gray-300 hover:text-white focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-200 mb-2">{selectedSkybox.name}</h4>
                  {selectedSkybox.description && (
                    <p className="text-sm text-gray-300 mb-4">
                      {selectedSkybox.description}
                    </p>
                  )}
                </div>

                {selectedSkybox.image_jpg && (
                  <div className="space-y-4">
                    <div className="aspect-square w-full relative rounded-lg overflow-hidden">
                      <img
                        src={selectedSkybox.image_jpg}
                        alt={selectedSkybox.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg p-4">
                      <h5 className="text-sm font-medium text-gray-200 mb-2">Style Details</h5>
                      <div className="space-y-2 text-sm text-gray-300">
                        <p>Model: {selectedSkybox.model}</p>
                        {selectedSkybox.dimensions && (
                          <p>Dimensions: {selectedSkybox.dimensions}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-700/50">
              <button
                onClick={() => setShowStylePreview(false)}
                className="w-full py-2 px-4 bg-gray-700/50 hover:bg-gray-600/50 text-gray-200 rounded-md transition-colors duration-200 backdrop-blur-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Control Panel with dynamic classes */}
      <div 
        className={`fixed inset-x-0 bottom-0 flex items-end justify-center transition-all duration-500 ease-in-out ${
          isMinimized ? 'pb-4' : 'pb-16'
        } ${showStylePreview ? 'mr-72' : ''}`}
      >
        <div className={`relative w-full max-w-4xl mx-auto px-4 transition-all duration-500 ease-in-out ${
          isMinimized ? 'max-w-lg' : ''
        }`}>
          <div className={`relative z-10 bg-gray-800/30 rounded-xl shadow-2xl backdrop-blur-sm border border-gray-700/50 transition-all duration-500 ease-in-out ${
            isMinimized ? 'bg-gray-800/20' : ''
          }`}>
            {/* Toggle button for panel size */}
            {setBackgroundSkybox && (
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
            )}

            <div className={`transition-all duration-500 ease-in-out ${
              isMinimized ? 'p-2' : 'p-4'
            }`}>
              {isMinimized ? (
                // Minimized View
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">
                    {subscriptionInfo.generationsLeft} generations left
                  </span>
                  <button
                    onClick={() => setIsMinimized(false)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                  >
                    New Generation
                  </button>
                </div>
              ) : (
                // Full View - Show only progress during generation
                <>
                  {isGenerating ? (
                    // Progress Indicator
                    <div className="py-6 px-4">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">{getProgressStatus(progress)}</span>
                          <span className="text-gray-400">{progress}%</span>
                        </div>
                        <div className="relative">
                          <div className="h-1 w-full bg-gray-700/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500/50 transition-all duration-300 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {/* Animated Glow Effect */}
                          <div 
                            className="absolute top-0 h-1 w-[100px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent animate-shimmer"
                            style={{ 
                              left: `${progress - 10}%`,
                              transition: 'left 0.3s ease-out',
                              display: progress < 100 ? 'block' : 'none'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Normal Control Panel Content
                    <>
                      {/* Generation Status */}
                      <div className="mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-300">
                              {currentPlan?.name || 'Free'} Plan
                            </span>
                          </div>
                          {subscription?.planId === 'free' && (
                            <button
                              onClick={handleUpgrade}
                              className="text-xs text-purple-400 hover:text-purple-300 transition-colors duration-200 font-medium"
                            >
                              Upgrade
                            </button>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Generations Remaining</span>
                            <span className="text-gray-200 font-medium">
                              {remainingGenerations} {currentPlan?.limits.skyboxGenerations === Infinity ? '' : 'left'}
                            </span>
                          </div>
                          
                          {currentPlan?.limits.skyboxGenerations !== Infinity && (
                            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                style={{ width: `${usagePercentage}%` }}
                              />
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Used: {subscription?.usage?.skyboxGenerations || 0}</span>
                            <span>Limit: {currentPlan?.limits.skyboxGenerations === Infinity ? '∞' : currentPlan?.limits.skyboxGenerations || 10}</span>
                          </div>
                        </div>
                      </div>

                      {error && (
                        <div className="mb-4 text-sm text-red-400">
                          {error}
                        </div>
                      )}

                      {/* Prompt - Full Width */}
                      <div>
                        <label htmlFor="prompt" className="block text-xs font-medium mb-1 text-gray-200">
                          Prompt
                        </label>
                        <textarea
                          id="prompt"
                          maxLength={600}
                          rows={2}
                          placeholder="Tell us what to bring to life..."
                          className="w-full p-2 bg-gray-700/30 border border-gray-600/50 rounded-md text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm backdrop-blur-sm"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          disabled={isGenerating}
                        />
                      </div>

                      {/* Variations Input */}
                      <div className="mt-4">
                        <label htmlFor="variations" className="block text-xs font-medium mb-1 text-gray-200">
                          Number of Variations
                        </label>
                        <input
                          type="number"
                          id="variations"
                          min="1"
                          max="10"
                          placeholder="Enter number of variations (1-10)"
                          className="w-full p-2 bg-gray-700/30 border border-gray-600/50 rounded-md text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm backdrop-blur-sm"
                          value={numVariations}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            setNumVariations(Math.min(10, Math.max(1, value)));
                          }}
                          disabled={isGenerating}
                        />
                      </div>

                      {/* Negative Text Toggle */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="negativeTextToggle"
                          className="mr-2 focus:ring-blue-400/50 h-3 w-3"
                          checked={showNegativeTextInput}
                          onChange={() => setShowNegativeTextInput(!showNegativeTextInput)}
                        />
                        <label htmlFor="negativeTextToggle" className="text-xs text-gray-200">
                          Add Negative Text
                        </label>
                      </div>

                      {/* Negative Text - Full Width */}
                      {showNegativeTextInput && (
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-200">Negative Text</label>
                          <input
                            type="text"
                            placeholder="Optional negative text..."
                            className="w-full p-2 bg-gray-700/30 border border-gray-600/50 rounded-md text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm backdrop-blur-sm"
                            value={negativeText}
                            onChange={(e) => setNegativeText(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Skybox Style and Generate Button - Three Columns */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1 text-gray-200">Skybox Style</label>
                          <select
                            className="w-full p-2 bg-gray-700/30 border border-gray-600/50 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm backdrop-blur-sm"
                            onChange={handleSkyboxStyleChange}
                            value={selectedSkybox?.id || ""}
                          >
                            <option value="" disabled>
                              -- Choose a Skybox Style --
                            </option>
                            {skyboxStyles.map((style) => (
                              <option key={style.id} value={style.id}>
                                {style.name} (Model: {style.model})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <button
                            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50 ${
                              isGenerating 
                                ? 'bg-blue-500/50 cursor-not-allowed backdrop-blur-sm'
                                : currentPlan?.limits.skyboxGenerations !== Infinity && remainingGenerations <= 0
                                ? 'bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm'
                                : 'bg-gradient-to-r from-blue-500/50 to-indigo-600/50 hover:from-blue-600/60 hover:to-indigo-700/60 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm'
                            }`}
                            onClick={currentPlan?.limits.skyboxGenerations !== Infinity && remainingGenerations <= 0 ? handleUpgrade : generateSkybox}
                            disabled={isGenerating}
                          >
                            <div className="relative flex items-center justify-center">
                              {isGenerating ? (
                                <>
                                  <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                  <span className="text-sm">{progress < 100 ? 'Generating...' : 'Applying Skybox...'}</span>
                                </>
                              ) : currentPlan?.limits.skyboxGenerations !== Infinity && remainingGenerations <= 0 ? (
                                <div className="flex items-center space-x-2">
                                  <svg 
                                    className="w-4 h-4" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                      strokeWidth={2} 
                                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                                    />
                                  </svg>
                                  <span className="text-sm">
                                    {subscription?.planId === 'free' 
                                      ? 'Upgrade to Pro'
                                      : 'Upgrade Plan'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm">Generate Skybox</span>
                              )}
                            </div>
                          </button>
                        </div>

                        <div className="flex items-end">
                          <button
                            className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500/50 
                              ${!generatedImageId 
                                ? 'bg-gray-600/30 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 transform hover:-translate-y-0.5 active:translate-y-0'} 
                              backdrop-blur-sm`}
                            onClick={() => setShowDownloadPopup(true)}
                            disabled={!generatedImageId}
                          >
                            <div className="relative flex items-center justify-center">
                              <svg 
                                className="w-4 h-4 mr-2" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              <span className="text-sm">Download</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <DownloadPopup
        isOpen={showDownloadPopup}
        onClose={() => setShowDownloadPopup(false)}
        imageId={generatedImageId}
        title={prompt || 'skybox'}
      />

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscriptionInfo.plan}
      />

      {/* Replace the bottom navigation with side arrows */}
      {generatedVariations.length > 0 && (
        <>
          {/* Left Arrow */}
          <button
            onClick={() => handleVariationChange('prev')}
            className="fixed left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border border-gray-700/50 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-50"
            aria-label="Previous variation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right Arrow */}
          <button
            onClick={() => handleVariationChange('next')}
            className="fixed right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border border-gray-700/50 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-50"
            aria-label="Next variation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Variation Counter */}
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm border border-gray-700/50 text-white text-sm z-50">
            {currentVariationIndex + 1} / {generatedVariations.length}
          </div>
        </>
      )}
    </div>
  );
}

export default MainSection;