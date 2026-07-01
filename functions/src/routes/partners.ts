import { Request, Response, Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

const N8N_API_URL: string | undefined = process.env.N8N_API_URL;
const N8N_PARTNER_WEBHOOK_URL: string | undefined = process.env.N8N_PARTNER_WEBHOOK_URL;
const N8N_PARTNER_WEBHOOK_PATH = process.env.N8N_PARTNER_WEBHOOK_PATH || 'learnxr-website-partner';

type PartnerBody = Record<string, unknown>;

const sanitizeText = (value: unknown, maxLength = 500): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getPartnerWebhookUrl = (): string | null => {
  if (N8N_PARTNER_WEBHOOK_URL) return N8N_PARTNER_WEBHOOK_URL;
  if (!N8N_API_URL) return null;
  const baseUrl = N8N_API_URL.replace(/\/api\/v\d+\/?$/i, '').replace(/\/$/, '');
  return `${baseUrl}/webhook/${N8N_PARTNER_WEBHOOK_PATH}`;
};

/**
 * Weighted lead-scoring model (0–100). Higher scores indicate larger reach,
 * more established organizations, and higher-value partner types/territories.
 */
const REACH_SCORE: Record<string, number> = {
  '1': 4,
  '2-10': 10,
  '11-50': 18,
  '51-200': 25,
  '200+': 30,
};

const EXPERIENCE_SCORE: Record<string, number> = {
  '0-1': 4,
  '1-3': 9,
  '3-5': 14,
  '5-10': 18,
  '10+': 20,
};

const ORG_TYPE_SCORE: Record<string, number> = {
  distributor: 20,
  edtech: 16,
  system_integrator: 16,
  government: 18,
  school_group: 14,
  school: 8,
  other: 6,
};

const PARTNER_TYPE_SCORE: Record<string, number> = {
  distributor: 15,
  international: 14,
  government: 13,
  technology: 11,
  district: 9,
  school: 6,
};

const PRIORITY_MARKETS = ['india', 'united arab emirates', 'uae', 'singapore', 'united kingdom', 'uk', 'united states', 'usa', 'australia', 'south africa'];

interface ScoreResult {
  leadScore: number;
  tier: 'A' | 'B' | 'C';
}

const computeLeadScore = (data: {
  schoolsReach: string;
  yearsInBusiness: string;
  orgType: string;
  partnerType: string;
  country: string;
  currentPortfolio: string;
  website: string;
}): ScoreResult => {
  let score = 0;
  score += REACH_SCORE[data.schoolsReach] ?? 0;
  score += EXPERIENCE_SCORE[data.yearsInBusiness] ?? 0;
  score += ORG_TYPE_SCORE[data.orgType] ?? 0;
  score += PARTNER_TYPE_SCORE[data.partnerType] ?? 0;
  if (PRIORITY_MARKETS.includes(data.country.toLowerCase())) score += 8;
  if (data.currentPortfolio) score += 4;
  if (data.website) score += 3;

  const leadScore = Math.min(100, score);
  const tier: ScoreResult['tier'] = leadScore >= 70 ? 'A' : leadScore >= 45 ? 'B' : 'C';
  return { leadScore, tier };
};

const handlePartnerRegister = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as PartnerBody;
  const requestId = (req as any).requestId || `partner-${Date.now()}`;
  console.log(`[${requestId}] Partner registration route hit`);

  // Honeypot: silently accept and drop bot submissions.
  const companyFax = sanitizeText(body.companyFax, 200);
  if (companyFax) {
    res.json({ success: true, message: 'Registration received.' });
    return;
  }

  const organizationName = sanitizeText(body.organizationName, 180);
  const contactName = sanitizeText(body.contactName, 120);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const phone = sanitizeText(body.phone, 60);
  const country = sanitizeText(body.country, 100);
  const region = sanitizeText(body.region, 120);
  const website = sanitizeText(body.website, 200);
  const partnerType = sanitizeText(body.partnerType, 60);
  const orgType = sanitizeText(body.orgType, 60);
  const yearsInBusiness = sanitizeText(body.yearsInBusiness, 20);
  const schoolsReach = sanitizeText(body.schoolsReach, 20);
  const currentPortfolio = sanitizeText(body.currentPortfolio, 400);
  const message = sanitizeText(body.message, 1500);
  const consent = body.consent === true || body.consent === 'true';
  const source = sanitizeText(body.source, 80) || 'channel-partners-page';
  const pageUrl = sanitizeText(body.pageUrl, 500);
  const utmSource = sanitizeText(body.utmSource, 120);
  const utmMedium = sanitizeText(body.utmMedium, 120);
  const utmCampaign = sanitizeText(body.utmCampaign, 160);
  const utmTerm = sanitizeText(body.utmTerm, 160);
  const utmContent = sanitizeText(body.utmContent, 160);

  if (!organizationName || !contactName || !email || !phone || !country || !partnerType || !orgType) {
    res.status(400).json({
      success: false,
      message: 'Please complete all required fields.',
    });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    return;
  }

  if (!consent) {
    res.status(400).json({ success: false, message: 'Consent is required to submit.' });
    return;
  }

  const { leadScore, tier } = computeLeadScore({
    schoolsReach,
    yearsInBusiness,
    orgType,
    partnerType,
    country,
    currentPortfolio,
    website,
  });

  // CRM-ready document shape, written only via the Admin SDK.
  const registration = {
    organizationName,
    contactName,
    email,
    phone,
    country,
    region,
    website,
    partnerType,
    orgType,
    yearsInBusiness,
    schoolsReach,
    currentPortfolio,
    message,
    consent,
    leadScore,
    tier,
    status: 'new',
    source,
    pageUrl,
    utm: { utmSource, utmMedium, utmCampaign, utmTerm, utmContent },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: new Date().toISOString(),
  };

  let registrationId: string | undefined;
  try {
    const db = admin.firestore();
    const docRef = await db.collection('partner_registrations').add(registration);
    registrationId = docRef.id;
    console.log(`[${requestId}] Partner registration stored: ${registrationId} (tier ${tier}, score ${leadScore})`);
  } catch (error) {
    console.error(`[${requestId}] Failed to store partner registration:`, error);
    res.status(500).json({
      success: false,
      message: 'Unable to save your registration right now. Please try again.',
    });
    return;
  }

  // Best-effort forward to automation (does not block success).
  const webhookUrl = getPartnerWebhookUrl();
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, ...registration, createdAt: undefined }),
      });
    } catch (error) {
      console.error(`[${requestId}] Partner webhook forward failed (non-fatal):`, error);
    }
  }

  res.json({
    success: true,
    message: 'Thank you! Your partner application has been received.',
    registrationId,
    leadScore,
    tier,
  });
};

router.post(['/register', '/register/'], handlePartnerRegister);

export default router;
