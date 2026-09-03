import * as admin from 'firebase-admin';
import { getUserProfile } from '../middleware/rbac';

const STAFF_ROLES = new Set(['admin', 'superadmin', 'associate']);

/**
 * The identity fields mirrored from `users/{uid}` onto the Auth token.
 *
 * Security rules read these instead of calling `get(/databases/.../users/$(uid))`.
 * That matters for cost as much as latency: a `get()` inside a rule is billed as a
 * document read, and the hot helpers (isAdmin, getUserRole, getUserSchoolId, ...)
 * ran one on essentially every request the app made.
 *
 * Only scalars belong here. Custom claims are capped at 1000 bytes and are baked
 * into the ID token, so anything that grows without bound — `managed_class_ids`, for
 * instance — must stay in Firestore and keep being read relationally.
 */
export interface RoleClaims {
  role: string;
  school_id?: string;
  managed_school_id?: string;
  partner_id?: string;
  /** When the claims were last written, so a client can tell its token is behind. */
  claims_updated_at: number;
}

function buildClaims(profile: Record<string, any> | null): RoleClaims {
  const claims: RoleClaims = {
    role: profile?.role || 'student',
    claims_updated_at: Date.now(),
  };

  // Undefined values are rejected by setCustomUserClaims, so only set what exists.
  if (typeof profile?.school_id === 'string' && profile.school_id) {
    claims.school_id = profile.school_id;
  }
  if (typeof profile?.managed_school_id === 'string' && profile.managed_school_id) {
    claims.managed_school_id = profile.managed_school_id;
  }
  if (typeof profile?.partner_id === 'string' && profile.partner_id) {
    claims.partner_id = profile.partner_id;
  }

  return claims;
}

/**
 * Mirror a user's role and tenancy onto their Auth custom claims.
 *
 * Returns the role, as it always has, so existing callers are unaffected.
 * Note that `setCustomUserClaims` replaces the whole claim object rather than
 * merging, which is why every field is rebuilt here on each call.
 */
export async function syncUserRoleClaim(uid: string): Promise<string> {
  const profile = await getUserProfile(uid);
  const claims = buildClaims(profile as Record<string, any> | null);
  await admin.auth().setCustomUserClaims(uid, claims as unknown as Record<string, unknown>);
  return claims.role;
}

/** Same as above but returns everything written, for the trigger and the backfill. */
export async function syncUserRoleClaims(uid: string): Promise<RoleClaims> {
  const profile = await getUserProfile(uid);
  const claims = buildClaims(profile as Record<string, any> | null);
  await admin.auth().setCustomUserClaims(uid, claims as unknown as Record<string, unknown>);
  return claims;
}

/** True when the fields mirrored into claims differ between two user documents. */
export function claimFieldsChanged(
  before: Record<string, any> | undefined,
  after: Record<string, any> | undefined
): boolean {
  const fields = ['role', 'school_id', 'managed_school_id', 'partner_id'];
  return fields.some((field) => (before?.[field] ?? null) !== (after?.[field] ?? null));
}

export function isStaffRole(role: string | undefined): boolean {
  return Boolean(role && STAFF_ROLES.has(role));
}
