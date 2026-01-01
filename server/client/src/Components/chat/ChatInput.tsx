import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isStreaming = false,
  placeholder = "Ask me anything about creating environments...",
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxRows = 8;

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const newRows = Math.min(
      Math.max(1, Math.floor(textarea.scrollHeight / 24)),
      maxRows
    );
    setRows(newRows);
    textarea.style.height = `${newRows * 24}px`;
  };

  const handleSend = () => {
    if (message.trim() && !disabled && !isStreaming) {
      onSend(message.trim());
      setMessage('');
      setRows(1);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-[#1a1a1a]/30 bg-[#0a0a0a]/98 p-3">
      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            rows={rows}
            className="
              w-full
              px-3 py-2.5
              rounded border border-[#1a1a1a]/40
              bg-transparent
              focus:border-[#2a2a2a]/60 focus:bg-white/[0.02]
              text-sm text-gray-200 font-body
              placeholder:text-gray-500/50
              resize-none
              transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none
            "
            style={{ minHeight: '40px', maxHeight: `${maxRows * 24}px` }}
          />
        </div>

        {/* Send button */}
        <motion.button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isStreaming}
          whileHover={{ scale: message.trim() ? 1.05 : 1 }}
          whileTap={{ scale: message.trim() ? 0.95 : 1 }}
          className="
            w-9 h-9
            rounded border border-[#1a1a1a]/40
            bg-transparent hover:bg-white/[0.02] hover:border-[#2a2a2a]/60
            disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center
            text-gray-400 hover:text-gray-300
            transition-all duration-300
          "
          title="Send message (Enter)"
        >
          {isStreaming ? (
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </motion.button>
      </div>
    </div>
  );
};

