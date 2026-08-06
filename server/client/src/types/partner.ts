/**
 * Channel partner tenant, trial entitlements, and activity types.
 */

export type PartnerStatus = 'active' | 'suspended' | 'expired';

export type PartnerRegistrationStatus =
  | 'new'
  | 'approved'
  | 'rejected'
  | 'converted';

export type PartnerEventType =
  | 'partner_approved'
  | 'partner_rejected'
  | 'partner_suspended'
  | 'school_created'
  | 'school_invite_sent'
  | 'teacher_approved'
  | 'teacher_rejected'
  | 'demo_started'
  | 'lesson_launched'
  | 'demo_ended'
  | 'quota_exhausted'
  | 'trial_expired'
  | 'trial_extended'
  | 'quota_adjusted'
  | 'partner_reactivated';

export interface PartnerTrial {
  startsAt: string;
  endsAt: string;
  classLaunchesLimit: number;
  classLaunchesUsed: number;
  classLaunchesRemaining: number;
  lessonLaunchesLimit: number;
  lessonLaunchesUsed: number;
  lessonLaunchesRemaining: number;
}

export interface Partner {
  id: string;
  organizationName: string;
  contactName: string;
  email: string;
  phone?: string;
  country?: string;
  region?: string;
  partnerType?: string;
  orgType?: string;
  status: PartnerStatus;
  registrationId: string;
  userId: string;
  trial: PartnerTrial;
  schoolIds: string[];
  demoSchoolId?: string;
  demoClassId?: string;
  createdAt?: unknown;
  approvedAt?: string;
  approvedBy?: string;
}

export interface PartnerEvent {
  id: string;
  partnerId: string;
  type: PartnerEventType;
  schoolId?: string;
  actorUid: string;
  meta?: Record<string, unknown>;
  createdAt?: unknown;
}

export interface SchoolInvite {
  id: string;
  schoolId: string;
  partnerId: string;
  email?: string;
  role: 'school';
  expiresAt: string;
  usedAt?: string | null;
  createdBy: string;
  createdAt?: unknown;
}
