import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const UpgradeModal = ({ isOpen, onClose, currentPlan }) => {
  const navigate = useNavigate();

  const handleUpgradeClick = () => {
    navigate('/pricing');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container - ensures proper centering */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative max-h-[90vh] w-[90vw] max-w-lg m-auto overflow-y-auto"
          >
            <div className="relative rounded-2xl">
              {/* Glassmorphic background with gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl" />
              
              {/* Border glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-xl" />
              
              {/* Content container */}
              <div className="relative bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 animate-gradient-shift" />

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

                {/* Content */}
                <div className="text-center space-y-4">
                  <div className="relative inline-flex p-3 rounded-full bg-purple-500/20 backdrop-blur-sm">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>

                  <h3 className="text-2xl font-bold text-white">
                    Upgrade Your Experience
                  </h3>

                  <p className="text-gray-300/90">
                    {currentPlan === 'Free' 
                      ? "You've reached your free tier limit. Upgrade to Premium for unlimited generations and exclusive features!"
                      : "Ready for more? Upgrade to a higher tier for increased generation limits and advanced features!"}
                  </p>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleUpgradeClick}
                      className="w-full py-3 px-4 bg-gradient-to-r from-purple-500/80 to-pink-600/80 
                               hover:from-purple-500/90 hover:to-pink-600/90 
                               text-white rounded-lg font-medium
                               shadow-[0_0_15px_rgba(168,85,247,0.5)]
                               transition-all duration-200 hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]
                               backdrop-blur-sm border border-white/10"
                    >
                      View Pricing Plans
                    </button>

                    <button
                      onClick={onClose}
                      className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 
                               text-white/80 hover:text-white/90 rounded-lg 
                               transition-colors duration-200 backdrop-blur-sm
                               border border-white/5 hover:border-white/10"
                    >
                      Maybe Later
                    </button>
                  </div>

                  {/* Feature list */}
                  <div className="mt-8 text-left space-y-3">
                    <h4 className="text-sm font-medium text-white/90">Upgrade to unlock:</h4>
                    <ul className="space-y-2">
                      {[
                        'Increased daily generations',
                        'Higher quality outputs',
                        'Priority processing',
                        'Advanced customization options',
                        'Premium support'
                      ].map((feature, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center text-sm text-gray-300/90"
                        >
                          <svg className="w-4 h-4 mr-2 text-green-400" 
                               fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
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