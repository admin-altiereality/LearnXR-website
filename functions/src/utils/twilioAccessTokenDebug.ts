/**
 * Optional structured log of Twilio Access Token JWT shape (no signature verify).
 * Set TWILIO_TOKEN_DEBUG_LOG=true on the Cloud Run service to enable.
 */

export function logTwilioAccessTokenJwtShape(jwtStr: string, expectedIdentity: string): void {
  if (process.env.TWILIO_TOKEN_DEBUG_LOG !== 'true') return;
  try {
    const parts = jwtStr.split('.');
    if (parts.length < 2) {
      console.warn('[twilioInbox] token debug: invalid JWT segments');
      return;
    }
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as {
      exp?: number;
      iat?: number;
      jti?: string;
      grants?: { identity?: string; chat?: { service_sid?: string } };
    };
    console.log('[twilioInbox] TWILIO_TOKEN_DEBUG_LOG token shape', {
      exp: payload.exp,
      iat: payload.iat,
      jtiPrefix: typeof payload.jti === 'string' ? payload.jti.slice(0, 16) : undefined,
      grantIdentity: payload.grants?.identity,
      expectedIdentity,
      chatServiceSid: payload.grants?.chat?.service_sid,
    });
  } catch (e) {
    console.warn('[twilioInbox] token debug decode failed', e);
  }
}
