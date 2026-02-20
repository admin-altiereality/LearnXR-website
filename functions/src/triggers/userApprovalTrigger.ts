/**
 * Firestore trigger: users/{userId}
 * Sends email when approvalStatus changes to 'approved' or 'rejected'.
 * After onboarding, when super admin approves the user, they receive an email at their registered address.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { sendApprovalEmail, sendRejectionEmail } from '../services/emailService';
import { createNotification } from '../services/notificationService';

const emailjsServiceId = defineSecret('EMAILJS_SERVICE_ID');
const emailjsTemplateId = defineSecret('EMAILJS_TEMPLATE_ID');
const emailjsPublicKey = defineSecret('EMAILJS_PUBLIC_KEY');
const emailjsPrivateKey = defineSecret('EMAILJS_PRIVATE_KEY');

export const onUserApprovalStatusChange = onDocumentUpdated(
  {
    document: 'users/{userId}',
    secrets: [emailjsServiceId, emailjsTemplateId, emailjsPublicKey, emailjsPrivateKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const beforeStatus = before.approvalStatus;
    const afterStatus = after.approvalStatus;
    if (beforeStatus === afterStatus) return;
    if (afterStatus !== 'approved' && afterStatus !== 'rejected') return;

    let email: string | undefined = after.email;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      // Fallback: get email from Firebase Auth (e.g. if user doc was created without it)
      try {
        const authUser = await admin.auth().getUser(event.params.userId);
        email = authUser.email;
      } catch (_) {
        // ignore
      }
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.warn('onUserApprovalStatusChange: No valid email for user', event.params.userId);
      return;
    }

    process.env.EMAILJS_SERVICE_ID = emailjsServiceId.value();
    process.env.EMAILJS_TEMPLATE_ID = emailjsTemplateId.value();
    process.env.EMAILJS_PUBLIC_KEY = emailjsPublicKey.value();
    process.env.EMAILJS_PRIVATE_KEY = emailjsPrivateKey.value();

    const name = after.name || after.displayName || email.split('@')[0];
    const role = after.role || 'user';

    const userId = event.params.userId;
    const roleDisplay = role === 'student' ? 'Student' : role === 'teacher' ? 'Teacher' : 'School Administrator';

    if (afterStatus === 'approved') {
      const result = await sendApprovalEmail(email, name, role);
      if (!result.success) {
        console.error('onUserApprovalStatusChange: sendApprovalEmail failed', result.error);
      }
      await createNotification({
        userId,
        type: 'approval',
        title: 'Account approved',
        message: `Your ${roleDisplay} account has been approved. You can now access all features.`,
        link: '/lessons',
      });
    } else {
      const result = await sendRejectionEmail(email, name, role);
      if (!result.success) {
        console.error('onUserApprovalStatusChange: sendRejectionEmail failed', result.error);
      }
      await createNotification({
        userId,
        type: 'rejection',
        title: 'Account update',
        message: `Your ${roleDisplay} account application was not approved. Contact your administrator if you have questions.`,
      });
    }
  }
);
