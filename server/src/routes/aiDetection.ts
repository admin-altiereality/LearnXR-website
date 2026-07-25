import { Router } from 'express';
import { detectPromptType, extractAssets } from '../controllers/aiDetection.controller';
import { verifyFirebaseToken } from '../middleware/authMiddleware';

const router = Router();

router.use(verifyFirebaseToken);
router.post('/detect', detectPromptType);
router.post('/extract-assets', extractAssets);

export default router;

