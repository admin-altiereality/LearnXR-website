import { Router } from 'express';
import { detectPromptType } from '../controllers/aiDetection.controller';

const router = Router();

// AI-based prompt detection
router.post('/detect', detectPromptType);

export default router;

