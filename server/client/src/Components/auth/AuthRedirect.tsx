import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Component that redirects authenticated users
 * - Authenticated users: redirect to main or onboarding
 * - Unauthenticated users: stay on current page
 */
interface AuthRedirectProps {
  children: React.ReactNode;
  redirectTo?: string;
  skipRedirect?: boolean;
}

export const AuthRedirect = ({ 
  children, 
  redirectTo = '/main',
  skipRedirect = false
}: AuthRedirectProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (skipRedirect || authLoading) {
      return;
    }

    if (user) {
      // If user is authenticated, redirect to specified page
      navigate(redirectTo, { replace: true });
    }
  }, [user, authLoading, skipRedirect, redirectTo, navigate]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

