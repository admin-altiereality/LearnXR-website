/**
 * Secret backend login - Staff only (Admin, Super Admin, Associate).
 * Not linked from the main app. Only these roles can use this entry point.
 * URL: /secretbackend
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEnvelope, FaEye, FaEyeSlash, FaLock, FaRedo, FaShieldAlt } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultPage } from '../../utils/rbac';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const STAFF_ROLES = ['admin', 'superadmin', 'associate'] as const;

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
      <div className="h-[100dvh] w-screen overflow-hidden flex items-center justify-center bg-background p-4">
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
      <div className="h-[100dvh] w-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
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
    <div className="h-[100dvh] w-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
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
          {!accessDenied && error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
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
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
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
