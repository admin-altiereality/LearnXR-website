import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { assetExtractionService } from '../services/assetExtractionService';
import { promptEnhancementService } from '../services/promptEnhancementService';
import { isStorageAvailable } from '../utils/firebaseStorage';
import { StorageTestUtility } from '../utils/storageTest';
import { StorageStatusIndicator } from './StorageStatusIndicator';
import ConfigurationDiagnostic from './ConfigurationDiagnostic';
import { AssetViewerWithSkybox } from './AssetViewerWithSkybox';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { incrementStyleUsage } from '../services/styleUsageService';
import { UnifiedGenerationProgress } from './UnifiedGenerationProgress';
import { ChatSidebar } from './chat/ChatSidebar';
import { MobileBottomBar } from './chat/MobileBottomBar';
import { TeacherAvatar } from './TeacherAvatar';
import { AvatarSidePanel } from './AvatarSidePanel';
import { getApiBaseUrl } from '../utils/apiConfig';

const MainSection = ({ setBackgroundSkybox, backgroundSkybox }) => {
  console.log('MainSection component rendered');

  // -------------------------
  // Dev Mode & URL Params
  // -------------------------
  const [searchParams] = useSearchParams();
  const location = useLocation();
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
  // Extracted 3D assets for highlighting
  const [extractedAssets, setExtractedAssets] = useState([]);
  
  // Prompt enhancement state
  const [enablePromptEnhancement, setEnablePromptEnhancement] = useState(false); // Default to OFF
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementError, setEnhancementError] = useState(null);
  const isUpdatingFromEnhancement = useRef(false); // Track programmatic updates to prevent clearing enhanced prompt
  const promptTextareaRef = useRef(null); // Ref for the prompt textarea to preserve cursor position
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const recognitionRef = useRef(null);
  
  // Avatar voice input state
  const [isAvatarListening, setIsAvatarListening] = useState(false);
  const [avatarVoiceError, setAvatarVoiceError] = useState(null);
  const avatarRecognitionRef = useRef(null);
  
  // Chat sidebar state - load from localStorage, default to false (collapsed)
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatSidebarOpen');
      return saved === 'true';
    }
    return false; // Default to collapsed
  });
  
  // Teacher Avatar chat state
  const [avatarMessages, setAvatarMessages] = useState([]);
  const [avatarInput, setAvatarInput] = useState('');
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [isAvatarPanelOpen, setIsAvatarPanelOpen] = useState(false);
  const avatarRef = useRef(null);
  
  // Avatar configuration state
  const [avatarConfig, setAvatarConfig] = useState({
    curriculum: '',
    class: '',
    subject: ''
  });
  
  // Available assistants state
  const [availableAssistants, setAvailableAssistants] = useState([]);
  const [assistantsLoading, setAssistantsLoading] = useState(true);
  
  const CURRICULUMS = ['NCERT', 'CBSE', 'ICSE', 'State Board', 'RBSE'];
  const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const SUBJECTS = [
    'Mathematics',
    'Science',
    'English',
    'Hindi',
    'Social Studies',
    'Physics',
    'Chemistry',
    'Biology',
    'History',
    'Geography',
    'Computer Science'
  ];
  
  // Fetch available assistants on mount
  useEffect(() => {
    const fetchAvailableAssistants = async () => {
      try {
        setAssistantsLoading(true);
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/assistant/list?useAvatarKey=true`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch available assistants');
        }
        
        const data = await response.json();
        // Ensure class values are strings to match CLASSES array
        const normalizedAssistants = (data.assistants || []).map(a => ({
          ...a,
          class: String(a.class) // Ensure class is always a string
        }));
        setAvailableAssistants(normalizedAssistants);
        console.log('✅ Loaded available assistants:', normalizedAssistants.length);
        if (normalizedAssistants.length > 0) {
          console.log('📚 Available combinations:', normalizedAssistants);
          // Group and display in a readable format
          const grouped = normalizedAssistants.reduce((acc, a) => {
            const key = `${a.curriculum} - Class ${a.class}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(a.subject);
            return acc;
          }, {});
          console.log('📋 Grouped by Curriculum & Class:');
          Object.keys(grouped).sort().forEach(key => {
            console.log(`  ${key}: ${grouped[key].join(', ')}`);
          });
          
          // Show RBSE specifically
          const rbseAssistants = normalizedAssistants.filter(a => a.curriculum === 'RBSE');
          if (rbseAssistants.length > 0) {
            const rbseClasses = [...new Set(rbseAssistants.map(a => a.class))].sort();
            console.log(`📖 RBSE Classes available: ${rbseClasses.join(', ')}`);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching available assistants:', error);
        // On error, show all options (fallback behavior)
        setAvailableAssistants([]);
      } finally {
        setAssistantsLoading(false);
      }
    };
    
    fetchAvailableAssistants();
  }, []);
  
  // Filter dropdowns based on available assistants
  const getAvailableCurriculums = useMemo(() => {
    if (availableAssistants.length === 0) {
      return CURRICULUMS; // Show all if no assistants loaded yet or error
    }
    const unique = [...new Set(availableAssistants.map(a => a.curriculum))];
    return CURRICULUMS.filter(c => unique.includes(c));
  }, [availableAssistants]);
  
  const getAvailableClasses = useMemo(() => {
    if (availableAssistants.length === 0) {
      return CLASSES; // Show all if no assistants loaded yet or error
    }
    if (!avatarConfig.curriculum) {
      return []; // Don't show any classes until curriculum is selected
    }
    const filtered = availableAssistants.filter(a => a.curriculum === avatarConfig.curriculum);
    const unique = [...new Set(filtered.map(a => a.class))];
    const available = CLASSES.filter(c => unique.includes(c));
    
    // Debug logging
    console.log(`🔍 Filtering classes for ${avatarConfig.curriculum}:`, {
      totalAssistants: availableAssistants.length,
      filteredByCurriculum: filtered.length,
      uniqueClasses: unique,
      availableClasses: available
    });
    
    return available;
  }, [availableAssistants, avatarConfig.curriculum]);
  
  const getAvailableSubjects = useMemo(() => {
    if (availableAssistants.length === 0) {
      return SUBJECTS; // Show all if no assistants loaded yet or error
    }
    if (!avatarConfig.curriculum || !avatarConfig.class) {
      return []; // Don't show any subjects until curriculum and class are selected
    }
    const filtered = availableAssistants.filter(
      a => a.curriculum === avatarConfig.curriculum && a.class === avatarConfig.class
    );
    const unique = [...new Set(filtered.map(a => a.subject))];
    const available = SUBJECTS.filter(s => unique.includes(s));
    
    // Debug logging
    console.log(`🔍 Filtering subjects for ${avatarConfig.curriculum} Class ${avatarConfig.class}:`, {
      filtered: filtered.length,
      uniqueSubjects: unique,
      availableSubjects: available
    });
    
    return available;
  }, [availableAssistants, avatarConfig.curriculum, avatarConfig.class]);
  
  // Reset dependent fields when parent selection changes
  useEffect(() => {
    if (avatarConfig.curriculum && avatarConfig.class) {
      const availableClasses = getAvailableClasses;
      if (!availableClasses.includes(avatarConfig.class)) {
        setAvatarConfig(prev => ({ ...prev, class: '', subject: '' }));
      }
    }
  }, [avatarConfig.curriculum, avatarConfig.class, getAvailableClasses]);
  
  useEffect(() => {
    if (avatarConfig.class && avatarConfig.subject) {
      const availableSubjects = getAvailableSubjects;
      if (!availableSubjects.includes(avatarConfig.subject)) {
        setAvatarConfig(prev => ({ ...prev, subject: '' }));
      }
    }
  }, [avatarConfig.class, avatarConfig.subject, getAvailableSubjects]);
  
  // Loading indicator context
  const { showLoading, hideLoading, updateProgress } = useLoading();

  // Handle prompt, style, and 3D asset from sidebar navigation
  useEffect(() => {
    if (location.state?.fromSidebar) {
      // Handle new chat - clear everything
      if (location.state?.newChat) {
        setPrompt('');
        setGlobalPrompt('');
        setSelectedSkybox(null);
        setGlobalSelectedSkybox(null);
        setGeneratedVariations([]);
        setGenerated3DAsset(null);
        setGlobalGenerated3DAsset(null);
        setCurrentJobId(null);
        // Clear the state to prevent re-applying
        window.history.replaceState({}, document.title);
        return;
      }
      
      // Set prompt
      if (location.state?.prompt) {
        setPrompt(location.state.prompt);
        setGlobalPrompt(location.state.prompt);
      }

      // Set style if provided
      if (location.state?.styleId && skyboxStyles.length > 0) {
        const matchedStyle = skyboxStyles.find(style => {
          const styleId = style.id?.toString() || style.id;
          const stateStyleId = location.state.styleId?.toString() || location.state.styleId;
          return styleId === stateStyleId || 
                 style.id === location.state.styleId ||
                 style.id?.toString() === location.state.styleId?.toString();
        });
        
        if (matchedStyle) {
          console.log('✅ Matched style from sidebar:', matchedStyle);
          setSelectedSkybox(matchedStyle);
          setGlobalSelectedSkybox(matchedStyle);
        } else {
          console.warn('⚠️ Could not find matching style for ID:', location.state.styleId);
        }
      }

      // Handle 3D asset if available
      if (location.state?.has3DAsset && location.state?.jobId) {
        // Store jobId for 3D asset viewing
        setCurrentJobId(location.state.jobId);
        
        // Load 3D asset data from Firebase if jobId is available
        if (location.state?.assetDownloadUrl || location.state?.assetPreviewUrl) {
          // Create 3D asset object from navigation state
          const assetData = {
            id: location.state.jobId,
            status: location.state.assetStatus || 'completed',
            downloadUrl: location.state.assetDownloadUrl,
            previewUrl: location.state.assetPreviewUrl,
            format: location.state.assetFormat || 'glb',
            metadata: location.state.meshResult || {}
          };
          setGenerated3DAsset(assetData);
          setGlobalGenerated3DAsset(assetData);
          
          // Also ensure we have a variation set for the button to appear
          // If we have an imageUrl from the generation data, create a variation
          if (location.state?.imageUrl && generatedVariations.length === 0) {
            const variation = {
              id: location.state.jobId,
              image: location.state.imageUrl,
              title: location.state.prompt || 'Generated Skybox',
              prompt: location.state.prompt
            };
            setGeneratedVariations([variation]);
          }
        } else if (location.state?.jobId && db) {
          // Try to load from Firebase if URLs not provided
          const load3DAsset = async () => {
            try {
              const { unifiedStorageService } = await import('../services/unifiedStorageService');
              const jobData = await unifiedStorageService.getJob(location.state.jobId);
              
              if (jobData?.meshResult) {
                const assetData = {
                  id: jobData.id,
                  status: jobData.meshResult.status || 'completed',
                  downloadUrl: jobData.meshResult.downloadUrl || jobData.meshUrl,
                  previewUrl: jobData.meshResult.previewUrl,
                  format: jobData.meshResult.format || 'glb',
                  metadata: {
                    model_urls: jobData.meshResult.model_urls || jobData.model_urls
                  }
                };
                setGenerated3DAsset(assetData);
                setGlobalGenerated3DAsset(assetData);
                
                // Also ensure we have a variation set for the button to appear
                if (jobData.skyboxUrl && generatedVariations.length === 0) {
                  const variation = {
                    id: jobData.id,
                    image: jobData.skyboxUrl,
                    title: jobData.title || jobData.prompt || 'Generated Skybox',
                    prompt: jobData.prompt
                  };
                  setGeneratedVariations([variation]);
                }
              }
            } catch (error) {
              console.error('Failed to load 3D asset:', error);
            }
          };
          load3DAsset();
        }
      }

      // Clear the state to prevent re-applying on re-renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state, skyboxStyles, setGlobalPrompt, setGlobalSelectedSkybox, setCurrentJobId]);

  // -------------------------
  // Intelligent prompt parsing with AI detection (waits for typing to stop)
  // -------------------------
  useEffect(() => {
    if (!prompt.trim()) {
      setParsedPrompt(null);
      setCoordinatedPrompts(null);
      setGroundingMetadata(null);
      return;
    }

    // Debounce AI detection - only analyze after user stops typing for 1.5 seconds
    // This prevents API calls while the user is actively typing
    const timeoutId = setTimeout(async () => {
      try {
        console.log('🔍 Starting AI analysis (typing stopped for 1.5s)...');
        
        // Use AI detection for real-time analysis
        const detectionResult = await promptParserService.detectWithAI(prompt.trim());
        const parsed = detectionResult.result;
        
        setParsedPrompt(parsed);
        console.log('🤖 AI Prompt Analysis:', {
          method: detectionResult.aiUsed ? 'AI' : 'Rule-based',
          promptType: parsed.promptType,
          meshScore: parsed.meshScore,
          skyboxScore: parsed.skyboxScore,
          confidence: parsed.confidence,
          asset: parsed.asset,
          background: parsed.background,
          reasoning: detectionResult.aiResult?.reasoning
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
        console.error('Error parsing prompt with AI:', error);
        // Fallback to rule-based parsing if AI fails
        try {
          const parsed = promptParserService.parsePrompt(prompt);
          setParsedPrompt(parsed);
          console.log('🔄 Using rule-based fallback parsing');
        } catch (fallbackError) {
          console.error('Fallback parsing also failed:', fallbackError);
          setParsedPrompt(null);
        }
        setCoordinatedPrompts(null);
        setGroundingMetadata(null);
      }
    }, 1500); // Wait 1.5 seconds after user stops typing before analyzing

    // Cleanup: cancel the timeout if user continues typing
    // This ensures analysis only happens after typing stops completely
    return () => {
      clearTimeout(timeoutId);
    };
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
  // Voice Recognition Setup
  // -------------------------
  useEffect(() => {
    // Check for HTTPS/localhost requirement
    const isSecureContext = window.isSecureContext || 
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      setIsVoiceSupported(false);
      setVoiceError('Voice input requires HTTPS connection or localhost.');
      console.warn('🎤 Voice recognition requires secure context (HTTPS or localhost)');
      return;
    }
    
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsVoiceSupported(false);
      console.log('🎤 Speech recognition not supported in this browser');
      return;
    }
    
    // Check for microphone availability
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsVoiceSupported(false);
      setVoiceError('Microphone API not available. Please use a modern browser.');
      console.warn('🎤 MediaDevices API not available');
      return;
    }
    
    setIsVoiceSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
      console.log('🎤 Voice recognition started');
    };
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Append final transcript to prompt
      if (finalTranscript) {
        setPrompt(prev => {
          const newPrompt = prev ? `${prev} ${finalTranscript}`.trim() : finalTranscript.trim();
          // Respect max length
          return newPrompt.substring(0, 600);
        });
        console.log('🎤 Voice transcript added:', finalTranscript);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('🎤 Voice recognition error:', event.error, event);
      setIsListening(false);
      
      // Only show error if it's not a normal end or abort
      if (event.error === 'aborted') {
        console.log('🎤 Voice recognition aborted (normal)');
        return;
      }
      
      switch (event.error) {
        case 'no-speech':
          setVoiceError('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setVoiceError('No microphone found. Please check your device and permissions.');
          break;
        case 'not-allowed':
          setVoiceError('Microphone access denied. Please allow microphone access in your browser settings.');
          break;
        case 'network':
          setVoiceError('Network error. The speech recognition service may be unavailable. Please check your internet connection and try again.');
          break;
        case 'service-not-allowed':
          setVoiceError('Speech recognition service not available. Please try again later.');
          break;
        case 'bad-grammar':
        case 'language-not-supported':
          setVoiceError('Language not supported. Please try again.');
          break;
        default:
          setVoiceError(`Voice recognition error: ${event.error}. Please check your microphone permissions and try again.`);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      console.log('🎤 Voice recognition ended');
      // Don't set error on normal end - only on errors
    };
    
    recognitionRef.current = recognition;
    
    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Voice input toggle handler
  const toggleVoiceInput = useCallback(async () => {
    if (!recognitionRef.current) {
      setVoiceError('Voice recognition not available. Please check browser support.');
      return;
    }
    
    if (isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
        setVoiceError(null);
      } catch (error) {
        console.warn('🎤 Error stopping recognition:', error);
        setIsListening(false);
      }
    } else {
      // Clear any previous errors
      setVoiceError(null);
      
      // Request microphone permission first
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('🎤 Microphone permission granted');
          // Stop the stream immediately - we just needed permission
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (permissionError) {
        console.error('🎤 Microphone permission error:', permissionError);
        if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
          setVoiceError('Microphone access denied. Please allow microphone access in your browser settings and reload the page.');
          return;
        } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
          setVoiceError('No microphone found. Please connect a microphone and try again.');
          return;
        } else {
          setVoiceError('Failed to access microphone. Please check your device settings.');
          return;
        }
      }
      
      // Small delay to ensure permission is fully processed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Start recognition after permission is granted
      try {
        // Check if recognition is already running
        if (recognitionRef.current) {
          recognitionRef.current.start();
          console.log('🎤 Voice recognition start requested');
        }
      } catch (error) {
        console.error('🎤 Failed to start voice recognition:', error);
        // Handle the case where recognition is already started
        if (error.name === 'InvalidStateError') {
          try {
            recognitionRef.current.stop();
            setTimeout(() => {
              try {
                if (recognitionRef.current) {
                  recognitionRef.current.start();
                  console.log('🎤 Voice recognition started after retry');
                }
              } catch (retryError) {
                console.error('🎤 Failed to start voice recognition after retry:', retryError);
                setVoiceError('Failed to start voice input. Please try again in a moment.');
              }
            }, 200);
          } catch (stopError) {
            console.error('🎤 Error stopping recognition:', stopError);
            setVoiceError('Voice recognition is busy. Please wait a moment and try again.');
          }
        } else {
          setVoiceError(`Failed to start voice input: ${error.message || error.name}. Please check your microphone permissions.`);
        }
      }
    }
  }, [isListening]);

  // Avatar Voice Recognition Setup
  useEffect(() => {
    if (!isVoiceSupported) {
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('🎤 Avatar: Speech recognition not available');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsAvatarListening(true);
      setAvatarVoiceError(null);
      console.log('🎤 Avatar voice recognition started');
    };
    
    recognition.onresult = async (event) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        }
      }
      
      // Send transcript to avatar assistant
      if (finalTranscript) {
        const message = finalTranscript.trim();
        console.log('🎤 Avatar voice transcript:', message);
        
        // Check if avatar is ready
        if (!avatarRef.current) {
          console.warn('⚠️ Avatar ref not available, opening panel...');
          setIsAvatarPanelOpen(true);
          setAvatarVoiceError('Avatar is initializing. Please try again in a moment.');
          return;
        }
        
        try {
          await avatarRef.current.sendMessage(message);
          // Clear any previous errors on success
          setAvatarVoiceError(null);
        } catch (error) {
          console.error('❌ Error sending voice message to avatar:', error);
          const errorMsg = error?.message || 'Failed to send voice message.';
          if (errorMsg.includes('network') || errorMsg.includes('Network') || errorMsg.includes('fetch')) {
            setAvatarVoiceError('Network error. Please check your connection and try again.');
          } else if (errorMsg.includes('Thread not initialized')) {
            setAvatarVoiceError('Avatar is initializing. Please wait a moment and try again.');
          } else {
            setAvatarVoiceError(errorMsg);
          }
        }
      }
    };
    
    recognition.onerror = (event) => {
      console.error('🎤 Avatar voice recognition error:', event.error, event);
      setIsAvatarListening(false);
      
      // Only show error if it's not a normal end or abort
      if (event.error === 'aborted') {
        console.log('🎤 Avatar voice recognition aborted (normal)');
        return;
      }
      
      switch (event.error) {
        case 'no-speech':
          setAvatarVoiceError('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setAvatarVoiceError('No microphone found. Please check your device and permissions.');
          break;
        case 'not-allowed':
          setAvatarVoiceError('Microphone access denied. Please allow microphone access in your browser settings.');
          break;
        case 'network':
          setAvatarVoiceError('Network error. The speech recognition service may be unavailable. Please check your internet connection and try again.');
          break;
        case 'service-not-allowed':
          setAvatarVoiceError('Speech recognition service not available. Please try again later.');
          break;
        case 'bad-grammar':
        case 'language-not-supported':
          setAvatarVoiceError('Language not supported. Please try again.');
          break;
        default:
          setAvatarVoiceError(`Voice recognition error: ${event.error}. Please check your microphone permissions and try again.`);
      }
    };
    
    recognition.onend = () => {
      setIsAvatarListening(false);
      console.log('🎤 Avatar voice recognition ended');
    };
    
    avatarRecognitionRef.current = recognition;
    
    // Cleanup
    return () => {
      if (avatarRecognitionRef.current) {
        avatarRecognitionRef.current.abort();
      }
    };
  }, [isVoiceSupported]);

  // Avatar voice input toggle handler
  const toggleAvatarVoiceInput = useCallback(async () => {
    if (!avatarRecognitionRef.current) {
      setAvatarVoiceError('Voice recognition not available. Please check browser support.');
      return;
    }
    
    // Check if all config options are selected
    if (!avatarConfig.curriculum || !avatarConfig.class || !avatarConfig.subject) {
      setAvatarVoiceError('Please select curriculum, class, and subject first.');
      return;
    }
    
    if (isAvatarListening) {
      try {
        avatarRecognitionRef.current.stop();
        setIsAvatarListening(false);
        setAvatarVoiceError(null);
      } catch (error) {
        console.warn('🎤 Avatar: Error stopping recognition:', error);
        setIsAvatarListening(false);
      }
    } else {
      // Clear any previous errors
      setAvatarVoiceError(null);
      // Ensure avatar panel is open
      if (!isAvatarPanelOpen) {
        setIsAvatarPanelOpen(true);
      }
      
      // Request microphone permission first
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('🎤 Avatar: Microphone permission granted');
          // Stop the stream immediately - we just needed permission
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (permissionError) {
        console.error('🎤 Avatar: Microphone permission error:', permissionError);
        if (permissionError.name === 'NotAllowedError' || permissionError.name === 'PermissionDeniedError') {
          setAvatarVoiceError('Microphone access denied. Please allow microphone access in your browser settings and reload the page.');
          return;
        } else if (permissionError.name === 'NotFoundError' || permissionError.name === 'DevicesNotFoundError') {
          setAvatarVoiceError('No microphone found. Please connect a microphone and try again.');
          return;
        } else {
          setAvatarVoiceError('Failed to access microphone. Please check your device settings.');
          return;
        }
      }
      
      // Small delay to ensure permission is fully processed
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Start recognition after permission is granted
      try {
        // Check if recognition is already running
        if (avatarRecognitionRef.current) {
          avatarRecognitionRef.current.start();
          console.log('🎤 Avatar: Voice recognition start requested');
        }
      } catch (error) {
        console.error('🎤 Avatar: Failed to start voice recognition:', error);
        // Handle the case where recognition is already started
        if (error.name === 'InvalidStateError') {
          try {
            avatarRecognitionRef.current.stop();
            setTimeout(() => {
              try {
                if (avatarRecognitionRef.current) {
                  avatarRecognitionRef.current.start();
                  console.log('🎤 Avatar: Voice recognition started after retry');
                }
              } catch (retryError) {
                console.error('🎤 Avatar: Failed to start voice recognition after retry:', retryError);
                setAvatarVoiceError('Failed to start voice input. Please try again in a moment.');
              }
            }, 200);
          } catch (stopError) {
            console.error('🎤 Avatar: Error stopping recognition:', stopError);
            setAvatarVoiceError('Voice recognition is busy. Please wait a moment and try again.');
          }
        } else {
          setAvatarVoiceError(`Failed to start voice input: ${error.message || error.name}. Please check your microphone permissions.`);
        }
      }
    }
  }, [isAvatarListening, isAvatarPanelOpen, avatarConfig]);

  // -------------------------
  // Prompt Enhancement Function (AI-Powered)
  // -------------------------
  const enhancePrompt = useCallback(async (originalPrompt) => {
    if (!originalPrompt.trim()) {
      setEnhancementError('Prompt cannot be empty');
      return originalPrompt;
    }
    
    setIsEnhancing(true);
    setEnhancementError(null);
    
    try {
      console.log('🚀 Starting prompt enhancement for:', originalPrompt.substring(0, 50) + '...');
      
      // Use AI-powered enhancement service
      const enhancementResult = await promptEnhancementService.enhancePrompt(originalPrompt.trim());
      
      console.log('📦 Enhancement result:', {
        success: enhancementResult.success,
        hasData: !!enhancementResult.data,
        dataKeys: enhancementResult.data ? Object.keys(enhancementResult.data) : [],
        error: enhancementResult.error
      });
      
      if (enhancementResult.success && enhancementResult.data && enhancementResult.data.enhancedPrompt) {
        const enhanced = enhancementResult.data.enhancedPrompt;
        console.log('✅ Enhancement successful. Original:', originalPrompt);
        console.log('✅ Enhanced:', enhanced);
        setEnhancedPrompt(enhanced);
        setEnhancementError(null);
        return enhanced;
      } else {
        // Show error to user
        const errorMsg = enhancementResult.error || 'Failed to enhance prompt';
        console.error('❌ Prompt enhancement failed:', errorMsg, enhancementResult);
        setEnhancementError(errorMsg);
        return originalPrompt;
      }
    } catch (error) {
      const errorMsg = error.message || 'An unexpected error occurred while enhancing the prompt';
      console.error('❌ Error enhancing prompt:', error);
      setEnhancementError(errorMsg);
      return originalPrompt;
    } finally {
      setIsEnhancing(false);
    }
  }, []);

  // Helper function to preserve and restore cursor position
  const updatePromptWithCursorPreservation = useCallback((newPrompt) => {
    const textarea = promptTextareaRef.current;
    if (textarea) {
      // Store current cursor position and focus state
      const cursorPosition = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const hasSelection = cursorPosition !== selectionEnd;
      const wasFocused = document.activeElement === textarea;
      
      // Update the prompt
      setPrompt(newPrompt);
      setEnhancedPrompt(newPrompt);
      
      // Restore cursor position after React updates
      setTimeout(() => {
        if (promptTextareaRef.current) {
          // When enhancement replaces text, place cursor at end
          // This provides better UX as the user can see the full enhanced text
          const newLength = newPrompt.length;
          promptTextareaRef.current.setSelectionRange(newLength, newLength);
          
          // Only maintain focus if textarea was already focused
          if (wasFocused) {
            promptTextareaRef.current.focus();
          }
        }
      }, 0);
    } else {
      // Fallback if textarea ref is not available
      setPrompt(newPrompt);
      setEnhancedPrompt(newPrompt);
    }
  }, []);

  // Preserve cursor position when parsedPrompt changes (after analysis completes)
  // This prevents cursor shift when highlighting updates after AI analysis
  useEffect(() => {
    // Only preserve cursor if textarea is focused (user might be reading/editing)
    const textarea = promptTextareaRef.current;
    if (textarea && document.activeElement === textarea && parsedPrompt !== null) {
      // Store current cursor position before re-render
      const cursorPosition = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const promptLength = textarea.value.length; // Get length from textarea value
      
      // Restore cursor position after React re-renders (due to parsedPrompt update causing highlight change)
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (promptTextareaRef.current && document.activeElement === promptTextareaRef.current) {
            // Get current length from textarea in case it changed
            const currentPromptLength = promptTextareaRef.current.value.length;
            const adjustedStart = Math.min(cursorPosition, currentPromptLength);
            const adjustedEnd = Math.min(selectionEnd, currentPromptLength);
            promptTextareaRef.current.setSelectionRange(adjustedStart, adjustedEnd);
          }
        }, 0);
      });
    }
  }, [parsedPrompt]); // Only trigger when analysis completes (parsedPrompt changes), not on every prompt change

  // Auto-enhancement is DISABLED - only manual enhancement via "Enhance Now" button
  // Removed auto-enhancement useEffect to prevent automatic enhancement

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

  // Set default style: "1960s Ethereal Fantasy model2" when styles are loaded
  useEffect(() => {
    if (skyboxStyles.length > 0 && !selectedSkybox && !generationState?.selectedSkybox) {
      // Find "1960s Ethereal Fantasy model2" style - flexible search
      const defaultStyle = skyboxStyles.find(style => {
        const styleName = (style.name || '').toLowerCase();
        // Check for key terms: 1960s, ethereal, fantasy, and model2 (with variations)
        const has1960s = styleName.includes('1960s') || styleName.includes('1960');
        const hasEthereal = styleName.includes('ethereal');
        const hasFantasy = styleName.includes('fantasy');
        const hasModel2 = styleName.includes('model2') || 
                         styleName.includes('model 2') || 
                         styleName.includes('model-2') ||
                         styleName.endsWith('model2') ||
                         styleName.includes('model2');
        
        return has1960s && hasEthereal && hasFantasy && hasModel2;
      });
      
      if (defaultStyle) {
        console.log('✅ Setting default style:', defaultStyle.name);
        setSelectedSkybox(defaultStyle);
        setGlobalSelectedSkybox(defaultStyle);
      } else {
        // Fallback: try to find any style with "1960s Ethereal Fantasy" even without model2
        const fallbackStyle = skyboxStyles.find(style => {
          const styleName = (style.name || '').toLowerCase();
          return styleName.includes('1960s') && 
                 styleName.includes('ethereal') && 
                 styleName.includes('fantasy');
        });
        
        if (fallbackStyle) {
          console.log('✅ Setting fallback default style:', fallbackStyle.name);
          setSelectedSkybox(fallbackStyle);
          setGlobalSelectedSkybox(fallbackStyle);
        } else {
          console.warn('⚠️ Could not find "1960s Ethereal Fantasy model2" style. Available styles:', skyboxStyles.map(s => s.name));
        }
      }
    }
  }, [skyboxStyles, selectedSkybox, generationState?.selectedSkybox, setGlobalSelectedSkybox]);

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
  // Restore generation data from history page
  // -------------------------
  useEffect(() => {
    const fromHistory = sessionStorage.getItem('fromHistory');
    const resumeDataStr = sessionStorage.getItem('resumeGenerationData');
    
    if (fromHistory && resumeDataStr && skyboxStyles.length > 0) {
      try {
        const resumeData = JSON.parse(resumeDataStr);
        console.log('🔄 Resuming generation from history:', resumeData);
        
        // Restore prompt
        if (resumeData.prompt) {
          setPrompt(resumeData.prompt);
          setGlobalPrompt(resumeData.prompt);
        }
        
        // Restore negative prompt
        if (resumeData.negativePrompt) {
          setNegativeText(resumeData.negativePrompt);
          setGlobalNegativeText(resumeData.negativePrompt);
        }
        
        // Restore style - wait for styles to be loaded
        if (resumeData.styleId && skyboxStyles.length > 0) {
          const matchedStyle = skyboxStyles.find(style => {
            const styleId = style.id?.toString() || style.id;
            const resumeStyleId = resumeData.styleId?.toString() || resumeData.styleId;
            return styleId === resumeStyleId || 
                   style.id === resumeData.styleId ||
                   style.id?.toString() === resumeData.styleId?.toString();
          });
          
          if (matchedStyle) {
            console.log('✅ Matched style:', matchedStyle);
            setSelectedSkybox(matchedStyle);
            setGlobalSelectedSkybox(matchedStyle);
          } else {
            console.warn('⚠️ Could not find matching style for ID:', resumeData.styleId);
          }
        }
        
        // Restore 3D asset if available
        if (resumeData.has3DAsset && resumeData.meshUrl) {
          const restored3DAsset = {
            id: `resumed-${Date.now()}`,
            status: 'completed',
            downloadUrl: resumeData.meshUrl,
            previewUrl: resumeData.meshUrl,
            format: resumeData.meshFormat || 'glb',
            model_urls: resumeData.modelUrls || { glb: resumeData.meshUrl }
          };
          setGenerated3DAsset(restored3DAsset);
          setGlobalGenerated3DAsset(restored3DAsset);
          
          // Create a skybox variation for the 3D viewer button to work
          if (backgroundSkybox) {
            const skyboxVariation = {
              id: `resumed-skybox-${Date.now()}`,
              file_url: backgroundSkybox.image || backgroundSkybox.image_jpg || '',
              title: backgroundSkybox.title || resumeData.prompt || 'Resumed Generation',
              prompt: resumeData.prompt || '',
              generationId: `resumed-${Date.now()}`,
              preview_url: backgroundSkybox.image || backgroundSkybox.image_jpg || ''
            };
            setGeneratedVariations([skyboxVariation]);
          }
        } else if (backgroundSkybox) {
          // Even without 3D asset, create a skybox variation if background exists
          const skyboxVariation = {
            id: `resumed-skybox-${Date.now()}`,
            file_url: backgroundSkybox.image || backgroundSkybox.image_jpg || '',
            title: backgroundSkybox.title || resumeData.prompt || 'Resumed Generation',
            prompt: resumeData.prompt || '',
            generationId: `resumed-${Date.now()}`,
            preview_url: backgroundSkybox.image || backgroundSkybox.image_jpg || ''
          };
          setGeneratedVariations([skyboxVariation]);
        }
        
        // Clean up sessionStorage
        sessionStorage.removeItem('resumeGenerationData');
        sessionStorage.removeItem('fromHistory');
        
        console.log('✅ Generation data restored successfully');
      } catch (error) {
        console.error('❌ Error parsing resume data:', error);
        sessionStorage.removeItem('resumeGenerationData');
        sessionStorage.removeItem('fromHistory');
      }
    }
  }, [backgroundSkybox, skyboxStyles, setGlobalPrompt, setGlobalNegativeText, setGlobalSelectedSkybox, setGlobalGenerated3DAsset]);

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
  // AI Detection State
  // -------------------------
  const [aiDetectionResult, setAiDetectionResult] = useState(null);
  const [showAiConfirmation, setShowAiConfirmation] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(null);

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

    // ⚡ OPTIMIZED: Start generation immediately, run AI detection in parallel
    // This eliminates latency - user sees immediate feedback
    setGenerating(true);
    setError(null);
    setProgress(0);
    setSkyboxProgress(0);
    setGeneratedVariations([]);
    setCurrentVariationIndex(0);
    
    // Store the original user prompt before any processing
    const originalUserPrompt = prompt.trim();
    setGlobalPrompt(originalUserPrompt);
    setGlobalNegativeText(negativeText || null);
    setGlobalSelectedSkybox(selectedSkybox);
    setGlobalNumVariations(numVariations);
    
    // Start AI detection in parallel (non-blocking)
    const detectionPromise = promptParserService.detectWithAI(prompt.trim())
      .then(detectionResult => {
        const analysis = detectionResult.result;
        setAiDetectionResult({
          ...analysis,
          aiUsed: detectionResult.aiUsed,
          aiReasoning: detectionResult.aiResult?.reasoning
        });
        
        console.log('🤖 Detection Result (parallel):', {
          method: detectionResult.aiUsed ? 'AI' : 'Rule-based',
          promptType: analysis.promptType,
          meshScore: analysis.meshScore,
          skyboxScore: analysis.skyboxScore,
          confidence: analysis.confidence,
          reasoning: detectionResult.aiResult?.reasoning?.substring(0, 100)
        });
        
        return { analysis, detectionResult };
      })
      .catch(error => {
        console.error('❌ AI Detection error (non-blocking):', error);
        return { analysis: null, detectionResult: null };
      });
    
    // Proceed with generation immediately (don't wait for AI detection)
    // Use parsedPrompt if available, otherwise proceed with original prompt
    const initialAnalysis = parsedPrompt ? {
      promptType: parsedPrompt.meshScore > 0.5 ? 'both' : 'skybox',
      meshScore: parsedPrompt.meshScore || 0,
      skyboxScore: parsedPrompt.skyboxScore || 0,
      confidence: parsedPrompt.confidence || 0
    } : null;
    
    proceedWithGeneration(initialAnalysis, false, detectionPromise);
  };

  // Handle AI confirmation dialog actions
  const handleAiConfirmation = (proceed) => {
    setShowAiConfirmation(false);
    if (proceed && pendingGeneration) {
      const { originalAnalysis, suggest3D } = pendingGeneration;
      // Start generation immediately, detection already completed
      proceedWithGeneration(originalAnalysis, suggest3D || false, null);
    }
    setPendingGeneration(null);
  };

  // Proceed with actual generation
  const proceedWithGeneration = async (initialAnalysis, shouldEnable3D, detectionPromise = null) => {
    // Wait for AI detection to complete (if still running) - but don't block if it's slow
    let analysis = initialAnalysis;
    if (detectionPromise) {
      try {
        // Wait max 2 seconds for AI detection, then proceed
        const detectionResult = await Promise.race([
          detectionPromise,
          new Promise(resolve => setTimeout(() => resolve({ analysis: initialAnalysis }), 2000))
        ]);
        if (detectionResult?.analysis) {
          analysis = detectionResult.analysis;
          console.log('✅ Using AI detection result for generation');
        }
      } catch (error) {
        console.warn('⚠️ AI detection timed out or failed, using initial analysis:', error);
      }
    }

    let pollInterval;

    try {
      const variations = [];
      for (let i = 0; i < numVariations; i++) {
        // Ensure style_id is a valid number
        const styleIdNumber = typeof selectedSkybox.id === 'string' ? parseInt(selectedSkybox.id, 10) : Number(selectedSkybox.id);
        
        // Priority: AI-detected skybox description > coordinated prompts > parsed prompt > original prompt
        const skyboxPrompt = (() => {
          // Priority 1: Use AI-detected skybox description
          if (analysis?.skyboxDescription && analysis.skyboxDescription.trim()) {
            return analysis.skyboxDescription.trim();
          }
          // Priority 2: Use coordinated prompts
          if (coordinatedPrompts?.skybox_prompt) {
            return coordinatedPrompts.skybox_prompt;
          }
          // Priority 3: Use parsed prompt background
          if (parsedPrompt && parsedPrompt.background) {
            return parsedPrompt.background;
          }
          // Fallback: Use original prompt
          return prompt.trim();
        })();
        
        console.log('🌅 Generating skybox variation:', {
          variation: i + 1,
          originalPrompt: prompt.substring(0, 50) + '...',
          skyboxPrompt: skyboxPrompt.substring(0, 80) + '...',
          usingAiSkyboxDescription: !!(analysis?.skyboxDescription && analysis.skyboxDescription.trim()),
          usingCoordinated: !analysis?.skyboxDescription && !!coordinatedPrompts?.skybox_prompt,
          usingParsed: !analysis?.skyboxDescription && !coordinatedPrompts?.skybox_prompt && !!parsedPrompt?.background,
          aiSkyboxDescription: analysis?.skyboxDescription?.substring(0, 50) || 'N/A',
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
      // Use AI detection result if available, otherwise use parsedPrompt or default logic
      const aiSuggests3D = analysis?.promptType === 'mesh' || analysis?.promptType === 'both' || 
                          (analysis?.meshScore && analysis.meshScore > 0.5);
      // Also check parsedPrompt for 3D object detection
      const parsedSuggests3D = parsedPrompt?.meshScore > 0.5 || has3DObjects;
      const canGenerate3D = (shouldEnable3D || aiSuggests3D || parsedSuggests3D) && 
                           storageAvailable && 
                           assetGenerationService.isMeshyConfigured() && 
                           user?.uid;
      
      console.log('🔍 Parallel Generation - 3D Asset Check:', {
        storageAvailable,
        meshyConfigured: assetGenerationService.isMeshyConfigured(),
        hasUserId: !!user?.uid,
        canGenerate3D,
        aiSuggests3D,
        parsedSuggests3D,
        has3DObjects,
        meshScore: analysis?.meshScore || parsedPrompt?.meshScore || 0,
        prompt: prompt.substring(0, 50) + '...'
      });

      // Initialize both progress indicators simultaneously for seamless experience
      if (canGenerate3D) {
        setGenerating3DAsset(true);
        setAssetGenerationProgress({
          stage: 'initializing',
          progress: 0,
          message: 'Initializing 3D mesh generation...'
        });
      }

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
                // Update progress based on status - smooth progression
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
        // Progress already initialized above, just update message
        setAssetGenerationProgress({
          stage: 'extracting',
          progress: 5,
          message: 'Generating 3D asset for your environment...'
        });

        // Priority: AI-detected mesh assets > AI mesh description > coordinated prompts > parsed prompt > original prompt
        const assetPrompt = (() => {
          // Priority 1: Use AI-detected mesh assets (join multiple with " and ")
          if (analysis?.meshAssets && Array.isArray(analysis.meshAssets) && analysis.meshAssets.length > 0) {
            return analysis.meshAssets.join(' and ');
          }
          // Priority 2: Use AI-detected mesh description
          if (analysis?.meshDescription && analysis.meshDescription.trim()) {
            // If it contains pipe separator, join with " and "
            if (analysis.meshDescription.includes('|')) {
              return analysis.meshDescription.split('|').map(s => s.trim()).filter(s => s).join(' and ');
            }
            return analysis.meshDescription.trim();
          }
          // Priority 3: Use coordinated prompts
          if (coordinatedPrompts?.asset_prompt) {
            return coordinatedPrompts.asset_prompt;
          }
          // Priority 4: Use parsed prompt asset
          if (parsedPrompt && parsedPrompt.asset) {
            return parsedPrompt.asset;
          }
          // Fallback: Use original prompt
          return prompt;
        })();
        
        console.log('🎯 Generating 3D asset with AI detection:', {
          originalPrompt: prompt.substring(0, 50) + '...',
          assetPrompt: assetPrompt.substring(0, 80) + '...',
          usingAiMeshAssets: !!(analysis?.meshAssets && analysis.meshAssets.length > 0),
          usingAiMeshDescription: !!(analysis?.meshDescription && !analysis?.meshAssets),
          usingCoordinated: !analysis?.meshAssets && !analysis?.meshDescription && !!coordinatedPrompts?.asset_prompt,
          usingParsed: !analysis?.meshAssets && !analysis?.meshDescription && !coordinatedPrompts?.asset_prompt && !!parsedPrompt?.asset,
          aiMeshAssets: analysis?.meshAssets || 'N/A',
          aiMeshDescription: analysis?.meshDescription?.substring(0, 50) || 'N/A',
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
        // Automatically show 3D viewer when skybox is generated
        if (!show3DAssetViewer) {
          setTimeout(() => {
            setShow3DAssetViewer(true);
          }, 500);
        }
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
          // Store the original user prompt (what they typed in the input field)
          // This is the prompt variable from state, which is the original user input
          const originalUserPrompt = prompt.trim(); // Original user input before any processing
          const skyboxData = {
            userId: user.uid, // CRITICAL: Required for History query
            promptUsed: prompt, // Keep for backward compatibility
            originalPrompt: originalUserPrompt, // Store original user input (what user actually typed)
            prompt: originalUserPrompt, // Store original as main prompt field
            title: variationResults[0].title,
            imageUrl: variationResults[0].image, // Main image (first variation)
            style_id: selectedSkybox.id,
            style_name: selectedSkybox.name || selectedSkybox.title || null, // Store style name for easy display
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
            
            // Track style usage for this generation
            if (skyboxData.style_id) {
              try {
                console.log(`📊 Tracking style usage for style ${skyboxData.style_id}`);
                await incrementStyleUsage(skyboxData.style_id, 1);
                console.log(`✅ Style usage tracked successfully`);
              } catch (styleUsageError) {
                console.error(`⚠️ Failed to track style usage:`, styleUsageError);
                // Don't fail the whole operation if style tracking fails
              }
            }
            
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
          
          // Enhanced URL extraction - try all possible sources
          let assetUrl = asset.downloadUrl || asset.previewUrl;
          
          // Try extracting from metadata.model_urls (if available)
          if (!assetUrl && asset.metadata?.model_urls) {
            assetUrl = asset.metadata.model_urls.glb || 
                       asset.metadata.model_urls.fbx || 
                       asset.metadata.model_urls.obj ||
                       asset.metadata.model_urls.usdz ||
                       asset.metadata.model_urls.draco;
            console.log('📦 Extracted URL from model_urls:', assetUrl);
          }
          
          // Try extracting from nested metadata structures
          if (!assetUrl && asset.metadata) {
            // Check for direct URL fields in metadata
            assetUrl = asset.metadata.url || 
                       asset.metadata.downloadUrl || 
                       asset.metadata.modelUrl ||
                       asset.metadata.fileUrl;
            if (assetUrl) {
              console.log('📦 Extracted URL from metadata:', assetUrl);
            }
          }
          
          // Try extracting from result object if available
          if (!assetUrl && asset.result) {
            assetUrl = asset.result.downloadUrl || 
                       asset.result.previewUrl ||
                       asset.result.url;
            if (assetUrl) {
              console.log('📦 Extracted URL from result:', assetUrl);
            }
          }
          
          // Update asset with the URL if we found one
          if (assetUrl && !asset.downloadUrl) {
            asset.downloadUrl = assetUrl;
          }
          
          // Log asset details for debugging
          console.log('📦 3D Asset Details:', {
            hasDownloadUrl: !!asset.downloadUrl,
            hasPreviewUrl: !!asset.previewUrl,
            hasMetadata: !!asset.metadata,
            hasModelUrls: !!asset.metadata?.model_urls,
            finalUrl: assetUrl || 'NOT FOUND',
            assetId: asset.id,
            status: asset.status
          });
          
          // Store grounding metadata with the asset for 3D viewer integration
          if (groundingMetadata) {
            asset.groundingMetadata = groundingMetadata;
            console.log('📐 Grounding metadata attached to asset:', groundingMetadata);
          }
          
          setGenerated3DAsset(asset);
          setGlobalGenerated3DAsset(asset); // Save to context
          
          // Ensure 3D viewer is visible when asset is ready
          if (assetUrl) {
            setShow3DAssetViewer(true);
            console.log('✅ 3D Asset ready, showing viewer');
          }
          
          // Ensure skybox background is set when both complete
          if (variationResults && variationResults.length > 0 && setBackgroundSkybox) {
            setBackgroundSkybox(variationResults[0]);
          }
          
          // Show unified completion notification
          if (variationResults && variationResults.length > 0) {
            const successMsg = document.createElement('div');
            successMsg.className = 'fixed top-4 right-4 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 max-w-md border border-white/20';
            successMsg.innerHTML = `
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="font-bold text-lg mb-1">✨ Generation Complete!</div>
                  <div class="text-sm text-white/90 mb-2">Your immersive 3D environment is ready</div>
                  <div class="flex items-center gap-4 text-xs text-white/80">
                    <div class="flex items-center gap-1.5">
                      <div class="w-2 h-2 rounded-full bg-emerald-300"></div>
                      <span>Skybox Ready</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <div class="w-2 h-2 rounded-full bg-cyan-300"></div>
                      <span>3D Mesh Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
            document.body.appendChild(successMsg);
            setTimeout(() => {
              if (document.body.contains(successMsg)) {
                successMsg.style.transition = 'opacity 0.3s, transform 0.3s';
                successMsg.style.opacity = '0';
                successMsg.style.transform = 'translateY(-10px)';
                setTimeout(() => document.body.removeChild(successMsg), 300);
              }
            }, 4000);
          }
          
          // Automatically show viewer when both complete - with smooth transition
          setTimeout(() => {
            setShow3DAssetViewer(true);
          }, 500); // Small delay for smooth transition
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
  // Handle avatar message send
  const handleAvatarSend = async () => {
    if (!avatarInput.trim() || isAvatarLoading || !avatarRef.current) {
      return;
    }

    const message = avatarInput.trim();
    setAvatarInput('');
    setIsAvatarLoading(true);

    try {
      await avatarRef.current.sendMessage(message);
    } catch (error) {
      console.error('Error sending message to avatar:', error);
      setIsAvatarLoading(false);
      // Add error message to chat
      setAvatarMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    }
  };

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
  
  // Check for persisted background in sessionStorage as fallback
  const [persistedBackground, setPersistedBackground] = useState(null);
  
  useEffect(() => {
    const savedBackground = sessionStorage.getItem('appliedBackgroundSkybox');
    if (savedBackground) {
      try {
        const parsedBackground = JSON.parse(savedBackground);
        setPersistedBackground(parsedBackground);
      } catch (error) {
        console.error('Error parsing saved background:', error);
      }
    }
  }, []);

  // Update persisted background when backgroundSkybox prop changes
  useEffect(() => {
    if (backgroundSkybox) {
      setPersistedBackground(backgroundSkybox);
    }
  }, [backgroundSkybox]);

  // Determine if we should show the dotted surface background
  // Show during: empty state OR during loading
  // Hide if a background skybox has been applied (from history or elsewhere)
  const hasBackground = backgroundSkybox || persistedBackground;
  const showDottedSurface = 
    ((generatedVariations.length === 0 && !generated3DAsset) && !hasBackground) ||
    (isGenerating || isGenerating3DAsset);
  
  // Check if loading is active
  const isLoadingActive = isGenerating || isGenerating3DAsset;
  
  return (
    <div className={`absolute inset-0 min-h-screen transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
      isChatSidebarOpen 
        ? 'pl-0 md:pl-[260px] lg:pl-[280px] xl:pl-[300px] 2xl:pl-[320px]' 
        : 'pl-0 md:pl-[64px]'
    }`}>
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
          className={`w-full mx-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isMinimized 
              ? 'max-w-2xl px-2 sm:px-4' 
              : isChatSidebarOpen
                ? 'px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 max-w-full sm:max-w-[calc(100vw-240px-200px)] md:max-w-[calc(100vw-260px-220px)] lg:max-w-[calc(100vw-280px-240px)] xl:max-w-[calc(100vw-300px-260px)] 2xl:max-w-[calc(1536px-320px-280px)]'
                : 'px-2 sm:px-3 md:px-4 lg:px-5 xl:px-6 max-w-full sm:max-w-[calc(100vw-56px-200px)] md:max-w-[calc(100vw-64px-220px)] lg:max-w-[calc(100vw-240px)] xl:max-w-[calc(100vw-260px)] 2xl:max-w-[calc(1536px-280px)]'
          }`}
        >
          <div
            className={`
              relative z-[999]
              bg-black/10
              backdrop-blur-0
              border border-[#ffffff]/10
              shadow-[0_-8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] 
              overflow-hidden 
              transition-all duration-300
              rounded-lg
               ${isMinimized ? 'py-0.5 px-2' : 'py-1 px-2'}
            `}
          >
            {/* Top Bar / Header */}
            <div className="flex items-center justify-between mb-1 pb-1 border-b border-[#ffffff]/5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0f0f0f]/50 border border-[#ffffff]/5">
                  <span className="w-2 h-2 rounded-full bg-green-500/90 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400/80" />
                  <span className="w-2 h-2 rounded-full bg-red-500/80" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs tracking-[0.2em] text-gray-400 uppercase font-semibold">
                    IN3D ENVIRONMENT STUDIO
                  </span>
                  {!isMinimized && (
                    <span className="text-[10px] text-gray-500 mt-0.5 font-medium">
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
                    className="w-8 h-8 flex items-center justify-center bg-[#0f0f0f]/50 border border-[#ffffff]/10 hover:bg-[#1a1a1a]/50 hover:border-[#ffffff]/15 text-gray-300 transition-all duration-200 rounded-md"
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
                        strokeWidth={2}
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
                  className="px-3 py-1 bg-[#1f1f1f] border border-[#333333] hover:bg-[#262626] text-[11px] tracking-[0.16em] uppercase rounded-md"
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
              <div className={`${(isGenerating || isGenerating3DAsset) ? 'space-y-0.5' : 'space-y-1'}`}>
                {/* Error Banner */}
                {error && (
                  <div className="border border-red-500/40 bg-gradient-to-r from-red-900/20 via-red-800/15 to-red-900/20 px-2 py-1 text-xs text-red-200 flex items-start gap-2 shadow-[0_0_20px_rgba(239,68,68,0.15)] backdrop-blur-sm mb-0.5 rounded-md">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span className="font-medium leading-tight flex-1">{error}</span>
                  </div>
                )}

                {/* UNIFIED PROGRESS (when generating) */}
                {(isGenerating || isGenerating3DAsset) && (
                  <div className="w-full mb-0">
                    <UnifiedGenerationProgress
                      skyboxProgress={skyboxProgress}
                      meshProgress={assetGenerationProgress?.progress || 0}
                      skyboxEnabled={isGenerating}
                      meshEnabled={isGenerating3DAsset}
                      skyboxMessage={isGenerating ? `Generating skybox... ${Math.round(skyboxProgress)}%` : undefined}
                      meshMessage={assetGenerationProgress?.message}
                      overallMessage={
                        isGenerating && isGenerating3DAsset
                          ? `Creating your immersive 3D environment... ${Math.round((skyboxProgress + (assetGenerationProgress?.progress || 0)) / 2)}%`
                          : isGenerating
                          ? `Generating skybox... ${Math.round(skyboxProgress)}%`
                          : `Generating 3D mesh... ${Math.round(assetGenerationProgress?.progress || 0)}%`
                      }
                    />
                  </div>
                )}

                {/* Main Grid (Editor style) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-1">
                  {/* Column 1: Prompt, Variations, Negative Prompt, Download */}
                  <div className="md:col-span-2 space-y-1">
                    <div className={`border border-sky-500/30 bg-gray-800/60 px-2 py-1.5 space-y-1 backdrop-blur-sm rounded-md ${
                      (isGenerating || isGenerating3DAsset) ? 'ring-1 ring-sky-500/50 shadow-[0_0_24px_rgba(14,165,233,0.2)] border-sky-500/50' : 'hover:border-sky-500/40'
                    } transition-all duration-300`}>
                      <div className="flex items-center justify-between pb-0.5 border-b border-[#ffffff]/5">
                        <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-semibold flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/70 shadow-[0_0_6px_rgba(14,165,233,0.5)]" />
                          Prompt
                          {(isGenerating || isGenerating3DAsset) && (
                            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.8)]" title="Currently generating with this prompt" />
                          )}
                          {isListening && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-medium animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              Listening...
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Auto-Enhance Status Indicator - Always Enabled */}
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">
                                Auto-Enhance
                              </span>
                              {isEnhancing && (
                                <span className="text-[9px] text-sky-400 animate-pulse ml-0.5">Enhancing...</span>
                              )}
                              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" title="Auto-enhancement is always enabled" />
                            </div>
                          </div>
                          {/* Enhance Now Button - Manual trigger */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!prompt.trim()) {
                                setEnhancementError('Please enter a prompt first');
                                return;
                              }
                              
                              console.log('🔘 Enhance Now button clicked. Current prompt:', prompt);
                              
                              // Get current prompt value and send to OpenAI
                              isUpdatingFromEnhancement.current = true;
                              
                              try {
                                const enhanced = await enhancePrompt(prompt);
                                
                                // enhancePrompt returns the enhanced string or original on error
                                if (!enhanced || !enhanced.trim()) {
                                  console.error('❌ No enhanced prompt returned');
                                  setEnhancementError('Failed to enhance prompt. Please try again.');
                                  isUpdatingFromEnhancement.current = false;
                                  return;
                                }
                                
                                // Normalize both prompts for comparison (trim and lowercase)
                                const normalizedOriginal = prompt.trim().toLowerCase();
                                const normalizedEnhanced = enhanced.trim().toLowerCase();
                                
                                console.log('📝 Enhancement result:', { 
                                  original: prompt, 
                                  enhanced, 
                                  normalizedOriginal,
                                  normalizedEnhanced,
                                  areSame: normalizedOriginal === normalizedEnhanced
                                });
                                
                                if (enhanced && enhanced.trim()) {
                                // Always update the prompt with the enhanced version, even if similar
                                // The AI may have made subtle improvements (capitalization, punctuation, word choice)
                                if (normalizedOriginal !== normalizedEnhanced || enhanced.trim() !== prompt.trim()) {
                                  // Replace the prompt with enhanced version
                                  console.log('🔄 Replacing prompt with enhanced version');
                                  updatePromptWithCursorPreservation(enhanced.trim());
                                  // Save to context if generation is active
                                  if (isGenerating || isGenerating3DAsset) {
                                    setGlobalPrompt(enhanced.trim());
                                  }
                                  setEnhancementError(null);
                                  console.log('✅ Prompt successfully enhanced and replaced!');
                                  
                                  // Trigger detection immediately after enhancement (bypass debounce)
                                  setTimeout(async () => {
                                    try {
                                      console.log('🔍 Triggering detection after enhancement...');
                                      const detectionResult = await promptParserService.detectWithAI(enhanced.trim());
                                      const parsed = detectionResult.result;
                                      setParsedPrompt(parsed);
                                      console.log('✅ Detection completed after enhancement:', {
                                        method: detectionResult.aiUsed ? 'AI' : 'Rule-based',
                                        promptType: parsed.promptType,
                                        meshAssets: parsed.aiResult?.meshAssets,
                                        meshAssetsCount: parsed.aiResult?.meshAssets?.length || 0
                                      });
                                    } catch (error) {
                                      console.error('❌ Error during post-enhancement detection:', error);
                                    }
                                  }, 100); // Small delay to ensure state is updated
                                } else {
                                  // If truly identical, still update but show info message
                                  console.log('ℹ️ Enhanced prompt is identical to original - updating anyway');
                                  updatePromptWithCursorPreservation(enhanced.trim());
                                  if (isGenerating || isGenerating3DAsset) {
                                    setGlobalPrompt(enhanced.trim());
                                  }
                                  // Show info instead of error
                                  setEnhancementError(null);
                                  console.log('✅ Prompt updated (AI determined no changes needed, but prompt refreshed)');
                                  
                                  // Still trigger detection even if identical
                                  setTimeout(async () => {
                                    try {
                                      console.log('🔍 Triggering detection after enhancement...');
                                      const detectionResult = await promptParserService.detectWithAI(enhanced.trim());
                                      const parsed = detectionResult.result;
                                      setParsedPrompt(parsed);
                                      console.log('✅ Detection completed after enhancement');
                                    } catch (error) {
                                      console.error('❌ Error during post-enhancement detection:', error);
                                    }
                                  }, 100);
                                }
                                } else {
                                  console.error('❌ Invalid enhanced prompt received:', enhanced);
                                  setEnhancementError('Failed to get enhanced prompt. Please check the console for details and try again.');
                                }
                              } catch (error) {
                                console.error('❌ Error during enhancement:', error);
                                const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
                                setEnhancementError(errorMessage || 'Failed to enhance prompt. Please try again.');
                              } finally {
                                // Reset flag after state update
                                setTimeout(() => {
                                  isUpdatingFromEnhancement.current = false;
                                }, 0);
                              }
                            }}
                            disabled={isGenerating || isGenerating3DAsset || isEnhancing || !prompt.trim()}
                            className={`
                              px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] rounded-md
                              transition-all duration-300 border
                              ${(isGenerating || isGenerating3DAsset || isEnhancing || !prompt.trim())
                                ? 'opacity-50 cursor-not-allowed bg-gray-800/30 border-gray-700/30 text-gray-500'
                                : 'bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30 hover:border-sky-500/60 hover:text-sky-200 hover:shadow-[0_0_12px_rgba(14,165,233,0.2)]'
                              }
                            `}
                            title="Enhance current prompt with AI"
                          >
                            {isEnhancing ? (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Enhancing...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Enhance Now
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-2 px-2 py-0.5 bg-[#0a0a0a]/50 border border-[#ffffff]/5">
                            <span className="text-[10px] text-gray-400 font-semibold tabular-nums">
                              {prompt.length}/600
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Voice Error Message */}
                      {voiceError && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="flex-1 font-medium">{voiceError}</span>
                          <button 
                            onClick={() => setVoiceError(null)}
                            className="text-red-400/60 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      {/* Enhancement Error Message */}
                      {enhancementError && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] shadow-[0_0_12px_rgba(217,119,6,0.15)]">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="flex-1 font-medium">{enhancementError}</span>
                          <button 
                            onClick={() => setEnhancementError(null)}
                            className="text-amber-400/60 hover:text-amber-400 transition-colors p-0.5 rounded hover:bg-amber-500/10"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      <div className="relative">
                        {(() => {
                          // Priority: AI-detected meshAssets > AI meshDescription > keyword extraction
                          // Filter out environment keywords to prevent false highlights
                          const skyboxKeywordsForFiltering = [
                            // Locations
                            'jupiter', 'planet', 'space', 'sky', 'cloud', 'sunset', 'sunrise', 'dawn', 'dusk', 'night', 'day',
                            'forest', 'jungle', 'desert', 'ocean', 'beach', 'mountain', 'valley', 'cave', 'canyon', 'meadow', 'field',
                            // Urban
                            'city', 'cityscape', 'landscape', 'street', 'alley', 'park', 'plaza', 'downtown', 'neighborhood',
                            // Indoor
                            'room', 'bedroom', 'kitchen', 'bathroom', 'living room', 'office', 'studio', 'library', 'museum', 'gallery', 'ballroom',
                            // Architectural
                            'house', 'building', 'tower', 'castle', 'palace', 'temple', 'church', 'cathedral', 'ruins',
                            // Water
                            'river', 'lake', 'pond', 'waterfall', 'stream', 'harbor', 'port', 'dock',
                            // Roads
                            'road', 'street', 'path', 'highway', 'bridge',
                            // Other
                            'background', 'horizon', 'scenery', 'floors', 'walls', 'ceiling'
                          ];
                          
                          const aiAssets = (() => {
                            // First, try to get meshAssets from AI result
                            const aiResult = parsedPrompt?.aiResult;
                            if (aiResult?.meshAssets && Array.isArray(aiResult.meshAssets) && aiResult.meshAssets.length > 0) {
                              // Filter out any assets that contain or are environment keywords
                              return aiResult.meshAssets.filter(asset => {
                                const lowerAsset = asset.toLowerCase();
                                return !skyboxKeywordsForFiltering.some(sk => 
                                  lowerAsset === sk || 
                                  lowerAsset.includes(` ${sk} `) || 
                                  lowerAsset.startsWith(`${sk} `) || 
                                  lowerAsset.endsWith(` ${sk}`) ||
                                  lowerAsset === `with ${sk}` ||
                                  lowerAsset.startsWith(`${sk} with`)
                                );
                              });
                            }
                            // Second, try meshDescription from AI result
                            if (aiResult?.meshDescription && aiResult.meshDescription.trim()) {
                              let assets = [];
                              if (aiResult.meshDescription.includes('|')) {
                                assets = aiResult.meshDescription.split('|').map(s => s.trim()).filter(s => s);
                              } else {
                                assets = [aiResult.meshDescription.trim()].filter(s => s);
                              }
                              // Filter out environment keywords
                              return assets.filter(asset => {
                                const lowerAsset = asset.toLowerCase();
                                return !skyboxKeywordsForFiltering.some(sk => 
                                  lowerAsset === sk || 
                                  lowerAsset.includes(` ${sk} `) || 
                                  lowerAsset.startsWith(`${sk} `) || 
                                  lowerAsset.endsWith(` ${sk}`)
                                );
                              });
                            }
                            // Third, try parsedPrompt.asset (from rule-based or AI fallback)
                            if (parsedPrompt?.asset && parsedPrompt.asset.trim()) {
                              let assets = [];
                              if (parsedPrompt.asset.includes('|')) {
                                assets = parsedPrompt.asset.split('|').map(s => s.trim()).filter(s => s);
                              } else {
                                assets = [parsedPrompt.asset.trim()].filter(s => s);
                              }
                              // Filter out environment keywords
                              return assets.filter(asset => {
                                const lowerAsset = asset.toLowerCase();
                                return !skyboxKeywordsForFiltering.some(sk => 
                                  lowerAsset === sk || 
                                  lowerAsset.includes(` ${sk} `) || 
                                  lowerAsset.startsWith(`${sk} `) || 
                                  lowerAsset.endsWith(` ${sk}`)
                                );
                              });
                            }
                            return [];
                          })();
                          
                          // Fallback to keyword extraction if AI didn't detect assets
                          // But filter out environment/skybox keywords to avoid false positives
                          const skyboxKeywords = ['jupiter', 'planet', 'space', 'sky', 'cloud', 'sunset', 'sunrise', 'forest', 'jungle', 'desert', 'ocean', 'beach', 'mountain', 'city', 'cityscape', 'landscape', 'room', 'house', 'building'];
                          const currentPromptForExtraction = prompt;
                          const extraction = currentPromptForExtraction.trim() ? assetGenerationService.previewExtraction(currentPromptForExtraction) : { objects: [], hasObjects: false };
                          const keywordAssets = extraction.hasObjects && extraction.objects.length > 0
                            ? extraction.objects
                                .map(obj => obj.keyword.toLowerCase())
                                .filter(keyword => !skyboxKeywords.some(sk => keyword.includes(sk) || sk.includes(keyword)))
                            : [];
                          
                          // Enhanced debug logging for 3D asset detection
                          console.log('🎨 3D Asset Detection & Highlighting:', {
                            prompt: prompt.substring(0, 50) + '...',
                            aiAssets: aiAssets,
                            aiAssetsCount: aiAssets.length,
                            keywordAssets: keywordAssets,
                            keywordAssetsCount: keywordAssets.length,
                            aiResult: parsedPrompt?.aiResult ? {
                              meshAssets: parsedPrompt.aiResult.meshAssets,
                              meshDescription: parsedPrompt.aiResult.meshDescription,
                              meshScore: parsedPrompt.aiResult.meshScore,
                              promptType: parsedPrompt.aiResult.promptType
                            } : null,
                            assetsToHighlight: assetsToHighlight,
                            shouldHighlight: shouldHighlight,
                            meshScore: parsedPrompt?.meshScore,
                            usingAi: aiAssets.length > 0,
                            usingKeywords: aiAssets.length === 0 && keywordAssets.length > 0
                          });
                          
                          // Use AI assets if available, otherwise use keywords
                          // BUT: Only use keywords if AI didn't detect anything (to avoid false positives)
                          const assetsToHighlight = aiAssets.length > 0 ? aiAssets : (parsedPrompt?.meshScore > 0.3 ? keywordAssets : []);
                          // Highlight if we have mesh score > 0.3 OR if we have AI-detected assets
                          const shouldHighlight = (parsedPrompt?.meshScore > 0.3 || aiAssets.length > 0) && assetsToHighlight.length > 0;
                          
                          // Step 1: Calculate highlight ranges using AI-detected assets
                          // Enhanced matching algorithm for better 3D asset detection and highlighting
                          const getHighlightRanges = () => {
                            if (!shouldHighlight || !prompt || assetsToHighlight.length === 0) {
                              return [];
                            }
                            
                            const lowerPrompt = prompt.toLowerCase();
                            const ranges = [];
                            const matchedAssets = new Set(); // Track which assets have been matched
                            
                            // Process each AI-detected asset
                            assetsToHighlight.forEach(asset => {
                              if (!asset || !asset.trim() || matchedAssets.has(asset.toLowerCase())) return;
                              
                              const baseAsset = asset.trim();
                              const lowerAsset = baseAsset.toLowerCase();
                              
                              // Generate all possible variations to match
                              const assetVariations = [];
                              
                              // 1. Exact match (preserve original case)
                              assetVariations.push({ text: baseAsset, isExact: true });
                              
                              // 2. Lowercase version
                              assetVariations.push({ text: lowerAsset, isExact: false });
                              
                              // 3. Variations with articles
                              if (!/^(a|an|the)\s+/i.test(baseAsset)) {
                                assetVariations.push({ text: `a ${lowerAsset}`, isExact: false });
                                assetVariations.push({ text: `an ${lowerAsset}`, isExact: false });
                                assetVariations.push({ text: `the ${lowerAsset}`, isExact: false });
                                // Also try with capitalized articles
                                assetVariations.push({ text: `A ${baseAsset}`, isExact: true });
                                assetVariations.push({ text: `An ${baseAsset}`, isExact: true });
                                assetVariations.push({ text: `The ${baseAsset}`, isExact: true });
                              }
                              
                              // 4. Without leading article
                              const withoutArticle = baseAsset.replace(/^(a|an|the)\s+/i, '');
                              if (withoutArticle !== baseAsset) {
                                assetVariations.push({ text: withoutArticle, isExact: true });
                                assetVariations.push({ text: withoutArticle.toLowerCase(), isExact: false });
                              }
                              
                              // 5. Try matching individual words if asset is multi-word
                              const words = baseAsset.split(/\s+/).filter(w => w.length > 2);
                              if (words.length > 1) {
                                // Try last 2 words (often the most specific part)
                                if (words.length >= 2) {
                                  const lastTwo = words.slice(-2).join(' ');
                                  assetVariations.push({ text: lastTwo, isExact: true });
                                  assetVariations.push({ text: lastTwo.toLowerCase(), isExact: false });
                                }
                                // Try last word (object name)
                                const lastWord = words[words.length - 1];
                                if (lastWord.length > 3) {
                                  assetVariations.push({ text: lastWord, isExact: true });
                                  assetVariations.push({ text: lastWord.toLowerCase(), isExact: false });
                                }
                              }
                              
                              // Try each variation, prioritizing exact matches
                              let foundMatch = false;
                              
                              // First pass: try exact matches (case-sensitive)
                              for (const variation of assetVariations.filter(v => v.isExact)) {
                                if (foundMatch) break;
                                
                                const searchText = variation.text;
                                const lowerSearchText = searchText.toLowerCase();
                                let searchIndex = 0;
                                
                                while (true) {
                                  // Try case-sensitive first
                                  let index = prompt.indexOf(searchText, searchIndex);
                                  if (index === -1) {
                                    // Fallback to case-insensitive
                                    index = lowerPrompt.indexOf(lowerSearchText, searchIndex);
                                  }
                                  
                                  if (index === -1) break;
                                  
                                  // Check word boundaries
                                  const beforeChar = index > 0 ? prompt[index - 1] : ' ';
                                  const afterIndex = index + searchText.length;
                                  const afterChar = afterIndex < prompt.length ? prompt[afterIndex] : ' ';
                                  
                                  const isWordBoundary = /[\s\W]/.test(beforeChar) || index === 0;
                                  const isAfterWordBoundary = /[\s\W]/.test(afterChar) || afterIndex === prompt.length;
                                  
                                  if (isWordBoundary && isAfterWordBoundary) {
                                    // Check for overlap with existing ranges
                                    const overlaps = ranges.some(r => 
                                      (index >= r.start && index < r.end) || 
                                      (afterIndex > r.start && afterIndex <= r.end) ||
                                      (index < r.start && afterIndex > r.end)
                                    );
                                    
                                    if (!overlaps) {
                                      // Use the actual text from prompt to preserve case
                                      const actualText = prompt.substring(index, afterIndex);
                                      ranges.push({ 
                                        start: index, 
                                        end: afterIndex,
                                        asset: baseAsset,
                                        matchedText: actualText
                                      });
                                      matchedAssets.add(lowerAsset);
                                      foundMatch = true;
                                      break; // Found match, move to next asset
                                    }
                                  }
                                  
                                  searchIndex = index + 1;
                                }
                              }
                              
                              // Second pass: try case-insensitive if no exact match found
                              if (!foundMatch) {
                                for (const variation of assetVariations.filter(v => !v.isExact)) {
                                  if (foundMatch) break;
                                  
                                  const searchText = variation.text.toLowerCase();
                                  let searchIndex = 0;
                                  
                                  while (true) {
                                    const index = lowerPrompt.indexOf(searchText, searchIndex);
                                    if (index === -1) break;
                                    
                                    // Check word boundaries
                                    const beforeChar = index > 0 ? lowerPrompt[index - 1] : ' ';
                                    const afterIndex = index + searchText.length;
                                    const afterChar = afterIndex < lowerPrompt.length ? lowerPrompt[afterIndex] : ' ';
                                    
                                    const isWordBoundary = /[\s\W]/.test(beforeChar) || index === 0;
                                    const isAfterWordBoundary = /[\s\W]/.test(afterChar) || afterIndex === lowerPrompt.length;
                                    
                                    if (isWordBoundary && isAfterWordBoundary) {
                                      // Check for overlap
                                      const overlaps = ranges.some(r => 
                                        (index >= r.start && index < r.end) || 
                                        (afterIndex > r.start && afterIndex <= r.end) ||
                                        (index < r.start && afterIndex > r.end)
                                      );
                                      
                                      if (!overlaps) {
                                        // Use actual text from prompt (preserve original case)
                                        const actualText = prompt.substring(index, afterIndex);
                                        ranges.push({ 
                                          start: index, 
                                          end: afterIndex,
                                          asset: baseAsset,
                                          matchedText: actualText
                                        });
                                        matchedAssets.add(lowerAsset);
                                        foundMatch = true;
                                        break;
                                      }
                                    }
                                    
                                    searchIndex = index + 1;
                                  }
                                }
                              }
                            });
                            
                            // Sort ranges by start position
                            ranges.sort((a, b) => a.start - b.start);
                            
                            // Merge overlapping or adjacent ranges
                            if (ranges.length === 0) return [];
                            
                            const merged = [];
                            let current = { ...ranges[0] };
                            
                            for (let i = 1; i < ranges.length; i++) {
                              const gap = ranges[i].start - current.end;
                              // Merge if overlapping or very close (within 2 chars)
                              if (ranges[i].start <= current.end || gap <= 2) {
                                current = { 
                                  start: current.start, 
                                  end: Math.max(current.end, ranges[i].end),
                                  asset: current.asset || ranges[i].asset
                                };
                              } else {
                                merged.push(current);
                                current = { ...ranges[i] };
                              }
                            }
                            merged.push(current);
                            
                            return merged;
                          };
                          
                          // Step 2: Build text with color-only highlights (no background, no re-render of text)
                          // Uses exact text from prompt to preserve original case
                          const renderTextWithColorHighlights = () => {
                            const ranges = getHighlightRanges();
                            
                            // Debug logging
                            if (ranges.length > 0) {
                              console.log('🎨 Highlighting 3D assets:', {
                                assets: assetsToHighlight,
                                ranges: ranges,
                                promptLength: prompt.length
                              });
                            }
                            
                            if (ranges.length === 0) return null;
                            
                            const parts = [];
                            let lastIndex = 0;
                            
                            ranges.forEach((range, idx) => {
                              // Add normal text before highlight
                              if (range.start > lastIndex) {
                                parts.push(prompt.substring(lastIndex, range.start));
                              }
                              
                              // Add highlighted text with enhanced visual styling
                              // Use exact substring from original prompt to preserve case
                              const highlightedText = prompt.substring(range.start, range.end);
                              parts.push(
                                <span
                                  key={`hl-${idx}-${range.start}`}
                                  className="3d-asset-highlight"
                                  style={{
                                    color: '#10b981', // emerald-500 - brighter for better visibility
                                    fontWeight: 700, // bold for emphasis
                                    display: 'inline',
                                    margin: 0,
                                    padding: '0 1px', // Small padding for better visibility
                                    letterSpacing: 'inherit',
                                    wordSpacing: 'inherit',
                                    textShadow: '0 0 8px rgba(16, 185, 129, 0.3)', // Subtle glow effect
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Subtle background tint
                                    borderRadius: '2px'
                                  }}
                                  title={`3D Asset: ${range.asset || highlightedText}`}
                                >
                                  {highlightedText}
                                </span>
                              );
                              
                              lastIndex = range.end;
                            });
                            
                            // Add remaining text
                            if (lastIndex < prompt.length) {
                              parts.push(prompt.substring(lastIndex));
                            }
                            
                            return parts;
                          };
                          
                          const highlightedParts = renderTextWithColorHighlights();
                          const hasHighlight = highlightedParts !== null;
                          
                          return (
                            <>
                              {/* Actual textarea for input */}
                              <textarea
                                ref={promptTextareaRef}
                                id="prompt"
                                maxLength={600}
                                rows={2}
                                placeholder={isListening ? "Listening... Speak your prompt now" : "Describe the environment: lighting, mood, props, architecture... (or click to speak)"}
                                className={`w-full text-xs bg-gray-800/50 border border-gray-700/50 px-2 py-1 pr-12 text-gray-100 placeholder-gray-500/60 focus:outline-none focus:ring-2 resize-none transition-all duration-300 font-normal leading-relaxed rounded-md ${
                                  isListening
                                    ? 'border-red-500/60 ring-2 ring-red-500/30 focus:ring-red-500/50 focus:border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                    : 'focus:ring-sky-500/40 focus:border-sky-500/60 focus:shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                } ${
                                  isGenerating || isGenerating3DAsset 
                                    ? 'opacity-90 cursor-default' 
                                    : 'hover:border-[#2a2a2a]'
                                }`}
                                value={prompt}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  // Preserve cursor position during manual edits
                                  const textarea = e.target;
                                  const cursorPosition = textarea.selectionStart;
                                  
                                  setPrompt(newValue);
                                  // Save to context if generation is active
                                  if (isGenerating || isGenerating3DAsset) {
                                    setGlobalPrompt(newValue);
                                  }
                                  // Clear enhanced prompt when user manually edits (but not when updating from enhancement)
                                  // Since enhancement is always on, we track when user manually edits
                                  if (enhancedPrompt && !isUpdatingFromEnhancement.current) {
                                    // Only clear if the new value doesn't match the enhanced prompt (user actually changed it)
                                    if (newValue !== enhancedPrompt) {
                                      setEnhancedPrompt('');
                                    }
                                  }
                                  
                                  // Restore cursor position after state update
                                  setTimeout(() => {
                                    if (promptTextareaRef.current) {
                                      const adjustedPosition = Math.min(cursorPosition, newValue.length);
                                      promptTextareaRef.current.setSelectionRange(adjustedPosition, adjustedPosition);
                                    }
                                  }, 0);
                                }}
                                readOnly={isGenerating || isGenerating3DAsset}
                                style={{
                                  color: hasHighlight ? 'transparent' : undefined,
                                  caretColor: hasHighlight ? 'rgb(209, 213, 219)' : undefined
                                }}
                              />
                              {/* Overlay showing highlighted text */}
                              {hasHighlight && (
                                <div
                                  className="absolute inset-0 pointer-events-none select-none px-2 py-1 pr-12 text-xs text-gray-100 leading-relaxed overflow-hidden"
                                  style={{
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word',
                                    minHeight: 'calc(2 * 1.25rem + 0.75rem)',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    letterSpacing: 'normal',
                                    wordSpacing: 'normal',
                                    fontSize: '0.75rem',
                                    lineHeight: '1.5'
                                  }}
                                >
                                  {highlightedParts}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {/* Voice Input Button - Bottom Right Corner */}
                        {isVoiceSupported && (
                          <button
                            type="button"
                            onClick={toggleVoiceInput}
                            disabled={isGenerating || isGenerating3DAsset}
                            className={`absolute right-2 bottom-2 p-1.5 transition-all duration-300 shadow-lg backdrop-blur-sm rounded-md ${
                              isListening
                                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/60 animate-pulse hover:bg-amber-500/40 shadow-[0_0_20px_rgba(217,119,6,0.5)]'
                                : 'bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30 hover:text-amber-300 hover:border-amber-500/50 hover:shadow-[0_0_16px_rgba(217,119,6,0.3)]'
                            } ${
                              (isGenerating || isGenerating3DAsset) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title={isListening ? 'Stop listening' : 'Voice input - Click to speak your prompt'}
                          >
                            <svg 
                              className="w-4 h-4" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                            >
                              {isListening ? (
                                // Stop/Square icon when listening
                                <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />
                              ) : (
                                // Microphone icon
                                <>
                                  <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    d="M19 10v2a7 7 0 01-14 0v-2" 
                                  />
                                  <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    d="M12 19v3m0 0h-3m3 0h3" 
                                  />
                                  <rect 
                                    x="9" 
                                    y="2" 
                                    width="6" 
                                    height="11" 
                                    rx="3"
                                  />
                                </>
                              )}
                            </svg>
                          </button>
                        )}
                        {/* Listening indicator overlay */}
                        {isListening && (
                          <div className="absolute right-14 bottom-2.5 flex items-center gap-1">
                            <span className="flex space-x-0.5">
                              <span className="w-1.5 h-3 bg-amber-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite] shadow-[0_0_4px_rgba(217,119,6,0.6)]" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-4 bg-amber-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite] shadow-[0_0_4px_rgba(217,119,6,0.6)]" style={{ animationDelay: '100ms' }} />
                              <span className="w-1.5 h-2 bg-amber-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite] shadow-[0_0_4px_rgba(217,119,6,0.6)]" style={{ animationDelay: '200ms' }} />
                              <span className="w-1.5 h-5 bg-amber-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite] shadow-[0_0_4px_rgba(217,119,6,0.6)]" style={{ animationDelay: '300ms' }} />
                              <span className="w-1.5 h-3 bg-amber-400 rounded-full animate-[soundwave_0.8s_ease-in-out_infinite] shadow-[0_0_4px_rgba(217,119,6,0.6)]" style={{ animationDelay: '400ms' }} />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Advanced Prompt Controls - Hidden for trial users */}
                    {!isTrialUser && (
                      <div className="space-y-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-1 pt-0.5 border-t border-[#ffffff]/5">
                          <div className="md:col-span-1">
                            <label
                              htmlFor="variations"
                              className="block text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-1 font-semibold"
                            >
                              Variations
                            </label>
                            <input
                              type="number"
                              id="variations"
                              min="1"
                              max="10"
                              placeholder="1–10"
                              className={`w-full text-xs bg-gray-800/60 border border-gray-700/50 px-2 py-0.5 text-gray-100 placeholder-gray-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/60 focus:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all duration-300 rounded-md ${
                                isGenerating || isGenerating3DAsset 
                                  ? 'opacity-90 cursor-default' 
                                  : 'hover:border-gray-600/50 hover:bg-gray-800/60'
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
                              className="block text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-1 font-semibold"
                            >
                              Negative Prompt
                            </label>
                            <input
                              type="text"
                              id="negativeText"
                              placeholder="Elements to avoid: low-res, blurry, washed out..."
                              className={`w-full text-xs bg-gray-800/60 border border-gray-700/50 px-2 py-0.5 text-gray-100 placeholder-gray-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/60 focus:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all duration-300 rounded-md ${
                                isGenerating || isGenerating3DAsset 
                                  ? 'opacity-90 cursor-default' 
                                  : 'hover:border-gray-600/50 hover:bg-gray-800/60'
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
                        
                        {/* Download Button - Below Variations and Negative Prompt */}
                        <button
                          className={`
                            w-full py-1 text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2
                            transition-all duration-300 shadow-lg border rounded-md
                            ${
                              !currentImageForDownload
                                ? 'bg-gray-800/60 text-gray-500 cursor-not-allowed border-gray-700/30 shadow-none'
                                : 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600 hover:shadow-[0_0_16px_rgba(107,114,128,0.3)] hover:-translate-y-0.5 active:translate-y-0'
                            }
                          `}
                          onClick={() => setShowDownloadPopup(true)}
                          disabled={!currentImageForDownload}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download</span>
                        </button>
                      </div>
                    )}

                    {/* Show enhancement status when enhancing */}
                    {isEnhancing && (
                      <div className="p-1.5 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-sky-500/10 border border-sky-500/30 shadow-[0_0_16px_rgba(14,165,233,0.15)] rounded-md">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-sky-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-[10px] text-sky-300 font-semibold">Enhancing prompt with AI...</span>
                        </div>
                      </div>
                    )}

                    {/* 3D Objects Detection - Hidden UI, only highlighting in prompt text */}

                    {/* Trial user info badge */}
                    {isTrialUser && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border border-amber-500/30 shadow-[0_0_16px_rgba(217,119,6,0.15)] rounded-md">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] text-amber-300 leading-tight font-medium">
                          Trial: 1 variation, {TRIAL_ALLOWED_STYLES.length} styles available. <button onClick={handleUpgrade} className="underline hover:text-amber-200 font-semibold transition-colors">Upgrade</button> for full access.
                        </span>
                      </div>
                    )}

                    {/* Storage warnings - only show to non-trial users or in dev mode */}
                    {!storageAvailable && (!isTrialUser || isDevMode) && (
                      <div className="border border-red-500/40 bg-gradient-to-r from-red-900/25 via-red-800/20 to-red-900/25 px-2 py-1.5 space-y-1 shadow-[0_0_16px_rgba(239,68,68,0.15)] rounded-md">
                        <p className="text-[11px] text-red-300 leading-tight font-semibold">
                          ⚠ 3D Asset generation is temporarily unavailable due to storage configuration issues.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleStorageRecovery}
                            className="px-3 py-1.5 bg-sky-600/90 hover:bg-sky-500 text-[10px] font-bold text-white tracking-[0.12em] uppercase transition-all duration-200 hover:shadow-[0_0_12px_rgba(14,165,233,0.4)]"
                          >
                            Try Recovery
                          </button>
                          {isDevMode && (
                            <button
                              onClick={runDiagnostics}
                              className="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-[10px] font-bold text-white tracking-[0.12em] uppercase transition-all duration-200 hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                            >
                              Diagnostics
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Debug / Meshy Test - ONLY visible with ?dev=true */}
                    {isDevMode && (
                      <div className="border border-[#343434] bg-[#151515] rounded-md px-2.5 py-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] tracking-[0.16em] text-gray-500 uppercase flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Dev Mode
                          </span>
                          <button
                            onClick={() => setShowTestPanel(!showTestPanel)}
                            className="px-2.5 py-1 rounded-md bg-[#262626] hover:bg-[#2f2f2f] text-[10px] text-gray-200 uppercase tracking-[0.12em]"
                          >
                            {showTestPanel ? 'Hide' : 'Show'}
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
                          className="w-full px-2.5 py-1 rounded-md bg-gradient-to-r from-red-500/70 to-pink-600/70 hover:from-red-500 hover:to-pink-500 text-[10px] text-white font-semibold tracking-[0.12em] uppercase"
                        >
                          Debug Services (Console)
                        </button>
                        {showTestPanel && (
                          <div className="mt-1.5 border-t border-[#2a2a2a] pt-1.5">
                            <MeshyTestPanel />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Style & Generate */}
                  <div className="md:col-span-1 space-y-1 flex flex-col">
                    {/* Style selector */}
                    <div className={`border border-emerald-500/50 bg-gray-800/60 px-2 py-1.5 space-y-1 backdrop-blur-sm rounded-md ${
                      (isGenerating || isGenerating3DAsset) ? 'ring-1 ring-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.2)] border-emerald-500/60' : 'hover:border-emerald-500/60'
                    } transition-all duration-300`}>
                          <div className="flex items-center justify-between pb-0.5 border-b border-[#ffffff]/5">
                            <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-semibold flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                              In3D.Ai Style
                              {(isGenerating || isGenerating3DAsset) && selectedSkybox && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Currently generating with this style" />
                              )}
                            </span>
                            {selectedSkybox && (
                              <span className="text-[9px] text-gray-300 font-semibold px-2 py-0.5 rounded-md bg-[#0a0a0a]/50 border border-[#ffffff]/5">
                                {selectedSkybox.name}
                              </span>
                            )}
                          </div>

                       {/* Active style preview above style list – mimic Skybox panel */}
                       {selectedSkybox && (
                         <div className="overflow-hidden border border-[#ffffff]/10 bg-black/20 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] rounded-md">
                           <div className="relative">
                             {selectedSkybox.image_jpg && (
                               <img
                                 src={selectedSkybox.image_jpg}
                                 alt={selectedSkybox.name}
                                 className="w-full h-8 object-cover"
                               />
                             )}
                             <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-2 py-0.5">
                               <p className="text-[10px] font-bold text-gray-100 truncate">
                                 {selectedSkybox.name}
                               </p>
                             </div>
                           </div>
                         </div>
                       )}

                      {stylesLoading ? (
                        <div className="text-[10px] text-gray-500 py-1 font-medium">Loading styles…</div>
                      ) : stylesError ? (
                        <div className="text-[10px] text-red-400 py-1 font-medium">{stylesError}</div>
                      ) : (
                        <div className="relative">
                          <select
                            value={selectedSkybox?.id ?? ''}
                            onChange={handleSkyboxStyleChange}
                            className={`w-full appearance-none border border-emerald-500/60 bg-gray-800/60 px-2 py-1 pr-8 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/70 focus:shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-300 rounded-md ${
                              isGenerating || isGenerating3DAsset 
                                ? 'opacity-90 cursor-default' 
                                : 'hover:border-emerald-500/80 hover:bg-gray-800/60'
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
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <svg
                              className="h-3.5 w-3.5 text-emerald-400/80"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                          {/* Trial style count indicator */}
                          {isTrialUser && (
                            <p className="text-[9px] text-gray-500 mt-1.5 font-semibold px-1">
                              {availableStyles.length} styles available in trial
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Generation button */}
                    <div className="border border-[#ffffff]/10 bg-gray-800/60 px-2 py-1.5 backdrop-blur-sm flex-1 flex flex-col justify-end rounded-md">
                      <div className="space-y-1">
                        <button
                          className={`
                            w-full py-1.5 text-xs font-bold uppercase tracking-[0.2em]
                            flex items-center justify-center gap-2
                            transition-all duration-300 shadow-lg rounded-md
                            ${
                              isGenerating
                                ? 'bg-blue-600 text-white cursor-not-allowed shadow-none'
                                : !isUnlimited && remainingAfterGeneration < 0
                                ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] hover:-translate-y-0.5 active:translate-y-0'
                                : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-[0_0_24px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 active:translate-y-0'
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
                              <span>Generate</span>
                            </>
                          )}
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
                              w-full py-1 rounded-md text-xs font-semibold uppercase tracking-[0.2em] flex items-center justify-center gap-1.5
                              bg-gradient-to-r from-emerald-500/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white
                              transition-all duration-200 shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0
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
                        <div className="mt-1.5 border border-red-500/30 bg-red-900/10 rounded-md px-2.5 py-1.5">
                          <div className="flex items-center gap-1 mb-1">
                            <svg
                              className="w-3 h-3 text-red-400 flex-shrink-0"
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
                            <span className="text-[10px] text-red-300 font-medium">
                              Asset Generation Unavailable
                            </span>
                          </div>
                          <ul className="list-disc list-inside text-[10px] text-red-200/90 space-y-0.5">
                            {getMissingRequirements().map(req => (
                              <li key={req}>{req}</li>
                            ))}
                          </ul>
                          {serviceStatusError && (
                            <p className="text-[9px] text-red-200 mt-1">
                              {serviceStatusError}
                            </p>
                          )}
                          {/* Debug button only visible in dev mode */}
                          {isDevMode && (
                            <button
                              className="mt-1.5 w-full py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-[10px] text-white uppercase tracking-[0.12em] flex items-center justify-center gap-1"
                              onClick={runDiagnostics}
                            >
                             <svg
                                className="w-3 h-3"
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

                  {/* Column 3: Avatar Configuration */}
                  <div className="md:col-span-1 space-y-1 flex flex-col">
                    <div className={`border border-purple-500/30 bg-gray-800/60 px-2 py-1.5 space-y-1 backdrop-blur-sm rounded-md ${
                      (isGenerating || isGenerating3DAsset) ? 'ring-1 ring-purple-500/50 shadow-[0_0_24px_rgba(168,85,247,0.2)] border-purple-500/50' : 'hover:border-purple-500/40'
                    } transition-all duration-300`}>
                      <div className="flex items-center justify-between pb-0.5 border-b border-[#ffffff]/5">
                        <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-semibold flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400/70 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
                          Avatar Config
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div>
                          <label className="block text-[9px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">
                            Curriculum
                            {assistantsLoading && <span className="ml-1 text-[8px] text-gray-500">(Loading...)</span>}
                          </label>
                          <select
                            value={avatarConfig.curriculum}
                            onChange={(e) => setAvatarConfig(prev => ({ ...prev, curriculum: e.target.value, class: '', subject: '' }))}
                            disabled={assistantsLoading}
                            className="w-full text-xs bg-gray-900/60 border border-gray-700/50 px-2 py-1 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60 transition-all rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Select option</option>
                            {getAvailableCurriculums.map(cur => (
                              <option key={cur} value={cur}>{cur}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="block text-[9px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">Class</label>
                            <select
                              value={avatarConfig.class}
                              onChange={(e) => setAvatarConfig(prev => ({ ...prev, class: e.target.value, subject: '' }))}
                              disabled={assistantsLoading || !avatarConfig.curriculum}
                              className="w-full text-xs bg-gray-900/60 border border-gray-700/50 px-2 py-1 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60 transition-all rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="" disabled>Select option</option>
                              {getAvailableClasses.map(cls => (
                                <option key={cls} value={cls}>Class {cls}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">Subject</label>
                            <select
                              value={avatarConfig.subject}
                              onChange={(e) => setAvatarConfig(prev => ({ ...prev, subject: e.target.value }))}
                              disabled={assistantsLoading || !avatarConfig.curriculum || !avatarConfig.class}
                              className="w-full text-xs bg-gray-900/60 border border-gray-700/50 px-2 py-1 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60 transition-all rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="" disabled>Select option</option>
                              {getAvailableSubjects.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      {/* Microphone Button for Avatar Assistant */}
                      {isVoiceSupported && (
                        <div className="pt-1 border-t border-[#ffffff]/5">
                          <button
                            onClick={toggleAvatarVoiceInput}
                            disabled={!avatarConfig.curriculum || !avatarConfig.class || !avatarConfig.subject}
                            className={`
                              w-full py-2 text-xs font-bold uppercase tracking-[0.2em]
                              flex items-center justify-center gap-2
                              transition-all duration-300 shadow-lg rounded-md
                              ${
                                isAvatarListening
                                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_24px_rgba(220,38,38,0.5)] animate-pulse'
                                  : !avatarConfig.curriculum || !avatarConfig.class || !avatarConfig.subject
                                  ? 'bg-gray-800/60 text-gray-500 cursor-not-allowed border border-gray-700/30'
                                  : 'bg-purple-600 hover:bg-purple-500 text-white hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] hover:-translate-y-0.5 active:translate-y-0'
                              }
                            `}
                            title={
                              !avatarConfig.curriculum || !avatarConfig.class || !avatarConfig.subject
                                ? 'Please select curriculum, class, and subject first'
                                : isAvatarListening
                                ? 'Stop listening'
                                : 'Click to speak to the assistant'
                            }
                          >
                            {isAvatarListening ? (
                              <>
                                <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                                <span>Listening...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <span>Voice Input</span>
                              </>
                            )}
                          </button>
                          {avatarVoiceError && (
                            <div className="mt-1 p-1.5 bg-red-900/20 border border-red-500/30 rounded-md">
                              <p className="text-[9px] text-red-300 text-center leading-tight">{avatarVoiceError}</p>
                              <button
                                onClick={() => setAvatarVoiceError(null)}
                                className="mt-1 text-[8px] text-red-400 hover:text-red-300 underline mx-auto block transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
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

        {/* Column 4: Teacher Avatar - 3D Model Only */}
        <div className="w-[300px] h-[300px] min-h-[300px]">
          <TeacherAvatar
            ref={avatarRef}
            className="w-full h-full"
            avatarModelUrl="/models/avatar3.glb"
            curriculum={avatarConfig.curriculum}
            class={avatarConfig.class}
            subject={avatarConfig.subject}
            useAvatarKey={true}
            onReady={() => {
              console.log('✅ Teacher avatar ready');
              setIsAvatarReady(true);
            }}
            onMessage={(message) => {
              setAvatarMessages(prev => [...prev, { role: 'user', content: message }]);
            }}
            onResponse={(response) => {
              setAvatarMessages(prev => [...prev, { role: 'assistant', content: response }]);
              setIsAvatarLoading(false);
            }}
          />
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

      {/* 3D Asset Viewer with Skybox Background - Always visible when skybox is generated */}
      {/* Show automatically when generation completes - this is now the default view */}
      <AnimatePresence>
        {generatedVariations.length > 0 && 
         !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className={`absolute inset-0 w-full h-full z-[10] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isChatSidebarOpen 
                ? 'pl-0 md:pl-[260px] lg:pl-[280px] xl:pl-[300px] 2xl:pl-[320px]' 
                : 'pl-0 md:pl-[64px]'
            }`}
          >
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
            
            {/* 3D Viewer - Always visible when skybox is generated */}
            <div className="absolute inset-0 w-full h-full">
              {/* Visual indicator when 3D objects are detected in prompt */}
              {!generated3DAsset && (has3DObjects || parsedPrompt?.meshScore > 0.3) && !isGenerating3DAsset && (
                <div className="absolute top-4 left-4 z-[10000] bg-purple-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg border border-purple-400/50 flex items-center gap-2">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <div>
                    <div className="font-semibold text-sm">3D Objects Detected</div>
                    <div className="text-xs text-purple-100">Click Generate to create 3D assets</div>
                  </div>
                </div>
              )}
              
              {/* Control buttons overlay - Show if 3D asset exists and has URL */}
              {generated3DAsset && 
               (generated3DAsset.status === 'completed' || 
                generated3DAsset.status === 'processing' ||
                generated3DAsset.status === 'success') && 
               (generated3DAsset.downloadUrl || generated3DAsset.previewUrl || 
                generated3DAsset.metadata?.model_urls) && (
                <div className="absolute top-4 right-4 z-[10000] flex gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => {
                      setGenerated3DAsset(null);
                      setGlobalGenerated3DAsset(null);
                    }}
                    className="px-3 sm:px-4 py-2 bg-black/80 hover:bg-black/90 text-white rounded-lg text-xs sm:text-sm font-semibold border border-white/20 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shadow-lg backdrop-blur-sm"
                    title="Remove 3D asset"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="hidden xs:inline">Remove 3D Asset</span>
                    <span className="xs:hidden">Remove</span>
                  </button>
                  <button
                    onClick={async () => {
                      setGenerated3DAsset(null);
                      setGlobalGenerated3DAsset(null);
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
                    className="px-3 sm:px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 border border-white/20 whitespace-nowrap shadow-lg backdrop-blur-sm"
                    title="Generate a new 3D asset"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                </div>
              )}
              <AssetViewerWithSkybox
                assetUrl={(() => {
                  // Enhanced URL extraction for 3D asset viewer
                  if (generated3DAsset) {
                    // Check if status is completed or processing (some APIs return processing with URL)
                    const isReady = generated3DAsset.status === 'completed' || 
                                    generated3DAsset.status === 'processing' ||
                                    generated3DAsset.status === 'success';
                    
                    if (isReady || generated3DAsset.downloadUrl || generated3DAsset.previewUrl) {
                      let url = generated3DAsset.downloadUrl || generated3DAsset.previewUrl;
                      
                      // Try extracting from metadata.model_urls
                      if (!url && generated3DAsset.metadata?.model_urls) {
                        url = generated3DAsset.metadata.model_urls.glb || 
                              generated3DAsset.metadata.model_urls.fbx || 
                              generated3DAsset.metadata.model_urls.obj ||
                              generated3DAsset.metadata.model_urls.usdz ||
                              generated3DAsset.metadata.model_urls.draco;
                        console.log('📦 Viewer: Using URL from metadata.model_urls:', url);
                      }
                      
                      // Try extracting from nested metadata
                      if (!url && generated3DAsset.metadata) {
                        url = generated3DAsset.metadata.url || 
                              generated3DAsset.metadata.downloadUrl || 
                              generated3DAsset.metadata.modelUrl ||
                              generated3DAsset.metadata.fileUrl;
                        if (url) {
                          console.log('📦 Viewer: Using URL from metadata:', url);
                        }
                      }
                      
                      // Try extracting from result object
                      if (!url && generated3DAsset.result) {
                        url = generated3DAsset.result.downloadUrl || 
                              generated3DAsset.result.previewUrl ||
                              generated3DAsset.result.url;
                        if (url) {
                          console.log('📦 Viewer: Using URL from result:', url);
                        }
                      }
                      
                      if (url) {
                        console.log('✅ 3D Asset URL found for viewer:', url);
                        return url;
                      } else {
                        console.warn('⚠️ 3D Asset exists but no URL found:', {
                          hasDownloadUrl: !!generated3DAsset.downloadUrl,
                          hasPreviewUrl: !!generated3DAsset.previewUrl,
                          hasMetadata: !!generated3DAsset.metadata,
                          status: generated3DAsset.status
                        });
                      }
                    }
                  }
                  return '';
                })()}
                skyboxImageUrl={
                  backgroundSkybox?.image || backgroundSkybox?.image_jpg
                    ? (backgroundSkybox.image || backgroundSkybox.image_jpg)
                    : generatedVariations.length > 0 
                      ? (generatedVariations[currentVariationIndex]?.image || generatedVariations[0]?.image)
                      : undefined
                }
                assetFormat={generated3DAsset?.format || 'glb'}
                className="w-full h-full"
                autoRotate={false}
                onLoad={(model) => {
                  console.log('✅ 3D viewer loaded:', model);
                  if (generated3DAsset) {
                    console.log('📦 3D Asset URL:', generated3DAsset.downloadUrl || generated3DAsset.previewUrl);
                  }
                  console.log('📦 Skybox URL:', generatedVariations[currentVariationIndex]?.image || generatedVariations[0]?.image);
                }}
                onError={(error) => {
                  console.error('❌ 3D viewer error:', error);
                  if (generated3DAsset) {
                    console.error('📦 Asset data:', generated3DAsset);
                  }
                }}
              />
            </div>
          
          {/* Show loading state when asset is generating */}
          <AnimatePresence>
            {isGenerating3DAsset && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 w-full h-full z-[9998] bg-black/50 flex items-center justify-center"
              >
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
            </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Side Panel */}
      <AvatarSidePanel
        isOpen={isAvatarPanelOpen}
        onClose={() => setIsAvatarPanelOpen(false)}
      />

      {/* Chat Sidebar - Desktop/Tablet only */}
      <ChatSidebar 
        isOpen={isChatSidebarOpen} 
        onToggle={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
        setBackgroundSkybox={setBackgroundSkybox}
      />

      {/* Mobile Bottom Bar - Mobile only */}
      <MobileBottomBar 
        isOpen={isChatSidebarOpen} 
        onToggle={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
        setBackgroundSkybox={setBackgroundSkybox}
      />

      {/* AI Detection Confirmation Dialog */}
      <AnimatePresence>
        {showAiConfirmation && pendingGeneration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => handleAiConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="flex items-start space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">AI Detection Alert</h3>
                  <p className="text-sm text-gray-400">
                    Our AI analyzed your prompt and detected something different from what you're trying to generate.
                  </p>
                </div>
              </div>

              {pendingGeneration.originalAnalysis && (
                <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Detected Type:</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        pendingGeneration.originalAnalysis.promptType === 'mesh'
                          ? 'bg-purple-500/20 text-purple-300'
                          : pendingGeneration.originalAnalysis.promptType === 'skybox'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-green-500/20 text-green-300'
                      }`}>
                        {pendingGeneration.originalAnalysis.promptType === 'mesh' ? '3D Mesh Object' :
                         pendingGeneration.originalAnalysis.promptType === 'skybox' ? 'Skybox Environment' :
                         'Both'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Mesh Score:</span>
                      <span className="text-xs text-gray-300">
                        {Math.round(pendingGeneration.originalAnalysis.meshScore * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Skybox Score:</span>
                      <span className="text-xs text-gray-300">
                        {Math.round(pendingGeneration.originalAnalysis.skyboxScore * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Confidence:</span>
                      <span className="text-xs text-gray-300">
                        {Math.round(pendingGeneration.originalAnalysis.confidence * 100)}%
                      </span>
                    </div>
                    {pendingGeneration.originalAnalysis.aiUsed && pendingGeneration.originalAnalysis.aiReasoning && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex items-start space-x-2">
                          <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <div className="flex-1">
                            <span className="text-xs text-gray-400 block mb-1">AI Reasoning:</span>
                            <p className="text-xs text-gray-300 leading-relaxed">
                              {pendingGeneration.originalAnalysis.aiReasoning}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-200">
                  {pendingGeneration.type === 'skybox' && pendingGeneration.originalAnalysis?.promptType === 'mesh' ? (
                    <>
                      <strong>Warning:</strong> Your prompt appears to describe a 3D mesh object, but you're trying to generate a skybox environment. 
                      Consider using the 3D mesh generation instead for better results.
                    </>
                  ) : pendingGeneration.suggest3D ? (
                    <>
                      <strong>Suggestion:</strong> Your prompt contains both mesh objects and skybox elements. 
                      We recommend enabling 3D asset generation alongside the skybox for the best results.
                    </>
                  ) : (
                    <>
                      <strong>Note:</strong> The AI detected a potential mismatch. You can proceed anyway, but results may vary.
                    </>
                  )}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleAiConfirmation(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAiConfirmation(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Proceed Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainSection;
