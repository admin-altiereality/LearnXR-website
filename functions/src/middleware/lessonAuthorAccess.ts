/**
 * Allows Firebase-authenticated teachers, partners, and staff to call 3D-asset
 * generation endpoints directly (no In3D API key required), while external
 * API-key consumers continue through the existing `validateFullAccess` flow.
 */

import { Request, Response, NextFunction } from 'express';
import { getUserProfile } from './rbac';
import { validateFullAccess } from './validateIn3dApiKey';
import { isLessonAuthorRole } from '../services/userGeneratedLessons';

export function requireLessonAuthorAccess(req: Request, res: Response, next: NextFunction): void {
  const uid = req.user?.uid;
  if (!uid) {
    validateFullAccess(req, res, next);
    return;
  }

  getUserProfile(uid)
    .then((profile) => {
      if (profile?.role && isLessonAuthorRole(profile.role)) {
        req.userProfile = profile;
        next();
        return;
      }
      validateFullAccess(req, res, next);
    })
    .catch(() => validateFullAccess(req, res, next));
}
