/**
 * Studio Standalone – no ProtectedRoute. Used by Android app WebView with token-based auth.
 * Prefers Flutter handler getLearnXRIdToken (fresh token at request time); falls back to URL
 * idToken or window.__LEARNXR_ID_TOKEN. Exchanges for customToken; signs in; renders MainSection.
 */

declare global {
  interface Window {
    __LEARNXR_ID_TOKEN?: string;
    flutter_inappwebview?: { callHandler: (name: string, ...args: unknown[]) => Promise<unknown> };
  }
}

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getApiBaseUrl } from '../utils/apiConfig';
import { resolveAllowedApiBase } from '../utils/apiBaseAllowlist';
import MainSection from '../Components/MainSection';

type AuthStatus = 'idle' | 'loading' | 'waiting_token' | 'ready' | 'error';

const TOKEN_WAIT_MS = 5000;

/** Request a fresh idToken from the Flutter WebView handler. Returns '' if not in app or handler unavailable. */
function getTokenFromFlutter(): Promise<string> {
  const w = typeof window !== 'undefined' ? (window as Window) : undefined;
  const tryCall = (): Promise<string> =>
    w?.flutter_inappwebview?.callHandler?.('getLearnXRIdToken')
      .then((t) => (typeof t === 'string' ? t : ''))
      .catch(() => '') ?? Promise.resolve('');

  if (w?.flutter_inappwebview?.callHandler) return tryCall();
  return new Promise((resolve) => {
    const onReady = (): void => {
      window.removeEventListener('flutterInAppWebViewPlatformReady', onReady);
      tryCall().then(resolve);
    };
    window.addEventListener('flutterInAppWebViewPlatformReady', onReady);
    setTimeout(() => {
      window.removeEventListener('flutterInAppWebViewPlatformReady', onReady);
      tryCall().then(resolve);
    }, 2500);
  });
}

export default function StudioStandalone() {
  const [searchParams] = useSearchParams();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundSkybox, setBackgroundSkybox] = useState<string | object | null>(null);
  const authAttempted = useRef(false);

  const runAuth = (idToken: string) => {
    if (authAttempted.current) return;
    authAttempted.current = true;
    setAuthStatus('loading');
    setErrorMessage(null);

    const urlApiBase = searchParams.get('apiBase')?.trim();
    const base = resolveAllowedApiBase(urlApiBase || getApiBaseUrl());

    if (urlApiBase && typeof window !== 'undefined') {
      (window as Window & { __LEARNXR_API_BASE_URL?: string }).__LEARNXR_API_BASE_URL = base;
    }

    console.log('[StudioStandalone] Auth exchange using base:', base);

    const exchangeWithToken = async (token: string, isRetry: boolean): Promise<string> => {
      let res = await fetch(`${base}/auth/custom-token`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.customToken) return data.customToken;
      }
      if (res.status === 401 && !isRetry) {
        const fresh = await getTokenFromFlutter();
        if (fresh) {
          console.log('[StudioStandalone] 401, retrying with fresh token from app');
          return exchangeWithToken(fresh, true);
        }
      }
      res = await fetch(`${base}/auth/custom-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.customToken) return data.customToken;
      }
      if (res.status === 401 && !isRetry) {
        const fresh = await getTokenFromFlutter();
        if (fresh) return exchangeWithToken(fresh, true);
      }
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as { error?: string })?.error || `HTTP ${res.status}`);
    };

    const exchangeToken = async () => {
      const customToken = await exchangeWithToken(idToken.trim(), false);
      await signInWithCustomToken(auth, customToken);
      console.log('[StudioStandalone] Signed in as', auth.currentUser?.uid);
      setAuthStatus('ready');
    };

    exchangeToken().catch((err: Error) => {
      console.error('[StudioStandalone] Auth flow failed:', err?.message || err);
      setAuthStatus('error');
      setErrorMessage(err?.message || 'Authentication failed.');
    });
  };

  useEffect(() => {
    if (authAttempted.current) return;

    if (auth.currentUser) {
      console.log('[StudioStandalone] Already signed in as', auth.currentUser.uid);
      setAuthStatus('ready');
      return;
    }

    const fromUrl = searchParams.get('idToken')?.trim();
    if (fromUrl) {
      runAuth(fromUrl);
      return;
    }

    setAuthStatus('waiting_token');

    const onToken = (token: string) => {
      if (!token || authAttempted.current) return;
      if (typeof window !== 'undefined') (window as Window).__LEARNXR_ID_TOKEN = undefined;
      runAuth(token.trim());
    };

    (async () => {
      const fromFlutter = await getTokenFromFlutter();
      if (fromFlutter && !authAttempted.current) {
        console.log('[StudioStandalone] Using token from Flutter handler');
        onToken(fromFlutter);
        return;
      }
    })();

    const handler = () => {
      const t = typeof window !== 'undefined' ? (window as Window).__LEARNXR_ID_TOKEN : undefined;
      if (t) onToken(t);
    };

    if (typeof window !== 'undefined' && (window as Window).__LEARNXR_ID_TOKEN) {
      onToken((window as Window).__LEARNXR_ID_TOKEN!);
      return;
    }

    window.addEventListener('learnxr-idtoken-ready', handler);
    const poll = setInterval(() => {
      const t = typeof window !== 'undefined' ? (window as Window).__LEARNXR_ID_TOKEN : undefined;
      if (t) {
        clearInterval(poll);
        window.removeEventListener('learnxr-idtoken-ready', handler);
        onToken(t);
      }
    }, 150);

    const timeout = setTimeout(() => {
      clearInterval(poll);
      window.removeEventListener('learnxr-idtoken-ready', handler);
      if (!authAttempted.current) {
        setAuthStatus('error');
        setErrorMessage('Missing idToken. Open this page from the LearnXR app.');
      }
    }, TOKEN_WAIT_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
      window.removeEventListener('learnxr-idtoken-ready', handler);
    };
  }, [searchParams]);

  // Also watch auth state -- if AuthContext happens to sign in first, accept it
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && authStatus !== 'ready') {
        console.log('[StudioStandalone] Auth state changed - user signed in:', user.uid);
        setAuthStatus('ready');
      }
    });
    return unsub;
  }, [authStatus]);

  if (authStatus === 'loading' || authStatus === 'idle' || authStatus === 'waiting_token') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">
            {authStatus === 'waiting_token' ? 'Waiting for app…' : 'Signing you in…'}
          </p>
        </div>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card rounded-xl border border-border p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center">
            <span className="text-destructive text-2xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Cannot load studio</h2>
          <p className="text-muted-foreground text-sm mb-4">{errorMessage}</p>
          <button
            onClick={() => {
              authAttempted.current = false;
              setAuthStatus('idle');
              setErrorMessage(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
          <p className="text-muted-foreground text-xs mt-4">
            Use the AI Tutor or Create tab in the LearnXR app to open this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <MainSection
        setBackgroundSkybox={setBackgroundSkybox}
        backgroundSkybox={backgroundSkybox}
        className="w-full min-h-screen"
      />
    </div>
  );
}
