import axios from "axios";
import React, { useEffect, useState } from "react";
import { useAuth } from '../contexts/AuthContext';
import { skyboxService } from '../services/skyboxService';
import DownloadPopup from './DownloadPopup';
import { serverTimestamp } from "firebase/firestore";
import { subscriptionService } from '../services/subscriptionService';
import { useNavigate } from 'react-router-dom';
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
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const fetchSkyboxStyles = async () => {
      try {
        const response = await axios.get(`/api/skybox/getSkyboxStyles`);
        setSkyboxStyles(response.data);
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
    totalGenerations: subscription?.usage?.count || 0
  };

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
    if (subscriptionInfo.generationsLeft <= 0) {
      setError(
        subscriptionInfo.plan === 'Free' 
          ? "You've reached your free tier limit. Please upgrade to continue generating skyboxes."
          : "You've reached your daily generation limit. Please try again tomorrow."
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setShowStylePreview(false);
    setProgress(0);

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

      // Generate the skybox
      const generateResponse = await axios.post("/api/skybox/generateSkybox", {
        prompt: prompt,
        skybox_style_id: selectedSkybox.id,
        webhook_url: `/api/skybox/${prompt}`,
      });

      if (!generateResponse.data || !generateResponse.data.id) {
        throw new Error("Invalid response from server");
      }

      const imageId = generateResponse.data.id;
      setGeneratedImageId(imageId);

      // Update status to processing
      await skyboxService.updateSkybox(skyboxId, {
        status: 'processing',
        updatedAt: serverTimestamp()
      });

      // Start polling with proper cleanup
      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`/api/imagine/getImagineById?id=${imageId}`);
          const status = statusResponse.data;

          // Update progress based on status
          if (status.status === "pending") {
            setProgress(25);
          } else if (status.status === "in-progress") {
            setProgress(50);
          } else if (status.status === "processing") {
            setProgress(75);
          } else if (status.status === "completed" || status.status === "complete") {
            clearInterval(pollInterval);
            
            // Update subscription count after successful generation
            await updateSubscriptionCount();
            
            // Only update Firebase when generation is actually complete
            await skyboxService.updateSkybox(skyboxId, {
              status: 'complete',
              imageUrl: status.file_url,
              updatedAt: serverTimestamp()
            });

            const skyboxData = {
              image: status.file_url,
              image_jpg: status.file_url,
              title: status.title || prompt,
              prompt: status.prompt || prompt
            };
            setBackgroundSkybox(skyboxData);
            setProgress(100);
            setIsGenerating(false);
            
            // Add minimized state after successful generation
            setTimeout(() => {
              setIsMinimized(true);
            }, 1000); // Delay to allow the success state to be visible
          } else if (status.status === "failed" || status.error_message) {
            clearInterval(pollInterval);
            
            // Update Firebase with failed status
            await skyboxService.updateSkybox(skyboxId, {
              status: 'failed',
              error: status.error_message || "Generation failed",
              updatedAt: serverTimestamp()
            });

            throw new Error(status.error_message || "Generation failed");
          }
        } catch (error) {
          clearInterval(pollInterval);
          throw error;
        }
      }, 2000);

    } catch (error) {
      if (pollInterval) clearInterval(pollInterval);
      console.error("Error generating skybox:", error);
      
      // Update Firebase with failed status
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

    // Cleanup interval when component unmounts
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
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
    if (progress < 25) return 'Initializing...';
    if (progress < 50) return 'Processing prompt...';
    if (progress < 75) return 'Generating skybox...';
    if (progress < 100) return 'Finalizing...';
    return 'Applying skybox...';
  };

  return (
    <>
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
                      {/* Simple Free Plan Status */}
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-400">
                            {subscriptionInfo.generationsLeft}/{subscriptionInfo.usage?.limit || 10} generations available
                          </span>
                        </div>
                        {subscriptionInfo.generationsLeft <= 3 && (
                          <button
                            onClick={handleUpgrade}
                            className="text-sm text-purple-400 hover:text-purple-300 transition-colors duration-200"
                          >
                            Upgrade Plan
                          </button>
                        )}
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
                                : subscriptionInfo.generationsLeft <= 0
                                ? 'bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm'
                                : 'bg-gradient-to-r from-blue-500/50 to-indigo-600/50 hover:from-blue-600/60 hover:to-indigo-700/60 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm'
                            }`}
                            onClick={subscriptionInfo.generationsLeft <= 0 ? handleUpgrade : generateSkybox}
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
                              ) : subscriptionInfo.generationsLeft <= 0 ? (
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
                                    {subscriptionInfo.plan === 'Free' 
                                      ? 'Upgrade to Premium'
                                      : 'Upgrade to Higher Tier'}
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
    </>
  );
}

export default MainSection;