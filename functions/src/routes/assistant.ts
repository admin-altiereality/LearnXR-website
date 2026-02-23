// Assistant Route for Firebase Functions
// Handles OpenAI Assistant API, TTS, and Lip Sync

import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import OpenAIAssistantService from '../services/openaiAssistantService';
import TextToSpeechService from '../services/textToSpeechService';
import LipSyncService from '../services/lipSyncService';
import { validateReadAccess, validateFullAccess } from '../middleware/validateIn3dApiKey';

const router = Router();
const COLLECTION_CHAPTERS = 'curriculum_chapters';
const COLLECTION_CHAPTER_TTS = 'chapter_tts';
const TTS_STORAGE_PREFIX = 'chapter_tts';
const VOICE_NAME = 'female_professional';
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

/**
 * Which key is used for TTS (Regenerate Audios):
 * - OPENAI_API_KEY is used first if set in Secret Manager.
 * - If not set, OPENAI_AVATAR_API_KEY is used.
 * Both are loaded from Firebase Secret Manager when the function starts.
 */
function getTTSKeySource(): 'OPENAI_API_KEY' | 'OPENAI_AVATAR_API_KEY' {
  const hasMain = !!process.env.OPENAI_API_KEY?.trim();
  return hasMain ? 'OPENAI_API_KEY' : 'OPENAI_AVATAR_API_KEY';
}

/** TTS for Avatar/Regenerate: prefer OPENAI_API_KEY, then OPENAI_AVATAR_API_KEY */
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

/**
 * Regenerate TTS audios for a topic in a given language.
 * Replaces existing audio in place: same TTS document IDs and same storage paths.
 * POST /assistant/tts/regenerate-topic
 * Body: { chapterId, topicId, language: 'en'|'hi', scripts: { intro, explanation, outro } }
 */
router.post('/tts/regenerate-topic', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
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
      res.status(400).json({
        error: 'Missing required fields',
        message: 'chapterId, topicId, language, and scripts (intro, explanation, outro) are required',
      });
      return;
    }

    const db = admin.firestore();
    const bucket = getStorage().bucket();
    const keySource = getTTSKeySource();
    const hasMain = !!process.env.OPENAI_API_KEY?.trim();
    const hasAvatar = !!process.env.OPENAI_AVATAR_API_KEY?.trim();
    console.log(`[${requestId}] [tts/regenerate-topic] TTS key used: ${keySource} (OPENAI_API_KEY=${hasMain ? 'set' : 'missing'}, OPENAI_AVATAR_API_KEY=${hasAvatar ? 'set' : 'missing'})`);
    const ttsServiceInstance = getTTSServiceForAvatar();
    const scriptTypes = ['intro', 'explanation', 'outro'] as const;
    const typesToProcess = regenerateOnly ? [regenerateOnly] : ([...scriptTypes] as const);
    const ttsIds: string[] = [];
    const draftTtsEntries: Array<{ id: string; script_type: string; audio_url: string; language: string; voice_name: string }> = [];
    const voice = language === 'hi' ? 'nova' : 'nova';

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
        );
      }

      ttsIds.push(ttsId);
    }

    if (ttsIds.length === 0) {
      res.status(400).json({
        error: 'No script text',
        message: regenerateOnly
          ? `Script "${regenerateOnly}" must have non-empty text.`
          : 'At least one of intro, explanation, or outro must have non-empty text.',
      });
      return;
    }

    if (draftOnly) {
      res.json({
        success: true,
        ttsIds: draftTtsEntries.map((e) => e.id),
        tts: draftTtsEntries,
        message: `${language === 'en' ? 'English' : 'Hindi'} TTS generated as draft (${draftTtsEntries.length})`,
      });
      return;
    }

    const chapterRef = db.collection(COLLECTION_CHAPTERS).doc(chapterId);
    const chapterSnap = await chapterRef.get();
    if (!chapterSnap.exists) {
      console.warn(`[${requestId}] [tts/regenerate-topic] Chapter not found:`, { chapterId, topicId });
      res.status(404).json({
        error: 'Chapter not found',
        message: 'Chapter not found. Ensure the API uses the same Firebase project as the app.',
      });
      return;
    }

    const chapterData = chapterSnap.data();
    const topics = Array.isArray(chapterData?.topics) ? [...chapterData.topics] : [];
    const topicIndex = topics.findIndex(
      (t: { topic_id?: string; id?: string }) =>
        (t.topic_id && t.topic_id === topicId) || (t.id && t.id === topicId)
    );
    if (topicIndex === -1) {
      console.warn(`[${requestId}] [tts/regenerate-topic] Topic not found:`, {
        chapterId,
        topicId,
        topicIds: topics.map((t: { topic_id?: string; id?: string }) => t.topic_id || t.id),
      });
      res.status(404).json({
        error: 'Topic not found',
        message: `Topic "${topicId}" not found in this chapter.`,
      });
      return;
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
      keySource, // Which Secret Manager key was used: OPENAI_API_KEY or OPENAI_AVATAR_API_KEY
    });
  } catch (error: any) {
    console.error(`[${requestId}] Error regenerating topic TTS:`, error?.message || error, error?.status);

    if (error.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      res.status(429).json({
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota.',
      });
      return;
    }
    if (error.status === 401 || error?.message?.includes('401') || error?.message?.includes('invalid_api_key') || error?.message?.includes('authentication')) {
      const keyUsed = getTTSKeySource();
      console.error(`[${requestId}] [tts/regenerate-topic] OpenAI 401 using ${keyUsed}. Check Secret Manager: ${keyUsed} must have an enabled version with a valid key (starts with sk-). Redeploy after updating secrets.`);
      res.status(401).json({
        error: 'OpenAI API authentication failed',
        message: `Invalid OpenAI API key (key used: ${keyUsed}). In Cloud Console → Secret Manager, add a new enabled version for ${keyUsed} with a valid key, then redeploy functions.`,
        keySource: keyUsed,
      });
      return;
    }

    res.status(500).json({
      error: error?.message || 'Failed to regenerate TTS',
    });
  }
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

