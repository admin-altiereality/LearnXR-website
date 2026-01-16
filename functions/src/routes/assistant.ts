// Assistant Route for Firebase Functions
// Handles OpenAI Assistant API, TTS, and Lip Sync

import { Router, Request, Response } from 'express';
import OpenAIAssistantService from '../services/openaiAssistantService';
import TextToSpeechService from '../services/textToSpeechService';
import LipSyncService from '../services/lipSyncService';
import { validateReadAccess, validateFullAccess } from '../middleware/validateIn3dApiKey';

const router = Router();
// Services are created fresh on each request to ensure latest API keys from process.env
let ttsService: TextToSpeechService | null = null;
let lipSyncService: LipSyncService | null = null;

// Initialize services (lazy loading)
// Note: Services are recreated on each request to ensure they use the latest API keys from process.env
const getAssistantService = (useAvatarKey: boolean = false) => {
  // Use separate service instance for avatar with different API key
  if (useAvatarKey) {
    // ALWAYS create a new instance to ensure we use the latest API key from process.env
    // This is critical because secrets are loaded per-request in the function handler
    try {
      console.log('🔧 Initializing Avatar Assistant Service with OPENAI_AVATAR_API_KEY...');
      const apiKey = process.env.OPENAI_AVATAR_API_KEY;
      console.log('🔑 OPENAI_AVATAR_API_KEY available:', !!apiKey, apiKey ? `(length: ${apiKey.length})` : '');
      if (!apiKey) {
        throw new Error('OPENAI_AVATAR_API_KEY is not set in environment variables');
      }
      // Always create new instance - don't reuse cached one
      const service = new OpenAIAssistantService(true);
      console.log('✅ Avatar Assistant Service initialized successfully with OPENAI_AVATAR_API_KEY');
      return service;
    } catch (error: any) {
      console.error('❌ Failed to initialize Avatar Assistant Service:', error.message);
      console.error('   Error details:', error);
      throw error;
    }
  }
  
  // Always create a new instance to ensure we use the latest API key from process.env
  try {
    console.log('🔧 Initializing Assistant Service with OPENAI_API_KEY...');
    const service = new OpenAIAssistantService(false);
    console.log('✅ Assistant Service initialized successfully with OPENAI_API_KEY');
    return service;
  } catch (error: any) {
    console.error('❌ Failed to initialize Assistant Service:', error.message);
    console.error('   Error details:', error);
    throw error;
  }
};

const getTTSService = () => {
  if (!ttsService) {
    try {
      ttsService = new TextToSpeechService();
    } catch (error: any) {
      console.error('Failed to initialize TTS Service:', error.message);
      throw error;
    }
  }
  return ttsService;
};

const getLipSyncService = () => {
  if (!lipSyncService) {
    lipSyncService = new LipSyncService();
  }
  return lipSyncService;
};

// Create thread - POST only - Full access required
router.post('/create-thread', validateFullAccess, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  try {
    const service = getAssistantService();
    const threadId = await service.createThread();
    res.json({ threadId });
  } catch (error: any) {
    console.error(`[${requestId}] Error creating thread:`, error);
    res.status(500).json({ error: error.message || 'Failed to create thread' });
  }
});

// Handle GET requests to create-thread (return helpful error)
router.get('/create-thread', (req: Request, res: Response): void => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to create a thread.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// Send message - POST only
// Send message - Full access required
router.post('/message', validateFullAccess, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  try {
    const { threadId, message, curriculum, class: classLevel, subject, useAvatarKey } = req.body;
    
    console.log(`[${requestId}] 📨 Received message request:`, {
      threadId: threadId?.substring(0, 20) + '...',
      messageLength: message?.length,
      curriculum,
      class: classLevel,
      subject,
      useAvatarKey
    });
    
    if (!threadId || !message) {
      console.error(`[${requestId}] ❌ Missing required fields:`, { threadId: !!threadId, message: !!message });
      res.status(400).json({ error: 'threadId and message are required' });
      return;
    }

    const shouldUseAvatarKey = useAvatarKey === true || useAvatarKey === 'true';
    console.log(`[${requestId}] 🔧 Getting assistant service (useAvatarKey:`, useAvatarKey, ', type:', typeof useAvatarKey, ', shouldUseAvatarKey:', shouldUseAvatarKey, ')');
    
    if (shouldUseAvatarKey) {
      console.log(`[${requestId}] 🔑 Using OPENAI_AVATAR_API_KEY for avatar response`);
      const apiKey = process.env.OPENAI_AVATAR_API_KEY;
      console.log(`[${requestId}] 🔑 OPENAI_AVATAR_API_KEY status:`, {
        exists: !!apiKey,
        length: apiKey?.length || 0,
        preview: apiKey ? apiKey.substring(0, 20) + '...' + apiKey.substring(apiKey.length - 4) : 'N/A'
      });
    } else {
      console.log(`[${requestId}] 🔑 Using OPENAI_API_KEY for regular response`);
    }
    
    const service = getAssistantService(shouldUseAvatarKey);
    const config = { curriculum, class: classLevel, subject };
    
    console.log(`[${requestId}] 📤 Sending message to assistant with config:`, config);
    const response = await service.sendMessage(threadId, message, config);
    console.log(`[${requestId}] ✅ Assistant response received, length:`, response?.length);
    
    res.json({ response });
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Error sending message:`, error);
    console.error(`[${requestId}]    Error message:`, error.message);
    console.error(`[${requestId}]    Error stack:`, error.stack);
    
    // Handle OpenAI quota errors
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate_limit')) {
      res.status(429).json({ 
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota. Please check your OpenAI account billing and usage limits.',
        details: error.message || 'Quota limit reached'
      });
      return;
    }
    
    // Handle authentication errors
    if (error.status === 401 || error.message?.includes('invalid_api_key') || error.message?.includes('authentication')) {
      res.status(401).json({ 
        error: 'OpenAI API authentication failed',
        message: 'Invalid OpenAI API key. Please check your API key configuration.',
        details: error.message || 'Authentication failed'
      });
      return;
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to send message',
      details: error.stack
    });
  }
});

// Handle GET requests to message (return helpful error)
router.get('/message', (req: Request, res: Response): void => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to send a message.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// Text to Speech - POST only
// Generate TTS - Full access required
router.post('/tts/generate', validateFullAccess, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  try {
    const { text, voice } = req.body;
    
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const service = getTTSService();
    const filename = `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
    const audioUrl = await service.generateSpeechFile(
      text, 
      filename, 
      voice || 'nova'
    );
    res.json({ audioUrl });
  } catch (error: any) {
    console.error(`[${requestId}] Error generating TTS:`, error);
    
    // Handle OpenAI quota errors
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
      res.status(429).json({ 
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota. Please check your OpenAI account billing and usage limits.',
        details: error.message || 'Quota limit reached'
      });
      return;
    }
    
    // Handle other OpenAI errors
    if (error.status === 401 || error.message?.includes('401')) {
      res.status(401).json({ 
        error: 'OpenAI API authentication failed',
        message: 'Invalid OpenAI API key. Please check your API key configuration.',
        details: error.message
      });
      return;
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to generate speech',
      details: error.stack
    });
  }
});

// Handle GET requests to tts/generate (return helpful error)
router.get('/tts/generate', (req: Request, res: Response): void => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to generate speech.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// Generate visemes - POST only
// Generate lip sync - Full access required
router.post('/lipsync/generate', validateFullAccess, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  try {
    const { text } = req.body;
    
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const service = getLipSyncService();
    const visemes = await service.generateVisemesFromText(text);
    res.json({ visemes });
  } catch (error: any) {
    console.error(`[${requestId}] Error generating visemes:`, error);
    res.status(500).json({ error: error.message || 'Failed to generate visemes' });
  }
});

// Handle GET requests to lipsync/generate (return helpful error)
router.get('/lipsync/generate', (req: Request, res: Response): void => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to generate visemes.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// List available assistants - GET
// List assistants - Read access
router.get('/list', validateReadAccess, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  try {
    const { useAvatarKey } = req.query;
    
    console.log(`[${requestId}] 📋 Listing available assistants (useAvatarKey:`, useAvatarKey === 'true', ')');
    
    const service = getAssistantService(useAvatarKey === 'true');
    
    // Get raw assistants list for debugging
    let rawAssistants: any[] = [];
    let rawErrorDetails: any = null;
    try {
      const openai = (service as any).openai;
      if (!openai) {
        console.error(`[${requestId}] ❌ OpenAI client is not initialized in service`);
        rawErrorDetails = { error: 'OpenAI client not initialized' };
      } else {
        console.log(`[${requestId}] 🔍 Calling OpenAI API to list assistants...`);
        const rawResponse = await openai.beta.assistants.list({ limit: 100 });
        rawAssistants = rawResponse.data || [];
        console.log(`[${requestId}] 📊 Found ${rawAssistants.length} raw assistants from OpenAI`);
        if (rawAssistants.length > 0) {
          console.log(`[${requestId}] 📝 Raw assistant names:`, rawAssistants.map(a => a.name || '(unnamed)').slice(0, 10));
        } else {
          console.warn(`[${requestId}] ⚠️ OpenAI API returned empty assistants list`);
        }
      }
    } catch (rawError: any) {
      console.error(`[${requestId}] ❌ Error fetching raw assistants from OpenAI:`, rawError);
      console.error(`[${requestId}]    Error message:`, rawError.message);
      console.error(`[${requestId}]    Error status:`, rawError.status);
      console.error(`[${requestId}]    Error code:`, rawError.code);
      console.error(`[${requestId}]    Error stack:`, rawError.stack);
      rawErrorDetails = {
        message: rawError.message,
        status: rawError.status,
        code: rawError.code,
        type: rawError.type
      };
    }
    
    let availableAssistants: Array<{ curriculum: string; class: string; subject: string }> = [];
    let parseError: any = null;
    
    try {
      availableAssistants = await service.listAvailableAssistants();
      console.log(`[${requestId}] ✅ Found ${availableAssistants.length} parsed assistant configurations`);
    } catch (parseErr: any) {
      console.error(`[${requestId}] ❌ Error parsing assistants:`, parseErr);
      parseError = {
        message: parseErr.message,
        status: parseErr.status,
        code: parseErr.code,
        type: parseErr.type
      };
    }
    
    if (availableAssistants.length === 0 && rawAssistants.length > 0) {
      console.warn(`[${requestId}] ⚠️ WARNING: Raw assistants found but none matched the expected naming pattern!`);
      console.warn(`[${requestId}]    Expected format: "{Curriculum} {Class} {Subject} Teacher" or "Class {Class} {Subject} RBSE"`);
      console.warn(`[${requestId}]    Example: "NCERT 10 Mathematics Teacher" or "Class 10 Hindi RBSE"`);
      console.warn(`[${requestId}]    Found assistant names:`, rawAssistants.map(a => a.name || '(unnamed)'));
    }
    
    res.json({ 
      assistants: availableAssistants,
      debug: {
        rawCount: rawAssistants.length,
        parsedCount: availableAssistants.length,
        rawNames: rawAssistants.slice(0, 20).map(a => a.name || '(unnamed)'),
        rawError: rawErrorDetails,
        parseError: parseError,
        useAvatarKey: useAvatarKey === 'true',
        hasOpenAIClient: !!(service as any).openai,
        apiKeyConfigured: useAvatarKey === 'true' 
          ? !!process.env.OPENAI_AVATAR_API_KEY 
          : !!process.env.OPENAI_API_KEY,
        openaiAvatarKeySet: !!process.env.OPENAI_AVATAR_API_KEY,
        openaiKeySet: !!process.env.OPENAI_API_KEY
      }
    });
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Error listing assistants:`, error);
    console.error(`[${requestId}]    Error stack:`, error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to list assistants',
      assistants: [], // Return empty array on error
      debug: {
        error: error.message,
        stack: error.stack
      }
    });
  }
});

export default router;

