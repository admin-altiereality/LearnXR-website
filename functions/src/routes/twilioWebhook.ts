/**
 * Public Twilio webhooks — validate X-Twilio-Signature, sync CRM / handoff flags to Firestore.
 * Configure in Twilio: POST URL https://<host>/webhooks/twilio/messaging (after /api strip on Hosting).
 */

import express, { Request, Response } from 'express';
import twilio from 'twilio';
import {
  mergeWhatsAppInboxMeta,
  metaDocIdForConversation,
  metaDocIdForWaFrom,
} from '../services/whatsappInboxFirestore';
import { normalizeTwilioInboundBody } from '../utils/twilioConversationsWebhookNormalize';
import { ensureInboxStaffParticipant } from '../utils/twilioInboxStaffParticipant';

const router = express.Router();

function businessWhatsAppToAddress(): string {
  const raw = (process.env.TWILIO_WHATSAPP_FROM || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase().startsWith('whatsapp:')) return raw;
  const d = raw.replace(/\D/g, '');
  return d ? `whatsapp:+${d}` : '';
}

/** Optional: POST Programmable-Messaging-shaped fields to n8n (workflows that expect From/Body, not Conversations EventType). */
async function forwardLegacyN8nIfConfigured(params: {
  from?: string;
  body: string;
  conversationSid?: string;
  messageSid?: string;
  profileName?: string;
  eventType?: string;
}): Promise<void> {
  const url = (process.env.TWILIO_N8N_LEGACY_INBOUND_FORWARD_URL || '').trim();
  if (!url) return;
  const to = businessWhatsAppToAddress();
  const u = new URLSearchParams();
  if (params.from) u.set('From', params.from);
  if (to) u.set('To', to);
  u.set('Body', params.body);
  if (params.conversationSid) u.set('ConversationSid', params.conversationSid);
  if (params.messageSid) u.set('MessageSid', params.messageSid);
  if (params.profileName) u.set('ProfileName', params.profileName);
  if (params.eventType) u.set('LearnXRSourceEvent', params.eventType);
  u.set('ApiVersion', 'learnxr-legacy-bridge');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: u.toString(),
    });
    if (!res.ok) {
      console.warn('[twilioWebhook] legacy n8n forward HTTP', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[twilioWebhook] legacy n8n forward failed', e);
  }
}

function webhookPublicUrl(req: Request): string {
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  const path = req.originalUrl.split('?')[0];
  return `${proto}://${host}${path}`;
}

function validateTwilio(req: Request, res: Response): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  if (!authToken) {
    console.warn('[twilioWebhook] TWILIO_AUTH_TOKEN not set — rejecting webhook');
    res.status(503).send('Twilio not configured');
    return false;
  }
  const signature = req.get('x-twilio-signature') || '';
  const url = webhookPublicUrl(req);
  const valid = twilio.validateRequest(authToken, signature, url, req.body || {});
  if (!valid) {
    console.warn('[twilioWebhook] Invalid signature', { url });
    res.status(403).send('Forbidden');
    return false;
  }
  return true;
}

/** Inbound WhatsApp / SMS (Messaging) */
router.post('/messaging', async (req: Request, res: Response) => {
  try {
    if (!validateTwilio(req, res)) return;

    const norm = normalizeTwilioInboundBody(req.body || {});

    if (!norm.shouldSyncMeta) {
      res.type('text/plain').send('OK');
      return;
    }

    const from = norm.from || '';
    const body = norm.body;
    const profileName = norm.profileName || '';

    const lower = body.toLowerCase();
    const humanHandoffRequested =
      /human|agent|real person|speak to someone|handoff/.test(lower);
    const pendingDemoForm = /demo|request demo|book a demo|schedule/.test(lower);

    const conversationSid = norm.conversationSid;

    if (!conversationSid && from.toLowerCase().startsWith('whatsapp:')) {
      console.warn(
        '[twilioWebhook] Inbound WhatsApp without ConversationSid — in Twilio: Conversations > Services (IS…) > Integrations, connect this WhatsApp sender. Programmable Messaging-only traffic does not create Conversations or this inbox.',
      );
    }

    await ensureInboxStaffParticipant(conversationSid);

    const docId = conversationSid
      ? metaDocIdForConversation(conversationSid)
      : metaDocIdForWaFrom(from || 'unknown');

    await mergeWhatsAppInboxMeta(docId, {
      conversationSid: conversationSid || undefined,
      waFrom: from || undefined,
      waProfileName: profileName || undefined,
      lastInboundBody: body.slice(0, 2000),
      ...(humanHandoffRequested ? { humanHandoffRequested: true } : {}),
      ...(pendingDemoForm ? { pendingDemoForm: true } : {}),
    });

    void forwardLegacyN8nIfConfigured({
      from: from || undefined,
      body,
      conversationSid,
      messageSid: norm.messageSid,
      profileName: profileName || undefined,
      eventType: norm.eventType,
    });

    res.type('text/plain').send('OK');
  } catch (e) {
    console.error('[twilioWebhook] messaging error', e);
    res.status(500).send('Error');
  }
});

/** Optional: status callbacks */
router.post('/status', async (req: Request, res: Response) => {
  try {
    if (!validateTwilio(req, res)) return;
    res.type('text/plain').send('OK');
  } catch (e) {
    console.error('[twilioWebhook] status error', e);
    res.status(500).send('Error');
  }
});

export default router;
