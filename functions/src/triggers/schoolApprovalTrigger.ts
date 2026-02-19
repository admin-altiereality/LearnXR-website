/**
 * Firestore trigger: schools/{schoolId}
 * Sends email to school admin when school approvalStatus changes to 'approved' or 'rejected'
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { sendSchoolApprovedEmail, sendRejectionEmail } from '../services/emailService';
import { createNotification } from '../services/notificationService';

const emailjsServiceId = defineSecret('EMAILJS_SERVICE_ID');
const emailjsTemplateId = defineSecret('EMAILJS_TEMPLATE_ID');
const emailjsPublicKey = defineSecret('EMAILJS_PUBLIC_KEY');
const emailjsPrivateKey = defineSecret('EMAILJS_PRIVATE_KEY');

async function resolveSchoolUserId(schoolId: string, school?: { createdBy?: string }): Promise<string | null> {
  const db = admin.firestore();
  if (school?.createdBy) return school.createdBy;

  const usersSnap = await db.collection('users')
    .where('role', '==', 'school')
    .where('school_id', '==', schoolId)
    .limit(1)
    .get();
  if (!usersSnap.empty) return usersSnap.docs[0].id;

  const managedSnap = await db.collection('users')
    .where('role', '==', 'school')
    .where('managed_school_id', '==', schoolId)
    .limit(1)
    .get();
  if (!managedSnap.empty) return managedSnap.docs[0].id;

  return null;
}

export const onSchoolApprovalStatusChange = onDocumentUpdated(
  {
    document: 'schools/{schoolId}',
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

    process.env.EMAILJS_SERVICE_ID = emailjsServiceId.value();
    process.env.EMAILJS_TEMPLATE_ID = emailjsTemplateId.value();
    process.env.EMAILJS_PUBLIC_KEY = emailjsPublicKey.value();
    process.env.EMAILJS_PRIVATE_KEY = emailjsPrivateKey.value();

    const schoolId = event.params.schoolId;
    const schoolName = after.name || 'Your school';
    const schoolCode = after.schoolCode || '';

    const userId = await resolveSchoolUserId(schoolId, after);
    if (!userId) {
      console.warn('onSchoolApprovalStatusChange: Could not resolve school admin for', schoolId);
      return;
    }

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.warn('onSchoolApprovalStatusChange: School admin user not found', userId);
      return;
    }

    const userData = userDoc.data();
    const email = userData?.email;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.warn('onSchoolApprovalStatusChange: No valid email for school admin', userId);
      return;
    }

    const name = userData?.name || userData?.displayName || email.split('@')[0];

    if (afterStatus === 'approved') {
      const result = await sendSchoolApprovedEmail(email, schoolName, schoolCode);
      if (!result.success) {
        console.error('onSchoolApprovalStatusChange: sendSchoolApprovedEmail failed', result.error);
      }
      await createNotification({
        userId,
        type: 'school_approved',
        title: 'School approved',
        message: `Your school "${schoolName}" has been approved. Share code ${schoolCode} with teachers.`,
        link: '/lessons',
        metadata: { schoolCode },
      });
    } else {
      const result = await sendRejectionEmail(email, name, 'school');
      if (!result.success) {
        console.error('onSchoolApprovalStatusChange: sendRejectionEmail failed', result.error);
      }
      await createNotification({
        userId,
        type: 'school_rejected',
        title: 'School update',
        message: `Your school "${schoolName}" application was not approved. Contact support if you have questions.`,
      });
    }
  }
);
