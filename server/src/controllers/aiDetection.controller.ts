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

/**
 * Extract ONLY 3D asset phrases from prompt
 * POST /api/ai-detection/extract-assets
 */
export const extractAssets = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { prompt } = req.body as DetectionRequest;

    if (!prompt || !prompt.trim()) {
      return res.status(200).json({
        assets: [],
        success: true,
        requestId
      });
    }

    console.log(`[${requestId}] Asset extraction requested for prompt:`, prompt.substring(0, 50) + '...');

    // Check if AI is configured
    if (!aiPromptDetectionService.isAIConfigured()) {
      console.warn(`[${requestId}] AI not configured, using keyword-based fallback`);
      
      // Use keyword-based fallback extraction
      const fallbackAssets = extractAssetsFallback(prompt.trim());
      
      return res.status(200).json({
        assets: fallbackAssets,
        success: true,
        method: 'fallback',
        requestId
      });
    }

    // Use simplified AI extraction
    const result = await aiPromptDetectionService.extractAssetsOnly(prompt.trim());

    console.log(`[${requestId}] Asset extraction completed:`, {
      count: result.assets.length,
      assets: result.assets
    });

    return res.status(200).json({
      assets: result.assets,
      success: true,
      method: 'ai',
      requestId
    });
  } catch (error) {
    console.error(`[${requestId}] Asset extraction error:`, error);
    
    // Try fallback on error (prompt may be out of scope or wrong type in catch)
    const promptForFallback = typeof (req.body as DetectionRequest).prompt === 'string' ? (req.body as DetectionRequest).prompt : '';
    try {
      const fallbackAssets = extractAssetsFallback(promptForFallback.trim());
      return res.status(200).json({
        assets: fallbackAssets,
        success: true,
        method: 'fallback-error',
        requestId
      });
    } catch (fallbackError) {
      return res.status(200).json({
        assets: [],
        success: false,
        error: error instanceof Error ? error.message : 'Asset extraction failed',
        requestId
      });
    }
  }
};

/**
 * Fallback keyword-based asset extraction
 */
function extractAssetsFallback(prompt: string): string[] {
  const assets: string[] = [];
  const lowerPrompt = prompt.toLowerCase();
  
  // Common 3D object keywords
  const objectKeywords = [
    'globe', 'map', 'ruler', 'compass', 'telescope', 'microscope',
    'table', 'chair', 'desk', 'sofa', 'bed', 'cabinet', 'shelf', 'lamp', 'vase', 'mirror', 'clock',
    'car', 'bike', 'motorcycle', 'plane', 'ship', 'boat', 'truck', 'bus', 'train', 'helicopter', 'drone', 'spaceship',
    'sword', 'gun', 'shield', 'armor', 'helmet', 'axe', 'hammer', 'wrench', 'screwdriver',
    'statue', 'sculpture', 'bust', 'monument', 'totem',
    'plant', 'flower', 'crystal', 'gem', 'rock', 'stone', 'boulder', 'log', 'branch',
    'artwork', 'painting', 'trophy', 'award', 'chandelier',
    'phone', 'computer', 'laptop', 'tablet', 'camera', 'speaker',
    'box', 'crate', 'barrel', 'bottle', 'jar', 'can'
  ];
  
  // Find objects in prompt
  for (const keyword of objectKeywords) {
    if (lowerPrompt.includes(keyword)) {
      // Extract the phrase containing the keyword
      const words = prompt.split(/\s+/);
      const keywordIndex = words.findIndex(w => w.toLowerCase().includes(keyword));
      
      if (keywordIndex >= 0) {
        // Extract 2-3 words around the keyword for context
        const start = Math.max(0, keywordIndex - 1);
        const end = Math.min(words.length, keywordIndex + 2);
        const phrase = words.slice(start, end).join(' ').trim();
        
        if (phrase && !assets.includes(phrase)) {
          assets.push(phrase);
        }
      }
    }
  }
  
  return assets;
};

