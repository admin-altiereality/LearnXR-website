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

    // Use script-aware AI extraction (returns 2-4 Meshy-optimized prompts)
    const result = await aiPromptDetectionService.extractAssetsOnly(prompt.trim());
    const assets = result.assets.slice(0, 4); // Enforce max 4

    console.log(`[${requestId}] Asset extraction completed:`, {
      count: assets.length,
      assets: assets
    });

    return res.status(200).json({
      assets,
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
 * Fallback keyword-based asset extraction for explanation scripts.
 * Returns 2-4 Meshy-style prompts when possible.
 */
function extractAssetsFallback(prompt: string): string[] {
  const rawPhrases: string[] = [];
  const lowerPrompt = prompt.toLowerCase();

  // Educational and general 3D object keywords (script-friendly), including animals
  const objectKeywords = [
    'globe', 'map', 'ruler', 'compass', 'telescope', 'microscope', 'model', 'models',
    'table', 'chair', 'desk', 'sofa', 'cabinet', 'shelf', 'lamp', 'vase', 'mirror', 'clock',
    'car', 'bike', 'plane', 'ship', 'boat', 'train', 'helicopter', 'drone', 'spaceship',
    'sword', 'shield', 'armor', 'helmet', 'hammer', 'wrench', 'screwdriver',
    'statue', 'sculpture', 'bust', 'monument', 'totem', 'artifact',
    'plant', 'flower', 'crystal', 'gem', 'rock', 'stone', 'fossil',
    'beaker', 'flask', 'test tube', 'periodic table', 'atom', 'solar system', 'planets',
    'chandelier', 'trophy', 'painting', 'cube', 'sphere', 'pyramid', 'cylinder', 'cone',
    'phone', 'computer', 'laptop', 'tablet', 'camera', 'speaker',
    'box', 'crate', 'barrel', 'bottle', 'jar', 'book', 'scroll',
    'frog', 'hen', 'duck', 'sheep', 'cow', 'dog', 'cat', 'bird', 'horse', 'pig', 'animal'
  ];

  for (const keyword of objectKeywords) {
    if (lowerPrompt.includes(keyword)) {
      const words = prompt.split(/\s+/);
      const keywordIndex = words.findIndex(w => w.toLowerCase().includes(keyword));
      if (keywordIndex >= 0) {
        const start = Math.max(0, keywordIndex - 1);
        const end = Math.min(words.length, keywordIndex + 2);
        const phrase = words.slice(start, end).join(' ').trim();
        if (phrase && !rawPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
          rawPhrases.push(phrase);
        }
      }
    }
  }

  // Convert to simple Meshy-style prompts (2-4 items)
  const meshyStyle = (phrase: string): string => {
    const p = phrase.trim();
    if (p.length < 4) return `3D model of a ${p}`;
    return `Detailed 3D model of ${p}, realistic, clean topology`;
  };
  const assets = rawPhrases
    .slice(0, 4)
    .map(meshyStyle);

  return assets;
};

