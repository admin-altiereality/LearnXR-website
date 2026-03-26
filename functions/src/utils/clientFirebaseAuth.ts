/**
 * Verifies Firebase ID tokens issued by the *client* Firebase project (e.g. learnxr-evoneuralai)
 * when Cloud Functions default Admin is lexrn1.
 *
 * Set process.env.LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT to the full JSON of a service account
 * from the client project (Secret Manager on lexrn1: LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT).
 */

import * as admin from 'firebase-admin';
import { initializeAdmin } from './services';

const SECONDARY_APP_NAME = 'learnxr-client-firebase-auth';

let cachedClientAuth: admin.auth.Auth | null | undefined;

function parseServiceAccount(raw: string): admin.ServiceAccount {
  const s = raw.trim();
  if (s.startsWith('{')) {
    return JSON.parse(s) as admin.ServiceAccount;
  }
  return JSON.parse(Buffer.from(s, 'base64').toString('utf8')) as admin.ServiceAccount;
}

/** Returns Auth for the client Firebase project, or null if not configured. */
export function getClientUserAuth(): admin.auth.Auth | null {
  if (cachedClientAuth !== undefined) {
    return cachedClientAuth;
  }

  const raw = process.env.LEARNXR_CLIENT_FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !String(raw).trim()) {
    cachedClientAuth = null;
    return null;
  }

  initializeAdmin();

  try {
    if (admin.apps.some((a) => a?.name === SECONDARY_APP_NAME)) {
      cachedClientAuth = admin.app(SECONDARY_APP_NAME).auth();
      return cachedClientAuth;
    }

    const cred = parseServiceAccount(String(raw));
    const app = admin.initializeApp(
      {
        credential: admin.credential.cert(cred),
      },
      SECONDARY_APP_NAME,
    );
    cachedClientAuth = app.auth();
    return cachedClientAuth;
  } catch (e) {
    console.error('[clientFirebaseAuth] Failed to init client-project Auth:', e);
    cachedClientAuth = null;
    return null;
  }
}

/**
 * Verify a browser Firebase ID token against the client project when configured,
 * otherwise only the default Admin project. If both projects may issue tokens,
 * try client first, then default.
 */
export async function verifyUserIdToken(
  idToken: string,
): Promise<admin.auth.DecodedIdToken> {
  initializeAdmin();
  const clientAuth = getClientUserAuth();
  if (clientAuth) {
    try {
      return await clientAuth.verifyIdToken(idToken);
    } catch {
      // Token may be issued by the Functions' default (lexrn1) Firebase project
    }
  }
  return admin.auth().verifyIdToken(idToken);
}
