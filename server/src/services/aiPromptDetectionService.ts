// AI-Based Prompt Detection Service
// Uses LLM API (OpenAI/Anthropic) to intelligently detect 3D assets vs skybox environments

import OpenAI from 'openai';

export interface AIDetectionResult {
  promptType: 'mesh' | 'skybox' | 'both' | 'unknown';
  meshScore: number; // 0-1
  skyboxScore: number; // 0-1
  confidence: number; // 0-1
  reasoning: string; // AI's explanation
  meshDescription?: string; // What 3D asset should be generated
  skyboxDescription?: string; // What skybox environment should be generated
  shouldGenerateMesh: boolean;
  shouldGenerateSkybox: boolean;
}

interface AIDetectionRequest {
  prompt: string;
}

class AIPromptDetectionService {
  private openai: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
      console.log('✅ AI Prompt Detection Service initialized with OpenAI');
    } else {
      console.warn('⚠️ OpenAI API key not found. AI detection will use fallback method.');
      this.isConfigured = false;
    }
  }

  /**
   * Check if AI service is configured
   */
  isAIConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Detect prompt type using AI
   */
  async detectPromptType(prompt: string): Promise<AIDetectionResult> {
    if (!this.isConfigured || !this.openai) {
      throw new Error('AI detection service is not configured. Please set OPENAI_API_KEY.');
    }

    if (!prompt || !prompt.trim()) {
      return {
        promptType: 'unknown',
        meshScore: 0,
        skyboxScore: 0,
        confidence: 0,
        reasoning: 'Empty prompt provided',
        shouldGenerateMesh: false,
        shouldGenerateSkybox: false
      };
    }

    try {
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

      console.log('🤖 Calling OpenAI API for prompt detection...');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using mini for cost efficiency, can upgrade to gpt-4 if needed
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 500
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from AI');
      }

      const aiResult = JSON.parse(responseContent) as AIDetectionResult;

      // Validate and normalize the result
      const validatedResult: AIDetectionResult = {
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

      console.log('✅ AI Detection Result:', {
        promptType: validatedResult.promptType,
        meshScore: validatedResult.meshScore,
        skyboxScore: validatedResult.skyboxScore,
        confidence: validatedResult.confidence
      });

      return validatedResult;
    } catch (error) {
      console.error('❌ AI Detection error:', error);
      throw new Error(`AI detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fallback detection using rule-based method (when AI is not available)
   */
  fallbackDetection(prompt: string): AIDetectionResult {
    // This would use the existing promptParserService
    // For now, return a basic result
    return {
      promptType: 'unknown',
      meshScore: 0.5,
      skyboxScore: 0.5,
      confidence: 0.3,
      reasoning: 'Using fallback detection method (AI not available)',
      shouldGenerateMesh: false,
      shouldGenerateSkybox: false
    };
  }
}

export const aiPromptDetectionService = new AIPromptDetectionService();

