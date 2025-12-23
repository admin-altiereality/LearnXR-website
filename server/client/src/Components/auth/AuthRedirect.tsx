import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';

/**
 * Component that redirects authenticated users based on their subscription status
 * - Free plan users: redirect to onboarding or main
 * - Paid plan users: redirect to main
 * - Unauthenticated users: stay on current page
 */
interface AuthRedirectProps {
  children: React.ReactNode;
  redirectFreeTo?: string;
  redirectPaidTo?: string;
  skipRedirect?: boolean;
}

export const AuthRedirect = ({ 
  children, 
  redirectFreeTo = '/onboarding',
  redirectPaidTo = '/main',
  skipRedirect = false
}: AuthRedirectProps) => {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subscriptionLoading, isFreePlan } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (skipRedirect || authLoading || subscriptionLoading) {
      return;
    }

    if (user) {
      // If user is authenticated, redirect based on subscription
      if (isFreePlan) {
        navigate(redirectFreeTo, { replace: true });
      } else {
        navigate(redirectPaidTo, { replace: true });
      }
    }
  }, [user, subscription, isFreePlan, authLoading, subscriptionLoading, skipRedirect, redirectFreeTo, redirectPaidTo, navigate]);

  // Show loading state while checking auth/subscription
  if (authLoading || subscriptionLoading) {
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

