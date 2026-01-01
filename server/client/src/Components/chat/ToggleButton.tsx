import React from 'react';
import { motion } from 'framer-motion';

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({ 
  isOpen, 
  onClick, 
  unreadCount = 0 
}) => {
  return (
    <motion.button
      onClick={onClick}
      className={`
        fixed z-[1001]
        w-10 h-10
        rounded-lg
        backdrop-blur-md
        ${isOpen ? 'bg-[#171717]/95' : 'bg-[#0a0a0a]/80'}
        border border-white/10
        hover:border-primary-500/30
        shadow-[0_4px_24px_rgba(0,0,0,0.4)]
        hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)]
        flex items-center justify-center
        text-gray-300 hover:text-primary-400
        transition-all duration-300
        group
      `}
      animate={{ 
        rotate: isOpen ? 180 : 0,
      }}
      style={{
        top: '16px',
        left: isOpen ? '276px' : '16px',
      }}
      transition={{ 
        duration: 0.3, 
        type: 'spring', 
        stiffness: 300
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {/* Chat icon */}
      <svg 
        className="w-6 h-6 transition-transform duration-300" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
        />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && !isOpen && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="
            absolute -top-1 -right-1
            w-5 h-5
            rounded-full
            bg-gradient-to-r from-red-500 to-pink-500
            border-2 border-dark-900
            flex items-center justify-center
            text-[10px] font-semibold text-white
            shadow-lg
          "
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.div>
      )}

      {/* Pulse effect when active */}
      {isOpen && (
        <motion.div
          className="absolute inset-0 rounded-full bg-primary-500/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </motion.button>
  );
};

