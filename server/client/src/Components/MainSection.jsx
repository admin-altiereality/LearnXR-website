import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useCreateGeneration } from '../contexts/CreateGenerationContext';
import OnboardCard from './ui/onboard-card';
import { DottedSurface } from './ui/dotted-surface';

// ============================================
// TRIAL USER CONSTANTS
// ============================================
const TRIAL_ALLOWED_STYLES = [
  { id: 2, name: 'Realistic', slug: 'realistic' },
  { id: 5, name: 'Fantasy', slug: 'fantasy' },
  { id: 15, name: 'Low Poly', slug: 'low-poly' },
  { id: 8, name: 'Stylized', slug: 'stylized' },
  { id: 12, name: 'Cyberpunk', slug: 'cyberpunk' },
];
const TRIAL_MAX_VARIATIONS = 1;
import { subscriptionService } from '../services/subscriptionService';
import DownloadPopup from './DownloadPopup';
import UpgradeModal from './UpgradeModal';
import { skyboxApiService } from '../services/skyboxApiService';
import AssetGenerationPanel from './AssetGenerationPanel';
import { MeshyTestPanel } from './MeshyTestPanel';
import { assetGenerationService } from '../services/assetGenerationService';
import { promptParserService } from '../services/promptParserService';
import { coordinatedPromptGeneratorService } from '../services/coordinatedPromptGeneratorService';
import { isStorageAvailable } from '../utils/firebaseStorage';
import { StorageTestUtility } from '../utils/storageTest';
import { StorageStatusIndicator } from './StorageStatusIndicator';
import ConfigurationDiagnostic from './ConfigurationDiagnostic';
import { AssetViewerWithSkybox } from './AssetViewerWithSkybox';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const MainSection = ({ setBackgroundSkybox }) => {
  console.log('MainSection component rendered');

  // -------------------------
  // Dev Mode & URL Params
  // -------------------------
  const [searchParams] = useSearchParams();
  const isDevMode = searchParams.get('dev') === 'true';

  // -------------------------
  // UI State
  // -------------------------
  const [showNegativeTextInput, setShowNegativeTextInput] = useState(true);
  const [skyboxStyles, setSkyboxStyles] = useState([]);
  
  // Use global generation context FIRST (before using it in useState initializers)
  const {
    state: generationState,
    setGenerating,
    setGenerating3DAsset,
    setSkyboxProgress,
    setAssetGenerationProgress,
    setGenerationProgress,
    setCurrentJobId,
    setPrompt: setGlobalPrompt,
    setNegativeText: setGlobalNegativeText,
    setSelectedSkybox: setGlobalSelectedSkybox,
    setNumVariations: setGlobalNumVariations,
    setGenerated3DAsset: setGlobalGenerated3DAsset,
    startGeneration,
    resetGeneration
  } = useCreateGeneration();
  
  // Initialize from context if available, otherwise use defaults
  const [selectedSkybox, setSelectedSkybox] = useState(() => {
    return generationState?.selectedSkybox || null;
  });
  const [prompt, setPrompt] = useState(() => {
    return generationState?.prompt || "";
  });
  const [negativeText, setNegativeText] = useState(() => {
    return generationState?.negativeText || "";
  });
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // Sync local state with global state
  const isGenerating = generationState?.isGenerating || false;
  const isGenerating3DAsset = generationState?.isGenerating3DAsset || false;
  const skyboxProgress = generationState?.skyboxProgress || 0;
  const assetGenerationProgress = generationState?.assetGenerationProgress || null;
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [generatedImageId, setGeneratedImageId] = useState(null);
  const [generatedVariations, setGeneratedVariations] = useState([]);
  const [currentVariationIndex, setCurrentVariationIndex] = useState(0);
  
  // Initialize from context if available, otherwise use defaults
  const [numVariations, setNumVariations] = useState(() => {
    return generationState?.numVariations || 5;
  });
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentImageForDownload, setCurrentImageForDownload] = useState(null);
  const [stylesLoading, setStylesLoading] = useState(true);
  const [stylesError, setStylesError] = useState(null);
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [has3DObjects, setHas3DObjects] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [serviceStatusError, setServiceStatusError] = useState(null);
  // 3D Asset generation state - initialize from context
  const [generated3DAsset, setGenerated3DAsset] = useState(() => {
    return generationState?.generated3DAsset || null;
  });
  const [show3DAssetViewer, setShow3DAssetViewer] = useState(false);
  // Intelligent prompt parsing state
  const [parsedPrompt, setParsedPrompt] = useState(null);
  // Coordinated prompt generation state (for 3D asset integration)
  const [coordinatedPrompts, setCoordinatedPrompts] = useState(null);
  const [groundingMetadata, setGroundingMetadata] = useState(null);
  
  // Loading indicator context
  const { showLoading, hideLoading, updateProgress } = useLoading();

  // -------------------------
  // Intelligent prompt parsing
  // -------------------------
  useEffect(() => {
    if (prompt.trim()) {
      try {
        const parsed = promptParserService.parsePrompt(prompt);
        setParsedPrompt(parsed);
        console.log('🧠 Intelligent prompt parsing:', {
          original: parsed.original,
          asset: parsed.asset,
          background: parsed.background,
          confidence: parsed.confidence,
          method: parsed.method
        });

        // Generate coordinated prompts if 3D objects are detected
        if (has3DObjects && assetGenerationService.isMeshyConfigured()) {
          try {
            const coordinated = coordinatedPromptGeneratorService.generate(prompt.trim());
            setCoordinatedPrompts(coordinated);
            setGroundingMetadata(coordinated.grounding_metadata);
            console.log('🎯 Coordinated prompts generated:', {
              skybox_prompt: coordinated.skybox_prompt.substring(0, 80) + '...',
              asset_prompt: coordinated.asset_prompt.substring(0, 80) + '...',
              grounding_metadata: coordinated.grounding_metadata
            });
          } catch (error) {
            console.warn('⚠️ Failed to generate coordinated prompts, using fallback:', error);
            setCoordinatedPrompts(null);
            setGroundingMetadata(null);
          }
        } else {
          setCoordinatedPrompts(null);
          setGroundingMetadata(null);
        }
      } catch (error) {
        console.error('Error parsing prompt:', error);
        setParsedPrompt(null);
        setCoordinatedPrompts(null);
        setGroundingMetadata(null);
      }
    } else {
      setParsedPrompt(null);
      setCoordinatedPrompts(null);
      setGroundingMetadata(null);
    }
  }, [prompt, has3DObjects]);

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
        setServiceStatusError(null);
        
        const meshyConfigured = assetGenerationService.isMeshyConfigured();
        console.log('🔧 Meshy configuration check:', meshyConfigured);
        
        if (!meshyConfigured) {
          setServiceStatusError('Meshy API key not configured. Please add VITE_MESHY_API_KEY to your environment variables.');
          setStorageAvailable(false);
          return;
        }
        
        const available = await assetGenerationService.isServiceAvailable();
        setStorageAvailable(available);
        const status = await assetGenerationService.getServiceStatus();
        setServiceStatus(status);
        
        if (!available) {
          if (status.errors.length > 0) {
            setServiceStatusError(status.errors.join(' | '));
          }
        }
        
        console.log('🔧 Service availability check completed:', { available, status });
      } catch (error) {
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
  // Restore UI state from context on mount (if available)
  // -------------------------
  useEffect(() => {
    // Restore prompt if available (only if local state is empty)
    if (generationState.prompt && !prompt) {
      setPrompt(generationState.prompt);
    }
    // Restore negative text if available (only if local state is empty)
    if (generationState.negativeText !== null && generationState.negativeText !== undefined && !negativeText) {
      setNegativeText(generationState.negativeText);
    }
    // Restore selected skybox if available (only if local state is empty)
    if (generationState.selectedSkybox && !selectedSkybox) {
      setSelectedSkybox(generationState.selectedSkybox);
    }
    // Restore num variations if available
    if (generationState.numVariations && generationState.numVariations !== numVariations) {
      setNumVariations(generationState.numVariations);
    }
    // Restore 3D asset if available (only if local state is empty)
    if (generationState.generated3DAsset && !generated3DAsset) {
      setGenerated3DAsset(generationState.generated3DAsset);
    }
  }, []); // Only run on mount

  // -------------------------
  // Sync local state to context during generation (debounced to avoid excessive updates)
  // -------------------------
  useEffect(() => {
    if (isGenerating || isGenerating3DAsset) {
      const timeoutId = setTimeout(() => {
        // Save prompt to context
        if (prompt && prompt !== generationState.prompt) {
          setGlobalPrompt(prompt);
        }
        // Save negative text to context
        if (negativeText !== generationState.negativeText) {
          setGlobalNegativeText(negativeText || null);
        }
        // Save selected skybox to context (compare by ID to avoid object reference issues)
        if (selectedSkybox && (!generationState.selectedSkybox || selectedSkybox.id !== generationState.selectedSkybox.id)) {
          setGlobalSelectedSkybox(selectedSkybox);
        }
        // Save num variations to context
        if (numVariations !== generationState.numVariations) {
          setGlobalNumVariations(numVariations);
        }
        // Save 3D asset to context (compare by ID or URL to avoid object reference issues)
        if (generated3DAsset) {
          const currentAsset = generationState.generated3DAsset;
          const hasChanged = !currentAsset || 
            (generated3DAsset.id && generated3DAsset.id !== currentAsset.id) ||
            (generated3DAsset.downloadUrl && generated3DAsset.downloadUrl !== currentAsset.downloadUrl) ||
            (generated3DAsset.previewUrl && generated3DAsset.previewUrl !== currentAsset.previewUrl);
          if (hasChanged) {
            setGlobalGenerated3DAsset(generated3DAsset);
          }
        }
      }, 500); // Debounce to avoid excessive localStorage writes

      return () => clearTimeout(timeoutId);
    }
  }, [prompt, negativeText, selectedSkybox, numVariations, generated3DAsset, isGenerating, isGenerating3DAsset]);

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
        // Also save to context if generation is active
        if (isGenerating || isGenerating3DAsset) {
          setGlobalSelectedSkybox(parsedStyle);
        }
        
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

  // -------------------------
  // Trial User Detection
  // -------------------------
  const isTrialUser = useMemo(() => {
    return !subscription || subscription.planId === 'free';
  }, [subscription]);

  // Filter styles based on trial status
  const availableStyles = useMemo(() => {
    if (isTrialUser) {
      // For trial users, filter skyboxStyles to only show allowed styles
      // Match by ID or name (case-insensitive)
      const allowedIds = TRIAL_ALLOWED_STYLES.map(s => s.id);
      const allowedNames = TRIAL_ALLOWED_STYLES.map(s => s.name.toLowerCase());
      
      const filtered = skyboxStyles.filter(style => 
        allowedIds.includes(style.id) || 
        allowedNames.includes(style.name?.toLowerCase())
      );
      
      // If no matches found in API styles, return the predefined trial styles
      return filtered.length > 0 ? filtered : TRIAL_ALLOWED_STYLES;
    }
    return skyboxStyles;
  }, [isTrialUser, skyboxStyles]);

  // Lock variations for trial users
  useEffect(() => {
    if (isTrialUser && numVariations !== TRIAL_MAX_VARIATIONS) {
      setNumVariations(TRIAL_MAX_VARIATIONS);
    }
  }, [isTrialUser, numVariations]);

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
      const updatedSubscription = await subscriptionService.getUserSubscription(
        user.uid
      );
      setSubscription(updatedSubscription);
    }
  };

  // -------------------------
  // Skybox generation (entry point for Generate button)
  // -------------------------
  const generateSkybox = async () => {

    if (!prompt || !prompt.trim()) {
      setError("Please provide a prompt for your In3D.Ai environment");
      return;
    }
    
    if (!selectedSkybox) {
      setError("Please select an In3D.Ai style");
      return;
    }
    
    if (!selectedSkybox.id || (typeof selectedSkybox.id === 'string' && !selectedSkybox.id.trim())) {
      setError("Invalid style selection. Please select a valid In3D.Ai style.");
      return;
    }
    
    // Validate style_id is a valid number
    const styleIdNumber = typeof selectedSkybox.id === 'string' ? parseInt(selectedSkybox.id, 10) : Number(selectedSkybox.id);
    if (isNaN(styleIdNumber) || styleIdNumber <= 0) {
      setError("Invalid style ID. Please select a different In3D.Ai style.");
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

    setGenerating(true);
    setGlobalPrompt(prompt.trim());
    // Save all UI state to context when generation starts
    setGlobalNegativeText(negativeText || null);
    setGlobalSelectedSkybox(selectedSkybox);
    setGlobalNumVariations(numVariations);
    setError(null);
    setProgress(0);
    setSkyboxProgress(0);
    setGeneratedVariations([]);
    setCurrentVariationIndex(0);

    let pollInterval;

    try {
      const variations = [];
      for (let i = 0; i < numVariations; i++) {
        // Ensure style_id is a valid number
        const styleIdNumber = typeof selectedSkybox.id === 'string' ? parseInt(selectedSkybox.id, 10) : Number(selectedSkybox.id);
        
        // Use coordinated prompt if available (for 3D asset integration), otherwise use intelligent parsing
        const skyboxPrompt = coordinatedPrompts?.skybox_prompt 
          ? coordinatedPrompts.skybox_prompt
          : (parsedPrompt && parsedPrompt.background 
            ? parsedPrompt.background 
            : prompt.trim());
        
        console.log('🌅 Generating skybox variation:', {
          variation: i + 1,
          originalPrompt: prompt.substring(0, 50) + '...',
          skyboxPrompt: skyboxPrompt.substring(0, 80) + '...',
          usingCoordinated: !!coordinatedPrompts?.skybox_prompt,
          usingParsed: !coordinatedPrompts?.skybox_prompt && !!parsedPrompt?.background,
          parsedAsset: parsedPrompt?.asset?.substring(0, 30) || 'N/A',
          parsedBackground: parsedPrompt?.background?.substring(0, 30) || 'N/A',
          confidence: parsedPrompt?.confidence || 0,
          style_id: styleIdNumber,
          style_name: selectedSkybox.name,
          has_negative_prompt: !!negativeText
        });
        
        const variationResponse = await skyboxApiService.generateSkybox({
          prompt: skyboxPrompt,
          style_id: styleIdNumber,
          negative_prompt: negativeText?.trim() || undefined,
          userId: user?.uid,
        });

        console.log('🌅 Generation response:', variationResponse);

        // Check for generationId or id
        const generationId = variationResponse?.data?.generationId || variationResponse?.data?.id;
        
        if (variationResponse && variationResponse.success && generationId) {
          console.log(`✅ Generation created with ID: ${generationId}`);
          variations.push(generationId.toString());
          const baseProgress = 10;
          const progressPerSkybox = 80 / numVariations;
          const currentProgress = baseProgress + (i * progressPerSkybox);
          setSkyboxProgress(Math.min(currentProgress, 90));
          setProgress(Math.min(currentProgress, 90));
        } else {
          console.error('❌ Invalid generation response:', variationResponse);
          throw new Error('Failed to create skybox generation. Please try again.');
        }
      }

      // Check if 3D asset generation should run in parallel
      const canGenerate3D = storageAvailable && assetGenerationService.isMeshyConfigured() && user?.uid;
      
      console.log('🔍 Parallel Generation - 3D Asset Check:', {
        storageAvailable,
        meshyConfigured: assetGenerationService.isMeshyConfigured(),
        hasUserId: !!user?.uid,
        canGenerate3D,
        prompt: prompt.substring(0, 50) + '...'
      });

      // Start both skybox polling and 3D asset generation in parallel
      const generationPromises = [];

      // Skybox polling promise
      const skyboxPromise = Promise.all(
        variations.map(async (variationId) => {
          console.log(`🔄 Starting to poll status for generation: ${variationId}`);
          let variationStatus;
          let attempts = 0;
          const maxAttempts = 180; // 6 minutes max (180 * 2 seconds)
          const baseInterval = 2000; // 2 seconds
          let currentInterval = baseInterval;
          let lastStatus = 'pending';
          
          do {
            try {
              const statusResponse = await skyboxApiService.getSkyboxStatus(variationId);
              
              if (!statusResponse.success) {
                throw new Error(statusResponse.error || 'Failed to get status');
              }
              
              variationStatus = statusResponse.data;
              const normalizedStatus = variationStatus?.status?.toLowerCase() || 'pending';
              lastStatus = normalizedStatus;
              
              console.log(`📊 Status for ${variationId} (attempt ${attempts + 1}/${maxAttempts}):`, normalizedStatus);
              
              // Handle all BlockadeLabs statuses: pending, dispatched, processing, complete, abort, error
              if (normalizedStatus === "completed" || normalizedStatus === "complete") {
                if (!variationStatus?.file_url) {
                  console.warn(`Generation ${variationId} marked complete but no file_url, continuing to poll...`);
                } else {
                  console.log(`✅ Generation ${variationId} completed!`);
                  break;
                }
              } else if (normalizedStatus === "failed" || normalizedStatus === "error" || normalizedStatus === "abort") {
                const errorMsg = variationStatus?.error_message || variationStatus?.error || 'Generation failed';
                throw new Error(errorMsg);
              } else if (normalizedStatus === "dispatched" || normalizedStatus === "processing") {
                // Generation is in progress - use shorter interval
                currentInterval = Math.min(baseInterval * 2, 5000); // 2-5 seconds
                // Update progress based on status
                const progressPercent = 10 + Math.min((attempts / maxAttempts) * 80, 80);
                setSkyboxProgress(progressPercent);
              } else if (normalizedStatus === "pending") {
                currentInterval = baseInterval;
                const progressPercent = 10 + Math.min((attempts / maxAttempts) * 20, 20);
                setSkyboxProgress(progressPercent);
              }
              
              attempts++;
              if (attempts >= maxAttempts) {
                throw new Error(`Generation timed out after ${maxAttempts} attempts. Last status: ${lastStatus}. Please check the history section - the generation may still be processing.`);
              }
              
              // Exponential backoff: gradually increase interval, cap at 10 seconds
              if (attempts > 1) {
                currentInterval = Math.min(currentInterval * 1.1, 10000);
              }
              
              await new Promise(resolve => setTimeout(resolve, currentInterval));
            } catch (error) {
              console.error(`❌ Error checking status for ${variationId}:`, error);
              // If it's a 404 or "not found" error, stop immediately
              if (error.message?.includes('not found') || error.message?.includes('expired')) {
                throw error;
              }
              // For other errors, use exponential backoff
              attempts++;
              if (attempts >= maxAttempts) {
                throw new Error(`Generation timed out. Last status: ${lastStatus}. Please check the history section.`);
              }
              currentInterval = Math.min(currentInterval * 2, 10000); // Double interval on error, max 10s
              await new Promise(resolve => setTimeout(resolve, currentInterval));
            }
          } while (attempts < maxAttempts && 
                   variationStatus?.status?.toLowerCase() !== "completed" && 
                   variationStatus?.status?.toLowerCase() !== "complete" &&
                   variationStatus?.status?.toLowerCase() !== "failed" &&
                   variationStatus?.status?.toLowerCase() !== "error" &&
                   variationStatus?.status?.toLowerCase() !== "abort");

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
      ).then((variationResults) => {
        // Save skybox to Firestore after polling completes
        return { type: 'skybox', data: variationResults };
      });

      generationPromises.push({ promise: skyboxPromise, type: 'skybox' });

      // 3D asset generation promise (if enabled)
      if (canGenerate3D) {
        console.log('🎯 Starting 3D asset generation in parallel with skybox...');
        setGenerating3DAsset(true);
        setAssetGenerationProgress({
          stage: 'extracting',
          progress: 0,
          message: 'Generating 3D asset for your environment...'
        });

        // Use coordinated prompt if available (ensures proper grounding), otherwise use intelligent parsing
        const assetPrompt = coordinatedPrompts?.asset_prompt 
          ? coordinatedPrompts.asset_prompt
          : (parsedPrompt && parsedPrompt.asset 
            ? parsedPrompt.asset 
            : prompt);
        
        console.log('🎯 Generating 3D asset with coordinated prompts:', {
          originalPrompt: prompt.substring(0, 50) + '...',
          assetPrompt: assetPrompt.substring(0, 80) + '...',
          usingCoordinated: !!coordinatedPrompts?.asset_prompt,
          usingParsed: !coordinatedPrompts?.asset_prompt && !!parsedPrompt?.asset,
          groundingMetadata: groundingMetadata,
          parsedBackground: parsedPrompt?.background?.substring(0, 30) || 'N/A',
          confidence: parsedPrompt?.confidence || 0
        });

        const assetPromise = assetGenerationService.generateAssetsFromPrompt({
          originalPrompt: assetPrompt,
          userId: user.uid,
          skyboxId: variations[0].toString(),
          quality: 'medium',
          style: 'realistic',
          maxAssets: 1 // Generate single asset for unified view
        }, (progressUpdate) => {
          setAssetGenerationProgress({
            stage: progressUpdate.stage || 'generating',
            progress: progressUpdate.progress || 0,
            message: progressUpdate.message || 'Processing...'
          });
        }).then((result) => {
          return { type: 'asset', data: result };
        }).catch((error) => {
          console.error('❌ 3D asset generation failed:', error);
          return { type: 'asset', data: null, error };
        });

        generationPromises.push({ promise: assetPromise, type: 'asset' });
      }

      // Execute both generations in parallel
      console.log('🚀 Executing parallel generation:', {
        skybox: true,
        asset: canGenerate3D,
        totalPromises: generationPromises.length
      });

      const results = await Promise.allSettled(generationPromises.map(p => p.promise));

      // Process results
      let variationResults = null;
      let assetResult = null;
      let assetError = null;

      results.forEach((result, index) => {
        const { type } = generationPromises[index];
        
        if (result.status === 'fulfilled') {
          const value = result.value;
          if (type === 'skybox') {
            variationResults = value.data;
          } else if (type === 'asset') {
            assetResult = value.data;
            assetError = value.error;
          }
        } else {
          console.error(`❌ ${type} generation failed:`, result.reason);
          if (type === 'skybox') {
            throw result.reason; // Skybox failure is critical
          } else if (type === 'asset') {
            assetError = result.reason;
          }
        }
      });

      // Set skybox results
      if (variationResults) {
        setGeneratedVariations(variationResults);
        setCurrentImageForDownload(variationResults[0]);
        setSkyboxProgress(100);
      }

      // CRITICAL: Save to Firestore skyboxes collection
      if (user?.uid && variationResults) {
        try {
          console.log(`💾 Starting to save ${variationResults.length} skybox variation(s) to Firestore for user ${user.uid}`);
          console.log(`   Collection: skyboxes`);
          console.log(`   User ID: ${user.uid}`);
          
          // Prepare variations array matching History component's expected structure
          const variationsArray = variationResults.map((variation, index) => ({
            image: variation.image,
            image_jpg: variation.image_jpg || variation.image,
            prompt: variation.prompt || prompt,
            title: variation.title || `${prompt} (Variation ${index + 1})`,
            generationId: variations[index].toString(),
            status: 'completed'
          }));
          
          // Create the skybox document with all variations
          const skyboxData = {
            userId: user.uid, // CRITICAL: Required for History query
            promptUsed: prompt,
            title: variationResults[0].title || prompt,
            imageUrl: variationResults[0].image, // Main image (first variation)
            style_id: selectedSkybox.id,
            negative_prompt: negativeText || '',
            status: 'completed',
            variations: variationsArray, // Array of all variations
            generationIds: variations.map(id => id.toString()), // Store all generation IDs
            createdAt: serverTimestamp(), // Always set createdAt for new documents
            updatedAt: serverTimestamp()
          };
          
          console.log(`📝 Skybox data to save:`, {
            userId: skyboxData.userId,
            title: skyboxData.title,
            imageUrl: skyboxData.imageUrl ? 'Present' : 'Missing',
            variationsCount: variationsArray.length,
            hasCreatedAt: true
          });
          
          // Use the first variation ID as the document ID
          const generationId = variations[0].toString();
          const skyboxRef = doc(db, 'skyboxes', generationId);
          
          console.log(`📤 Attempting to save to: skyboxes/${generationId}`);
          console.log(`   Firestore instance:`, db ? 'Available' : 'Missing');
          console.log(`   Collection path: skyboxes`);
          console.log(`   Document ID: ${generationId}`);
          
          // Check if document exists first
          const existingDoc = await getDoc(skyboxRef);
          const isNewDocument = !existingDoc.exists();
          
          console.log(`   Document exists: ${existingDoc.exists()}`);
          console.log(`   Is new document: ${isNewDocument}`);
          
          // Always set createdAt for new documents (merge won't overwrite if it exists)
          if (isNewDocument) {
            skyboxData.createdAt = serverTimestamp();
            console.log(`   ✅ Set createdAt for new document`);
          } else {
            // For existing documents, preserve createdAt but ensure it exists
            if (!existingDoc.data()?.createdAt) {
              skyboxData.createdAt = serverTimestamp();
              console.log(`   ✅ Set createdAt for existing document that was missing it`);
            }
          }
          
          // Save the document - use setDoc to create or update
          // This will CREATE the collection if it doesn't exist (Firestore auto-creates collections)
          try {
            await setDoc(skyboxRef, skyboxData, { merge: true });
            console.log(`   ✅ setDoc completed successfully`);
          } catch (setDocError) {
            console.error(`   ❌ setDoc failed:`, setDocError);
            console.error(`   Error code:`, setDocError?.code);
            console.error(`   Error message:`, setDocError?.message);
            throw setDocError; // Re-throw to be caught by outer catch
          }
          
          console.log(`✅ setDoc completed, verifying save...`);
          
          // Verify the save was successful
          const verifyDoc = await getDoc(skyboxRef);
          
          if (!verifyDoc.exists()) {
            throw new Error('Document does not exist after save attempt');
          }
          
          const verifyData = verifyDoc.data();
          
          if (verifyData?.userId === user.uid && verifyData?.createdAt) {
            console.log(`✅ Successfully saved skybox generation to Firestore`);
            console.log(`   - Collection: skyboxes`);
            console.log(`   - Document ID: ${generationId}`);
            console.log(`   - User ID: ${verifyData.userId}`);
            console.log(`   - Variations: ${variationsArray.length}`);
            console.log(`   - Created At: ${verifyData.createdAt ? 'Set' : 'Missing'}`);
            console.log(`   - Status: ${verifyData.status}`);
            console.log(`   - Image URL: ${verifyData.imageUrl ? 'Present' : 'Missing'}`);
            
            // Show success notification
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
            successMsg.innerHTML = `✅ Skybox saved to history! (ID: ${generationId})`;
            document.body.appendChild(successMsg);
            setTimeout(() => document.body.removeChild(successMsg), 3000);
          } else {
            console.error(`❌ Verification failed for skybox generation`);
            console.error(`   Document exists: ${verifyDoc.exists()}`);
            console.error(`   Expected userId: ${user.uid}, Got: ${verifyData?.userId}`);
            console.error(`   CreatedAt present: ${!!verifyData?.createdAt}`);
            console.error(`   Full document data:`, verifyData);
            
            // Show error notification
            const errorMsg = document.createElement('div');
            errorMsg.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
            errorMsg.innerHTML = `⚠️ Failed to verify save. Check console for details.`;
            document.body.appendChild(errorMsg);
            setTimeout(() => document.body.removeChild(errorMsg), 5000);
          }
          
          // Update subscription usage
          for (let i = 0; i < numVariations; i++) {
            await subscriptionService.incrementUsage(user.uid, 'skyboxGenerations');
          }
          await updateSubscriptionCount();
          console.log(`✅ Updated subscription usage: ${numVariations} In3D.Ai generations added`);
        } catch (error) {
          console.error('❌ CRITICAL ERROR: Failed to save skybox to Firestore:', error);
          console.error('   Error name:', error?.name);
          console.error('   Error code:', error?.code);
          console.error('   Error message:', error?.message);
          console.error('   Full error object:', error);
          
          // Show critical error notification
          const errorMsg = document.createElement('div');
          errorMsg.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
          errorMsg.innerHTML = `
            <div class="font-bold mb-2">❌ Failed to Save to History</div>
            <div class="text-sm">Error: ${error?.message || 'Unknown error'}</div>
            <div class="text-xs mt-2">Check console for details. Collection: skyboxes</div>
          `;
          document.body.appendChild(errorMsg);
          setTimeout(() => document.body.removeChild(errorMsg), 8000);
          
          // Don't fail the generation if Firestore save fails, but log it clearly
        }
      } else {
        console.warn('⚠️ Cannot save skybox: user.uid is missing');
        console.warn('   User object:', user);
      }

      setProgress(100);
      setSkyboxProgress(100);
      
      // Process 3D asset result (if generated)
      if (canGenerate3D) {
        if (assetResult && assetResult.success && assetResult.assets.length > 0) {
          const asset = assetResult.assets[0];
          
          // Ensure we have a download URL - extract from model_urls if needed
          let assetUrl = asset.downloadUrl || asset.previewUrl;
          
          // If no URL, try to extract from metadata.model_urls (if available)
          if (!assetUrl && asset.metadata?.model_urls) {
            assetUrl = asset.metadata.model_urls.glb || 
                       asset.metadata.model_urls.fbx || 
                       asset.metadata.model_urls.obj ||
                       asset.metadata.model_urls.usdz;
            console.log('📦 Extracted URL from model_urls:', assetUrl);
          }
          
          // Update asset with the URL if we found one
          if (assetUrl && !asset.downloadUrl) {
            asset.downloadUrl = assetUrl;
          }
          
          // Store grounding metadata with the asset for 3D viewer integration
          if (groundingMetadata) {
            asset.groundingMetadata = groundingMetadata;
            console.log('📐 Grounding metadata attached to asset:', groundingMetadata);
          }
          
          setGenerated3DAsset(asset);
          setGlobalGenerated3DAsset(asset); // Save to context
          // Ensure skybox background is set when both complete
          if (variationResults && variationResults.length > 0 && setBackgroundSkybox) {
            setBackgroundSkybox(variationResults[0]);
          }
          // Automatically show viewer when both complete
          setShow3DAssetViewer(true);
          console.log('✅ 3D asset generated successfully:', asset);
          console.log('📦 Asset downloadUrl:', asset.downloadUrl);
          console.log('📦 Asset previewUrl:', asset.previewUrl);
          console.log('📦 Asset format:', asset.format);
          console.log('📦 Asset status:', asset.status);
          console.log('📦 Asset metadata:', asset.metadata);
          console.log('📦 Skybox background:', variationResults?.[0]?.image);
          
          if (!asset.downloadUrl && !asset.previewUrl) {
            console.warn('⚠️ 3D asset generated but no URL available. Asset:', asset);
          }

          // CRITICAL: Save Meshy 3D asset to the same skybox document in Firestore
          if (user?.uid && variations.length > 0) {
            try {
              const generationId = variations[0].toString();
              const skyboxRef = doc(db, 'skyboxes', generationId);
              
              console.log(`💾 Starting to save Meshy 3D asset to skybox document: ${generationId}`);
              
              // Prepare Meshy asset data to be stored with skybox
              const meshyAssetData = {
                meshUrl: assetUrl || asset.downloadUrl || asset.previewUrl,
                meshResult: {
                  status: asset.status || 'completed',
                  downloadUrl: asset.downloadUrl,
                  previewUrl: asset.previewUrl,
                  format: asset.format,
                  size: asset.size,
                  model_urls: asset.metadata?.model_urls || null
                },
                meshyAsset: {
                  id: asset.id,
                  prompt: asset.prompt,
                  downloadUrl: asset.downloadUrl,
                  previewUrl: asset.previewUrl,
                  format: asset.format,
                  status: asset.status,
                  size: asset.size,
                  metadata: asset.metadata,
                  groundingMetadata: asset.groundingMetadata
                },
                updatedAt: serverTimestamp()
              };
              
              // Update the skybox document with Meshy asset data
              await setDoc(skyboxRef, meshyAssetData, { merge: true });
              
              console.log(`✅ Successfully saved Meshy 3D asset to skybox document: ${generationId}`);
              console.log(`   - Mesh URL: ${meshyAssetData.meshUrl ? 'Present' : 'Missing'}`);
              console.log(`   - Mesh Status: ${meshyAssetData.meshResult.status}`);
              console.log(`   - Format: ${meshyAssetData.meshResult.format || 'N/A'}`);
              
              // Verify the save
              const verifyDoc = await getDoc(skyboxRef);
              if (verifyDoc.exists() && verifyDoc.data()?.meshUrl) {
                console.log(`✅ Verified: Meshy asset is now synced with skybox in Firestore`);
              } else {
                console.warn(`⚠️ Verification: Meshy asset data may not be present in document`);
              }
            } catch (error) {
              console.error('❌ Failed to save Meshy 3D asset to skybox document:', error);
              console.error('   Error name:', error?.name);
              console.error('   Error code:', error?.code);
              console.error('   Error message:', error?.message);
              // Don't fail the generation if Firestore save fails, but log it clearly
            }
          } else {
            console.warn('⚠️ Cannot save Meshy asset: user.uid or variations missing');
            console.warn('   User:', user?.uid ? 'Present' : 'Missing');
            console.warn('   Variations:', variations.length);
          }
        } else {
          console.warn('⚠️ 3D asset generation completed but no assets returned');
          console.warn('📦 Result:', assetResult);
          console.warn('📦 Error:', assetError);
          
          // Show warning but don't fail - skybox was generated successfully
          if (isDevMode || assetError) {
            const warningMsg = document.createElement('div');
            warningMsg.className = 'fixed top-4 right-4 bg-amber-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
            warningMsg.innerHTML = `
              <div class="font-bold mb-2">⚠️ 3D Asset Generation Failed</div>
              <div class="text-sm">${assetResult?.error || assetError?.message || 'No assets were generated. Skybox is still available.'}</div>
              ${assetResult?.errors && assetResult.errors.length > 0 ? `<div class="text-xs mt-2">Errors: ${assetResult.errors.join(', ')}</div>` : ''}
            `;
            document.body.appendChild(warningMsg);
            setTimeout(() => document.body.removeChild(warningMsg), 8000);
          }
        }
      } else {
        const reasons = [];
        if (!storageAvailable) reasons.push('Storage not available');
        if (!assetGenerationService.isMeshyConfigured()) reasons.push('Meshy API not configured');
        if (!user?.uid) reasons.push('User not authenticated');
        
        console.warn('⚠️ 3D asset generation skipped (skybox still generated):', reasons.join(', '));
        
        // Only show notification if it's a configuration issue (not just missing objects)
        if (isDevMode || (!storageAvailable || !assetGenerationService.isMeshyConfigured())) {
          const warningMsg = document.createElement('div');
          warningMsg.className = 'fixed top-4 right-4 bg-amber-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
          warningMsg.innerHTML = `
            <div class="font-bold mb-2">⚠️ Skybox Generated</div>
            <div class="text-sm">3D asset generation skipped: ${reasons.join(', ')}</div>
            <div class="text-xs mt-2">Your skybox environment is ready to use.</div>
          `;
          document.body.appendChild(warningMsg);
          setTimeout(() => document.body.removeChild(warningMsg), 5000);
        }
      }

      // Both generations complete
      setGenerating(false);
      setGenerating3DAsset(false);
      setAssetGenerationProgress(null);
      
      // Reset generation state when both are complete
      setTimeout(() => {
        // Small delay to show completion state
        resetGeneration();
      }, 2000);
      hideLoading();
      
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
      setGenerating(false);
      setProgress(0);
      setSkyboxProgress(0);
      hideLoading(); // Hide loading indicator on error
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
    // Search in availableStyles (filtered for trial users) first, then skyboxStyles
    const style = availableStyles.find(
      (style) => style.id === parseInt(e.target.value)
    ) || skyboxStyles.find(
      (style) => style.id === parseInt(e.target.value)
    );
    setSelectedSkybox(style);
    // Save to context if generation is active
    if (isGenerating || isGenerating3DAsset) {
      setGlobalSelectedSkybox(style);
    }
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

  // -------------------------
  // Background Loading Indicator Integration
  // -------------------------
  // Note: We're using OnboardCard as background loading indicator instead of BackgroundLoadingIndicator
  // So we don't call showLoading() here - the OnboardCard handles the visual feedback

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
  
  // Determine if we should show the dotted surface background
  // Show during: empty state OR during loading
  const showDottedSurface = 
    (generatedVariations.length === 0 && !generated3DAsset) ||
    isGenerating || 
    isGenerating3DAsset;
  
  // Check if loading is active
  const isLoadingActive = isGenerating || isGenerating3DAsset;
  
  return (
    <div className="absolute inset-0 min-h-screen">
      {/* Dotted Surface Background - Show when nothing is generated OR during loading */}
      {showDottedSurface && (
        <div className="fixed inset-0 z-[2]">
          <DottedSurface 
            className="size-full" 
            isLoading={isLoadingActive}
            variant="aurora"
            interactionStrength={isLoadingActive ? 0.3 : 0.8}
          />
        </div>
      )}
      
      {/* OnboardCard - Background Loading Indicator (behind panel) */}
      {(isGenerating || isGenerating3DAsset) && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
          {/* OnboardCard Component - Background layer - Uses global context automatically */}
          <div className="w-full max-w-[520px] px-4 scale-90 -translate-y-16">
            <OnboardCard
              duration={3000}
              step1="Skybox Generation"
              step2={assetGenerationProgress?.message || "3D Model Generation"}
              step3="Assets Merging"
              // Context will handle visibility and progress automatically
            />
          </div>
        </div>
      )}
      
      {/* Bottom Dock Control Panel */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-end justify-center transition-all duration-400 z-20 ${
          isMinimized ? 'pb-3' : (isGenerating || isGenerating3DAsset) ? 'pb-2' : 'pb-4'
        }`}
      >
        <div
          className={`w-full mx-auto px-4 transition-all ${
            isMinimized ? 'max-w-2xl' : 'max-w-[1310px]'
          }`}
        >
          <div
            className={`
              relative z-[999]
              bg-[#0a0a0a]/45
              backdrop-blur-0
              border border-[#ffffff08]
              rounded-xl 
              shadow-[0_-10px_40px_rgba(0,0,0,0.65)] 
              overflow-hidden 
              transition-all 
               ${isMinimized ? 'py-0.5 px-2' : 'py-1 px-3'}
               ${(isGenerating || isGenerating3DAsset) && !isMinimized ? 'max-h-[40vh] overflow-y-auto' : ''}
            `}
          >
            {/* Top Bar / Header */}
            <div className="flex items-center justify-between mb-1">
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
              <div className={`${(isGenerating || isGenerating3DAsset) ? 'space-y-1' : 'space-y-1.5'}`}>
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

                {/* PROGRESS BARS (when generating) */}
                {(isGenerating || isGenerating3DAsset) && (
                  <div className="space-y-2">
                    {/* Skybox Progress Bar */}
                    {isGenerating && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-300 font-medium">
                            Skybox Generation
                          </span>
                          <span className="text-sky-400 font-semibold">
                            {Math.round(skyboxProgress)}%
                          </span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-[#1f1f1f] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${skyboxProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* 3D Asset Progress Bar */}
                    {isGenerating3DAsset && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-300 font-medium">
                            3D Asset Generation
                          </span>
                          <span className="text-purple-400 font-semibold">
                            {assetGenerationProgress ? Math.round(assetGenerationProgress.progress) : 0}%
                          </span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-[#1f1f1f] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-400 transition-all duration-300"
                            style={{ width: `${assetGenerationProgress?.progress || 0}%` }}
                          />
                        </div>
                        {assetGenerationProgress?.message && (
                          <div className="text-[9px] text-gray-400">
                            {assetGenerationProgress.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Grid (Editor style) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* Column 1: Prompt */}
                  <div className="md:col-span-2 space-y-1.5">
                    <div className={`border border-[#262626] bg-[#121212] rounded-md px-2 py-1 space-y-0.5 ${
                      (isGenerating || isGenerating3DAsset) ? 'ring-1 ring-sky-500/30' : ''
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] tracking-[0.16em] text-gray-500 uppercase flex items-center gap-1.5">
                          Prompt
                          {(isGenerating || isGenerating3DAsset) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" title="Currently generating with this prompt" />
                          )}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {prompt.length}/600
                        </span>
                      </div>
                      <textarea
                        id="prompt"
                        maxLength={600}
                        rows={2}
                        placeholder="Describe the environment: lighting, mood, props, architecture..."
                        className={`w-full text-xs rounded-md bg-[#151515] border border-[#303030] px-2.5 py-1.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60 resize-none ${
                          isGenerating || isGenerating3DAsset 
                            ? 'opacity-90 cursor-default' 
                            : ''
                        }`}
                        value={prompt}
                        onChange={(e) => {
                          setPrompt(e.target.value);
                          // Save to context if generation is active
                          if (isGenerating || isGenerating3DAsset) {
                            setGlobalPrompt(e.target.value);
                          }
                        }}
                        readOnly={isGenerating || isGenerating3DAsset}
                      />
                      
                      {/* Intelligent Prompt Parsing Indicator */}
                      {parsedPrompt && parsedPrompt.confidence > 0.3 && (
                        <div className="flex items-center flex-wrap gap-1.5 text-[9px] pt-0.5">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                            <span className="font-medium">Parsing ({(parsedPrompt.confidence * 100).toFixed(0)}%)</span>
                          </div>
                          {parsedPrompt.asset && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/90">
                              <span className="font-medium">Asset:</span>
                              <span className="truncate max-w-[120px]">{parsedPrompt.asset}</span>
                            </div>
                          )}
                          {parsedPrompt.background && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300/90">
                              <span className="font-medium">Skybox:</span>
                              <span className="truncate max-w-[100px]">{parsedPrompt.background}</span>
                              {selectedSkybox && (
                                <span className="ml-1 px-1 rounded bg-purple-600/20 text-purple-200/80 text-[8px] font-medium" title={`Style: ${selectedSkybox.name}`}>
                                  {selectedSkybox.name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 3D Asset Detection - Simple indicator */}
                      {has3DObjects && !isTrialUser && assetGenerationService?.isMeshyConfigured() && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px]">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{assetGenerationService.previewExtraction(prompt).count} 3D object{assetGenerationService.previewExtraction(prompt).count !== 1 ? 's' : ''} detected</span>
                        </div>
                      )}
                      
                      {/* 3D Asset Generation Available Indicator */}
                      {!has3DObjects && 
                       prompt.trim().length > 0 && 
                       assetGenerationService?.isMeshyConfigured() && 
                       storageAvailable && 
                       !isTrialUser && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px]">
                          <span className="w-1 h-1 rounded-full bg-blue-400" />
                          <span>3D asset generation available</span>
                        </div>
                      )}
                    </div>

                    {/* Advanced Prompt Controls - Hidden for trial users */}
                    {!isTrialUser && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-1">
                          <label
                            htmlFor="variations"
                            className="block text-[10px] tracking-[0.16em] text-gray-500 uppercase mb-0.5"
                          >
                            Variations
                          </label>
                          <input
                            type="number"
                            id="variations"
                            min="1"
                            max="10"
                            placeholder="1–10"
                            className={`w-full text-xs rounded-md bg-[#151515] border border-[#303030] px-2.5 py-1.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60 ${
                              isGenerating || isGenerating3DAsset 
                                ? 'opacity-90 cursor-default' 
                                : ''
                            }`}
                            value={numVariations}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              const newValue = Math.min(10, Math.max(1, value));
                              setNumVariations(newValue);
                              // Save to context if generation is active
                              if (isGenerating || isGenerating3DAsset) {
                                setGlobalNumVariations(newValue);
                              }
                            }}
                            readOnly={isGenerating || isGenerating3DAsset}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor="negativeText"
                            className="block text-[10px] tracking-[0.16em] text-gray-500 uppercase mb-0.5"
                          >
                            Negative Prompt
                          </label>
                          <input
                            type="text"
                            id="negativeText"
                            placeholder="Elements to avoid: low-res, blurry, washed out..."
                            className={`w-full text-xs rounded-md bg-[#151515] border border-[#303030] px-2.5 py-1.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60 ${
                              isGenerating || isGenerating3DAsset 
                                ? 'opacity-90 cursor-default' 
                                : ''
                            }`}
                            value={negativeText}
                            onChange={(e) => {
                              setNegativeText(e.target.value);
                              // Save to context if generation is active
                              if (isGenerating || isGenerating3DAsset) {
                                setGlobalNegativeText(e.target.value);
                              }
                            }}
                            readOnly={isGenerating || isGenerating3DAsset}
                          />
                        </div>
                      </div>
                    )}

                    {/* 3D Asset Viewer Button - Show when 3D asset is available (persistent during generation) */}
                    {generated3DAsset && 
                     (generated3DAsset.status === 'completed' || generated3DAsset.status === 'processing') && 
                     (generated3DAsset.downloadUrl || generated3DAsset.previewUrl) &&
                     generatedVariations.length > 0 && (
                      <div className="mt-1">
                        <button
                          onClick={() => {
                            setShow3DAssetViewer(true);
                            // Ensure skybox background is set when opening viewer
                            if (setBackgroundSkybox && generatedVariations.length > 0) {
                              setBackgroundSkybox(generatedVariations[currentVariationIndex] || generatedVariations[0]);
                            }
                          }}
                          className={`w-full py-1.5 rounded-md text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white transition-all ${
                            (isGenerating || isGenerating3DAsset) && generated3DAsset.status === 'processing'
                              ? 'opacity-90' 
                              : ''
                          }`}
                          disabled={generated3DAsset.status === 'processing' && !generated3DAsset.downloadUrl && !generated3DAsset.previewUrl}
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
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          <span>3D Asset Viewer</span>
                        </button>
                      </div>
                    )}

                    {/* Trial user info badge */}
                    {isTrialUser && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
                        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[11px] text-amber-300">
                          Trial: 1 variation, {TRIAL_ALLOWED_STYLES.length} styles available. <button onClick={handleUpgrade} className="underline hover:text-amber-200">Upgrade</button> for full access.
                        </span>
                      </div>
                    )}

                    {/* Storage warnings - only show to non-trial users or in dev mode */}
                    {!storageAvailable && (!isTrialUser || isDevMode) && (
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
                          {isDevMode && (
                            <button
                              onClick={runDiagnostics}
                              className="px-3 py-1.5 rounded-md bg-purple-600/80 hover:bg-purple-500 text-[11px] font-semibold text-white tracking-[0.12em] uppercase"
                            >
                              Diagnostics
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Debug / Meshy Test - ONLY visible with ?dev=true */}
                    {isDevMode && (
                      <div className="border border-[#343434] bg-[#151515] rounded-md px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] tracking-[0.16em] text-gray-500 uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            Dev Mode
                          </span>
                          <button
                            onClick={() => setShowTestPanel(!showTestPanel)}
                            className="px-3 py-1.5 rounded-md bg-[#262626] hover:bg-[#2f2f2f] text-[11px] text-gray-200 uppercase tracking-[0.12em]"
                          >
                            {showTestPanel ? 'Hide Panel' : 'Show Panel'}
                          </button>
                        </div>
                        {/* Single unified Generate button – triggers skybox + Meshy 3D (when available) */}
                        <button
                          onClick={() => {
                            console.log('🔧 Manual Debug Test');
                            console.log('Prompt:', prompt);
                            console.log('Has 3D Objects State:', has3DObjects);
                            console.log('Meshy Configured:', assetGenerationService.isMeshyConfigured());
                            console.log('Preview Extraction:', assetGenerationService.previewExtraction(prompt));
                            console.log('Should Show Button:', has3DObjects && assetGenerationService.isMeshyConfigured());
                            console.log('Is Trial User:', isTrialUser);
                            console.log('Available Styles:', availableStyles);
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
                    <div className="space-y-1.5">
                      {/* Style selector */}
                     <div className={`border border-[#262626] bg-[#121212] rounded-md px-2 py-1.5 space-y-1 ${
                      (isGenerating || isGenerating3DAsset) ? 'ring-1 ring-emerald-500/30' : ''
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] tracking-[0.16em] text-gray-500 uppercase flex items-center gap-1.5">
                          In3D.Ai Style
                          {(isGenerating || isGenerating3DAsset) && selectedSkybox && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Currently generating with this style" />
                          )}
                        </span>
                        {selectedSkybox && (
                          <span className="text-[9px] text-gray-400">
                            {selectedSkybox.name}
                          </span>
                        )}
                      </div>

                       {/* Active style preview above style list – mimic Skybox panel */}
                       {selectedSkybox && (
                         <div className="rounded-md overflow-hidden border border-[#363636] bg-[#101010]">
                           <div className="relative">
                             {selectedSkybox.image_jpg && (
                               <img
                                 src={selectedSkybox.image_jpg}
                                 alt={selectedSkybox.name}
                                 className="w-full h-16 object-cover"
                               />
                             )}
                             <div className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1">
                               <p className="text-[10px] font-medium text-gray-100 truncate">
                                 {selectedSkybox.name}
                               </p>
                             </div>
                           </div>
                         </div>
                       )}

                      {stylesLoading ? (
                        <div className="text-[10px] text-gray-500 py-0.5">Loading styles…</div>
                      ) : stylesError ? (
                        <div className="text-[10px] text-red-400 py-0.5">{stylesError}</div>
                      ) : (
                        <div className="relative">
                          <select
                            value={selectedSkybox?.id ?? ''}
                            onChange={handleSkyboxStyleChange}
                            className={`w-full appearance-none rounded-md border border-emerald-500/70 bg-[#151515] px-2.5 py-1.5 pr-7 text-xs text-gray-100 shadow-[0_0_0_1px_rgba(16,185,129,0.4)] focus:outline-none focus:ring-2 focus:ring-emerald-500/80 focus:border-emerald-500/80 ${
                              isGenerating || isGenerating3DAsset 
                                ? 'opacity-90 cursor-default' 
                                : ''
                            }`}
                            disabled={isGenerating || isGenerating3DAsset}
                          >
                            <option value="" disabled>
                              Select a style
                            </option>
                            {/* Use availableStyles which is filtered for trial users */}
                            {availableStyles.map((style) => (
                              <option key={style.id} value={style.id}>
                                {style.name}
                                {style.model ? ` · ${style.model}` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                            <svg
                              className="h-2.5 w-2.5 text-gray-300"
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
                          {/* Trial style count indicator */}
                          {isTrialUser && (
                            <p className="text-[9px] text-gray-500 mt-0.5">
                              {availableStyles.length} styles available in trial
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Generation / Download buttons */}
                    <div className="border border-[#262626] bg-[#121212] rounded-md px-2 py-1.5 space-y-1">
                      <div className="space-y-1">
                        <button
                          className={`
                            w-full py-1.5 rounded-md text-xs font-semibold uppercase tracking-[0.16em]
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
                          disabled={isGenerating || isGenerating3DAsset}
                        >
                          {isGenerating || isGenerating3DAsset ? (
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
                              <span>{isGenerating ? 'Generating Environment...' : 'Generating 3D Asset...'}</span>
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
                              <span>Generate Environment & 3D Asset</span>
                            </>
                          )}
                        </button>

                        <button
                          className={`
                            w-full py-1.5 rounded-md text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2
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

                        {/* Regenerate 3D Asset Button - Only show if skybox exists but 3D asset failed/missing */}
                        {generatedVariations.length > 0 && 
                         !generated3DAsset && 
                         !isGenerating3DAsset && 
                         !isGenerating &&
                         assetGenerationService.isMeshyConfigured() && 
                         storageAvailable && 
                         user?.uid && (
                          <button
                            data-regenerate-3d
                            className={`
                              w-full py-1.5 rounded-md text-xs font-semibold uppercase tracking-[0.16em] flex items-center justify-center gap-2
                              bg-gradient-to-r from-emerald-500/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 text-white
                            `}
                            onClick={async () => {
                              if (!user?.uid || !storageAvailable || !assetGenerationService.isMeshyConfigured()) {
                                setError('3D asset generation is not available. Please check your configuration.');
                                return;
                              }

                              try {
                                setGenerating3DAsset(true);
                                setAssetGenerationProgress({
                                  stage: 'extracting',
                                  progress: 0,
                                  message: 'Analyzing prompt for 3D objects...'
                                });

                                // Get the skybox ID if available (optional - can generate without skybox)
                                const skyboxId = generatedVariations.length > 0 
                                  ? (generatedVariations[currentVariationIndex]?.generationId || 
                                     generatedVariations[0]?.generationId ||
                                     generatedVariations[currentVariationIndex]?.id?.toString() ||
                                     generatedVariations[0]?.id?.toString() ||
                                     null)
                                  : null;

                                // Use coordinated prompt if available (ensures proper grounding), otherwise use intelligent parsing
                                const assetPrompt = coordinatedPrompts?.asset_prompt 
                                  ? coordinatedPrompts.asset_prompt
                                  : (parsedPrompt && parsedPrompt.asset 
                                    ? parsedPrompt.asset 
                                    : prompt);

                                console.log('🚀 Starting manual 3D asset generation...', {
                                  originalPrompt: prompt.substring(0, 50) + '...',
                                  assetPrompt: assetPrompt.substring(0, 80) + '...',
                                  usingCoordinated: !!coordinatedPrompts?.asset_prompt,
                                  usingParsed: !coordinatedPrompts?.asset_prompt && !!parsedPrompt?.asset,
                                  groundingMetadata: groundingMetadata,
                                  parsedBackground: parsedPrompt?.background?.substring(0, 30) || 'N/A',
                                  confidence: parsedPrompt?.confidence || 0,
                                  userId: user.uid,
                                  skyboxId,
                                  storageAvailable,
                                  meshyConfigured: assetGenerationService.isMeshyConfigured()
                                });

                                const result = await assetGenerationService.generateAssetsFromPrompt({
                                  originalPrompt: assetPrompt,
                                  userId: user.uid,
                                  skyboxId: skyboxId,
                                  quality: 'medium',
                                  style: 'realistic',
                                  maxAssets: 1
                                }, (progressUpdate) => {
                                  setAssetGenerationProgress({
                                    stage: progressUpdate.stage || 'generating',
                                    progress: progressUpdate.progress || 0,
                                    message: progressUpdate.message || 'Processing...'
                                  });
                                  console.log('📊 Generation progress:', progressUpdate);
                                });

                                console.log('📦 Generation result:', {
                                  success: result.success,
                                  assetsCount: result.assets?.length || 0,
                                  error: result.error,
                                  errors: result.errors,
                                  extractedObjects: result.extractedObjects?.length || 0
                                });

                                if (result.success && result.assets && result.assets.length > 0) {
                                  const asset = result.assets[0];
                                  // Store grounding metadata with the asset for 3D viewer integration
                                  if (groundingMetadata) {
                                    asset.groundingMetadata = groundingMetadata;
                                    console.log('📐 Grounding metadata attached to asset:', groundingMetadata);
                                  }
                                  setGenerated3DAsset(asset);
                                  setGlobalGenerated3DAsset(asset); // Save to context
                                  // Set skybox background when 3D asset completes
                                  if (generatedVariations.length > 0 && setBackgroundSkybox) {
                                    setBackgroundSkybox(generatedVariations[currentVariationIndex] || generatedVariations[0]);
                                  }
                                  // Automatically show viewer when 3D asset completes
                                  setShow3DAssetViewer(true);
                                  console.log('✅ 3D asset generated successfully:', asset);
                                  
                                  // Show success notification
                                  const successMsg = document.createElement('div');
                                  successMsg.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
                                  successMsg.innerHTML = `
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                    </svg>
                                    <span>3D asset generated successfully!</span>
                                  `;
                                  document.body.appendChild(successMsg);
                                  setTimeout(() => document.body.removeChild(successMsg), 5000);
                                } else {
                                  // Build detailed error message
                                  const errorMessages = [];
                                  if (result.error) errorMessages.push(result.error);
                                  if (result.errors && result.errors.length > 0) {
                                    errorMessages.push(...result.errors);
                                  }
                                  if (result.extractedObjects && result.extractedObjects.length === 0) {
                                    errorMessages.push('No 3D objects detected in prompt');
                                  }
                                  if (!result.assets || result.assets.length === 0) {
                                    errorMessages.push('No assets were generated');
                                  }
                                  
                                  const errorMessage = errorMessages.length > 0 
                                    ? errorMessages.join('. ') 
                                    : 'Failed to generate 3D asset. Check console for details.';
                                  
                                  console.error('❌ 3D asset generation failed:', {
                                    result,
                                    errorMessage,
                                    extractedObjects: result.extractedObjects,
                                    assets: result.assets
                                  });
                                  
                                  setError(errorMessage);
                                  
                                  // Show error notification
                                  const errorMsg = document.createElement('div');
                                  errorMsg.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
                                  errorMsg.innerHTML = `
                                    <div class="font-bold mb-2">❌ 3D Asset Generation Failed</div>
                                    <div class="text-sm">${errorMessage}</div>
                                    <div class="text-xs mt-2 text-red-200">Check browser console for detailed logs</div>
                                  `;
                                  document.body.appendChild(errorMsg);
                                  setTimeout(() => document.body.removeChild(errorMsg), 8000);
                                }
                              } catch (error) {
                                console.error('❌ Exception during 3D asset generation:', error);
                                console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                                
                                const errorMessage = error instanceof Error 
                                  ? error.message 
                                  : 'Failed to generate 3D asset. Unknown error occurred.';
                                
                                setError(errorMessage);
                                
                                // Show error notification
                                const errorMsg = document.createElement('div');
                                errorMsg.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md';
                                errorMsg.innerHTML = `
                                  <div class="font-bold mb-2">❌ 3D Asset Generation Error</div>
                                  <div class="text-sm">${errorMessage}</div>
                                  <div class="text-xs mt-2 text-red-200">Check browser console for details</div>
                                `;
                                document.body.appendChild(errorMsg);
                                setTimeout(() => document.body.removeChild(errorMsg), 8000);
                              } finally {
                                setGenerating3DAsset(false);
                                setAssetGenerationProgress(null);
                                // Don't hide loading here if skybox is still generating
                                if (!isGenerating) {
                                  hideLoading();
                                }
                              }
                            }}
                            disabled={isGenerating3DAsset}
                          >
                            {isGenerating3DAsset ? (
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
                                <span>Generating 3D Asset...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  {generated3DAsset ? (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.8}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  ) : (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.8}
                                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                  )}
                                </svg>
                                <span>Generate 3D Asset Only</span>
                              </>
                            )}
                          </button>
                        )}
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
                          {/* Debug button only visible in dev mode */}
                          {isDevMode && (
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
                          )}
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

      {/* Storage Status & Diagnostic overlays - ONLY in dev mode */}
      {isDevMode && (
        <>
          <StorageStatusIndicator />
          <ConfigurationDiagnostic />
        </>
      )}

      {/* 3D Asset Viewer with Skybox Background - Merged Create & 3D Asset Section */}
      {/* Show when 3D asset is completed or when viewer button is clicked */}
      {show3DAssetViewer && 
       generated3DAsset && 
       generated3DAsset.status === 'completed' && 
       (generated3DAsset.downloadUrl || generated3DAsset.previewUrl) &&
       generatedVariations.length > 0 && 
       !isGenerating3DAsset && (
        <>
          {/* Debug info in dev mode */}
          {isDevMode && (
            <div className="fixed top-20 left-4 bg-black/80 text-white p-3 rounded-lg text-xs z-[10000] max-w-xs">
              <div className="font-bold mb-2">3D Asset Debug Info:</div>
              <div>Status: {generated3DAsset.status || 'undefined'}</div>
              <div>Has downloadUrl: {generated3DAsset.downloadUrl ? 'Yes' : 'No'}</div>
              <div>Has previewUrl: {generated3DAsset.previewUrl ? 'Yes' : 'No'}</div>
              <div>Format: {generated3DAsset.format || 'undefined'}</div>
              <div>Skybox variations: {generatedVariations.length}</div>
              <div className="mt-2 text-yellow-400">
                {generated3DAsset.status !== 'completed' && '⚠️ Status not completed'}
                {!generated3DAsset.downloadUrl && !generated3DAsset.previewUrl && '⚠️ No URL available'}
              </div>
            </div>
          )}
          
          {/* Show viewer when asset is completed and has URL */}
          {generated3DAsset.status === 'completed' && 
           (generated3DAsset.downloadUrl || generated3DAsset.previewUrl) && (
            <div className="fixed inset-0 w-full h-full z-[9999]">
              {/* Control buttons overlay */}
              <div className="absolute top-4 right-4 z-[10000] flex gap-2">
                
                <button
                  onClick={() => setShow3DAssetViewer(false)}
                  className="px-4 py-2 bg-black/80 hover:bg-black/90 text-white rounded-lg text-sm font-semibold border border-white/20 flex items-center gap-2"
                  title="Close 3D asset viewer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>
                <button
                  onClick={async () => {
                    setShow3DAssetViewer(false);
                    setGenerated3DAsset(null);
                    setGlobalGenerated3DAsset(null); // Clear from context
                    // Wait a moment for state to update, then trigger generation
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    if (!user?.uid || !storageAvailable || !assetGenerationService.isMeshyConfigured()) {
                      setError('3D asset generation is not available. Please check your configuration.');
                      return;
                    }

                    try {
                      setGenerating3DAsset(true);
                      setAssetGenerationProgress({
                        stage: 'extracting',
                        progress: 0,
                        message: 'Analyzing prompt for 3D objects...'
                      });

                      const skyboxId = generatedVariations.length > 0 
                        ? (generatedVariations[currentVariationIndex]?.generationId || 
                           generatedVariations[0]?.generationId ||
                           generatedVariations[currentVariationIndex]?.id?.toString() ||
                           generatedVariations[0]?.id?.toString() ||
                           null)
                        : null;

                      // Use coordinated prompt if available (ensures proper grounding), otherwise use intelligent parsing
                      const assetPrompt = coordinatedPrompts?.asset_prompt 
                        ? coordinatedPrompts.asset_prompt
                        : (parsedPrompt && parsedPrompt.asset 
                          ? parsedPrompt.asset 
                          : prompt);

                      const result = await assetGenerationService.generateAssetsFromPrompt({
                        originalPrompt: assetPrompt,
                        userId: user.uid,
                        skyboxId: skyboxId,
                        quality: 'medium',
                        style: 'realistic',
                        maxAssets: 1
                      }, (progressUpdate) => {
                        setAssetGenerationProgress({
                          stage: progressUpdate.stage || 'generating',
                          progress: progressUpdate.progress || 0,
                          message: progressUpdate.message || 'Processing...'
                        });
                      });

                      if (result.success && result.assets && result.assets.length > 0) {
                        const asset = result.assets[0];
                        // Store grounding metadata with the asset for 3D viewer integration
                        if (groundingMetadata) {
                          asset.groundingMetadata = groundingMetadata;
                          console.log('📐 Grounding metadata attached to asset:', groundingMetadata);
                        }
                        setGenerated3DAsset(asset);
                        setGlobalGenerated3DAsset(asset); // Save to context
                        // Set skybox background when 3D asset completes
                        if (generatedVariations.length > 0 && setBackgroundSkybox) {
                          setBackgroundSkybox(generatedVariations[currentVariationIndex] || generatedVariations[0]);
                        }
                        // Automatically show viewer when 3D asset completes
                        setShow3DAssetViewer(true);
                      } else {
                        setError(result.error || 'Failed to generate 3D asset');
                      }
                    } catch (error) {
                      console.error('❌ Regeneration error:', error);
                      setError(error instanceof Error ? error.message : 'Failed to regenerate 3D asset');
                    } finally {
                      setGenerating3DAsset(false);
                      setAssetGenerationProgress(null);
                      // Don't hide loading here if skybox is still generating
                      if (!isGenerating) {
                        hideLoading();
                      }
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
                  title="Generate a new 3D asset"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
              </div>
              <AssetViewerWithSkybox
                assetUrl={(() => {
                  // Get asset URL with fallback to model_urls
                  let url = generated3DAsset.downloadUrl || generated3DAsset.previewUrl;
                  
                  // If no URL, try to extract from metadata.model_urls
                  if (!url && generated3DAsset.metadata?.model_urls) {
                    url = generated3DAsset.metadata.model_urls.glb || 
                          generated3DAsset.metadata.model_urls.fbx || 
                          generated3DAsset.metadata.model_urls.obj ||
                          generated3DAsset.metadata.model_urls.usdz;
                    console.log('📦 Using URL from metadata.model_urls:', url);
                  }
                  
                  return url || '';
                })()}
                skyboxImageUrl={generatedVariations.length > 0 
                  ? (generatedVariations[currentVariationIndex]?.image || generatedVariations[0]?.image)
                  : undefined}
                assetFormat={generated3DAsset.format || 'glb'}
                className="w-full h-full"
                autoRotate={false}
                onLoad={(model) => {
                  console.log('✅ 3D asset loaded in Create section:', model);
                  const assetUrl = generated3DAsset.downloadUrl || generated3DAsset.previewUrl || 
                                   generated3DAsset.metadata?.model_urls?.glb;
                  console.log('📦 Asset URL:', assetUrl);
                  console.log('📦 Skybox URL:', generatedVariations[currentVariationIndex]?.image || generatedVariations[0]?.image);
                }}
                onError={(error) => {
                  console.error('❌ 3D asset loading error:', error);
                  console.error('📦 Asset data:', generated3DAsset);
                  const assetUrl = generated3DAsset.downloadUrl || generated3DAsset.previewUrl || 
                                   generated3DAsset.metadata?.model_urls?.glb;
                  console.error('📦 Asset URL:', assetUrl);
                  console.error('📦 Available model_urls:', generated3DAsset.metadata?.model_urls);
                }}
              />
            </div>
          )}
          
          {/* Show loading state when asset is generating */}
          {isGenerating3DAsset && (
            <div className="fixed inset-0 w-full h-full z-[9998] bg-black/50 flex items-center justify-center">
              <div className="bg-[#0a0a0a] border border-[#ffffff08] rounded-xl p-6 max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <div>
                    <div className="text-white font-semibold">Generating 3D Asset</div>
                    <div className="text-gray-400 text-sm">{assetGenerationProgress?.message || 'Processing...'}</div>
                  </div>
                </div>
                {assetGenerationProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{assetGenerationProgress.stage}</span>
                      <span>{Math.round(assetGenerationProgress.progress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                        style={{ width: `${assetGenerationProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MainSection;
