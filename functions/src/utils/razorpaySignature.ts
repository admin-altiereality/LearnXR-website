import crypto from 'crypto';
import { getSecret } from './config';
import { timingSafeEqualString } from './crypto';

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string | undefined,
): boolean {
  if (!orderId || !paymentId || !signature) return false;
  const secret = getSecret('RAZORPAY_KEY_SECRET');
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret.trim())
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafeEqualString(expected, signature);
}
