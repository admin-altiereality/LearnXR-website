import { getApiBaseUrl } from '../utils/apiConfig';

export interface LeadCapturePayload {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  role?: string;
  interest?: string;
  message?: string;
  source?: string;
  pageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  companyWebsite?: string;
}

export interface LeadCaptureResponse {
  success: boolean;
  message?: string;
}

export async function submitLead(payload: LeadCapturePayload): Promise<LeadCaptureResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data: LeadCaptureResponse | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to submit lead right now.');
  }

  return data || { success: true };
}
