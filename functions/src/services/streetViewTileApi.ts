/**
 * Official Google Maps Tile API — Street View Tiles.
 * https://developers.google.com/maps/documentation/tile/streetview
 *
 * Provides session-token lifecycle, panoId search, metadata (incl. `links`
 * to adjacent real-world panoramas), tile fetch, and equirectangular stitch —
 * used to power the Street View Tour authoring "walk" experience. Distinct
 * from `streetViewImagery.ts`, which stitches the older Street View *Static*
 * API for the unrelated curriculum Chapter Editor skybox flow.
 */

import axios from 'axios';
import sharp from 'sharp';
import * as admin from 'firebase-admin';

const TILE_API_BASE = 'https://tile.googleapis.com/v1';
const SESSION_CONFIG_DOC = 'streetview_tile_session';
const PANORAMA_CACHE_COLLECTION = 'streetview_panorama_cache';

export interface TileSession {
  token: string;
  expiryMs: number;
  tileWidth: number;
  tileHeight: number;
}

export interface PanoramaLink {
  panoId: string;
  heading: number;
  text?: string;
}

export interface PanoramaMetadata {
  panoId: string;
  lat: number;
  lng: number;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  heading: number;
  tilt: number;
  roll: number;
  copyright?: string;
  date?: string;
  links: PanoramaLink[];
}

export type TileZoomLevel = 2 | 3 | 4;

let memorySession: TileSession | null = null;

function assertApiKey(apiKey: string): void {
  if (!apiKey) {
    const err: any = new Error('Google Street View API key is not configured on the server');
    err.code = 'API_KEY_MISSING';
    throw err;
  }
}

function translateTileApiError(status: number, body: any): Error {
  const errMessage = body?.error?.message || body?.error_description || '';
  const errStatus = body?.error?.status || '';
  if (status === 403 || errStatus === 'PERMISSION_DENIED') {
    return new Error(
      'Street View Tile API request denied. Confirm the "Map Tiles API" is enabled for this API key\'s Google Cloud project.'
    );
  }
  if (status === 404 || errStatus === 'NOT_FOUND') {
    return new Error('No Street View imagery available for this location/panorama');
  }
  if (status === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
    return new Error('Street View Tile API quota exceeded. Try again later.');
  }
  return new Error(`Street View Tile API error (${status}): ${errMessage || 'unknown error'}`);
}

async function requestJson(url: string, opts: { method: 'GET' | 'POST'; body?: unknown }): Promise<any> {
  const res = await axios.request({
    url,
    method: opts.method,
    data: opts.body,
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    validateStatus: () => true,
  });
  if (res.status !== 200) {
    throw translateTileApiError(res.status, res.data);
  }
  return res.data;
}

/** Creates (or reuses a cached, still-valid) Map Tiles API session token for `mapType: streetview`. */
export async function getTileSession(apiKey: string): Promise<TileSession> {
  assertApiKey(apiKey);
  const now = Date.now();
  const SAFETY_MARGIN_MS = 60 * 60 * 1000; // refresh an hour before expiry

  if (memorySession && memorySession.expiryMs - SAFETY_MARGIN_MS > now) {
    return memorySession;
  }

  const db = admin.firestore();
  const configRef = db.collection('_config').doc(SESSION_CONFIG_DOC);
  const snap = await configRef.get();
  const cached = snap.exists ? (snap.data() as any) : null;
  if (cached?.token && typeof cached.expiryMs === 'number' && cached.expiryMs - SAFETY_MARGIN_MS > now) {
    memorySession = {
      token: cached.token,
      expiryMs: cached.expiryMs,
      tileWidth: cached.tileWidth || 512,
      tileHeight: cached.tileHeight || 512,
    };
    return memorySession;
  }

  const data = await requestJson(`${TILE_API_BASE}/createSession?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body: { mapType: 'streetview', language: 'en-US', region: 'US' },
  });

  const expiryMs = Number(data.expiry) * 1000 || now + 13 * 24 * 60 * 60 * 1000; // ~2 weeks fallback
  const session: TileSession = {
    token: data.session,
    expiryMs,
    tileWidth: data.tileWidth || 512,
    tileHeight: data.tileHeight || 512,
  };
  memorySession = session;
  await configRef.set({ ...session, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return session;
}

/** Resolves the nearest panoId for a lat/lng (radius in meters). Returns null if no imagery nearby. */
export async function searchPanoId(
  apiKey: string,
  session: TileSession,
  lat: number,
  lng: number,
  radius = 50
): Promise<string | null> {
  const data = await requestJson(
    `${TILE_API_BASE}/streetview/panoIds?session=${encodeURIComponent(session.token)}&key=${encodeURIComponent(apiKey)}`,
    { method: 'POST', body: { locations: [{ lat, lng }], radius } }
  );
  const panoId = Array.isArray(data?.panoIds) ? data.panoIds[0] : '';
  return panoId ? String(panoId) : null;
}

/** Fetches metadata (address, orientation, and `links` to adjacent panoramas) for a panoId or lat/lng. */
export async function getPanoramaMetadata(
  apiKey: string,
  session: TileSession,
  params: { panoId?: string; lat?: number; lng?: number; radius?: number }
): Promise<PanoramaMetadata> {
  const q = new URLSearchParams({ session: session.token, key: apiKey });
  if (params.panoId) {
    q.set('panoId', params.panoId);
  } else if (typeof params.lat === 'number' && typeof params.lng === 'number') {
    q.set('lat', String(params.lat));
    q.set('lng', String(params.lng));
    q.set('radius', String(params.radius ?? 50));
  } else {
    throw new Error('Provide either a panorama ID or a valid lat/lng location.');
  }

  const data = await requestJson(`${TILE_API_BASE}/streetview/metadata?${q.toString()}`, { method: 'GET' });

  return {
    panoId: String(data.panoId),
    lat: Number(data.lat),
    lng: Number(data.lng),
    imageWidth: Number(data.imageWidth),
    imageHeight: Number(data.imageHeight),
    tileWidth: Number(data.tileWidth) || session.tileWidth,
    tileHeight: Number(data.tileHeight) || session.tileHeight,
    heading: Number(data.heading) || 0,
    tilt: Number(data.tilt) || 90,
    roll: Number(data.roll) || 0,
    copyright: data.copyright || undefined,
    date: data.date || undefined,
    links: Array.isArray(data.links)
      ? data.links.map((l: any) => ({
          panoId: String(l.panoId),
          heading: Number(l.heading) || 0,
          text: l.text || undefined,
        }))
      : [],
  };
}

async function fetchTileBuffer(apiKey: string, session: TileSession, panoId: string, z: number, x: number, y: number): Promise<Buffer> {
  const url = `${TILE_API_BASE}/streetview/tiles/${z}/${x}/${y}?session=${encodeURIComponent(session.token)}&key=${encodeURIComponent(apiKey)}&panoId=${encodeURIComponent(panoId)}`;
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'LearnXR-StreetViewTour/1.0' },
    validateStatus: () => true,
  });
  const contentType = (res.headers['content-type'] || '').toString().toLowerCase();
  if (res.status !== 200 || !contentType.startsWith('image/')) {
    let body: any = null;
    try {
      body = JSON.parse(Buffer.from(res.data as ArrayBuffer).toString('utf8'));
    } catch {
      // non-JSON error body; ignore
    }
    throw translateTileApiError(res.status, body);
  }
  return Buffer.from(res.data as ArrayBuffer);
}

/** Zoom level -> approximate horizontal field of view, per the Tile API docs. */
export const ZOOM_FOV_DEGREES: Record<TileZoomLevel, number> = { 2: 90, 3: 45, 4: 22.5 };

/** Concurrency-limited tile fetch + equirectangular stitch for one panorama at the requested zoom level. */
export async function stitchPanoramaAtZoom(
  apiKey: string,
  session: TileSession,
  metadata: PanoramaMetadata,
  zoom: TileZoomLevel
): Promise<Buffer> {
  const scale = Math.pow(2, 5 - zoom);
  const effWidth = Math.max(1, Math.round(metadata.imageWidth / scale));
  const effHeight = Math.max(1, Math.round(metadata.imageHeight / scale));
  const cols = Math.max(1, Math.ceil(effWidth / metadata.tileWidth));
  const rows = Math.max(1, Math.ceil(effHeight / metadata.tileHeight));

  const coords: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) coords.push({ x, y });
  }

  const CONCURRENCY = 6;
  const tiles = new Map<string, Buffer>();
  for (let i = 0; i < coords.length; i += CONCURRENCY) {
    const batch = coords.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(({ x, y }) => fetchTileBuffer(apiKey, session, metadata.panoId, zoom, x, y))
    );
    batch.forEach((c, idx) => tiles.set(`${c.x},${c.y}`, results[idx]));
  }

  const canvas = sharp({
    create: {
      width: cols * metadata.tileWidth,
      height: rows * metadata.tileHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  }).composite(
    coords.map(({ x, y }) => ({
      input: tiles.get(`${x},${y}`)!,
      left: x * metadata.tileWidth,
      top: y * metadata.tileHeight,
    }))
  );

  return canvas.extract({ left: 0, top: 0, width: effWidth, height: effHeight }).jpeg({ quality: 85 }).toBuffer();
}

export interface CachedPanorama {
  panoId: string;
  metadata: PanoramaMetadata;
  skyboxUrls: Partial<Record<TileZoomLevel, string>>;
}

/**
 * Returns a stitched skybox URL for `panoId` at `zoom`, using (and populating) the
 * `streetview_panorama_cache/{panoId}` Admin-SDK-only cache so repeated visits to the
 * same real-world panorama (across drafts/classes) don't re-fetch/re-stitch tiles.
 */
export async function getOrStitchPanorama(
  apiKey: string,
  session: TileSession,
  panoId: string,
  zoom: TileZoomLevel,
  metadataHint?: PanoramaMetadata
): Promise<CachedPanorama> {
  const db = admin.firestore();
  const cacheRef = db.collection(PANORAMA_CACHE_COLLECTION).doc(panoId);
  const cacheSnap = await cacheRef.get();
  const cached = cacheSnap.exists ? (cacheSnap.data() as CachedPanorama) : null;

  const metadata = cached?.metadata || metadataHint || (await getPanoramaMetadata(apiKey, session, { panoId }));
  const existingUrl = cached?.skyboxUrls?.[zoom];
  if (existingUrl) {
    return { panoId, metadata, skyboxUrls: cached!.skyboxUrls };
  }

  const buffer = await stitchPanoramaAtZoom(apiKey, session, metadata, zoom);
  const bucket = admin.storage().bucket();
  const storagePath = `streetview_panoramas/${panoId}/zoom${zoom}.jpg`;
  const file = bucket.file(storagePath);
  await file.save(buffer, { contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000' } });
  await file.makePublic();
  const skyboxUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  const skyboxUrls = { ...(cached?.skyboxUrls || {}), [zoom]: skyboxUrl };
  await cacheRef.set(
    { panoId, metadata, skyboxUrls, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { panoId, metadata, skyboxUrls };
}
