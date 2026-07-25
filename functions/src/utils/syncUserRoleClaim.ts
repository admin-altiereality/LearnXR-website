import * as admin from 'firebase-admin';
import { getUserProfile } from '../middleware/rbac';

const STAFF_ROLES = new Set(['admin', 'superadmin', 'associate']);

export async function syncUserRoleClaim(uid: string): Promise<string> {
  const profile = await getUserProfile(uid);
  const role = profile?.role || 'student';
  await admin.auth().setCustomUserClaims(uid, { role });
  return role;
}

export function isStaffRole(role: string | undefined): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}
