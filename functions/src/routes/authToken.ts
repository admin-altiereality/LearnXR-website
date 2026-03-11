/**
 * Auth token exchange for standalone VR player and studio (WebView).
 * GET /auth/custom-token: verifies idToken (Bearer or query) and returns customToken
 * so the web client can signInWithCustomToken() and use Firestore.
 *
 * Deploy target: This API must be deployed to the same Firebase project that issues
 * the idToken. The Flutter app uses learnxr-evoneuralai (google-services.json);
 * ApiConfig.baseUrl points to us-central1-learnxr-evoneuralai.cloudfunctions.net.
 * So deploy functions to learnxr-evoneuralai when using that app (firebase use learnxr-evoneuralai).
 */

import express, { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdmin } from '../utils/services';

const router = express.Router();

/** Decode JWT payload without verifying (for diagnostic logging only). Do not log the raw token. */
export function decodeJwtPayloadUnsafe(idToken: string): { exp?: number; iss?: string; aud?: string } | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return { exp: decoded.exp, iss: decoded.iss, aud: decoded.aud };
  } catch {
    return null;
  }
}

/**
 * GET /auth/custom-token
 * Authorization: Bearer <idToken>
 * Or query: ?idToken=...
 * Returns: { customToken: string }
 */
router.get('/custom-token', async (req: Request, res: Response) => {
  let idToken: string | undefined =
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined) ||
    (typeof req.query.idToken === 'string' ? req.query.idToken.trim() : undefined);
  try {
    initializeAdmin();
    const auth = getAuth();
    if (!idToken) {
      res.status(400).json({ error: 'Missing idToken: use Authorization: Bearer <idToken> or ?idToken=...' });
      return;
    }
    const decoded = await auth.verifyIdToken(idToken);
    const customToken = await auth.createCustomToken(decoded.uid);
    res.json({ customToken });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as any)?.code || (e as any)?.errorInfo?.code || 'unknown';
    console.warn('[auth/custom-token GET]', code, msg);
    const payload = idToken ? decodeJwtPayloadUnsafe(idToken) : null;
    const now = Math.floor(Date.now() / 1000);
    if (payload) {
      console.warn('[auth/custom-token GET] decode (unverified):', {
        exp: payload.exp,
        iss: payload.iss,
        aud: payload.aud,
        now,
        expired: payload.exp != null ? payload.exp < now : 'unknown',
      });
    }

    let serverProject = 'unknown';
    try {
      serverProject = process.env.GCLOUD_PROJECT
        || (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : 'unknown');
    } catch { /* ignore */ }

    res.status(401).json({
      error: 'Invalid or expired idToken',
      detail: msg,
      code,
      serverProject,
      tokenInfo: payload ? {
        aud: payload.aud,
        iss: payload.iss,
        expired: payload.exp != null ? payload.exp < now : 'unknown',
      } : null,
    });
  }
});

export default router;
