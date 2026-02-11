/**
 * Auth routes for security-sensitive flows (e.g. secret backend login).
 * POST /api/auth/verify-recaptcha - Verify reCAPTCHA v3 token before allowing login.
 */

import express from 'express';

const router = express.Router();

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/** Minimum score (0.0–1.0) to accept. reCAPTCHA v3 returns this; lower = likely bot. */
const RECAPTCHA_MIN_SCORE = 0.5;

interface RecaptchaVerifyRequestBody {
  recaptchaToken?: string;
}

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * POST /api/auth/verify-recaptcha
 * Body: { recaptchaToken: string }
 * Verifies reCAPTCHA v3 token with Google and validates score. Used by Secret Backend Login.
 */
router.post('/verify-recaptcha', async (req, res) => {
  try {
    const { recaptchaToken }: RecaptchaVerifyRequestBody = req.body ?? {};
    const secret = process.env.RECAPTCHA_SECRET_KEY;

    if (!secret) {
      console.warn('RECAPTCHA_SECRET_KEY is not set; reCAPTCHA verification is disabled.');
      return res.status(200).json({ success: true });
    }

    if (!recaptchaToken || typeof recaptchaToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'recaptchaToken is required',
      });
    }

    const params = new URLSearchParams({
      secret,
      response: recaptchaToken,
    });

    const verifyRes = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!verifyRes.ok) {
      console.error('reCAPTCHA verify request failed:', verifyRes.status, await verifyRes.text());
      return res.status(502).json({
        success: false,
        error: 'Verification service unavailable',
      });
    }

    const data = (await verifyRes.json()) as RecaptchaVerifyResponse;

    if (!data.success) {
      const codes = data['error-codes'] ?? [];
      console.warn('reCAPTCHA verification failed:', codes);
      return res.status(400).json({
        success: false,
        error: 'Verification failed',
        errorCodes: codes,
      });
    }

    // reCAPTCHA v3: validate score (v2 tokens don't have score, so we allow them through)
    if (typeof data.score === 'number' && data.score < RECAPTCHA_MIN_SCORE) {
      console.warn('reCAPTCHA score too low:', data.score);
      return res.status(400).json({
        success: false,
        error: 'Security check failed. Please try again.',
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('verify-recaptcha error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
