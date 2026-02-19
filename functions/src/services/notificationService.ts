/**
 * In-app notification service - writes to user_notifications subcollection
 * Called from approval/edit request triggers after sending email
 */

import * as admin from 'firebase-admin';

export type NotificationType =
  | 'approval'
  | 'rejection'
  | 'school_approved'
  | 'school_rejected'
  | 'edit_request_approved'
  | 'edit_request_rejected';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  try {
    const db = admin.firestore();
    const ref = db.collection('user_notifications').doc(input.userId).collection('items').doc();
    await ref.set({
      type: input.type,
      title: input.title,
      message: input.message,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      link: input.link || null,
      metadata: input.metadata || null,
    });
    return ref.id;
  } catch (err) {
    console.error('createNotification failed:', err);
    return null;
  }
}
