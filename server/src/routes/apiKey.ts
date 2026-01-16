/**
 * API Key Routes
 * Developer Portal API key management endpoints
 */

import express from 'express';
import { verifyFirebaseToken } from '../middleware/authMiddleware';
import {
  handleCreateApiKey,
  handleListApiKeys,
  handleRevokeApiKey,
  handleRegenerateApiKey
} from '../controllers/apiKey.controller';

const router = express.Router();

console.log('API Key routes being initialized...');

// All routes require Firebase authentication
router.use(verifyFirebaseToken);

/**
 * POST /api/dev/api-keys
 * Create a new API key
 */
router.post('/', handleCreateApiKey);

/**
 * GET /api/dev/api-keys
 * List all API keys for the user
 */
router.get('/', handleListApiKeys);

/**
 * POST /api/dev/api-keys/:id/revoke
 * Revoke a specific API key
 */
router.post('/:id/revoke', handleRevokeApiKey);

/**
 * POST /api/dev/api-keys/:id/regenerate
 * Regenerate a specific API key
 */
router.post('/:id/regenerate', handleRegenerateApiKey);

console.log('API Key routes initialized with endpoints:');
console.log('- POST   /api/dev/api-keys');
console.log('- GET    /api/dev/api-keys');
console.log('- POST   /api/dev/api-keys/:id/revoke');
console.log('- POST   /api/dev/api-keys/:id/regenerate');

export default router;
