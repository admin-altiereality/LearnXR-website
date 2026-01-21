import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaCrown, FaRocket } from 'react-icons/fa';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '../services/subscriptionService';
// @ts-ignore - UpgradeModal is a JSX file
import UpgradeModal from './UpgradeModal';

interface UpgradeButtonProps {
  variant?: 'default' | 'compact' | 'navbar';
  className?: string;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({ variant = 'default', className = '' }) => {
  const { subscription, isFreePlan, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Don't show if user is on the highest tier (enterprise) or not on free plan (for navbar)
  const isOnHighestTier = subscriptionService.isOnHighestTier(subscription?.planId || 'free');
  
  // For navbar variant, only show if on free plan
  if (variant === 'navbar' && !isFreePlan) {
    return null;
  }

  // Don't show for enterprise users
  if (isOnHighestTier) {
    return null;
  }

  const handleClick = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setShowUpgradeModal(true);
  };

  const handleSubscriptionUpdate = async () => {
    await refreshSubscription();
  };

  if (variant === 'navbar') {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full
            bg-gradient-to-r from-amber-500 to-orange-500
            hover:from-amber-400 hover:to-orange-400
            text-white font-semibold text-sm
            shadow-lg shadow-amber-500/25
            transition-all duration-300
            ${className}
          `}
        >
          <FaCrown className="w-4 h-4" />
          <span>Upgrade</span>
        </motion.button>

        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={subscription?.planId || 'free'}
          onSubscriptionUpdate={handleSubscriptionUpdate}
        />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClick}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg
            bg-gradient-to-r from-amber-500/20 to-orange-500/20
            hover:from-amber-500/30 hover:to-orange-500/30
            text-amber-300 font-medium text-sm
            border border-amber-500/30
            transition-all duration-300
            ${className}
          `}
        >
          <FaRocket className="w-3 h-3" />
          <span>Upgrade</span>
        </motion.button>

        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={subscription?.planId || 'free'}
          onSubscriptionUpdate={handleSubscriptionUpdate}
        />
      </>
    );
  }

  // Default variant
  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`
          w-full flex items-center justify-center gap-3 
          px-6 py-4 rounded-xl
          bg-gradient-to-r from-amber-500 to-orange-500
          hover:from-amber-400 hover:to-orange-400
          text-white font-bold text-lg
          shadow-lg shadow-amber-500/25
          transition-all duration-300
          ${className}
        `}
      >
        <FaRocket className="w-5 h-5" />
        <span>Upgrade Plan</span>
        <FaCrown className="w-5 h-5" />
      </motion.button>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={subscription?.planId || 'free'}
        onSubscriptionUpdate={handleSubscriptionUpdate}
      />
    </>
  );
};

export default UpgradeButton;
