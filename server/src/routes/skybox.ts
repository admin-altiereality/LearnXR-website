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

const router = Router();

// Modern API endpoints
router.get('/styles', getSkyboxStyles);
router.post('/generate', generateSkybox);
router.get('/status/:generationId', getGenerationStatus);
router.get('/health', healthCheck);
router.delete('/cache', clearCache);

// Legacy endpoints for backward compatibility
router.get('/getSkyboxStyles', getSkyboxStylesLegacy);
router.post('/generateSkybox', generateSkyboxLegacy);

export default router; 