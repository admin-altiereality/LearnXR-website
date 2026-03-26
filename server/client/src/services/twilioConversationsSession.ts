/**
 * Twilio Conversations JS SDK session: connect, token refresh, teardown.
 */

import { Client, type ConnectionState } from '@twilio/conversations';
import { toast } from 'react-toastify';
import { fetchConversationsToken } from './twilioInboxService';

export type TwilioConnErr = {
  message?: string;
  errorCode?: number;
  httpStatusCode?: number;
  terminal?: boolean;
};

function twilioTokenHint(data?: TwilioConnErr): string {
  if (!data || (data.httpStatusCode !== 401 && data.errorCode !== 20151)) return '';
  return ' If values look right: create a **new standard API key on the same Twilio account as AC…** (subaccounts need keys on that subaccount), paste the **secret** again with no spaces, and for EU data residency set `TWILIO_ACCESS_TOKEN_REGION` on the `api` Cloud Run service (e.g. ie1).';
}

export function formatTwilioError(prefix: string, data?: TwilioConnErr): string {
  const base = data?.message || prefix;
  return base + twilioTokenHint(data);
}

/**
 * Twilio defaults to swallowing init errors unless throwErrorsAlways, which can leave internal state broken.
 */
export function connectTwilioConversationsClient(token: string, region?: string): Promise<Client> {
  const client = new Client(token, {
    throwErrorsAlways: true,
    ...(region ? { region } : {}),
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanupInit = () => {
      client.off(Client.initialized, onOk);
      client.off(Client.initFailed, onFail);
      client.off(Client.connectionError, onConnErr);
    };
    const onOk = () => {
      if (settled) return;
      settled = true;
      cleanupInit();
      resolve(client);
    };
    const onFail = (payload: { error?: TwilioConnErr }) => {
      if (settled) return;
      settled = true;
      cleanupInit();
      reject(new Error(formatTwilioError('Twilio Conversations failed to initialize', payload?.error)));
    };
    const onConnErr = (data: TwilioConnErr) => {
      if (settled) return;
      settled = true;
      cleanupInit();
      reject(new Error(formatTwilioError('Twilio Conversations connection error', data)));
    };
    client.onWithReplay(Client.initialized, onOk);
    client.onWithReplay(Client.initFailed, onFail);
    client.onWithReplay(Client.connectionError, onConnErr);
  });
}

/**
 * Tear down the previous client and open a new session with a fresh JWT (full recycle).
 */
export async function recycleTwilioConversationsClient(
  previous: Client | null,
): Promise<{ client: Client; region?: string }> {
  disconnectTwilioConversationsClient(previous);
  const { token, region } = await fetchConversationsToken({
    forceRefreshFirebaseIdToken: true,
  });
  const client = await connectTwilioConversationsClient(token, region);
  return { client, region };
}

export type TwilioLifecycleOptions = {
  client: Client;
  /** Return false after unmount or when tearing down the client */
  isActive: () => boolean;
  /**
   * When access-token refresh fails, the SDK may be unusable — recycle the Client (shutdown + new token + new Client).
   */
  onTokenRefreshNeedsRecycle?: () => void;
  /** Optional: surface non-recoverable or auxiliary errors (e.g. after recycle is scheduled). */
  onTwilioConnectionProblem?: (message: string) => void;
};

/** Register token rotation, disconnect recovery, and connection logging. Caller should removeAllListeners + shutdown on teardown. */
export function attachTwilioConversationsLifecycle(opts: TwilioLifecycleOptions): void {
  const { client, isActive, onTokenRefreshNeedsRecycle, onTwilioConnectionProblem } = opts;

  let disconnectRecoverInFlight = false;

  const refreshAccessToken = async (): Promise<boolean> => {
    if (!isActive()) return false;
    try {
      const { token } = await fetchConversationsToken({
        forceRefreshFirebaseIdToken: true,
      });
      if (!isActive()) return false;
      await client.updateToken(token);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Twilio token refresh failed';
      if (isActive()) {
        toast.error(msg);
        onTwilioConnectionProblem?.(msg);
      }
      return false;
    }
  };

  const scheduleRecycleIfRefreshFailed = (ok: boolean) => {
    if (!ok && isActive()) onTokenRefreshNeedsRecycle?.();
  };

  client.on(Client.tokenAboutToExpire, () => {
    void refreshAccessToken().then(scheduleRecycleIfRefreshFailed);
  });
  client.on(Client.tokenExpired, () => {
    void refreshAccessToken().then(scheduleRecycleIfRefreshFailed);
  });

  client.on(Client.connectionStateChanged, (state: ConnectionState) => {
    if (import.meta.env.DEV) {
      console.debug('[Twilio] connectionState changed', state);
    }
    if (state !== 'disconnected' || !isActive() || disconnectRecoverInFlight) return;
    disconnectRecoverInFlight = true;
    void (async () => {
      try {
        const ok = await refreshAccessToken();
        scheduleRecycleIfRefreshFailed(ok);
      } finally {
        disconnectRecoverInFlight = false;
      }
    })();
  });
}

export function disconnectTwilioConversationsClient(client: Client | null): void {
  if (!client) return;
  client.removeAllListeners();
  void client.shutdown().catch(() => {});
}
