import express from 'express';
import OpenAIAssistantService from '../services/openaiAssistantService';
import TextToSpeechService from '../services/textToSpeechService';
import LipSyncService from '../services/lipSyncService';

const router = express.Router();
let assistantService: OpenAIAssistantService | null = null;
let ttsService: TextToSpeechService | null = null;
let lipSyncService: LipSyncService | null = null;

// Initialize services (lazy loading)
let avatarAssistantService: OpenAIAssistantService | null = null;

const getAssistantService = (useAvatarKey: boolean = false) => {
  // Use separate service instance for avatar with different API key
  if (useAvatarKey) {
    if (!avatarAssistantService) {
      try {
        console.log('🔧 Initializing Avatar Assistant Service with OPENAI_AVATAR_API_KEY...');
        avatarAssistantService = new OpenAIAssistantService(true);
        console.log('✅ Avatar Assistant Service initialized successfully');
      } catch (error: any) {
        console.error('❌ Failed to initialize Avatar Assistant Service:', error.message);
        console.error('   Error details:', error);
        throw error;
      }
    }
    return avatarAssistantService;
  }
  
  if (!assistantService) {
    try {
      console.log('🔧 Initializing Assistant Service with OPENAI_API_KEY...');
      assistantService = new OpenAIAssistantService(false);
      console.log('✅ Assistant Service initialized successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize Assistant Service:', error.message);
      console.error('   Error details:', error);
      throw error;
    }
  }
  return assistantService;
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

// Create thread - POST only
router.post('/create-thread', async (req, res) => {
  try {
    const { curriculum, class: classLevel, subject, useAvatarKey } = req.body;
    
    console.log('🔗 Creating thread with config:', {
      curriculum,
      class: classLevel,
      subject,
      useAvatarKey: useAvatarKey === true
    });
    
    // Validate required fields if config is provided
    // Note: All three fields are optional - thread can be created without them
    // But if any are provided, we should validate them
    if (curriculum || classLevel || subject) {
      // If any config is provided, validate all are present and valid
      if (!curriculum || !classLevel || !subject) {
        return res.status(400).json({ 
          error: 'Invalid configuration',
          message: 'If providing configuration, all three fields (curriculum, class, subject) are required',
          provided: { curriculum: !!curriculum, class: !!classLevel, subject: !!subject }
        });
      }
      
      // Validate curriculum
      const validCurriculums = ['NCERT', 'CBSE', 'ICSE', 'State Board', 'RBSE'];
      if (!validCurriculums.includes(curriculum)) {
        return res.status(400).json({ 
          error: 'Invalid curriculum',
          message: `Curriculum must be one of: ${validCurriculums.join(', ')}`,
          provided: curriculum
        });
      }
      
      // Validate class
      const validClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      if (!validClasses.includes(String(classLevel))) {
        return res.status(400).json({ 
          error: 'Invalid class',
          message: `Class must be between 1 and 12`,
          provided: classLevel
        });
      }
    }
    
    // Get assistant service
    let service: OpenAIAssistantService;
    try {
      service = getAssistantService(useAvatarKey === true);
    } catch (serviceError: any) {
      console.error('❌ Failed to get assistant service:', serviceError);
      return res.status(500).json({ 
        error: 'Service initialization failed',
        message: 'Failed to initialize OpenAI Assistant Service. Please check your API key configuration.',
        details: serviceError.message || 'Service initialization error'
      });
    }
    
    // Pass config to createThread so assistant is initialized immediately
    const config = curriculum && classLevel && subject 
      ? { curriculum, class: classLevel, subject }
      : undefined;
    
    let threadId: string;
    try {
      threadId = await service.createThread(config);
    } catch (threadError: any) {
      console.error('❌ Error creating thread:', threadError);
      console.error('   Error type:', threadError?.constructor?.name);
      console.error('   Error message:', threadError?.message);
      console.error('   Error status:', threadError?.status);
      console.error('   Error code:', threadError?.code);
      
      // Handle OpenAI API key errors
      if (threadError?.status === 401 || 
          threadError?.message?.includes('401') || 
          threadError?.message?.includes('Invalid API key') || 
          threadError?.message?.includes('authentication') ||
          threadError?.code === 'invalid_api_key') {
        return res.status(401).json({ 
          error: 'OpenAI API authentication failed',
          message: 'Invalid OpenAI API key. Please check your API key configuration.',
          details: threadError.message || 'Authentication error'
        });
      }
      
      // Handle OpenAI quota errors
      if (threadError?.status === 429 || 
          threadError?.message?.includes('429') || 
          threadError?.message?.includes('quota') ||
          threadError?.code === 'insufficient_quota') {
        return res.status(429).json({ 
          error: 'OpenAI API quota exceeded',
          message: 'You have exceeded your OpenAI API quota. Please check your OpenAI account billing and usage limits.',
          details: threadError.message || 'Quota limit reached'
        });
      }
      
      // Handle rate limit errors
      if (threadError?.status === 429 || 
          threadError?.message?.includes('rate limit') ||
          threadError?.code === 'rate_limit_exceeded') {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please wait a moment and try again.',
          details: threadError.message || 'Rate limit error'
        });
      }
      
      // Handle assistant creation errors
      if (threadError?.message?.includes('assistant') || 
          threadError?.code === 'invalid_assistant') {
        return res.status(400).json({ 
          error: 'Assistant configuration error',
          message: 'Failed to create or retrieve assistant. Please check your configuration.',
          details: threadError.message || 'Assistant error'
        });
      }
      
      // Generic error
      return res.status(500).json({ 
        error: 'Failed to create thread',
        message: threadError.message || 'Unknown error occurred while creating thread',
        details: process.env.NODE_ENV === 'development' ? threadError.stack : undefined
      });
    }
    
    console.log('✅ Thread created:', threadId, config ? `for ${config.curriculum} Class ${config.class} ${config.subject}` : '');
    
    // Store config in response for client to use in subsequent requests
    res.json({ 
      threadId,
      config: config || null
    });
  } catch (error: any) {
    // Catch any unexpected errors
    console.error('❌ Unexpected error creating thread:', error);
    console.error('   Error type:', error?.constructor?.name);
    console.error('   Error message:', error?.message);
    console.error('   Error stack:', error?.stack);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating thread',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Handle GET requests to create-thread (return helpful error)
router.get('/create-thread', (req, res) => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to create a thread.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// Send message - POST only
router.post('/message', async (req, res) => {
  try {
    const { threadId, message, curriculum, class: classLevel, subject, useAvatarKey } = req.body;
    
    console.log('📨 Received message request:', {
      threadId: threadId?.substring(0, 20) + '...',
      messageLength: message?.length,
      curriculum,
      class: classLevel,
      subject,
      useAvatarKey
    });
    
    if (!threadId || !message) {
      console.error('❌ Missing required fields:', { threadId: !!threadId, message: !!message });
      return res.status(400).json({ error: 'threadId and message are required' });
    }

    console.log('🔧 Getting assistant service (useAvatarKey:', useAvatarKey === true, ')');
    const service = getAssistantService(useAvatarKey === true);
    const config = { curriculum, class: classLevel, subject };
    
    console.log('📤 Sending message to assistant with config:', config);
    const response = await service.sendMessage(threadId, message, config);
    console.log('✅ Assistant response received, length:', response?.length);
    
    res.json({ response });
  } catch (error: any) {
    console.error('❌ Error sending message:', error);
    console.error('   Error type:', error?.constructor?.name);
    console.error('   Error message:', error?.message);
    console.error('   Error stack:', error?.stack?.substring(0, 500));
    
    // Handle OpenAI API key errors
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Invalid API key') || error.message?.includes('authentication')) {
      return res.status(401).json({ 
        error: 'OpenAI API authentication failed',
        message: 'Invalid OpenAI API key. Please check your API key configuration.',
        details: error.message || 'Authentication error'
      });
    }
    
    // Handle OpenAI quota errors
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
      return res.status(429).json({ 
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota. Please check your OpenAI account billing and usage limits.',
        details: error.message || 'Quota limit reached'
      });
    }
    
    // Handle rate limit errors
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please wait a moment and try again.',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Handle GET requests to message (return helpful error)
router.get('/message', (req, res) => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to send a message.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// Text to Speech - POST only
router.post('/tts/generate', async (req, res) => {
  try {
    const { text, voice } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
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
    console.error('Error generating TTS:', error);
    
    // Handle OpenAI quota errors
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
      return res.status(429).json({ 
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota. Please check your OpenAI account billing and usage limits.',
        details: error.message || 'Quota limit reached'
      });
    }
    
    // Handle other OpenAI errors
    if (error.status === 401 || error.message?.includes('401')) {
      return res.status(401).json({ 
        error: 'OpenAI API authentication failed',
        message: 'Invalid OpenAI API key. Please check your API key configuration.',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to generate speech',
      details: error.stack
    });
  }
});

// Handle GET requests to tts/generate (return helpful error)
router.get('/tts/generate', (req, res) => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to generate speech.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// Generate visemes - POST only
router.post('/lipsync/generate', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const service = getLipSyncService();
    const visemes = await service.generateVisemesFromText(text);
    res.json({ visemes });
  } catch (error: any) {
    console.error('Error generating visemes:', error);
    res.status(500).json({ error: error.message || 'Failed to generate visemes' });
  }
});

// Handle GET requests to lipsync/generate (return helpful error)
router.get('/lipsync/generate', (req, res) => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Please use POST to generate visemes.',
    method: req.method,
    allowedMethods: ['POST']
  });
});

// List available assistants - GET
router.get('/list', async (req, res) => {
  try {
    const { useAvatarKey } = req.query;
    
    console.log('📋 Listing available assistants (useAvatarKey:', useAvatarKey === 'true', ')');
    
    const service = getAssistantService(useAvatarKey === 'true');
    
    // Get raw assistants list for debugging
    let rawAssistants: any[] = [];
    try {
      const openai = (service as any).openai;
      if (openai) {
        const rawResponse = await openai.beta.assistants.list({ limit: 100 });
        rawAssistants = rawResponse.data || [];
        console.log(`📊 Found ${rawAssistants.length} raw assistants from OpenAI`);
        if (rawAssistants.length > 0) {
          console.log('📝 Raw assistant names:', rawAssistants.map(a => a.name || '(unnamed)').slice(0, 10));
        }
      }
    } catch (rawError: any) {
      console.warn('⚠️ Could not fetch raw assistants for debugging:', rawError.message);
    }
    
    const availableAssistants = await service.listAvailableAssistants();
    
    console.log(`✅ Found ${availableAssistants.length} parsed assistant configurations`);
    
    if (availableAssistants.length === 0 && rawAssistants.length > 0) {
      console.warn('⚠️ WARNING: Raw assistants found but none matched the expected naming pattern!');
      console.warn('   Expected format: "{Curriculum} {Class} {Subject} Teacher"');
      console.warn('   Example: "NCERT 10 Mathematics Teacher"');
      console.warn('   Found assistant names:', rawAssistants.map(a => a.name || '(unnamed)'));
    }
    
    res.json({ 
      assistants: availableAssistants,
      debug: {
        rawCount: rawAssistants.length,
        parsedCount: availableAssistants.length,
        rawNames: rawAssistants.slice(0, 20).map(a => a.name || '(unnamed)')
      }
    });
  } catch (error: any) {
    console.error('❌ Error listing assistants:', error);
    console.error('   Error stack:', error.stack);
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

