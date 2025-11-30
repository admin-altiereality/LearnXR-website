import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import DownloadPopup from './DownloadPopup';
import UpgradeModal from './UpgradeModal';
import LoadingPlaceholder from './LoadingPlaceholder';
import { skyboxApiService } from '../services/skyboxApiService';
import AssetGenerationPanel from './AssetGenerationPanel';
import { MeshyTestPanel } from './MeshyTestPanel';
import { assetGenerationService } from '../services/assetGenerationService';
import { isStorageAvailable } from '../utils/firebaseStorage';
import { StorageTestUtility } from '../utils/storageTest';
import { StorageStatusIndicator } from './StorageStatusIndicator';
import ConfigurationDiagnostic from './ConfigurationDiagnostic';
import { db } from '../config/firebase';

const MainSection = ({ setBackgroundSkybox }) => {
  console.log('MainSection component rendered');

  // -------------------------
  // UI State
  // -------------------------
  const [showNegativeTextInput, setShowNegativeTextInput] = useState(false);
  const [skyboxStyles, setSkyboxStyles] = useState([]);
  const [selectedSkybox, setSelectedSkybox] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [negativeText, setNegativeText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
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
  const [currentImageForDownload, setCurrentImageForDownload] = useState(null);
  const [stylesLoading, setStylesLoading] = useState(true);
  const [stylesError, setStylesError] = useState(null);
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState([]);
  const [has3DObjects, setHas3DObjects] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [serviceStatusLoading, setServiceStatusLoading] = useState(true);
  const [serviceStatusError, setServiceStatusError] = useState(null);

  // -------------------------
  // Reactive object detection
  // -------------------------
  useEffect(() => {
    if (prompt.trim()) {
      try {
        const extraction = assetGenerationService.previewExtraction(prompt);
        setHas3DObjects(extraction.hasObjects);
        console.log('🔄 Prompt changed, re-analyzing:', {
          prompt,
          hasObjects: extraction.hasObjects,
          objects: extraction.objects,
          meshyConfigured: assetGenerationService.isMeshyConfigured()
        });
      } catch (error) {
        console.error('Error analyzing prompt:', error);
        setHas3DObjects(false);
      }
    } else {
      setHas3DObjects(false);
    }
  }, [prompt]);

  // -------------------------
  // Load Skybox styles
  // -------------------------
  useEffect(() => {
    setStylesLoading(true);
    setStylesError(null);
    const fetchSkyboxStyles = async () => {
      try {
        const response = await skyboxApiService.getStyles(1, 100);
        // Handle nested response structure: { success, data: { styles: [...] } }
        const styles = response?.data?.styles || response?.styles || response?.data || [];
        const stylesArray = Array.isArray(styles) ? styles : [];
        setSkyboxStyles(stylesArray);
        setStylesLoading(false);
        setStylesError(null);
        console.log('Fetched In3D.Ai styles:', stylesArray);
      } catch (error) {
        setStylesLoading(false);
        setStylesError("Failed to load In3D.Ai styles. Please check your API configuration.");
        setSkyboxStyles([]);
        console.error("Error fetching In3D.Ai styles:", error);

        // Existing top-right DOM toast (kept for logic compatibility)
        const errorMessage = document.createElement('div');
        errorMessage.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorMessage.innerHTML = `
          <div class="font-bold mb-2">⚠️ Configuration Issue</div>
          <div class="text-sm">Unable to load 3D generation styles. Please check your API configuration.</div>
        `;
        document.body.appendChild(errorMessage);
        setTimeout(() => document.body.removeChild(errorMessage), 5000);
      }
    };
    fetchSkyboxStyles();
  }, []);

  // -------------------------
  // Service availability checks
  // -------------------------
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        setServiceStatusLoading(true);
        setServiceStatusError(null);
        
        const meshyConfigured = assetGenerationService.isMeshyConfigured();
        console.log('🔧 Meshy configuration check:', meshyConfigured);
        
        if (!meshyConfigured) {
          setServiceStatusError('Meshy API key not configured. Please add VITE_MESHY_API_KEY to your environment variables.');
          setServiceStatusLoading(false);
          setStorageAvailable(false);
          return;
        }
        
        const available = await assetGenerationService.isServiceAvailable();
        setStorageAvailable(available);
        const status = await assetGenerationService.getServiceStatus();
        setServiceStatus(status);
        setServiceStatusLoading(false);
        
        if (!available) {
          if (status.errors.length > 0) {
            setServiceStatusError(status.errors.join(' | '));
          }
        }
        
        console.log('🔧 Service availability check completed:', { available, status });
      } catch (error) {
        setServiceStatusLoading(false);
        setStorageAvailable(false);
        setServiceStatusError(error.message || 'Unknown error');
        console.error('❌ Service availability check failed:', error);
      }
    };
    checkAvailability();
  }, []);

  // -------------------------
  // Storage recovery handler
  // -------------------------
  const handleStorageRecovery = async () => {
    try {
      console.log('🔄 User requested storage recovery...');
      setError('Attempting to recover storage connection...');
      
      const status = await assetGenerationService.getServiceStatus();
      
      if (status.alternativeStorageAvailable) {
        setStorageAvailable(true);
        setError(null);
        console.log('✅ Alternative storage available - service can continue');
        
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        successMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span>Using alternative storage! 3D asset generation is available.</span>
        `;
        document.body.appendChild(successMessage);
        setTimeout(() => document.body.removeChild(successMessage), 5000);
        return;
      }
      
      const fixes = await StorageTestUtility.attemptAutoFix();
      const available = await isStorageAvailable();
      
      if (available) {
        setStorageAvailable(true);
        setError(null);
        console.log('✅ Firebase Storage recovery successful');
        
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        successMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <span>Firebase Storage recovered! 3D asset generation is now available.</span>
        `;
        document.body.appendChild(successMessage);
        setTimeout(() => document.body.removeChild(successMessage), 5000);
      } else {
        setError('Storage recovery failed. Alternative storage is also unavailable.');
        console.error('❌ All storage recovery failed');
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
        errorMessage.innerHTML = `
          <div class="font-bold mb-2">❌ Recovery Failed</div>
          <div class="text-sm mb-2">Both Firebase and alternative storage are unavailable.</div>
          <div class="text-sm mb-2">Attempted fixes:</div>
          <ul class="list-disc list-inside text-sm">
            ${fixes.map(fix => `<li>${fix}</li>`).join('')}
          </ul>
        `;
        document.body.appendChild(errorMessage);
        setTimeout(() => document.body.removeChild(errorMessage), 8000);
      }
    } catch (error) {
      setError(`Recovery failed: ${error.message}`);
      console.error('❌ Storage recovery error:', error);
    }
  };

  // -------------------------
  // Diagnostics
  // -------------------------
  const runDiagnostics = async () => {
    try {
      console.log('🔧 Running comprehensive diagnostics...');
      
      const serviceStatus = await assetGenerationService.getServiceStatus();
      const firebaseResults = await StorageTestUtility.runFullDiagnostics();
      
      const results = {
        ...firebaseResults,
        serviceStatus,
        alternativeStorage: {
          available: serviceStatus.alternativeStorageAvailable,
          providers: serviceStatus.alternativeStorageAvailable ? 
            ['localStorage', 'directUrl', 'cloudinary'].filter(p => {
              if (p === 'cloudinary') return !!import.meta.env.VITE_CLOUDINARY_CLOAD_NAME;
              return true;
            }) : []
        }
      };
      
      const diagnosticMessage = document.createElement('div');
      diagnosticMessage.className = 'fixed top-4 right-4 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-lg';
      
      let messageHtml = '<div class="font-bold mb-3">🔧 Diagnostic Results</div>';
      
      messageHtml += '<div class="mb-3"><div class="font-semibold text-sm">Service Status:</div>';
      messageHtml += `<div class="text-xs">• Meshy API: ${serviceStatus.meshyConfigured ? '✅' : '❌'}</div>`;
      messageHtml += `<div class="text-xs">• Firebase Storage: ${serviceStatus.firebaseStorageAvailable ? '✅' : '❌'}</div>`;
      messageHtml += `<div class="text-xs">• Alternative Storage: ${serviceStatus.alternativeStorageAvailable ? '✅' : '❌'}</div>`;
      messageHtml += `<div class="text-xs">• User Auth: ${serviceStatus.userAuthenticated ? '✅' : '❌'}</div>`;
      messageHtml += '</div>';
      
      if (serviceStatus.alternativeStorageAvailable) {
        messageHtml += '<div class="mb-3"><div class="font-semibold text-sm">Alternative Storage Providers:</div>';
        results.alternativeStorage.providers.forEach(provider => {
          messageHtml += `<div class="text-xs">• ${provider}</div>`;
        });
        messageHtml += '</div>';
      }
      
      if (serviceStatus.errors.length > 0) {
        messageHtml += '<div class="mb-3"><div class="font-semibold text-sm text-red-400">Errors:</div>';
        serviceStatus.errors.forEach(error => {
          messageHtml += `<div class="text-xs text-red-300">• ${error}</div>`;
        });
        messageHtml += '</div>';
      }
      
      if (firebaseResults.network) {
        messageHtml += '<div class="mb-3"><div class="font-semibold text-sm">Network Status:</div>';
        messageHtml += `<div class="text-xs">• Connectivity: ${firebaseResults.network.connectivity ? '✅' : '❌'}</div>`;
        messageHtml += `<div class="text-xs">• Firebase API: ${firebaseResults.network.firebaseApi ? '✅' : '❌'}</div>`;
        messageHtml += '</div>';
      }
      
      messageHtml += '<div class="text-xs text-gray-400 mt-3">Check browser console for detailed logs</div>';
      
      diagnosticMessage.innerHTML = messageHtml;
      document.body.appendChild(diagnosticMessage);
      setTimeout(() => document.body.removeChild(diagnosticMessage), 10000);
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      
      const errorMessage = document.createElement('div');
      errorMessage.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      errorMessage.innerHTML = `
        <div class="font-bold mb-2">❌ Diagnostic Error</div>
        <div class="text-sm">${error.message}</div>
      `;
      document.body.appendChild(errorMessage);
      setTimeout(() => document.body.removeChild(errorMessage), 5000);
    }
  };

  // -------------------------
  // Handle navigation source / style selection
  // -------------------------
  useEffect(() => {
    const fromExplore = sessionStorage.getItem('fromExplore');
    const savedStyle = sessionStorage.getItem('selectedSkyboxStyle');
    const navigateToMain = sessionStorage.getItem('navigateToMain');
    
    if (fromExplore && savedStyle && navigateToMain) {
      try {
        const parsedStyle = JSON.parse(savedStyle);
        setSelectedSkybox(parsedStyle);
        
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        successMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>Style "${parsedStyle.name}" is now selected! Ready to create.</span>
        `;
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
          if (successMessage.parentNode) {
            successMessage.parentNode.removeChild(successMessage);
          }
        }, 3000);
        
        sessionStorage.removeItem('fromExplore');
        sessionStorage.removeItem('selectedSkyboxStyle');
        sessionStorage.removeItem('navigateToMain');
      } catch (error) {
        console.error('Error parsing saved skybox style:', error);
        sessionStorage.removeItem('fromExplore');
        sessionStorage.removeItem('selectedSkyboxStyle');
        sessionStorage.removeItem('navigateToMain');
      }
    }
  }, [setBackgroundSkybox]);

  // -------------------------
  // Load subscription
  // -------------------------
  useEffect(() => {
    const loadSubscription = async () => {
      if (user?.uid) {
        const userSubscription = await subscriptionService.getUserSubscription(user.uid);
        setSubscription(userSubscription);
      }
    };
    
    loadSubscription();
  }, [user?.uid]);

  // -------------------------
  // Subscription info
  // -------------------------
  const subscriptionInfo = {
    plan: subscription?.planId || 'Free',
    generationsLeft: subscription?.usage?.limit - subscription?.usage?.count || 0,
    totalGenerations: subscription?.usage?.count || 0,
    planName: subscription?.planId === 'free' ? 'Free Plan' : subscription?.planId === 'pro' ? 'Pro Plan' : 'Enterprise Plan',
    maxGenerations: subscription?.planId === 'free' ? 5 : subscription?.planId === 'pro' ? 50 : 100
  };

  const currentPlan = subscriptionService.getPlanById(subscription?.planId || 'free');
  const currentUsage = parseInt(subscription?.usage?.skyboxGenerations || 0);
  const currentLimit = currentPlan?.limits.skyboxGenerations || 10;
  const isUnlimited = currentLimit === Infinity;

  const remainingGenerations = isUnlimited 
    ? '∞' 
    : Math.max(0, currentLimit - currentUsage);
  
  const remainingAfterGeneration = isUnlimited 
    ? '∞' 
    : Math.max(0, currentLimit - currentUsage - numVariations);
  
  const usagePercentage = isUnlimited 
    ? 0 
    : Math.min((currentUsage / currentLimit) * 100, 100);
  
  const projectedUsagePercentage = isUnlimited 
    ? 0 
    : Math.min(((currentUsage + numVariations) / currentLimit) * 100, 100);

  const updateSubscriptionCount = async () => {
    if (user?.uid) {
      const updatedSubscription = await subscriptionService.getUserSubscription(user.uid);
      setSubscription(updatedSubscription);
    }
  };

  // -------------------------
  // Skybox generation
  // -------------------------
  const generateSkybox = async () => {
    if (!prompt || !selectedSkybox) {
      setError("Please provide a prompt and select an In3D.Ai style");
      return;
    }

    if (!isUnlimited && remainingGenerations < numVariations) {
      const canGenerate = Math.max(0, remainingGenerations);
      setError(
        subscription?.planId === 'free' 
          ? `You've reached your free tier limit. You can generate ${canGenerate} more In3D.Ai environment${canGenerate === 1 ? '' : 's'}. Please upgrade to continue generating environments.`
          : `You've reached your daily generation limit. You can generate ${canGenerate} more In3D.Ai environment${canGenerate === 1 ? '' : 's'}. Please try again tomorrow.`
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setGeneratedVariations([]);
    setCurrentVariationIndex(0);
    setCurrentSkyboxIndex(0);

    let pollInterval;

    try {
      const variations = [];
      for (let i = 0; i < numVariations; i++) {
        setCurrentSkyboxIndex(i);
        const variationResponse = await skyboxApiService.generateSkybox({
          prompt,
          style_id: selectedSkybox.id,
          negative_prompt: negativeText,
          userId: user?.uid,
        });

        if (variationResponse && variationResponse.data && variationResponse.data.id) {
          variations.push(variationResponse.data.id);
          const baseProgress = 30;
          const progressPerSkybox = 60 / numVariations;
          const currentProgress = baseProgress + (i * progressPerSkybox);
          setProgress(Math.min(currentProgress, 90));
        }
      }

      const variationResults = await Promise.all(
        variations.map(async (variationId) => {
          let variationStatus;
          do {
            const statusResponse = await skyboxApiService.getSkyboxStatus(variationId);
            variationStatus = statusResponse.data;
            console.log(`Status for ${variationId}:`, variationStatus);
            
            if (variationStatus.status !== "completed" && variationStatus.status !== "complete") {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } while (variationStatus.status !== "completed" && variationStatus.status !== "complete");

          const imageUrl = variationStatus.file_url || variationStatus.image || variationStatus.thumb_url;
          if (!imageUrl) {
            throw new Error(`No image URL found for variation ${variationId}`);
          }

          return {
            image: imageUrl,
            image_jpg: imageUrl,
            title: variationStatus.title || prompt,
            prompt: variationStatus.prompt || prompt
          };
        })
      );

      setGeneratedVariations(variationResults);
      setBackgroundSkybox(variationResults[0]);
      setCurrentImageForDownload(variationResults[0]);
      
      if (user?.uid) {
        try {
          for (let i = 0; i < numVariations; i++) {
            await subscriptionService.incrementUsage(user.uid, 'skyboxGenerations');
          }
          await updateSubscriptionCount();
          console.log(`Updated subscription usage: ${numVariations} In3D.Ai generations added`);
        } catch (error) {
          console.error('Error updating subscription usage:', error);
        }
      }

      setProgress(100);
      setIsGenerating(false);
      
      setTimeout(() => {
        setIsMinimized(true);
      }, 1000);
    } catch (error) {
      console.error("Error generating skybox:", error);
      
      let errorMessage = "Failed to generate In3D.Ai environment";
      
      if (error.response && error.response.data) {
        const { error: apiError, code } = error.response.data;
        
        if (code === 'QUOTA_EXCEEDED') {
          errorMessage = apiError || "API quota has been exhausted. Please contact support or try again later.";
        } else if (code === 'INVALID_REQUEST') {
          errorMessage = apiError || "Invalid request parameters. Please check your input.";
        } else if (code === 'AUTH_ERROR') {
          errorMessage = "Authentication error. Please refresh the page and try again.";
        } else if (apiError) {
          errorMessage = apiError;
        }
      } else if (error.message) {
        errorMessage += ": " + error.message;
      }
      
      setError(errorMessage);
      setIsGenerating(false);
      setProgress(0);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  };

  // -------------------------
  // Variations navigation
  // -------------------------
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
    setCurrentImageForDownload(generatedVariations[newIndex]);
  };

  // -------------------------
  // Skybox style change
  // -------------------------
  const handleSkyboxStyleChange = (e) => {
    const style = skyboxStyles.find(
      (style) => style.id === parseInt(e.target.value)
    );
    setSelectedSkybox(style);
  };

  // -------------------------
  // Upgrade handler
  // -------------------------
  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  // -------------------------
  // Panel size toggle
  // -------------------------
  const togglePanelSize = () => {
    setIsMinimized(!isMinimized);
  };

  const getProgressStatusText = () => {
    if (progress < 30) return "Initializing generation...";
    if (progress < 60) return "Generating skybox variations...";
    if (progress < 90) return "Processing final results...";
    return "Finalizing...";
  };

  // -------------------------
  // 3D asset generation handler
  // -------------------------
  const handleAssetGeneration = (assets) => {
    setGeneratedAssets(assets);
    setShowAssetPanel(false);
    
    const successMessage = document.createElement('div');
    successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
    successMessage.innerHTML = `
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
      </svg>
      <span>Generated ${assets.length} 3D assets for your skybox!</span>
    `;
    document.body.appendChild(successMessage);
    setTimeout(() => document.body.removeChild(successMessage), 5000);
  };

  console.log('🔍 Current state:', {
    prompt,
    has3DObjects,
    meshyConfigured: assetGenerationService.isMeshyConfigured(),
    shouldShowButton: has3DObjects && assetGenerationService.isMeshyConfigured()
  });

  const testMeshyIntegration = async () => {
    console.log('🧪 Testing Meshy integration...');
    
    const isConfigured = assetGenerationService.isMeshyConfigured();
    console.log('✅ Meshy configured:', isConfigured);
    
    const testPrompt = "A sci-fi jungle with alien structures and a crashed spaceship";
    const extraction = assetGenerationService.previewExtraction(testPrompt);
    console.log('✅ Keyword extraction test:', extraction);
    
    const costEstimate = assetGenerationService.estimateCost(testPrompt, 'medium');
    console.log('✅ Cost estimation test:', costEstimate);
    
    if (isConfigured && user?.uid) {
      try {
        console.log('🚀 Testing single asset generation...');
        const asset = await assetGenerationService.generateSingleAsset(
          "futuristic spaceship",
          user.uid,
          "test-skybox-id",
          "low"
        );
        console.log('✅ Asset generation test result:', asset);
      } catch (error) {
        console.error('❌ Asset generation test failed:', error);
      }
    }
  };

  useEffect(() => {
    console.log('🔧 Checking Firebase services...');
    console.log('📦 Storage available:', isStorageAvailable());
    console.log('🔑 Auth available:', !!useAuth);
    console.log('🗄️ Firestore available:', !!db);
  }, []);

  const getMissingRequirements = () => {
    if (!serviceStatus) return [];
    const missing = [];
    if (!serviceStatus.meshyConfigured) missing.push('Meshy API Key');
    if (!serviceStatus.firebaseStorageAvailable && !serviceStatus.alternativeStorageAvailable) missing.push('Storage (Firebase or Alternative)');
    if (!serviceStatus.userAuthenticated) missing.push('User Authentication');
    return missing;
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="relative w-full min-h-screen">
      {/* Bottom Dock Control Panel */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-end justify-center transition-all duration-400 ${
          isMinimized ? 'pb-4' : 'pb-6'
        }`}
      >
        <div
          className={`w-full max-w-6xl mx-auto px-4 transition-all ${
            isMinimized ? 'max-w-2xl' : 'max-w-7xl'
          }`}
        >
          <div
            className={`
              relative 
              bg-[#141414]/95 
              border border-[#262626] 
              rounded-xl 
              shadow-[0_-10px_40px_rgba(0,0,0,0.65)] 
              overflow-hidden 
              transition-all 
               ${isMinimized ? 'py-2 px-3' : 'py-3 px-4'}
            `}
          >
            {/* Top Bar / Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.7)]" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/70" />
                  <span className="w-2 h-2 rounded-full bg-red-500/70" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs tracking-[0.2em] text-gray-500 uppercase">
                    IN3D ENVIRONMENT STUDIO
                  </span>
                  {!isMinimized && (
                    <span className="text-[11px] text-gray-400 mt-0.5">
                      Prompt-based skybox & asset generation
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Plan / Usage pill */}
                {!isMinimized && (
                  <div className="hidden md:flex flex-col items-end text-[11px]">
                    <span className="uppercase tracking-[0.2em] text-gray-500">
                      {subscriptionInfo.planName}
                    </span>
                    {!isUnlimited && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 h-1.5 rounded-full bg-[#1e1e1e] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-yellow-400"
                            style={{ width: `${usagePercentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {currentUsage}/{currentLimit} used
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Minimize / Expand button */}
                {setBackgroundSkybox && (
                  <button
                    onClick={togglePanelSize}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1e1e1e] border border-[#333] hover:bg-[#262626] text-gray-300"
                    aria-label={isMinimized ? "Expand panel" : "Minimize panel"}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Minimized State */}
            {isMinimized ? (
              <div className="flex items-center justify-between text-xs text-gray-300">
                <button
                  onClick={() => setIsMinimized(false)}
                  className="px-3 py-1.5 rounded-md bg-[#1f1f1f] border border-[#333333] hover:bg-[#262626] text-[11px] tracking-[0.16em] uppercase"
                >
                  New Generation
                </button>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  {generatedVariations.length > 0 && (
                    <span>
                      {currentVariationIndex + 1}/{generatedVariations.length} variations
                    </span>
                  )}
                  {isGenerating && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      Generating…
                    </span>
                  )}
                </div>
              </div>
            ) : (
              // Expanded State
              <div className="space-y-4">
                {/* Error Banner */}
                {error && (
                  <div className="border border-red-500/40 bg-red-900/20 rounded-md px-3 py-2 text-xs text-red-300 flex items-start gap-2">
                    <svg className="w-4 h-4 mt-[2px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* PROGRESS BAR (when generating) */}
                {isGenerating && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>{getProgressStatusText()}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#1f1f1f] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Main Grid (Editor style) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1: Prompt */}
                  <div className="md:col-span-2 space-y-3">
                    <div className="border border-[#262626] bg-[#121212] rounded-md px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] tracking-[0.16em] text-gray-500 uppercase">
                          Prompt
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {prompt.length}/600
                        </span>
                      </div>
                      <textarea
                        id="prompt"
                        maxLength={600}
                        rows={3}
                        placeholder="Describe the environment: lighting, mood, props, architecture..."
                        className="w-full text-xs rounded-md bg-[#151515] border border-[#303030] px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60 resize-none"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>

                    {/* Advanced Prompt Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label
                          htmlFor="variations"
                          className="block text-[11px] tracking-[0.16em] text-gray-500 uppercase mb-1"
                        >
                          Variations
                        </label>
                        <input
                          type="number"
                          id="variations"
                          min="1"
                          max="10"
                          placeholder="1–10"
                          className="w-full text-xs rounded-md bg-[#151515] border border-[#303030] px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60"
                          value={numVariations}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            setNumVariations(Math.min(10, Math.max(1, value)));
                          }}
                          disabled={isGenerating}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="negativeTextToggle"
                            className="h-3 w-3 rounded border border-[#444] bg-[#151515]"
                            checked={showNegativeTextInput}
                            onChange={() => setShowNegativeTextInput(!showNegativeTextInput)}
                          />
                          <label
                            htmlFor="negativeTextToggle"
                            className="text-[11px] text-gray-400"
                          >
                            Enable Negative Prompt
                          </label>
                        </div>

                        {showNegativeTextInput && (
                          <input
                            type="text"
                            placeholder="Elements to avoid: low-res, blurry, washed out..."
                            className="w-full text-xs rounded-md bg-[#151515] border border-[#303030] px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60"
                            value={negativeText}
                            onChange={(e) => setNegativeText(e.target.value)}
                          />
                        )}
                      </div>
                    </div>

                    {/* 3D Asset Generation */}
                    {has3DObjects && assetGenerationService && storageAvailable && (
                      <div className="border border-[#2a3a2a] bg-[#101712] rounded-md px-3 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-[11px] tracking-[0.16em] text-emerald-400 uppercase">
                              3D Assets Detected
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              Convert key objects in your prompt into Meshy assets.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowAssetPanel(true)}
                            className="px-3 py-1.5 rounded-md bg-emerald-600/80 hover:bg-emerald-500 text-[11px] font-semibold text-white tracking-[0.12em] uppercase"
                          >
                            Generate Assets
                          </button>
                        </div>
                      </div>
                    )}

                    {!storageAvailable && (
                      <div className="border border-red-500/40 bg-red-900/20 rounded-md px-3 py-3 space-y-2">
                        <p className="text-xs text-red-300">
                          ⚠ 3D Asset generation is temporarily unavailable due to storage configuration issues.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleStorageRecovery}
                            className="px-3 py-1.5 rounded-md bg-sky-600/80 hover:bg-sky-500 text-[11px] font-semibold text-white tracking-[0.12em] uppercase"
                          >
                            Try Recovery
                          </button>
                          <button
                            onClick={runDiagnostics}
                            className="px-3 py-1.5 rounded-md bg-purple-600/80 hover:bg-purple-500 text-[11px] font-semibold text-white tracking-[0.12em] uppercase"
                          >
                            Diagnostics
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Debug / Meshy Test in dev */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="border border-[#343434] bg-[#151515] rounded-md px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] tracking-[0.16em] text-gray-500 uppercase">
                            Debug / Meshy
                          </span>
                          <button
                            onClick={() => setShowTestPanel(!showTestPanel)}
                            className="px-3 py-1.5 rounded-md bg-[#262626] hover:bg-[#2f2f2f] text-[11px] text-gray-200 uppercase tracking-[0.12em]"
                          >
                            {showTestPanel ? 'Hide Panel' : 'Show Panel'}
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            console.log('🔧 Manual Debug Test');
                            console.log('Prompt:', prompt);
                            console.log('Has 3D Objects State:', has3DObjects);
                            console.log('Meshy Configured:', assetGenerationService.isMeshyConfigured());
                            console.log('Preview Extraction:', assetGenerationService.previewExtraction(prompt));
                            console.log('Should Show Button:', has3DObjects && assetGenerationService.isMeshyConfigured());
                          }}
                          className="w-full mt-1 px-3 py-1.5 rounded-md bg-gradient-to-r from-red-500/70 to-pink-600/70 hover:from-red-500 hover:to-pink-500 text-[11px] text-white font-semibold tracking-[0.12em] uppercase"
                        >
                          Debug Services (Console)
                        </button>
                        {showTestPanel && (
                          <div className="mt-2 border-t border-[#2a2a2a] pt-2">
                            <MeshyTestPanel />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Style & Actions */}
                    <div className="space-y-3">
                      {/* Style selector */}
                     <div className="border border-[#262626] bg-[#121212] rounded-md px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] tracking-[0.16em] text-gray-500 uppercase">
                          In3D.Ai Style
                        </span>
                        {selectedSkybox && (
                          <span className="text-[10px] text-gray-400">
                            {selectedSkybox.name}
                          </span>
                        )}
                      </div>

                       {/* Active style preview above style list – mimic Skybox panel */}
                       {selectedSkybox && (
                         <div className="mb-3 rounded-lg overflow-hidden border border-[#363636] bg-[#101010]">
                           <div className="relative">
                             {selectedSkybox.image_jpg && (
                               <img
                                 src={selectedSkybox.image_jpg}
                                 alt={selectedSkybox.name}
                                 className="w-full h-36 object-cover"
                               />
                             )}
                             <div className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2 space-y-0.5">
                               <p className="text-xs font-medium text-gray-100 truncate">
                                 {selectedSkybox.name}
                               </p>
                               {selectedSkybox.description && (
                                 <p className="text-[11px] text-gray-300/90 line-clamp-2">
                                   {selectedSkybox.description}
                                 </p>
                               )}
                             </div>
                           </div>
                         </div>
                       )}

                      {stylesLoading ? (
                        <div className="text-[11px] text-gray-500 py-1">Loading styles…</div>
                      ) : stylesError ? (
                        <div className="text-[11px] text-red-400 py-1">{stylesError}</div>
                      ) : (
                        <div className="mt-1 relative">
                          <select
                            value={selectedSkybox?.id ?? ''}
                            onChange={handleSkyboxStyleChange}
                            className="w-full appearance-none rounded-md border border-emerald-500/70 bg-[#151515] px-3 py-2 pr-8 text-xs text-gray-100 shadow-[0_0_0_1px_rgba(16,185,129,0.4)] focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500/80"
                          >
                            <option value="" disabled>
                              Select a style
                            </option>
                            {skyboxStyles.map((style) => (
                              <option key={style.id} value={style.id}>
                                {style.name}
                                {style.model ? ` · ${style.model}` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <svg
                              className="h-3 w-3 text-gray-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Generation / Download buttons */}
                    <div className="border border-[#262626] bg-[#121212] rounded-md px-3 py-3 space-y-2">
                      <div className="space-y-2">
                        <button
                          className={`
                            w-full py-2.5 rounded-md text-xs font-semibold uppercase tracking-[0.16em]
                            flex items-center justify-center gap-2
                            ${
                              isGenerating
                                ? 'bg-sky-600/60 text-white cursor-not-allowed'
                                : !isUnlimited && remainingAfterGeneration < 0
                                ? 'bg-gradient-to-r from-purple-500/80 to-pink-600/80 text-white'
                                : 'bg-gradient-to-r from-sky-500/80 to-indigo-600/80 hover:from-sky-500 hover:to-indigo-500 text-white'
                            }
                          `}
                          onClick={
                            !isUnlimited && remainingAfterGeneration < 0
                              ? handleUpgrade
                              : generateSkybox
                          }
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4"
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
                              <span>Generating</span>
                            </>
                          ) : !isUnlimited && remainingAfterGeneration < 0 ? (
                            <>
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
                              <span>
                                {subscription?.planId === 'free'
                                  ? 'Upgrade to Pro'
                                  : 'Upgrade Plan'}
                              </span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.8}
                                  d="M12 4v9m0 0l-3-3m3 3l3-3m-9 8h12"
                                />
                              </svg>
                              <span>Generate In3D.Ai</span>
                            </>
                          )}
                        </button>

                        <button
                          className={`
                            w-full py-2.5 rounded-md text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2
                            ${
                              !currentImageForDownload
                                ? 'bg-[#1f1f1f] text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-500/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white'
                            }
                          `}
                          onClick={() => setShowDownloadPopup(true)}
                          disabled={!currentImageForDownload}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          <span>Download</span>
                        </button>
                      </div>

                      {/* Requirements / Service Status */}
                      {(!storageAvailable || serviceStatusError) && (
                        <div className="mt-2 border border-red-500/30 bg-red-900/10 rounded-md px-2.5 py-2">
                          <div className="flex items-center gap-1 mb-1">
                            <svg
                              className="w-3.5 h-3.5 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                            <span className="text-[11px] text-red-300 font-medium">
                              Asset Generation Unavailable
                            </span>
                          </div>
                          <ul className="list-disc list-inside text-[11px] text-red-200/90">
                            {getMissingRequirements().map(req => (
                              <li key={req}>{req}</li>
                            ))}
                          </ul>
                          {serviceStatusError && (
                            <p className="text-[10px] text-red-200 mt-1">
                              {serviceStatusError}
                            </p>
                          )}
                          <button
                            className="mt-2 w-full py-1.5 rounded-md bg-red-600/80 hover:bg-red-500 text-[11px] text-white uppercase tracking-[0.12em] flex items-center justify-center gap-1"
                            onClick={runDiagnostics}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                            Debug Services
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Popup */}
      <DownloadPopup
        isOpen={showDownloadPopup}
        onClose={() => setShowDownloadPopup(false)}
        imageUrl={currentImageForDownload?.image}
        title={prompt || 'In3D.Ai environment'}
      />

      {/* Upgrade Modal */}
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscriptionInfo.plan}
      />

      {/* Asset Panel */}
      <AssetGenerationPanel
        isVisible={showAssetPanel}
        prompt={prompt}
        skyboxId={generatedVariations[currentVariationIndex]?.id}
        onAssetsGenerated={handleAssetGeneration}
        onClose={() => setShowAssetPanel(false)}
      />

      {/* Variation Navigation Arrows */}
      {generatedVariations.length > 0 && (
        <>
          <button
            onClick={() => handleVariationChange('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-[#333] text-white backdrop-blur-md transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-500/60 z-40"
            aria-label="Previous variation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => handleVariationChange('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-[#333] text-white backdrop-blur-md transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-500/60 z-40"
            aria-label="Next variation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1.5 rounded-md backdrop-blur-md border border-[#333] text-[11px] text-gray-200 z-40">
            Variation {currentVariationIndex + 1} / {generatedVariations.length}
          </div>
        </>
      )}

      {/* Storage Status & Diagnostic overlays */}
      <StorageStatusIndicator />
      {(process.env.NODE_ENV === 'development' || serviceStatusError || !storageAvailable) && (
        <ConfigurationDiagnostic />  
      )}
    </div>
  );
};

export default MainSection;
