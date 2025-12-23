import { Request, Response } from 'express';
import { coordinatedPromptGeneratorService } from '../services/coordinatedPromptGeneratorService';

/**
 * Generate coordinated prompts and metadata
 * POST /api/coordinated-prompt/generate
 * Body: { prompt: string }
 */
export const generateCoordinatedPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a non-empty string'
      });
      return;
    }

    // Generate coordinated output
    const output = coordinatedPromptGeneratorService.generate(prompt.trim());

    // Return JSON only as specified
    res.status(200).json(output);
  } catch (error) {
    console.error('Error generating coordinated prompt:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate coordinated prompt'
    });
  }
};

