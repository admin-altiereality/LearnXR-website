import { Request, Response, NextFunction } from 'express';
import { db, isFirebaseInitialized } from '../config/firebase-admin';

const STAFF_ROLES = new Set(['admin', 'superadmin', 'associate', 'teacher', 'school', 'principal']);

export async function requireStaffRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.uid) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (!isFirebaseInitialized() || !db) {
    res.status(503).json({ success: false, error: 'Database not available' });
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const role = userDoc.data()?.role;
    if (!role || !STAFF_ROLES.has(role)) {
      res.status(403).json({ success: false, error: 'Staff access required' });
      return;
    }
    next();
  } catch (error) {
    console.error('Staff role check failed:', error);
    res.status(500).json({ success: false, error: 'Failed to verify role' });
  }
}
