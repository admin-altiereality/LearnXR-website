import { useEffect, useState } from 'react';
import { FaArrowLeft, FaEnvelope, FaEye, FaEyeSlash, FaHandshake, FaLock } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultPage } from '../../utils/rbac';
import { recordPartnerHeartbeat } from '../../services/partnerService';
import FuturisticBackground from '../FuturisticBackground';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export const PartnerLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, profile, loading, profileLoading, login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || profileLoading || !user || !profile) return;

    if (profile.role === 'partner') {
      if (sessionStorage.getItem('partner_login_pulse') === '1') {
        sessionStorage.removeItem('partner_login_pulse');
        recordPartnerHeartbeat('login').catch(() => {});
      }
      navigate(getDefaultPage(profile.role), { replace: true });
      return;
    }

    setError('This account is not a Channel Partner account.');
    logout().catch(() => {});
  }, [loading, profileLoading, user, profile, navigate, logout]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your partner email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      sessionStorage.setItem('partner_login_pulse', '1');
    } catch {
      setError('We could not sign you in. Check your email and password, or use the password setup link from your approval email.');
    } finally {
      setIsLoading(false);
    }
  };

  if (user && (loading || profileLoading)) {
    return (
      <FuturisticBackground className="flex h-[100dvh] w-screen items-center justify-center p-4">
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verifying partner access...</p>
        </div>
      </FuturisticBackground>
    );
  }

  return (
    <FuturisticBackground className="flex min-h-[100dvh] w-full items-center justify-center p-4 sm:p-6">
      <Card className="relative w-full max-w-md overflow-hidden border-teal-400/30 bg-card/90 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-primary" />
        <CardHeader className="space-y-3 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-400/10">
            <FaHandshake className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <CardTitle className="text-2xl">Channel Partner Portal</CardTitle>
            <CardDescription className="mt-2">
              Sign in to manage your schools, demos, and LearnXR partner access.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partner-email">Partner email</Label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="partner-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 border-border bg-background pl-9"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="partner-password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-teal-400 hover:text-teal-300">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="partner-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 border-border bg-background pl-9 pr-10"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="h-11 w-full bg-teal-500 text-slate-950 hover:bg-teal-400" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in to partner portal'}
            </Button>
          </form>
          <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
            New to LearnXR?{' '}
            <Link to="/channel-partners" className="font-medium text-teal-400 hover:text-teal-300">
              Apply to become a partner
            </Link>
          </div>
          <Link to="/login" className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <FaArrowLeft className="h-3 w-3" />
            Other LearnXR sign-in options
          </Link>
        </CardContent>
      </Card>
    </FuturisticBackground>
  );
};
