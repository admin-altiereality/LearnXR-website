/**
 * Shared Google Street View imagery helpers: fetch tiles for 4 headings and
 * stitch them into a single equirectangular JPEG usable as a krpano skybox.
 * Used by both the curriculum-scoped `/streetview/generate-skybox` route and
 * the standalone user-generated-lesson flow.
 */

import axios from 'axios';
import sharp from 'sharp';

const STREET_VIEW_BASE = 'https://maps.googleapis.com/maps/api/streetview';
export const OUT_WIDTH = 4096;
export const OUT_HEIGHT = 2048;
export const TILE_SIZE = 1024;
export const NUM_HEADINGS = 4; // 0°, 90°, 180°, 270°

export function clampHeading(h: number): number {
  return Math.max(0, Math.min(360, Number(h)));
}

export function clampPitch(p: number): number {
  return Math.max(-90, Math.min(90, Number(p)));
}

export function clampFov(f: number): number {
  return Math.max(10, Math.min(120, Number(f)));
}

function buildStreetViewUrlByLocation(params: {
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
    format: 'jpg',
    return_error_code: 'true',
    key: params.key,
  });
  return `${STREET_VIEW_BASE}?${q.toString()}`;
}

function buildStreetViewUrlByPano(params: {
  panoId: string;
  heading: number;
  pitch: number;
  fov: number;
  size: string;
  key: string;
}): string {
  const q = new URLSearchParams({
    size: params.size,
    pano: params.panoId,
    heading: String(params.heading),
    pitch: String(params.pitch),
    fov: String(params.fov),
    format: 'jpg',
    return_error_code: 'true',
    key: params.key,
  });
  return `${STREET_VIEW_BASE}?${q.toString()}`;
}

export async function fetchTile(url: string): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'LearnXR-Skybox/1.0' },
    validateStatus: () => true,
  });

  const contentType = (res.headers['content-type'] || '').toString().toLowerCase();

  if (res.status !== 200 || !res.data || !contentType.startsWith('image/')) {
    let text = '';
    try {
      text = Buffer.from(res.data as ArrayBuffer).toString('utf8');
    } catch {
      // ignore decode errors
    }
    if (res.status === 403 || text.includes('REQUEST_DENIED')) {
      throw new Error('Street View API key invalid or request denied');
    }
    if (res.status === 404 || text.includes('ZERO_RESULTS') || text.includes('not found')) {
      throw new Error('No Street View imagery available for this location/panorama');
    }
    if (res.status === 429 || text.includes('OVER_QUERY_LIMIT') || text.includes('quota')) {
      throw new Error('Street View API quota exceeded. Try again later.');
    }
    throw new Error(`Street View API error: ${res.status}`);
  }

  if (!contentType.startsWith('image/jpeg')) {
    throw new Error(`Street View returned unsupported image type: ${contentType || 'unknown'}`);
  }

  return Buffer.from(res.data as ArrayBuffer);
}

export async function stitchTiles(tileBuffers: Buffer[]): Promise<Buffer> {
  if (tileBuffers.length !== NUM_HEADINGS) {
    throw new Error(`Expected ${NUM_HEADINGS} tiles, got ${tileBuffers.length}`);
  }
  const tileW = OUT_WIDTH / NUM_HEADINGS; // 1024
  const strips: Buffer[] = [];
  for (let i = 0; i < NUM_HEADINGS; i++) {
    try {
      const resized = await sharp(tileBuffers[i])
        .resize(Math.round(tileW), TILE_SIZE)
        .toBuffer();
      strips.push(resized);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('input buffer contains unsupported image format')) {
        throw new Error(
          'Street View tile image format not supported by server. Check Street View Static API configuration (format=jpg) and API key project.'
        );
      }
      throw err;
    }
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

  return sharp(stripComposite).resize(OUT_WIDTH, OUT_HEIGHT).jpeg({ quality: 85 }).toBuffer();
}

export interface FetchAndStitchParams {
  apiKey: string;
  location?: { lat: number; lng: number };
  panoId?: string;
  heading?: number;
  pitch?: number;
  fov?: number;
  size?: string;
}

/** Fetches the 4 heading tiles and stitches them into a single equirectangular JPEG buffer. */
export async function fetchAndStitchStreetView(params: FetchAndStitchParams): Promise<Buffer> {
  const heading = clampHeading(params.heading ?? 0);
  const pitch = clampPitch(params.pitch ?? 0);
  const fov = clampFov(params.fov ?? 90);
  const size = params.size || `${TILE_SIZE}x${TILE_SIZE}`;
  const headings = [0, 90, 180, 270].map((h) => (h + heading) % 360);

  const urls = headings.map((h) =>
    params.panoId
      ? buildStreetViewUrlByPano({ panoId: params.panoId!, heading: h, pitch, fov, size, key: params.apiKey })
      : buildStreetViewUrlByLocation({
          lat: params.location!.lat,
          lng: params.location!.lng,
          heading: h,
          pitch,
          fov,
          size,
          key: params.apiKey,
        })
  );

  const tileBuffers = await Promise.all(urls.map((url) => fetchTile(url)));
  return stitchTiles(tileBuffers);
}
