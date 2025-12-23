import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserSubscription } from '../types/subscription';
import { subscriptionService } from '../services/subscriptionService';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  subscription: UserSubscription | null;
  loading: boolean;
  hasActivePaidSubscription: boolean;
  isFreePlan: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const hasActivePaidSubscription = subscription 
    ? subscription.planId !== 'free' && subscription.status === 'active'
    : false;

  const isFreePlan = subscription?.planId === 'free' || !subscription;

  const fetchSubscription = async () => {
    if (!user?.uid) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userSubscription = await subscriptionService.getUserSubscription(user.uid);
      setSubscription(userSubscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user?.uid]);

  const refreshSubscription = async () => {
    await fetchSubscription();
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        hasActivePaidSubscription,
        isFreePlan,
        refreshSubscription
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

