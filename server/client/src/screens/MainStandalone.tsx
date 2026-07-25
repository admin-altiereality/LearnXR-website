/**
 * Main Standalone – for mobile app WebView. No in-page fetch for auth.
 * Flutter fetches customToken via native HTTP, then loads this page with #customToken=xxx.
 * Page signs in with signInWithCustomToken and renders MainSection.
 * The teacher avatar is temporarily disabled here so mobile WebView testing
 * can focus on the stable scene-generation flow first.
 */

declare global {
  interface Window {
    __LEARNXR_API_BASE_URL?: string;
  }
}

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getApiBaseUrl } from '../utils/apiConfig';
import { resolveAllowedApiBase } from '../utils/apiBaseAllowlist';
import MainSection from '../Components/MainSection';

type AuthStatus = 'idle' | 'loading' | 'ready' | 'error';

export default function MainStandalone() {
  const [searchParams] = useSearchParams();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundSkybox, setBackgroundSkybox] = useState<string | object | null>(null);
  const authAttempted = useRef(false);

  useEffect(() => {
    if (authAttempted.current) return;

    if (auth.currentUser) {
      setAuthStatus('ready');
      return;
    }

    const urlApiBase = searchParams.get('apiBase')?.trim();
    const base = resolveAllowedApiBase(urlApiBase);
    if (typeof window !== 'undefined') {
      (window as Window & { __LEARNXR_API_BASE_URL?: string }).__LEARNXR_API_BASE_URL = base;
    }

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const match = hash.match(/[#&]customToken=([^&]+)/);
    const customToken = match ? decodeURIComponent(match[1]) : null;

    if (!customToken || !customToken.trim()) {
      setAuthStatus('error');
      setErrorMessage('Missing customToken. Open from the LearnXR app.');
      return;
    }

    authAttempted.current = true;
    setAuthStatus('loading');
    setErrorMessage(null);

    signInWithCustomToken(auth, customToken.trim())
      .then(() => {
        if (typeof window !== 'undefined') {
          const search = window.location.search;
          window.history.replaceState(null, '', window.location.pathname + search);
        }
        setAuthStatus('ready');
      })
      .catch((err: Error) => {
        console.error('[MainStandalone] signInWithCustomToken failed:', err?.message || err);
        setAuthStatus('error');
        setErrorMessage(err?.message || 'Authentication failed.');
        authAttempted.current = false;
      });
  }, [searchParams]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && authStatus !== 'ready') {
        setAuthStatus('ready');
      }
    });
    return unsub;
  }, [authStatus]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Signing you in…</p>
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
        disableTeacherAvatar
        className="w-full min-h-screen"
      />
    </div>
  );
}
