// AI Detection Controller
// Handles API requests for AI-based prompt detection

import { Request, Response } from 'express';
import { aiPromptDetectionService } from '../services/aiPromptDetectionService';

interface DetectionRequest {
  prompt: string;
}

/**
 * Detect prompt type using AI
 * POST /api/ai-detection/detect
 */
export const detectPromptType = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { prompt } = req.body as DetectionRequest;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
        requestId
      });
    }

    console.log(`[${requestId}] AI Detection requested for prompt:`, prompt.substring(0, 50) + '...');

    // Check if AI is configured
    if (!aiPromptDetectionService.isAIConfigured()) {
      console.warn(`[${requestId}] AI not configured, using fallback`);
      const fallbackResult = aiPromptDetectionService.fallbackDetection(prompt);
      return res.status(200).json({
        success: true,
        data: fallbackResult,
        method: 'fallback',
        requestId
      });
    }

    // Use AI detection
    const result = await aiPromptDetectionService.detectPromptType(prompt.trim());

    console.log(`[${requestId}] AI Detection completed:`, {
      promptType: result.promptType,
      confidence: result.confidence
    });

    return res.status(200).json({
      success: true,
      data: result,
      method: 'ai',
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] AI Detection error:`, error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AI detection failed',
      requestId
    });
  }
};

