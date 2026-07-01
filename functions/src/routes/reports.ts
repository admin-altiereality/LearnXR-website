import { Request, Response, Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

const N8N_API_URL: string | undefined = process.env.N8N_API_URL;
const N8N_REPORT_WEBHOOK_URL: string | undefined = process.env.N8N_REPORT_WEBHOOK_URL;
const N8N_REPORT_WEBHOOK_PATH = process.env.N8N_REPORT_WEBHOOK_PATH || 'learnxr-website-report-lead';

type LeadBody = Record<string, unknown>;

const VALID_REPORTS = ['india', 'global', 'future'];

const sanitizeText = (value: unknown, maxLength = 500): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getReportWebhookUrl = (): string | null => {
  if (N8N_REPORT_WEBHOOK_URL) return N8N_REPORT_WEBHOOK_URL;
  if (!N8N_API_URL) return null;
  const baseUrl = N8N_API_URL.replace(/\/api\/v\d+\/?$/i, '').replace(/\/$/, '');
  return `${baseUrl}/webhook/${N8N_REPORT_WEBHOOK_PATH}`;
};

/**
 * Captures a contact before a research report is downloaded.
 * Public endpoint (no auth) — writes are performed via the Admin SDK only.
 */
const handleReportLead = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as LeadBody;
  const requestId = (req as any).requestId || `report-lead-${Date.now()}`;
  console.log(`[${requestId}] Report lead route hit`);

  // Honeypot: silently accept and drop bot submissions.
  const companyFax = sanitizeText(body.companyFax, 200);
  if (companyFax) {
    res.json({ success: true, message: 'Received.' });
    return;
  }

  const name = sanitizeText(body.name, 120);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const organization = sanitizeText(body.organization, 180);
  const role = sanitizeText(body.role, 120);
  const country = sanitizeText(body.country, 100);
  const consent = body.consent === true || body.consent === 'true';
  const reportIdRaw = sanitizeText(body.reportId, 40).toLowerCase();
  const reportId = VALID_REPORTS.includes(reportIdRaw) ? reportIdRaw : 'unknown';
  const reportTitle = sanitizeText(body.reportTitle, 180);
  const source = sanitizeText(body.source, 80) || 'case-studies-report';
  const pageUrl = sanitizeText(body.pageUrl, 500);
  const utmSource = sanitizeText(body.utmSource, 120);
  const utmMedium = sanitizeText(body.utmMedium, 120);
  const utmCampaign = sanitizeText(body.utmCampaign, 160);
  const utmTerm = sanitizeText(body.utmTerm, 160);
  const utmContent = sanitizeText(body.utmContent, 160);

  if (!name || !email) {
    res.status(400).json({ success: false, message: 'Please provide your name and email.' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    return;
  }

  // CRM-ready document shape, written only via the Admin SDK.
  const lead = {
    name,
    email,
    organization,
    role,
    country,
    consent,
    reportId,
    reportTitle,
    status: 'new',
    source,
    pageUrl,
    utm: { utmSource, utmMedium, utmCampaign, utmTerm, utmContent },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: new Date().toISOString(),
  };

  let leadId: string | undefined;
  try {
    const db = admin.firestore();
    const docRef = await db.collection('report_leads').add(lead);
    leadId = docRef.id;
    console.log(`[${requestId}] Report lead stored: ${leadId} (report ${reportId})`);
  } catch (error) {
    console.error(`[${requestId}] Failed to store report lead:`, error);
    res.status(500).json({
      success: false,
      message: 'Unable to record your details right now. Please try again.',
    });
    return;
  }

  // Best-effort forward to automation (does not block success).
  const webhookUrl = getReportWebhookUrl();
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, ...lead, createdAt: undefined }),
      });
    } catch (error) {
      console.error(`[${requestId}] Report lead webhook forward failed (non-fatal):`, error);
    }
  }

  res.json({ success: true, message: 'Thank you! Your report is downloading.', leadId });
};

router.post(['/lead', '/lead/'], handleReportLead);

export default router;
