import { Router } from 'express';
import { detectPromptType, extractAssets } from '../controllers/aiDetection.controller';

const router = Router();

// AI-based prompt detection
router.post('/detect', detectPromptType);

// Extract ONLY 3D asset phrases
router.post('/extract-assets', extractAssets);

export default router;

