import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { FaGlobe, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { unifiedPaymentService } from '../services/unifiedPaymentService';
import { subscriptionService, SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { detectUserCountry, COUNTRIES, getCountryFlag, getCountryName } from '../services/geoPaymentService';

const UpgradeModal = ({ isOpen, onClose, currentPlan, onSubscriptionUpdate }) => {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [geoInfo, setGeoInfo] = useState(null);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Detect user's country on mount
  useEffect(() => {
    const detectGeo = async () => {
      try {
        const detected = await detectUserCountry();
        const providerResult = await unifiedPaymentService.detectProvider();
        setGeoInfo({
          country: detected.country,
          countryName: getCountryName(detected.country),
          provider: providerResult.provider,
          flag: getCountryFlag(detected.country)
        });
      } catch (error) {
        console.error('Failed to detect country:', error);
        setGeoInfo({
          country: 'US',
          countryName: 'United States',
          provider: 'paddle',
          flag: '🇺🇸'
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      detectGeo();
    }
  }, [isOpen]);

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

  const handleCountryChange = async (countryCode) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (!country) return;

    const providerResult = await unifiedPaymentService.detectProvider(countryCode);
    setGeoInfo({
      country: countryCode,
      countryName: country.name,
      provider: providerResult.provider,
      flag: country.flag
    });
    setShowCountrySelector(false);
  };

  const getPriceDisplay = (plan) => {
    if (plan.isCustomPricing) return 'Contact Sales';
    if (plan.price === 0) return 'Free';
    
    if (geoInfo?.provider === 'razorpay') {
      const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
      return `₹${price.toLocaleString('en-IN')}`;
    } else {
      const price = billingCycle === 'yearly' ? plan.yearlyPriceUSD : plan.priceUSD;
      return `$${price}`;
    }
  };

  const handlePlanSelect = async (planId) => {
    try {
      if (!user || !user.email) {
        toast.error('Please sign in to upgrade your plan');
        return;
      }

      if (planId === 'free') {
        toast.error('You cannot downgrade to the free plan from here');
        return;
      }

      if (!unifiedPaymentService.isPaymentAvailable()) {
        toast.error('Payment is not available at the moment. Please try again later or contact support.');
        return;
      }

      setIsProcessing(true);
      const loadingToast = toast.loading('Initializing payment...');
      
      try {
        await unifiedPaymentService.checkout({
          planId,
          userId: user.uid,
          userEmail: user.email,
          billingCycle,
          billingCountry: geoInfo?.country,
          onSuccess: async () => {
            toast.dismiss(loadingToast);
            toast.success('Payment successful! Your plan will be updated shortly.');
            
            // Refresh subscription
            const updatedSubscription = await subscriptionService.getUserSubscription(user.uid);
            if (onSubscriptionUpdate) {
              onSubscriptionUpdate(updatedSubscription);
            }
            onClose();
          },
          onCancel: () => {
            toast.dismiss(loadingToast);
            toast.error('Payment was cancelled');
          },
          onError: (error) => {
            toast.dismiss(loadingToast);
            console.error('Payment error:', error);
            toast.error(error.message || 'Payment failed');
          }
        });
      } catch (error) {
        toast.dismiss(loadingToast);
        throw error;
      }
    } catch (error) {
      console.error('Error handling upgrade:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Payment cancelled') {
          toast.error('Payment was cancelled');
        } else if (error.message.includes('not properly initialized')) {
          toast.error('Payment service is not available. Please try again later.');
        } else if (error.message.includes('popup') || error.message.includes('COOP') || error.message.includes('Cross-Origin')) {
          toast.error('Popup blocked by browser. Please allow popups for this site and try again.');
        } else if (error.message.includes('Failed to create order') || error.message.includes('404')) {
          toast.error('Payment service temporarily unavailable. Please try again in a few minutes.');
        } else {
          toast.error(`Payment error: ${error.message}`);
        }
      } else {
        toast.error('An unexpected error occurred. Please try again or contact support.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter out enterprise plan for the modal
  const displayPlans = SUBSCRIPTION_PLANS.filter(p => p.id !== 'enterprise' && p.id !== 'free');

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
              className="relative w-full max-w-4xl bg-gray-900/95 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-2xl max-h-[90vh] overflow-y-auto"
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
                <div className="text-center mb-6">
                  <h2 className="text-3xl font-bold text-white mb-2">Upgrade Your Plan</h2>
                  <p className="text-gray-400">Select the plan that best fits your needs</p>
                </div>

                {/* Country/Provider Indicator */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <button
                      onClick={() => setShowCountrySelector(!showCountrySelector)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all text-sm text-gray-300"
                    >
                      <FaGlobe className="w-4 h-4 text-gray-400" />
                      {isLoading ? (
                        <span className="animate-pulse">Detecting location...</span>
                      ) : (
                        <>
                          <span className="text-lg">{geoInfo?.flag}</span>
                          <span>{geoInfo?.countryName}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-xs uppercase tracking-wider text-amber-400">
                            {geoInfo?.provider === 'razorpay' ? 'UPI/Cards' : 'International'}
                          </span>
                          <FaChevronDown className={`w-3 h-3 transition-transform ${showCountrySelector ? 'rotate-180' : ''}`} />
                        </>
                      )}
                    </button>

                    {/* Country Selector Dropdown */}
                    {showCountrySelector && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 max-h-60 overflow-y-auto bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl z-50"
                      >
                        <div className="p-2">
                          <p className="text-xs text-gray-500 px-3 py-2 border-b border-white/5">
                            Select your billing country
                          </p>
                          {COUNTRIES.map((country) => (
                            <button
                              key={country.code}
                              onClick={() => handleCountryChange(country.code)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                                geoInfo?.country === country.code
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'hover:bg-white/5 text-gray-300'
                              }`}
                            >
                              <span className="text-lg">{country.flag}</span>
                              <span className="flex-1 text-sm">{country.name}</span>
                              {country.code === 'IN' && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">UPI</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Billing Cycle Toggle */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex items-center p-1 rounded-xl bg-black/30 border border-white/10">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        billingCycle === 'monthly'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        billingCycle === 'yearly'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Yearly
                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
                        Save 17%
                      </span>
                    </button>
                  </div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative bg-gray-800/50 rounded-xl p-6 border transition-all duration-200 hover:transform hover:-translate-y-1 
                        ${currentPlan === plan.id 
                          ? 'border-amber-500/50 bg-amber-900/10' 
                          : 'border-gray-700/50 hover:border-gray-600/50'}`}
                    >
                      {currentPlan === plan.id && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="bg-amber-500/80 text-white text-xs px-3 py-1 rounded-full">
                            Current Plan
                          </span>
                        </div>
                      )}

                      {plan.id === 'pro' && currentPlan !== 'pro' && (
                        <div className="absolute -top-3 right-4">
                          <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full">
                            Popular
                          </span>
                        </div>
                      )}

                      <div className="text-center">
                        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                        <div className="text-3xl font-bold text-white mb-1">
                          {getPriceDisplay(plan)}
                        </div>
                        <div className="text-sm text-gray-400 mb-4">
                          /{billingCycle}
                        </div>

                        <div className="mb-4 text-sm text-gray-300">
                          {plan.limits.skyboxGenerations === Infinity 
                            ? 'Unlimited generations'
                            : `${plan.limits.skyboxGenerations} generations per month`
                          }
                        </div>

                        <ul className="text-sm text-gray-300 space-y-2 mb-6 text-left">
                          {plan.features.slice(0, 5).map((feature, index) => (
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
                          disabled={currentPlan === plan.id || isProcessing}
                          className={`
                            w-full px-4 py-3 rounded-xl font-medium transition-all duration-200
                            ${currentPlan === plan.id || isProcessing
                              ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white transform hover:-translate-y-0.5 active:translate-y-0 border border-amber-500/30'
                            }
                          `}
                        >
                          {isProcessing ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </span>
                          ) : currentPlan === plan.id ? (
                            'Current Plan'
                          ) : (
                            `Upgrade to ${plan.name}`
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Enterprise CTA */}
                <div className="mt-6 text-center p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                  <p className="text-gray-300 mb-2">Need more? Check out our Enterprise plan</p>
                  <button
                    onClick={() => window.open('mailto:support@in3d.ai?subject=Enterprise Plan Inquiry', '_blank')}
                    className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                  >
                    Contact Sales →
                  </button>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-gray-500">
                  <p>Secure payment powered by {geoInfo?.provider === 'razorpay' ? 'Razorpay' : 'Paddle'}</p>
                  <p className="mt-1">30-day money-back guarantee</p>
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

export default UpgradeModal;
