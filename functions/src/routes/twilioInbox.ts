/**
 * Authenticated Twilio Conversations bridge: tokens, send message, templates, CRM metadata.
 */

import * as admin from 'firebase-admin';
import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { requireRole, UserRole } from '../middleware/rbac';
import {
  getWhatsAppInboxMeta,
  LeadStatus,
  mergeWhatsAppInboxMeta,
  metaDocIdForConversation,
  WhatsAppInboxMeta,
  WHATSAPP_INBOX_META,
} from '../services/whatsappInboxFirestore';
import { logTwilioAccessTokenJwtShape } from '../utils/twilioAccessTokenDebug';
import {
  ensureInboxStaffParticipant,
  inboxConversationsIdentity,
} from '../utils/twilioInboxStaffParticipant';

const INBOX_ROLES: UserRole[] = ['associate', 'admin', 'superadmin'];

const router = express.Router();

router.use(requireRole(INBOX_ROLES));

function twilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = process.env.TWILIO_AUTH_TOKEN || '';
  const apiKeySid = process.env.TWILIO_API_KEY_SID || '';
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || '';
  const conversationsServiceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID || '';
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || '';
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
  /** Optional e.g. `ie1` for EU — see Twilio Access Token regional docs */
  const accessTokenRegion = process.env.TWILIO_ACCESS_TOKEN_REGION || '';
  return {
    accountSid,
    authToken,
    apiKeySid,
    apiKeySecret,
    conversationsServiceSid,
    whatsappFrom,
    messagingServiceSid,
    accessTokenRegion,
  };
}

/** Twilio returns 20151 / 401 when grants or signing key do not match the Conversations service account. */
function validateConversationsTokenInputs(params: {
  accountSid: string;
  apiKeySid: string;
  conversationsServiceSid: string;
}): string | null {
  const { accountSid, apiKeySid, conversationsServiceSid } = params;
  if (!accountSid.startsWith('AC')) {
    return 'TWILIO_ACCOUNT_SID must start with AC.';
  }
  if (!apiKeySid.startsWith('SK')) {
    return 'TWILIO_API_KEY_SID must be a standard API Key SID (SK…). Do not use the Auth Token as the key SID.';
  }
  if (conversationsServiceSid.startsWith('MG')) {
    return 'TWILIO_CONVERSATIONS_SERVICE_SID must be IS… (Conversations > Services), not MG… (Messaging Service).';
  }
  if (!conversationsServiceSid.startsWith('IS')) {
    return 'TWILIO_CONVERSATIONS_SERVICE_SID must start with IS (Conversations Service SID).';
  }
  return null;
}

function normalizeWhatsAppAddress(raw: string): string {
  const t = raw.trim();
  if (t.toLowerCase().startsWith('whatsapp:')) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    return `whatsapp:+${digits}`;
  }
  if (t.startsWith('+')) return `whatsapp:${t}`;
  return `whatsapp:+${t}`;
}

type ConversationListItem = {
  sid: string;
  friendlyName: string;
  dateUpdated: string | null;
  state?: string;
};

async function buildInboxConversationListItems(
  client: ReturnType<typeof twilio>,
  conversationsServiceSid: string,
): Promise<ConversationListItem[]> {
  const rows = await client.conversations.v1
    .services(conversationsServiceSid)
    .conversations.list({ limit: 100 });
  const bySid = new Map<string, ConversationListItem>();
  for (const c of rows) {
    bySid.set(c.sid, {
      sid: c.sid,
      friendlyName: c.friendlyName || '',
      dateUpdated: c.dateUpdated ? new Date(c.dateUpdated as Date).toISOString() : null,
      state: c.state,
    });
  }

  try {
    const db = admin.firestore();
    const snap = await db
      .collection(WHATSAPP_INBOX_META)
      .orderBy('updatedAt', 'desc')
      .limit(80)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as WhatsAppInboxMeta;
      const sid = String(data.conversationSid || '').trim();
      if (!sid.startsWith('CH') || bySid.has(sid)) continue;
      try {
        const conv = await client.conversations.v1
          .services(conversationsServiceSid)
          .conversations(sid)
          .fetch();
        bySid.set(sid, {
          sid: conv.sid,
          friendlyName:
            (conv.friendlyName && String(conv.friendlyName)) ||
            String(data.waFrom || '') ||
            String(data.waProfileName || '') ||
            '',
          dateUpdated: conv.dateUpdated ? new Date(conv.dateUpdated as Date).toISOString() : null,
          state: conv.state,
        });
      } catch {
        /* stale sid */
      }
    }
  } catch (e) {
    console.warn('[twilioInbox] conversation list Firestore merge skipped', e);
  }

  return [...bySid.values()].sort((a, b) => {
    const ta = a.dateUpdated ? new Date(a.dateUpdated).getTime() : 0;
    const tb = b.dateUpdated ? new Date(b.dateUpdated).getTime() : 0;
    return tb - ta;
  });
}

/** JWT for Conversations JS SDK */
router.get('/conversations/token', async (req: Request, res: Response) => {
  try {
    const {
      accountSid,
      authToken,
      apiKeySid,
      apiKeySecret,
      conversationsServiceSid,
      accessTokenRegion,
    } = twilioConfig();
    if (!accountSid || !apiKeySid || !apiKeySecret || !conversationsServiceSid) {
      return res.status(503).json({
        success: false,
        error: 'Twilio Conversations not configured',
        message:
          'Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_CONVERSATIONS_SERVICE_SID',
      });
    }

    const misconfigured = validateConversationsTokenInputs({
      accountSid,
      apiKeySid,
      conversationsServiceSid,
    });
    if (misconfigured) {
      console.error('[twilioInbox] token config:', misconfigured);
      return res.status(503).json({
        success: false,
        error: 'Twilio Conversations misconfigured',
        message: misconfigured,
      });
    }

    if (authToken) {
      try {
        const restClient = twilio(accountSid, authToken);
        await restClient.conversations.v1.services(conversationsServiceSid).fetch();
      } catch (e: any) {
        console.error('[twilioInbox] service verify', e?.code, e?.status, e?.message);
        return res.status(503).json({
          success: false,
          error: 'Twilio Conversations service verification failed',
          message:
            e?.code === 20404
              ? 'That IS… service was not found for this AC… + Auth Token. Use the subaccount’s own Account SID and credentials, or fix the Service SID.'
              : e?.message || 'Cannot load Conversations service with Account SID + Auth Token',
          code: e?.code,
        });
      }
    } else {
      console.warn('[twilioInbox] TWILIO_AUTH_TOKEN missing — skipping Conversations service verify');
    }

    const identity = inboxConversationsIdentity();
    const AccessToken = twilio.jwt.AccessToken;
    const ChatGrant = AccessToken.ChatGrant;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
      ...(accessTokenRegion ? { region: accessTokenRegion } : {}),
    });
    token.addGrant(
      new ChatGrant({
        serviceSid: conversationsServiceSid,
      }),
    );

    const jwtStr = token.toJwt();
    logTwilioAccessTokenJwtShape(jwtStr, identity);

    return res.json({
      success: true,
      token: jwtStr,
      identity,
      serviceSid: conversationsServiceSid,
      ...(accessTokenRegion ? { region: accessTokenRegion } : {}),
    });
  } catch (e: any) {
    console.error('[twilioInbox] token error', e);
    return res.status(500).json({
      success: false,
      error: e?.message || 'Token error',
    });
  }
});

/**
 * List Conversations in the service (REST). Powers the custom UI even when the SDK subscription set is empty.
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const { accountSid, authToken, conversationsServiceSid } = twilioConfig();
    if (!accountSid || !authToken || !conversationsServiceSid) {
      return res.status(503).json({ success: false, error: 'Twilio not configured' });
    }
    const client = twilio(accountSid, authToken);
    const items = await buildInboxConversationListItems(client, conversationsServiceSid);
    const emptyHint =
      items.length === 0
        ? [
            'This list shows Twilio Conversations (CH…), not Programmable Messaging-only traffic. Check Conversations > Services > your IS… in Console for CH rows.',
            'WhatsApp Sandbox (+1415…): clear the Sandbox inbound webhook (Messaging > Try it out > WhatsApp > Sandbox settings) or inbound conflicts with Conversations — see https://www.twilio.com/docs/conversations/use-twilio-sandbox-for-whatsapp',
            'Production WhatsApp: the Messaging Service that contains your WhatsApp sender must match Conversations > Manage > Defaults > Default Messaging Service (CLI: twilio api:conversations:v1:configuration:fetch).',
            'After fixing Twilio, send a new inbound WhatsApp message and refresh this page.',
          ].join(' ')
        : null;
    return res.json({ success: true, items, emptyHint });
  } catch (e: any) {
    console.error('[twilioInbox] list conversations', e);
    return res.status(500).json({ success: false, error: e?.message || 'List failed' });
  }
});

/** Ensure staff identity is a participant before opening a thread in the JS SDK. */
router.post('/conversations/:conversationSid/join', async (req: Request, res: Response) => {
  await ensureInboxStaffParticipant(req.params.conversationSid);
  return res.json({ success: true });
});

/** Send a session message in a conversation (agent author = token identity) */
router.post('/conversations/:conversationSid/messages', async (req: Request, res: Response) => {
  try {
    const { accountSid, authToken, conversationsServiceSid } = twilioConfig();
    if (!accountSid || !authToken || !conversationsServiceSid) {
      return res.status(503).json({ success: false, error: 'Twilio not configured' });
    }
    const identity = inboxConversationsIdentity();
    const { conversationSid } = req.params;
    const text = String((req.body as { body?: string })?.body || '').trim();
    if (!text) {
      return res.status(400).json({ success: false, error: 'body required' });
    }

    await ensureInboxStaffParticipant(conversationSid);

    const client = twilio(accountSid, authToken);
    await client.conversations.v1
      .services(conversationsServiceSid)
      .conversations(conversationSid)
      .messages.create({
        body: text,
        author: identity,
      });

    return res.json({ success: true });
  } catch (e: any) {
    console.error('[twilioInbox] send message error', e);
    return res.status(500).json({
      success: false,
      error: e?.message || 'Send failed',
      code: e?.code,
    });
  }
});

/** WhatsApp template via Content API */
router.post('/messaging/send-template', async (req: Request, res: Response) => {
  try {
    const {
      accountSid,
      authToken,
      whatsappFrom,
      messagingServiceSid,
    } = twilioConfig();
    if (!accountSid || !authToken) {
      return res.status(503).json({ success: false, error: 'Twilio not configured' });
    }
    const to = String((req.body as { to?: string })?.to || '').trim();
    const contentSid = String((req.body as { contentSid?: string })?.contentSid || '').trim();
    const contentVariables = (req.body as { contentVariables?: Record<string, string> })
      ?.contentVariables;

    if (!to || !contentSid) {
      return res.status(400).json({
        success: false,
        error: 'to and contentSid required',
      });
    }

    const toNormalized = normalizeWhatsAppAddress(to);

    const client = twilio(accountSid, authToken);
    const payload: Record<string, unknown> = {
      to: toNormalized,
      contentSid,
    };
    if (contentVariables && Object.keys(contentVariables).length) {
      payload.contentVariables = JSON.stringify(contentVariables);
    }
    if (messagingServiceSid) {
      payload.messagingServiceSid = messagingServiceSid;
    } else if (whatsappFrom) {
      payload.from = whatsappFrom.startsWith('whatsapp:')
        ? whatsappFrom
        : `whatsapp:${whatsappFrom}`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_WHATSAPP_FROM',
      });
    }

    const msg = await client.messages.create(payload as any);
    return res.json({ success: true, sid: msg.sid });
  } catch (e: any) {
    console.error('[twilioInbox] template error', e);
    return res.status(500).json({
      success: false,
      error: e?.message || 'Template send failed',
      code: e?.code,
    });
  }
});

router.get('/conversations/:conversationSid/meta', async (req: Request, res: Response) => {
  try {
    const docId = metaDocIdForConversation(req.params.conversationSid);
    const meta = await getWhatsAppInboxMeta(docId);
    return res.json({ success: true, meta: meta || null, docId });
  } catch (e: any) {
    console.error('[twilioInbox] get meta error', e);
    return res.status(500).json({ success: false, error: e?.message });
  }
});

router.patch('/conversations/:conversationSid/meta', async (req: Request, res: Response) => {
  try {
    const docId = metaDocIdForConversation(req.params.conversationSid);
    const b = req.body as Partial<{
      leadStatus: LeadStatus;
      notes: string;
      email: string;
      budget: string;
      humanHandoffRequested: boolean;
      pendingDemoForm: boolean;
      assignedUid: string | null;
    }>;

    const validStatuses: LeadStatus[] = ['new', 'follow-up', 'qualified'];
    const patch: Partial<WhatsAppInboxMeta> = {};

    if (b.leadStatus !== undefined) {
      if (!validStatuses.includes(b.leadStatus)) {
        return res.status(400).json({ success: false, error: 'invalid leadStatus' });
      }
      patch.leadStatus = b.leadStatus;
    }
    if (b.notes !== undefined) patch.notes = String(b.notes).slice(0, 8000);
    if (b.email !== undefined) patch.email = String(b.email).slice(0, 320);
    if (b.budget !== undefined) patch.budget = String(b.budget).slice(0, 200);
    if (b.humanHandoffRequested !== undefined) {
      patch.humanHandoffRequested = Boolean(b.humanHandoffRequested);
    }
    if (b.pendingDemoForm !== undefined) {
      patch.pendingDemoForm = Boolean(b.pendingDemoForm);
    }
    if (b.assignedUid !== undefined) {
      patch.assignedUid = b.assignedUid;
    }

    patch.conversationSid = req.params.conversationSid;
    await mergeWhatsAppInboxMeta(docId, patch);
    const meta = await getWhatsAppInboxMeta(docId);
    return res.json({ success: true, meta });
  } catch (e: any) {
    console.error('[twilioInbox] patch meta error', e);
    return res.status(500).json({ success: false, error: e?.message });
  }
});

export default router;
