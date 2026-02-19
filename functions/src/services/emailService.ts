/**
 * Email Service - Sends transactional emails via EmailJS
 * No domain verification required (works with Wix-managed DNS)
 * Used by approval triggers and welcome email endpoint
 */

import emailjs from '@emailjs/nodejs';

const LOGIN_URL = process.env.APP_URL || 'https://learnxr.web.app';

function getEmailJsConfig(): { serviceId: string; templateId: string; publicKey: string; privateKey: string } | null {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
  const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn('EmailJS not configured (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY)');
    return null;
  }
  return { serviceId, templateId, publicKey, privateKey };
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

const ROLE_DISPLAY: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  school: 'School Administrator',
  principal: 'Principal',
  admin: 'Admin',
  superadmin: 'Super Admin',
};

/**
 * Core send function - uses a single EmailJS template with to, subject, content params.
 * Template must have: To Email = {{to}}, Subject = {{subject}}, Content = {{{content}}}
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const config = getEmailJsConfig();
  if (!config) return { success: false, error: 'Email service not configured' };

  try {
    await emailjs.send(
      config.serviceId,
      config.templateId,
      { to: to.trim(), subject, content: html },
      { publicKey: config.publicKey, privateKey: config.privateKey }
    );
    return { success: true };
  } catch (err: any) {
    console.error('sendEmail failed:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

export async function sendApprovalEmail(
  to: string,
  name: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(to)) {
    console.warn('sendApprovalEmail: Invalid email', { to });
    return { success: false, error: 'Invalid email' };
  }

  const roleDisplay = ROLE_DISPLAY[role] || role;
  const subject = `Your LearnXR ${roleDisplay} account has been approved!`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Welcome to LearnXR!</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Great news! Your ${roleDisplay} account has been approved. You can now sign in and access all features.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">
      <a href="${LOGIN_URL}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Sign in to LearnXR</a>
    </p>
    <p style="margin:0;font-size:14px;color:#71717a">If you have any questions, contact your administrator.</p>
  </div>
</body>
</html>`;

  return sendEmail(to, subject, html);
}

export async function sendRejectionEmail(
  to: string,
  name: string,
  role: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(to)) {
    console.warn('sendRejectionEmail: Invalid email', { to });
    return { success: false, error: 'Invalid email' };
  }

  const roleDisplay = ROLE_DISPLAY[role] || role;
  const subject = `Update on your LearnXR ${roleDisplay} account`;

  const reasonBlock = reason
    ? `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46"><strong>Reason:</strong> ${reason}</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Account Update</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">We regret to inform you that your ${roleDisplay} account application was not approved at this time.</p>
    ${reasonBlock}
    <p style="margin:0;font-size:14px;color:#71717a">If you believe this was an error, please contact your administrator or support.</p>
  </div>
</body>
</html>`;

  return sendEmail(to, subject, html);
}

export async function sendWelcomeEmail(to: string, name: string): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(to)) {
    console.warn('sendWelcomeEmail: Invalid email', { to });
    return { success: false, error: 'Invalid email' };
  }

  const subject = 'Welcome to LearnXR - Immersive Education Platform';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Welcome to LearnXR!</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Hi ${name || 'there'},</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Thank you for signing up. Complete your profile and onboarding to get started. If your role requires approval, you'll receive an email once approved.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">
      <a href="${LOGIN_URL}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Get Started</a>
    </p>
    <p style="margin:0;font-size:14px;color:#71717a">Happy learning!</p>
  </div>
</body>
</html>`;

  return sendEmail(to, subject, html);
}

export async function sendSchoolApprovedEmail(
  to: string,
  schoolName: string,
  schoolCode: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(to)) {
    console.warn('sendSchoolApprovedEmail: Invalid email', { to });
    return { success: false, error: 'Invalid email' };
  }

  const subject = `Your school "${schoolName}" has been approved on LearnXR`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">School Approved!</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Great news! Your school <strong>${schoolName}</strong> has been approved on LearnXR.</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46">Share this school code with your teachers so they can join:</p>
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#6366f1;letter-spacing:2px">${schoolCode}</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">
      <a href="${LOGIN_URL}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Sign in to LearnXR</a>
    </p>
    <p style="margin:0;font-size:14px;color:#71717a">Teachers will need this code during onboarding to associate with your school.</p>
  </div>
</body>
</html>`;

  return sendEmail(to, subject, html);
}

export async function sendEditRequestApprovedEmail(
  to: string,
  chapterName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(to)) {
    console.warn('sendEditRequestApprovedEmail: Invalid email', { to });
    return { success: false, error: 'Invalid email' };
  }

  const subject = `Your lesson edit request has been approved`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Edit Request Approved</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Your edit request for <strong>${chapterName || 'the chapter'}</strong> has been approved. The changes are now live.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">
      <a href="${LOGIN_URL}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View in LearnXR</a>
    </p>
  </div>
</body>
</html>`;

  return sendEmail(to, subject, html);
}

export async function sendEditRequestRejectedEmail(
  to: string,
  chapterName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(to)) {
    console.warn('sendEditRequestRejectedEmail: Invalid email', { to });
    return { success: false, error: 'Invalid email' };
  }

  const subject = `Update on your lesson edit request`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Edit Request Update</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46">Your edit request for <strong>${chapterName || 'the chapter'}</strong> was not approved. You can submit a new request with revised changes.</p>
    <p style="margin:0;font-size:14px;color:#71717a">Contact your administrator if you have questions.</p>
  </div>
</body>
</html>`;

  return sendEmail(to, subject, html);
}
