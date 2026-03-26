import { inboxConversationsIdentity } from './twilioInboxStaffParticipant';

/** Flat urlencoded fields Twilio sends for Conversations webhooks (+ Programmable Messaging). */
export type TwilioInboundBody = Record<string, string | undefined>;

export type NormalizedTwilioInbound = {
  conversationSid?: string;
  from?: string;
  body: string;
  profileName?: string;
  messageSid?: string;
  eventType?: string;
  shouldSyncMeta: boolean;
};

function parseProfileFromAttributes(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const name = j.profile_name ?? j.ProfileName ?? j.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  } catch {
    /* ignore */
  }
  return undefined;
}

function str(b: TwilioInboundBody, key: string): string {
  return String(b[key] ?? '').trim();
}

/**
 * Map Twilio Conversations webhook posts (EventType + flat keys) and classic Messaging webhooks
 * into fields used by the WhatsApp inbox Firestore layer.
 */
export function normalizeTwilioInboundBody(body: TwilioInboundBody): NormalizedTwilioInbound {
  const eventType = str(body, 'EventType');
  const staffId = inboxConversationsIdentity();

  if (eventType === 'onMessageAdded') {
    const conversationSid = str(body, 'ConversationSid') || undefined;
    const text = str(body, 'Body');
    const author = str(body, 'Author');
    if (
      author &&
      author.toLowerCase() !== staffId.toLowerCase() &&
      !author.toLowerCase().startsWith('whatsapp:')
    ) {
      return { body: text, conversationSid, eventType, shouldSyncMeta: false };
    }
    return {
      conversationSid,
      from: author && author.toLowerCase().startsWith('whatsapp:') ? author : author || undefined,
      body: text,
      profileName: parseProfileFromAttributes(str(body, 'Attributes') || undefined),
      messageSid: str(body, 'MessageSid') || undefined,
      eventType,
      shouldSyncMeta: !!conversationSid,
    };
  }

  if (eventType === 'onParticipantAdded') {
    const conversationSid = str(body, 'ConversationSid') || undefined;
    const bindingType = str(body, 'MessagingBinding.Type').toUpperCase();
    const addr = str(body, 'MessagingBinding.Address') || undefined;
    const isWa =
      bindingType === 'WHATSAPP' || (addr?.toLowerCase().startsWith('whatsapp:') ?? false);
    if (!isWa || !addr || !conversationSid) {
      return { body: '', eventType, shouldSyncMeta: false };
    }
    return {
      conversationSid,
      from: addr,
      body: '',
      profileName: parseProfileFromAttributes(str(body, 'Attributes') || undefined),
      eventType,
      shouldSyncMeta: true,
    };
  }

  if (eventType) {
    return { body: '', eventType, shouldSyncMeta: false };
  }

  const from = str(body, 'From') || undefined;
  const text = str(body, 'Body');
  const conversationSid =
    str(body, 'ConversationSid') ||
    str(body, 'CommunicationSid') ||
    str(body, 'ChatSid') ||
    undefined;
  const profileName = str(body, 'ProfileName') || undefined;
  return {
    from,
    body: text,
    profileName,
    conversationSid,
    messageSid: str(body, 'MessageSid') || undefined,
    shouldSyncMeta: true,
  };
}
