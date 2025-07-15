import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { razorpayService } from '../services/razorpayService';
import { SUBSCRIPTION_PLANS, subscriptionService } from '../services/subscriptionService';

const UpgradeModal = ({ isOpen, onClose, currentPlan, onSubscriptionUpdate }) => {
  const { user } = useAuth();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handlePlanSelect = async (planId) => {
    try {
      if (!user || !user.email) {
        toast.error('Please sign in to upgrade your plan');
        return;
      }

      // Check if Razorpay is available
      if (!razorpayService.isAvailable()) {
        toast.error('Payment is not available at the moment. Please try again later or contact support.');
        return;
      }

      const loadingToast = toast.loading('Initializing payment...');
      
      try {
        await razorpayService.initializePayment(planId, user.email, user.uid);
        toast.dismiss(loadingToast);
        
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
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message === 'Payment cancelled') {
          toast.error('Payment was cancelled');
        } else if (error.message.includes('not properly initialized')) {
          toast.error('Payment service is not available. Please try again later.');
        } else if (error.message.includes('popup') || error.message.includes('COOP') || error.message.includes('Cross-Origin')) {
          toast.error('Popup blocked by browser. Please allow popups for this site and try again, or contact support for alternative payment methods.');
        } else if (error.message.includes('Failed to create order') || error.message.includes('404')) {
          toast.error('Payment service temporarily unavailable. Please try again in a few minutes or contact support.');
        } else if (error.message.includes('Payment failed')) {
          toast.error('Payment failed. Please check your payment details and try again.');
        } else {
          toast.error(`Payment error: ${error.message}`);
        }
      } else {
        toast.error('An unexpected error occurred. Please try again or contact support.');
      }
    }
  };

  // Create portal to render modal at root level
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[99999]"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-4xl bg-gray-900/95 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-2xl"
              style={{ zIndex: 100000 }}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 
                         border border-white/10 transition-all duration-200 group z-10"
                style={{ zIndex: 100001 }}
              >
                <svg className="w-5 h-5 text-white/70 group-hover:text-white/90" 
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="px-6 py-8">
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
                      className={`relative bg-gray-800/50 rounded-lg p-6 border transition-all duration-200 hover:transform hover:-translate-y-1 
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
                            ? 'Unlimited In3D.Ai generations'
                            : `${plan.limits.skyboxGenerations} In3D.Ai generations per day`
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
    </AnimatePresence>,
    document.body
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