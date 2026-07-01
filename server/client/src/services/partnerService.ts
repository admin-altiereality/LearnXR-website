import { getApiBaseUrl } from '../utils/apiConfig';

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
  // Attribution
  source?: string;
  pageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  // Honeypot — must remain empty for genuine submissions.
  companyFax?: string;
}

export interface PartnerRegistrationResponse {
  success: boolean;
  message?: string;
  registrationId?: string;
  leadScore?: number;
  tier?: string;
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
