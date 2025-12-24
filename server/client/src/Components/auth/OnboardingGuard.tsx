import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * OnboardingGuard checks if the user has completed onboarding.
 * If not, it redirects to the onboarding page.
 * This should be used inside ProtectedRoute to ensure user is authenticated first.
 */
export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setHasCompletedOnboarding(userData.onboardingCompleted === true);
        } else {
          setHasCompletedOnboarding(false);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to not completed if there's an error
        setHasCompletedOnboarding(false);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If user hasn't completed onboarding and isn't already on onboarding page
  if (!hasCompletedOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingGuard;

