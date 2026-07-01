import { getApiBaseUrl } from '../utils/apiConfig';

export interface ReportLeadPayload {
  name: string;
  email: string;
  organization?: string;
  role?: string;
  country?: string;
  consent: boolean;
  reportId: string;
  reportTitle?: string;
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

export interface ReportLeadResponse {
  success: boolean;
  message?: string;
  leadId?: string;
}

/**
 * Records a contact before a report download. Soft-gate: callers may proceed
 * with the download even if this fails, but the failure is surfaced so the UI
 * can decide how to react.
 */
export async function submitReportLead(
  payload: ReportLeadPayload,
): Promise<ReportLeadResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/reports/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data: ReportLeadResponse | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to record your details right now.');
  }

  return data || { success: true };
}

const STORAGE_KEY = 'learnxr_report_lead';

/** True if this visitor has already provided their details for report downloads. */
export function hasCapturedReportLead(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Remember the visitor so they are not re-prompted on subsequent downloads. */
export function markReportLeadCaptured(info: { name: string; email: string }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...info, capturedAt: new Date().toISOString() }),
    );
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}
