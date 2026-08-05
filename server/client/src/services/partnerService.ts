import { getApiBaseUrl } from '../utils/apiConfig';
import { auth } from '../config/firebase';
import type { Partner, PartnerEvent } from '../types/partner';

export interface PartnerRegistrationPayload {
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  region?: string;
  website?: string;
  partnerType: string;
  orgType: string;
  yearsInBusiness?: string;
  schoolsReach?: string;
  currentPortfolio?: string;
  message?: string;
  consent: boolean;
  source?: string;
  pageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  companyFax?: string;
}

export interface PartnerRegistrationResponse {
  success: boolean;
  message?: string;
  registrationId?: string;
  leadScore?: number;
  tier?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function submitPartnerRegistration(
  payload: PartnerRegistrationPayload,
): Promise<PartnerRegistrationResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: PartnerRegistrationResponse | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to submit your registration right now.');
  }

  return data || { success: true };
}

export async function approvePartnerRegistration(registrationId: string): Promise<{
  success: boolean;
  message?: string;
  partnerId?: string;
  userId?: string;
  inviteLink?: string | null;
  trial?: Partner['trial'];
  alreadyApproved?: boolean;
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/registrations/${registrationId}/approve`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to approve partner');
  return data;
}

export async function rejectPartnerRegistration(
  registrationId: string,
  reason?: string,
): Promise<{ success: boolean; message?: string }> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/registrations/${registrationId}/reject`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reason: reason || '' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to reject partner');
  return data;
}

export async function suspendPartner(partnerId: string): Promise<{ success: boolean; message?: string }> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/${partnerId}/suspend`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to suspend partner');
  return data;
}

export async function fetchPartnerRegistrationDetail(registrationId: string): Promise<{
  success: boolean;
  registration: Record<string, unknown>;
  partner: Partner | null;
  schools: Array<Record<string, unknown>>;
  events: PartnerEvent[];
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/registrations/${registrationId}/detail`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to load partner detail');
  return data;
}

export async function fetchPartnerMe(): Promise<{
  success: boolean;
  partner: Partner;
  trialActive: boolean;
  trialBlockReason: string | null;
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/me`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to load partner profile');
  return data;
}

export async function fetchPartnerActivity(partnerId: string): Promise<{
  success: boolean;
  events: PartnerEvent[];
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/${partnerId}/activity`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to load activity');
  return data;
}

export async function createPartnerSchool(payload: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactPerson?: string;
  contactPhone?: string;
  website?: string;
  boardAffiliation?: string;
  schoolType?: string;
}): Promise<{ success: boolean; school: Record<string, unknown>; schoolCode: string }> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/schools`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to create school');
  return data;
}

export async function listPartnerSchools(): Promise<{
  success: boolean;
  schools: Array<Record<string, unknown> & { id: string }>;
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/schools`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to list schools');
  return data;
}

export async function createSchoolInvite(
  schoolId: string,
  email?: string,
): Promise<{ success: boolean; inviteUrl: string; expiresAt: string }> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/schools/${schoolId}/invite`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ email: email || '' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to create invite');
  return data;
}

export async function claimSchoolInvite(token: string): Promise<{
  success: boolean;
  schoolId?: string;
  message?: string;
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/invites/${token}/claim`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to claim invite');
  return data;
}

export async function startPartnerDemoSession(
  schoolId: string,
  classId: string,
): Promise<{
  success: boolean;
  sessionId: string;
  sessionCode: string;
  classLaunchesRemaining: number;
  classLaunchesUsed: number;
}> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/sessions`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ schoolId, classId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to start demo session');
  return data;
}

export async function launchPartnerDemoLesson(
  sessionId: string,
  lesson: { chapterId: string; topicId: string; sceneId?: string; title?: string },
): Promise<{ success: boolean; lessonLaunchesRemaining: number; lessonLaunchesUsed: number }> {
  const response = await fetch(`${getApiBaseUrl()}/partners/sessions/${sessionId}/launch-lesson`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(lesson),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to launch demo lesson');
  return data;
}

export async function recordPartnerLaunchTelemetry(
  sessionId: string,
  location: { latitude: number; longitude: number },
): Promise<{ success: boolean; city?: string; country?: string }> {
  const response = await fetch(`${getApiBaseUrl()}/partners/sessions/${sessionId}/telemetry`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ consentTelemetry: true, location }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to record launch location');
  return data;
}

export interface PartnerOversightSummary extends Partner {
  schoolCount: number;
  sessionCount: number;
  daysRemaining: number;
}

export async function listPartnerOversight(): Promise<{ success: boolean; partners: PartnerOversightSummary[] }> {
  const response = await fetch(`${getApiBaseUrl()}/partners/admin/list`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to load partner oversight');
  return data;
}

export async function fetchPartnerTelemetry(partnerId: string): Promise<{
  success: boolean;
  locations: Array<{ label: string; launches: number }>;
}> {
  const response = await fetch(`${getApiBaseUrl()}/partners/admin/${partnerId}/telemetry`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to load partner telemetry');
  return data;
}

export async function updatePartnerQuota(
  partnerId: string,
  limits: { classLaunchesLimit: number; lessonLaunchesLimit: number; reason?: string },
): Promise<{ success: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/partners/${partnerId}/trial/quota`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(limits),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to update partner quota');
  return data;
}

export async function extendPartnerTrial(
  partnerId: string,
  months: number,
): Promise<{ success: boolean }> {
  const response = await fetch(`${getApiBaseUrl()}/partners/${partnerId}/trial/extend`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ months }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to extend partner trial');
  return data;
}

export async function provisionPartnerDemoClass(partnerId: string): Promise<{ success: boolean; demoSchoolId: string; demoClassId: string }> {
  const response = await fetch(`${getApiBaseUrl()}/partners/${partnerId}/provision-demo`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to provision the partner demo class');
  return data;
}

export async function approvePartnerTeacher(
  teacherUid: string,
  approve = true,
): Promise<{ success: boolean; approvalStatus: string }> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/partners/teachers/${teacherUid}/approve`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ approve }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Failed to update teacher');
  return data;
}
