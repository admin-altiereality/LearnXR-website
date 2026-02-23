import express from 'express';
import OpenAIAssistantService from '../services/openaiAssistantService';
import TextToSpeechService from '../services/textToSpeechService';
import LipSyncService from '../services/lipSyncService';
import { db, storage } from '../config/firebase-admin';

const router = express.Router();

const COLLECTION_CHAPTERS = 'curriculum_chapters';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const TTS_STORAGE_PREFIX = 'chapter_tts';
const VOICE_NAME = 'female_professional';
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

let ttsServiceForAvatar: TextToSpeechService | null = null;

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

/** TTS for Avatar/Regenerate: prefer OPENAI_API_KEY so one key works; fallback to OPENAI_AVATAR_API_KEY */
const getTTSServiceForAvatar = () => {
  if (!ttsServiceForAvatar) {
    const key = (process.env.OPENAI_API_KEY || process.env.OPENAI_AVATAR_API_KEY)?.trim();
    if (!key) {
      throw new Error('OPENAI_API_KEY (or OPENAI_AVATAR_API_KEY) is not configured');
    }
    ttsServiceForAvatar = new TextToSpeechService(key);
  }
  return ttsServiceForAvatar;
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

/**
 * Regenerate TTS audios for a topic in a given language.
 * Replaces existing audio in place: same TTS document IDs and same storage paths (no new IDs, no duplicate files).
 * POST /assistant/tts/regenerate-topic
 * Body: { chapterId, topicId, language: 'en'|'hi', scripts: { intro, explanation, outro } }
 */
router.post('/tts/regenerate-topic', async (req, res) => {
  try {
    const { chapterId, topicId, language, scripts, regenerateOnly, draftOnly } = req.body as {
      chapterId?: string;
      topicId?: string;
      language?: 'en' | 'hi';
      scripts?: { intro?: string; explanation?: string; outro?: string };
      regenerateOnly?: 'intro' | 'explanation' | 'outro';
      draftOnly?: boolean;
    };

    if (!chapterId || !topicId || !language || !scripts) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'chapterId, topicId, language, and scripts (intro, explanation, outro) are required',
      });
    }

    if (!db || !storage) {
      return res.status(503).json({ error: 'Firebase (Firestore or Storage) not available' });
    }

    const ttsServiceInstance = getTTSServiceForAvatar();
    const bucket = storage.bucket();
    const scriptTypes = ['intro', 'explanation', 'outro'] as const;
    const typesToProcess = regenerateOnly ? [regenerateOnly] : ([...scriptTypes] as const);
    const ttsIds: string[] = [];
    const draftTtsEntries: Array<{ id: string; script_type: string; audio_url: string; language: string; voice_name: string }> = [];
    const voice = language === 'hi' ? 'nova' : 'nova';
    const { FieldValue } = await import('firebase-admin/firestore');

    // Fixed IDs and paths: always same per topic+language+scriptType so we replace in place (no new docs, no duplicate files)
    for (const scriptType of typesToProcess) {
      const text = (scripts as Record<string, string>)[scriptType];
      if (!text || typeof text !== 'string' || !text.trim()) continue;

      const ttsId = `${topicId}_${scriptType}_${language}_${VOICE_NAME}`;
      const storagePath = `${TTS_STORAGE_PREFIX}/${chapterId}/${topicId}/${topicId}_${scriptType}_${language}.mp3`;

      const buffer = await ttsServiceInstance.textToSpeech(text.trim(), voice);
      const file = bucket.file(storagePath);
      await file.save(buffer, {
        contentType: 'audio/mpeg',
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      if (draftOnly) {
        draftTtsEntries.push({
          id: ttsId,
          script_type: scriptType,
          audio_url: publicUrl,
          language,
          voice_name: VOICE_NAME,
        });
      } else {
        const ttsRef = db.collection(COLLECTION_CHAPTER_TTS).doc(ttsId);
        await ttsRef.set(
          {
            chapter_id: chapterId,
            topic_id: topicId,
            script_type: scriptType,
            audio_url: publicUrl,
            language,
            voice_name: VOICE_NAME,
            status: 'complete',
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ); // replace only audio; do not overwrite script_text (stays the same)
      }

      ttsIds.push(ttsId);
    }

    if (ttsIds.length === 0) {
      return res.status(400).json({
        error: 'No script text',
        message: regenerateOnly
          ? `Script "${regenerateOnly}" must have non-empty text.`
          : 'At least one of intro, explanation, or outro must have non-empty text.',
      });
    }

    if (draftOnly) {
      return res.json({
        success: true,
        ttsIds: draftTtsEntries.map((e) => e.id),
        tts: draftTtsEntries,
        message: `${language === 'en' ? 'English' : 'Hindi'} TTS generated as draft (${draftTtsEntries.length})`,
      });
    }

    // Update chapter only when this topic doesn't already have these TTS IDs for this language (first-time generation)
    const chapterRef = db.collection(COLLECTION_CHAPTERS).doc(chapterId);
    const chapterSnap = await chapterRef.get();
    if (!chapterSnap.exists) {
      console.warn('[tts/regenerate-topic] Chapter not found:', { chapterId, topicId });
      return res.status(404).json({
        error: 'Chapter not found',
        message: 'Chapter not found. Ensure the API server uses the same Firebase project as the app.',
      });
    }

    const chapterData = chapterSnap.data();
    const topics = Array.isArray(chapterData?.topics) ? [...chapterData.topics] : [];
    const topicIndex = topics.findIndex(
      (t: { topic_id?: string; id?: string }) =>
        (t.topic_id && t.topic_id === topicId) || (t.id && t.id === topicId)
    );
    if (topicIndex === -1) {
      console.warn('[tts/regenerate-topic] Topic not found in chapter:', {
        chapterId,
        topicId,
        topicIds: topics.map((t: { topic_id?: string; id?: string }) => t.topic_id || t.id),
      });
      return res.status(404).json({
        error: 'Topic not found',
        message: `Topic "${topicId}" not found in this chapter.`,
      });
    }

    const topic = topics[topicIndex];
    const existingForLang = (topic.tts_ids_by_language || {})[language] || [];
    const finalIdsForLang = regenerateOnly
      ? scriptTypes.map((st) => (st === regenerateOnly ? ttsIds[0]! : `${topicId}_${st}_${language}_${VOICE_NAME}`))
      : ttsIds;
    const existingSet = new Set(existingForLang);
    const needsChapterUpdate =
      finalIdsForLang.some((id) => !existingSet.has(id)) || existingForLang.length !== finalIdsForLang.length;

    if (needsChapterUpdate) {
      const existingTtsByLang = topic.tts_ids_by_language || {};
      const otherLang = language === 'en' ? 'hi' : 'en';
      const otherIds = existingTtsByLang[otherLang] || [];
      const mergedLegacy = [...otherIds, ...finalIdsForLang];

      topics[topicIndex] = {
        ...topic,
        tts_ids_by_language: {
          ...existingTtsByLang,
          [language]: finalIdsForLang,
        },
        tts_ids: mergedLegacy,
      };

      await chapterRef.update({
        topics,
        updatedAt: FieldValue.serverTimestamp(),
      });

    }

    res.json({
      success: true,
      ttsIds: finalIdsForLang,
      message: regenerateOnly
        ? `${language === 'en' ? 'English' : 'Hindi'} TTS "${regenerateOnly}" regenerated`
        : `${language === 'en' ? 'English' : 'Hindi'} TTS audios regenerated (${ttsIds.length})`,
    });
  } catch (error: any) {
    console.error('Error regenerating topic TTS:', error);

    if (error.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      return res.status(429).json({
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota.',
      });
    }
    if (error.status === 401 || error?.message?.includes('401')) {
      return res.status(401).json({
        error: 'OpenAI API authentication failed',
        message: 'Invalid OpenAI API key.',
      });
    }

    res.status(500).json({
      error: error?.message || 'Failed to regenerate TTS',
    });
  }
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

