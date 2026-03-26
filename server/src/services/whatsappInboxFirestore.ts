/**
 * Denormalized metadata for WhatsApp / Conversations inbox (server/local API).
 */

import * as admin from 'firebase-admin';
import { getAdminApp } from '../config/firebase-admin';

export const WHATSAPP_INBOX_META = 'whatsappInboxMeta';

export type LeadStatus = 'new' | 'follow-up' | 'qualified';

export interface WhatsAppInboxMeta {
  conversationSid?: string;
  waFrom?: string;
  waProfileName?: string;
  lastInboundBody?: string;
  lastInboundAt?: admin.firestore.Timestamp;
  humanHandoffRequested?: boolean;
  pendingDemoForm?: boolean;
  leadStatus?: LeadStatus;
  notes?: string;
  email?: string;
  budget?: string;
  assignedUid?: string | null;
  updatedAt?: admin.firestore.Timestamp;
}

function getDb() {
  const app = getAdminApp();
  if (!app) return null;
  return admin.firestore(app);
}

function sanitizeDocId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 800) || 'unknown';
}

export function metaDocIdForConversation(conversationSid: string): string {
  return sanitizeDocId(conversationSid);
}

export function metaDocIdForWaFrom(waFrom: string): string {
  return `wa_${sanitizeDocId(waFrom)}`;
}

export async function mergeWhatsAppInboxMeta(
  docId: string,
  patch: Partial<WhatsAppInboxMeta>,
): Promise<void> {
  const db = getDb();
  if (!db) {
    console.warn('[whatsappInboxFirestore] Firebase not initialized, skip meta write');
    return;
  }
  const ref = db.collection(WHATSAPP_INBOX_META).doc(docId);
  await ref.set(
    {
      ...patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getWhatsAppInboxMeta(
  docId: string,
): Promise<WhatsAppInboxMeta | null> {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection(WHATSAPP_INBOX_META).doc(docId).get();
  if (!snap.exists) return null;
  return snap.data() as WhatsAppInboxMeta;
}
