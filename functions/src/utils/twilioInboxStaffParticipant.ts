import twilio from 'twilio';

export function inboxConversationsIdentity(): string {
  const raw = (process.env.TWILIO_INBOX_CONVERSATIONS_IDENTITY || 'learnxr_inbox_staff').trim();
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '_');
  return safe || 'learnxr_inbox_staff';
}

/** Add shared staff identity so the JS SDK can subscribe and load messages. */
export async function ensureInboxStaffParticipant(conversationSid: string | undefined | null): Promise<void> {
  if (!conversationSid) return;
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const serviceSid = (process.env.TWILIO_CONVERSATIONS_SERVICE_SID || '').trim();
  if (!accountSid || !authToken || !serviceSid) {
    console.warn('[twilioInboxStaffParticipant] skip: missing Twilio REST env');
    return;
  }
  const identity = inboxConversationsIdentity();
  try {
    const client = twilio(accountSid, authToken);
    await client.conversations.v1
      .services(serviceSid)
      .conversations(conversationSid)
      .participants.create({ identity });
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    const code = e?.code;
    if (
      code === 50209 ||
      code === 50416 ||
      msg.includes('already exists') ||
      msg.includes('is already')
    ) {
      return;
    }
    console.error('[twilioInboxStaffParticipant]', code, e?.message);
  }
}
