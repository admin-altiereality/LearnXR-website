/**
 * Auth routes (public).
 * - POST /auth/demo-token: validate demo password, ensure demo Auth user exists with that password,
 *   ensure Firestore profile; client then signs in with email/password (no custom token / IAM signBlob).
 */

import express, { Request, Response } from 'express';
import { initializeAdmin } from '../utils/services';

const router = express.Router();

const DEMO_UID = 'demo-learnxr';
const DEMO_EMAIL = 'demo@learnxr.demo';

/**
 * POST /auth/demo-token
 * Body: { password: string }
 * Returns: { success: true } on valid password. Does NOT return a custom token.
 * Backend ensures Firebase Auth user demo@learnxr.demo exists with that password and Firestore
 * profile exists. Client signs in with login(demo@learnxr.demo, password) like /secretbackend.
 * Demo password is stored in Firebase Secret Manager (DEMO_PASSWORD).
 */
router.post('/demo-token', async (req: Request, res: Response) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const expected = (process.env.DEMO_PASSWORD || '').trim().replace(/\r\n/g, '').replace(/\n/g, '').replace(/\r/g, '');

    if (!expected) {
      console.warn('DEMO_PASSWORD not configured');
      res.status(503).json({ success: false, error: 'Demo login not configured' });
      return;
    }

    if (!password || password !== expected) {
      res.status(401).json({ success: false, error: 'Invalid demo credentials' });
      return;
    }

    const admin = initializeAdmin();
    const auth = admin.auth();

    try {
      const existing = await auth.getUser(DEMO_UID).catch(() => null);
      if (existing) {
        await auth.updateUser(DEMO_UID, { password: expected });
      } else {
        await auth.createUser({
          uid: DEMO_UID,
          email: DEMO_EMAIL,
          password: expected,
          emailVerified: true,
          displayName: 'Demo Student',
        });
      }
    } catch (authErr: any) {
      console.error('Demo token: ensure user failed', authErr?.message || authErr, authErr?.stack);
      res.status(500).json({ success: false, error: 'Failed to setup demo user' });
      return;
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(DEMO_UID);
    try {
      await userRef.set(
        {
          email: DEMO_EMAIL,
          name: 'Demo Student',
          displayName: 'Demo Student',
          role: 'student',
          approvalStatus: 'approved',
          onboardingCompleted: true,
          isDemoUser: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (firestoreErr: any) {
      console.error('Demo token: Firestore set failed', firestoreErr?.message || firestoreErr, firestoreErr?.stack);
      res.status(500).json({ success: false, error: 'Failed to setup demo profile' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Demo token error:', err?.message || err, err?.stack);
    res.status(500).json({ success: false, error: 'Failed to issue demo token' });
  }
});

export default router;
