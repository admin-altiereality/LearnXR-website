/**
 * API Key Table Component
 * Displays and manages user's API keys
 * Redesigned with editorial, technical aesthetic
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaKey, 
  FaTrash, 
  FaSync, 
  FaLock, 
  FaUnlock,
  FaClock
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { ApiKeyListItem, revokeApiKey, regenerateApiKey } from '../../services/apiKeyService';
import { ApiKeyScope } from '../../types/apiKey';
import { formatRelativeTime, formatDateWithRelative } from '../../utils/relativeTime';

interface ApiKeyTableProps {
  apiKeys: ApiKeyListItem[];
  onRefresh: () => void;
  onKeyRegenerated: (response: any) => void;
}

const ApiKeyTable: React.FC<ApiKeyTableProps> = ({
  apiKeys,
  onRefresh,
  onKeyRegenerated
}) => {
  const [loadingKeyId, setLoadingKeyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDateWithRelative(dateString, true);
  };

  const handleRevoke = async (keyId: string) => {
    setLoadingKeyId(keyId);
    try {
      await revokeApiKey(keyId);
      toast.success('API key revoked successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke API key');
    } finally {
      setLoadingKeyId(null);
      setConfirmRevokeId(null);
    }
  };

  const handleRegenerate = async (keyId: string) => {
    setLoadingKeyId(keyId);
    try {
      const response = await regenerateApiKey(keyId);
      toast.success('API key regenerated');
      onKeyRegenerated(response);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate API key');
    } finally {
      setLoadingKeyId(null);
    }
  };

  const activeKeys = apiKeys.filter(k => !k.revoked);
  const revokedKeys = apiKeys.filter(k => k.revoked);

  if (apiKeys.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16 md:py-20 px-4"
      >
        <div className="w-20 h-20 rounded-full bg-[#1a1612]/60 border border-amber-900/30 flex items-center justify-center mx-auto mb-6">
          <FaKey className="w-8 h-8 text-amber-700/40" />
        </div>
        <h3 className="text-xl font-bold text-white mb-3 font-display">
          No API Keys Yet
        </h3>
        <p className="text-sm text-amber-100/50 font-body max-w-md mx-auto leading-relaxed">
          Create your first API key to start integrating In3D's generation capabilities into your applications.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Active Keys */}
      {activeKeys.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-amber-600/50" />
            <h3 className="text-sm uppercase tracking-wider font-semibold text-amber-400/70 font-display">
              Active Keys
            </h3>
            <span className="px-2.5 py-0.5 bg-amber-900/20 border border-amber-800/30 text-amber-400/70 text-xs font-medium font-display">
              {activeKeys.length}
            </span>
          </div>
          <div className="space-y-3 md:space-y-4">
            {activeKeys.map((key, index) => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="group relative p-5 md:p-6 bg-gradient-to-br from-[#1a1612]/80 to-[#0f0d0a]/80 border border-amber-900/30 hover:border-amber-700/50 transition-all duration-300 backdrop-blur-sm"
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500/60 to-amber-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
                  {/* Key Info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-lg font-bold text-white font-display">
                        {key.label}
                      </h4>
                      <span className={`px-3 py-1 rounded border text-xs font-semibold font-display uppercase tracking-wide ${
                        key.scope === ApiKeyScope.FULL
                          ? 'bg-orange-900/20 text-orange-300/90 border-orange-800/40'
                          : 'bg-amber-900/20 text-amber-300/90 border-amber-800/40'
                      }`}>
                        {key.scope === ApiKeyScope.FULL ? (
                          <span className="flex items-center gap-1.5">
                            <FaUnlock className="w-2.5 h-2.5" />
                            Full Access
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <FaLock className="w-2.5 h-2.5" />
                            Read Only
                          </span>
                        )}
                      </span>
                    </div>
                    
                    <div className="font-mono text-sm text-amber-300/70 bg-[#0a0806]/60 px-3 py-2 border border-amber-900/20 inline-block">
                      {key.keyPrefix}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-amber-100/50 font-body">
                      <span className="flex items-center gap-2">
                        <FaClock className="w-3 h-3" />
                        <span>Created {formatDate(key.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <FaClock className="w-3 h-3" />
                        <span>Last used {formatRelativeTime(key.lastUsedAt)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 lg:flex-shrink-0">
                    {confirmRevokeId === key.id ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 p-2 bg-[#0f0d0a] border border-red-900/40"
                      >
                        <span className="text-xs text-red-400/70 font-display uppercase tracking-wide">Confirm?</span>
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={loadingKeyId === key.id}
                          className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/40 border border-red-800/40 text-red-300 text-xs font-semibold font-display uppercase tracking-wide transition-all disabled:opacity-50"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRevokeId(null)}
                          className="px-3 py-1.5 bg-[#1a1612] hover:bg-[#0f0d0a] border border-amber-900/30 text-amber-100/60 text-xs font-semibold font-display uppercase tracking-wide transition-all"
                        >
                          No
                        </button>
                      </motion.div>
                    ) : (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRegenerate(key.id)}
                          disabled={loadingKeyId === key.id}
                          className="p-2.5 bg-[#0f0d0a] border border-amber-900/30 hover:border-amber-700/50 text-amber-400/70 hover:text-amber-300 transition-all duration-300 disabled:opacity-40"
                          title="Regenerate key"
                        >
                          {loadingKeyId === key.id ? (
                            <div className="w-4 h-4 border-2 border-amber-800/30 border-t-amber-500 rounded-full animate-spin" />
                          ) : (
                            <FaSync className="w-4 h-4" />
                          )}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setConfirmRevokeId(key.id)}
                          disabled={loadingKeyId === key.id}
                          className="p-2.5 bg-[#0f0d0a] border border-red-900/30 hover:border-red-700/50 text-red-400/70 hover:text-red-300 transition-all duration-300 disabled:opacity-40"
                          title="Revoke key"
                        >
                          <FaTrash className="w-4 h-4" />
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-red-900/50 to-red-900/30" />
            <h3 className="text-sm uppercase tracking-wider font-semibold text-red-400/50 font-display">
              Revoked Keys
            </h3>
            <span className="px-2.5 py-0.5 bg-red-950/20 border border-red-900/20 text-red-400/50 text-xs font-medium font-display">
              {revokedKeys.length}
            </span>
          </div>
          <div className="space-y-2">
            {revokedKeys.map((key) => (
              <div
                key={key.id}
                className="p-4 bg-[#0f0d0a]/40 border border-red-900/10 opacity-60"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-red-400/40 line-through font-display">
                      {key.label}
                    </span>
                    <span className="px-2 py-0.5 bg-red-950/20 border border-red-900/20 text-red-400/40 text-xs font-semibold font-display uppercase">
                      Revoked
                    </span>
                  </div>
                  <span className="font-mono text-xs text-red-400/30">
                    {key.keyPrefix}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyTable;
