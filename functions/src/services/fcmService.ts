/**
 * Send FCM push notification to all tokens registered for a user.
 * Used by user/school approval triggers after creating in-app notification.
 */

import * as admin from 'firebase-admin';

export interface SendFcmOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Reads FCM tokens from users/{userId}/fcm_tokens and sends a push to each.
 * Removes token documents when FCM returns invalid/unregistered so we don't retry.
 */
export async function sendFcmToUser(options: SendFcmOptions): Promise<void> {
  const { userId, title, body, data = {} } = options;
  const db = admin.firestore();
  const messaging = admin.messaging();
  const tokensRef = db.collection('users').doc(userId).collection('fcm_tokens');
  const snapshot = await tokensRef.get();
  if (snapshot.empty) return;

  const tokens: { token: string; id: string }[] = [];
  snapshot.docs.forEach((doc) => {
    const token = doc.data().token;
    if (typeof token === 'string' && token.length > 0) {
      tokens.push({ token, id: doc.id });
    }
  });
  if (tokens.length === 0) return;

  const tokenStrings = tokens.map((t) => t.token);
  const payload: admin.messaging.MulticastMessage = {
    tokens: tokenStrings,
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    android: { priority: 'high' as const },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  try {
    const response = await messaging.sendEachForMulticast(payload);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error && tokens[idx]) {
          const code = (resp.error as { code?: string }).code;
          if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
            tokensRef.doc(tokens[idx].id).delete().catch((err) => console.warn('FCM token cleanup delete failed:', err));
          }
        }
      });
    }
  } catch (err) {
    console.error('sendFcmToUser failed:', err);
  }
}
