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

function getAssetStoragePath(asset: any, isAnimated: boolean): string {
  if (isAnimated) {
    return String(
      asset.animated_storage_path ||
      asset.storage_paths?.animated_glb ||
      asset.storage_path ||
      asset.storagePath ||
      asset.storage_paths?.glb ||
      ''
    );
  }
  return String(asset.storage_path || asset.storagePath || asset.storage_paths?.glb || '');
}

function isReplacedAsset(asset: any): boolean {
  return Boolean(
    asset?.active === false ||
    asset?.status === 'replaced' ||
    asset?.replaced_by_meshy_asset_id ||
    (asset?.asset_repair_status === 'regenerated' && asset?.replaced_by_meshy_asset_id)
  );
}

async function resolveRenderableAsset(asset: any, isAnimated: boolean): Promise<any> {
  if (!isReplacedAsset(asset) || !asset?.replaced_by_meshy_asset_id) {
    return asset;
  }

  try {
    const replacementSnap = await admin
      .firestore()
      .collection('meshy_assets')
      .doc(String(asset.replaced_by_meshy_asset_id))
      .get();

    if (!replacementSnap.exists) {
      return asset;
    }

    const replacement = replacementSnap.data() || {};
    const replacementStoragePath = getAssetStoragePath(replacement, isAnimated);
    if (!replacementStoragePath || isReplacedAsset(replacement)) {
      return asset;
    }

    return replacement;
  } catch (error: any) {
    console.warn('Failed to resolve replacement render asset:', error?.message || error);
    return asset;
  }
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

    const renderableAsset = await resolveRenderableAsset(asset, isAnimated);
    const storagePath = getAssetStoragePath(renderableAsset, isAnimated);

    if (!storagePath) {
      res.status(404).json({ error: 'Asset storage path not registered', requestId });
      return;
    }

    const bucketName = renderableAsset.storage_bucket ? String(renderableAsset.storage_bucket) : undefined;
    const bucket = bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: 'Asset file not found', requestId });
      return;
    }

    // Redirect to a short-lived signed URL instead of streaming the file through this
    // Cloud Function. Cloud Functions (2nd gen) hard-caps HTTP responses at 32MB, which
    // silently breaks any GLB larger than that (common for HD-texture Meshy exports).
    // The browser downloads directly from Cloud Storage, which has no such limit.
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    res.redirect(302, signedUrl);
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
