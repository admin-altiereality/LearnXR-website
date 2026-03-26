import { auth } from '../config/firebase';
import {
  getCloudFunctionsApiUrl,
  getFunctionsEmulatorApiUrl,
  getFirebaseHostingApiBaseUrl,
} from '../utils/functionsApiUrl';

function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return getFunctionsEmulatorApiUrl().replace(/\/$/, '');
  }
  const hosted = getFirebaseHostingApiBaseUrl();
  if (hosted) return hosted.replace(/\/$/, '');
  return getCloudFunctionsApiUrl().replace(/\/$/, '');
}

async function authHeaders(contentTypeJson = true): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (contentTypeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth.currentUser) {
    headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  return headers;
}

export type LeadStatus = 'new' | 'follow-up' | 'qualified';

export interface ConversationSummaryDto {
  sid: string;
  friendlyName: string;
  dateUpdated: string | null;
  state?: string;
}

export interface WhatsAppInboxMetaDto {
  conversationSid?: string;
  waFrom?: string;
  waProfileName?: string;
  lastInboundBody?: string;
  humanHandoffRequested?: boolean;
  pendingDemoForm?: boolean;
  leadStatus?: LeadStatus;
  notes?: string;
  email?: string;
  budget?: string;
  assignedUid?: string | null;
}

export async function fetchConversationsToken(options?: {
  /** Forces a fresh Firebase ID token before calling the API (long-lived tabs). */
  forceRefreshFirebaseIdToken?: boolean;
}): Promise<{
  token: string;
  identity: string;
  serviceSid: string;
  region?: string;
}> {
  if (options?.forceRefreshFirebaseIdToken && auth.currentUser) {
    await auth.currentUser.getIdToken(true);
  }

  const base = getApiBaseUrl();
  const res = await fetch(`${base}/twilio-inbox/conversations/token`, {
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      data.code === 'USER_PROFILE_NOT_FOUND'
        ? ' Add a Firestore users/{yourUid} document with role associate, admin, or superadmin.'
        : '';
    throw new Error((data.message || data.error || `Token ${res.status}`) + hint);
  }
  return {
    token: data.token,
    identity: data.identity,
    serviceSid: data.serviceSid,
    ...(typeof data.region === 'string' && data.region.trim()
      ? { region: data.region.trim() }
      : {}),
  };
}

export async function fetchConversationSummaries(): Promise<{
  items: ConversationSummaryDto[];
  emptyHint: string | null;
}> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/twilio-inbox/conversations`, {
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Conversation list ${res.status}`);
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    emptyHint: typeof data.emptyHint === 'string' ? data.emptyHint : null,
  };
}

export async function joinInboxConversation(conversationSid: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/twilio-inbox/conversations/${encodeURIComponent(conversationSid)}/join`,
    {
      method: 'POST',
      headers: await authHeaders(),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Join ${res.status}`);
  }
}

export async function getConversationMeta(conversationSid: string): Promise<{
  meta: WhatsAppInboxMetaDto | null;
  docId: string;
}> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/twilio-inbox/conversations/${encodeURIComponent(conversationSid)}/meta`,
    { headers: await authHeaders() },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Meta ${res.status}`);
  }
  return { meta: data.meta, docId: data.docId };
}

export async function patchConversationMeta(
  conversationSid: string,
  patch: Partial<{
    leadStatus: LeadStatus;
    notes: string;
    email: string;
    budget: string;
    humanHandoffRequested: boolean;
    pendingDemoForm: boolean;
    assignedUid: string | null;
  }>,
): Promise<{ meta: WhatsAppInboxMetaDto | null }> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/twilio-inbox/conversations/${encodeURIComponent(conversationSid)}/meta`,
    {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `PATCH meta ${res.status}`);
  }
  return { meta: data.meta };
}

export async function sendConversationMessage(
  conversationSid: string,
  body: string,
): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/twilio-inbox/conversations/${encodeURIComponent(conversationSid)}/messages`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ body }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Send ${res.status}`);
  }
}

export async function sendWhatsAppTemplate(body: {
  to: string;
  contentSid: string;
  contentVariables?: Record<string, string>;
}): Promise<{ sid?: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/twilio-inbox/messaging/send-template`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Template ${res.status}`);
  }
  return { sid: data.sid };
}
