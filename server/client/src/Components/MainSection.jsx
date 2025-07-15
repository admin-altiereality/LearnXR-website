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

const MainSection = ({ setBackgroundSkybox }) => {
  console.log('MainSection component rendered');
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

  // Reactive object detection with error handling
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

  useEffect(() => {
    setStylesLoading(true);
    setStylesError(null);
    const fetchSkyboxStyles = async () => {
      try {
        const response = await skyboxApiService.getStyles(1, 100);
        const styles = response.data || [];
        setSkyboxStyles(styles);
        setStylesLoading(false);
        setStylesError(null);
        console.log('Fetched In3D.Ai styles:', styles);
      } catch (error) {
        setStylesLoading(false);
        setStylesError("Failed to load In3D.Ai styles. Please check your API configuration.");
        setSkyboxStyles([]);
        console.error("Error fetching In3D.Ai styles:", error);
        
        // Show user-friendly error message
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

  useEffect(() => {
    // Check service availability with alternative storage support
    const checkAvailability = async () => {
      try {
        setServiceStatusLoading(true);
        setServiceStatusError(null);
        
        // Check if Meshy is configured first
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

  // Add recovery function for storage issues with alternative storage support
  const handleStorageRecovery = async () => {
    try {
      console.log('🔄 User requested storage recovery...');
      setError('Attempting to recover storage connection...');
      
      // Check current service status
      const status = await assetGenerationService.getServiceStatus();
      
      // If alternative storage is available, we can still work
      if (status.alternativeStorageAvailable) {
        setStorageAvailable(true);
        setError(null);
        console.log('✅ Alternative storage available - service can continue');
        
        // Show success message about alternative storage
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
      
      // Try to recover Firebase Storage
      const fixes = await StorageTestUtility.attemptAutoFix();
      
      // Check if recovery was successful
      const available = await isStorageAvailable();
      
      if (available) {
        setStorageAvailable(true);
        setError(null);
        console.log('✅ Firebase Storage recovery successful');
        
        // Show success message
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
        
        // Show detailed error with fixes attempted
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

  // Add diagnostic function for debugging with alternative storage support
  const runDiagnostics = async () => {
    try {
      console.log('🔧 Running comprehensive diagnostics...');
      
      // Get asset generation service status
      const serviceStatus = await assetGenerationService.getServiceStatus();
      
      // Run Firebase storage diagnostics
      const firebaseResults = await StorageTestUtility.runFullDiagnostics();
      
      // Combine results
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
      
      // Display enhanced results
      const diagnosticMessage = document.createElement('div');
      diagnosticMessage.className = 'fixed top-4 right-4 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-lg';
      
      let messageHtml = '<div class="font-bold mb-3">🔧 Diagnostic Results</div>';
      
      // Service status
      messageHtml += '<div class="mb-3"><div class="font-semibold text-sm">Service Status:</div>';
      messageHtml += `<div class="text-xs">• Meshy API: ${serviceStatus.meshyConfigured ? '✅' : '❌'}</div>`;
      messageHtml += `<div class="text-xs">• Firebase Storage: ${serviceStatus.firebaseStorageAvailable ? '✅' : '❌'}</div>`;
      messageHtml += `<div class="text-xs">• Alternative Storage: ${serviceStatus.alternativeStorageAvailable ? '✅' : '❌'}</div>`;
      messageHtml += `<div class="text-xs">• User Auth: ${serviceStatus.userAuthenticated ? '✅' : '❌'}</div>`;
      messageHtml += '</div>';
      
      // Alternative storage providers
      if (serviceStatus.alternativeStorageAvailable) {
        messageHtml += '<div class="mb-3"><div class="font-semibold text-sm">Alternative Storage Providers:</div>';
        results.alternativeStorage.providers.forEach(provider => {
          messageHtml += `<div class="text-xs">• ${provider}</div>`;
        });
        messageHtml += '</div>';
      }
      
      // Errors
      if (serviceStatus.errors.length > 0) {
        messageHtml += '<div class="mb-3"><div class="font-semibold text-sm text-red-400">Errors:</div>';
        serviceStatus.errors.forEach(error => {
          messageHtml += `<div class="text-xs text-red-300">• ${error}</div>`;
        });
        messageHtml += '</div>';
      }
      
      // Firebase results
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
      
      // Show simple error message
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

  // Modify the effect to handle navigation source and style selection
  useEffect(() => {
    const fromExplore = sessionStorage.getItem('fromExplore');
    const savedStyle = sessionStorage.getItem('selectedSkyboxStyle');
    const navigateToMain = sessionStorage.getItem('navigateToMain');
    
    if (fromExplore && savedStyle && navigateToMain) {
      try {
        const parsedStyle = JSON.parse(savedStyle);
        setSelectedSkybox(parsedStyle);
        setShowStylePreview(true);
        
        // Show success message that style is now selected
        const successMessage = document.createElement('div');
        successMessage.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
        successMessage.innerHTML = `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>Style "${parsedStyle.name}" is now selected! Ready to create.</span>
        `;
        document.body.appendChild(successMessage);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
          if (successMessage.parentNode) {
            successMessage.parentNode.removeChild(successMessage);
          }
        }, 3000);
        
        // Clear the stored data after using it
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

  // Get current plan details with proper type safety
  const currentPlan = subscriptionService.getPlanById(subscription?.planId || 'free');
  const currentUsage = parseInt(subscription?.usage?.skyboxGenerations || 0);
  const currentLimit = currentPlan?.limits.skyboxGenerations || 10;
  const isUnlimited = currentLimit === Infinity;
  
  // Calculate remaining generations (current)
  const remainingGenerations = isUnlimited 
    ? '∞' 
    : Math.max(0, currentLimit - currentUsage);
  
  // Calculate remaining generations after current generation
  const remainingAfterGeneration = isUnlimited 
    ? '∞' 
    : Math.max(0, currentLimit - currentUsage - numVariations);
  
  // Calculate usage percentage (current usage only)
  const usagePercentage = isUnlimited 
    ? 0 
    : Math.min((currentUsage / currentLimit) * 100, 100);
  
  // Calculate projected usage percentage (for warning display)
  const projectedUsagePercentage = isUnlimited 
    ? 0 
    : Math.min(((currentUsage + numVariations) / currentLimit) * 100, 100);

  // Update subscription after generation
  const updateSubscriptionCount = async () => {
    if (user?.uid) {
      const updatedSubscription = await subscriptionService.getUserSubscription(user.uid);
      setSubscription(updatedSubscription);
    }
  };

  const generateSkybox = async () => {
    if (!prompt || !selectedSkybox) {
              setError("Please provide a prompt and select an In3D.Ai style");
      return;
    }

    // Check subscription limits before generating
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
    setShowStylePreview(false);
    setProgress(0);
    setGeneratedVariations([]);
    setCurrentVariationIndex(0);
    setCurrentSkyboxIndex(0);

    let pollInterval;

    try {
      // Generate all skyboxes as variations
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
            const statusResponse = await skyboxApiService.getSkyboxStatus(variationId);
            variationStatus = statusResponse.data; // New API structure
            console.log(`Status for ${variationId}:`, variationStatus);
            
            if (variationStatus.status !== "completed" && variationStatus.status !== "complete") {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } while (variationStatus.status !== "completed" && variationStatus.status !== "complete");

          // Ensure we have a valid image URL
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

      // Set all variations
      setGeneratedVariations(variationResults);
      setBackgroundSkybox(variationResults[0]);
      
      // Set the current image for download (first variation)
      setCurrentImageForDownload(variationResults[0]);
      
      // Update subscription usage count
      if (user?.uid) {
        try {
          // Increment usage for each variation generated
          for (let i = 0; i < numVariations; i++) {
            await subscriptionService.incrementUsage(user.uid, 'skyboxGenerations');
          }
          
          // Refresh subscription data
          await updateSubscriptionCount();
          
          console.log(`Updated subscription usage: ${numVariations} In3D.Ai generations added`);
        } catch (error) {
          console.error('Error updating subscription usage:', error);
          // Don't fail the generation if usage tracking fails
        }
      }

      setProgress(100);
      setIsGenerating(false);
      
      // Add minimized state after successful generation
      setTimeout(() => {
        setIsMinimized(true);
      }, 1000);
    } catch (error) {
      console.error("Error generating skybox:", error);
      
      let errorMessage = "Failed to generate In3D.Ai environment";
      
      // Handle specific error types from Firebase Functions
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
  const getProgressStatusText = () => {
    if (progress < 30) return "Initializing generation...";
    if (progress < 60) return "Generating skybox variations...";
    if (progress < 90) return "Processing final results...";
    return "Finalizing...";
  };

  // Handle 3D asset generation
  const handleAssetGeneration = (assets) => {
    setGeneratedAssets(assets);
    setShowAssetPanel(false);
    
    // Show success notification
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

  // Debug logging for button visibility
  console.log('🔍 Current state:', {
    prompt,
    has3DObjects,
    meshyConfigured: assetGenerationService.isMeshyConfigured(),
    shouldShowButton: has3DObjects && assetGenerationService.isMeshyConfigured()
  });

  // Debug function to test Meshy integration
  const testMeshyIntegration = async () => {
    console.log('🧪 Testing Meshy integration...');
    
    // Test 1: Check if Meshy is configured
    const isConfigured = assetGenerationService.isMeshyConfigured();
    console.log('✅ Meshy configured:', isConfigured);
    
    // Test 2: Test keyword extraction
    const testPrompt = "A sci-fi jungle with alien structures and a crashed spaceship";
    const extraction = assetGenerationService.previewExtraction(testPrompt);
    console.log('✅ Keyword extraction test:', extraction);
    
    // Test 3: Test cost estimation
    const costEstimate = assetGenerationService.estimateCost(testPrompt, 'medium');
    console.log('✅ Cost estimation test:', costEstimate);
    
    // Test 4: Test single asset generation (if configured)
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

  // Check Firebase services on component mount
  useEffect(() => {
    console.log('🔧 Checking Firebase services...');
    console.log('📦 Storage available:', isStorageAvailable());
    console.log('🔑 Auth available:', !!useAuth);
    console.log('🗄️ Firestore available:', !!require('../config/firebase').db);
  }, []);

  // Helper: get missing requirements
  const getMissingRequirements = () => {
    if (!serviceStatus) return [];
    const missing = [];
    if (!serviceStatus.meshyConfigured) missing.push('Meshy API Key');
    if (!serviceStatus.firebaseStorageAvailable && !serviceStatus.alternativeStorageAvailable) missing.push('Storage (Firebase or Alternative)');
    if (!serviceStatus.userAuthenticated) missing.push('User Authentication');
    return missing;
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
                <div className="flex items-center justify-center">
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

                  {/* 3D Asset Generation Button */}
                  {has3DObjects && assetGenerationService && storageAvailable && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowAssetPanel(true)}
                        className="w-full py-2 px-4 bg-gradient-to-r from-green-500/50 to-emerald-600/50 hover:from-green-600/60 hover:to-emerald-700/60 text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500/50 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span className="text-sm">Generate 3D Assets</span>
                        </div>
                      </button>
                      <p className="text-xs text-gray-400 mt-1 text-center">
                        Found objects in your prompt - generate 3D models
                      </p>
                    </div>
                  )}

                  {/* Storage Error Message */}
                  {!storageAvailable && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">
                        ⚠️ 3D Asset generation is temporarily unavailable due to storage configuration issues.
                      </p>
                      <button
                        onClick={handleStorageRecovery}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors duration-200"
                      >
                        Try Recovery
                      </button>
                      <button
                        onClick={runDiagnostics}
                        className="ml-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 transition-colors duration-200"
                      >
                        Run Diagnostics
                      </button>
                    </div>
                  )}

                  {/* Debug Test Button (only in development) */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowTestPanel(!showTestPanel)}
                        className="w-full py-2 px-4 bg-gradient-to-r from-yellow-500/50 to-orange-600/50 hover:from-yellow-600/60 hover:to-orange-700/60 text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500/50 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm">{showTestPanel ? 'Hide' : 'Show'} Meshy Test Panel</span>
                        </div>
                      </button>
                      <p className="text-xs text-gray-400 mt-1 text-center">
                        Debug: Test Meshy.ai integration components
                      </p>
                    </div>
                  )}

                  {/* Show error if requirements are missing */}
                  {(!storageAvailable || serviceStatusError) && (
                    <div className="mb-4">
                      <div className="bg-red-500/80 text-white px-4 py-3 rounded-lg shadow flex flex-col items-center">
                        <div className="font-bold flex items-center mb-1">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Asset Generation Unavailable
                        </div>
                        <div className="text-sm mb-2">The following requirements are missing:</div>
                        <ul className="list-disc list-inside text-sm mb-2">
                          {getMissingRequirements().map(req => (
                            <li key={req}>{req}</li>
                          ))}
                        </ul>
                        {serviceStatusError && (
                          <div className="text-xs text-gray-200 mb-2">{serviceStatusError}</div>
                        )}
                        <button
                          className="w-full mt-2 py-2 px-4 rounded-md bg-red-600/90 hover:bg-red-700/90 text-white font-medium flex items-center justify-center transition-all duration-300"
                          onClick={runDiagnostics}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Debug Services (Check Console)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Temporary Debug Button - Always Show */}
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        console.log('🔧 Manual Debug Test');
                        console.log('Prompt:', prompt);
                        console.log('Has 3D Objects State:', has3DObjects);
                        console.log('Meshy Configured:', assetGenerationService.isMeshyConfigured());
                        console.log('Preview Extraction:', assetGenerationService.previewExtraction(prompt));
                        console.log('Should Show Button:', has3DObjects && assetGenerationService.isMeshyConfigured());
                      }}
                      className="w-full py-2 px-4 bg-gradient-to-r from-red-500/50 to-pink-600/50 hover:from-red-600/60 hover:to-pink-700/60 text-white rounded-md font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500/50 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-sm">Debug Services (Check Console)</span>
                      </div>
                    </button>
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      Temporary: Test all services and show debug info
                    </p>
                  </div>

                  {/* Meshy Test Panel */}
                  {showTestPanel && (
                    <div className="mb-4">
                      <MeshyTestPanel />
                    </div>
                  )}

                  {/* Skybox Style and Generate Button - Three Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-200">In3D.Ai Style</label>
                      {stylesLoading ? (
                        <div className="text-gray-400 text-xs py-2">Loading styles...</div>
                      ) : stylesError ? (
                        <div className="text-red-400 text-xs py-2">{stylesError}</div>
                      ) : (
                        <select
                          className="w-full p-2 bg-gray-700/30 border border-gray-600/50 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm backdrop-blur-sm"
                          onChange={handleSkyboxStyleChange}
                          value={selectedSkybox?.id || ""}
                        >
                          <option value="" disabled>
                            -- Choose an In3D.Ai Style --
                          </option>
                          {skyboxStyles.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name} {style.model ? `(Model: ${style.model})` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-end">
                      <button
                        className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50 ${
                          isGenerating 
                            ? 'bg-blue-500/50 cursor-not-allowed backdrop-blur-sm'
                            : !isUnlimited && remainingAfterGeneration < 0
                            ? 'bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm'
                            : 'bg-gradient-to-r from-blue-500/50 to-indigo-600/50 hover:from-blue-600/60 hover:to-indigo-700/60 transform hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm'
                        }`}
                        onClick={!isUnlimited && remainingAfterGeneration < 0 ? handleUpgrade : generateSkybox}
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
                              <span className="text-sm">{progress < 100 ? 'Generating...' : 'Applying In3D.Ai...'}</span>
                            </>
                          ) : !isUnlimited && remainingAfterGeneration < 0 ? (
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
                            <span className="text-sm">Generate In3D.Ai</span>
                          )}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-end">
                      <button
                        className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500/50 
                          ${!currentImageForDownload 
                            ? 'bg-gray-600/30 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 transform hover:-translate-y-0.5 active:translate-y-0'} 
                          backdrop-blur-sm`}
                        onClick={() => setShowDownloadPopup(true)}
                        disabled={!currentImageForDownload}
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
            </div>
          </div>
        </div>
      </div>

      <DownloadPopup
        isOpen={showDownloadPopup}
        onClose={() => setShowDownloadPopup(false)}
        imageUrl={currentImageForDownload?.image}
        title={prompt || 'In3D.Ai environment'}
      />

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscriptionInfo.plan}
      />

      <AssetGenerationPanel
        isVisible={showAssetPanel}
        prompt={prompt}
        skyboxId={generatedVariations[currentVariationIndex]?.id}
        onAssetsGenerated={handleAssetGeneration}
        onClose={() => setShowAssetPanel(false)}
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

      {/* Storage Status Indicator */}
      <StorageStatusIndicator />
      
      {/* Configuration Diagnostic - Show in development or when there are errors */}
      {(process.env.NODE_ENV === 'development' || serviceStatusError || !storageAvailable) && (
        <ConfigurationDiagnostic />
      )}
    </div>
  );
}

export default MainSection;