/**
 * Require Firestore user profile role ∈ associate | admin | superadmin
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { getAdminApp } from '../config/firebase-admin';

const INBOX_ROLES = new Set(['associate', 'admin', 'superadmin']);

export async function requireInboxStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const app = getAdminApp();
    if (!app) {
      res.status(503).json({
        success: false,
        error: 'Firebase Admin not configured',
      });
      return;
    }

    const snap = await admin.firestore(app).collection('users').doc(uid).get();
    if (!snap.exists) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'USER_PROFILE_NOT_FOUND',
        message:
          'No Firestore profile for this account. Create users/{uid} with role associate, admin, or superadmin.',
      });
      return;
    }

    const role = String(snap.data()?.role || '').toLowerCase();
    if (!INBOX_ROLES.has(role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Requires associate, admin, or superadmin',
      });
      return;
    }

    (req as any).userProfile = { uid, role, ...snap.data() };
    next();
  } catch (e: any) {
    console.error('[requireInboxStaff]', e);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}
