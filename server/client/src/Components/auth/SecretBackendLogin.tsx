/**
 * Secret backend login - Staff only (Admin, Super Admin, Associate).
 * Not linked from the main app. Only these roles can use this entry point.
 * URL: /secretbackend
 * Protected by reCAPTCHA v3 (invisible, score-based) when VITE_RECAPTCHA_SITE_KEY is set.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEnvelope, FaEye, FaEyeSlash, FaLock, FaRedo, FaShieldAlt } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useRecaptcha } from '../../hooks/useRecaptcha';
import { verifyRecaptchaToken } from '../../services/recaptchaService';
import { getDefaultPage } from '../../utils/rbac';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const STAFF_ROLES = ['admin', 'superadmin', 'associate'] as const;

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

/** Domain error troubleshooting UI with copy button */
const DomainRecaptchaError = ({ onRetry }: { onRetry: () => void }) => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const copyDomain = () => {
    if (host && navigator.clipboard) {
      navigator.clipboard.writeText(host);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-4 text-sm space-y-3">
      <p className="font-medium text-amber-600 dark:text-amber-400">
        reCAPTCHA domain not allowed yet
      </p>
      <p className="text-muted-foreground">
        Add this <strong className="text-foreground">exact</strong> domain to your reCAPTCHA key:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded bg-muted/80 text-foreground text-xs break-all font-mono">
          {host}
        </code>
        {navigator.clipboard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={copyDomain}
          >
            Copy
          </Button>
        )}
      </div>
      <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
        <li>Use <strong>double hyphen</strong> (<code>--</code>) for Firebase preview channels</li>
        <li>Add it to the key matching your Site Key in .env</li>
        <li>Domain changes can take <strong>5–10 minutes</strong> to apply</li>
        <li>Try <strong>hard refresh</strong> (Ctrl+Shift+R) or <strong>incognito</strong> after adding</li>
      </ul>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          I&apos;ve added it — Retry
        </Button>
        <a
          href="https://www.google.com/recaptcha/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-xs underline hover:no-underline"
        >
          Open reCAPTCHA Admin →
        </a>
      </div>
    </div>
  );
};

export const SecretBackendLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);
  const { user, profile, login, logout, loading, profileLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const recaptcha = useRecaptcha({ siteKey: RECAPTCHA_SITE_KEY });
  const recaptchaRequired = Boolean(RECAPTCHA_SITE_KEY?.trim());

  useEffect(() => {
    if (loading || profileLoading || !user) return;
    if (!profile) return;

    const role = profile.role?.toLowerCase();
    if (STAFF_ROLES.includes(role as any)) {
      setAccessDenied(false);
      navigate(getDefaultPage(profile.role), { replace: true });
    } else {
      setAccessDenied(true);
      setError('Access denied. This login is for staff only (Admin, Super Admin, Associate).');
      logout().catch(() => {});
    }
  }, [user, profile, loading, profileLoading, navigate, logout]);

  const handleRetryProfile = async () => {
    if (!user) return;
    setError('');
    setRetryingProfile(true);
    try {
      await refreshProfile();
    } catch {
      setError('Could not load profile. Try disabling ad blockers or privacy extensions for this site.');
    } finally {
      setRetryingProfile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAccessDenied(false);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (recaptchaRequired) {
      try {
        const token = await recaptcha.execute('login');
        const result = await verifyRecaptchaToken(token);
        if (!result.success) {
          setError(result.error ?? 'Security check failed. Please try again.');
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Security check failed. Please try again.';
        const isDomainError =
          msg.includes('Invalid site key') ||
          msg.includes('not loaded in api.js') ||
          msg.toLowerCase().includes('allowed domain');
        if (isDomainError) {
          setError('domain'); // Special flag to show domain troubleshooting UI
          return;
        }
        setError(msg);
        return;
      }
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (user && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Logged in but profile failed to load (e.g. Firestore blocked by extension)
  if (user && !profileLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md border-amber-500/30 bg-card/95 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg text-amber-600 dark:text-amber-400">Profile could not be loaded</CardTitle>
            <CardDescription className="text-left text-sm text-muted-foreground space-y-2">
              <p>You are signed in, but your profile could not be loaded. This often happens when a browser extension blocks Firestore (e.g. ad blocker, privacy or cookie blocker).</p>
              <p><strong>Try this:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Disable ad blockers or privacy extensions for this site</li>
                <li>Whitelist <code className="text-xs bg-muted px-1 rounded">firestore.googleapis.com</code></li>
                <li>Use an incognito/private window with extensions disabled</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={handleRetryProfile} disabled={retryingProfile}>
              {retryingProfile ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading...
                </span>
              ) : (
                <>
                  <FaRedo className="w-4 h-4 mr-2" />
                  Retry loading profile
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => logout().then(() => setError(''))}>
              Sign out and try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="w-full max-w-md border-border bg-card/95 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 mb-2">
            <FaShieldAlt className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">Staff Login</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Admin, Super Admin & Associate only
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accessDenied && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!accessDenied && error && error !== 'domain' && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!accessDenied && error === 'domain' && (
            <DomainRecaptchaError onRetry={() => setError('')} />
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret-email" className="text-foreground">Email</Label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="secret-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-background border-border"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-password" className="text-foreground">Password</Label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="secret-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 bg-background border-border"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {recaptchaRequired && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      recaptcha.isReady ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {recaptcha.isReady ? (
                      <FaShieldAlt className="h-4 w-4" />
                    ) : (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Protected by reCAPTCHA</p>
                    <p className="text-xs text-muted-foreground">
                      {recaptcha.isReady
                        ? 'Security check ready. Your sign-in is protected against bots.'
                        : 'Loading security check...'}
                    </p>
                  </div>
                </div>
                {recaptcha.error &&
                  (recaptcha.error.toLowerCase().includes('allowed domain') ||
                    recaptcha.error.includes('Invalid site key') ||
                    recaptcha.error.includes('not loaded') ? (
                    <div className="mt-2">
                      <DomainRecaptchaError onRetry={() => window.location.reload()} />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-destructive">{recaptcha.error}</p>
                  ))}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || (recaptchaRequired && !recaptcha.isReady)}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            This page is not linked from the main site. Only staff with Admin, Super Admin, or Associate role can access the app from here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
