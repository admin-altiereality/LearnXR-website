import { Request, Response, Router } from 'express';
import * as admin from 'firebase-admin';
import { initializeAdmin } from '../utils/services';

const router = Router();

const renderAssetRegex = /^\/(?:api\/)?render-asset\/([^/]+)\/([^/]+)\/(model|animated_model)\.glb\/?$/;
const renderAssetExtract = /render-asset\/([^/]+)\/([^/]+)\/(model|animated_model)\.glb/;

function setRenderCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin ? String(req.headers.origin) : '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
  res.setHeader('Access-Control-Max-Age', '3600');
}

function parseRenderAssetPath(req: Request): { assetId: string; token: string; fileBase: string } | null {
  const pathStr = req.path || (req as any).originalPath || req.url || '';
  const match = pathStr.match(renderAssetExtract);
  if (!match) return null;
  return {
    assetId: decodeURIComponent(match[1]),
    token: decodeURIComponent(match[2]),
    fileBase: match[3],
  };
}

function parseByteRange(rangeHeader: string | undefined, fileSize: number): { start: number; end: number } | 'invalid' | null {
  if (!rangeHeader) return null;
  const match = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
  if (!match || !Number.isFinite(fileSize) || fileSize <= 0) return 'invalid';

  const [, rawStart, rawEnd] = match;
  let start: number;
  let end: number;

  if (rawStart === '' && rawEnd === '') return 'invalid';
  if (rawStart === '') {
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return 'invalid';
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? fileSize - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
    return 'invalid';
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

router.options(renderAssetRegex, (req: Request, res: Response) => {
  setRenderCorsHeaders(req, res);
  res.status(204).send();
});

router.get(renderAssetRegex, async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  setRenderCorsHeaders(req, res);

  try {
    initializeAdmin();
    const parsed = parseRenderAssetPath(req);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid render asset URL', requestId });
      return;
    }

    const db = admin.firestore();
    const assetSnap = await db.collection('meshy_assets').doc(parsed.assetId).get();
    if (!assetSnap.exists) {
      res.status(404).json({ error: 'Asset not found', requestId });
      return;
    }

    const asset = assetSnap.data() || {};
    const isAnimated = parsed.fileBase === 'animated_model';
    const expectedToken = isAnimated
      ? String(asset.animated_render_token || asset.render_token || '')
      : String(asset.render_token || '');

    if (!expectedToken || parsed.token !== expectedToken) {
      res.status(403).json({ error: 'Invalid asset token', requestId });
      return;
    }

    const storagePath = isAnimated
      ? String(asset.animated_storage_path || asset.storage_paths?.animated_glb || '')
      : String(asset.storage_path || asset.storagePath || asset.storage_paths?.glb || '');

    if (!storagePath) {
      res.status(404).json({ error: 'Asset storage path not registered', requestId });
      return;
    }

    const bucketName = asset.storage_bucket ? String(asset.storage_bucket) : undefined;
    const bucket = bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: 'Asset file not found', requestId });
      return;
    }

    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    const byteRange = parseByteRange(req.headers.range, fileSize);
    if (byteRange === 'invalid') {
      if (fileSize > 0) res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    if (byteRange) {
      const chunkLength = byteRange.end - byteRange.start + 1;
      res.status(206);
      res.setHeader('Content-Length', String(chunkLength));
      res.setHeader('Content-Range', `bytes ${byteRange.start}-${byteRange.end}/${fileSize}`);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = file.createReadStream({ start: byteRange.start, end: byteRange.end });
      stream.on('error', (error: Error) => {
        console.error(`[${requestId}] Render asset range stream error:`, error.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to stream asset', requestId });
        } else {
          res.destroy(error);
        }
      });
      stream.pipe(res);
      return;
    }

    if (fileSize > 0) {
      res.setHeader('Content-Length', String(fileSize));
    }
    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    const stream = file.createReadStream();
    stream.on('error', (error: Error) => {
      console.error(`[${requestId}] Render asset stream error:`, error.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to stream asset', requestId });
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
    return;
  } catch (error: any) {
    console.error(`[${requestId}] Render asset error:`, error?.message || error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to render asset', requestId });
    }
    return;
  }
});

export default router;
