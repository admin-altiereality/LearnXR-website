import { SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import type { UserSubscription } from '../types/subscription';

interface PricingTiersProps {
  currentSubscription: UserSubscription | null;
  onSelectPlan: (planId: string) => void;
  variant?: 'modal' | 'page';
}

export const PricingTiers = ({
  currentSubscription,
  onSelectPlan,
  variant = 'modal'
}: PricingTiersProps) => {
  return (
    <div className={`grid ${variant === 'modal' ? 'grid-cols-1 md:grid-cols-3 gap-6' : 'grid-cols-1 lg:grid-cols-3 gap-8'}`}>
      {SUBSCRIPTION_PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`
            relative p-6 rounded-lg border transition-all duration-200
            ${currentSubscription?.planId === plan.id
              ? 'bg-blue-500/20 border-blue-500/50'
              : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600/50'}
          `}
        >
          {/* Current Plan Badge */}
          {currentSubscription?.planId === plan.id && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                Current Plan
              </span>
            </div>
          )}

          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
            <div className="text-3xl font-bold text-white mb-4">
              ₹{plan.price}
              <span className="text-sm text-gray-400">/{plan.billingCycle}</span>
            </div>

            {/* Generation Limit Display */}
            <div className="mb-6 text-sm text-gray-300">
              {plan.limits.skyboxGenerations === Infinity 
                ? 'Unlimited generations'
                : `${plan.limits.skyboxGenerations} generations per day`
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
              onClick={() => onSelectPlan(plan.id)}
              disabled={currentSubscription?.planId === plan.id}
              className={`
                w-full px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${currentSubscription?.planId === plan.id
                  ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30'}
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