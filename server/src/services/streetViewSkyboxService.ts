/**
 * Google Street View Static API → equirectangular skybox.
 * Fetches multiple tiles by heading, stitches into 2:1 image, uploads to Firebase Storage,
 * and optionally persists to skybox_glb_urls + curriculum_chapters.
 */

import { env } from '../config/env';
import { db, storage } from '../config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import sharp from 'sharp';
import crypto from 'crypto';

const STREET_VIEW_BASE = 'https://maps.googleapis.com/maps/api/streetview';
const OUT_WIDTH = 4096;
const OUT_HEIGHT = 2048;
const TILE_SIZE = 1024;
const NUM_HEADINGS = 4; // 0°, 90°, 180°, 270° → 360° coverage
const FOV_PER_TILE = 90;

export interface StreetViewSkyboxParams {
  location?: { lat: number; lng: number };
  placeId?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  size?: string;
  chapterId: string;
  topicId: string;
  userId?: string;
}

export interface StreetViewSkyboxResult {
  success: true;
  skyboxId: string;
  imageUrl: string;
}

export interface StreetViewSkyboxError {
  success: false;
  error: string;
  code?: number;
}

function clampHeading(h: number): number {
  return Math.max(0, Math.min(360, Number(h)));
}
function clampPitch(p: number): number {
  return Math.max(-90, Math.min(90, Number(p)));
}
function clampFov(f: number): number {
  return Math.max(10, Math.min(120, Number(f)));
}

function buildStreetViewUrl(params: {
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  fov: number;
  size: string;
  key: string;
}): string {
  const q = new URLSearchParams({
    size: params.size,
    location: `${params.lat},${params.lng}`,
    heading: String(params.heading),
    pitch: String(params.pitch),
    fov: String(params.fov),
    key: params.key,
  });
  return `${STREET_VIEW_BASE}?${q.toString()}`;
}

/**
 * Fetch a single tile from Google Street View Static API.
 */
async function fetchTile(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LearnXR-Skybox/1.0' },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403 || text.includes('REQUEST_DENIED')) {
      throw new Error('Street View API key invalid or request denied');
    }
    if (res.status === 404 || text.includes('ZERO_RESULTS') || text.includes('not found')) {
      throw new Error('No Street View imagery available for this location');
    }
    throw new Error(`Street View API error: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Stitch 4 tiles (headings 0, 90, 180, 270) into one equirectangular 4096x2048 image.
 * Each tile is 1024x1024 (90° FOV). Place them side by side, then stretch to 2:1.
 */
async function stitchTiles(tileBuffers: Buffer[]): Promise<Buffer> {
  if (tileBuffers.length !== NUM_HEADINGS) {
    throw new Error(`Expected ${NUM_HEADINGS} tiles, got ${tileBuffers.length}`);
  }
  const tileW = OUT_WIDTH / NUM_HEADINGS; // 1024
  const strips: Buffer[] = [];
  for (let i = 0; i < NUM_HEADINGS; i++) {
    const resized = await sharp(tileBuffers[i])
      .resize(Math.round(tileW), TILE_SIZE)
      .toBuffer();
    strips.push(resized);
  }
  const stripComposite = await sharp({
    create: {
      width: OUT_WIDTH,
      height: TILE_SIZE,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(
      strips.map((buf, i) => ({
        input: buf,
        left: Math.round(i * tileW),
        top: 0,
      }))
    )
    .toBuffer();
  const equirect = await sharp(stripComposite)
    .resize(OUT_WIDTH, OUT_HEIGHT)
    .jpeg({ quality: 85 })
    .toBuffer();
  return equirect;
}

/**
 * Generate cache/storage key from params to avoid re-fetching same panorama.
 */
function cacheKey(params: StreetViewSkyboxParams): string {
  const loc = params.location
    ? `${params.location.lat},${params.location.lng}`
    : `place:${params.placeId || ''}`;
  const h = params.heading ?? 0;
  const p = params.pitch ?? 0;
  const f = params.fov ?? 90;
  const s = params.size || `${TILE_SIZE}x${TILE_SIZE}`;
  return crypto.createHash('sha256').update(`${loc}|${h}|${p}|${f}|${s}`).digest('hex').slice(0, 16);
}

/**
 * Generate skybox from Google Street View: fetch tiles, stitch, upload to Storage, persist to Firestore.
 */
export async function generateStreetViewSkybox(
  params: StreetViewSkyboxParams
): Promise<StreetViewSkyboxResult | StreetViewSkyboxError> {
  const apiKey = (env.GOOGLE_STREETVIEW_API_KEY || process.env.GOOGLE_STREETVIEW_API_KEY || '').trim();
  if (!apiKey) {
    return { success: false, error: 'Google Street View API key is not configured', code: 503 };
  }

  const lat = params.location?.lat;
  const lng = params.location?.lng;
  const placeId = params.placeId?.trim();
  if (placeId) {
    // Resolve Place ID to lat/lng via Geocoding API (optional enhancement). For now require lat/lng.
    return { success: false, error: 'Place ID is not yet supported; please use latitude and longitude', code: 400 };
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { success: false, error: 'Valid location (lat, lng) is required', code: 400 };
  }

  const heading = clampHeading(params.heading ?? 0);
  const pitch = clampPitch(params.pitch ?? 0);
  const fov = clampFov(params.fov ?? 90);
  const size = params.size || `${TILE_SIZE}x${TILE_SIZE}`;

  if (!db || !storage) {
    return { success: false, error: 'Firebase (Firestore or Storage) not available', code: 503 };
  }

  try {
    const headings = [0, 90, 180, 270].map((h) => (h + heading) % 360);
    const urls = headings.map((h) =>
      buildStreetViewUrl({ lat, lng, heading: h, pitch, fov, size, key: apiKey })
    );
    const tileBuffers = await Promise.all(urls.map((url) => fetchTile(url)));
    const equirectBuffer = await stitchTiles(tileBuffers);

    const key = cacheKey(params);
    const fileName = `streetview_${key}_${Date.now()}.jpg`;
    const storagePath = `skyboxes/${params.chapterId}/${params.topicId}/${fileName}`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.save(equirectBuffer, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
    await file.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const skyboxId = `streetview_${key}_${Date.now()}`;

    // Persist to skybox_glb_urls and curriculum_chapters (same shape as upload flow)
    const skyboxGlbRef = db.collection('skybox_glb_urls');
    const existingQuery = await skyboxGlbRef
      .where('chapter_id', '==', params.chapterId)
      .where('topic_id', '==', params.topicId)
      .limit(1)
      .get();

    const skyboxPayload = {
      chapter_id: params.chapterId,
      topic_id: params.topicId,
      skybox_id: skyboxId,
      glb_url: imageUrl,
      preview_url: imageUrl,
      prompt_used: 'Google Street View',
      status: 'complete',
      updated_at: FieldValue.serverTimestamp(),
    };

    if (!existingQuery.empty) {
      await existingQuery.docs[0].ref.update(skyboxPayload);
    } else {
      await skyboxGlbRef.add({
        ...skyboxPayload,
        created_at: FieldValue.serverTimestamp(),
      });
    }

    const chapterRef = db.collection('curriculum_chapters').doc(params.chapterId);
    const chapterSnap = await chapterRef.get();
    if (chapterSnap.exists) {
      const data = chapterSnap.data();
      const topics = data && Array.isArray(data.topics) ? [...data.topics] : [];
      const topicIndex = topics.findIndex((t: { topic_id?: string }) => t.topic_id === params.topicId);
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
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return { success: true, skyboxId, imageUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Street View skybox generation failed';
    if (message.includes('No Street View') || message.includes('ZERO_RESULTS')) {
      return { success: false, error: 'No Street View imagery available for this location', code: 404 };
    }
    if (message.includes('quota') || message.includes('429')) {
      return { success: false, error: 'Street View API quota exceeded. Try again later.', code: 429 };
    }
    if (message.includes('REQUEST_DENIED') || message.includes('API key')) {
      return { success: false, error: 'Street View API key invalid or request denied', code: 503 };
    }
    console.error('[streetViewSkyboxService]', err);
    return { success: false, error: message, code: 500 };
  }
}
