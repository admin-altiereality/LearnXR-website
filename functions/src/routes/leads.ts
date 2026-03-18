import { Request, Response, Router } from 'express';

const router = Router();

const N8N_API_URL: string | undefined = process.env.N8N_API_URL;
const N8N_LEAD_WEBHOOK_URL: string | undefined = process.env.N8N_LEAD_WEBHOOK_URL;
const N8N_LEAD_WEBHOOK_PATH = process.env.N8N_LEAD_WEBHOOK_PATH || 'learnxr-website-lead';

type LeadBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  organization?: unknown;
  role?: unknown;
  interest?: unknown;
  message?: unknown;
  source?: unknown;
  pageUrl?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
  companyWebsite?: unknown;
};

const sanitizeText = (value: unknown, maxLength: number = 500): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getLeadWebhookUrl = (): string | null => {
  if (N8N_LEAD_WEBHOOK_URL) {
    return N8N_LEAD_WEBHOOK_URL;
  }

  if (!N8N_API_URL) {
    return null;
  }

  const baseUrl = N8N_API_URL
    .replace(/\/api\/v\d+\/?$/i, '')
    .replace(/\/$/, '');

  return `${baseUrl}/webhook/${N8N_LEAD_WEBHOOK_PATH}`;
};

const handleLeadPost = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as LeadBody;
  const requestId = (req as any).requestId || `lead-${Date.now()}`;
  console.log(`[${requestId}] Lead route hit`);

  const companyWebsite = sanitizeText(body.companyWebsite, 200);
  if (companyWebsite) {
    res.json({ success: true, message: 'Lead received.' });
    return;
  }

  const name = sanitizeText(body.name, 120);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const phone = sanitizeText(body.phone, 60);
  const organization = sanitizeText(body.organization, 180);
  const role = sanitizeText(body.role, 80);
  const interest = sanitizeText(body.interest, 80);
  const message = sanitizeText(body.message, 1200);
  const source = sanitizeText(body.source, 80) || 'landing-page-popup';
  const pageUrl = sanitizeText(body.pageUrl, 500);
  const utmSource = sanitizeText(body.utmSource, 120);
  const utmMedium = sanitizeText(body.utmMedium, 120);
  const utmCampaign = sanitizeText(body.utmCampaign, 160);
  const utmTerm = sanitizeText(body.utmTerm, 160);
  const utmContent = sanitizeText(body.utmContent, 160);

  if (!name || !email) {
    res.status(400).json({
      success: false,
      message: 'Name and email are required.',
    });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({
      success: false,
      message: 'Please enter a valid email address.',
    });
    return;
  }

  const webhookUrl = getLeadWebhookUrl();
  if (!webhookUrl) {
    console.error('Lead webhook is not configured. Missing N8N_API_URL or N8N_LEAD_WEBHOOK_URL.');
    res.status(500).json({
      success: false,
      message: 'Lead capture is not configured on the server.',
    });
    return;
  }

  const payload = {
    name,
    email,
    phone,
    organization,
    role,
    interest,
    message,
    source,
    pageUrl,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    submittedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Lead webhook request failed:', response.status, errorText);
      res.status(502).json({
        success: false,
        message: 'Failed to forward lead to automation.',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Lead received successfully.',
    });
  } catch (error) {
    console.error('Lead submission failed:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to submit your request right now.',
    });
  }
};

router.post(['', '/'], handleLeadPost);

export default router;
