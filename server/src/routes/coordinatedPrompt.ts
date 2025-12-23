import { Router } from 'express';
import { generateCoordinatedPrompt } from '../controllers/coordinatedPrompt.controller';

const router = Router();

// Generate coordinated prompts and metadata
router.post('/generate', generateCoordinatedPrompt);

export default router;

