import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingMessageBoxProps {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  isVisible?: boolean;
  onClose?: () => void;
}

export const FloatingMessageBox: React.FC<FloatingMessageBoxProps> = ({ 
  messages, 
  isVisible = true,
  onClose 
}) => {
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Show the latest assistant message
  useEffect(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length > 0) {
      const latest = assistantMessages[assistantMessages.length - 1];
      setCurrentMessage(latest.content);
    } else {
      setCurrentMessage(null);
    }
  }, [messages]);

  // Auto-hide after 8 seconds if not expanded
  useEffect(() => {
    if (currentMessage && !isExpanded) {
      const timer = setTimeout(() => {
        setCurrentMessage(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [currentMessage, isExpanded]);

  if (!isVisible || !currentMessage) {
    return null;
  }

  return (
    <AnimatePresence>
      {currentMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 right-4 z-50 max-w-sm"
        >
          <div className="bg-gray-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-purple-500/10 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  Teacher
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    {isExpanded ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    )}
                  </svg>
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Message Content */}
            <div className={`px-3 py-2 ${isExpanded ? 'max-h-96 overflow-y-auto' : ''}`}>
              <p className="text-sm text-gray-100 leading-relaxed">
                {currentMessage}
              </p>
            </div>

            {/* Collapsed view indicator */}
            {!isExpanded && currentMessage.length > 100 && (
              <div className="px-3 pb-2">
                <span className="text-xs text-gray-400">Click to expand</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

