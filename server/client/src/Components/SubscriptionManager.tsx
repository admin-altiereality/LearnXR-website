import React, { useEffect, useState } from 'react';
import { SUBSCRIPTION_PLANS, subscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import { UserSubscription } from '../types/subscription';

export const SubscriptionManager: React.FC = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);

  useEffect(() => {
    const loadSubscription = async () => {
      if (user?.uid) {
        const userSubscription = await subscriptionService.getUserSubscription(user.uid);
        setSubscription(userSubscription);
      }
    };
    
    loadSubscription();
  }, [user?.uid]);

  const handleUpgrade = async (planId: string) => {
    if (!user) return;
    // Will implement Razorpay integration here
    console.log('Upgrading to plan:', planId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {SUBSCRIPTION_PLANS.map((plan) => (
        <div key={plan.id} className={`
          bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border 
          ${subscription?.planId === plan.id 
            ? 'border-blue-500/50' 
            : 'border-gray-700/50'
          }
        `}>
          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          
          {/* Usage display for current plan */}
          {subscription?.planId === plan.id && (
            <div className="mt-2">
              <div className="h-2 w-full bg-gray-700/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500/50"
                  style={{ 
                    width: `${Math.min((subscription.usage.count / subscription.usage.limit) * 100, 100)}%`
                  }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {subscription.usage.count} / {subscription.usage.limit} generations used
              </p>
            </div>
          )}

          <div className="mt-2">
            <span className="text-2xl font-bold text-white">
              ₹{plan.price}
            </span>
            <span className="text-gray-400">/month</span>
          </div>
          
          <ul className="mt-6 space-y-4">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center text-gray-300">
                <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleUpgrade(plan.id)}
            disabled={subscription?.planId === plan.id}
            className={`mt-8 w-full px-4 py-2 rounded-lg transition-all duration-200 
              ${subscription?.planId === plan.id
                ? 'bg-green-500/20 text-green-300 border border-green-500/30 cursor-not-allowed'
                : 'bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30'
              }`}
          >
            {subscription?.planId === plan.id ? 'Current Plan' : 'Upgrade'}
          </button>
        </div>
      ))}
    </div>
  );
};