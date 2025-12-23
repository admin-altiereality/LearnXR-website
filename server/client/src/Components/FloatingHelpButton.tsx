import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaQuestionCircle, FaTimes } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';

const FloatingHelpButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  // Don't show on the help page itself
  if (location.pathname === '/help') {
    return null;
  }

  const handleClick = () => {
    navigate('/help');
  };

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <motion.button
        onClick={handleClick}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="
          relative
          w-14 h-14
          rounded-full
          bg-gradient-to-r from-cyan-500 to-blue-500
          hover:from-cyan-400 hover:to-blue-400
          text-white
          shadow-lg shadow-cyan-500/50
          flex items-center justify-center
          transition-all duration-300
          border-2 border-white/20
          hover:border-white/40
          hover:scale-110
        "
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isHovered ? (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute right-full mr-4 whitespace-nowrap"
            >
              <div className="
                px-4 py-2
                bg-[#141414]/95
                backdrop-blur-xl
                border border-[#262626]
                rounded-xl
                text-sm text-white
                shadow-lg
              ">
                Need Help?
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-[#262626]"></div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <FaQuestionCircle className="w-6 h-6" />
        
        {/* Pulse animation */}
        <motion.div
          className="absolute inset-0 rounded-full bg-cyan-400"
          animate={{
            scale: [1, 1.5, 1.5, 1],
            opacity: [0.5, 0, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.button>
    </motion.div>
  );
};

export default FloatingHelpButton;

