import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = async (planId: string) => {
    console.log('handleSelectPlan called with planId:', planId, 'billingCycle:', billingCycle);
    console.log('Current user:', user);

    if (!user || !user.email) {
      console.log('No user or email found');
      toast.error('Please sign in to upgrade your plan');
      return;
    }

    // Check if Razorpay is available
    if (!razorpayService.isAvailable()) {
      toast.error('Payment service is not available. Please contact support.');
      return;
    }

    try {
      console.log('Attempting to initialize payment...');
      await razorpayService.initializePayment(planId, user.email, user.uid, billingCycle);
      console.log('Payment initialization successful');
      toast.success('Payment successful! Your plan will be updated shortly.');
    } catch (error) {
      console.error('Payment error details:', error);
      if (error instanceof Error) {
        if (error.message === 'Payment cancelled' || error.message.includes('cancelled')) {
          toast.error('Payment was cancelled');
        } else if (error.message.includes('blocked')) {
          toast.error('Popup blocked. Please allow popups for this site and try again.');
        } else if (error.message.includes('not available') || error.message.includes('not configured')) {
          toast.error('Payment service is not available. Please contact support.');
        } else {
          toast.error(error.message || 'Failed to process payment. Please try again.');
        }
      } else {
        console.error('Payment error:', error);
        toast.error('Failed to process payment. Please try again.');
      }
    }
  };

  const getPlanStyle = (planId: string) => {
    switch (planId) {
      case 'free':
        return {
          accent: 'text-gray-400',
          accentBg: 'bg-gray-500/10',
          accentBorder: 'border-gray-500/20',
          accentHover: 'hover:border-gray-400/40',
          button: 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600/30',
          highlight: false
        };
      case 'pro':
        return {
          accent: 'text-amber-400',
          accentBg: 'bg-amber-500/10',
          accentBorder: 'border-amber-500/30',
          accentHover: 'hover:border-amber-500/50',
          button: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40',
          highlight: true
        };
      case 'team':
        return {
          accent: 'text-cyan-400',
          accentBg: 'bg-cyan-500/10',
          accentBorder: 'border-cyan-500/30',
          accentHover: 'hover:border-cyan-500/50',
          button: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border-cyan-500/40',
          highlight: false
        };
      case 'enterprise':
        return {
          accent: 'text-orange-400',
          accentBg: 'bg-orange-500/10',
          accentBorder: 'border-orange-500/30',
          accentHover: 'hover:border-orange-500/50',
          button: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/40',
          highlight: false
        };
      default:
        return {
          accent: 'text-gray-400',
          accentBg: 'bg-gray-500/10',
          accentBorder: 'border-gray-500/20',
          accentHover: 'hover:border-gray-400/40',
          button: 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600/30',
          highlight: false
        };
    }
  };

  const currentPrice = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (plan.isCustomPricing) return null;
    return billingCycle === 'monthly' ? plan.price : plan.yearlyPrice;
  };

  const getSavings = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (plan.isCustomPricing || plan.price === 0) return null;
    const monthlyTotal = plan.price * 12;
    const savings = monthlyTotal - plan.yearlyPrice;
    return savings > 0 ? savings : null;
  };

  // Separate regular plans from Enterprise
  const regularPlans = SUBSCRIPTION_PLANS.filter(plan => plan.id !== 'enterprise');
  const enterprisePlan = SUBSCRIPTION_PLANS.find(plan => plan.id === 'enterprise');

  const renderPlanCard = (plan: typeof SUBSCRIPTION_PLANS[0], index: number, isEnterprise = false) => {
    const style = getPlanStyle(plan.id);
    const isCurrent = currentSubscription?.planId === plan.id;
    const isHighlighted = style.highlight;
    const price = currentPrice(plan);
    const savings = getSavings(plan);

    return (
      <motion.div
        key={plan.id}
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ 
          duration: 0.7, 
          delay: index * 0.15,
          ease: [0.16, 1, 0.3, 1]
        }}
        className={`
          relative group
          ${isHighlighted && !isEnterprise ? 'md:-mt-4 md:mb-4' : ''}
          ${isEnterprise ? 'col-span-full' : ''}
        `}
      >
        {isHighlighted && !isEnterprise && (
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-amber-500/30 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-all duration-500 animate-pulse"></div>
        )}
        <div
          className={`
            relative h-full rounded-3xl border backdrop-blur-md
            ${isEnterprise 
              ? 'p-8 lg:p-12' 
              : 'p-6 sm:p-8'
            }
            ${isCurrent 
              ? `${style.accentBorder} ${style.accentBg} card-glow` 
              : `${style.accentBorder} bg-gradient-to-br from-black/50 to-black/30`
            }
            ${style.accentHover}
            ${isHighlighted && !isEnterprise ? 'border-amber-500/60 shadow-2xl shadow-amber-500/20 ring-1 ring-amber-500/20' : ''}
            ${isEnterprise ? 'border-orange-500/60 shadow-2xl shadow-orange-500/20 ring-1 ring-orange-500/20' : ''}
            ${plan.id === 'team' ? 'border-cyan-500/40 shadow-xl shadow-cyan-500/10' : ''}
            ${plan.id === 'free' ? 'border-gray-500/30' : ''}
            card-glow-hover
            transition-all duration-300
            overflow-hidden
          `}
        >
          {/* Gradient overlay */}
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
            isHighlighted ? 'bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-amber-500/8' : 
            isEnterprise ? 'bg-gradient-to-br from-orange-500/8 via-amber-500/5 to-orange-500/8' :
            plan.id === 'team' ? 'bg-gradient-to-br from-cyan-500/8 via-blue-500/5 to-cyan-500/8' :
            'bg-gradient-to-br from-gray-500/5 to-transparent'
          }`}></div>
          
          {/* Animated border glow */}
          <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
            isHighlighted ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20' :
            isEnterprise ? 'bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-orange-500/20' :
            plan.id === 'team' ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-cyan-500/20' :
            'bg-gradient-to-r from-gray-500/10 to-transparent'
          } blur-sm -z-10`}></div>
          {isHighlighted && !isEnterprise && (
            <div className="absolute top-4 right-4 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/40 via-orange-500/30 to-amber-500/40 border border-amber-500/50 backdrop-blur-md shadow-xl shadow-amber-500/30 z-20">
              <span className="text-amber-200 text-xs font-mono font-bold tracking-wider drop-shadow-lg">POPULAR</span>
            </div>
          )}

          {isEnterprise ? (
            <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
              <div className="flex-1 text-center lg:text-left">
                <h3 className={`text-3xl lg:text-4xl font-display font-bold mb-4 bg-gradient-to-r ${style.accent} bg-clip-text text-transparent`}>
                  {plan.name}
                </h3>
                <p className="text-base lg:text-lg text-gray-400 mb-6 font-body">
                  Custom pricing tailored to your needs
                </p>
                <div className="mb-6">
                  <span className={`text-4xl lg:text-5xl font-display font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent`}>
                    Contact Us
                  </span>
                </div>
                <div className={`text-sm lg:text-base font-mono ${style.accent} mb-6 opacity-80`}>
                  Custom quota & dedicated support
                </div>
              </div>

              <div className="flex-1 lg:flex-[1.5]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start group/item">
                      <div className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-lg ${style.accentBg} border ${style.accentBorder} flex items-center justify-center mr-3 mt-0.5 group-hover/item:scale-110 transition-transform duration-200`}>
                        <svg
                          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${style.accent}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-300 font-body leading-relaxed group-hover/item:text-gray-200 transition-colors">{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => window.open('mailto:support@in3d.ai?subject=Enterprise Plan Inquiry', '_blank')}
                  disabled={isCurrent}
                  className={`
                    relative w-full lg:w-auto px-8 py-4 rounded-xl font-display font-semibold text-base
                    transition-all duration-300 border overflow-hidden
                    ${isCurrent
                      ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border-gray-700/30'
                      : `${style.button} transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] group`
                    }
                  `}
                >
                  {!isCurrent && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  )}
                  <span className="relative">{isCurrent ? 'Current Plan' : 'Contact Sales'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative z-10 text-center mb-6 sm:mb-8">
                <h3 className={`text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-3 sm:mb-4 ${style.accent}`}>
                  {plan.name}
                </h3>
                
                <div className="mb-3">
                  {plan.isCustomPricing ? (
                    <div>
                      <span className={`text-3xl sm:text-4xl font-display font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent`}>
                        Contact Us
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className={`text-4xl sm:text-5xl lg:text-6xl font-display font-bold bg-gradient-to-r from-white via-white to-gray-200 bg-clip-text text-transparent`}>
                          {price !== null && price === 0 ? 'Free' : price !== null ? `₹${price.toLocaleString('en-IN')}` : 'Contact Us'}
                        </span>
                        {price !== null && price > 0 && (
                          <span className="text-gray-400 font-body text-sm sm:text-base">
                            /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {savings && savings > 0 && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-500/25 border border-amber-500/40 backdrop-blur-sm shadow-lg">
                    <svg className="w-3.5 h-3.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs sm:text-sm text-amber-200 font-mono font-bold">
                      Save ₹{savings.toLocaleString('en-IN')}/year
                    </span>
                  </div>
                )}

                <div className={`text-xs sm:text-sm font-mono ${style.accent} mb-4 sm:mb-6 opacity-80`}>
                  {plan.limits.skyboxGenerations === Infinity 
                    ? 'Custom quota'
                    : `${plan.limits.skyboxGenerations} generations/month`
                  }
                </div>
              </div>

              <ul className="relative z-10 space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 text-left">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start group/item">
                    <div className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-lg ${style.accentBg} border ${style.accentBorder} flex items-center justify-center mr-3 mt-0.5 group-hover/item:scale-110 transition-transform duration-200`}>
                      <svg
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${style.accent}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-300 font-body leading-relaxed group-hover/item:text-gray-200 transition-colors">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => plan.isCustomPricing ? window.open('mailto:support@in3d.ai?subject=Enterprise Plan Inquiry', '_blank') : handleSelectPlan(plan.id)}
                disabled={isCurrent}
                className={`
                  relative z-10 w-full px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-display font-semibold text-sm sm:text-base
                  transition-all duration-300 border overflow-hidden
                  ${isCurrent
                    ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border-gray-700/30'
                    : `${style.button} transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] relative group`
                  }
                `}
              >
                {!isCurrent && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                )}
                <span className="relative flex items-center justify-center">
                  {isCurrent ? (
                    <>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Current Plan
                    </>
                  ) : plan.isCustomPricing ? (
                    'Contact Sales'
                  ) : (
                    'Get Started'
                  )}
                </span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full">
      {/* Billing Cycle Toggle */}
      <div className="flex justify-center mb-10 sm:mb-12 lg:mb-16">
        <div className="relative inline-flex items-center p-2 rounded-2xl bg-gradient-to-r from-black/70 via-black/50 to-black/70 backdrop-blur-xl border border-amber-500/30 shadow-2xl shadow-amber-500/10">
          {/* Background glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20 rounded-2xl blur opacity-50"></div>
          
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`
              relative z-10 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-display font-semibold text-sm sm:text-base transition-all duration-300
              ${billingCycle === 'monthly'
                ? 'bg-gradient-to-r from-amber-500/30 via-orange-500/25 to-amber-500/30 text-amber-100 border border-amber-500/50 shadow-xl shadow-amber-500/20 scale-105'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }
            `}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`
              relative z-10 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-display font-semibold text-sm sm:text-base transition-all duration-300
              ${billingCycle === 'yearly'
                ? 'bg-gradient-to-r from-amber-500/30 via-orange-500/25 to-amber-500/30 text-amber-100 border border-amber-500/50 shadow-xl shadow-amber-500/20 scale-105'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }
            `}
          >
            <span className="flex items-center gap-2">
              Yearly
              <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/30 to-orange-500/30 border border-amber-500/40 text-xs text-amber-200 font-bold">
                Save 17%
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* Regular Pricing Cards (Free, Pro, Team) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 lg:mb-12">
        {regularPlans.map((plan, index) => renderPlanCard(plan, index, false))}
      </div>

      {/* Enterprise Plan - Full Width */}
      {enterprisePlan && (
        <div className="mt-8 lg:mt-12">
          {renderPlanCard(enterprisePlan, regularPlans.length, true)}
        </div>
      )}
    </div>
  );
}; 