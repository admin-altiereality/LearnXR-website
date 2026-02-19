/**
 * Firestore trigger: chapter_edit_requests/{requestId}
 * Sends email when status changes to 'approved' or 'rejected'
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import {
  sendEditRequestApprovedEmail,
  sendEditRequestRejectedEmail,
} from '../services/emailService';
import { createNotification } from '../services/notificationService';

const emailjsServiceId = defineSecret('EMAILJS_SERVICE_ID');
const emailjsTemplateId = defineSecret('EMAILJS_TEMPLATE_ID');
const emailjsPublicKey = defineSecret('EMAILJS_PUBLIC_KEY');
const emailjsPrivateKey = defineSecret('EMAILJS_PRIVATE_KEY');

export const onEditRequestStatusChange = onDocumentUpdated(
  {
    document: 'chapter_edit_requests/{requestId}',
    secrets: [emailjsServiceId, emailjsTemplateId, emailjsPublicKey, emailjsPrivateKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const beforeStatus = before.status;
    const afterStatus = after.status;
    if (beforeStatus === afterStatus) return;
    if (afterStatus !== 'approved' && afterStatus !== 'rejected') return;

    process.env.EMAILJS_SERVICE_ID = emailjsServiceId.value();
    process.env.EMAILJS_TEMPLATE_ID = emailjsTemplateId.value();
    process.env.EMAILJS_PUBLIC_KEY = emailjsPublicKey.value();
    process.env.EMAILJS_PRIVATE_KEY = emailjsPrivateKey.value();

    let email = after.requestedByEmail;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const requestedBy = after.requestedBy;
      if (requestedBy) {
        const userDoc = await admin.firestore().collection('users').doc(requestedBy).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          email = data?.email;
        }
      }
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.warn('onEditRequestStatusChange: No valid email for request', event.params.requestId);
      return;
    }

    const chapterName = after.chapterName || 'the chapter';

    const requestedBy = after.requestedBy;
    if (afterStatus === 'approved') {
      const result = await sendEditRequestApprovedEmail(email, chapterName);
      if (!result.success) {
        console.error('onEditRequestStatusChange: sendEditRequestApprovedEmail failed', result.error);
      }
      if (requestedBy) {
        await createNotification({
          userId: requestedBy,
          type: 'edit_request_approved',
          title: 'Edit request approved',
          message: `Your edit request for "${chapterName}" has been approved.`,
          link: '/main',
        });
      }
    } else {
      const result = await sendEditRequestRejectedEmail(email, chapterName);
      if (!result.success) {
        console.error('onEditRequestStatusChange: sendEditRequestRejectedEmail failed', result.error);
      }
      if (requestedBy) {
        await createNotification({
          userId: requestedBy,
          type: 'edit_request_rejected',
          title: 'Edit request update',
          message: `Your edit request for "${chapterName}" was not approved.`,
          link: '/main',
        });
      }
    }
  }
);
