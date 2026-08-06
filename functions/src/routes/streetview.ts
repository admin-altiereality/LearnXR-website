/**
 * Google Street View → skybox proxy for Firebase Functions.
 * POST /streetview/generate-skybox: fetch Street View tiles, stitch into equirectangular,
 * upload to Storage, persist to Firestore, and return { skyboxId, imageUrl }.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as admin from 'firebase-admin';
import { fetchAndStitchStreetView, TILE_SIZE } from '../services/streetViewImagery';

const router = Router();

const PLACES_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

interface StreetViewSkyboxParams {
  location?: { lat: number; lng: number };
  panoId?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  size?: string;
  chapterId: string;
  topicId: string;
}

router.post('/generate-skybox', async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const body = (req.body || {}) as Partial<StreetViewSkyboxParams>;

  try {
    const apiKey = (process.env.GOOGLE_STREETVIEW_API_KEY || '').trim();
    if (!apiKey) {
      console.error(`[${requestId}] Street View API key not configured`);
      return res.status(503).json({
        success: false,
        error: 'Google Street View API key is not configured on the server',
      });
    }

    // Accept panoId from either camelCase or snake_case (some clients/proxies may send either)
    const panoId = (body.panoId ?? (body as any).pano_id ?? '').toString().trim();
    const lat = body.location?.lat;
    const lng = body.location?.lng;

    const hasValidLocation =
      typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    if (panoId) {
      // Panorama ID provided: no location required
    } else if (hasValidLocation) {
      // Valid lat/lng provided
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide either a panorama ID (pano) or a valid location (latitude and longitude).',
      });
    }

    const chapterId = body.chapterId;
    const topicId = body.topicId;
    if (!chapterId || !topicId) {
      return res.status(400).json({
        success: false,
        error: 'chapterId and topicId are required',
      });
    }

    const heading = body.heading ?? 0;
    const pitch = body.pitch ?? 0;
    const fov = body.fov ?? 90;
    const size = body.size || `${TILE_SIZE}x${TILE_SIZE}`;

    const mode = panoId ? 'pano' : 'location';

    console.log(`[${requestId}] Fetching Street View tiles for`, {
      mode,
      lat,
      lng,
      panoId: panoId || undefined,
      heading,
      pitch,
      fov,
      size,
    });

    const equirectBuffer = await fetchAndStitchStreetView({
      apiKey,
      location: hasValidLocation ? { lat: lat as number, lng: lng as number } : undefined,
      panoId: panoId || undefined,
      heading,
      pitch,
      fov,
      size,
    });

    const hashInput = `${panoId || `${lat},${lng}`}|${heading}|${pitch}|${fov}|${size}`;
    const cryptoHash = require('crypto').createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
    const fileName = `streetview_${cryptoHash}_${Date.now()}.jpg`;
    const storagePath = `skyboxes/${chapterId}/${topicId}/${fileName}`;

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(equirectBuffer, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await file.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const skyboxId = `streetview_${cryptoHash}_${Date.now()}`;

    const db = admin.firestore();

    // Upsert skybox_glb_urls
    const skyboxGlbRef = db.collection('skybox_glb_urls');
    const existingQuery = await skyboxGlbRef
      .where('chapter_id', '==', chapterId)
      .where('topic_id', '==', topicId)
      .limit(1)
      .get();

    const skyboxPayload = {
      chapter_id: chapterId,
      topic_id: topicId,
      skybox_id: skyboxId,
      glb_url: imageUrl,
      preview_url: imageUrl,
      prompt_used: 'Google Street View',
      status: 'complete',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!existingQuery.empty) {
      await existingQuery.docs[0].ref.update(skyboxPayload);
    } else {
      await skyboxGlbRef.add({
        ...skyboxPayload,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Update curriculum_chapters topic entry
    const chapterRef = db.collection('curriculum_chapters').doc(chapterId);
    const chapterSnap = await chapterRef.get();
    if (chapterSnap.exists) {
      const data = chapterSnap.data();
      const topics = Array.isArray(data?.topics) ? [...data.topics] : [];
      const topicIndex = topics.findIndex((t: { topic_id?: string }) => t.topic_id === topicId);
      if (topicIndex !== -1) {
        const topic = topics[topicIndex];
        const currentSkyboxIds = (topic as { skybox_ids?: string[] }).skybox_ids || [];
        const updatedSkyboxIds = currentSkyboxIds.includes(skyboxId)
          ? currentSkyboxIds
          : [...currentSkyboxIds, skyboxId];
        topics[topicIndex] = {
          ...topic,
          sharedAssets: {
            ...(topic as { sharedAssets?: Record<string, unknown> }).sharedAssets,
            skybox_id: skyboxId,
          },
          skybox_id: skyboxId,
          skybox_ids: updatedSkyboxIds,
          skybox_url: imageUrl,
          skybox_glb_url: imageUrl,
        };
        await chapterRef.update({
          topics,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`[${requestId}] Street View skybox generated`, { chapterId, topicId, skyboxId, panoId: panoId || undefined });

    return res.json({
      success: true,
      skyboxId,
      imageUrl,
    });
  } catch (err: any) {
    console.error('[streetview/generate-skybox] Error:', err?.message || err, {
      requestId,
      // Basic context only; avoid logging URLs with API keys
      hasPanoId: !!(req.body as any)?.panoId || !!(req.body as any)?.pano_id,
      hasLocation: !!(req.body as any)?.location,
    });
    const message =
      typeof err?.message === 'string' ? err.message : 'Street View skybox generation failed';
    if (message.includes('No Street View')) {
      return res.status(404).json({
        success: false,
        error: 'No Street View imagery available for this location/panorama',
      });
    }
    if (message.includes('quota') || message.includes('429')) {
      return res.status(429).json({
        success: false,
        error: 'Street View API quota exceeded. Try again later.',
      });
    }
    if (message.includes('API key') || message.includes('request denied')) {
      return res.status(503).json({
        success: false,
        error: 'Street View API key invalid or request denied. Check server configuration.',
      });
    }
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/**
 * Places Autocomplete proxy — returns general place suggestions (any Street View).
 */
router.get('/places-autocomplete', async (req: Request, res: Response) => {
  try {
    const input = (req.query.input || '').toString().trim();
    const apiKey = (process.env.GOOGLE_STREETVIEW_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Google Street View / Places API key is not configured on the server',
      });
    }
    if (!input || input.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Input must be at least 2 characters',
      });
    }

    const url = `${PLACES_AUTOCOMPLETE_URL}?input=${encodeURIComponent(input)}&key=${encodeURIComponent(apiKey)}`;
    const response = await axios.get(url, { validateStatus: () => true });
    const data = response.data || {};

    if (data.status === 'REQUEST_DENIED') {
      return res.status(503).json({
        success: false,
        error: 'Places Autocomplete is not authorized for this API key',
      });
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      return res.status(429).json({
        success: false,
        error: 'Places Autocomplete quota exceeded. Try again later.',
      });
    }

    const predictions = Array.isArray(data.predictions)
      ? data.predictions.map((p: any) => ({
          place_id: p.place_id,
          description: p.description,
        }))
      : [];

    return res.json({
      success: true,
      predictions,
    });
  } catch (err: any) {
    console.error('[streetview/places-autocomplete] Error:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch place suggestions',
    });
  }
});

/**
 * Place Details proxy — returns geometry for any place (no walkable/rating gate).
 */
router.get('/place-details', async (req: Request, res: Response) => {
  try {
    const placeId = (req.query.place_id || '').toString().trim();
    const apiKey = (process.env.GOOGLE_STREETVIEW_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Google Places API key is not configured on the server',
      });
    }
    if (!placeId) {
      return res.status(400).json({
        success: false,
        error: 'place_id is required',
      });
    }

    const url = `${PLACE_DETAILS_URL}?placeid=${encodeURIComponent(
      placeId
    )}&fields=geometry,formatted_address&key=${encodeURIComponent(apiKey)}`;
    const response = await axios.get(url, { validateStatus: () => true });
    const data = response.data || {};

    if (data.status === 'REQUEST_DENIED') {
      return res.status(503).json({
        success: false,
        error: 'Place Details is not authorized for this API key',
      });
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      return res.status(429).json({
        success: false,
        error: 'Place Details quota exceeded. Try again later.',
      });
    }
    if (data.status !== 'OK' || !data.result || !data.result.geometry || !data.result.geometry.location) {
      return res.status(404).json({
        success: false,
        error: 'Place not found or has no geometry',
      });
    }

    const loc = data.result.geometry.location;
    const lat = typeof loc.lat === 'number' ? loc.lat : parseFloat(loc.lat);
    const lng = typeof loc.lng === 'number' ? loc.lng : parseFloat(loc.lng);

    return res.json({
      success: true,
      lat,
      lng,
      formatted_address: data.result.formatted_address || '',
    });
  } catch (err: any) {
    console.error('[streetview/place-details] Error:', err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch place details',
    });
  }
});

export default router;

