import React from 'react';
import { SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import { razorpayService } from '../services/razorpayService';
import { toast } from 'react-hot-toast';

interface PricingTiersProps {
  currentSubscription?: {
    planId: string;
  };
}

export const PricingTiers: React.FC<PricingTiersProps> = ({ currentSubscription }) => {
  const { user } = useAuth();

  const handleSelectPlan = async (planId: string) => {
    console.log('handleSelectPlan called with planId:', planId);
    console.log('Current user:', user);

    if (!user || !user.email) {
      console.log('No user or email found');
      toast.error('Please sign in to upgrade your plan');
      return;
    }

    try {
      console.log('Attempting to initialize payment...');
      await razorpayService.initializePayment(planId, user.email, user.uid);
      console.log('Payment initialization successful');
      toast.success('Payment successful! Your plan will be updated shortly.');
    } catch (error) {
      console.error('Payment error details:', error);
      if (error instanceof Error && error.message === 'Payment cancelled') {
        toast.error('Payment was cancelled');
      } else {
        console.error('Payment error:', error);
        toast.error('Failed to process payment. Please try again.');
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {SUBSCRIPTION_PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`
            bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border 
            ${currentSubscription?.planId === plan.id 
              ? 'border-blue-500/50' 
              : 'border-gray-700/50'
            }
          `}
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
            <div className="text-3xl font-bold text-white mb-4">
              ₹{plan.price}
              <span className="text-sm text-gray-400">/{plan.billingCycle}</span>
            </div>

            <div className="mb-6 text-sm text-gray-300">
              {plan.limits.skyboxGenerations === Infinity 
                ? 'Unlimited generations'
                : `${plan.limits.skyboxGenerations} generations per month`
              }
            </div>

            <ul className="text-sm text-gray-300 space-y-2 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg
                    className="w-4 h-4 text-green-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan(plan.id)}
              disabled={currentSubscription?.planId === plan.id}
              className={`
                w-full px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${currentSubscription?.planId === plan.id
                  ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transform hover:-translate-y-0.5 active:translate-y-0'}
              `}
            >
              {currentSubscription?.planId === plan.id ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}; 