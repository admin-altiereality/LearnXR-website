/**
 * Notifications routes - welcome email, etc.
 * POST /notifications/welcome - send welcome email (called after signup)
 * POST /notifications/test - send test email to verify EmailJS (auth required)
 */

import { Router, Request, Response } from 'express';
import { sendWelcomeEmail } from '../services/emailService';

const router = Router();

router.post('/test', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.email) {
      res.status(401).json({ success: false, error: 'Must be logged in with an email' });
      return;
    }
    const email = (req.body?.email as string) || user.email;
    const name = user.name || user.email?.split('@')[0] || 'there';
    const result = await sendWelcomeEmail(email, name);
    if (result.success) {
      res.json({ success: true, message: `Test email sent to ${email}` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    console.error('POST /notifications/test error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

router.post('/welcome', async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'email is required' });
      return;
    }
    const result = await sendWelcomeEmail(email, name || email.split('@')[0]);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    console.error('POST /notifications/welcome error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

export default router;
