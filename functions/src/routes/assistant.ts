// Assistant Route for Firebase Functions
// Handles OpenAI Assistant API, TTS, and Lip Sync

import { Router, Request, Response } from 'express';
import OpenAIAssistantService from '../services/openaiAssistantService';
import TextToSpeechService from '../services/textToSpeechService';
import LipSyncService from '../services/lipSyncService';

const router = Router();
let assistantService: OpenAIAssistantService | null = null;
let ttsService: TextToSpeechService | null = null;
let lipSyncService: LipSyncService | null = null;

// Initialize services (lazy loading)
const getAssistantService = () => {
  if (!assistantService) {
    try {
      assistantService = new OpenAIAssistantService();
    } catch (error: any) {
      console.error('Failed to initialize Assistant Service:', error.message);
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
router.post('/create-thread', async (req: Request, res: Response): Promise<void> => {
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
router.post('/message', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  try {
    const { threadId, message } = req.body;
    
    if (!threadId || !message) {
      res.status(400).json({ error: 'threadId and message are required' });
      return;
    }

    const service = getAssistantService();
    const response = await service.sendMessage(threadId, message);
    res.json({ response });
  } catch (error: any) {
    console.error(`[${requestId}] Error sending message:`, error);
    
    // Handle OpenAI quota errors
    if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
      res.status(429).json({ 
        error: 'OpenAI API quota exceeded',
        message: 'You have exceeded your OpenAI API quota. Please check your OpenAI account billing and usage limits.',
        details: error.message || 'Quota limit reached'
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
router.post('/tts/generate', async (req: Request, res: Response): Promise<void> => {
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
router.post('/lipsync/generate', async (req: Request, res: Response): Promise<void> => {
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

export default router;

