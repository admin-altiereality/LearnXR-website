import { Router } from 'express';
import {
  getSkyboxStyles,
  generateSkybox,
  getGenerationStatus,
  healthCheck,
  clearCache,
  getSkyboxStylesLegacy,
  generateSkyboxLegacy
} from '../controllers/skybox.controller';
import { verifyFirebaseToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/styles', getSkyboxStyles);
router.get('/health', healthCheck);
router.get('/getSkyboxStyles', getSkyboxStylesLegacy);

router.use(verifyFirebaseToken);
router.post('/generate', generateSkybox);
router.get('/status/:generationId', getGenerationStatus);
router.delete('/cache', clearCache);
router.post('/generateSkybox', generateSkyboxLegacy);

export default router; 