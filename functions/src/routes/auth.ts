/**
 * Auth routes: custom token exchange for WebView (mobile app) sign-in.
 * Mobile app sends Firebase ID token; we verify and return a custom token
 * so the web app can sign in and load lesson data (Firestore requires auth).
 */

import express, { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdmin } from '../utils/services';
import { decodeJwtPayloadUnsafe } from './authToken';

const router = express.Router();

/**
 * POST /auth/custom-token
 * Body: { idToken: string } or Authorization: Bearer <idToken>
 * Returns: { customToken: string }
 * Verifies the ID token (from mobile app), then creates a custom token for that uid
 * so the web client can call signInWithCustomToken(customToken).
 */
router.post('/custom-token', async (req: Request, res: Response) => {
  let idToken: string | undefined =
    (req.body && typeof req.body.idToken === 'string' && req.body.idToken.trim()) ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined);
  try {
    initializeAdmin();
    const auth = getAuth();
    if (!idToken) {
      res.status(400).json({ error: 'Missing idToken in body or Authorization header' });
      return;
    }
    const decoded = await auth.verifyIdToken(idToken);
    const customToken = await auth.createCustomToken(decoded.uid);
    res.json({ customToken });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[auth/custom-token POST]', msg);
    const payload = idToken ? decodeJwtPayloadUnsafe(idToken) : null;
    if (payload) {
      const now = Math.floor(Date.now() / 1000);
      console.warn('[auth/custom-token POST] decode (unverified):', {
        exp: payload.exp,
        iss: payload.iss,
        aud: payload.aud,
        now,
        expired: payload.exp != null ? payload.exp < now : 'unknown',
      });
    }
    res.status(401).json({ error: 'Invalid or expired idToken' });
  }
});

export default router;
