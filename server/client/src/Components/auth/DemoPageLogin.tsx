/**
 * Demo page login – predefined credentials only.
 * URL: /demopage
 * User enters the provided demo password; backend validates and returns a custom token.
 * On success, user is signed in as demo user and redirected to /lessons where only
 * Superadmin-marked demo lessons are playable (rest visible but blurred).
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaLock, FaRocket } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { isDemoUser } from '../../utils/rbac';
import api from '../../config/axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const DEMO_EMAIL_PLACEHOLDER = 'demo@learnxr.demo';

export const DemoPageLogin = () => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, profile, login, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (loading || profileLoading || !user || !profile) return;
    if (!isDemoUser(profile)) return;
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    navigate('/lessons', { replace: true });
  }, [user, profile, loading, profileLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) {
      setError('Please enter the demo password.');
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await api.post<{ success: boolean; error?: string }>('/auth/demo-token', {
        password: password.trim(),
      });
      if (!data.success) {
        setError(data.error || 'Invalid demo credentials');
        return;
      }
      await login(DEMO_EMAIL_PLACEHOLDER, password.trim());
      // Navigation is handled by useEffect when profile is loaded (avoids double navigate / throttling)
    } catch (err: any) {
      const res = err?.response?.data;
      const message = res?.error || err?.message || 'Demo login failed. Check the password and try again.';
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
          <p className="text-muted-foreground">Verifying...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="w-full max-w-md border-border bg-card/95 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 mb-2">
            <FaRocket className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">Demo Access</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Enter the provided demo password to explore lessons. Only lessons marked as demo by your administrator are playable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-email" className="text-foreground">Email</Label>
              <Input
                id="demo-email"
                type="text"
                value={DEMO_EMAIL_PLACEHOLDER}
                readOnly
                disabled
                className="bg-muted/50 border-border text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-password" className="text-foreground">Password</Label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="demo-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter demo password"
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                'Enter Demo'
              )}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            This page is for demo access only. You will see all lessons; only those marked as demo can be played. Class join and student dashboard use sample data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
