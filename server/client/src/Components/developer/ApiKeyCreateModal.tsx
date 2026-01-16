/**
 * API Key Create Modal
 * Modal for creating new API keys with one-time key display
 * Redesigned with editorial, technical aesthetic
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaKey, 
  FaTimes, 
  FaCopy, 
  FaCheck, 
  FaExclamationTriangle,
  FaLock,
  FaUnlock
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { createApiKey, CreateApiKeyResponse } from '../../services/apiKeyService';
import { ApiKeyScope } from '../../types/apiKey';

interface ApiKeyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: () => void;
  preCreatedKey?: CreateApiKeyResponse | null;
}

const ApiKeyCreateModal: React.FC<ApiKeyCreateModalProps> = ({
  isOpen,
  onClose,
  onKeyCreated,
  preCreatedKey
}) => {
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>(ApiKeyScope.READ);
  const [isLoading, setIsLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(preCreatedKey || null);
  const [copied, setCopied] = useState(false);

  // Update createdKey when preCreatedKey changes
  useEffect(() => {
    if (preCreatedKey) {
      setCreatedKey(preCreatedKey);
    } else if (!isOpen) {
      // Reset when modal closes
      setCreatedKey(null);
    }
  }, [preCreatedKey, isOpen]);

  const handleCreate = async () => {
    if (!label.trim()) {
      toast.error('Please enter a label for your API key');
      return;
    }

    setIsLoading(true);
    try {
      const response = await createApiKey(label.trim(), scope);
      setCreatedKey(response);
      onKeyCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey?.apiKey.rawKey) {
      await navigator.clipboard.writeText(createdKey.apiKey.rawKey);
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setLabel('');
    setScope(ApiKeyScope.READ);
    setCreatedKey(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl bg-gradient-to-br from-[#1a1612] to-[#0f0d0a] border border-amber-900/40 shadow-2xl overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background texture */}
          <div className="absolute inset-0 opacity-30">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(217, 119, 6, 0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(217, 119, 6, 0.03) 1px, transparent 1px)
                `,
                backgroundSize: '24px 24px'
              }}
            />
          </div>

          {/* Header */}
          <div className="relative flex items-center justify-between p-6 md:p-8 border-b border-amber-900/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-amber-900/20 border border-amber-800/30">
                <FaKey className="w-5 h-5 text-amber-400/80" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white font-display">
                  {createdKey ? 'API Key Created' : 'Create API Key'}
                </h2>
                {!createdKey && (
                  <p className="text-sm text-amber-100/50 font-body mt-1">
                    Generate a new authentication credential
                  </p>
                )}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center bg-[#0f0d0a] border border-amber-900/30 hover:border-amber-700/50 text-amber-400/70 hover:text-amber-300 transition-all duration-300"
            >
              <FaTimes className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Content */}
          <div className="relative p-6 md:p-8">
            {!createdKey ? (
              /* Creation Form */
              <div className="space-y-8">
                {/* Label Input */}
                <div>
                  <label className="block text-sm uppercase tracking-wider font-semibold text-amber-400/70 mb-3 font-display">
                    Label
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g., Production Server, Development, n8n Workflow"
                    className="w-full px-4 py-3.5 bg-[#0f0d0a] border border-amber-900/30 hover:border-amber-800/40 focus:border-amber-700/50 text-white placeholder-amber-900/40 focus:outline-none focus:ring-1 focus:ring-amber-700/30 transition-all duration-300 font-body"
                    maxLength={50}
                  />
                  <p className="mt-2 text-xs text-amber-100/40 font-body">
                    A descriptive name to identify this key
                  </p>
                </div>

                {/* Scope Selection */}
                <div>
                  <label className="block text-sm uppercase tracking-wider font-semibold text-amber-400/70 mb-4 font-display">
                    Access Scope
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setScope(ApiKeyScope.READ)}
                      className={`relative p-5 border-2 transition-all duration-300 ${
                        scope === ApiKeyScope.READ
                          ? 'border-amber-500/60 bg-amber-900/20'
                          : 'border-amber-900/30 bg-[#0f0d0a] hover:border-amber-800/40'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FaLock className={`w-6 h-6 transition-colors ${
                          scope === ApiKeyScope.READ ? 'text-amber-400' : 'text-amber-700/40'
                        }`} />
                        <div className={`font-bold text-base font-display ${
                          scope === ApiKeyScope.READ ? 'text-white' : 'text-amber-100/50'
                        }`}>
                          Read Only
                        </div>
                        <p className="text-xs text-amber-100/40 font-body text-center">
                          View assets, history
                        </p>
                      </div>
                      {scope === ApiKeyScope.READ && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full" />
                      )}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setScope(ApiKeyScope.FULL)}
                      className={`relative p-5 border-2 transition-all duration-300 ${
                        scope === ApiKeyScope.FULL
                          ? 'border-orange-500/60 bg-orange-900/20'
                          : 'border-orange-900/30 bg-[#0f0d0a] hover:border-orange-800/40'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <FaUnlock className={`w-6 h-6 transition-colors ${
                          scope === ApiKeyScope.FULL ? 'text-orange-400' : 'text-orange-700/40'
                        }`} />
                        <div className={`font-bold text-base font-display ${
                          scope === ApiKeyScope.FULL ? 'text-white' : 'text-orange-100/50'
                        }`}>
                          Full Access
                        </div>
                        <p className="text-xs text-orange-100/40 font-body text-center">
                          Generate 3D assets, skyboxes
                        </p>
                      </div>
                      {scope === ApiKeyScope.FULL && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" />
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Create Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleCreate}
                  disabled={isLoading || !label.trim()}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-wider text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 font-display border border-amber-500/30 hover:border-amber-400/50 shadow-[0_4px_20px_rgba(217,119,6,0.3)] hover:shadow-[0_6px_30px_rgba(217,119,6,0.4)] flex items-center justify-center gap-3"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <FaKey className="w-4 h-4" />
                      <span>Generate API Key</span>
                    </>
                  )}
                </motion.button>
              </div>
            ) : (
              /* Key Display (One-Time) */
              <div className="space-y-6">
                {/* Warning Banner */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-amber-950/30 border-2 border-amber-800/40"
                >
                  <div className="flex items-start gap-4">
                    <FaExclamationTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-200 mb-2 font-display">
                        Save your API key now!
                      </p>
                      <p className="text-sm text-amber-200/70 font-body leading-relaxed">
                        This key will only be shown once. Copy it and store it securely.
                        You will not be able to see it again.
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Key Display */}
                <div>
                  <label className="block text-sm uppercase tracking-wider font-semibold text-amber-400/70 mb-3 font-display">
                    Your API Key
                  </label>
                  <div className="relative">
                    <div className="p-5 bg-[#0a0806] border-2 border-amber-900/40 font-mono text-sm text-amber-300/90 break-all pr-16 leading-relaxed">
                      {createdKey.apiKey.rawKey}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleCopy}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-[#0f0d0a] border border-amber-900/30 hover:border-amber-700/50 text-amber-400/70 hover:text-amber-300 transition-all duration-300"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <FaCheck className="w-4 h-4 text-amber-400" />
                      ) : (
                        <FaCopy className="w-4 h-4" />
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#0f0d0a] border border-amber-900/20">
                    <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">Label</p>
                    <p className="text-sm text-white font-semibold font-display">
                      {createdKey.apiKey.label}
                    </p>
                  </div>
                  <div className="p-4 bg-[#0f0d0a] border border-amber-900/20">
                    <p className="text-xs uppercase tracking-wider text-amber-100/40 font-display mb-2">Scope</p>
                    <p className={`text-sm font-bold font-display ${
                      createdKey.apiKey.scope === ApiKeyScope.FULL 
                        ? 'text-orange-400' 
                        : 'text-amber-400'
                    }`}>
                      {createdKey.apiKey.scope === ApiKeyScope.FULL ? 'Full Access' : 'Read Only'}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleClose}
                  className="w-full py-4 bg-[#0f0d0a] hover:bg-[#0a0806] text-white font-bold uppercase tracking-wider text-sm transition-all duration-300 border-2 border-amber-900/30 hover:border-amber-800/40 font-display"
                >
                  Done
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ApiKeyCreateModal;
