// AI Detection Route for Firebase Functions
// Handles AI-based prompt detection using OpenAI

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI (lazy loading to avoid issues if key is missing)
let openai: OpenAI | null = null;
let isConfigured = false;

const initializeOpenAI = () => {
  if (openai) return; // Already initialized
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    openai = new OpenAI({ apiKey });
    isConfigured = true;
    console.log('✅ OpenAI initialized in Firebase Functions');
  } else {
    console.warn('⚠️ OPENAI_API_KEY not found in Firebase Functions');
    isConfigured = false;
  }
};

/**
 * AI Detection endpoint
 * POST /api/ai-detection/detect
 */
router.post('/detect', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
        requestId
      });
    }

    console.log(`[${requestId}] AI Detection requested for prompt:`, prompt.substring(0, 50) + '...');

    // Initialize OpenAI if not already done
    initializeOpenAI();

    // If OpenAI is not configured, return fallback
    if (!isConfigured || !openai) {
      console.warn(`[${requestId}] OpenAI not configured, using fallback`);
      return res.status(200).json({
        success: true,
        data: {
          promptType: 'unknown',
          meshScore: 0.5,
          skyboxScore: 0.5,
          confidence: 0.3,
          reasoning: 'AI detection not available (OpenAI API key not configured). Using fallback detection.',
          shouldGenerateMesh: false,
          shouldGenerateSkybox: true
        },
        method: 'fallback',
        requestId
      });
    }

    // Use AI detection
    const systemPrompt = `You are an expert at analyzing prompts for 3D content generation. Your task is to determine whether a prompt describes:
1. A 3D MESH OBJECT (like a car, statue, furniture, character, weapon, etc.) - something that can be a standalone 3D model
2. A SKYBOX ENVIRONMENT (like a room, landscape, cityscape, forest, space scene, etc.) - a 360° panoramic environment
3. BOTH - when a prompt contains both a 3D object AND an environment (e.g., "a car on a beach")

Analyze the prompt carefully and respond with a JSON object containing:
- promptType: "mesh" | "skybox" | "both" | "unknown"
- meshScore: number between 0-1 (how likely this is a 3D mesh object)
- skyboxScore: number between 0-1 (how likely this is a skybox environment)
- confidence: number between 0-1 (how confident you are in the analysis)
- reasoning: string explaining your analysis
- meshDescription: string describing what 3D asset should be generated (if applicable, otherwise empty string)
- skyboxDescription: string describing what skybox environment should be generated (if applicable, otherwise empty string)
- shouldGenerateMesh: boolean (whether a 3D mesh should be generated)
- shouldGenerateSkybox: boolean (whether a skybox should be generated)

Important rules:
- If prompt describes objects mentioned AS PART OF an environment (e.g., "cityscape with flying vehicles"), it's a SKYBOX
- If prompt describes a standalone object (e.g., "a detailed sword"), it's a MESH
- If prompt describes an object IN an environment (e.g., "a car on a beach"), it's BOTH
- Be precise with scores - they should add up logically (both can be high for "both" type)
- Confidence should reflect how clear the prompt is`;

    const userPrompt = `Analyze this prompt: "${prompt.trim()}"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from AI');
    }

    const aiResult = JSON.parse(responseContent);

    // Validate and normalize
    const result = {
      promptType: ['mesh', 'skybox', 'both', 'unknown'].includes(aiResult.promptType)
        ? aiResult.promptType
        : 'unknown',
      meshScore: Math.max(0, Math.min(1, aiResult.meshScore || 0)),
      skyboxScore: Math.max(0, Math.min(1, aiResult.skyboxScore || 0)),
      confidence: Math.max(0, Math.min(1, aiResult.confidence || 0)),
      reasoning: aiResult.reasoning || 'No reasoning provided',
      meshDescription: aiResult.meshDescription || '',
      skyboxDescription: aiResult.skyboxDescription || '',
      shouldGenerateMesh: aiResult.shouldGenerateMesh ?? (aiResult.meshScore > 0.5),
      shouldGenerateSkybox: aiResult.shouldGenerateSkybox ?? (aiResult.skyboxScore > 0.5)
    };

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
    
    // Return fallback on error
    return res.status(200).json({
      success: true,
      data: {
        promptType: 'unknown',
        meshScore: 0.5,
        skyboxScore: 0.5,
        confidence: 0.3,
        reasoning: `AI detection failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using fallback.`,
        shouldGenerateMesh: false,
        shouldGenerateSkybox: true
      },
      method: 'fallback',
      requestId
    });
  }
});

export default router;


