import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { razorpayService } from '../services/razorpayService';
import { subscriptionService } from '../services/subscriptionService';
import { toast } from 'react-hot-toast';
import { SUBSCRIPTION_PLANS } from '../services/subscriptionService';

const UpgradeModal = ({ isOpen, onClose, currentPlan, onSubscriptionUpdate }) => {
  const { user } = useAuth();

  const handlePlanSelect = async (planId) => {
    try {
      if (!user || !user.email) {
        toast.error('Please sign in to upgrade your plan');
        return;
      }

      // Show loading toast
      const loadingToast = toast.loading('Initializing payment...');
      
      try {
        await razorpayService.initializePayment(planId, user.email, user.uid);
        toast.dismiss(loadingToast);
        
        // Fetch updated subscription after successful payment
        const updatedSubscription = await subscriptionService.getUserSubscription(user.uid);
        if (onSubscriptionUpdate) {
          onSubscriptionUpdate(updatedSubscription);
        }
        
        toast.success('Payment successful! Your plan will be updated shortly.');
        onClose();
      } catch (error) {
        toast.dismiss(loadingToast);
        throw error;
      }
    } catch (error) {
      console.error('Error handling upgrade:', error);
      if (error instanceof Error && error.message === 'Payment cancelled') {
        toast.error('Payment was cancelled');
      } else {
        toast.error('Failed to process upgrade. Please try again.');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm" />
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 shadow-xl"
            >
              <div className="px-6 py-8">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 
                           border border-white/10 transition-all duration-200 group"
                >
                  <svg className="w-5 h-5 text-white/70 group-hover:text-white/90" 
                       fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-4">Choose Your Plan</h2>
                  <p className="text-gray-300">Select the plan that best fits your needs</p>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative bg-gray-900/30 rounded-lg p-6 border transition-all duration-200 hover:transform hover:-translate-y-1 
                        ${currentPlan === plan.id 
                          ? 'border-blue-500/50 bg-blue-900/10' 
                          : 'border-gray-700/50 hover:border-gray-600/50'}`}
                    >
                      {currentPlan === plan.id && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-blue-500/80 text-white text-xs px-3 py-1 rounded-full">
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

                        <div className="mb-6 text-sm text-gray-300">
                          {plan.limits.skyboxGenerations === Infinity 
                            ? 'Unlimited generations'
                            : `${plan.limits.skyboxGenerations} generations per day`
                          }
                        </div>

                        <ul className="text-sm text-gray-300 space-y-3 mb-6 text-left">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center">
                              <svg
                                className="w-4 h-4 text-green-400 mr-2 flex-shrink-0"
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
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => handlePlanSelect(plan.id)}
                          disabled={currentPlan === plan.id}
                          className={`
                            w-full px-4 py-3 rounded-lg font-medium transition-all duration-200
                            ${currentPlan === plan.id
                              ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 text-white transform hover:-translate-y-0.5 active:translate-y-0 border border-purple-500/30'
                            }
                          `}
                        >
                          {currentPlan === plan.id ? 'Current Plan' : 'Select Plan'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-400">
                  <p>All plans include access to our community and basic support</p>
                  <p className="mt-2">Need help choosing? Contact our support team</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Add this to your global CSS or Tailwind config
const styles = `
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  .animate-gradient-shift {
    animation: gradient-shift 8s ease infinite;
    background-size: 200% 200%;
  }
`;

export default UpgradeModal; 