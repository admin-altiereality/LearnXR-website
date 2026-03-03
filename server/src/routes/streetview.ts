/**
 * Google Street View → skybox proxy.
 * POST /generate-skybox: fetch Street View tiles, stitch to equirectangular, upload to Storage, persist to Firestore.
 */

import express from 'express';
import { generateStreetViewSkybox } from '../services/streetViewSkyboxService';

const router = express.Router();

router.post('/generate-skybox', express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const {
      location,
      placeId,
      heading,
      pitch,
      fov,
      size,
      chapterId,
      topicId,
      userId,
    } = body;

    if (!chapterId || !topicId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'chapterId and topicId are required',
      });
    }

    const result = await generateStreetViewSkybox({
      location:
        location && typeof location.lat === 'number' && typeof location.lng === 'number'
          ? { lat: location.lat, lng: location.lng }
          : undefined,
      placeId: typeof placeId === 'string' ? placeId : undefined,
      heading: typeof heading === 'number' ? heading : undefined,
      pitch: typeof pitch === 'number' ? pitch : undefined,
      fov: typeof fov === 'number' ? fov : undefined,
      size: typeof size === 'string' ? size : undefined,
      chapterId: String(chapterId),
      topicId: String(topicId),
      userId: typeof userId === 'string' ? userId : undefined,
    });

    if (result.success) {
      return res.json({
        success: true,
        skyboxId: result.skyboxId,
        imageUrl: result.imageUrl,
      });
    }

    const code = result.code ?? 500;
    return res.status(code).json({
      success: false,
      error: result.error,
    });
  } catch (err) {
    console.error('[streetview/generate-skybox]', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Street View skybox generation failed',
    });
  }
});

export default router;
