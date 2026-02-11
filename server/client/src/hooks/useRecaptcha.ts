/**
 * Hook to load reCAPTCHA v3 script and execute invisible verification.
 * Used on Secret Backend Login. No visible widget - runs on form submit.
 */

import { useCallback, useEffect, useState } from 'react';

const RECAPTCHA_SCRIPT_ID = 'recaptcha-v3-script';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
    __recaptchaV3OnLoad?: () => void;
  }
}

export interface UseRecaptchaOptions {
  siteKey: string | undefined;
}

export interface UseRecaptchaReturn {
  isReady: boolean;
  execute: (action?: string) => Promise<string>;
  error: string | null;
}

/**
 * Load reCAPTCHA v3 script and provide execute function.
 * Script URL: https://www.google.com/recaptcha/api.js?render=SITE_KEY
 */
export function useRecaptcha({ siteKey }: UseRecaptchaOptions): UseRecaptchaReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (action = 'login'): Promise<string> => {
      if (!siteKey || !siteKey.trim()) {
        throw new Error('reCAPTCHA is not configured');
      }
      if (typeof window === 'undefined' || !window.grecaptcha) {
        throw new Error('reCAPTCHA is not loaded');
      }
      return window.grecaptcha.execute(siteKey, { action });
    },
    [siteKey]
  );

  useEffect(() => {
    if (!siteKey || siteKey.trim() === '') {
      setError('reCAPTCHA is not configured');
      return;
    }

    const onReady = () => {
      setIsReady(true);
      setError(null);
    };

    const onRecaptchaLoaded = () => {
      window.grecaptcha?.ready(onReady);
    };

    if (window.grecaptcha) {
      window.grecaptcha.ready(onReady);
      return;
    }

    const existing = document.getElementById(RECAPTCHA_SCRIPT_ID);
    if (existing) {
      if (window.grecaptcha) {
        window.grecaptcha.ready(onReady);
      } else {
        window.__recaptchaV3OnLoad = onRecaptchaLoaded;
      }
      return;
    }

    window.__recaptchaV3OnLoad = onRecaptchaLoaded;
    const script = document.createElement('script');
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(onReady);
      } else if (window.__recaptchaV3OnLoad) {
        window.__recaptchaV3OnLoad();
      }
    };
    script.onerror = () => {
      setError('Could not load reCAPTCHA');
    };
    document.head.appendChild(script);

    return () => {
      window.__recaptchaV3OnLoad = undefined;
    };
  }, [siteKey]);

  return {
    isReady,
    execute,
    error,
  };
}
