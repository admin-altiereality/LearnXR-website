import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface SubscriptionRouteProps {
  children: React.ReactNode;
  requirePaid?: boolean;
  redirectTo?: string;
}

/**
 * Route guard that checks subscription status
 * - If requirePaid is true, redirects to pricing if user doesn't have paid subscription
 * - If requirePaid is false or undefined, allows access to all authenticated users
 */
export const SubscriptionRoute = ({ 
  children, 
  requirePaid = false,
  redirectTo = '/pricing'
}: SubscriptionRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasActivePaidSubscription, loading: subscriptionLoading, isFreePlan } = useSubscription();

  // Show loading state while checking auth or subscription
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

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If paid subscription is required but user doesn't have one, redirect to pricing
  if (requirePaid && !hasActivePaidSubscription) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

