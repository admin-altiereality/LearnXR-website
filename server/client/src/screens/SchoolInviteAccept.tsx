import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { claimSchoolInvite } from '../services/partnerService';
import { Button } from '../Components/ui/button';
import { getDefaultPage } from '../utils/rbac';

/**
 * Public invite landing: authenticated users claim school-admin access via token.
 * Partners share /invite/school?token=... — never a shared password.
 */
const SchoolInviteAccept = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [claiming, setClaiming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setError('Missing invite token');
  }, [token]);

  const handleClaim = async () => {
    if (!token || !user) return;
    setClaiming(true);
    setError(null);
    try {
      const result = await claimSchoolInvite(token);
      toast.success(result.message || 'School access granted');
      setDone(true);
      if (typeof refreshProfile === 'function') {
        await refreshProfile();
      }
      // Force token refresh so role claim updates
      await user.getIdToken(true);
      navigate('/dashboard/school', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to claim invite');
      toast.error(err?.message || 'Failed to claim invite');
    } finally {
      setClaiming(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full border border-border rounded-xl p-6 space-y-4 bg-card">
        <h1 className="text-xl font-semibold">School admin invite</h1>
        <p className="text-sm text-muted-foreground">
          Accept this invite to become the school administrator for a LearnXR partner demo school.
          You will use your own login — no shared passwords.
        </p>

        {!token && <p className="text-sm text-destructive">This invite link is invalid.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {done && <p className="text-sm text-green-600">Access granted. Redirecting…</p>}

        {!user ? (
          <div className="space-y-2">
            <p className="text-sm">Sign in or create an account, then return to this link.</p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to={`/login?redirect=${encodeURIComponent(`/invite/school?token=${token}`)}`}>
                  Log in
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/signup?redirect=${encodeURIComponent(`/invite/school?token=${token}`)}`}>
                  Sign up
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="text-foreground font-medium">{user.email}</span>
              {profile?.role ? ` (${profile.role})` : ''}
            </p>
            <Button disabled={!token || claiming || done} onClick={handleClaim} className="w-full">
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept school admin access'}
            </Button>
            {profile?.role === 'school' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(getDefaultPage('school'))}
              >
                Go to school dashboard
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolInviteAccept;
