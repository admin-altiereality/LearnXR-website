/**
 * reCAPTCHA verification for Secret Backend Login.
 * Sends the token to our backend to verify with Google before allowing login.
 */

import { getApiBaseUrl } from '../utils/apiConfig';

export interface VerifyRecaptchaResult {
  success: boolean;
  error?: string;
}

/**
 * Verify reCAPTCHA token with our backend (which calls Google's API).
 * Returns { success: true } if verification passed, otherwise { success: false, error }.
 */
export async function verifyRecaptchaToken(token: string): Promise<VerifyRecaptchaResult> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/auth/verify-recaptcha`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recaptchaToken: token }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: (data as { error?: string }).error ?? 'Verification failed',
    };
  }

  return {
    success: (data as { success?: boolean }).success === true,
    error: (data as { error?: string }).error,
  };
}
